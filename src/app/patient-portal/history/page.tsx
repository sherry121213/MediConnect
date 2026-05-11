'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Search, Loader2, FileText, ArrowLeft, Download, ClipboardCheck } from "lucide-react";
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
import jsPDF from 'jspdf';

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

    const handleQuickDownload = async (record: Appointment) => {
        if (!userData || !record.diagnosis) return;

        // Note: For history download, we'd ideally fetch the doctor info first
        // But since this is a quick action, we direct to detail page or fetch here.
        // For efficiency, we just navigate to the detail page summary button.
        window.location.assign(`/appointments/${record.id}`);
    };

    if (isUserLoading || isLoadingAppointments || !now) {
        return (
            <div className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="flex-grow bg-secondary/30 py-10">
            <div className="container mx-auto px-4">
                <div className="mb-8">
                    <Button variant="ghost" asChild className="mb-4 rounded-xl hover:bg-white border shadow-sm">
                        <Link href="/patient-portal">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3 tracking-tight">
                        <History className="h-8 w-8 text-primary" /> My Medical Records
                    </h1>
                    <p className="text-muted-foreground mt-1">Review all your previous consultations and professional diagnosis records.</p>
                </div>

                <Card className="mb-8 border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-md rounded-2xl">
                    <CardHeader className="pb-4 border-b bg-muted/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="h-5 w-5 text-muted-foreground" /> Filter Archives
                            </CardTitle>
                            <div className="relative w-full md:w-96">
                                <Input 
                                    placeholder="Search by keywords..." 
                                    className="pl-4 bg-white rounded-xl border-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyData.length === 0 ? (
                            <div className="py-32 text-center text-muted-foreground">
                                <ClipboardCheck className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="font-bold text-lg">No clinical records found.</p>
                                <p className="text-sm px-4">Completed consultation summaries will appear here for your audit.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold py-5 pl-6">Visit Date</TableHead>
                                            <TableHead className="font-bold">Healthcare Professional</TableHead>
                                            <TableHead className="hidden md:table-cell font-bold">Diagnosis Summary</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="text-right font-bold pr-6">Archive</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyData.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-primary/5 transition-all group">
                                                <TableCell className="font-medium whitespace-nowrap py-5 pl-6">
                                                    <p className="font-bold text-slate-800">{format(new Date(record.appointmentDateTime), "MMM dd, yyyy")}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{format(new Date(record.appointmentDateTime), "p")}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <DoctorInfoCell doctorId={record.doctorId} />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell max-w-xs">
                                                    <p className="text-xs line-clamp-1 italic text-muted-foreground bg-muted/20 p-2 rounded-lg border-2 border-transparent group-hover:border-primary/5 transition-all">
                                                        {record.diagnosis || "Visit record pending..."}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={record.status === 'completed' ? 'secondary' : 'outline'} 
                                                        className={cn(
                                                            "font-bold text-[9px] uppercase tracking-wider h-6 px-3 rounded-full",
                                                            record.status === 'completed' ? "bg-green-100 text-green-800 border-green-200" : "text-amber-600 border-amber-200 bg-amber-50"
                                                        )}
                                                    >
                                                        {record.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-2 pr-6">
                                                    <Button variant="ghost" size="icon" asChild title="View Details" className="h-9 w-9 rounded-xl hover:bg-primary/10 transition-colors">
                                                        <Link href={`/appointments/${record.id}`}>
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </Link>
                                                    </Button>
                                                    {record.diagnosis && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            title="Download PDF" 
                                                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                                            onClick={() => handleQuickDownload(record)}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-8">
                    <Card className="bg-primary/5 border-2 border-primary/10 rounded-3xl shadow-lg shadow-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-3">
                                <div className="h-8 w-1.5 bg-primary rounded-full" />
                                Patient Privacy Protocol
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed italic">
                                Your clinical history is encrypted and exclusively shared between you and your healthcare providers. We strictly adhere to digital security standards to protect your medical integrity.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900 text-white border-none rounded-3xl shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-3">
                                <div className="h-8 w-1.5 bg-accent rounded-full" />
                                Audit Assistance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Discrepancies in your consultation summaries should be reported to clinical support immediately. All PDFs include an encrypted trace-ID for authenticity verification.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
