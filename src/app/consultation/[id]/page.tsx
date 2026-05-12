'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, User, Clock, Camera, AlertCircle, PhoneIncoming, Maximize, Minimize } from 'lucide-react';
import { format } from 'date-fns';
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  const appointmentDocRef = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return doc(firestore, 'appointments', appointmentId);
  }, [firestore, appointmentId]);

  const { data: appointment, isLoading: isLoadingAppointment } = useDoc<any>(appointmentDocRef);

  // 1. Initial Media Acquisition
  useEffect(() => {
    const acquireMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        setHasCameraPermission(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Media Error:", err);
        setSignalingStatus("Camera Access Required to Proceed.");
        toast({
            variant: "destructive",
            title: "Hardware Error",
            description: "Please allow camera and microphone access in your browser settings.",
        });
      }
    };
    acquireMedia();
    return () => {
      localStream.current?.getTracks().forEach(t => t.stop());
    };
  }, [toast]);

  // 2. Signaling Handshake & WebRTC Logic
  useEffect(() => {
    if (!firestore || !appointmentId || !user || !hasCameraPermission || !userData) return;

    const setupSignaling = async () => {
      try {
        pc.current = new RTCPeerConnection(servers);

        localStream.current?.getTracks().forEach((track) => {
          pc.current?.addTrack(track, localStream.current!);
        });

        pc.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setIsPeerConnected(true);
            setSignalingStatus("Clinical Handshake Successful");
          }
        };

        pc.current.onconnectionstatechange = () => {
            if (pc.current?.connectionState === 'disconnected' || pc.current?.connectionState === 'failed') {
                setIsPeerConnected(false);
                setSignalingStatus("Connection Lost. Reconnecting...");
            }
        };

        const callDoc = doc(firestore, 'calls', appointmentId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            const candidatesRef = userData.role === 'doctor' ? offerCandidates : answerCandidates;
            addDoc(candidatesRef, event.candidate.toJSON());
          }
        };

        if (userData.role === 'doctor') {
          // DOCTOR: The Caller
          updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: true });
          
          setSignalingStatus("Initiating Professional Stream...");
          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);

          await setDoc(callDoc, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });

          onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!pc.current?.currentRemoteDescription && data?.answer) {
              const answerDescription = new RTCSessionDescription(data.answer);
              pc.current?.setRemoteDescription(answerDescription);
            }
          });

          onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
              }
            });
          });
        } else {
          // PATIENT: The Receiver
          setSignalingStatus("Connecting to Healthcare Provider...");
          onSnapshot(callDoc, async (snapshot) => {
            const data = snapshot.data();
            if (!pc.current?.currentRemoteDescription && data?.offer) {
              await pc.current?.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answerDescription = await pc.current?.createAnswer();
              await pc.current?.setLocalDescription(answerDescription);
              await setDoc(callDoc, { answer: { type: answerDescription?.type, sdp: answerDescription?.sdp } }, { merge: true });
            }
          });

          onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
              }
            });
          });
        }
      } catch (e) {
        console.error("Signaling Error:", e);
        setSignalingStatus("Secure Channel Negotiating...");
      }
    };

    setupSignaling();

    return () => {
      if (userData?.role === 'doctor') {
        updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: false });
      }
      pc.current?.close();
    };
  }, [firestore, appointmentId, user, hasCameraPermission, userData]);

  // 3. Administrative Logging
  useEffect(() => {
    if (userData?.role === 'doctor' && appointment && firestore && hasCameraPermission) {
      addDocumentNonBlocking(collection(firestore, 'consultationLogs'), {
        appointmentId,
        doctorId: userData.id,
        patientId: appointment.patientId,
        action: 'started',
        timestamp: new Date().toISOString(),
        description: `Dr. ${userData.firstName} ${userData.lastName} has established the clinical link for session ${appointmentId.slice(0,8)}.`
      });
    }
  }, [userData, appointment, firestore, appointmentId, hasCameraPermission]);

  // 4. Session Window (50m Limit)
  useEffect(() => {
    if (!appointment || isEnding) return;
    const startTime = new Date(appointment.appointmentDateTime).getTime();
    const endTime = startTime + (50 * 60 * 1000); 

    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        setIsEnding(true);
        toast({ title: "Session Time-Out", description: "The 50-minute clinical window has concluded automatically." });
        router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal');
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [appointment, router, userData, toast, isEnding]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return collection(firestore, 'consultationSessions', appointmentId, 'messages');
  }, [firestore, appointmentId]);

  const { data: messagesData } = useCollection<any>(messagesQuery);
  const messages = useMemo(() => {
    if (!messagesData) return [];
    return [...messagesData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
        updateDoc(doc(firestore, 'appointments', appointmentId), { doctorInRoom: false });
        addDocumentNonBlocking(collection(firestore, 'consultationLogs'), {
            appointmentId,
            doctorId: userData.id,
            patientId: appointment.patientId,
            action: 'ended',
            timestamp: new Date().toISOString(),
        });
    }
    router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal');
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks()[0].enabled = isVideoOff;
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
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-body text-white">
      {/* Header Overlay */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl p-2 pr-6 rounded-full border border-white/10 pointer-events-auto">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-white font-bold tracking-tight text-xs sm:text-sm uppercase">Secure Hub</h1>
              <p className="text-[9px] text-slate-400 font-bold tracking-widest">{signalingStatus}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pointer-events-auto">
            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 px-3 py-1 text-[10px] h-8 font-bold">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </Badge>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-xl border border-white/10 text-white"
                onClick={() => setIsChatOpen(!isChatOpen)}
            >
                {isChatOpen ? <Minimize className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Video Arena */}
      <main className="relative flex-1 flex flex-col lg:flex-row overflow-hidden bg-black">
        <div className="flex-1 relative flex items-center justify-center">
          {/* Remote Video (WhatsApp Style - Full Screen) */}
          <video 
            ref={remoteVideoRef} 
            className={cn("w-full h-full object-cover transition-opacity duration-1000", isPeerConnected ? "opacity-100" : "opacity-0")} 
            autoPlay 
            playsInline 
          />
          
          {/* Connection Overlay */}
          {!isPeerConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 text-center px-8 z-10 bg-slate-950">
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
                <div className="space-y-3">
                    <p className="text-white font-bold text-xl tracking-tight">Initializing Clinical Link...</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold max-w-xs mx-auto leading-relaxed">
                        Establishing end-to-end encrypted video tunnel with {peer?.firstName || 'your provider'}.
                    </p>
                </div>
            </div>
          )}

          {/* Local Video Overlay (WhatsApp Style - PiP) */}
          <div className="absolute top-20 right-4 sm:top-24 sm:right-8 w-28 sm:w-48 aspect-video rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 z-30 transition-all hover:scale-105">
             <video ref={localVideoRef} className={cn("w-full h-full object-cover mirror", isVideoOff && "hidden")} autoPlay muted playsInline />
             {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800 text-slate-500">
                    <VideoOff className="h-6 w-6" />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Privacy Mode</span>
                </div>
             )}
          </div>

          {/* Controls Bar (WhatsApp Style - Floating Bottom) */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-6 px-6 py-4 bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-40">
             <Button 
                size="icon" 
                variant={isMuted ? "destructive" : "secondary"} 
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full transition-all active:scale-90" 
                onClick={toggleMute}
             >
                {isMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
             </Button>
             <Button 
                size="icon" 
                variant={isVideoOff ? "destructive" : "secondary"} 
                className="h-12 w-12 sm:h-14 sm:w-14 rounded-full transition-all active:scale-90" 
                onClick={toggleVideo}
             >
                {isVideoOff ? <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Video className="h-5 w-5 sm:h-6 sm:w-6" />}
             </Button>
             <div className="w-px h-10 bg-white/10 mx-2" />
             <Button 
                variant="destructive" 
                className="h-12 sm:h-14 px-6 sm:px-10 rounded-full font-bold gap-3 text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-red-500/20" 
                onClick={handleEndSession} 
                disabled={isEnding}
             >
                {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />} 
                <span className="hidden sm:inline">End Consultation</span>
             </Button>
          </div>
        </div>

        {/* Clinical Sidebar Chat */}
        <aside className={cn(
            "w-full lg:w-[400px] bg-slate-950/40 backdrop-blur-3xl border-l border-white/10 flex flex-col z-20 transition-all duration-500 ease-in-out",
            isChatOpen ? "h-[300px] lg:h-auto opacity-100" : "h-0 lg:w-0 opacity-0 overflow-hidden"
        )}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <MessageSquare className="text-primary h-4 w-4" />
                <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Consultation Chat</h3>
            </div>
            <Badge variant="outline" className="text-[8px] text-amber-500 border-amber-500/20 font-bold uppercase py-0.5">
                <Clock className="h-2.5 w-2.5 mr-1" /> 50m Clinical Slot
            </Badge>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length > 0 ? messages.map((msg: any) => {
                const isMe = msg.senderId === user?.uid;
                return (
                    <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                        <div className={cn(
                            "max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm shadow-lg", 
                            isMe ? "bg-primary text-white rounded-br-none" : "bg-slate-900/80 text-slate-200 rounded-bl-none border border-white/5"
                        )}>
                            <p className="leading-relaxed">{msg.content}</p>
                        </div>
                        <span className="text-[8px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                            {isMe ? 'You' : (peer?.firstName || 'Provider')} • {format(new Date(msg.timestamp), "p")}
                        </span>
                    </div>
                );
            }) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center p-8">
                    <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <ShieldCheck className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40">End-to-End Encryption Active</p>
                </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-950/80 border-t border-white/5 flex gap-2">
            <Input 
                placeholder="Secure message..." 
                className="bg-slate-900/50 border-white/10 text-white h-11 text-xs rounded-2xl focus:ring-primary placeholder:text-slate-600" 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
            />
            <Button 
                type="submit" 
                disabled={!newMessage.trim()} 
                className="bg-primary hover:bg-primary/90 h-11 w-11 p-0 rounded-2xl shrink-0 shadow-lg shadow-primary/10"
            >
                <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
