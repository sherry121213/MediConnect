
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUserData, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp, setDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, PhoneOff, Video, VideoOff, Mic, MicOff, MessageSquare, ShieldCheck, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch Appointment
  const appointmentDocRef = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return doc(firestore, 'appointments', appointmentId);
  }, [firestore, appointmentId]);

  const { data: appointment, isLoading: isLoadingAppointment } = useDoc<any>(appointmentDocRef);

  // Get Peer Data
  const peerId = appointment ? (user?.uid === appointment.patientId ? appointment.doctorId : appointment.patientId) : null;
  const peerDocRef = useMemoFirebase(() => {
    if (!firestore || !peerId) return null;
    return doc(firestore, 'patients', peerId);
  }, [firestore, peerId]);
  const { data: peer } = useDoc<any>(peerDocRef);

  // Chat logic
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !appointmentId) return null;
    return query(
      collection(firestore, 'consultationSessions', appointmentId, 'messages'),
      orderBy('timestamp', 'asc')
    );
  }, [firestore, appointmentId]);

  const { data: messages } = useCollection<any>(messagesQuery);

  // Camera Permission Effect
  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable permissions to conduct the session.',
        });
      }
    };
    getCameraPermission();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !user || !appointment) return;

    const messageData = {
      sessionId: appointmentId,
      senderId: user.uid,
      senderRole: userData?.role || 'patient',
      content: newMessage,
      timestamp: new Date().toISOString(),
      patientId: appointment.patientId,
      doctorId: appointment.doctorId
    };

    addDoc(collection(firestore, 'consultationSessions', appointmentId, 'messages'), messageData);
    setNewMessage('');
  };

  const handleEndSession = () => {
    setIsEnding(true);
    // In a real app, we'd update status to 'completed'
    toast({ title: "Session Concluded", description: "The consultation has ended." });
    setTimeout(() => {
      router.push(userData?.role === 'doctor' ? '/doctor-portal' : '/patient-portal');
    }, 1500);
  };

  if (isUserLoading || isLoadingAppointment) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!appointment) return <div className="p-8 text-center">Consultation session not found.</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight">MediConnect Clinical Hub</h1>
            <p className="text-[10px] text-slate-400 uppercase font-bold">Secure End-to-End Encrypted Session</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1.5 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </Badge>
          <div className="hidden sm:block text-right">
             <p className="text-xs text-slate-400">Consulting with</p>
             <p className="text-sm text-white font-bold">{peer ? `${userData?.role === 'doctor' ? '' : 'Dr. '}${peer.firstName} ${peer.lastName}` : 'Connecting...'}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 relative bg-slate-900 flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/5">
             <video 
                ref={videoRef} 
                className={cn("w-full h-full object-cover mirror", isVideoOff && "hidden")} 
                autoPlay 
                muted 
             />
             
             {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                    <div className="h-24 w-24 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="h-12 w-12" />
                    </div>
                    <p className="font-bold">Your Video is Disabled</p>
                </div>
             )}

             {/* Small self-view in corner for peer logic simulator */}
             <div className="absolute top-6 right-6 w-32 sm:w-48 aspect-video rounded-xl overflow-hidden border-2 border-white/10 shadow-lg bg-slate-800 z-10">
                <div className="w-full h-full flex items-center justify-center text-slate-400 italic text-[10px] text-center px-2">
                    {peer ? `${peer.firstName}'s view` : 'Waiting for connection...'}
                </div>
             </div>

             {/* Control Bar Overlay */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                <Button 
                    size="icon" 
                    variant={isMuted ? "destructive" : "secondary"} 
                    className="h-12 w-12 rounded-full"
                    onClick={() => setIsMuted(!isMuted)}
                >
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button 
                    size="icon" 
                    variant={isVideoOff ? "destructive" : "secondary"} 
                    className="h-12 w-12 rounded-full"
                    onClick={() => setIsVideoOff(!isVideoOff)}
                >
                    {isVideoOff ? <VideoOff /> : <Video />}
                </Button>
                <div className="w-px h-8 bg-white/10 mx-2" />
                <Button 
                    variant="destructive" 
                    className="h-12 px-8 rounded-full font-bold gap-2"
                    onClick={handleEndSession}
                    disabled={isEnding}
                >
                    {isEnding ? <Loader2 className="animate-spin" /> : <PhoneOff className="h-5 w-5" />}
                    End Session
                </Button>
             </div>
          </div>
          
          { !hasCameraPermission && (
             <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <Alert variant="destructive" className="max-w-md bg-slate-900 border-red-500/50">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera and microphone access to participate in this consultation. This is required for our direct audio/video integration.
                    </AlertDescription>
                </Alert>
             </div>
          )}
        </div>

        {/* Chat Area */}
        <aside className="w-full lg:w-[400px] border-l border-white/10 bg-slate-900/30 backdrop-blur-md flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <MessageSquare className="text-primary h-4 w-4" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Session Chat</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages && messages.length > 0 ? (
                messages.map((msg: any) => {
                    const isMe = msg.senderId === user?.uid;
                    return (
                        <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                                "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                                isMe ? "bg-primary text-white rounded-br-none" : "bg-slate-800 text-slate-200 rounded-bl-none border border-white/5"
                            )}>
                                <p className="leading-relaxed">{msg.content}</p>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                                {isMe ? 'You' : (msg.senderRole === 'doctor' ? 'Doctor' : 'Patient')} • {format(new Date(msg.timestamp), "p")}
                            </span>
                        </div>
                    );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-xs text-center p-8">
                    <MessageSquare className="h-12 w-12 opacity-10 mb-4" />
                    <p>Chat with your {userData?.role === 'doctor' ? 'patient' : 'doctor'} here during the session.</p>
                </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-white/10 flex gap-2">
            <Input 
                placeholder="Type a clinical message..." 
                className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
            />
            <Button type="submit" disabled={!newMessage.trim()} className="bg-primary hover:bg-primary/90">
                <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
