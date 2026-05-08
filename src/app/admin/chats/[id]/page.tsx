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

  if (isLoadingSession) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/chats')} className="w-fit h-10 px-2 sm:px-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> <span className="text-xs sm:text-sm">Back to Messages</span>
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden flex-col lg:flex-row">
        {/* Chat Area */}
        <Card className="flex-1 flex flex-col shadow-xl border-none overflow-hidden bg-white rounded-2xl">
            <CardHeader className="bg-slate-900 text-white p-4">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">
                {doctor ? doctor.firstName[0] : <User className="h-5 w-5 sm:h-6 sm:w-6" />}
                </div>
                <div className="min-w-0">
                <CardTitle className="text-base sm:text-xl truncate">
                    {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor'}
                </CardTitle>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-bold tracking-tighter">
                    <ShieldCheck className="h-2.5 w-2.5" /> Secure Administrative Session
                </div>
                </div>
            </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 custom-scrollbar space-y-4">
            {isLoadingMessages ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : messages && messages.length > 0 ? (
                messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg: any) => {
                const isMe = msg.senderRole === 'admin';
                return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                        "max-w-[85%] sm:max-w-[70%] p-3 sm:p-4 rounded-2xl text-xs sm:text-sm shadow-sm",
                        isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-white border rounded-bl-none"
                    )}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={cn("text-[9px] mt-1 opacity-50", isMe ? "text-right" : "")}>
                        {format(new Date(msg.timestamp), "p")}
                        </p>
                    </div>
                    </div>
                );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic text-xs">
                <p>No messages yet.</p>
                </div>
            )}
            <div ref={scrollRef} />
            </CardContent>

            <CardFooter className="p-3 sm:p-4 border-t bg-white">
            <form onSubmit={handleSendMessage} className="w-full flex gap-2 sm:gap-3">
                <Input 
                placeholder="Type response..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-slate-50 border-slate-200 h-11 sm:h-10 text-xs sm:text-sm"
                />
                <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-900 hover:bg-slate-800 px-4 sm:px-8 h-11 sm:h-10">
                <Send className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Reply</span>
                </Button>
            </form>
            </CardFooter>
        </Card>

        {/* Sidebar for Emergency Actions - Desktop & Mobile adapted */}
        <div className="w-full lg:w-80 space-y-4 lg:space-y-6">
            <Card className="border-none shadow-lg overflow-hidden rounded-2xl">
                <CardHeader className="bg-primary/5 py-3 px-4">
                    <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-2 uppercase tracking-tighter">
                        <AlertCircle className="h-4 w-4 text-primary" /> Clinical Actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 opacity-60">Pending Emergency Requests</p>
                        {pendingRequests && pendingRequests.length > 0 ? (
                            <div className="space-y-3 max-h-[150px] lg:max-h-none overflow-y-auto pr-1">
                                {pendingRequests.map((req: any) => (
                                    <div key={req.id} className="p-3 bg-muted/30 rounded-xl border text-[11px] space-y-2 hover:bg-muted/50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="text-[9px] bg-white font-bold h-4">
                                                {format(new Date(req.requestedDate), "MMM dd")}
                                            </Badge>
                                            {req.isEmergency && <Badge className="bg-red-500 text-[8px] h-4 font-bold">EMERGENCY</Badge>}
                                        </div>
                                        <p className="italic text-muted-foreground line-clamp-2 leading-tight">{req.reason}</p>
                                        <Button 
                                            size="sm" 
                                            className="w-full h-8 text-[10px] font-bold rounded-lg"
                                            onClick={() => handleApproveLeave(req.id)}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve Absence
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic text-center py-6 bg-muted/20 rounded-xl border border-dashed">
                                No pending leave requests.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none shadow-lg rounded-2xl hidden lg:block">
                <CardContent className="p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Context Panel</h4>
                    <p className="text-[11px] leading-relaxed text-slate-400 italic">
                        Use this area to approve immediate clinical pauses discussed in chat. Approval instantly blocks the doctor's calendar to prevent further patient bookings on that date.
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}