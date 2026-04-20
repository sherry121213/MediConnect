'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, ArrowLeft, User, Shield, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Patient } from '@/lib/types';

export default function AdminSpecificChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { user } = useUserData();
  const firestore = useFirestore();
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionDocRef = useMemoFirebase(() => {
    if (!firestore || !sessionId) return null;
    return doc(firestore, 'adminDoctorChatSessions', sessionId);
  }, [firestore, sessionId]);

  const { data: session, isLoading: isLoadingSession } = useDoc<any>(sessionDocRef);

  const doctorDocRef = useMemoFirebase(() => {
    if (!firestore || !session?.doctorId) return null;
    return doc(firestore, 'patients', session.doctorId);
  }, [firestore, session?.doctorId]);

  const { data: doctor } = useDoc<Patient>(doctorDocRef);

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
      senderRole: 'admin',
      content: newMessage,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    addDoc(collection(firestore, 'adminDoctorChatSessions', sessionId, 'messages'), messageData);
    setDoc(doc(firestore, 'adminDoctorChatSessions', sessionId), { lastMessageAt: new Date().toISOString() }, { merge: true });
    setNewMessage('');
  };

  if (isLoadingSession) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col h-[calc(100vh-2rem)]">
      <Button variant="ghost" onClick={() => router.push('/admin/chats')} className="mb-4 w-fit">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
      </Button>

      <Card className="flex-1 flex flex-col shadow-2xl border-none overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xl">
              {doctor ? doctor.firstName[0] : <User className="h-6 w-6" />}
            </div>
            <div>
              <CardTitle className="text-xl">
                Chat with {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor'}
              </CardTitle>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-bold">
                <ShieldCheck className="h-3 w-3" /> Secure Administrative Session
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar space-y-4">
          {isLoadingMessages ? (
            <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : messages && messages.length > 0 ? (
            messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg: any) => {
              const isMe = msg.senderRole === 'admin';
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[70%] p-4 rounded-2xl text-sm shadow-sm",
                    isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-white border rounded-bl-none"
                  )}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={cn("text-[10px] mt-1 opacity-50", isMe ? "text-right" : "")}>
                      {format(new Date(msg.timestamp), "p")}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic">
              <p>No messages yet.</p>
            </div>
          )}
          <div ref={scrollRef} />
        </CardContent>

        <CardFooter className="p-4 border-t bg-white">
          <form onSubmit={handleSendMessage} className="w-full flex gap-3">
            <Input 
              placeholder="Send administrative response..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-slate-50 border-slate-200"
            />
            <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-900 hover:bg-slate-800 px-8">
              <Send className="h-4 w-4 mr-2" /> Reply
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
