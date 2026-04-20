'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, User, Search, Shield } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useDoc } from '@/firebase';
import type { Patient } from '@/lib/types';

const DoctorListItem = ({ session }: { session: any }) => {
  const firestore = useFirestore();
  const docRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'patients', session.doctorId);
  }, [firestore, session.doctorId]);
  const { data: doctor } = useDoc<Patient>(docRef);

  return (
    <Link href={`/admin/chats/${session.id}`}>
      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b last:border-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {doctor ? doctor.firstName[0] : <User className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-bold">{doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Loading...'}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doctor?.email}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Last Active</p>
          <p className="text-xs">{format(new Date(session.lastMessageAt || session.createdAt), "MMM dd, p")}</p>
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
            placeholder="Search doctors..." 
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
          ) : sessions && sessions.length > 0 ? (
            <div className="divide-y">
              {sessions.sort((a:any, b:any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()).map((session: any) => (
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
