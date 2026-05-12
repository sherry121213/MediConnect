'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, User, CreditCard, ExternalLink, Filter, CheckCircle2, AlertCircle, Clock, History, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const PatientProfileCell = ({ patientId, onShowHistory }: { patientId: string, onShowHistory: (pid: string) => void }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                    {patient?.firstName?.[0] || '...'}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{patient?.email}</p>
                </div>
            </div>
        </div>
    );
};

export default function DoctorPatientsPage() {
    const { user } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: appointments, isLoading } = useCollection<Appointment>(appointmentsQuery);

    const patientStats = useMemo(() => {
        if (!appointments) return { uniquePatients: [], stats: { total: 0, paid: 0, pending: 0, uniqueCount: 0 } };
        
        const uniquePatientIds = Array.from(new Set(appointments.map(a => a.patientId)));
        const patientData = uniquePatientIds.map(pid => {
            const apts = appointments.filter(a => a.patientId === pid);
            const lastApt = apts.sort((a,b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime())[0];
            return {
                id: pid,
                totalVisits: apts.length,
                lastVisit: lastApt.appointmentDateTime,
                lastStatus: lastApt.status
            };
        });

        return {
            uniquePatients: patientData,
            stats: {
                total: appointments.length,
                paid: appointments.filter(a => a.paymentStatus === 'approved').length,
                pending: appointments.filter(a => a.paymentStatus === 'pending' && a.paymentReceiptUrl).length,
                uniqueCount: uniquePatientIds.length
            }
        };
    }, [appointments]);

    const filteredPatients = useMemo(() => {
        if (!patientStats.uniquePatients) return [];
        if (!searchTerm) return patientStats.uniquePatients;
        // Search filter would ideally join with patient names, but for now we list all
        return patientStats.uniquePatients;
    }, [patientStats.uniquePatients, searchTerm]);

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4 max-w-6xl space-y-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Clinical Registry</h1>
                        <p className="text-muted-foreground mt-1">Review professional history and unique patient distribution.</p>
                    </div>
                    <Button variant="outline" asChild className="rounded-xl border-2 font-bold shadow-sm">
                        <Link href="/doctor-portal">Back to Dashboard</Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-none shadow-xl bg-primary text-primary-foreground rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Unique Patients</p>
                            <CardTitle className="text-4xl font-bold">{patientStats.stats.uniqueCount}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Consultations</p>
                            <CardTitle className="text-4xl font-bold text-primary">{patientStats.stats.total}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest text-green-600">Verified Fees</p>
                            <CardTitle className="text-4xl font-bold text-green-600">{patientStats.stats.paid}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest text-amber-600">Pending Review</p>
                            <CardTitle className="text-4xl font-bold text-amber-600">{patientStats.stats.pending}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b p-6 sm:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <History className="h-6 w-6 text-primary" /> Comprehensive Patient Pool
                            </CardTitle>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search registry..." 
                                    className="pl-9 h-11 border-2 rounded-xl"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary/30" /></div>
                        ) : filteredPatients.length > 0 ? (
                            <div className="overflow-x-auto custom-scrollbar">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow>
                                            <TableHead className="py-5 pl-8 font-bold">Patient Profile</TableHead>
                                            <TableHead className="font-bold">Total Visits</TableHead>
                                            <TableHead className="font-bold">Last Clinical Interaction</TableHead>
                                            <TableHead className="text-right pr-8 font-bold">Registry Audit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPatients.map((p) => (
                                            <TableRow key={p.id} className="hover:bg-primary/5 transition-all group">
                                                <TableCell className="py-5 pl-8">
                                                    <PatientProfileCell patientId={p.id} onShowHistory={() => {}} />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary font-bold text-[10px] uppercase">
                                                        {p.totalVisits} Consultations
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                                        {format(new Date(p.lastVisit), "MMM dd, yyyy")}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <Button variant="ghost" size="sm" asChild className="rounded-xl hover:bg-primary hover:text-white font-bold text-[10px] uppercase gap-2 transition-all">
                                                        <Link href={`/doctor-portal/records?patientId=${p.id}`}>
                                                            Audit Records <ChevronRight className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-32 text-muted-foreground italic">
                                <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="text-lg font-bold text-slate-400 tracking-tight">No clinical records matched your search.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
