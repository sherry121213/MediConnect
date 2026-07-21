'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, Clock, Siren, AlertTriangle, ClipboardCheck, CheckCircle2, Volume2, Calendar } from 'lucide-react';
import { addMinutes, differenceInSeconds, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from 'date-fns';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const clinicalNotesSchema = z.object({
  diagnosis: z.string().min(3, "Clinical diagnosis is required."),
  prescription: z.string().min(10, "Prescription or treatment advice is required."),
});

export default function ConsultationRoomPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [signalingStatus, setSignalingStatus] = useState('Initializing Secure Channel...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('15:00'); 
  const [isExpired, setIsExpired] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const candidateQueue = useRef<any[]>([]);
  const isRemoteDescriptionSet = useRef(false);

  const appointmentDocRef = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return doc(firestore, 'appointments', appointmentId);
  }, [firestore, appointmentId]);

  const { data: appointment, isLoading: isLoadingAppointment } = useDoc<any>(appointmentDocRef);

  const isAudioOnly = appointment?.appointmentType === 'Audio Call';
  const isDoctor = userData?.role === 'doctor';

  const form = useForm({
    resolver: zodResolver(clinicalNotesSchema),
    defaultValues: {
      diagnosis: '',
      prescription: '',
    },
  });

  useEffect(() => {
      if (appointment) {
          form.reset({
              diagnosis: appointment.diagnosis || '',
              prescription: appointment.prescription || '',
          });
      }
  }, [appointment, form]);

  useEffect(() => {
    if (!appointment?.appointmentDateTime || appointment?.status === 'completed') return;

    const startTime = new Date(appointment.appointmentDateTime);
    const endTime = addMinutes(startTime, appointment.isExtended ? 25 : 15); 

    const timer = setInterval(() => {
      const now = new Date();
      const secondsLeft = differenceInSeconds(endTime, now);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        if (appointment.status !== 'completed') {
            setIsExpired(true);
            setTimeRemaining('00:00');
            handleAutoExpire();
        }
      } else {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        setTimeRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        
        if (secondsLeft === 300 && isDoctor && !appointment.isExtended) {
          setShowExtensionDialog(true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [appointment, isDoctor]);

  const handleExtendSession = () => {
    if (!firestore || !appointmentId) return;
    updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
        isExtended: true,
        updatedAt: new Date().toISOString()
    });
    setShowExtensionDialog(false);
    toast({ title: "Session Extended", description: "Window increased by 10 minutes." });
  };

  const handleAutoExpire = () => {
    if (isEnding || appointment?.status === 'completed') return;
    setIsEnding(true);
    
    if (isDoctor && firestore && appointment) {
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
            status: 'expired',
            doctorInRoom: false,
            readyToStart: false 
        });
    }

    toast({ variant: "destructive", title: "Window Concluded", description: "Record finalization required." });
    setTimeout(() => {
        router.push(isDoctor ? '/doctor-portal' : '/patient-portal');
    }, 3000);
  };

  useEffect(() => {
    if (!appointment) return;
    let isMounted = true;
    const acquireMedia = async () => {
      try {
        const constraints = isAudioOnly ? { audio: true, video: false } : { video: true, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        localStream.current = stream;
        setHasCameraPermission(true);
        setSignalingStatus("Secure Link Active");
        if (isAudioOnly) setIsVideoOff(true);
        
        if (localVideoRef.current && stream.getVideoTracks().length > 0) {
            localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Media Error:", err);
        if (isMounted) {
            setSignalingStatus("Hardware Error");
            toast({ variant: "destructive", title: "Hardware Required", description: "Check permissions." });
        }
      }
    };
    acquireMedia();
    return () => {
      isMounted = false;
      localStream.current?.getTracks().forEach(t => t.stop());
    };
  }, [appointment, isAudioOnly, toast]);

  useEffect(() => {
    if (!firestore || !appointmentId || !user || !hasCameraPermission || !userData || isExpired || appointment?.status === 'completed') return;

    let isEffectActive = true;
    const unsubs: (() => void)[] = [];

    const setupSignaling = async () => {
      try {
        if (pc.current) pc.current.close();
        pc.current = new RTCPeerConnection(servers);
        isRemoteDescriptionSet.current = false;
        candidateQueue.current = [];

        localStream.current?.getTracks().forEach((track) => {
          if (localStream.current && pc.current) {
            pc.current.addTrack(track, localStream.current);
          }
        });

        pc.current.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            if (isEffectActive) setIsPeerConnected(true);
          }
        };

        const callDoc = doc(firestore, 'calls', appointmentId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          if (event.candidate && isEffectActive) {
            const candidatesRef = userData.role === 'doctor' ? offerCandidates : answerCandidates;
            addDoc(candidatesRef, event.candidate.toJSON());
          }
        };

        if (userData.role === 'doctor') {
          await setDoc(callDoc, { doctorJoinedAt: new Date().toISOString(), offer: null, answer: null }); 
          updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: true });
          
          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);
          await setDoc(callDoc, { offer: { sdp: offerDescription.sdp, type: offerDescription.type }, doctorId: user.uid }, { merge: true });

          unsubs.push(onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (pc.current && !pc.current.currentRemoteDescription && data?.answer) {
              await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              isRemoteDescriptionSet.current = true;
              while (candidateQueue.current.length > 0) {
                await pc.current.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()));
              }
            }
          }));

          unsubs.push(onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added' && pc.current && isEffectActive) {
                const data = change.doc.data();
                if (isRemoteDescriptionSet.current) await pc.current.addIceCandidate(new RTCIceCandidate(data));
                else candidateQueue.current.push(data);
              }
            });
          }));
          
        } else {
          unsubs.push(onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (pc.current && !pc.current.currentRemoteDescription && data?.offer) {
              await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
              isRemoteDescriptionSet.current = true;
              const answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);
              await setDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp }, patientId: user.uid }, { merge: true });
              while (candidateQueue.current.length > 0) {
                await pc.current.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()));
              }
            }
          }));

          unsubs.push(onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added' && pc.current && isEffectActive) {
                const data = change.doc.data();
                if (isRemoteDescriptionSet.current) await pc.current.addIceCandidate(new RTCIceCandidate(data));
                else candidateQueue.current.push(data);
              }
            });
          }));
        }
      } catch (e) { console.error("Signaling Error:", e); }
    };

    setupSignaling();

    return () => {
      isEffectActive = false;
      unsubs.forEach(unsub => unsub());
      if (pc.current) { pc.current.close(); pc.current = null; }
    };
  }, [firestore, appointmentId, user, hasCameraPermission, userData, isExpired, appointment?.status]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return collection(firestore, 'consultationSessions', appointmentId, 'messages');
  }, [firestore, appointmentId]);

  const { data: messagesData } = useCollection<any>(messagesQuery);
  const messages = useMemo(() => {
    if (!messagesData) return [];
    return [...messagesData].sort((a, b) => (new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()));
  }, [messagesData]);

  useEffect(() => { chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !user) return;
    addDocumentNonBlocking(collection(firestore, 'consultationSessions', appointmentId, 'messages'), {
      senderId: user.uid,
      senderRole: userData?.role || 'patient',
      content: newMessage,
      timestamp: new Date().toISOString(),
    });
    setNewMessage('');
  };

  const handleFinalizeClinicalNotes = (values: any) => {
    if (!firestore || !appointmentId) return;
    setIsFinalizing(true);
    updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
        ...values, status: 'completed', updatedAt: new Date().toISOString(), doctorInRoom: false, readyToStart: false 
    });
    toast({ title: "Session Finalized" });
    setTimeout(() => router.push(isDoctor ? '/doctor-portal' : '/patient-portal'), 2000);
  };

  const handleEndSession = () => {
    if (isDoctor && appointment?.status !== 'completed') {
        toast({ title: "Notes Required", description: "Please finalize the record first." });
        return;
    }
    setIsEnding(true);
    router.push(isDoctor ? '/doctor-portal' : '/patient-portal');
  };

  const peerId = appointment ? (user?.uid === appointment.patientId ? appointment.doctorId : appointment.patientId) : null;
  const peerDocRef = useMemoFirebase(() => {
    if (!firestore || !peerId) return null;
    return doc(firestore, 'patients', peerId);
  }, [firestore, peerId]);
  const { data: peer } = useDoc<any>(peerDocRef);

  if (isUserLoading || isLoadingAppointment) return <div className="flex h-[100dvh] items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isCompleted = appointment?.status === 'completed';
  const scheduledTime = appointment?.appointmentDateTime ? format(new Date(appointment.appointmentDateTime), "p") : '--:--';

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-slate-950 overflow-hidden text-white overscroll-none fixed inset-0 w-screen">
      {/* Header - Fixed Height */}
      <header className="shrink-0 h-16 p-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="text-primary h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[10px] uppercase truncate">Precision Clinical Room</h1>
              <div className="flex items-center gap-2">
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate">{isAudioOnly ? 'Voice Only Link' : 'Secure Video Tunnel'}</p>
                <div className="h-1 w-1 rounded-full bg-slate-700" />
                <p className="text-[8px] text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="h-2 w-2" /> {scheduledTime}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
                <div className="bg-slate-800/80 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 shrink-0">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className={cn("font-mono text-xs font-bold", parseInt(timeRemaining.split(':')[0]) < 5 ? "text-red-500 animate-pulse" : "text-white")}>{timeRemaining}</span>
                </div>
            )}
            <Badge variant="outline" className={cn("px-2 py-0.5 text-[8px] font-bold shrink-0", isCompleted ? "bg-green-50/10 text-green-400" : "bg-red-50/10 text-red-400")}>
              {isCompleted ? "ARCHIVED" : "LIVE"}
            </Badge>
          </div>
      </header>

      {/* Main Content Area - Flexible height, handles internal scrolling only */}
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="flex-1 relative flex flex-col overflow-hidden bg-black">
          {/* Video/AV Display */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {isExpired && !isCompleted ? (
              <div className="text-center p-6 space-y-4 animate-in fade-in">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                  <p className="font-bold uppercase text-xs">Window Concluded</p>
              </div>
            ) : isCompleted ? (
              <div className="text-center p-6 space-y-4 animate-in zoom-in-95">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="font-bold uppercase text-xs">Record Secured</p>
              </div>
            ) : isAudioOnly ? (
                <div className="flex flex-col items-center justify-center gap-8 animate-in fade-in duration-1000">
                    <div className="relative">
                        <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-slate-900 shadow-2xl relative z-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">{peer?.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        {isPeerConnected && <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping z-0" />}
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-xl font-bold tracking-tight">{peer ? `${peer.firstName} ${peer.lastName}` : 'Connecting...'}</p>
                        <div className="flex items-center justify-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", isPeerConnected ? "bg-green-500 animate-pulse" : "bg-slate-700")} />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {isPeerConnected ? 'Voice Link Established' : 'Awaiting Connection'}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
              <>
                  <video ref={remoteVideoRef} className={cn("w-full h-full object-cover transition-opacity duration-1000", isPeerConnected ? "opacity-100" : "opacity-0")} autoPlay playsInline />
                  {!isPeerConnected && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950">
                          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                          <p className="text-[10px] uppercase font-bold text-slate-500">Establishing Tunnel...</p>
                      </div>
                  )}
              </>
            )}

            {/* Local Pip */}
            {!isAudioOnly && !isCompleted && (
              <div className="absolute top-4 right-4 w-28 sm:w-44 aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900 z-30">
                  <video ref={localVideoRef} className={cn("w-full h-full object-cover -scale-x-100", isVideoOff && "hidden")} autoPlay muted playsInline />
                  {isVideoOff && <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500"><VideoOff className="h-6 w-6" /></div>}
              </div>
            )}
          </div>

          {/* Controls Bar - Bottom center */}
          <div className="shrink-0 h-20 border-t border-white/5 bg-slate-900/60 backdrop-blur-2xl flex items-center justify-center gap-4 px-4">
              <Button size="icon" variant={isMuted ? "destructive" : "secondary"} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full transition-transform active:scale-95" onClick={() => { if(localStream.current) { localStream.current.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); } }} disabled={isExpired || isCompleted}>
                  {isMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              {!isAudioOnly && (
                  <Button size="icon" variant={isVideoOff ? "destructive" : "secondary"} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full transition-transform active:scale-95" onClick={() => { if(localStream.current) { localStream.current.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); } }} disabled={isExpired || isCompleted}>
                    {isVideoOff ? <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Video className="h-4 w-4 sm:h-5 sm:w-5" />}
                  </Button>
              )}
              <div className="w-px h-8 bg-white/10 mx-2" />
              <Button variant="destructive" className="h-10 px-6 sm:h-12 sm:px-8 rounded-full font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-red-900/20" onClick={handleEndSession} disabled={isEnding || isExpired}>
                  <PhoneOff className="h-4 w-4 mr-2" /> End
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10 text-slate-400" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                  <MessageSquare className="h-5 w-5" />
              </Button>
          </div>
        </div>

        {/* Sidebar - Handles Chat and Notes with its own scrolling */}
        <aside className={cn(
            "shrink-0 w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col z-20 bg-slate-900 transition-all duration-300",
            isSidebarOpen ? "h-[45dvh] lg:h-full" : "h-0 lg:w-0 overflow-hidden"
        )}>
          <Tabs defaultValue="chat" className="w-full h-full flex flex-col overflow-hidden">
            <TabsList className="shrink-0 bg-slate-950/40 p-1 flex h-12">
                <TabsTrigger value="chat" className="flex-1 text-[10px] uppercase font-bold tracking-widest gap-2 py-2 rounded-xl"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
                {isDoctor && <TabsTrigger value="notes" className="flex-1 text-[10px] uppercase font-bold tracking-widest gap-2 py-2 rounded-xl"><ClipboardCheck className="h-3.5 w-3.5" /> Records</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar overscroll-contain">
                    {messages.map((msg: any) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className={cn("max-w-[85%] p-3 rounded-2xl text-xs shadow-lg", isMe ? "bg-primary text-white rounded-br-none" : "bg-white/5 border border-white/10 text-slate-200 rounded-bl-none")}>
                                    <p className="leading-relaxed">{msg.content}</p>
                                </div>
                                <span className="text-[7px] text-slate-500 mt-1 uppercase font-bold">{isMe ? 'You' : (peer?.firstName || 'Participant')} • {format(new Date(msg.timestamp), "p")}</span>
                            </div>
                        );
                    })}
                    <div ref={chatScrollRef} />
                </div>
                <form onSubmit={handleSendMessage} className="shrink-0 p-3 bg-slate-950/40 border-t border-white/5 flex gap-2">
                    <Input placeholder={isCompleted ? "Archived..." : "Secure message..."} disabled={isCompleted} className="bg-white/5 border-white/10 h-11 text-xs rounded-xl focus-visible:ring-primary" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                    <Button type="submit" disabled={!newMessage.trim() || isCompleted} className="bg-primary h-11 w-11 p-0 rounded-xl shrink-0"><Send className="h-4 w-4" /></Button>
                </form>
            </TabsContent>

            {isDoctor && (
                <TabsContent value="notes" className="flex-1 overflow-y-auto p-6 m-0 custom-scrollbar overscroll-contain bg-slate-950/20">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFinalizeClinicalNotes)} className="space-y-6">
                            <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Diagnosis Summary</FormLabel><FormControl><Input placeholder="Primary findings..." className="bg-white/5 border-white/10 h-12 text-sm rounded-xl focus-visible:ring-primary" {...field} disabled={isCompleted || isFinalizing} /></FormControl><FormMessage className="text-[9px]" /></FormItem>
                            )} />
                            <FormField control={form.control} name="prescription" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Treatment Advice</FormLabel><FormControl><Textarea placeholder="Details & Medications..." rows={6} className="bg-white/5 border-white/10 text-sm rounded-xl resize-none focus-visible:ring-primary" {...field} disabled={isCompleted || isFinalizing} /></FormControl><FormMessage className="text-[9px]" /></FormItem>
                            )} />
                            <Button type="submit" className="w-full h-14 font-bold rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10" disabled={isCompleted || isFinalizing}>
                                {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Record"}
                            </Button>
                        </form>
                    </Form>
                </TabsContent>
            )}
          </Tabs>
        </aside>
      </main>

      {/* Extension Dialog */}
      <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 text-center space-y-6 bg-white text-slate-900">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><Clock className="h-8 w-8 text-primary" /></div>
              <div className="space-y-2">
                  <DialogTitle className="text-2xl font-headline">Extend Consultation?</DialogTitle>
                  <p className="text-sm text-slate-500 font-medium">Session concludes in 5 minutes. Add 10 minutes buffer?</p>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-3">
                  <Button variant="ghost" onClick={() => setShowExtensionDialog(false)} className="flex-1 h-12 rounded-xl font-bold">Ignore</Button>
                  <Button onClick={handleExtendSession} className="flex-1 h-12 rounded-xl bg-primary text-white font-bold">Add 10 Minutes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
