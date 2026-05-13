
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, setDoc, limit, onSnapshot, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MessageCircle, X, Send, User, ShieldCheck, Loader2, Minimize2, Maximize2, Users, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';

type MessengerCategory = 'patients' | 'doctors';

const SessionItem = ({ session, onClick, isActive, isDoctor }: { session: any, onClick: () => void, isActive: boolean, isDoctor: boolean }) => {
  const firestore = useFirestore();
  const userId = isDoctor ? session.doctorId : session.userId;
  
  const profileQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(collection(firestore, 'patients'), where('id', '==', userId));
  }, [firestore, userId]);
  
  const { data: userProfile } = useCollection<any>(profileQuery);
  const profile = userProfile?.[0];

  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-xl border transition-all text-left group flex items-center gap-3",
        isActive ? "border-primary bg-primary/5" : "border-transparent bg-white hover:bg-muted/50"
      )}
    >
      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-xs truncate">
          {isDoctor ? `Dr. ${profile?.firstName || '...'}` : (profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Support User')}
        </p>
        <p className="text-[10px] text-muted-foreground truncate italic">{session.lastMessageContent || session.lastMessage || 'Open session'}</p>
      </div>
      {(session.unreadByAdmin || session.lastMessageSenderRole === 'doctor') && <div className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />}
    </button>
  );
};

