'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, ArrowLeft, User, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Patient } from '@/lib/types';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function AdminSpecificChatPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
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

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !session?.doctorId) return null;
    return query(
        collection(firestore, 'doctorUnavailabilityRequests'), 
        where('doctorId', '==', session.doctorId),
        where('status', '==', 'pending')
    );
  }, [firestore, session?.doctorId]);
  const { data: pendingRequests } = useCollection<any>(requestsQuery);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !sessionId || !user || !session) return;

    const messageData = {
      sessionId,
      senderId: user.uid,
      senderRole: 'admin',
      content: newMessage,
      timestamp: new Date().toISOString(),
      isRead: false,
      doctorId: session.doctorId,
      adminUserId: user.uid
    };

    addDoc(collection(firestore, 'adminDoctorChatSessions', sessionId, 'messages'), messageData);
    setDoc(doc(firestore, 'adminDoctorChatSessions', sessionId), { 
      lastMessageAt: new Date().toISOString(),
      lastMessageContent: newMessage,
      lastMessageSenderRole: 'admin'
    }, { merge: true });
    setNewMessage('');
  };

  const handleApproveLeave = (requestId: string) => {
    if (!firestore) return;
    const reqRef = doc(firestore, 'doctorUnavailabilityRequests', requestId);
    updateDocumentNonBlocking(reqRef, { 
      status: 'approved', 
      processedAt: new Date().toISOString() 
    });
    
    toast({
      title: "Absence Approved",
      description: "Doctor's unavailability has been activated.",
    });
  };

  if (isLoadingSession) return <div className="flex h-[100dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col h-[100dvh] max-h-[100dvh] space-y-4 overflow-hidden bg-slate-50">
      <div className="shrink-0 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/chats')} className="w-fit h-10 px-4 rounded-xl border bg-white shadow-sm font-bold">
            <ArrowLeft className="mr-2 h-4 w-4" /> <span className="text-sm">Support Center</span>
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden flex-col lg:flex-row min-h-0">
        {/* Chat Area - Manageable Height */}
        <Card className="flex-1 flex flex-col shadow-2xl border-none overflow-hidden bg-white rounded-[2.5rem] min-h-0">
            <CardHeader className="bg-slate-950 text-white p-5 shrink-0">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white font-bold text-xl shrink-0 border border-white/5 shadow-inner">
                {doctor ? doctor.firstName[0] : <User className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                <CardTitle className="text-lg font-headline truncate">
                    {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor'}
                </CardTitle>
                <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                    <ShieldCheck className="h-2.5 w-2.5" /> Clinical Support Line
                </div>
                </div>
            </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar space-y-4 overscroll-contain">
            {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
            ) : messages && messages.length > 0 ? (
                messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg: any) => {
                const isMe = msg.senderRole === 'admin';
                return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                        "max-w-[85%] sm:max-w-[70%] p-4 rounded-[1.5rem] text-[13px] shadow-sm leading-relaxed",
                        isMe ? "bg-slate-900 text-white rounded-br-none" : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                    )}>
                        <p>{msg.content}</p>
                        <p className={cn("text-[8px] mt-2 font-bold uppercase tracking-widest opacity-40", isMe ? "text-right" : "")}>
                        {format(new Date(msg.timestamp), "p")}
                        </p>
                    </div>
                    </div>
                );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic text-xs space-y-2 opacity-50">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <p>Encryption established. No messages found.</p>
                </div>
            )}
            <div ref={scrollRef} />
            </CardContent>

            <CardFooter className="p-4 border-t bg-white shrink-0">
            <form onSubmit={handleSendMessage} className="w-full flex gap-3">
                <Input 
                placeholder="Secure response..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-slate-50 border-none h-12 px-5 text-sm rounded-2xl shadow-inner focus-visible:ring-primary"
                />
                <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-950 hover:bg-slate-900 px-6 rounded-2xl h-12 shadow-lg shadow-slate-100">
                <Send className="h-4 w-4 mr-2" /> <span>Reply</span>
                </Button>
            </form>
            </CardFooter>
        </Card>

        {/* Sidebar for Emergency Actions - Fixed Width */}
        <div className="shrink-0 w-full lg:w-80 space-y-6 overflow-hidden flex flex-col min-h-0">
            <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white">
                <CardHeader className="bg-primary/5 py-4 px-5 border-b">
                    <CardTitle className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-primary">
                        <AlertCircle className="h-4 w-4" /> Priority Actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-5 overflow-y-auto max-h-[400px] custom-scrollbar">
                    <div className="space-y-4">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Pending Unavailability</p>
                        {pendingRequests && pendingRequests.length > 0 ? (
                            <div className="space-y-3">
                                {pendingRequests.map((req: any) => (
                                    <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-3 hover:border-primary/20 transition-all">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="text-[9px] bg-white font-bold h-5 border-slate-200">
                                                {format(new Date(req.requestedDate), "MMM dd")}
                                            </Badge>
                                            {req.isEmergency && <Badge className="bg-red-500 text-[8px] h-5 font-bold uppercase animate-pulse">Emergency</Badge>}
                                        </div>
                                        <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-3">"{req.reason}"</p>
                                        <Button 
                                            size="sm" 
                                            className="w-full h-9 text-[10px] font-bold rounded-xl shadow-md"
                                            onClick={() => handleApproveLeave(req.id)}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve Pause
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-slate-50/50 rounded-[1.5rem] border-2 border-dashed border-slate-100">
                                <p className="text-[10px] text-slate-400 font-medium italic">No pending leave requests.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-950 text-white border-none shadow-2xl rounded-[2rem] hidden lg:block overflow-hidden">
                <CardContent className="p-6 space-y-4">
                    <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-primary">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Clinical Context</h4>
                        <p className="text-[11px] leading-relaxed text-slate-400 italic">
                            Approved absences immediately block the provider's precision booking engine. Existing patient sessions for these dates must be shifted manually via the timeline.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
