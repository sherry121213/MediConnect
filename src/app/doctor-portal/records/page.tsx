'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, X, User, Clock, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isBefore, startOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const PatientCell = ({ patientId }: { patientId: string }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return <span className="font-medium">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</span>;
};

function RecordDetailDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null }) {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment || !appointment.patientId) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    if (!appointment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-t-[2rem] sm:rounded-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <ClipboardCheck className="h-5 w-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Historical Record</span>
                    </div>
                    <DialogTitle className="text-xl font-headline text-white">Consultation Summary</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Details for the session on {appointment.appointmentDateTime ? format(new Date(appointment.appointmentDateTime), "PPP") : 'Unknown Date'}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto bg-white p-6 space-y-6 overscroll-contain pb-24">
                    <div className="flex items-center gap-4 p-4 border rounded-2xl bg-muted/20">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-lg truncate">{patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...'}</p>
                            <p className="text-xs text-muted-foreground truncate">{patient?.email || '...'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Clock className="h-3 w-3" /> Time</p>
                            <p className="font-medium">{appointment.appointmentDateTime ? format(new Date(appointment.appointmentDateTime), "p") : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</p>
                            <p className="font-medium capitalize">{appointment.appointmentType}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Clinical Diagnosis</h4>
                            <div className="p-4 rounded-xl bg-muted/30 border text-sm min-h-[60px] italic text-slate-700 leading-relaxed">
                                {appointment.diagnosis || "No diagnosis recorded."}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Treatment & Advice</h4>
                            <div className="p-4 rounded-xl bg-muted/30 border text-sm min-h-[100px] whitespace-pre-wrap text-slate-700 leading-relaxed">
                                {appointment.prescription || "No prescription details available."}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t sm:justify-between items-center gap-4 shrink-0 mt-auto">
                    <div className="text-[9px] text-muted-foreground italic">
                        Last updated: {appointment.updatedAt ? format(new Date(appointment.updatedAt), "PP p") : 'N/A'}
                    </div>
                    <Button variant="outline" asChild size="sm" className="rounded-xl font-bold h-10 border-2">
                        <Link href={`/appointments/${appointment.id}`}>
                            View Full PDF <FileText className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AppointmentRecordsPage() {
    const { user } = useUserData();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const itemsPerPage = 10;

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
        return appointments
            .filter(apt => {
                if (!apt || !apt.appointmentDateTime) return false;
                
                const isPast = isBefore(new Date(apt.appointmentDateTime), startOfDay(new Date())) || apt.status === 'completed';
                if (!isPast) return false;

                if (dateFilter) {
                    const aptDate = format(new Date(apt.appointmentDateTime), 'yyyy-MM-dd');
                    const filterDate = format(dateFilter, 'yyyy-MM-dd');
                    if (aptDate !== filterDate) return false;
                }

                if (searchTerm && !apt.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }

                return true; 
            })
            .sort((a, b) => {
                if (!a || !b || !a.appointmentDateTime || !b.appointmentDateTime) return 0;
                return new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime();
            });
    }, [appointments, dateFilter, searchTerm]);

    const handleSelectRow = (apt: Appointment) => {
        setSelectedApt(apt);
        setIsDetailOpen(true);
    };

    const pageCount = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <main className="min-h-screen flex flex-col bg-secondary/30 py-8 overflow-x-hidden overflow-y-auto overscroll-none">
            <div className="container mx-auto px-4 flex-1 pb-20">
                <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Consultation History</h1>
                        <p className="text-muted-foreground mt-1">Review and manage records of all completed patient sessions.</p>
                    </div>
                    <Button variant="outline" asChild className="rounded-xl border-2 font-bold shadow-sm h-11 px-6 bg-white">
                        <Link href="/doctor-portal">Back to Dashboard</Link>
                    </Button>
                </div>

                <Card className="mb-8 border-none shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="pb-4 border-b bg-muted/5 p-6 sm:p-8">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by keywords..." 
                                    className="pl-9 h-11 border-2 rounded-xl bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-bold min-w-[200px] h-11 rounded-xl border-2 bg-white", !dateFilter && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {dateFilter ? format(dateFilter, "PPP") : "Filter by date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
                                    <DayPickerCalendar
                                        mode="single"
                                        selected={dateFilter}
                                        onSelect={setDateFilter}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {(dateFilter || searchTerm) && (
                                <Button variant="ghost" onClick={() => { setDateFilter(undefined); setSearchTerm(''); }} size="sm" className="font-bold text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive">
                                    <X className="mr-2 h-4 w-4" /> Clear Filters
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                        ) : filteredRecords.length > 0 ? (
                            <div className="p-0">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <Table>
                                        <TableHeader className="bg-muted/10">
                                            <TableRow>
                                                <TableHead className="py-5 pl-8 font-bold">Visit Date</TableHead>
                                                <TableHead className="font-bold">Patient</TableHead>
                                                <TableHead className="font-bold">Diagnosis</TableHead>
                                                <TableHead className="font-bold">Status</TableHead>
                                                <TableHead className="text-right pr-8 font-bold">Audit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedRecords.map((apt) => apt && apt.id && (
                                                <TableRow key={apt.id} className="hover:bg-primary/5 cursor-pointer transition-colors" onClick={() => handleSelectRow(apt)}>
                                                    <TableCell className="font-bold py-5 pl-8 whitespace-nowrap">
                                                        {apt.appointmentDateTime ? format(new Date(apt.appointmentDateTime), "MMM dd, yyyy") : 'Unknown Date'}
                                                        <p className="text-[10px] text-muted-foreground font-medium">{apt.appointmentDateTime ? format(new Date(apt.appointmentDateTime), "p") : ''}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">P</div>
                                                            {apt.patientId ? <PatientCell patientId={apt.patientId} /> : <span>Unknown</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground italic">
                                                        {apt.diagnosis || "No records logged"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("text-[9px] uppercase font-bold", apt.status === 'completed' ? 'bg-green-100 text-green-800' : '')}>
                                                            {apt.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-8">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary hover:text-white" onClick={(e) => { e.stopPropagation(); handleSelectRow(apt); }}>
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {pageCount > 1 && (
                                    <div className="flex items-center justify-end space-x-2 p-6 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl border-2 font-bold"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" /> Previous
                                        </Button>
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground px-4">Page {currentPage} of {pageCount}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl border-2 font-bold"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
                                            disabled={currentPage === pageCount}
                                        >
                                            Next <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-32 text-muted-foreground bg-white">
                                <FileText className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                <p className="text-lg font-bold text-slate-400">No historical records found</p>
                                <p className="text-xs mt-1">Adjust your filters to audit past consultations.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <RecordDetailDialog 
                isOpen={isDetailOpen} 
                onOpenChange={setIsDetailOpen} 
                appointment={selectedApt} 
            />
        </main>
    );
}
