'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, addDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Shield, MessageSquare, Siren, Clock, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
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
    <main className="flex-grow bg-slate-50/50 py-4 sm:py-8 min-h-screen flex flex-col overflow-hidden">
      <div className="container mx-auto px-4 max-w-4xl flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col shadow-2xl overflow-hidden border-none rounded-[2.5rem] bg-white min-h-[500px] max-h-[calc(100dvh-10rem)] sm:max-h-[700px]">
          <CardHeader className="bg-slate-950 text-white p-5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20 shrink-0 shadow-inner">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-xl font-headline tracking-tight">Admin Support</CardTitle>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold">Direct Provider Access</p>
                </div>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="font-bold gap-2 shrink-0 h-10 text-[10px] sm:text-xs rounded-xl shadow-lg shadow-red-900/20">
                        <Siren className="h-4 w-4" /> <span className="hidden xs:inline">Emergency Pause</span><span className="xs:hidden">Off</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-red-600 p-6 text-white text-center space-y-1">
                        <DialogTitle className="text-xl font-headline">Clinical Emergency</DialogTitle>
                        <DialogDescription className="text-red-100 text-xs font-medium">
                            Log an urgent clinical or personal pause.
                        </DialogDescription>
                    </div>
                    <div className="p-6 sm:p-8 space-y-6 max-h-[60dvh] overflow-y-auto custom-scrollbar bg-white">
                        <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest ml-1">Proposed Absence Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-bold h-14 rounded-2xl border-2 transition-all",
                                            !requestedDate ? "text-muted-foreground" : "border-slate-100 hover:border-primary/30"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                        {requestedDate ? format(requestedDate, "PPP") : <span>Select date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
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

                        <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest ml-1">Urgent Context</Label>
                            <Textarea 
                                placeholder="Detail why you need an immediate pause..." 
                                value={emergencyReason}
                                onChange={(e) => setEmergencyReason(e.target.value)}
                                rows={4}
                                className="resize-none rounded-2xl border-2 text-sm p-4 focus-visible:ring-primary transition-colors"
                            />
                        </div>

                        <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl text-[10px] font-bold border border-amber-100 flex gap-3 italic leading-relaxed">
                            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                            Policy: Automated booking locks are applied immediately upon admin approval of emergency requests.
                        </div>
                    </div>
                    <DialogFooter className="p-6 sm:p-8 bg-slate-50 border-t flex flex-col sm:flex-row gap-3">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 rounded-2xl h-12 font-bold order-2 sm:order-1">Cancel</Button>
                        <Button 
                            onClick={handleSubmitEmergencyRequest} 
                            disabled={!emergencyReason.trim() || !requestedDate || isRequesting}
                            className="bg-red-600 hover:bg-red-700 font-bold flex-1 h-12 rounded-2xl shadow-xl shadow-red-100 order-1 sm:order-2"
                        >
                            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "File Emergency"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-50/30 custom-scrollbar space-y-6 overscroll-contain">
            {isLoadingSession || isLoadingMessages ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((msg: any) => {
                const isMe = msg.senderRole === 'doctor';
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] sm:max-w-[70%] p-4 rounded-3xl text-[13px] shadow-sm leading-relaxed",
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
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic text-center p-12 space-y-4">
                <div className="h-16 w-16 rounded-[1.5rem] bg-slate-100 flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">Encryption Verified</p>
                    <p className="text-[11px]">Start a conversation with our administrative team.</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </CardContent>

          <CardFooter className="p-5 sm:p-8 border-t bg-white shrink-0">
            <form onSubmit={handleSendMessage} className="w-full flex gap-3">
              <Input 
                placeholder="Secure professional query..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-slate-50 border-none h-14 text-sm rounded-2xl px-6 focus-visible:ring-primary shadow-inner"
              />
              <Button type="submit" disabled={!newMessage.trim()} className="px-6 bg-slate-950 hover:bg-slate-900 rounded-2xl h-14 shrink-0 shadow-2xl shadow-slate-100">
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
