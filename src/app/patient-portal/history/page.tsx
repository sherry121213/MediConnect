
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
    const { user, isUserLoading } = useUserData();
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
                // Since we don't have doctor info here globally, we filter by diagnosis/notes for now
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
            <div className="container mx-auto px-4">
                <div className="mb-8">
                    <Button variant="ghost" asChild className="mb-4">
                        <Link href="/patient-portal">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <History className="h-8 w-8 text-primary" /> My Medical History
                    </h1>
                    <p className="text-muted-foreground mt-1">Review all your previous consultations and medical records.</p>
                </div>

                <Card className="mb-8 border-none shadow-md overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="pb-4 border-b bg-muted/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="h-5 w-5 text-muted-foreground" /> Filter Records
                            </CardTitle>
                            <div className="relative w-full md:w-96">
                                <Input 
                                    placeholder="Search by diagnosis keywords..." 
                                    className="pl-4 bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyData.length === 0 ? (
                            <div className="py-20 text-center text-muted-foreground">
                                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                <p>No historical records found matching your criteria.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-bold">Visit Date</TableHead>
                                            <TableHead className="font-bold">Healthcare Professional</TableHead>
                                            <TableHead className="hidden md:table-cell font-bold">Diagnosis Summary</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="text-right font-bold">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyData.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-primary/5 transition-colors">
                                                <TableCell className="font-medium whitespace-nowrap">
                                                    <p className="font-bold">{format(new Date(record.appointmentDateTime), "MMM dd, yyyy")}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{format(new Date(record.appointmentDateTime), "p")}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <DoctorInfoCell doctorId={record.doctorId} />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell max-w-xs">
                                                    <p className="text-sm line-clamp-1 italic text-muted-foreground">
                                                        {record.diagnosis || "Visit record pending..."}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={record.status === 'completed' ? 'secondary' : 'outline'} 
                                                        className={cn(
                                                            "font-bold text-[10px]",
                                                            record.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : 'text-amber-600 border-amber-200'
                                                        )}
                                                    >
                                                        {record.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button variant="ghost" size="icon" asChild title="View Details" className="h-8 w-8">
                                                        <Link href={`/appointments/${record.id}`}>
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </Link>
                                                    </Button>
                                                    {record.diagnosis && (
                                                        <Button variant="ghost" size="icon" title="Download Summary" className="h-8 w-8 text-slate-400">
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

                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Confidentiality Note</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your medical records are encrypted and only accessible by you and the doctors you consult with. We strictly adhere to HIPAA-inspired privacy standards to protect your sensitive data.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50/50 border-blue-100">
                        <CardHeader>
                            <CardTitle className="text-lg">Need Assistance?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                If you notice any discrepancies in your consultation summary or diagnosis, please contact our support team or reach out to the respective doctor via follow-up chat.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
