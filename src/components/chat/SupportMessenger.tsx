'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, setDoc, limit, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MessageCircle, X, Send, User, ShieldCheck, Minimize2, Maximize2, Users, Stethoscope, MessageSquare } from 'lucide-react';
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
        "w-full p-3 rounded-2xl border-2 transition-all text-left group flex items-center gap-3",
        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-white hover:bg-slate-50"
      )}
    >
      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-primary/10 transition-colors">
        <User className="h-4 w-4 text-slate-400 group-hover:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[11px] truncate text-slate-900">
          {isDoctor ? `Dr. ${profile?.firstName || '...'}` : (profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Support User')}
        </p>
        <p className="text-[9px] text-muted-foreground truncate italic opacity-70">
            {session.lastMessageContent || session.lastMessage || 'Open session'}
        </p>
      </div>
      {(session.unreadByAdmin || session.lastMessageSenderRole === 'doctor') && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />}
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
  
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isConsultationRoom = pathname?.includes('/consultation/');

  const patientSessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData || userData.role !== 'admin') return null;
    return query(collection(firestore, 'supportChatSessions'), orderBy('lastMessageAt', 'desc'), limit(20));
  }, [firestore, user, userData?.role]);

  const doctorSessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData || userData.role !== 'admin') return null;
    return query(collection(firestore, 'adminDoctorChatSessions'), orderBy('lastMessageAt', 'desc'), limit(20));
  }, [firestore, user, userData?.role]);

  const { data: patientSessions } = useCollection<any>(patientSessionsQuery);
  const { data: doctorSessions } = useCollection<any>(doctorSessionsQuery);

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
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

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
    <div className="fixed bottom-6 right-4 sm:right-6 z-[100] flex flex-col items-end pointer-events-none overscroll-none">
      {isOpen && (
        <Card className={cn(
          "w-[calc(100vw-2rem)] sm:w-[380px] mb-4 shadow-2xl border-none overflow-hidden transition-all duration-300 pointer-events-auto flex flex-col bg-white rounded-[2.5rem] origin-bottom-right",
          isMinimized ? "h-14" : "h-[60dvh] sm:h-[500px] animate-in slide-in-from-bottom-2 zoom-in-95"
        )}>
          <CardHeader className="bg-slate-950 text-white p-4 flex flex-row items-center justify-between space-y-0 cursor-pointer shrink-0 border-b border-white/5" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-[10px] font-bold truncate uppercase tracking-widest">Support Link</CardTitle>
                {!isMinimized && <p className="text-[7px] text-slate-500 uppercase tracking-[0.2em] font-bold">Secure Connection</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white rounded-lg" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white rounded-lg" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-slate-50/30">
                {userData.role === 'admin' && !activeSessionId ? (
                   <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex bg-white shrink-0 p-1.5 gap-1 border-b">
                        <button onClick={() => setAdminCategory('patients')} className={cn("flex-1 py-2 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all", adminCategory === 'patients' ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-50")}>
                            <Users className="h-3 w-3" /> Patients
                        </button>
                        <button onClick={() => setAdminCategory('doctors')} className={cn("flex-1 py-2 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all", adminCategory === 'doctors' ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-50")}>
                            <Stethoscope className="h-3 w-3" /> Providers
                        </button>
                      </div>
                      <div className="p-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                        {adminCategory === 'patients' ? (
                            patientSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={false} />)
                        ) : (
                            doctorSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={true} />)
                        )}
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col h-full overflow-hidden">
                    {userData.role === 'admin' && (
                       <div className="p-2 border-b bg-white flex items-center justify-between shrink-0">
                         <Button variant="ghost" size="sm" className="text-[8px] font-bold uppercase h-7 px-3 rounded-lg border hover:bg-slate-50" onClick={() => setActiveSessionId(null)}>← Back</Button>
                         <Badge variant="outline" className="text-[7px] uppercase font-bold border-primary/20 text-primary bg-primary/5 px-2 py-0.5 rounded-full">{adminCategory === 'patients' ? 'Patient' : 'Provider'}</Badge>
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white/50">
                        {messages && messages.map((m: any) => {
                        const isMe = m.senderId === user.uid;
                        return (
                            <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn("max-w-[85%] p-3 rounded-2xl text-[12px] shadow-sm leading-relaxed", isMe ? "bg-primary text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border")}>
                                {m.content || m.text}
                            </div>
                            <span className="text-[7px] text-slate-400 mt-1 font-bold uppercase tracking-widest">{m.timestamp ? format(new Date(m.timestamp), "p") : ''}</span>
                            </div>
                        );
                        })}
                        <div ref={chatScrollRef} />
                    </div>
                  </div>
                )}
              </CardContent>

              {(userData.role !== 'admin' || activeSessionId) && (
                <CardFooter className="p-3 border-t bg-white shrink-0">
                  <form onSubmit={handleSendMessage} className="w-full flex gap-2">
                    <Input placeholder="Secure message..." className="flex-1 bg-slate-50 border-none h-11 text-xs rounded-xl px-4" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                    <Button type="submit" disabled={!newMessage.trim()} className="bg-primary hover:bg-primary/90 h-11 w-11 p-0 rounded-xl shrink-0"><Send className="h-4 w-4 text-white" /></Button>
                  </form>
                </CardFooter>
              )}
            </>
          )}
        </Card>
      )}

      <Button onClick={() => setIsOpen(!isOpen)} className={cn("h-16 w-16 rounded-[1.5rem] shadow-2xl pointer-events-auto transition-all hover:scale-105 active:scale-95 border-4 border-white animate-in slide-in-from-bottom-4 relative", isOpen ? "bg-slate-950" : "bg-primary")}>
        {isOpen ? <Minimize2 className="h-7 w-7 text-white" /> : <MessageSquare className="h-7 w-7 text-white" />}
        {!isOpen && userData?.role === 'admin' && (patientSessions?.some(s => s.unreadByAdmin) || doctorSessions?.some(s => s.lastMessageSenderRole === 'doctor')) && (
          <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full border-4 border-white animate-pulse flex items-center justify-center text-[10px] font-bold text-white">!</span>
        )}
      </Button>
    </div>
  );
}