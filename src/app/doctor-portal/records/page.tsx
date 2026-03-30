'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Filter } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isBefore, startOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const PatientCell = ({ patientId }: { patientId: string }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return <span>{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</span>;
};

export default function AppointmentRecordsPage() {
    const { user } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid),
            orderBy('appointmentDateTime', 'desc')
        );
    }, [firestore, user]);

    const { data: appointments, isLoading } = useCollection<Appointment>(appointmentsQuery);

    const filteredRecords = useMemo(() => {
        if (!appointments) return [];
        return appointments.filter(apt => {
            const isPast = isBefore(new Date(apt.appointmentDateTime), startOfDay(new Date()));
            if (!isPast) return false;

            if (dateFilter) {
                const aptDate = format(new Date(apt.appointmentDateTime), 'yyyy-MM-dd');
                const filterDate = format(dateFilter, 'yyyy-MM-dd');
                if (aptDate !== filterDate) return false;
            }

            return true;
        });
    }, [appointments, dateFilter]);

    const pageCount = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4">
                <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Appointment Records</h1>
                        <p className="text-muted-foreground">Historical logs of all your past consultations.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/doctor-portal">Back to Dashboard</Link>
                    </Button>
                </div>

                <Card className="mb-8">
                    <CardHeader className="pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search patient name..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFilter ? format(dateFilter, "PPP") : "Filter by date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dateFilter}
                                        onSelect={setDateFilter}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            <Button variant="ghost" onClick={() => { setDateFilter(undefined); setSearchTerm(''); }} className="w-fit">
                                Clear Filters
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : filteredRecords.length > 0 ? (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Diagnosis</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedRecords.map((apt) => (
                                            <TableRow key={apt.id}>
                                                <TableCell className="font-medium">
                                                    {format(new Date(apt.appointmentDateTime), "MMM dd, yyyy")}
                                                </TableCell>
                                                <TableCell>
                                                    <PatientCell patientId={apt.patientId} />
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate">
                                                    {apt.diagnosis || <span className="text-muted-foreground italic text-xs">No records</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={apt.status === 'completed' ? 'bg-green-100 text-green-800' : ''}>
                                                        {apt.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`/appointments/${apt.id}`}>
                                                            <FileText className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                <Filter className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>No historical records found for the selected criteria.</p>
                            </div>
                        )}

                        {pageCount > 1 && (
                            <div className="flex items-center justify-end space-x-2 py-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" /> Previous
                                </Button>
                                <span className="text-sm">Page {currentPage} of {pageCount}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
                                    disabled={currentPage === pageCount}
                                >
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}