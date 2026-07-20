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
    <main className="flex-grow bg-secondary/30 py-4 sm:py-8 h-[calc(100dvh-5rem)] sm:h-[calc(100dvh-8rem)] flex flex-col overflow-hidden overscroll-none">
      <div className="container mx-auto px-4 max-w-4xl flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col shadow-xl overflow-hidden border-none min-h-0">
          <CardHeader className="bg-slate-900 text-white p-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white/20 rounded-full shrink-0">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-xl truncate">Administrative Support</CardTitle>
                  <p className="text-[9px] sm:text-xs text-slate-400 truncate">Direct line to Mediconnect Admins</p>
                </div>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="font-bold gap-2 shrink-0 h-8 sm:h-10 text-[10px] sm:text-sm px-2 sm:px-4">
                        <Siren className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Emergency Off</span><span className="xs:hidden">Off</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[2rem] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-headline">Emergency Absence Application</DialogTitle>
                        <DialogDescription className="text-xs">
                            File an urgent clinical pause. Note: Policy requires leave to be logged at least 24h in advance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60dvh] overflow-y-auto pr-2 custom-scrollbar">
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
                                className="resize-none rounded-xl border-2 text-sm"
                            />
                        </div>

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-medium border border-amber-200 flex gap-2">
                            <Clock className="h-4 w-4 shrink-0" />
                            Same-day automated leave is blocked for patient safety. Select tomorrow or later for review.
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                        <Button 
                            onClick={handleSubmitEmergencyRequest} 
                            disabled={!emergencyReason.trim() || !requestedDate || isRequesting}
                            className="bg-primary hover:bg-primary/90 font-bold flex-1 sm:flex-none"
                        >
                            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit to Admin"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white custom-scrollbar space-y-4 overscroll-contain">
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
                      "max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl text-xs sm:text-sm shadow-sm",
                      isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-muted rounded-bl-none"
                    )}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={cn("text-[9px] mt-1 opacity-70", isMe ? "text-right" : "")}>
                        {format(new Date(msg.timestamp), "p")}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic text-center p-8">
                <MessageSquare className="h-12 w-12 opacity-10 mb-2" />
                <p className="text-xs sm:text-sm">Start a conversation with our administrative team.</p>
              </div>
            )}
            <div ref={scrollRef} />
          </CardContent>

          <CardFooter className="p-3 sm:p-4 border-t bg-muted/30 shrink-0">
            <form onSubmit={handleSendMessage} className="w-full flex gap-2 sm:gap-3">
              <Input 
                placeholder="Type your clinical query..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-white border-none shadow-inner h-11 sm:h-12 text-sm rounded-xl"
              />
              <Button type="submit" disabled={!newMessage.trim()} className="px-4 sm:px-6 bg-slate-900 hover:bg-slate-800 rounded-xl h-11 sm:h-12 shrink-0">
                <Send className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}