'use client';

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText, Filter, List, Calendar as CalendarViewIcon, X, User, Clock, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isBefore, startOfDay, parse, startOfWeek, getDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { enUS } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const PatientCell = ({ patientId }: { patientId: string }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return <span>{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</span>;
};

function RecordDetailDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null }) {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    if (!appointment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <ClipboardCheck className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Historical Record</span>
                    </div>
                    <DialogTitle className="text-xl font-headline">Consultation Summary</DialogTitle>
                    <DialogDescription>
                        Details for the session on {format(new Date(appointment.appointmentDateTime), "PPP")}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...'}</p>
                            <p className="text-sm text-muted-foreground">{patient?.email || '...'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Time</p>
                            <p className="font-medium">{format(new Date(appointment.appointmentDateTime), "p")}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Type</p>
                            <p className="font-medium capitalize">{appointment.appointmentType}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-primary uppercase tracking-tighter mb-1">Diagnosis</h4>
                            <div className="p-3 rounded-md bg-muted/30 border text-sm min-h-[60px]">
                                {appointment.diagnosis || <span className="italic text-muted-foreground">No diagnosis recorded.</span>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-primary uppercase tracking-tighter mb-1">Prescription & Advice</h4>
                            <div className="p-3 rounded-md bg-muted/30 border text-sm min-h-[100px] whitespace-pre-wrap">
                                {appointment.prescription || <span className="italic text-muted-foreground">No prescription details available.</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between items-center gap-4">
                    <div className="text-[10px] text-muted-foreground italic">
                        Recorded on: {appointment.updatedAt ? format(new Date(appointment.updatedAt), "PP p") : 'N/A'}
                    </div>
                    <Button variant="outline" asChild>
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
    const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const itemsPerPage = 10;

    // Simplified query without orderBy to ensure no index blocks or permission errors
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
                // Only show past appointments
                const isPast = isBefore(new Date(apt.appointmentDateTime), startOfDay(new Date()));
                if (!isPast) return false;

                if (dateFilter) {
                    const aptDate = format(new Date(apt.appointmentDateTime), 'yyyy-MM-dd');
                    const filterDate = format(dateFilter, 'yyyy-MM-dd');
                    if (aptDate !== filterDate) return false;
                }

                return true; 
            })
            // Sort client-side to ensure query success without indices
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments, dateFilter]);

    const calendarEvents = useMemo(() => {
        return filteredRecords.map(apt => ({
            id: apt.id,
            title: `${apt.appointmentType}`,
            start: new Date(apt.appointmentDateTime),
            end: new Date(new Date(apt.appointmentDateTime).getTime() + 30 * 60000),
            resource: apt,
        }));
    }, [filteredRecords]);

    const handleSelectEvent = (event: any) => {
        setSelectedApt(event.resource);
        setIsDetailOpen(true);
    };

    const pageCount = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4">
                <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Historical Consultation Records</h1>
                        <p className="text-muted-foreground">Manage and review all your completed patient interactions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="border rounded-md p-1 bg-background flex">
                            <Button 
                                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="h-8"
                                onClick={() => setViewMode('calendar')}
                            >
                                <CalendarViewIcon className="mr-2 h-4 w-4" /> Calendar
                            </Button>
                            <Button 
                                variant={viewMode === 'table' ? 'default' : 'ghost'} 
                                size="sm" 
                                className="h-8"
                                onClick={() => setViewMode('table')}
                            >
                                <List className="mr-2 h-4 w-4" /> Table
                            </Button>
                        </div>
                        <Button variant="outline" asChild>
                            <Link href="/doctor-portal">Dashboard</Link>
                        </Button>
                    </div>
                </div>

                <Card className="mb-8">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Review records by patient..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal min-w-[200px]", !dateFilter && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFilter ? format(dateFilter, "PPP") : "Filter by date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <DayPickerCalendar
                                        mode="single"
                                        selected={dateFilter}
                                        onSelect={setDateFilter}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {(dateFilter || searchTerm) && (
                                <Button variant="ghost" onClick={() => { setDateFilter(undefined); setSearchTerm(''); }} size="sm">
                                    <X className="mr-2 h-4 w-4" /> Clear
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : filteredRecords.length > 0 ? (
                            viewMode === 'table' ? (
                                <div className="p-6">
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Patient</TableHead>
                                                    <TableHead>Diagnosis Summary</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedRecords.map((apt) => (
                                                    <TableRow key={apt.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleSelectEvent({ resource: apt })}>
                                                        <TableCell className="font-medium whitespace-nowrap">
                                                            {format(new Date(apt.appointmentDateTime), "MMM dd, yyyy")}
                                                            <p className="text-[10px] text-muted-foreground">{format(new Date(apt.appointmentDateTime), "p")}</p>
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
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleSelectEvent({ resource: apt }); }}>
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
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
                                            <span className="text-xs text-muted-foreground px-4">Page {currentPage} of {pageCount}</span>
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
                                </div>
                            ) : (
                                <div className="p-6 h-[700px]">
                                    <Calendar
                                        localizer={localizer}
                                        events={calendarEvents}
                                        startAccessor="start"
                                        endAccessor="end"
                                        style={{ height: '100%' }}
                                        views={[Views.MONTH, Views.WEEK, Views.DAY]}
                                        defaultView={Views.MONTH}
                                        onSelectEvent={handleSelectEvent}
                                        eventPropGetter={() => ({
                                            style: {
                                                backgroundColor: 'hsl(var(--primary))',
                                                borderRadius: '4px',
                                                opacity: 0.7,
                                                fontSize: '11px',
                                                border: 'none'
                                            }
                                        })}
                                    />
                                </div>
                            )
                        ) : (
                            <div className="text-center py-24 text-muted-foreground">
                                <Filter className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium">No historical records found</p>
                                <p className="text-sm">Adjust your filters or search criteria to see past appointments.</p>
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