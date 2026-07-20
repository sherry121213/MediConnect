'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, setDoc, limit, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MessageCircle, X, Send, User, ShieldCheck, Minimize2, Maximize2, Users, Stethoscope } from 'lucide-react';
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
        "w-full p-3 rounded-2xl border transition-all text-left group flex items-center gap-3",
        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-white hover:bg-muted/50"
      )}
    >
      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-xs truncate">
          {isDoctor ? `Dr. ${profile?.firstName || '...'}` : (profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Support User')}
        </p>
        <p className="text-[10px] text-muted-foreground truncate italic opacity-70">{session.lastMessageContent || session.lastMessage || 'Open session'}</p>
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
          "w-[calc(100vw-2rem)] sm:w-[400px] mb-4 shadow-2xl border-none overflow-hidden transition-all duration-300 pointer-events-auto flex flex-col bg-white rounded-[2.5rem]",
          isMinimized ? "h-16" : "h-[60dvh] sm:h-[550px] max-h-[700px]"
        )}>
          <CardHeader className="bg-slate-950 text-white p-5 flex flex-row items-center justify-between space-y-0 cursor-pointer shrink-0" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold truncate">Support</CardTitle>
                {!isMinimized && <p className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-bold">Secure Tunnel</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white rounded-xl" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white rounded-xl" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-slate-50">
                {userData.role === 'admin' && !activeSessionId ? (
                   <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex border-b bg-white shrink-0 sticky top-0 z-10 p-1">
                        <button 
                            onClick={() => setAdminCategory('patients')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl", adminCategory === 'patients' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}
                        >
                            <Users className="h-3.5 w-3.5" /> Patients
                        </button>
                        <button 
                            onClick={() => setAdminCategory('doctors')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-xl", adminCategory === 'doctors' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}
                        >
                            <Stethoscope className="h-3.5 w-3.5" /> Doctors
                        </button>
                      </div>
                      <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                        {adminCategory === 'patients' ? (
                            patientSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={false} />)
                        ) : (
                            doctorSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={true} />)
                        )}
                        {((adminCategory === 'patients' && !patientSessions?.length) || (adminCategory === 'doctors' && !doctorSessions?.length)) && (
                            <div className="py-32 text-center italic text-muted-foreground text-[11px] px-8 space-y-4">
                                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-10 text-primary" />
                                <p className="font-bold uppercase tracking-widest opacity-50">No Active Conversations</p>
                            </div>
                        )}
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col h-full overflow-hidden">
                    {userData.role === 'admin' && (
                       <div className="p-3 border-b bg-white flex items-center justify-between shrink-0 sticky top-0 z-10">
                         <Button variant="ghost" size="sm" className="text-[9px] font-bold uppercase h-8 px-3 rounded-xl border hover:bg-slate-50" onClick={() => setActiveSessionId(null)}>
                           ← Inbox
                         </Button>
                         <Badge variant="outline" className="text-[8px] uppercase font-bold border-primary/20 text-primary bg-primary/5 px-2">
                            {adminCategory === 'patients' ? 'Patient Channel' : 'Provider Channel'}
                         </Badge>
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/50">
                        {messages && messages.map((m: any) => {
                        const isMe = m.senderId === user.uid;
                        return (
                            <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                                "max-w-[85%] p-4 rounded-3xl text-[13px] shadow-sm leading-relaxed",
                                isMe ? "bg-slate-900 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none border border-slate-200"
                            )}>
                                {m.content || m.text}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-2 uppercase font-bold tracking-widest">
                                {isMe ? 'Sent' : 'MediConnect'} • {m.timestamp ? format(new Date(m.timestamp), "p") : ''}
                            </span>
                            </div>
                        );
                        })}
                        {(!messages || messages.length === 0) && !isLoadingMessages && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                            <div className="h-16 w-16 rounded-3xl bg-primary/5 flex items-center justify-center">
                                <ShieldCheck className="h-8 w-8 text-primary opacity-20" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Encrypted Session</p>
                                <p className="text-[11px] text-slate-400">Ask us anything about your clinical records or portal access.</p>
                            </div>
                        </div>
                        )}
                        <div ref={chatScrollRef} />
                    </div>
                  </div>
                )}
              </CardContent>

              {(userData.role !== 'admin' || activeSessionId) && (
                <CardFooter className="p-4 border-t bg-white shrink-0">
                  <form onSubmit={handleSendMessage} className="w-full flex gap-3">
                    <Input 
                      placeholder="Secure message..." 
                      className="flex-1 bg-slate-100 border-none h-12 text-sm rounded-2xl px-5 focus-visible:ring-primary shadow-inner"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-950 hover:bg-slate-900 h-12 w-12 p-0 rounded-2xl shrink-0 shadow-lg shadow-slate-200">
                      <Send className="h-5 w-5" />
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
          "h-16 w-16 rounded-[1.75rem] shadow-2xl pointer-events-auto transition-all hover:scale-110 active:scale-95 border-2 border-white/20",
          isOpen ? "bg-slate-950" : "bg-primary"
        )}
      >
        {isOpen ? <Minimize2 className="h-7 w-7 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
        {!isOpen && userData?.role === 'admin' && (patientSessions?.some(s => s.unreadByAdmin) || doctorSessions?.some(s => s.lastMessageSenderRole === 'doctor')) && (
          <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full border-4 border-slate-50 animate-pulse flex items-center justify-center text-[10px] font-bold text-white shadow-lg">!</span>
        )}
      </Button>
    </div>
  );
}
