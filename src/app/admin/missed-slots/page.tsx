'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, History, User, Search, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { Doctor } from '@/lib/types';

export default function AdminMissedSlotsPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const missedQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'missedSessionAudits'), orderBy('loggedAt', 'desc'));
  }, [firestore]);

  const { data: audits, isLoading: isLoadingAudits } = useCollection<any>(missedQuery);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'doctors');
  }, [firestore]);

  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  const filteredAudits = useMemo(() => {
    if (!audits || !doctors) return [];
    return audits.filter((audit: any) => {
      const doctor = doctors.find(d => d.id === audit.doctorId);
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      const doctorName = `${doctor?.firstName} ${doctor?.lastName}`.toLowerCase();
      const specialty = (doctor?.specialty || '').toLowerCase();
      return doctorName.includes(searchLower) || specialty.includes(searchLower);
    });
  }, [audits, doctors, searchTerm]);

  const isLoading = isLoadingAudits || isLoadingDoctors;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Missed Session History</h1>
          <p className="text-muted-foreground text-sm">Comprehensive archive of untended professional slots.</p>
        </div>
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by doctor name or specialty..." 
                className="pl-9 h-11 bg-white border-2 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-destructive text-white rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em] mb-1">Total Missed Records</p>
                  <p className="text-4xl font-bold tracking-tighter">{audits?.length || 0}</p>
              </CardContent>
          </Card>
          <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden md:col-span-2">
              <CardContent className="p-6 flex items-center gap-6">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <History className="h-6 w-6" />
                  </div>
                  <div>
                      <p className="text-sm font-bold tracking-tight">Clinical Session Archive</p>
                      <p className="text-xs text-muted-foreground">This page maintains the overall history of clinical window expiries for regulatory surveillance.</p>
                  </div>
              </CardContent>
          </Card>
      </div>

      <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-6 px-8">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> Session Audit Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredAudits.length > 0 ? (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                    <TableHead className="py-5 pl-8 font-bold min-w-[200px]">Healthcare Provider</TableHead>
                    <TableHead className="font-bold min-w-[150px]">Clinical Specialty</TableHead>
                    <TableHead className="font-bold min-w-[180px]">Scheduled Slot</TableHead>
                    <TableHead className="font-bold min-w-[180px]">Audit Timestamp</TableHead>
                    <TableHead className="text-right pr-8 font-bold">Audit ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAudits.map((log: any) => {
                      const doctor = doctors?.find(d => d.id === log.doctorId);
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors group">
                          <TableCell className="py-5 pl-8">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <User className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm">Dr. {doctor?.firstName} {doctor?.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                             <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-tighter border-primary/20 text-primary bg-primary/5">
                                {doctor?.specialty || 'General'}
                             </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(log.scheduledTime), "MMM dd, yyyy")}
                                <span className="text-destructive opacity-80">@ {format(new Date(log.scheduledTime), "p")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                {format(new Date(log.loggedAt), "PP")} 
                                <span className="ml-1 opacity-50 font-normal">at {format(new Date(log.loggedAt), "p")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                             <code className="text-[9px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">
                                {log.appointmentId.slice(0, 8)}...
                             </code>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
                </Table>
            </div>
          ) : (
            <div className="text-center py-32 text-muted-foreground italic">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold text-slate-400 tracking-tight">No history records found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
