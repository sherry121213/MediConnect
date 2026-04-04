'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, User, CreditCard, ExternalLink, Filter, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const PatientNameCell = ({ patientId }: { patientId: string }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="h-4 w-4" />
            </div>
            <span className="font-medium">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</span>
        </div>
    );
};

export default function DoctorPatientsPage() {
    const { user } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: appointments, isLoading } = useCollection<Appointment>(appointmentsQuery);

    const filteredRecords = useMemo(() => {
        if (!appointments) return [];
        return appointments.filter(apt => {
            // In a real app, we'd need to search by name which is in a different collection.
            // For now, we'll filter by fee status logic.
            const hasPaid = apt.paymentStatus === 'approved';
            const hasSentReceipt = !!apt.paymentReceiptUrl;

            if (statusFilter === 'paid' && !hasPaid) return false;
            if (statusFilter === 'unpaid' && hasPaid) return false;

            return true;
        }).sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments, statusFilter]);

    const stats = useMemo(() => {
        if (!appointments) return { total: 0, paid: 0, pending: 0 };
        return {
            total: appointments.length,
            paid: appointments.filter(a => a.paymentStatus === 'approved').length,
            pending: appointments.filter(a => a.paymentStatus === 'pending' && a.paymentReceiptUrl).length,
            noReceipt: appointments.filter(a => !a.paymentReceiptUrl).length
        };
    }, [appointments]);

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Patient & Fee Management</h1>
                        <p className="text-muted-foreground">Monitor patient bookings and consultation fee submissions.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/doctor-portal">Back to Dashboard</Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs uppercase font-bold tracking-wider">Total Bookings</CardDescription>
                            <CardTitle className="text-2xl">{stats.total}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs uppercase font-bold tracking-wider text-green-600">Fees Approved</CardDescription>
                            <CardTitle className="text-2xl text-green-600">{stats.paid}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs uppercase font-bold tracking-wider text-amber-600">Verification Pending</CardDescription>
                            <CardTitle className="text-2xl text-amber-600">{stats.pending}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs uppercase font-bold tracking-wider text-destructive">Receipt Awaited</CardDescription>
                            <CardTitle className="text-2xl text-destructive">{stats.noReceipt}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="border-b">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" /> Appointment Fee Status
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant={statusFilter === 'all' ? 'default' : 'outline'} 
                                    size="sm" 
                                    onClick={() => setStatusFilter('all')}
                                >All</Button>
                                <Button 
                                    variant={statusFilter === 'paid' ? 'default' : 'outline'} 
                                    size="sm" 
                                    onClick={() => setStatusFilter('paid')}
                                >Paid</Button>
                                <Button 
                                    variant={statusFilter === 'unpaid' ? 'default' : 'outline'} 
                                    size="sm" 
                                    onClick={() => setStatusFilter('unpaid')}
                                >Unpaid</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : filteredRecords.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Apt. Date</TableHead>
                                            <TableHead>Fee Amount</TableHead>
                                            <TableHead>Fee Status</TableHead>
                                            <TableHead>Receipt</TableHead>
                                            <TableHead className="text-right">Portal Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map((apt) => {
                                            const hasReceipt = !!apt.paymentReceiptUrl;
                                            const isApproved = apt.paymentStatus === 'approved';
                                            const isRejected = apt.paymentStatus === 'rejected';

                                            return (
                                                <TableRow key={apt.id}>
                                                    <TableCell>
                                                        <PatientNameCell patientId={apt.patientId} />
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {format(new Date(apt.appointmentDateTime), "MMM dd, yyyy")}
                                                        <p className="text-xs text-muted-foreground">{format(new Date(apt.appointmentDateTime), "p")}</p>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        PKR {apt.amount?.toLocaleString() || '1,500'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isApproved ? (
                                                            <Badge className="bg-green-100 text-green-800 border-green-200">
                                                                <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                                                            </Badge>
                                                        ) : isRejected ? (
                                                            <Badge variant="destructive">Rejected</Badge>
                                                        ) : hasReceipt ? (
                                                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                                                <Clock className="mr-1 h-3 w-3" /> Verifying
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="opacity-60">
                                                                <AlertCircle className="mr-1 h-3 w-3" /> Unpaid
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {hasReceipt ? (
                                                            <Button variant="ghost" size="sm" asChild className="h-8 text-primary">
                                                                <Link href={apt.paymentReceiptUrl!} target="_blank">
                                                                    View <ExternalLink className="ml-1 h-3 w-3" />
                                                                </Link>
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">None</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className="capitalize">{apt.status}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <Filter className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No patient records found matching the current filter.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
