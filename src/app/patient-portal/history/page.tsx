'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Search, Loader2, Calendar, FileText, ArrowLeft, Download, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MedicalHistoryPage() {
    const { user, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

    const historyData = useMemo(() => {
        if (!appointments || !doctors) return [];
        return appointments
            .filter(apt => apt.status === 'completed' || new Date(apt.appointmentDateTime) < new Date())
            .map(apt => ({
                ...apt,
                doctor: doctors.find(d => d.id === apt.doctorId)
            }))
            .filter(apt => {
                const searchLower = searchTerm.toLowerCase();
                const doctorName = `${apt.doctor?.firstName} ${apt.doctor?.lastName}`.toLowerCase();
                const diagnosis = apt.diagnosis?.toLowerCase() || '';
                return doctorName.includes(searchLower) || diagnosis.includes(searchLower);
            })
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments, doctors, searchTerm]);

    if (isUserLoading || isLoadingAppointments || isLoadingDoctors) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </main>
                <AppFooter />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
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

                    <Card className="mb-8 border-none shadow-md">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Search className="h-5 w-5 text-muted-foreground" /> Filter Records
                                </CardTitle>
                                <div className="relative w-full md:w-96">
                                    <Input 
                                        placeholder="Search by doctor name or diagnosis..." 
                                        className="pl-4"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {historyData.length === 0 ? (
                                <div className="py-20 text-center text-muted-foreground">
                                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>No historical records found matching your criteria.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Visit Date</TableHead>
                                                <TableHead>Healthcare Professional</TableHead>
                                                <TableHead className="hidden md:table-cell">Diagnosis Summary</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {historyData.map((record) => (
                                                <TableRow key={record.id} className="hover:bg-muted/30">
                                                    <TableCell className="font-medium whitespace-nowrap">
                                                        {format(new Date(record.appointmentDateTime), "MMM dd, yyyy")}
                                                        <p className="text-[10px] text-muted-foreground">{format(new Date(record.appointmentDateTime), "p")}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="font-bold">Dr. {record.doctor?.firstName} {record.doctor?.lastName}</p>
                                                        <p className="text-xs text-primary">{record.doctor?.specialty}</p>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell max-w-xs truncate">
                                                        {record.diagnosis || <span className="italic text-muted-foreground">Awaiting report</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={record.status === 'completed' ? 'secondary' : 'outline'} className={record.status === 'completed' ? 'bg-green-100 text-green-800' : ''}>
                                                            {record.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="ghost" size="icon" asChild title="View Details">
                                                            <Link href={`/appointments/${record.id}`}>
                                                                <FileText className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        {record.diagnosis && (
                                                            <Button variant="ghost" size="icon" title="Download Summary" className="text-primary">
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
            <AppFooter />
        </div>
    );
}