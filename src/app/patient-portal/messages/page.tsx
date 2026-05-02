
'use client';

import { useFirestore, useUserData, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare, User, Search, History, Calendar, ArrowRight } from 'lucide-react';
import { format, isValid } from 'date-fns';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useDoc } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ConsultationMessageItem = ({ appointment }: { appointment: any }) => {
  const firestore = useFirestore();
  
  // Safe document reference creation with validation
  const docRef = useMemoFirebase(() => {
    if (!firestore || !appointment?.doctorId) return null;
    return doc(firestore, 'doctors', appointment.doctorId);
  }, [firestore, appointment?.doctorId]);
  
  const { data: doctor } = useDoc<any>(docRef);

  // Safe date formatting to prevent crashes on invalid data
  const appointmentDate = appointment?.appointmentDateTime ? new Date(appointment.appointmentDateTime) : null;
  const formattedDate = appointmentDate && isValid(appointmentDate) 
    ? format(appointmentDate, "MMM dd, yyyy") 
    : 'Date TBD';

  return (
    <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary/40 group overflow-hidden">
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
                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 font-bold border-primary/20 text-primary">Consultation Chat</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                    Consultation session for: {appointment.appointmentType || 'General Consultation'}
                </p>
                <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formattedDate}
                    </span>
                </div>
            </div>
          </div>
          <div className="bg-muted/30 p-6 flex flex-col justify-center items-center sm:items-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-dashed">
            <Button asChild size="sm" className="font-bold group-hover:scale-105 transition-transform">
                <Link href={`/consultation/${appointment.id}`}>
                    Open Room <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
            <p className="text-[9px] text-muted-foreground italic">Real-time messaging available</p>
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

  // Simplified query: Removing orderBy here prevents "Missing Index" crashes.
  // We handle sorting client-side for better reliability.
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'appointments'), 
        where('patientId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: appointments, isLoading } = useCollection<any>(appointmentsQuery);

  // Implement client-side sorting and filtering
  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    
    return appointments
      .filter(apt => {
          if (!searchTerm) return true;
          const searchLower = searchTerm.toLowerCase();
          return apt.appointmentType?.toLowerCase().includes(searchLower) ||
                 apt.id.toLowerCase().includes(searchLower);
      })
      .sort((a, b) => {
          const dateA = a.appointmentDateTime ? new Date(a.appointmentDateTime).getTime() : 0;
          const dateB = b.appointmentDateTime ? new Date(b.appointmentDateTime).getTime() : 0;
          return dateB - dateA; // Newest first
      });
  }, [appointments, searchTerm]);

  return (
    <main className="flex-grow bg-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Message Center</h1>
                <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                    <MessageSquare className="h-4 w-4 text-primary" /> View and manage responses from your doctors.
                </p>
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search consultations..." 
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
              <ConsultationMessageItem key={apt.id} appointment={apt} />
            ))
          ) : (
            <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-dashed">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-200" />
              <p className="text-muted-foreground font-medium">No consultation sessions detected.</p>
              <Button asChild variant="link" className="mt-2 text-primary font-bold">
                <Link href="/find-a-doctor">Book your first medical consultation</Link>
              </Button>
            </div>
          )}
        </div>
        
        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 flex gap-4 items-start">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <History className="text-primary h-6 w-6" />
            </div>
            <div>
                <h4 className="font-bold text-primary-dark">Continuous Care Policy</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    Chat rooms remain active for 48 hours post-consultation to ensure you can receive necessary follow-up guidance from your doctor.
                </p>
            </div>
        </div>
      </div>
    </main>
  );
}
