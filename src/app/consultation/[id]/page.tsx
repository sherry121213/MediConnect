'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, Clock, AlertTriangle, ClipboardCheck, CheckCircle2, Calendar } from 'lucide-react';
import { addMinutes, differenceInSeconds } from 'date-fns';
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

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [signalingStatus, setSignalingStatus] = useState('Initializing Tunnel...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('15:00'); 
  const [isExpired, setIsExpired] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const candidatesQueue = useRef<any[]>([]);

  const appointmentDocRef = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return doc(firestore, 'appointments', appointmentId);
  }, [firestore, appointmentId]);

  const { data: appointment, isLoading: isLoadingAppointment } = useDoc<any>(appointmentDocRef);

  const isAudioOnly = appointment?.appointmentType === 'Audio Call';
  const isDoctor = userData?.role === 'doctor';
  const isCompleted = appointment?.status === 'completed';

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
  }, [appointment?.id, form]);

  useEffect(() => {
    if (!appointment?.appointmentDateTime || isCompleted) return;

    const startTime = new Date(appointment.appointmentDateTime);
    const endTime = addMinutes(startTime, appointment.isExtended ? 25 : 15); 

    const timer = setInterval(() => {
      const now = new Date();
      const secondsLeft = differenceInSeconds(endTime, now);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        if (!isCompleted) {
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
  }, [appointment?.appointmentDateTime, appointment?.isExtended, isCompleted, isDoctor]);

  const handleExtendSession = () => {
    if (!firestore || !appointmentId) return;
    updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
        isExtended: true,
        updatedAt: new Date().toISOString()
    });
    setShowExtensionDialog(false);
    toast({ title: "Session Extended" });
  };

  const handleAutoExpire = () => {
    if (isEnding || isCompleted) return;
    setIsEnding(true);
    
    if (isDoctor && firestore && appointment) {
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
            status: 'expired',
            doctorInRoom: false,
            readyToStart: false 
        });
    }

    toast({ variant: "destructive", title: "Window Concluded", description: "Finalizing clinical record..." });
    setTimeout(() => {
        router.push(isDoctor ? '/doctor-portal' : '/patient-portal');
    }, 3000);
  };

  // 1. Hardware Initialization
  useEffect(() => {
    if (!appointmentId || isCompleted) return;
    let isMounted = true;
    
    const acquireMedia = async () => {
      try {
        const constraints = { 
          video: isAudioOnly ? false : { 
            facingMode: "user",
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        
        setActiveStream(stream);
        setSignalingStatus("Hardware Activated");
        if (isAudioOnly) setIsVideoOff(true);
      } catch (err) {
        console.error("Hardware Blocked:", err);
        if (isMounted) {
            setSignalingStatus("Hardware Error");
            toast({ variant: "destructive", title: "Access Blocked", description: "Camera/Mic permissions are mandatory for clinical sessions." });
        }
      }
    };
    
    acquireMedia();
    
    return () => {
      isMounted = false;
      activeStream?.getTracks().forEach(t => t.stop());
    };
  }, [appointmentId, isAudioOnly, isCompleted]);

  // 2. Peer Connection & Signaling Lifecycle
  useEffect(() => {
    if (!firestore || !appointmentId || !user || !activeStream || !userData || isExpired || isCompleted) return;

    let isEffectActive = true;
    const unsubscribes: (() => void)[] = [];

    const initializeConnection = async () => {
      try {
        if (pc.current) pc.current.close();
        pc.current = new RTCPeerConnection(servers);
        
        activeStream.getTracks().forEach(track => {
          pc.current?.addTrack(track, activeStream);
        });

        // Remote Media Handshake
        pc.current.ontrack = (event) => {
          if (!isEffectActive || !remoteVideoRef.current) return;
          
          let remoteStream = event.streams[0];
          if (!remoteStream) {
              remoteStream = new MediaStream([event.track]);
          }
          
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.onloadedmetadata = () => {
             remoteVideoRef.current?.play().catch(e => console.warn("Auto-play blocked", e));
          };
          
          setIsPeerConnected(true);
          setSignalingStatus("Secure Link Established");
        };

        pc.current.oniceconnectionstatechange = () => {
          if (!isEffectActive) return;
          const state = pc.current?.iceConnectionState;
          if (state === 'connected' || state === 'completed') {
            setIsPeerConnected(true);
            setSignalingStatus("Connected");
          } else if (state === 'failed' || state === 'disconnected') {
            setSignalingStatus("Reconnecting...");
          }
        };

        const callDoc = doc(firestore, 'calls', appointmentId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          if (event.candidate && isEffectActive) {
            const col = isDoctor ? offerCandidates : answerCandidates;
            addDoc(col, event.candidate.toJSON());
          }
        };

        const processCandidateQueue = async () => {
          while (candidatesQueue.current.length > 0) {
            const candidate = candidatesQueue.current.shift();
            try {
              if (pc.current?.remoteDescription && pc.current.remoteDescription.type) {
                  await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } catch (e) {
              console.error("ICE Load Error:", e);
            }
          }
        };

        if (isDoctor) {
          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          
          await setDoc(callDoc, { 
            offer: { sdp: offer.sdp, type: offer.type },
            doctorId: user.uid,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          const unsubCall = onSnapshot(callDoc, async (snap) => {
            const data = snap.data();
            if (data?.answer && !pc.current?.currentRemoteDescription) {
              const answerDesc = new RTCSessionDescription(data.answer);
              await pc.current?.setRemoteDescription(answerDesc);
              await processCandidateQueue();
            }
          });
          unsubscribes.push(unsubCall);

          const unsubRemoteCands = onSnapshot(answerCandidates, (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added' && isEffectActive) {
                const data = change.doc.data();
                if (pc.current?.remoteDescription) {
                  await pc.current.addIceCandidate(new RTCIceCandidate(data));
                } else {
                  candidatesQueue.current.push(data);
                }
              }
            });
          });
          unsubscribes.push(unsubRemoteCands);

        } else {
          const unsubCall = onSnapshot(callDoc, async (snap) => {
            const data = snap.data();
            if (data?.offer && !pc.current?.currentRemoteDescription) {
              const offerDesc = new RTCSessionDescription(data.offer);
              await pc.current?.setRemoteDescription(offerDesc);

              const answer = await pc.current?.createAnswer();
              if (answer) {
                await pc.current?.setLocalDescription(answer);
                await setDoc(callDoc, { 
                  answer: { type: answer.type, sdp: answer.sdp },
                  patientId: user.uid 
                }, { merge: true });
                await processCandidateQueue();
              }
            }
          });
          unsubscribes.push(unsubCall);

          const unsubRemoteCands = onSnapshot(offerCandidates, (snap) => {
            snap.docChanges().forEach(async (change) => {
              if (change.type === 'added' && isEffectActive) {
                const data = change.doc.data();
                if (pc.current?.remoteDescription) {
                  await pc.current.addIceCandidate(new RTCIceCandidate(data));
                } else {
                  candidatesQueue.current.push(data);
                }
              }
            });
          });
          unsubscribes.push(unsubRemoteCands);
        }

      } catch (err) {
        console.error("Critical Tunnel Failure:", err);
        setSignalingStatus("Handshake Failed");
      }
    };

    initializeConnection();

    return () => {
      isEffectActive = false;
      unsubscribes.forEach(u => u());
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
    };
  }, [firestore, appointmentId, user?.uid, !!activeStream, isDoctor, isExpired, isCompleted]);

  // Local View Sync
  useEffect(() => {
    if (localVideoRef.current && activeStream) {
      localVideoRef.current.srcObject = activeStream;
      localVideoRef.current.play().catch(err => console.warn("Local preview blocked", err));
    }
  }, [activeStream]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return query(collection(firestore, 'consultationSessions', appointmentId, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, appointmentId]);

  const { data: messages } = useCollection<any>(messagesQuery);

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
    toast({ title: "Session Finalized", description: "Medical record secured." });
    setTimeout(() => router.push(isDoctor ? '/doctor-portal' : '/patient-portal'), 1500);
  };

  const handleEndSession = () => {
    if (isDoctor && !isCompleted) {
        toast({ title: "Finalize Record", description: "Please record clinical notes before ending session." });
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

  const scheduledTime = appointment?.appointmentDateTime ? format(new Date(appointment.appointmentDateTime), "p") : '--:--';

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-slate-950 overflow-hidden text-white overscroll-none fixed inset-0 w-screen">
      <header className="shrink-0 h-16 p-4 bg-primary border-b border-white/10 flex items-center justify-between z-50 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldCheck className="text-white h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-[10px] uppercase truncate text-white tracking-widest">Precision Clinical Room</h1>
              <div className="flex items-center gap-2">
                <p className="text-[8px] text-white/70 font-bold uppercase tracking-widest truncate">{isAudioOnly ? 'Voice Tunnel' : 'Video Tunnel'}</p>
                <div className="h-1 w-1 rounded-full bg-white/30" />
                <p className="text-[8px] text-white font-bold uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="h-2 w-2" /> {scheduledTime}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted && (
                <div className="bg-white/10 px-3 py-1 rounded-full border border-white/20 flex items-center gap-2 shrink-0">
                    <Clock className="h-3 w-3 text-white" />
                    <span className={cn("font-mono text-xs font-bold text-white", parseInt(timeRemaining.split(':')[0]) < 5 && "animate-pulse")}>{timeRemaining}</span>
                </div>
            )}
            <Badge variant="outline" className={cn("px-2 py-0.5 text-[8px] font-bold shrink-0 border-white/20 uppercase tracking-tighter", isCompleted ? "bg-white/20 text-white" : "bg-white/10 text-white")}>
              {isCompleted ? "Archived" : "Live"}
            </Badge>
          </div>
      </header>

      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="flex-1 relative flex flex-col overflow-hidden bg-black">
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {isExpired && !isCompleted ? (
              <div className="text-center p-6 space-y-4 animate-in fade-in">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                  <p className="font-bold uppercase text-xs text-white tracking-widest">Clinical Window Expired</p>
              </div>
            ) : isCompleted ? (
              <div className="text-center p-6 space-y-4 animate-in zoom-in-95">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="font-bold uppercase text-xs text-white tracking-widest">Medical Record Secured</p>
              </div>
            ) : (
              <>
                  <video 
                    ref={remoteVideoRef} 
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-700 bg-slate-900", 
                        isPeerConnected ? "opacity-100" : "opacity-0"
                    )} 
                    autoPlay 
                    playsInline 
                  />
                  
                  {!isPeerConnected && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 backdrop-blur-md z-10">
                          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em]">{signalingStatus}</p>
                      </div>
                  )}

                  {isAudioOnly && isPeerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 animate-in fade-in duration-1000 z-20">
                        <div className="relative">
                            <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-slate-900 shadow-2xl relative z-10">
                                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">{peer?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping z-0" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-xl font-bold tracking-tight text-white">{peer ? `Dr. ${peer.firstName} ${peer.lastName}` : 'Linking...'}</p>
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Secure Audio Tunnel</p>
                            </div>
                        </div>
                    </div>
                  )}
              </>
            )}

            {!isAudioOnly && !isCompleted && (
              <div className="absolute top-4 right-4 w-28 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 z-[100] transform-gpu">
                  <video 
                    ref={localVideoRef} 
                    className={cn("w-full h-full object-cover -scale-x-100", isVideoOff && "hidden")} 
                    autoPlay 
                    muted 
                    playsInline 
                  />
                  {isVideoOff && <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500"><VideoOff className="h-6 w-6" /></div>}
              </div>
            )}
          </div>

          <div className="shrink-0 h-20 border-t border-white/5 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center gap-4 px-4 z-50">
              <button className={cn("h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95", isMuted ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300")} onClick={() => { if(activeStream) { activeStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); } }} disabled={isExpired || isCompleted}>
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {!isAudioOnly && (
                  <button className={cn("h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95", isVideoOff ? "bg-red-500 text-white" : "bg-slate-800 text-slate-300")} onClick={() => { if(activeStream) { activeStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); } }} disabled={isExpired || isCompleted}>
                    {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </button>
              )}
              <div className="w-px h-8 bg-white/10 mx-2" />
              <Button variant="destructive" className="h-11 px-6 sm:h-12 sm:px-8 rounded-full font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-red-900/20" onClick={handleEndSession} disabled={isEnding || isExpired}>
                  <PhoneOff className="h-4 w-4 mr-2" /> End
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden h-11 w-11 text-slate-400" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                  <MessageSquare className="h-5 w-5" />
              </Button>
          </div>
        </div>

        <aside className={cn(
            "shrink-0 w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col z-[60] bg-slate-900 transition-all duration-300",
            isSidebarOpen ? "h-[45dvh] lg:h-full" : "h-0 lg:w-0 overflow-hidden"
        )}>
          <Tabs defaultValue="chat" className="w-full h-full flex flex-col overflow-hidden">
            <TabsList className="shrink-0 bg-slate-950/40 p-1.5 flex h-14">
                <TabsTrigger value="chat" className="flex-1 text-[10px] uppercase font-bold tracking-widest gap-2 py-2.5 rounded-xl data-[state=active]:bg-white/10"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
                {isDoctor && <TabsTrigger value="notes" className="flex-1 text-[10px] uppercase font-bold tracking-widest gap-2 py-2.5 rounded-xl data-[state=active]:bg-white/10"><ClipboardCheck className="h-3.5 w-3.5" /> Clinical Records</TabsTrigger>}
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar overscroll-contain">
                    {messages?.map((msg: any) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className={cn("max-w-[85%] p-3.5 rounded-2xl text-xs shadow-lg", isMe ? "bg-primary text-white rounded-br-none" : "bg-white/5 border border-white/10 text-slate-200 rounded-bl-none")}>
                                    <p className="leading-relaxed">{msg.content}</p>
                                </div>
                                <span className="text-[7px] text-slate-500 mt-1 uppercase font-bold">{isMe ? 'You' : (peer?.firstName || 'User')} • {msg.timestamp ? format(new Date(msg.timestamp), "p") : ''}</span>
                            </div>
                        );
                    })}
                    <div ref={chatScrollRef} />
                </div>
                <form onSubmit={handleSendMessage} className="shrink-0 p-3 bg-slate-950/60 border-t border-white/5 flex gap-2">
                    <Input placeholder={isCompleted ? "Session Concluded" : "Secure clinical message..."} disabled={isCompleted} className="bg-white/5 border-white/10 h-12 text-xs rounded-xl focus-visible:ring-primary text-white" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                    <Button type="submit" disabled={!newMessage.trim() || isCompleted} className="bg-primary h-12 w-12 p-0 rounded-xl shrink-0"><Send className="h-4 w-4" /></Button>
                </form>
            </TabsContent>

            {isDoctor && (
                <TabsContent value="notes" className="flex-1 overflow-y-auto p-6 m-0 custom-scrollbar overscroll-contain bg-slate-950/20">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFinalizeClinicalNotes)} className="space-y-6">
                            <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clinical Diagnosis</FormLabel><FormControl><Input placeholder="Record findings..." className="bg-white/5 border-white/10 h-14 text-sm rounded-xl focus-visible:ring-primary text-white" {...field} disabled={isCompleted || isFinalizing} /></FormControl><FormMessage className="text-[9px]" /></FormItem>
                            )} />
                            <FormField control={form.control} name="prescription" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Medications & Advice</FormLabel><FormControl><Textarea placeholder="Detail instructions..." rows={8} className="bg-white/5 border-white/10 text-sm rounded-xl resize-none focus-visible:ring-primary text-white" {...field} disabled={isCompleted || isFinalizing} /></FormControl><FormMessage className="text-[9px]" /></FormItem>
                            )} />
                            <Button type="submit" className="w-full h-16 font-bold rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10" disabled={isCompleted || isFinalizing}>
                                {isFinalizing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalize Clinical Record"}
                            </Button>
                        </form>
                    </Form>
                </TabsContent>
            )}
          </Tabs>
        </aside>
      </main>

      <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 text-center space-y-6 bg-white text-slate-900">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><Clock className="h-8 w-8 text-primary" /></div>
              <div className="space-y-2">
                  <DialogTitle className="text-2xl font-headline tracking-tight">Extend Session?</DialogTitle>
                  <p className="text-sm text-slate-500 font-medium">Professional window concludes in 5 minutes. Apply 10m clinical buffer?</p>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-3">
                  <Button variant="ghost" onClick={() => setShowExtensionDialog(false)} className="flex-1 h-12 rounded-xl font-bold">Dismiss</Button>
                  <Button onClick={handleExtendSession} className="flex-1 h-12 rounded-xl bg-primary text-white font-bold shadow-lg">Extend 10 Min</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