export default function SupportMessenger() {
  const { user, userData } = useUserData();
  const firestore = useFirestore();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [adminCategory, setAdminCategory] = useState<MessengerCategory>('patients');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // CRITICAL: Hide support chat during clinical sessions to prevent UI overlap
  const isConsultationRoom = pathname?.includes('/consultation/');

  // Queries for Admin
  const patientSessionsQuery = useMemoFirebase(() => {
    if (!firestore || userData?.role !== 'admin') return null;
    return query(collection(firestore, 'supportChatSessions'), orderBy('lastMessageAt', 'desc'), limit(20));
  }, [firestore, userData?.role]);

  const doctorSessionsQuery = useMemoFirebase(() => {
    if (!firestore || userData?.role !== 'admin') return null;
    return query(collection(firestore, 'adminDoctorChatSessions'), orderBy('lastMessageAt', 'desc'), limit(20));
  }, [firestore, userData?.role]);

  const { data: patientSessions } = useCollection<any>(patientSessionsQuery);
  const { data: doctorSessions } = useCollection<any>(doctorSessionsQuery);

  // Logic for Current Session
  const currentSessionId = useMemo(() => {
    if (userData?.role === 'admin') return activeSessionId;
    return user?.uid || null;
  }, [user?.uid, userData?.role, activeSessionId]);

  const category = useMemo(() => {
    if (userData?.role === 'admin') return adminCategory;
    return userData?.role === 'doctor' ? 'doctors' : 'patients';
  }, [userData?.role, adminCategory]);

  const collectionName = category === 'doctors' ? 'adminDoctorChatSessions' : 'supportChatSessions';

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !currentSessionId) return null;
    return query(
        collection(firestore, collectionName, currentSessionId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(50)
    );
  }, [firestore, currentSessionId, collectionName]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<any>(messagesQuery);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !user || !currentSessionId) return;

    const msg = newMessage.trim();
    setNewMessage('');

    const messageData = {
      content: msg,
      senderId: user.uid,
      senderRole: userData?.role || 'patient',
      timestamp: new Date().toISOString(),
    };

    const sessionRef = doc(firestore, collectionName, currentSessionId);
    
    if (category === 'doctors') {
        setDoc(sessionRef, {
            doctorId: userData?.role === 'admin' ? currentSessionId : user.uid,
            lastMessageAt: new Date().toISOString(),
            lastMessageContent: msg,
            lastMessageSenderRole: userData?.role === 'admin' ? 'admin' : 'doctor',
            status: 'open'
        }, { merge: true });
    } else {
        setDoc(sessionRef, {
            userId: userData?.role === 'admin' ? currentSessionId : user.uid,
            userName: `${userData?.firstName} ${userData?.lastName}`,
            lastMessage: msg,
            lastMessageAt: new Date().toISOString(),
            unreadByAdmin: userData?.role !== 'admin',
            status: 'open'
        }, { merge: true });
    }

    addDoc(collection(sessionRef, 'messages'), messageData);
  };

  if (!user || !userData || isConsultationRoom) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <Card className={cn(
          "w-[350px] sm:w-[380px] mb-3 shadow-2xl border-none overflow-hidden transition-all duration-300 pointer-events-auto flex flex-col",
          isMinimized ? "h-14" : "h-[500px]"
        )}>
          <CardHeader className="bg-slate-900 text-white p-4 flex flex-row items-center justify-between space-y-0 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold truncate">Support Messenger</CardTitle>
                {!isMinimized && <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Secure Clinical Link</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-y-auto p-0 flex flex-col bg-slate-50 custom-scrollbar">
                {userData.role === 'admin' && !activeSessionId ? (
                   <div className="flex flex-col h-full">
                      <div className="flex border-b bg-white">
                        <button 
                            onClick={() => setAdminCategory('patients')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors", adminCategory === 'patients' ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
                        >
                            <Users className="h-3 w-3" /> Patients
                        </button>
                        <button 
                            onClick={() => setAdminCategory('doctors')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors", adminCategory === 'doctors' ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
                        >
                            <Stethoscope className="h-3 w-3" /> Doctors
                        </button>
                      </div>
                      <div className="p-4 space-y-2 overflow-y-auto">
                        {adminCategory === 'patients' ? (
                            patientSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={false} />)
                        ) : (
                            doctorSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={true} />)
                        )}
                        {((adminCategory === 'patients' && !patientSessions?.length) || (adminCategory === 'doctors' && !doctorSessions?.length)) && (
                            <div className="py-24 text-center italic text-muted-foreground text-[11px] px-8">
                                <MessageCircle className="h-10 w-10 mx-auto mb-4 opacity-10" />
                                No active threads in this category.
                            </div>
                        )}
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {userData.role === 'admin' && (
                       <div className="p-2 border-b bg-white flex items-center justify-between">
                         <Button variant="ghost" size="sm" className="text-[9px] font-bold uppercase h-7 px-2" onClick={() => setActiveSessionId(null)}>
                           ← Back to List
                         </Button>
                         <Badge variant="outline" className="text-[8px] uppercase font-bold border-primary/20 text-primary">
                            {adminCategory === 'patients' ? 'Patient Channel' : 'Provider Channel'}
                         </Badge>
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {messages && messages.map((m: any) => {
                        const isMe = m.senderId === user.uid;
                        return (
                            <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                                "max-w-[85%] p-3 rounded-2xl text-xs shadow-sm",
                                isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-white text-slate-700 rounded-bl-none border border-slate-100"
                            )}>
                                {m.content || m.text}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                                {isMe ? 'You' : 'MediConnect'} • {m.timestamp ? format(new Date(m.timestamp), "p") : ''}
                            </span>
                            </div>
                        );
                        })}
                        {(!messages || messages.length === 0) && !isLoadingMessages && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                            <MessageCircle className="h-10 w-10 text-slate-200" />
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight">Encryption Active</p>
                            <p className="text-[10px] text-muted-foreground opacity-60">Start typing below to reach our Support Team.</p>
                        </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                  </div>
                )}
              </CardContent>

              {(userData.role !== 'admin' || activeSessionId) && (
                <CardFooter className="p-3 border-t bg-white">
                  <form onSubmit={handleSendMessage} className="w-full flex gap-2">
                    <Input 
                      placeholder="Type your message..." 
                      className="flex-1 bg-slate-50 border-slate-200 h-10 text-xs rounded-xl focus:ring-primary"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-900 hover:bg-slate-800 h-10 w-10 p-0 rounded-xl shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </CardFooter>
              )}
            </>
          )}
        </Card>
      )}

      <Button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl pointer-events-auto transition-transform hover:scale-110 active:scale-95 border-2 border-white/20",
          isOpen ? "bg-slate-900" : "bg-primary"
        )}
      >
        {isOpen ? <Minimize2 className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
        {!isOpen && userData.role === 'admin' && (patientSessions?.some(s => s.unreadByAdmin) || doctorSessions?.some(s => s.lastMessageSenderRole === 'doctor')) && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center text-[9px] font-bold text-white">!</span>
        )}
      </Button>
    </div>
  );
}
