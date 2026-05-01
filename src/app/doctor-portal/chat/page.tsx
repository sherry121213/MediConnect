'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Shield, MessageSquare, Siren, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

export default function DoctorChatPage() {
  const { user } = useUserData();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [requestedDate, setRequestedDate] = useState<Date>(addDays(new Date(), 1));
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        status: 'open',
        lastMessageSenderRole: 'admin' // Initial state
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
      doctorId: user.uid,
      adminUserId: 'system' 
    };

    addDoc(collection(firestore, 'adminDoctorChatSessions', sessionId, 'messages'), messageData);
    setDoc(doc(firestore, 'adminDoctorChatSessions', sessionId), { 
      lastMessageAt: new Date().toISOString(),
      lastMessageContent: newMessage,
      lastMessageSenderRole: 'doctor'
    }, { merge: true });
    setNewMessage('');
  };

  const handleSubmitEmergencyRequest = () => {
    if (!user || !firestore || !emergencyReason.trim() || !requestedDate) return;
    setIsRequesting(true);

    const requestData = {
      doctorId: user.uid,
      requestedDate: requestedDate.toISOString(),
      reason: `[EMERGENCY CHAT REQUEST] ${emergencyReason}`,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      isEmergency: true,
    };

    const colRef = collection(firestore, 'doctorUnavailabilityRequests');
    addDocumentNonBlocking(colRef, requestData);

    // Also send as a chat message for context
    const messageData = {
      sessionId,
      senderId: user.uid,
      senderRole: 'doctor',
      content: `I have submitted an emergency absence request for ${format(requestedDate, "PPP")}. Reason: ${emergencyReason}`,
      timestamp: new Date().toISOString(),
      isRead: false,
      doctorId: user.uid,
      adminUserId: 'system'
    };
    addDoc(collection(firestore, 'adminDoctorChatSessions', sessionId!, 'messages'), messageData);

    toast({
      title: "Emergency Logged",
      description: `Admin notified of your unavailability for ${format(requestedDate, "MMM dd")}.`,
    });

    setIsRequesting(false);
    setIsDialogOpen(false);
    setEmergencyReason('');
    setRequestedDate(addDays(new Date(), 1));
  };

  return (
    <main className="flex-grow bg-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl h-[calc(100vh-12rem)]">
        <Card className="h-full flex flex-col shadow-xl overflow-hidden border-none">
          <CardHeader className="bg-slate-900 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Administrative Support</CardTitle>
                  <p className="text-xs text-slate-400">Direct line to Mediconnect Admins</p>
                </div>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="font-bold gap-2">
                        <Siren className="h-4 w-4" /> Request Emergency Off
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Emergency Absence Application</DialogTitle>
                        <DialogDescription>
                            File an urgent clinical pause. Note: Policy requires leave to be logged at least 24h in advance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Step 1: Pick Clinical Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-12 rounded-xl border-2",
                                            !requestedDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {requestedDate ? format(requestedDate, "PPP") : <span>Select date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={requestedDate}
                                        onSelect={(date) => date && setRequestedDate(date)}
                                        disabled={(date) => date <= startOfDay(new Date())}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Step 2: Emergency Context</Label>
                            <Textarea 
                                placeholder="Detail the urgent clinical or personal reason for this pause..." 
                                value={emergencyReason}
                                onChange={(e) => setEmergencyReason(e.target.value)}
                                rows={4}
                                className="resize-none rounded-xl border-2"
                            />
                        </div>

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-medium border border-amber-200 flex gap-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            Same-day automated leave is blocked for patient safety. Select tomorrow or later for review.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSubmitEmergencyRequest} 
                            disabled={!emergencyReason.trim() || !requestedDate || isRequesting}
                            className="bg-primary hover:bg-primary/90 font-bold"
                        >
                            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit to Admin"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
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
                      isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-muted rounded-bl-none"
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
                placeholder="Type your clinical query..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-white border-none shadow-inner"
              />
              <Button type="submit" disabled={!newMessage.trim()} className="px-6 bg-slate-900 hover:bg-slate-800">
                <Send className="h-4 w-4 mr-2" /> Send
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
