'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Search, Loader2, FileText, ArrowLeft, Download, ClipboardCheck, Clock } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useState, useMemo, useEffect } from "react";
import { format, isBefore } from "date-fns";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DoctorInfoCell = ({ doctorId }: { doctorId: string }) => {
    const firestore = useFirestore();
    const docRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);
    const { data: doctor, isLoading } = useDoc<Doctor>(docRef);

    if (isLoading) return <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> <span className="text-xs">Loading...</span></div>;
    if (!doctor) return <span className="text-xs text-muted-foreground italic">Info Unavailable</span>;

    return (
        <div>
            <p className="font-bold text-sm">Dr. {doctor.firstName} {doctor.lastName}</p>
            <p className="text-[10px] text-primary uppercase font-bold tracking-tight">{doctor.specialty}</p>
        </div>
    );
};

export default function MedicalHistoryPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        setNow(new Date());
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const historyData = useMemo(() => {
        if (!appointments || !now) return [];
        return appointments
            .filter(apt => apt.status === 'completed' || isBefore(new Date(apt.appointmentDateTime), now))
            .filter(apt => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                const diagnosis = apt.diagnosis?.toLowerCase() || '';
                return diagnosis.includes(searchLower);
            })
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments, searchTerm, now]);

    if (isUserLoading || isLoadingAppointments || !now) {
        return (
            <div className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="flex-grow bg-secondary/30 py-10">
            <div className="container mx-auto px-4 max-w-6xl space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <Button variant="ghost" asChild className="mb-4 rounded-xl hover:bg-white border shadow-sm px-4">
                            <Link href="/patient-portal">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portal
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3 tracking-tight">
                            <History className="h-8 w-8 text-primary" /> My History
                        </h1>
                        <p className="text-muted-foreground mt-1">Review all your performed consultations and clinical summaries.</p>
                    </div>
                    <Card className="border-none shadow-xl bg-white p-6 rounded-2xl hidden md:flex items-center gap-6">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                            <ClipboardCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total History Visits</p>
                            <p className="text-2xl font-bold">{historyData.length}</p>
                        </div>
                    </Card>
                </div>

                <Card className="border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-md rounded-[2.5rem]">
                    <CardHeader className="bg-primary/5 border-b p-6 sm:p-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <Search className="h-6 w-6 text-muted-foreground" /> Clinical Filter
                            </CardTitle>
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by diagnosis keywords (e.g. fever, cardiac)..." 
                                    className="pl-11 bg-white h-12 rounded-2xl border-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyData.length === 0 ? (
                            <div className="py-32 text-center text-muted-foreground space-y-4">
                                <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto">
                                    <ClipboardCheck className="h-10 w-10 opacity-10" />
                                </div>
                                <div>
                                    <p className="font-bold text-lg text-slate-400">No History Indexed</p>
                                    <p className="text-sm px-8">Your history timeline will populate once sessions are performed.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold py-6 pl-10 min-w-[200px]">Visit Date</TableHead>
                                            <TableHead className="font-bold min-w-[250px]">Consultant Professional</TableHead>
                                            <TableHead className="hidden md:table-cell font-bold min-w-[300px]">Diagnosis Summary</TableHead>
                                            <TableHead className="font-bold">Portal Status</TableHead>
                                            <TableHead className="text-right font-bold pr-10">Audit File</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyData.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-primary/5 transition-all group">
                                                <TableCell className="py-6 pl-10">
                                                    <div className="space-y-0.5">
                                                        <p className="font-bold text-slate-900">{format(new Date(record.appointmentDateTime), "MMM dd, yyyy")}</p>
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                                            <Clock className="h-2.5 w-2.5" /> {format(new Date(record.appointmentDateTime), "p")}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <DoctorInfoCell doctorId={record.doctorId} />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <div className="text-xs italic text-muted-foreground bg-muted/20 p-3 rounded-2xl border-2 border-transparent group-hover:border-primary/5 transition-all line-clamp-2 leading-relaxed">
                                                        {record.diagnosis || "Visit record pending initialization..."}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={record.status === 'completed' ? 'secondary' : 'outline'} 
                                                        className={cn(
                                                            "font-bold text-[9px] uppercase tracking-wider h-6 px-3 rounded-full",
                                                            record.status === 'completed' ? "bg-green-100 text-green-800 border-green-200" : "text-amber-600 border-amber-200 bg-amber-50"
                                                        )}
                                                    >
                                                        {record.status === 'completed' ? 'Performed' : record.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-10">
                                                    <div className="flex justify-end gap-2">
                                                        <Button asChild size="sm" className="rounded-xl h-10 px-4 font-bold shadow-lg shadow-primary/20 gap-2">
                                                            <Link href={`/appointments/${record.id}`}>
                                                                <FileText className="h-4 w-4" /> View Summary
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-8 pb-10">
                    <Card className="bg-primary/5 border-2 border-primary/10 rounded-[2rem] shadow-xl p-8 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-bold text-xl tracking-tight">Privacy Protocol</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                            All history is encrypted and exclusively accessible to you and your healthcare providers. We strictly adhere to HIPAA-compliant digital security standards to protect your medical integrity.
                        </p>
                    </Card>
                    <Card className="bg-slate-900 text-white border-none rounded-[2rem] shadow-2xl p-8 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                <AlertCircle className="h-6 w-6 text-accent" />
                            </div>
                            <h3 className="font-bold text-xl tracking-tight">Audit Support</h3>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Discrepancies in your consultation summaries should be reported to clinical support immediately via the Support Messenger. All PDFs include an encrypted trace-ID for authenticity verification.
                        </p>
                    </Card>
                </div>
            </div>
        </main>
    );
}
