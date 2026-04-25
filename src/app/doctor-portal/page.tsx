'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, MessageSquare, Loader2, Clock, History, Activity, ClipboardCheck, Settings2, ShieldCheck, Moon, ChevronLeft, ChevronRight, User, Bell, AlertCircle, CheckCircle2, Info, Popover as PopoverIcon } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, addDoc } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, startOfDay, addDays, isAfter, subDays, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { timeSlots } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const notesSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required."),
  prescription: z.string().min(10, "Prescription details are required."),
});
type NotesFormValues = z.infer<typeof notesSchema>;

const leaveRequestSchema = z.object({
  requestedDate: z.date({ required_error: "Please select a date for the audit." }),
  reason: z.string().min(5, "Please provide a professional reason."),
});
type LeaveFormValues = z.infer<typeof leaveRequestSchema>;

function AvailabilityDialog({ isOpen, onOpenChange, doctor }: { isOpen: boolean, onOpenChange: (open: boolean) => void, doctor: Doctor }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [disabledSlots, setDisabledSlots] = useState<string[]>(doctor.availability?.disabledSlots || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleSlot = (slot: string) => {
        setDisabledSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const doctorRef = doc(firestore, 'doctors', doctor.id);
        updateDocumentNonBlocking(doctorRef, {
            availability: { ...doctor.availability, disabledSlots: disabledSlots },
            updatedAt: new Date().toISOString()
        });
        toast({ title: "Clinical Hours Synced", description: "Your daily session slots have been updated." });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-headline">
                        <Settings2 className="h-5 world-5 text-primary" /> Session Slot Control
                    </DialogTitle>
                    <DialogDescription>
                        Manage individual clinical slots. Unchecked slots will be hidden from patients for booking.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-8 py-4">
                    <div className="space-y-6">
                        {Object.entries(timeSlots).map(([session, slots]) => (
                            <div key={session} className="p-4 rounded-xl bg-muted/20 border border-muted/50">
                                <h5 className="text-xs font-bold text-primary uppercase mb-4 flex items-center gap-2 tracking-widest">
                                    {session === 'morning' && <Clock className="h-3 w-3" />}
                                    {session === 'afternoon' && <Activity className="h-3 w-3" />}
                                    {session === 'evening' && <Moon className="h-3 w-3" />}
                                    {session} Block
                                </h5>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {slots.map(slot => (
                                        <div key={slot} className="flex items-center space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-all cursor-pointer">
                                            <Checkbox 
                                                id={`slot-${slot}`} 
                                                checked={!disabledSlots.includes(slot)} 
                                                onCheckedChange={() => handleToggleSlot(slot)}
                                            />
                                            <label htmlFor={`slot-${slot}`} className="text-xs font-bold cursor-pointer select-none">{slot}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="px-8">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LeaveRequestDialog({ isOpen, onOpenChange, defaultDate, doctorId }: { isOpen: boolean, onOpenChange: (open: boolean) => void, defaultDate: Date, doctorId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const form = useForm<LeaveFormValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: { 
            reason: '',
            requestedDate: defaultDate
        }
    });

    // Reset date if defaultDate changes and dialog is opened
    useEffect(() => {
        if (isOpen) {
            form.setValue('requestedDate', defaultDate);
        }
    }, [isOpen, defaultDate, form]);

    const onSubmit = (values: LeaveFormValues) => {
        if (!firestore) return;
        const colRef = collection(firestore, 'doctorUnavailabilityRequests');
        addDocumentNonBlocking(colRef, {
            doctorId,
            requestedDate: values.requestedDate.toISOString(),
            reason: values.reason,
            status: 'pending',
            requestedAt: new Date().toISOString(),
        });
        toast({ title: "Clinical Audit Logged", description: "Audit requested for " + format(values.requestedDate, "PPP") });
        onOpenChange(false);
        form.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] border-none shadow-2xl">
                <DialogHeader>
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <Moon className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center font-headline text-2xl">Absence Audit Request</DialogTitle>
                    <DialogDescription className="text-center">
                        Request a clinical pause for administrative review.
                    </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="requestedDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] uppercase font-bold tracking-widest opacity-60">Step 1: Pick a Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal h-12 rounded-xl",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Select audit date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => isSameDay(date, new Date()) || date < startOfDay(new Date())}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] uppercase font-bold tracking-widest opacity-60">Step 2: Justification</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Detail the clinical or personal nature of your unavailability..." rows={4} className="resize-none rounded-xl" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="p-3 bg-muted/30 rounded-lg text-[10px] text-muted-foreground italic leading-relaxed border border-dashed border-muted-foreground/20">
                            <Info className="h-3 w-3 inline mr-1 text-primary" /> 
                            Automated audit is restricted for same-day absences. For emergencies today, please contact Admin via the direct support chat.
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Log for Audit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
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
        toast({ title: "Consultation Logged", description: "Patient records have been archived." });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{view === 'details' ? 'Clinical Overview' : 'Archiving Session'}</DialogTitle>
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
                                <p className="text-muted-foreground">Mode</p>
                                <p className="font-medium capitalize">{appointment.appointmentType}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button className="w-full h-12 font-bold" asChild>
                                <Link href={`/consultation/${appointment.id}`}>
                                    <Video className="mr-2 h-4 w-4" /> Start Tele-Consultation
                                </Link>
                            </Button>
                            <Button variant="outline" className="w-full h-12 font-bold" onClick={() => setView('notes')}>
                                Document Findings
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
                                        <FormLabel className="text-xs font-bold uppercase opacity-60">Diagnosis</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Initial findings..." {...field} />
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
                                        <FormLabel className="text-xs font-bold uppercase opacity-60">Treatment Plan</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Prescription and clinical advice..." rows={5} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setView('details')}>Back</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting} className="px-8">
                                    {form.formState.isSubmitting ? "Syncing..." : "Archive Session"}
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
                    <p className="text-xs italic text-muted-foreground">{isDisabled ? "Off" : "Open"}</p>
                )}
            </div>
            {appointment ? (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10" onClick={() => onSelect(appointment)}>
                    View
                </Button>
            ) : (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-dashed">{isDisabled ? "Closed" : "Free"}</Badge>
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
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const chatSessionQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'adminDoctorChatSessions'), where('doctorId', '==', user.uid));
    }, [firestore, user]);
    const { data: chatSessions } = useCollection<any>(chatSessionQuery);

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'doctorUnavailabilityRequests'), where('doctorId', '==', user.uid));
    }, [firestore, user]);
    const { data: requests } = useCollection<any>(requestsQuery);

    const { todayAppointments, stats, masterSchedule, notifications, currentDayLeaveStatus } = useMemo(() => {
        if (!mounted || !appointments) return { 
            todayAppointments: [], 
            stats: { today: 0, pending: 0, revenue: 0 }, 
            masterSchedule: { morning: [], afternoon: [], evening: [] },
            notifications: [],
            currentDayLeaveStatus: null as 'pending' | 'approved' | null
        };
        
        const now = new Date();
        const yesterday = subDays(now, 1);

        const today = appointments.filter(apt => isSameDay(new Date(apt.appointmentDateTime), now));
        const pending = appointments.filter(apt => apt.status === 'scheduled').length;
        const revenue = appointments.filter(apt => apt.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);

        const activeRequest = requests?.find(r => isSameDay(new Date(r.requestedDate), viewDate));
        const leaveStatus = activeRequest?.status || null;

        const filterSlots = (times: string[]) => {
            return times.map(time => {
                const apt = appointments.find(a => {
                    const aptDate = new Date(a.appointmentDateTime);
                    const formattedAptTime = format(aptDate, "hh:mm a");
                    return isSameDay(aptDate, viewDate) && formattedAptTime === time && a.status !== 'cancelled';
                });
                const isSlotDisabled = userData?.availability?.disabledSlots?.includes(time) || false;
                return { time, appointment: apt, isDisabled: isSlotDisabled || leaveStatus === 'approved' };
            });
        };

        const alerts: any[] = [];
        appointments.filter(a => isAfter(new Date(a.createdAt), yesterday)).forEach(a => {
            alerts.push({ id: `apt-${a.id}`, msg: `New Patient: ${format(new Date(a.appointmentDateTime), "PP p")}`, icon: Clock, color: 'text-primary' });
        });
        chatSessions?.filter(s => s.lastMessageSenderRole === 'admin').forEach(s => {
            alerts.push({ id: `chat-${s.id}`, msg: "New Administrative Message.", icon: MessageSquare, color: 'text-blue-500', link: '/doctor-portal/chat' });
        });
        requests?.filter(r => r.status !== 'pending' && isAfter(new Date(r.processedAt || 0), yesterday)).forEach(r => {
            alerts.push({ id: `req-${r.id}`, msg: `Audit for ${format(new Date(r.requestedDate), "PP")} ${r.status}.`, icon: r.status === 'approved' ? CheckCircle2 : AlertCircle, color: r.status === 'approved' ? 'text-green-500' : 'text-destructive' });
        });

        return { 
            todayAppointments: today,
            stats: { today: today.length, pending: pending, revenue },
            masterSchedule: { morning: filterSlots(timeSlots.morning), afternoon: filterSlots(timeSlots.afternoon), evening: filterSlots(timeSlots.evening) },
            notifications: alerts,
            currentDayLeaveStatus: leaveStatus
        };
    }, [appointments, mounted, viewDate, userData, chatSessions, requests]);

    const handleSelectApt = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsConsultOpen(true);
    };

    if (!mounted || isUserLoading) return (
        <div className="flex-grow flex items-center justify-center bg-secondary/30">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );

    return (
        <main className="flex-grow bg-secondary/30 py-8">
            <div className="container mx-auto px-4 space-y-8">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Clinical Command Center</h1>
                        <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
                            <Activity className="h-4 world-4 text-primary" /> Monitoring operations for Dr. {userData?.firstName}.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
                        <Card className="p-3 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
                            <p className="text-[10px] font-bold uppercase opacity-80">Total Revenue</p>
                            <p className="text-2xl font-bold">PKR {stats.revenue.toLocaleString()}</p>
                        </Card>
                        <Card className="p-3 bg-background border-none shadow-sm">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Today's Patients</p>
                            <p className="text-2xl font-bold text-primary">{stats.today}</p>
                        </Card>
                        <Card className="p-3 bg-background border-none shadow-sm hidden sm:block">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Scheduled</p>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                        </Card>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="border-none shadow-xl bg-white">
                             <CardHeader className="pb-2 border-b">
                                <CardTitle className="text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-amber-500" /> Alerts & Logs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} className="p-3 rounded-xl bg-muted/20 border border-muted/50 text-[11px] flex gap-3 items-start animate-in fade-in slide-in-from-right-2">
                                        <n.icon className={cn("h-4 w-4 shrink-0 mt-0.5", n.color)} />
                                        <div className="flex-1">
                                            <p className="leading-tight font-medium text-slate-700">{n.msg}</p>
                                            {n.link && (
                                                <Button variant="link" asChild className="h-auto p-0 text-[10px] font-bold mt-1">
                                                    <Link href={n.link}>Resolve</Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-xs text-muted-foreground italic text-center py-6">No unread clinical logs.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl overflow-hidden bg-white">
                            <CardHeader className="bg-background pb-3 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tighter">
                                        <ClipboardCheck className="h-5 w-5 text-primary" /> Active Queue
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary">LIVE</Badge>
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
                                    <div className="p-16 text-center text-muted-foreground space-y-4">
                                        <CalendarIcon className="h-12 w-12 mx-auto opacity-10" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Queue Empty</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <Card className="border-none shadow-2xl relative bg-white">
                            <CardHeader className="border-b bg-muted/5 z-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl font-headline flex items-center gap-2">
                                            <Clock className="h-6 w-6 text-primary" /> Clinical Master Schedule
                                        </CardTitle>
                                        <CardDescription className="text-xs">Manage individual slot availability and audit log.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border shadow-sm">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setViewDate(addDays(viewDate, -1))}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="px-4 text-xs font-bold min-w-[110px] text-center">
                                                {format(viewDate, "MMM dd")}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setViewDate(addDays(viewDate, 1))}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 ml-2">
                                            {currentDayLeaveStatus === 'approved' ? (
                                                <Badge className="bg-green-100 text-green-800 border-green-200 h-10 px-4 gap-2 font-bold">
                                                    <CheckCircle2 className="h-4 w-4" /> Approved Leave
                                                </Badge>
                                            ) : currentDayLeaveStatus === 'pending' ? (
                                                <Badge variant="outline" className="text-amber-600 border-amber-600 h-10 px-4 gap-2 bg-amber-50 font-bold">
                                                    <Clock className="h-4 w-4" /> Audit Pending
                                                </Badge>
                                            ) : (
                                                <Button variant="outline" size="sm" className="h-10 gap-2 font-bold text-destructive hover:bg-red-50 border-destructive/20" onClick={() => setIsLeaveOpen(true)}>
                                                    <Moon className="h-4 w-4" /> Request Off
                                                </Button>
                                            )}
                                            
                                            <Button variant="outline" size="sm" className="h-10 gap-2 font-bold" onClick={() => setIsAvailabilityOpen(true)}>
                                                <Settings2 className="h-4 w-4" /> Availability
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 md:p-10">
                                {currentDayLeaveStatus === 'approved' && (
                                    <div className="absolute inset-x-0 bottom-0 top-[100px] z-20 bg-white/90 backdrop-blur-[4px] flex items-center justify-center rounded-b-2xl">
                                        <div className="bg-white p-10 rounded-3xl shadow-2xl border-2 text-center max-w-sm space-y-6 animate-in zoom-in-95">
                                            <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                                <ShieldCheck className="h-12 w-12" />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-2xl font-bold tracking-tight">Practice Closed</h4>
                                                <p className="text-muted-foreground text-sm leading-relaxed">Admin has approved your clinical pause for {format(viewDate, "PPP")}. No bookings possible.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="grid md:grid-cols-3 gap-10">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
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

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
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

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
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

                {user && (
                    <LeaveRequestDialog 
                        isOpen={isLeaveOpen} 
                        onOpenChange={setIsLeaveOpen} 
                        defaultDate={viewDate} 
                        doctorId={user.uid} 
                    />
                )}

                <div className="fixed bottom-8 right-8 z-[100] group">
                    <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Administrative Support
                    </div>
                    <Button 
                        asChild
                        className="h-16 w-16 rounded-full shadow-2xl hover:scale-110 transition-transform bg-slate-900 hover:bg-slate-800 border-2 border-white/20 p-0"
                        size="icon"
                    >
                        <Link href="/doctor-portal/chat" className="flex items-center justify-center">
                            <MessageSquare className="h-7 w-7 text-white" />
                        </Link>
                    </Button>
                </div>
            </div>
        </main>
    );
}
