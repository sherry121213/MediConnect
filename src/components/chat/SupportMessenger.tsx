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
        "w-full p-4 rounded-[1.5rem] border-2 transition-all text-left group flex items-center gap-3",
        isActive ? "border-primary bg-primary/5 shadow-md" : "border-transparent bg-white hover:bg-slate-50"
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-primary/10 transition-colors">
        <User className="h-5 w-5 text-slate-400 group-hover:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-xs truncate text-slate-900">
          {isDoctor ? `Dr. ${profile?.firstName || '...'}` : (profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Support User')}
        </p>
        <p className="text-[9px] text-muted-foreground truncate italic opacity-70 mt-0.5">{session.lastMessageContent || session.lastMessage || 'Precision session open'}</p>
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
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start pointer-events-none group">
      {isOpen && (
        <Card className={cn(
          "w-[calc(100vw-3rem)] sm:w-[420px] mb-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-none overflow-hidden transition-all duration-500 ease-in-out pointer-events-auto flex flex-col bg-white rounded-[2.5rem] origin-bottom-left",
          isMinimized ? "h-16" : "h-[65dvh] sm:h-[600px] max-h-[800px] animate-in slide-in-from-bottom-5 zoom-in-95"
        )}>
          <CardHeader className="bg-slate-950 text-white p-5 flex flex-row items-center justify-between space-y-0 cursor-pointer shrink-0 border-b border-white/5" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border-2 border-primary/20 shadow-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold truncate font-headline tracking-tight">Clinical Support</CardTitle>
                {!isMinimized && <p className="text-[8px] text-slate-400 uppercase tracking-[0.25em] font-bold mt-0.5">Secure Precision Link</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white rounded-xl transition-colors" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white rounded-xl transition-colors" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-slate-50">
                {userData.role === 'admin' && !activeSessionId ? (
                   <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex bg-white shrink-0 sticky top-0 z-10 p-2 gap-2 border-b">
                        <button 
                            onClick={() => setAdminCategory('patients')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-2xl", adminCategory === 'patients' ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-400 hover:bg-slate-50 border border-transparent")}
                        >
                            <Users className="h-3.5 w-3.5" /> Patients
                        </button>
                        <button 
                            onClick={() => setAdminCategory('doctors')}
                            className={cn("flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-2xl", adminCategory === 'doctors' ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-400 hover:bg-slate-50 border border-transparent")}
                        >
                            <Stethoscope className="h-3.5 w-3.5" /> Providers
                        </button>
                      </div>
                      <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                        {adminCategory === 'patients' ? (
                            patientSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={false} />)
                        ) : (
                            doctorSessions?.map(s => <SessionItem key={s.id} session={s} onClick={() => setActiveSessionId(s.id)} isActive={activeSessionId === s.id} isDoctor={true} />)
                        )}
                        {((adminCategory === 'patients' && !patientSessions?.length) || (adminCategory === 'doctors' && !doctorSessions?.length)) && (
                            <div className="py-32 text-center italic text-muted-foreground text-[11px] px-8 space-y-4">
                                <div className="h-20 w-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MessageSquare className="h-10 w-10 text-primary opacity-20" />
                                </div>
                                <p className="font-bold uppercase tracking-widest opacity-40">No active clinical queries</p>
                            </div>
                        )}
                      </div>
                   </div>
                ) : (
                  <div className="flex flex-col h-full overflow-hidden">
                    {userData.role === 'admin' && (
                       <div className="p-4 border-b bg-white flex items-center justify-between shrink-0 sticky top-0 z-10">
                         <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase h-9 px-4 rounded-xl border-2 hover:bg-slate-50 transition-all" onClick={() => setActiveSessionId(null)}>
                           ← Back to Registry
                         </Button>
                         <Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 text-primary bg-primary/5 px-3 py-1 rounded-full">
                            {adminCategory === 'patients' ? 'Patient Channel' : 'Provider Channel'}
                         </Badge>
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
                        {messages && messages.map((m: any) => {
                        const isMe = m.senderId === user.uid;
                        return (
                            <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                                "max-w-[85%] p-4 rounded-[1.75rem] text-[13px] shadow-sm leading-relaxed",
                                isMe ? "bg-primary text-white rounded-bl-[1.75rem] rounded-br-none shadow-xl shadow-primary/10" : "bg-white text-slate-800 rounded-br-[1.75rem] rounded-bl-none border-2 border-slate-100"
                            )}>
                                {m.content || m.text}
                            </div>
                            <span className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest flex items-center gap-2">
                                {isMe ? 'Authenticated' : 'MediConnect'} • {m.timestamp ? format(new Date(m.timestamp), "p") : ''}
                            </span>
                            </div>
                        );
                        })}
                        {(!messages || messages.length === 0) && !isLoadingMessages && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                            <div className="h-20 w-20 rounded-[2.5rem] bg-primary/5 flex items-center justify-center border-4 border-white shadow-xl">
                                <ShieldCheck className="h-10 w-10 text-primary opacity-30" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] text-slate-900 font-bold uppercase tracking-[0.2em]">End-to-End Encryption</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed italic">Initiate a direct professional session with our clinical support team.</p>
                            </div>
                        </div>
                        )}
                        <div ref={chatScrollRef} />
                    </div>
                  </div>
                )}
              </CardContent>

              {(userData.role !== 'admin' || activeSessionId) && (
                <CardFooter className="p-6 border-t bg-white shrink-0">
                  <form onSubmit={handleSendMessage} className="w-full flex gap-3">
                    <Input 
                      placeholder="Type secure message..." 
                      className="flex-1 bg-slate-50 border-2 border-slate-100 h-14 text-sm rounded-2xl px-6 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" disabled={!newMessage.trim()} className="bg-primary hover:bg-primary/90 h-14 w-14 p-0 rounded-2xl shrink-0 shadow-2xl shadow-primary/20 transition-transform active:scale-95">
                      <Send className="h-5 w-5 text-white" />
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
          "h-16 w-16 rounded-[1.75rem] shadow-[0_15px_40px_rgba(0,0,0,0.15)] pointer-events-auto transition-all hover:scale-110 active:scale-90 border-4 border-white animate-in slide-in-from-bottom-10",
          isOpen ? "bg-slate-950" : "bg-primary"
        )}
      >
        {isOpen ? <Minimize2 className="h-7 w-7 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
        {!isOpen && userData?.role === 'admin' && (patientSessions?.some(s => s.unreadByAdmin) || doctorSessions?.some(s => s.lastMessageSenderRole === 'doctor')) && (
          <span className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full border-4 border-white animate-pulse flex items-center justify-center text-[10px] font-bold text-white shadow-xl">!</span>
        )}
      </Button>
    </div>
  );
}
