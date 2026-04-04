'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, MessageSquare, Loader2, Users, Clock, History, MoreVertical } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale";

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

const notesSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required."),
  prescription: z.string().min(10, "Prescription details are required."),
});
type NotesFormValues = z.infer<typeof notesSchema>;

function ConsultationDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [view, setView] = useState<'details' | 'notes'>('details');
    
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const form = useForm<NotesFormValues>({
        resolver: zodResolver(notesSchema),
        defaultValues: { diagnosis: '', prescription: '' }
    });

    useEffect(() => {
        if (appointment) {
            form.reset({
                diagnosis: appointment.diagnosis || '',
                prescription: appointment.prescription || '',
            });
            setView('details');
        }
    }, [appointment, form]);

    if (!appointment) return null;

    const onSubmit = (values: NotesFormValues) => {
        if (!firestore) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed' });
        toast({ title: "Consultation Completed", description: "The records have been updated." });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{view === 'details' ? 'Appointment Details' : 'Complete Consultation'}</DialogTitle>
                    <DialogDescription>
                        Patient: {patient ? `${patient.firstName} ${patient.lastName}` : 'Loading...'}
                    </DialogDescription>
                </DialogHeader>
                
                {view === 'details' ? (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                            <Avatar className="h-12 w-12">
                                <AvatarFallback>{patient?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-lg">{patient?.firstName} {patient?.lastName}</p>
                                <p className="text-sm text-muted-foreground">{patient?.email}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Date & Time</p>
                                <p className="font-medium">{format(new Date(appointment.appointmentDateTime), "PPP p")}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Consultation Type</p>
                                <p className="font-medium capitalize">{appointment.appointmentType}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button className="w-full" asChild>
                                <Link href="https://meet.google.com" target="_blank">
                                    <Video className="mr-2 h-4 w-4" /> Join Video Call
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setView('notes')}>
                                Start Consultation Form
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="diagnosis"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Diagnosis</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Viral Infection" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="prescription"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prescription & Advice</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="e.g., Paracetamol 500mg, twice a day..." rows={5} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setView('details')}>Back</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? "Saving..." : "Complete & Close"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}

const AppointmentRow = ({ apt, onSelect }: { apt: Appointment, onSelect: (a: Appointment) => void }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors border-b last:border-0 group">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>{patient?.firstName?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-medium text-sm">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {format(new Date(apt.appointmentDateTime), "p")}
                    </p>
                </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onSelect(apt)}>
                Join
            </Button>
        </div>
    );
};

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    // simplified query to avoid potential permission/index issues
    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const filteredAppointments = useMemo(() => {
        if (!appointments) return [];
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        return appointments.filter(apt => {
            const date = new Date(apt.appointmentDateTime);
            return date >= start && date <= end;
        });
    }, [appointments, currentDate]);

    const todayAppointments = useMemo(() => {
        if (!appointments) return [];
        const today = new Date();
        return appointments.filter(apt => {
            const date = new Date(apt.appointmentDateTime);
            return isSameDay(date, today);
        });
    }, [appointments]);

    const calendarEvents = useMemo(() => {
        return filteredAppointments.map(apt => ({
            id: apt.id,
            title: `Apt: ${apt.appointmentType}`,
            start: new Date(apt.appointmentDateTime),
            end: new Date(new Date(apt.appointmentDateTime).getTime() + 30 * 60000), // 30 min duration
            resource: apt,
        }));
    }, [filteredAppointments]);

    const eventStyleGetter = (event: any) => {
        const type = (event.resource.appointmentType || '').toLowerCase();
        let backgroundColor = 'hsl(var(--primary))';
        if (type.includes('emergency')) backgroundColor = 'hsl(var(--destructive))';
        if (type.includes('follow')) backgroundColor = '#f59e0b';
        
        return {
            style: {
                backgroundColor,
                borderRadius: '6px',
                opacity: 0.8,
                color: 'white',
                border: 'none',
                display: 'block'
            }
        };
    };

    const handleSelectEvent = (event: any) => {
        setSelectedAppointment(event.resource);
        setIsDialogOpen(true);
    };

    const handleSelectToday = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsDialogOpen(true);
    };

    if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* Left Sidebar: Today's Focus */}
                    <div className="lg:w-1/4 space-y-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold font-headline">Welcome, Dr. {userData?.firstName}</h1>
                        </div>
                        
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" /> Today's Schedule
                                </CardTitle>
                                <CardDescription>{format(new Date(), "EEEE, MMMM do")}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? (
                                    <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                                ) : todayAppointments.length > 0 ? (
                                    <div className="divide-y max-h-[400px] overflow-y-auto">
                                        {todayAppointments.map(apt => (
                                            <AppointmentRow key={apt.id} apt={apt} onSelect={handleSelectToday} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <CalendarIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">No appointments scheduled for today.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-4">
                            <Button variant="outline" className="w-full justify-start h-12" asChild>
                                <Link href="/doctor-portal/records">
                                    <History className="mr-2 h-5 w-5" /> Appointment Records
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full justify-start h-12" asChild>
                                <Link href="/doctor-portal/patients">
                                    <Users className="mr-2 h-5 w-5" /> Manage Patients
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Right Content: The Big Calendar */}
                    <div className="flex-1">
                        <Card className="h-full min-h-[700px]">
                            <CardContent className="p-6 h-full">
                                <Calendar
                                    localizer={localizer}
                                    events={calendarEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    style={{ height: 'calc(100vh - 250px)', minHeight: '600px' }}
                                    views={[Views.MONTH, Views.WEEK, Views.DAY]}
                                    defaultView={Views.MONTH}
                                    onNavigate={date => setCurrentDate(date)}
                                    onSelectEvent={handleSelectEvent}
                                    eventPropGetter={eventStyleGetter}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <ConsultationDialog 
                    isOpen={isDialogOpen} 
                    onOpenChange={setIsDialogOpen} 
                    appointment={selectedAppointment} 
                />
            </div>
        </main>
    )
}
