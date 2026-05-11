
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, doc, setDoc, limit, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MessageCircle, X, Send, User, ShieldCheck, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function SupportMessenger() {
  const { user, userData } = useUserData();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // For Admin: Track which session is active
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // If user is Admin, they see a list of all open support sessions
  const adminSessionsQuery = useMemoFirebase(() => {
    if (!firestore || userData?.role !== 'admin') return null;
    return query(collection(firestore, 'supportChatSessions'), orderBy('lastMessageAt', 'desc'), limit(10));
  }, [firestore, userData?.role]);

  const { data: adminSessions } = useCollection<any>(adminSessionsQuery);

  // Current session ID logic
  const currentSessionId = useMemo(() => {
    if (userData?.role === 'admin') return activeSessionId;
    return user?.uid || null;
  }, [user?.uid, userData?.role, activeSessionId]);

  // Messages for the current session
  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !currentSessionId) return null;
    return query(
        collection(firestore, 'supportChatSessions', currentSessionId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(50)
    );
  }, [firestore, currentSessionId]);

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
      text: msg,
      senderId: user.uid,
      senderRole: userData?.role || 'patient',
      timestamp: new Date().toISOString(),
    };

    // Update/Create session metadata
    const sessionRef = doc(firestore, 'supportChatSessions', currentSessionId);
    setDoc(sessionRef, {
      userId: userData?.role === 'admin' ? currentSessionId : user.uid,
      userName: userData?.role === 'admin' ? (adminSessions?.find(s => s.id === activeSessionId)?.userName || 'User') : `${userData?.firstName} ${userData?.lastName}`,
      userRole: userData?.role === 'admin' ? 'patient' : userData?.role || 'patient',
      lastMessage: msg,
      lastMessageAt: new Date().toISOString(),
      unreadByAdmin: userData?.role !== 'admin',
      status: 'open'
    }, { merge: true });

    addDoc(collection(sessionRef, 'messages'), messageData);
  };

  if (!user || !userData) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <Card className={cn(
          "w-[350px] sm:w-[400px] mb-4 shadow-2xl border-none overflow-hidden transition-all duration-300 pointer-events-auto flex flex-col",
          isMinimized ? "h-14" : "h-[500px]"
        )}>
          <CardHeader className="bg-slate-900 text-white p-4 flex flex-row items-center justify-between space-y-0 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">MediConnect Support</CardTitle>
                {!isMinimized && <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Messenger Active</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                {userData.role === 'admin' && !activeSessionId ? (
                   <div className="h-full flex flex-col">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Active Support Requests</p>
                      <div className="space-y-2">
                        {adminSessions?.map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => setActiveSessionId(s.id)}
                            className="w-full p-3 rounded-xl border bg-white hover:bg-primary/5 transition-all text-left group flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate">{s.userName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{s.lastMessage}</p>
                            </div>
                            {s.unreadByAdmin && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </button>
                        ))}
                        {(!adminSessions || adminSessions.length === 0) && (
                          <div className="py-20 text-center italic text-muted-foreground text-xs">No active support threads.</div>
                        )}
                      </div>
                   </div>
                ) : (
                  <>
                    {userData.role === 'admin' && (
                       <Button variant="ghost" size="sm" className="text-[9px] font-bold uppercase h-6 px-2 mb-2" onClick={() => setActiveSessionId(null)}>
                         ← Back to session list
                       </Button>
                    )}
                    {messages && messages.map((m: any) => {
                      const isMe = m.senderId === user.uid;
                      return (
                        <div key={m.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                          <div className={cn(
                            "max-w-[85%] p-3 rounded-2xl text-xs shadow-sm",
                            isMe ? "bg-slate-800 text-white rounded-br-none" : "bg-white text-slate-700 rounded-bl-none border"
                          )}>
                            {m.text}
                          </div>
                          <span className="text-[8px] text-slate-400 mt-1 uppercase font-bold">
                            {isMe ? 'You' : 'Admin'} • {m.timestamp ? format(new Date(m.timestamp), "p") : ''}
                          </span>
                        </div>
                      );
                    })}
                    {(!messages || messages.length === 0) && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <MessageCircle className="h-10 w-10 text-slate-200" />
                        <p className="text-xs text-muted-foreground font-medium">Hello {userData.firstName}! How can we help you today?</p>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </>
                )}
              </CardContent>

              {(userData.role !== 'admin' || activeSessionId) && (
                <CardFooter className="p-3 border-t bg-white">
                  <form onSubmit={handleSendMessage} className="w-full flex gap-2">
                    <Input 
                      placeholder="Type a message..." 
                      className="flex-1 bg-slate-50 border-slate-200 h-10 text-xs rounded-xl"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" disabled={!newMessage.trim()} className="bg-slate-900 hover:bg-slate-800 h-10 w-10 p-0 rounded-xl">
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
          "h-14 w-14 rounded-full shadow-2xl pointer-events-auto transition-transform hover:scale-110 active:scale-95",
          isOpen ? "bg-slate-900" : "bg-primary"
        )}
      >
        {isOpen ? <Minimize2 className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
        {!isOpen && adminSessions?.some(s => s.unreadByAdmin) && userData.role === 'admin' && (
          <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </Button>
    </div>
  );
}
