
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, User, Clock, Camera, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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

  // 1. Initial Media Acquisition (Fastest Path)
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
      }
    };
    acquireMedia();
    return () => {
      localStream.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 2. signaling Handshake
  useEffect(() => {
    if (!firestore || !appointmentId || !user || !hasCameraPermission) return;

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

        const callDoc = doc(firestore, 'calls', appointmentId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            const candidatesRef = userData?.role === 'doctor' ? offerCandidates : answerCandidates;
            addDoc(candidatesRef, event.candidate.toJSON());
          }
        };

        // Doctor initiates (Caller), Patient accepts (Callee)
        if (userData?.role === 'doctor') {
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
        setSignalingStatus("Connection Failed. Retrying...");
      }
    };

    setupSignaling();

    return () => {
      pc.current?.close();
    };
  }, [firestore, appointmentId, user, hasCameraPermission, userData?.role]);

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

  // 4. Session Window (50m)
  useEffect(() => {
    if (!appointment || isEnding) return;
    const startTime = new Date(appointment.appointmentDateTime).getTime();
    const endTime = startTime + (50 * 60 * 1000); 

    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        setIsEnding(true);
        toast({ title: "Session Time-Out", description: "Clinical window has concluded automatically." });
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

  const peerId = appointment ? (user?.uid === appointment.patientId ? appointment.doctorId : appointment.patientId) : null;
  const peerDocRef = useMemoFirebase(() => {
    if (!firestore || !peerId) return null;
    return doc(firestore, 'patients', peerId);
  }, [firestore, peerId]);
  const { data: peer } = useDoc<any>(peerDocRef);

  if (isUserLoading || isLoadingAppointment) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight text-xs sm:text-base truncate max-w-[150px] sm:max-w-none">MediConnect Clinical Hub</h1>
            <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-widest">{signalingStatus}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 px-3 py-1 text-[10px]">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </Badge>
          <div className="hidden md:block text-right">
             <p className="text-[10px] text-slate-400 uppercase font-bold">Consulting with</p>
             <p className="text-xs text-white font-bold">{peer ? `${userData?.role === 'doctor' ? '' : 'Dr. '}${peer.firstName} ${peer.lastName}` : 'Connecting...'}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
          
          {!isPeerConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center px-6 z-10 bg-slate-950/80 backdrop-blur-md">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                    <p className="text-white font-bold text-lg">Initializing Secure Link...</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold max-w-xs mx-auto">
                        Waiting for {peer?.firstName || 'peer'} to join the clinical room.
                    </p>
                </div>
                {!hasCameraPermission && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <p className="text-xs text-red-400 font-bold">Camera Access Blocked. Check Browser Settings.</p>
                  </div>
                )}
            </div>
          )}

          <div className="absolute top-4 right-4 w-28 sm:w-56 aspect-video rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-slate-900 z-20">
             <video ref={localVideoRef} className={cn("w-full h-full object-cover mirror", isVideoOff && "hidden")} autoPlay muted playsInline />
             {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800 text-slate-500">
                    <VideoOff className="h-5 w-5" />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Video Off</span>
                </div>
             )}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 px-4 sm:px-8 py-3 sm:py-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl z-30 scale-90 sm:scale-100">
             <Button size="icon" variant={isMuted ? "destructive" : "secondary"} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" onClick={() => {
               if (localStream.current) {
                 localStream.current.getAudioTracks()[0].enabled = isMuted;
                 setIsMuted(!isMuted);
               }
             }}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
             </Button>
             <Button size="icon" variant={isVideoOff ? "destructive" : "secondary"} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" onClick={() => {
               if (localStream.current) {
                 localStream.current.getVideoTracks()[0].enabled = isVideoOff;
                 setIsVideoOff(!isVideoOff);
               }
             }}>
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
             </Button>
             <div className="w-px h-8 bg-white/10 mx-1" />
             <Button variant="destructive" className="h-10 sm:h-12 px-5 sm:px-8 rounded-full font-bold gap-2 text-xs sm:text-sm" onClick={handleEndSession} disabled={isEnding}>
                {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />} <span className="hidden sm:inline">End Session</span>
             </Button>
          </div>
        </div>

        <aside className="w-full lg:w-[400px] border-l border-white/10 bg-slate-900/30 backdrop-blur-md flex flex-col z-10 h-[250px] lg:h-auto">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <MessageSquare className="text-primary h-4 w-4" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Clinical Chat</h3>
            </div>
            <Badge variant="outline" className="text-[8px] text-amber-500 border-amber-500/30 font-bold uppercase"><Clock className="h-3 w-3 mr-1" /> 50m Limit</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length > 0 ? messages.map((msg: any) => {
                const isMe = msg.senderId === user?.uid;
                return (
                    <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                        <div className={cn("max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm shadow-sm", isMe ? "bg-primary text-white rounded-br-none" : "bg-slate-800 text-slate-200 rounded-bl-none border border-white/5")}>
                            <p className="leading-relaxed">{msg.content}</p>
                        </div>
                        <span className="text-[8px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">{isMe ? 'You' : (peer?.firstName || 'Peer')} • {format(new Date(msg.timestamp), "p")}</span>
                    </div>
                );
            }) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center p-8">
                    <MessageSquare className="h-10 w-10 opacity-10 mb-4" />
                    <p className="text-[10px] uppercase font-bold tracking-widest">End-to-End Encryption Active</p>
                </div>
            )}
            <div ref={chatScrollRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-white/10 flex gap-2">
            <Input placeholder="Type query..." className="bg-slate-800 border-white/10 text-white h-11 text-sm rounded-xl focus:ring-primary" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
            <Button type="submit" disabled={!newMessage.trim()} className="bg-primary hover:bg-primary/90 h-11 w-11 p-0 rounded-xl"><Send className="h-4 w-4" /></Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
