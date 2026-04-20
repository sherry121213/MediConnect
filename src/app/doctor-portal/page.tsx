'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, MessageSquare, Loader2, Users, Clock, History, ListFilter, Activity, ClipboardCheck, TrendingUp, DollarSign, PieChart as PieChartIcon, ArrowRight, CheckCircle2, User, ChevronLeft, ChevronRight, Settings2, ShieldCheck, Moon } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, subDays, startOfDay, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { timeSlots } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";

const notesSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required."),
  prescription: z.string().min(10, "Prescription details are required."),
});
type NotesFormValues = z.infer<typeof notesSchema>;

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function AvailabilityDialog({ isOpen, onOpenChange, doctor }: { isOpen: boolean, onOpenChange: (open: boolean) => void, doctor: Doctor }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    // Default to all days active if not set
    const [selectedDays, setSelectedDays] = useState<string[]>(doctor.availability?.days || DAYS_OF_WEEK);
    const [disabledSlots, setDisabledSlots] = useState<string[]>(doctor.availability?.disabledSlots || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleDay = (day: string) => {
        setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const handleToggleSlot = (slot: string) => {
        setDisabledSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const doctorRef = doc(firestore, 'doctors', doctor.id);
        updateDocumentNonBlocking(doctorRef, {
            availability: { days: selectedDays, disabledSlots: disabledSlots },
            updatedAt: new Date().toISOString()
        });
        toast({ title: "Availability Updated", description: "Your clinical hours have been synchronized." });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" /> Practice Availability
                    </DialogTitle>
                    <DialogDescription>
                        Control your working days and individual time-slot availability. Unchecked items will be hidden from patients.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-8 py-4">
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Working Days</h4>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map(day => (
                                <Button 
                                    key={day} 
                                    variant={selectedDays.includes(day) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleToggleDay(day)}
                                    className="w-12 h-12 rounded-full p-0 font-bold"
                                >
                                    {day}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Manage Clinical Slots</h4>
                        <p className="text-xs text-muted-foreground italic">Uncheck slots where you are unavailable for consultations.</p>
                        
                        {Object.entries(timeSlots).map(([session, slots]) => (
                            <div key={session}>
                                <h5 className="text-xs font-bold text-primary uppercase mb-3 flex items-center gap-2">
                                    {session === 'morning' && <Clock className="h-3 w-3" />}
                                    {session === 'afternoon' && <Activity className="h-3 w-3" />}
                                    {session === 'evening' && <Moon className="h-3 w-3" />}
                                    {session} Session
                                </h5>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {slots.map(slot => (
                                        <div key={slot} className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50 transition-colors">
                                            <Checkbox 
                                                id={`slot-${slot}`} 
                                                checked={!disabledSlots.includes(slot)} 
                                                onCheckedChange={() => handleToggleSlot(slot)}
                                            />
                                            <label htmlFor={`slot-${slot}`} className="text-xs font-medium cursor-pointer">{slot}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString() });
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
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all border-b last:border-0 group cursor-pointer" onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-bold text-sm">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tighter">
                        <Clock className="h-2.5 w-2.5" /> {format(new Date(apt.appointmentDateTime), "p")} • {apt.appointmentType}
                    </p>
                </div>
            </div>
            <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={apt.status === 'completed' ? 'bg-green-100 text-green-800' : 'text-primary border-primary/20'}>
                {apt.status === 'scheduled' ? 'Upcoming' : apt.status}
            </Badge>
        </div>
    );
};

const ScheduleSlot = ({ time, appointment, onSelect, isDisabled }: { time: string, appointment?: Appointment, onSelect: (a: Appointment) => void, isDisabled?: boolean }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border transition-all mb-2",
            appointment ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-muted/20 border-transparent opacity-60",
            isDisabled && !appointment && "grayscale opacity-30"
        )}>
            <div className="flex items-center gap-4">
                <p className="text-xs font-bold text-muted-foreground w-16">{time}</p>
                {appointment ? (
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="h-3 w-3" />
                        </div>
                        <p className="text-sm font-semibold">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    </div>
                ) : (
                    <p className="text-xs italic text-muted-foreground">{isDisabled ? "Practice Closed" : "Available Slot"}</p>
                )}
            </div>
            {appointment ? (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase tracking-wider" onClick={() => onSelect(appointment)}>
                    View Session
                </Button>
            ) : (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">{isDisabled ? "Off" : "Free"}</Badge>
            )}
        </div>
    );
}

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { todayAppointments, stats, recentEvents, masterSchedule } = useMemo(() => {
        if (!mounted || !appointments) return { 
            todayAppointments: [], 
            stats: { today: 0, pending: 0, revenue: 0 }, 
            recentEvents: [],
            masterSchedule: { morning: [], afternoon: [], evening: [] }
        };
        
        const now = new Date();
        const today = appointments.filter(apt => isSameDay(new Date(apt.appointmentDateTime), now));
        const pending = appointments.filter(apt => apt.status === 'scheduled').length;
        const revenue = appointments.filter(apt => apt.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);

        const filterSlots = (times: string[]) => {
            return times.map(time => {
                const apt = appointments.find(a => {
                    const aptDate = new Date(a.appointmentDateTime);
                    const formattedAptTime = format(aptDate, "hh:mm a");
                    return isSameDay(aptDate, viewDate) && formattedAptTime === time && a.status !== 'cancelled';
                });
                
                const dayOfWeek = format(viewDate, "E");
                const isDayDisabled = userData?.availability?.days ? !userData.availability.days.includes(dayOfWeek) : false;
                const isSlotDisabled = userData?.availability?.disabledSlots?.includes(time) || false;

                return { 
                    time, 
                    appointment: apt,
                    isDisabled: isDayDisabled || isSlotDisabled
                };
            });
        };

        const events = appointments.slice(0, 5).map(apt => ({
            id: apt.id,
            msg: apt.status === 'completed' ? `Record finalized for patient ${apt.patientId.slice(0,4)}` : `New booking request: ${apt.appointmentType}`,
            time: format(new Date(apt.createdAt), "p"),
            type: apt.status
        }));

        return { 
            todayAppointments: today,
            stats: { today: today.length, pending: pending, revenue },
            recentEvents: events,
            masterSchedule: {
                morning: filterSlots(timeSlots.morning),
                afternoon: filterSlots(timeSlots.afternoon),
                evening: filterSlots(timeSlots.evening)
            }
        };
    }, [appointments, mounted, viewDate, userData]);

    const handleSelectApt = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsConsultOpen(true);
    };

    if (!mounted || isUserLoading) return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </main>
            <AppFooter />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-8">
                <div className="container mx-auto px-4 space-y-8">
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Clinical Command Center</h1>
                            <div className="flex items-center gap-4 mt-1">
                                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                                    <Activity className="h-4 w-4 text-primary" /> Monitoring clinical operations for Dr. {userData?.firstName}.
                                </p>
                                <Button variant="outline" size="sm" className="h-8 gap-2 font-bold" onClick={() => setIsAvailabilityOpen(true)}>
                                    <Settings2 className="h-3.5 w-3.5" /> Practice Settings
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
                            <Card className="p-3 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
                                <p className="text-[10px] font-bold uppercase opacity-80">Practice Revenue</p>
                                <p className="text-2xl font-bold">PKR {stats.revenue.toLocaleString()}</p>
                            </Card>
                            <Card className="p-3 bg-background border-none shadow-sm">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Patients Today</p>
                                <p className="text-2xl font-bold text-primary">{stats.today}</p>
                            </Card>
                            <Card className="p-3 bg-background border-none shadow-sm hidden sm:block">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Pending Records</p>
                                <p className="text-2xl font-bold">{stats.pending}</p>
                            </Card>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-none shadow-xl overflow-hidden">
                                <CardHeader className="bg-background pb-3 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ClipboardCheck className="h-5 w-5 text-primary" /> Today's Live Queue
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[10px] font-bold">{format(new Date(), "MMM dd")}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {isLoadingAppointments ? (
                                        <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                                    ) : todayAppointments.length > 0 ? (
                                        <div className="divide-y max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {todayAppointments.map(apt => (
                                                <AppointmentRow key={apt.id} apt={apt} onSelect={handleSelectApt} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-muted-foreground space-y-2">
                                            <CalendarIcon className="h-10 w-10 mx-auto opacity-20" />
                                            <p className="text-sm font-medium">No sessions for today.</p>
                                            <Button variant="link" size="sm" asChild>
                                                <Link href="/doctor-portal/records">View Past Records</Link>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" /> Clinical Event Log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {recentEvents.length > 0 ? recentEvents.map(ev => (
                                        <div key={ev.id} className="flex items-start gap-3 text-xs">
                                            <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${ev.type === 'completed' ? 'bg-green-500' : 'bg-primary'}`} />
                                            <div className="flex-1">
                                                <p className="font-medium text-foreground">{ev.msg}</p>
                                                <p className="text-[10px] text-muted-foreground">{ev.time}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-muted-foreground italic text-center py-4">No recent activity detected.</p>
                                    )}
                                </CardContent>
                                <div className="p-4 bg-muted/20 border-t">
                                    <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-primary gap-2" asChild>
                                        <Link href="/doctor-portal/records">
                                            <History className="h-3.5 w-3.5" /> Full Audit History
                                        </Link>
                                    </Button>
                                </div>
                            </Card>
                        </div>

                        <div className="lg:col-span-8 space-y-6">
                            <Card className="border-none shadow-2xl">
                                <CardHeader className="border-b bg-background">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-xl font-headline flex items-center gap-2">
                                                <Clock className="h-6 w-6 text-primary" /> Clinical Master Schedule
                                            </CardTitle>
                                            <CardDescription className="text-sm">Granular time-slot availability and booking status.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, -1))}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="px-4 text-sm font-bold min-w-[140px] text-center">
                                                {format(viewDate, "EEE, MMM dd")}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, 1))}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 md:p-8">
                                    <div className="grid md:grid-cols-3 gap-8">
                                        {/* Morning Block */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-amber-400" /> Morning
                                            </h3>
                                            <div className="space-y-1">
                                                {masterSchedule.morning.map((slot, idx) => (
                                                    <ScheduleSlot 
                                                        key={idx} 
                                                        time={slot.time} 
                                                        appointment={slot.appointment} 
                                                        onSelect={handleSelectApt} 
                                                        isDisabled={slot.isDisabled}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Afternoon Block */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-400" /> Afternoon
                                            </h3>
                                            <div className="space-y-1">
                                                {masterSchedule.afternoon.map((slot, idx) => (
                                                    <ScheduleSlot 
                                                        key={idx} 
                                                        time={slot.time} 
                                                        appointment={slot.appointment} 
                                                        onSelect={handleSelectApt} 
                                                        isDisabled={slot.isDisabled}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Evening Block */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                                <Moon className="h-3.5 w-3.5 text-indigo-400" /> Evening
                                            </h3>
                                            <div className="space-y-1">
                                                {masterSchedule.evening.map((slot, idx) => (
                                                    <ScheduleSlot 
                                                        key={idx} 
                                                        time={slot.time} 
                                                        appointment={slot.appointment} 
                                                        onSelect={handleSelectApt} 
                                                        isDisabled={slot.isDisabled}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded bg-primary/20 border border-primary/20" /> Booked
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded bg-muted/20 border border-transparent" /> Available
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded bg-muted opacity-30 border border-transparent" /> Practice Closed
                                            </div>
                                        </div>
                                        <p className="italic">Time zone: GMT+5 (Pakistan Standard Time)</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <ConsultationDialog 
                        isOpen={isConsultOpen} 
                        onOpenChange={setIsConsultOpen} 
                        appointment={selectedAppointment} 
                    />

                    {userData && (
                        <AvailabilityDialog 
                            isOpen={isAvailabilityOpen} 
                            onOpenChange={setIsAvailabilityOpen} 
                            doctor={userData as Doctor} 
                        />
                    )}
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
