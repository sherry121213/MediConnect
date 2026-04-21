'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, User, Search, Shield, Bell } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDoc } from '@/firebase';
import type { Patient } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const DoctorListItem = ({ session }: { session: any }) => {
  const firestore = useFirestore();
  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'patients', session.doctorId);
  }, [firestore, session.doctorId]);
  const { data: doctor } = useDoc<Patient>(docRef);

  const isUnread = session.lastMessageSenderRole === 'doctor';

  return (
    <Link href={`/admin/chats/${session.id}`}>
      <div className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b last:border-0 ${isUnread ? 'bg-primary/5' : ''}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {doctor ? doctor.firstName[0] : <User className="h-5 w-5" />}
            </div>
            {isUnread && <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-primary border-2 border-white" />}
          </div>
          <div>
            <p className={`font-bold ${isUnread ? 'text-primary' : ''}`}>
                {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Loading...'}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {session.lastMessageContent || doctor?.email}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Last Active</p>
          <p className="text-xs">{format(new Date(session.lastMessageAt || session.createdAt), "MMM dd, p")}</p>
          {isUnread && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white mt-1">NEW REPLY</Badge>}
        </div>
      </div>
    </Link>
  );
};

export default function AdminChatsPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'adminDoctorChatSessions'));
  }, [firestore]);

  const { data: sessions, isLoading } = useCollection<any>(sessionsQuery);

  const filteredSessions = sessions?.filter((s: any) => {
      if (!searchTerm) return true;
      return s.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Clinical Support Center</h1>
          <p className="text-muted-foreground">Manage ongoing conversations with healthcare providers.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search sessions..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="max-w-4xl border-none shadow-lg">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredSessions && filteredSessions.length > 0 ? (
            <div className="divide-y">
              {filteredSessions.sort((a:any, b:any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()).map((session: any) => (
                <DoctorListItem key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p>No active support sessions found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}