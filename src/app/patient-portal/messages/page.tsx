'use client';

import { useFirestore, useUserData, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MessageSquare, User, Search, History, Calendar, ArrowRight, Clock } from 'lucide-react';
import { format, isValid } from 'date-fns';
import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ConsultationMessageItem = ({ appointment, isMounted }: { appointment: any, isMounted: boolean }) => {
  const firestore = useFirestore();
  
  const docRef = useMemoFirebase(() => {
    if (!firestore || !appointment?.doctorId) return null;
    return doc(firestore, 'doctors', appointment.doctorId);
  }, [firestore, appointment?.doctorId]);
  
  const { data: doctor } = useDoc<any>(docRef);

  const appointmentDate = appointment?.appointmentDateTime ? new Date(appointment.appointmentDateTime) : null;
  const isDateValid = appointmentDate && isValid(appointmentDate);
  const formattedDate = isDateValid 
    ? format(appointmentDate, "MMM dd, yyyy") 
    : 'Date TBD';

  // Hydration-safe timing check
  const isTimeReached = isMounted && appointmentDate && isDateValid 
    ? new Date().getTime() >= appointmentDate.getTime() 
    : false;

  return (
    <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary/40 group overflow-hidden bg-white">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="p-6 flex-1 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {doctor ? doctor.firstName[0] : <User className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg truncate">
                        {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Healthcare Provider'}
                    </h3>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 font-bold border-primary/20 text-primary">Verified Room</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                    Consultation mode: {appointment.appointmentType || 'General Consultation'}
                </p>
                <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formattedDate}
                    </span>
                    {!isTimeReached && isDateValid && (
                         <span className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Chat opens at {format(appointmentDate, "p")}
                        </span>
                    )}
                </div>
            </div>
          </div>
          <div className="bg-muted/30 p-6 flex flex-col justify-center items-center sm:items-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-dashed">
            {isTimeReached ? (
                <Button asChild size="sm" className="font-bold group-hover:scale-105 transition-transform">
                    <Link href={`/consultation/${appointment.id}`}>
                        Open Chat & Room <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            ) : (
                <Button size="sm" variant="secondary" className="font-bold cursor-not-allowed opacity-70" disabled>
                    Awaiting Start Time <Clock className="ml-2 h-4 w-4" />
                </Button>
            )}
            <p className="text-[9px] text-muted-foreground italic">Clinical session link</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PatientMessagesPage() {
  const { user, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'appointments'), 
        where('patientId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: appointments, isLoading } = useCollection<any>(appointmentsQuery);

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    
    return appointments
      .filter(apt => {
          if (!apt) return false;
          // REQUIREMENT: Only verified payments are visible in the message center
          if (apt.paymentStatus !== 'approved') return false;

          if (!searchTerm) return true;
          const searchLower = searchTerm.toLowerCase();
          return (apt.appointmentType?.toLowerCase() || '').includes(searchLower) ||
                 (apt.id?.toLowerCase() || '').includes(searchLower);
      })
      .sort((a, b) => {
          if (!a || !b) return 0;
          const dateA = a.appointmentDateTime ? new Date(a.appointmentDateTime).getTime() : 0;
          const dateB = b.appointmentDateTime ? new Date(b.appointmentDateTime).getTime() : 0;
          const timeA = isNaN(dateA) ? 0 : dateA;
          const timeB = isNaN(dateB) ? 0 : dateB;
          return timeB - timeA; 
      });
  }, [appointments, searchTerm]);

  if (!isMounted) return null;

  return (
    <main className="flex-grow bg-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Clinical Message Center</h1>
                <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                    <MessageSquare className="h-4 w-4 text-primary" /> Verified consultation channels and real-time guidance.
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search verified sessions..." 
                    className="pl-9 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="space-y-4">
          {isUserLoading || isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredAppointments.length > 0 ? (
            filteredAppointments.map((apt: any) => (
              <ConsultationMessageItem key={apt.id} appointment={apt} isMounted={isMounted} />
            ))
          ) : (
            <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-dashed">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-200" />
              <p className="text-muted-foreground font-medium">No verified consultations found.</p>
              <p className="text-xs text-muted-foreground mt-1">Chat sessions appear here once your payment receipt is approved.</p>
              <Button asChild variant="link" className="mt-4 text-primary font-bold">
                <Link href="/patient-portal">Check Pending Verifications</Link>
              </Button>
            </div>
          )}
        </div>
        
        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex gap-4 items-start">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <History className="text-primary h-6 world-6" />
            </div>
            <div>
                <h4 className="font-bold text-primary-dark">Confidentiality Shield</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    Direct messaging is exclusively available for confirmed appointments. All clinical history and chat transcripts are archived for your safety and medical audit.
                </p>
            </div>
        </div>
      </div>
    </main>
  );
}
