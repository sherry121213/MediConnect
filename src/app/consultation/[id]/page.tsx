'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, User, Clock, Video as VideoIcon, AlertTriangle } from 'lucide-react';
import { format, isValid, addMinutes, isAfter, differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

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
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('30:00');
  const [isExpired, setIsExpired] = useState(false);

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

  // 1. Session Expiry & Timer Logic
  useEffect(() => {
    if (!appointment?.appointmentDateTime) return;

    const startTime = new Date(appointment.appointmentDateTime);
    const endTime = addMinutes(startTime, 30);

    const timer = setInterval(() => {
      const now = new Date();
      const secondsLeft = differenceInSeconds(endTime, now);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        setIsExpired(true);
        setTimeRemaining('00:00');
        handleAutoExpire();
      } else {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        setTimeRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        
        // Final warning at 1 minute
        if (secondsLeft === 60) {
          toast({
            variant: "destructive",
            title: "Session Ending Soon",
            description: "60 seconds remaining in clinical window.",
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [appointment, toast]);

  const handleAutoExpire = () => {
    if (isEnding) return;
    setIsEnding(true);
    
    if (userData?.role === 'doctor' && firestore && appointment) {
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { 
            status: 'expired',
            doctorInRoom: false 
        });
    }

    toast({
      variant: "destructive",
      title: "Session Expired",
      description: "The 30-minute clinical window has concluded.",
    });

    setTimeout(() => {
        router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal');
    }, 3000);
  };

  // 2. Hardware Acquisition (Heartbeat Sync)
  useEffect(() => {
    let isMounted = true;
    const acquireMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        localStream.current = stream;
        setHasCameraPermission(true);
        setSignalingStatus("Hardware Secured. Connecting...");
      } catch (err) {
        console.error("Media Error:", err);
        if (isMounted) {
            setSignalingStatus("Hardware Error: Camera/Mic Required.");
            toast({
                variant: "destructive",
                title: "Hardware Access Error",
                description: "Please allow camera and microphone access to proceed.",
            });
        }
      }
    };
    acquireMedia();
    return () => {
      isMounted = false;
      localStream.current?.getTracks().forEach(t => t.stop());
    };
  }, [toast]);

  // Video Element Heartbeat
  useEffect(() => {
    const timer = setInterval(() => {
        if (localVideoRef.current && localStream.current && !localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject = localStream.current;
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [hasCameraPermission]);

  // 3. WebRTC Signaling Logic
  useEffect(() => {
    if (!firestore || !appointmentId || !user || !hasCameraPermission || !userData || isExpired) return;

    let isEffectActive = true;
    const unsubs: (() => void)[] = [];

    const processCandidateQueue = async () => {
      if (!pc.current) return;
      while (candidateQueue.current.length > 0) {
        const candidate = candidateQueue.current.shift();
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("Candidate queue error:", e);
        }
      }
    };

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
            if (isEffectActive) {
                setIsPeerConnected(true);
                setSignalingStatus("Clinical Connection Active");
            }
          }
        };

        pc.current.onconnectionstatechange = () => {
            if (!isEffectActive) return;
            const state = pc.current?.connectionState;
            if (state === 'connected') setIsPeerConnected(true);
            if (state === 'disconnected' || state === 'failed') {
                setIsPeerConnected(false);
                setSignalingStatus("Reconnecting...");
            }
        };

        const callDoc = doc(firestore, 'calls', appointmentId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          if (event.candidate && isEffectActive) {
            const candidatesRef = userData.role === 'doctor' ? offerCandidates : answerCandidates;
            addDoc(candidatesRef, event.candidate.toJSON()).catch(e => console.error("ICE push error:", e));
          }
        };

        if (userData.role === 'doctor') {
          setSignalingStatus("Negotiating Clinical Handshake...");
          await setDoc(callDoc, { doctorJoinedAt: new Date().toISOString(), offer: null, answer: null }); // Force Reset
          
          updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: true }).catch(() => {});
          
          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);

          await setDoc(callDoc, { 
            offer: { sdp: offerDescription.sdp, type: offerDescription.type },
            doctorId: user.uid 
          }, { merge: true });

          const unsubCall = onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (pc.current && !pc.current.currentRemoteDescription && data?.answer) {
              const answerDescription = new RTCSessionDescription(data.answer);
              await pc.current.setRemoteDescription(answerDescription);
              isRemoteDescriptionSet.current = true;
              await processCandidateQueue();
            }
          });
          unsubs.push(unsubCall);

          const unsubCandidates = onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added' && pc.current && isEffectActive) {
                const data = change.doc.data();
                if (isRemoteDescriptionSet.current) {
                  await pc.current.addIceCandidate(new RTCIceCandidate(data));
                } else {
                  candidateQueue.current.push(data);
                }
              }
            });
          });
          unsubs.push(unsubCandidates);
          
        } else {
          setSignalingStatus("Awaiting Provider Entrance...");
          
          const unsubCall = onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (pc.current && !pc.current.currentRemoteDescription && data?.offer) {
              await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
              isRemoteDescriptionSet.current = true;
              await processCandidateQueue();
              
              const answerDescription = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answerDescription);
              await setDoc(callDoc, { 
                answer: { type: answerDescription?.type, sdp: answerDescription?.sdp },
                patientId: user.uid
              }, { merge: true });
            }
          });
          unsubs.push(unsubCall);

          const unsubCandidates = onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added' && pc.current && isEffectActive) {
                const data = change.doc.data();
                if (isRemoteDescriptionSet.current) {
                  await pc.current.addIceCandidate(new RTCIceCandidate(data));
                } else {
                  candidateQueue.current.push(data);
                }
              }
            });
          });
          unsubs.push(unsubCandidates);
        }
      } catch (e) {
        console.error("Signaling Error:", e);
        if (isEffectActive) setSignalingStatus("Encryption Reset Required.");
      }
    };

    setupSignaling();

    return () => {
      isEffectActive = false;
      unsubs.forEach(unsub => unsub());
      if (userData?.role === 'doctor') {
        updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: false }).catch(() => {});
      }
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
    };
  }, [firestore, appointmentId, user, hasCameraPermission, userData, isExpired]);

  // Clinical Logging
  useEffect(() => {
    if (userData?.role === 'doctor' && appointment && firestore && hasCameraPermission) {
      addDocumentNonBlocking(collection(firestore, 'consultationLogs'), {
        appointmentId,
        doctorId: userData.id,
        patientId: appointment.patientId,
        action: 'started',
        timestamp: new Date().toISOString(),
        description: `Clinical link established for session ${appointmentId.slice(0,8)}.`
      });
    }
  }, [userData, appointment, firestore, appointmentId, hasCameraPermission]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return collection(firestore, 'consultationSessions', appointmentId, 'messages');
  }, [firestore, appointmentId]);

  const { data: messagesData } = useCollection<any>(messagesQuery);
  const messages = useMemo(() => {
    if (!messagesData) return [];
    return [...messagesData].sort((a, b) => {
        const timeA = a.timestamp && isValid(new Date(a.timestamp)) ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp && isValid(new Date(b.timestamp)) ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
    });
  }, [messagesData]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !user || !appointment) return;

    addDocumentNonBlocking(collection(firestore, 'consultationSessions', appointmentId, 'messages'), {
      sessionId: appointmentId,
      senderId: user.uid,
      senderRole: userData?.role || 'patient',
      content: newMessage,
      timestamp: new Date().toISOString(),
    });
    setNewMessage('');
  };

  const handleEndSession = () => {
    setIsEnding(true);
    if (userData?.role === 'doctor' && firestore && appointment) {
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { doctorInRoom: false });
    }
    router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal');
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  const peerId = appointment ? (user?.uid === appointment.patientId ? appointment.doctorId : appointment.patientId) : null;
  const peerDocRef = useMemoFirebase(() => {
    if (!firestore || !peerId) return null;
    return doc(firestore, 'patients', peerId);
  }, [firestore, peerId]);
  const { data: peer } = useDoc<any>(peerDocRef);

  if (isUserLoading || isLoadingAppointment) {
    return <div className="flex h-screen items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-white">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 pointer-events-none">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl p-2 pr-6 rounded-full border border-white/10 pointer-events-auto">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm uppercase">Secure Consultation</h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{signalingStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="bg-slate-900/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className={cn("font-mono text-sm font-bold", parseInt(timeRemaining.split(':')[0]) < 5 ? "text-red-500 animate-pulse" : "text-white")}>
                    {timeRemaining}
                </span>
            </div>
            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 px-3 py-1 text-[10px] font-bold hidden sm:flex">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE SESSION
            </Badge>
          </div>
        </div>
      </header>

      {/* Video Content */}
      <main className="relative flex-1 flex flex-col lg:flex-row overflow-hidden bg-black">
        <div className="flex-1 relative">
          {isExpired ? (
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8 space-y-6">
                 <div className="h-24 w-24 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                    <AlertTriangle className="h-12 w-12" />
                 </div>
                 <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Clinical Window Closed</h2>
                    <p className="text-slate-400 max-w-md">This session has exceeded the 30-minute professional limit and is now archived.</p>
                 </div>
                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
                <video 
                    ref={remoteVideoRef} 
                    className={cn("w-full h-full object-cover transition-opacity duration-1000", isPeerConnected ? "opacity-100" : "opacity-0")} 
                    autoPlay 
                    playsInline 
                />
                
                {!isPeerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-slate-950 z-10">
                        <div className="relative">
                            <div className="h-32 w-32 rounded-full border-2 border-primary/30 border-dashed animate-spin duration-[3s]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Avatar className="h-24 w-24 border-4 border-slate-900 shadow-2xl">
                                    <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">
                                        {peer?.firstName?.[0] || '...'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-xl mb-2">Establishing Secure Link</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Encrypted Video Tunnel Active</p>
                        </div>
                    </div>
                )}
            </>
          )}

          {/* Local PIP */}
          <div className="absolute top-24 right-8 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 z-30 transition-all">
             <video 
                ref={localVideoRef} 
                className={cn("w-full h-full object-cover -scale-x-100", isVideoOff && "hidden")} 
                autoPlay 
                muted 
                playsInline 
             />
             {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-500">
                    <VideoOff className="h-6 w-6" />
                    <span className="text-[8px] font-bold uppercase mt-1">Privacy Mode</span>
                </div>
             )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-slate-900/80 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl z-40">
             <Button size="icon" variant={isMuted ? "destructive" : "secondary"} className="h-12 w-12 rounded-full" onClick={toggleMute} disabled={isExpired}>
                {isMuted ? <MicOff /> : <Mic />}
             </Button>
             <Button size="icon" variant={isVideoOff ? "destructive" : "secondary"} className="h-12 w-12 rounded-full" onClick={toggleVideo} disabled={isExpired}>
                {isVideoOff ? <VideoOff /> : <Video />}
             </Button>
             <div className="w-px h-8 bg-white/10 mx-2" />
             <Button variant="destructive" className="h-12 px-8 rounded-full font-bold gap-2 text-xs uppercase" onClick={handleEndSession} disabled={isEnding || isExpired}>
                <PhoneOff className="h-4 w-4" /> End Session
             </Button>
          </div>
        </div>

        {/* Sidebar Chat */}
        <aside className={cn(
            "w-full lg:w-[380px] bg-slate-950/40 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 transition-all duration-500",
            isChatOpen ? "h-[300px] lg:h-auto opacity-100" : "h-0 lg:w-0 opacity-0 overflow-hidden"
        )}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <MessageSquare className="text-primary h-4 w-4" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">Clinical Chat</h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg: any) => {
                const isMe = msg.senderId === user?.uid;
                const displayTime = msg.timestamp && isValid(new Date(msg.timestamp)) ? format(new Date(msg.timestamp), "p") : '';
                return (
                    <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                        <div className={cn("max-w-[85%] p-3 rounded-2xl text-xs shadow-lg", isMe ? "bg-primary text-white rounded-br-none" : "bg-slate-900/80 border border-white/5 rounded-bl-none")}>
                            <p className="leading-relaxed">{msg.content}</p>
                        </div>
                        <span className="text-[8px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                            {isMe ? 'You' : (peer?.firstName || 'Participant')} • {displayTime}
                        </span>
                    </div>
                );
            })}
            <div ref={chatScrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-950/80 border-t border-white/5 flex gap-2">
            <Input 
                placeholder={isExpired ? "Chat closed..." : "Secure message..."}
                disabled={isExpired}
                className="bg-slate-900/50 border-white/10 text-white h-11 text-xs rounded-2xl" 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
            />
            <Button type="submit" disabled={!newMessage.trim() || isExpired} className="bg-primary h-11 w-11 p-0 rounded-2xl">
                <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
