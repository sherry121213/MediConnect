
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Activity, Layers, Clock, User, ShieldCheck, Search } from 'lucide-react';
import { format, isSameDay, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Appointment, Doctor } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AdminQueuesPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  // We simplify the query to avoid complex index requirements that might trigger permission errors
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'appointments');
  }, [firestore]);

  const { data: appointmentsRaw, isLoading: isLoadingApts } = useCollection<Appointment>(appointmentsQuery);

  const doctorsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'doctors');
  }, [firestore]);
  const { data: doctors } = useCollection<Doctor>(doctorsQuery);

  // Perform clinical filtering and sorting in-memory for stability
  const queueBlocks = useMemo(() => {
    if (!appointmentsRaw) return [];
    
    // 1. Filter for Approved and Scheduled sessions
    const activeApts = appointmentsRaw.filter(apt => 
        apt && 
        apt.paymentStatus === 'approved' && 
        apt.status === 'scheduled' &&
        apt.appointmentDateTime
    );

    // 2. Group into blocks by Doctor ID + Time String (to identify concurrent sessions)
    const blocks: Record<string, Appointment[]> = {};
    
    activeApts.forEach(apt => {
        if (!apt.doctorId || !apt.appointmentDateTime) return;
        // Use blockId if available, fallback to appointmentDateTime
        const blockKey = `${apt.doctorId}_${apt.blockId || apt.appointmentDateTime}`;
        if (!blocks[blockKey]) blocks[blockKey] = [];
        blocks[blockKey].push(apt);
    });

    return Object.entries(blocks).map(([key, list]) => {
        const doctorId = key.split('_')[0];
        const doctor = doctors?.find(d => d.id === doctorId);
        const timeVal = list[0]?.appointmentDateTime;
        return {
            id: key,
            doctor,
            appointments: list.sort((a, b) => (a.sequencePosition || 0) - (b.sequencePosition || 0)),
            time: timeVal && isValid(new Date(timeVal)) ? timeVal : new Date().toISOString()
        };
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [appointmentsRaw, doctors]);

  const filteredBlocks = queueBlocks.filter(b => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return b.doctor?.firstName.toLowerCase().includes(searchLower) || 
             b.doctor?.lastName.toLowerCase().includes(searchLower) ||
             b.doctor?.specialty?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-slate-900">Queue Monitor</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Live Back-to-Back Session Surveillance
            </p>
        </div>
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search provider..." 
                className="pl-9 h-11 bg-white border-2 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {isLoadingApts ? (
          <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filteredBlocks.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {filteredBlocks.map((block) => (
                  <Card key={block.id} className="border-none shadow-xl overflow-hidden bg-white rounded-[2rem]">
                      <CardHeader className="bg-slate-900 text-white p-6 sm:p-8">
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                      <User className="h-6 w-6" />
                                  </div>
                                  <div>
                                      <CardTitle className="text-lg font-headline">Dr. {block.doctor?.firstName} {block.doctor?.lastName}</CardTitle>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{block.doctor?.specialty}</p>
                                  </div>
                              </div>
                              <Badge variant="outline" className="border-white/20 text-white text-[10px] font-bold px-3 py-1 flex items-center gap-2">
                                  <Clock className="h-3 w-3" /> {format(new Date(block.time), "p")}
                              </Badge>
                          </div>
                      </CardHeader>
                      <CardContent className="p-0">
                          <div className="divide-y divide-slate-100">
                              {block.appointments.map((apt) => (
                                  <div key={apt.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                      <div className="flex items-center gap-4 min-w-0">
                                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                              #{apt.sequencePosition}
                                          </div>
                                          <div className="min-w-0">
                                              <p className="text-sm font-bold text-slate-900 truncate">Patient ID: {apt.patientId.slice(0, 8)}</p>
                                              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Assigned Sequence</p>
                                          </div>
                                      </div>
                                      <Badge className={cn(
                                          "h-6 px-3 rounded-full text-[9px] font-bold uppercase",
                                          apt.queueStatus === 'in-consultation' ? "bg-green-600 animate-pulse" :
                                          apt.queueStatus === 'shifted' ? "bg-amber-600" :
                                          apt.queueStatus === 'late' ? "bg-red-600" : "bg-primary"
                                      )}>
                                          {apt.queueStatus || 'waiting'}
                                      </Badge>
                                  </div>
                              ))}
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>
      ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border-4 border-dashed">
              <Activity className="h-16 w-16 mx-auto mb-4 text-slate-200" />
              <p className="text-slate-400 font-bold">No active queue blocks detected.</p>
          </div>
      )}
    </div>
  );
}
