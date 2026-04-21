'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Shield, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DoctorChatPage() {
  const { user } = useUserData();
  const firestore = useFirestore();
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'adminDoctorChatSessions'), where('doctorId', '==', user.uid));
  }, [firestore, user]);

  const { data: sessions, isLoading: isLoadingSession } = useCollection<any>(sessionsQuery);

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      setSessionId(sessions[0].id);
    } else if (sessions && sessions.length === 0 && user && firestore) {
      const newSessionRef = doc(collection(firestore, 'adminDoctorChatSessions'));
      setDoc(newSessionRef, {
        id: newSessionRef.id,
        doctorId: user.uid,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        status: 'open'
      });
      setSessionId(newSessionRef.id);
    }
  }, [sessions, user, firestore]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !sessionId) return null;
    return query(collection(firestore, 'adminDoctorChatSessions', sessionId, 'messages'));
  }, [firestore, sessionId]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<any>(messagesQuery);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !sessionId || !user) return;

    const messageData = {
      sessionId,
      senderId: user.uid,
      senderRole: 'doctor',
      content: newMessage,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    addDoc(collection(firestore, 'adminDoctorChatSessions', sessionId, 'messages'), messageData);
    setDoc(doc(firestore, 'adminDoctorChatSessions', sessionId), { 
      lastMessageAt: new Date().toISOString(),
      lastMessageContent: newMessage,
      lastMessageSenderRole: 'doctor'
    }, { merge: true });
    setNewMessage('');
  };

  return (
    <main className="flex-grow bg-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl h-[calc(100vh-12rem)]">
        <Card className="h-full flex flex-col shadow-xl overflow-hidden border-none">
          <CardHeader className="bg-primary text-primary-foreground p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Administrative Support</CardTitle>
                  <p className="text-xs opacity-80">Direct line to Mediconnect Admins</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-none">Live Chat</Badge>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar space-y-4">
            {isLoadingSession || isLoadingMessages ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg: any) => {
                const isMe = msg.senderRole === 'doctor';
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] p-3 rounded-2xl text-sm shadow-sm",
                      isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted rounded-bl-none"
                    )}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={cn("text-[10px] mt-1 opacity-70", isMe ? "text-right" : "")}>
                        {format(new Date(msg.timestamp), "p")}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic">
                <MessageSquare className="h-12 w-12 opacity-10 mb-2" />
                <p>Start a conversation with our administrative team.</p>
              </div>
            )}
            <div ref={scrollRef} />
          </CardContent>

          <CardFooter className="p-4 border-t bg-muted/30">
            <form onSubmit={handleSendMessage} className="w-full flex gap-3">
              <Input 
                placeholder="Type your clinical query or concern..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-white border-none shadow-inner"
              />
              <Button type="submit" disabled={!newMessage.trim()} className="px-6">
                <Send className="h-4 w-4 mr-2" /> Send
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}