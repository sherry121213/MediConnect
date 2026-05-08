
'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, MessageSquare, Loader2, Clock, History, Activity, ClipboardCheck, Settings2, ShieldCheck, Moon, ChevronLeft, ChevronRight, User, Bell, AlertCircle, Siren, DollarSign } from "lucide-react";
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
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, subDays, isBefore, isAfter } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { timeSlots } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";

// --- Helper Components ---

const AppointmentRow = ({ apt, onSelect, isMounted }: { apt: Appointment, onSelect: (a: Appointment) => void, isMounted: boolean }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !apt?.patientId) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt?.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = isMounted ? new Date().getTime() : 0;
    const startTime = appointmentDate.getTime();
    const endTime = startTime + (50 * 60 * 1000);
    const isLive = isMounted && now >= startTime && now < endTime;

    return (
        <div className={cn(
            "flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all border-b last:border-0 group cursor-pointer",
            isLive && "bg-primary/5 border-primary/20"
        )} onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tighter truncate">
                        <Clock className="h-2.5 w-2.5 shrink-0" /> {format(appointmentDate, "p")} • 50m
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isLive && (
                    <Badge className="bg-red-600 text-white animate-pulse text-[8px] h-4">LIVE NOW</Badge>
                )}
                <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("ml-2 shrink-0 text-[10px]", apt.status === 'completed' ? 'bg-green-100 text-green-800' : 'text-primary border-primary/20')}>
                    {apt.status === 'scheduled' ? (isLive ? 'Start Session' : 'Upcoming') : apt.status}
                </Badge>
            </div>
        </div>
    );
};

const ScheduleSlot = ({ time, appointment, onSelect, isDisabled, isMounted }: { time: string, appointment?: Appointment, onSelect: (a: Appointment) => void, isDisabled?: boolean, isMounted: boolean }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.patientId) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment?.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const isLive = useMemo(() => {
        if (!appointment || !isMounted) return false;
        const aptDate = new Date(appointment.appointmentDateTime);
        const now = new Date().getTime();
        const startTime = aptDate.getTime();
        const endTime = startTime + (50 * 60 * 1000);
        return now >= startTime && now < endTime;
    }, [appointment, isMounted]);

    const isExpired = useMemo(() => {
        if (!appointment || !isMounted) return false;
        const aptDate = new Date(appointment.appointmentDateTime);
        const now = new Date().getTime();
        const endTime = aptDate.getTime() + (50 * 60 * 1000);
        return now >= endTime && appointment.status === 'scheduled';
    }, [appointment, isMounted]);

    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border transition-all mb-2",
            appointment ? (
                isLive ? "bg-primary/10 border-primary shadow-md scale-[1.02]" : 
                isExpired ? "bg-destructive/5 border-destructive/20 opacity-70" :
                "bg-primary/5 border-primary/20 shadow-sm"
            ) : "bg-muted/20 border-transparent opacity-60",
            isDisabled && !appointment && "grayscale opacity-30"
        )}>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground w-14 sm:w-16 shrink-0">{time}</p>
                {appointment ? (
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </div>
                        <p className="text-xs sm:text-sm font-semibold truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    </div>
                ) : (
                    <p className="text-[10px] sm:text-xs italic text-muted-foreground truncate">{isDisabled ? "Off" : "Open"}</p>
                )}
            </div>
            {appointment ? (
                <div className="flex items-center gap-2">
                    {isExpired ? (
                        <Badge variant="destructive" className="text-[8px] h-5 font-bold uppercase tracking-tight">Missed</Badge>
                    ) : (
                        <Button 
                            size="sm" 
                            variant={isLive ? "default" : "ghost"} 
                            className={cn(
                                "h-7 px-2 sm:px-3 text-[10px] font-bold uppercase tracking-wider shrink-0",
                                isLive ? "bg-red-600 hover:bg-red-700 animate-pulse" : "hover:bg-primary/10"
                            )} 
                            onClick={() => onSelect(appointment)}
                        >
                            {isLive ? "Start Session" : "Manage"}
                        </Button>
                    )}
                </div>
            ) : (
                <Badge variant="outline" className="text-[9px] sm:text-[10px] font-bold text-muted-foreground border-dashed shrink-0">{isDisabled ? "Closed" : "Free"}</Badge>
            )}
        </div>
    );
};

// --- Consultation Dialog Helper ---
function ConsultationDialog({ isOpen, onOpenChange, appointment, isMounted }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null, isMounted: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.patientId) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment?.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const form = useForm({
        resolver: zodResolver(z.object({ diagnosis: z.string().min(3), prescription: z.string().min(10) })),
        defaultValues: { diagnosis: appointment?.diagnosis || '', prescription: appointment?.prescription || '' }
    });

    if (!appointment) return null;

    const onSubmit = (values: any) => {
        if (!firestore) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString() });
        toast({ title: "Consultation Logged", description: "Patient records have been archived." });
        onOpenChange(false);
    };

    const appointmentDate = new Date(appointment.appointmentDateTime);
    const now = isMounted ? new Date().getTime() : 0;
    const startTime = appointmentDate.getTime();
    const isTimeReached = isMounted && now >= startTime && now < (startTime + (50 * 60 * 1000)); 

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl w-[95vw] sm:w-full">
                <Tabs defaultValue="overview" className="w-full">
                    <div className="bg-slate-900 p-6 text-white">
                        <DialogTitle className="text-xl font-headline mb-4">Patient Management</DialogTitle>
                        <TabsList className="bg-white/10 border-none text-white w-full grid grid-cols-2">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="notes">Visit Log</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="p-4 sm:p-6">
                        <TabsContent value="overview" className="space-y-6">
                            <div className="flex items-center gap-4 p-4 border rounded-2xl bg-muted/20">
                                <Avatar className="h-12 w-12"><AvatarFallback>{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                                {patient && <div className="min-w-0"><p className="font-bold truncate">{patient.firstName} {patient.lastName}</p><p className="text-xs text-muted-foreground">{patient.email}</p></div>}
                            </div>
                            <div className="flex flex-col gap-3 pt-4">
                                {isTimeReached ? (
                                    <Button className="h-12 text-base font-bold shadow-lg bg-red-600 hover:bg-red-700 animate-pulse" asChild>
                                        <Link href={`/consultation/${appointment.id}`}><Video className="mr-2 h-5 w-5" /> Start Tele-Consultation</Link>
                                    </Button>
                                ) : (
                                    <Button className="h-12 text-base font-bold opacity-70 cursor-not-allowed w-full" disabled>Session Not Ready <Clock className="ml-2 h-4 w-4" /></Button>
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value="notes">
                            <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                    <FormItem><FormLabel>Diagnosis</FormLabel><FormControl><Input placeholder="Primary findings..." {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="prescription" render={({ field }) => (
                                    <FormItem><FormLabel>Treatment Plan</FormLabel><FormControl><Textarea placeholder="Prescriptions and advice..." rows={6} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" className="w-full h-12 text-base font-bold">Finalize & Archive</Button>
                            </form></Form>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function AvailabilityDialog({ isOpen, onOpenChange, doctor }: { isOpen: boolean, onOpenChange: (open: boolean) => void, doctor: Doctor }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [disabledSlots, setDisabledSlots] = useState<string[]>(doctor?.availability?.disabledSlots || []);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = async () => {
        if (!firestore || !doctor) return;
        setIsSaving(true);
        updateDocumentNonBlocking(doc(firestore, 'doctors', doctor.id), { availability: { ...doctor.availability, disabledSlots }, updatedAt: new Date().toISOString() });
        toast({ title: "Slots Synced" });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Clinical Hour Control</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                    {Object.entries(timeSlots).map(([session, slots]) => (
                        <div key={session} className="p-4 rounded-xl bg-muted/20">
                            <h5 className="text-xs font-bold uppercase mb-4 text-primary">{session} Block</h5>
                            <div className="grid grid-cols-2 gap-2">{slots.map(slot => (<div key={slot} className="flex items-center space-x-3 p-2 border rounded-lg bg-background"><Checkbox checked={!disabledSlots.includes(slot)} onCheckedChange={() => setDisabledSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])}/><span className="text-xs font-bold">{slot}</span></div>))}</div>
                        </div>
                    ))}
                </div>
                <Button onClick={handleSave} className="w-full" disabled={isSaving}>Save Changes</Button>
            </DialogContent>
        </Dialog>
    );
}

function LeaveRequestDialog({ isOpen, onOpenChange, defaultDate, doctorId }: { isOpen: boolean, onOpenChange: (open: boolean) => void, defaultDate: Date, doctorId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm({ 
        resolver: zodResolver(z.object({ reason: z.string().min(5), requestedDate: z.date() })), 
        defaultValues: { reason: '', requestedDate: defaultDate }
    });
    
    const onSubmit = (values: any) => {
        if (!firestore) return;
        addDocumentNonBlocking(collection(firestore, 'doctorUnavailabilityRequests'), { 
            doctorId, 
            requestedDate: values.requestedDate.toISOString(), 
            reason: values.reason, 
            status: 'pending', 
            requestedAt: new Date().toISOString() 
        });
        toast({ title: "Audit Logged" });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Absence Audit Request</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField 
                            control={form.control} 
                            name="requestedDate" 
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className="w-full">
                                                    {field.value ? format(field.value, "PPP") : "Select"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <DayPickerCalendar 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={field.onChange} 
                                                disabled={(d) => isBefore(d, addDays(new Date(), 1))} 
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </FormItem>
                            )}
                        />
                        <FormField 
                            control={form.control} 
                            name="reason" 
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Justification</FormLabel>
                                    <FormControl>
                                        <Textarea rows={4} {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full">Log for Audit</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page ---

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
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

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'doctorUnavailabilityRequests'), where('doctorId', '==', user.uid));
    }, [firestore, user]);
    const { data: requests } = useCollection<any>(requestsQuery);

    useEffect(() => {
        if (!mounted || !appointments || !firestore || !user) return;

        const checkMissedSessions = async () => {
            const now = new Date().getTime();
            const missedAppointments = appointments.filter(apt => {
                if (!apt || apt.status !== 'scheduled' || !apt.appointmentDateTime) return false;
                const endTime = new Date(apt.appointmentDateTime).getTime() + (50 * 60 * 1000);
                return now > endTime;
            });

            for (const apt of missedAppointments) {
                const aptRef = doc(firestore, 'appointments', apt.id);
                updateDocumentNonBlocking(aptRef, { status: 'expired', updatedAt: new Date().toISOString() });

                const auditRef = collection(firestore, 'missedSessionAudits');
                addDocumentNonBlocking(auditRef, {
                    appointmentId: apt.id,
                    doctorId: user.uid,
                    patientId: apt.patientId,
                    scheduledTime: apt.appointmentDateTime,
                    loggedAt: new Date().toISOString(),
                });

                toast({
                    variant: 'destructive',
                    title: "Session Expired",
                    description: `The 50-minute window for a session has passed. Admin has been notified.`,
                });
            }
        };

        const interval = setInterval(checkMissedSessions, 30000);
        checkMissedSessions();
        return () => clearInterval(interval);
    }, [appointments, mounted, firestore, user, toast]);

    const { todayAppointments, stats, masterSchedule, notifications, currentDayLeaveStatus } = useMemo(() => {
        if (!mounted || !appointments) return { 
            todayAppointments: [], 
            stats: { today: 0, pending: 0, todayRevenue: 0, totalRevenue: 0, totalConsults: 0 }, 
            masterSchedule: { morning: [], afternoon: [], evening: [] },
            notifications: [],
            currentDayLeaveStatus: null as string | null
        };
        
        const now = new Date();
        const yesterday = subDays(now, 1);

        const today = appointments.filter(apt => {
            if (!apt || !apt.appointmentDateTime) return false;
            const aptDate = new Date(apt.appointmentDateTime);
            const isToday = isSameDay(aptDate, now);
            const endTime = aptDate.getTime() + (50 * 60 * 1000);
            const isExpired = now.getTime() > endTime && apt.status === 'scheduled';
            return isToday && !isExpired && apt.status !== 'expired';
        });

        const pending = appointments.filter(apt => apt && apt.status === 'scheduled').length;
        const todayRev = today.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        const lifetimeRev = appointments.filter(a => a && a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        const totalCompleted = appointments.filter(a => a && a.status === 'completed').length;

        const activeRequest = requests?.find(r => r && r.requestedDate && isSameDay(new Date(r.requestedDate), viewDate));
        const leaveStatus = activeRequest?.status || null;

        const filterSlots = (times: string[]) => {
            return times.map(time => {
                const apt = appointments.find(a => {
                    if (!a || !a.appointmentDateTime) return false;
                    const aptDate = new Date(a.appointmentDateTime);
                    const formattedAptTime = format(aptDate, "hh:mm a");
                    return isSameDay(aptDate, viewDate) && formattedAptTime === time && a.status !== 'cancelled';
                });
                const isSlotDisabled = userData?.availability?.disabledSlots?.includes(time) || false;
                return { time, appointment: apt, isDisabled: isSlotDisabled || leaveStatus === 'approved' };
            });
        };

        const alerts: any[] = [];
        appointments.forEach(a => {
            if (!a || !a.appointmentDateTime || !a.createdAt) return;
            if (a.status === 'expired') {
                alerts.push({ id: `exp-${a.id}`, msg: `Audit: Session Expired (${format(new Date(a.appointmentDateTime), "p")})`, icon: AlertCircle, color: 'text-destructive' });
                return;
            }
            
            const isNew = isAfter(new Date(a.createdAt), yesterday);
            if (isNew && a.status === 'scheduled') {
                alerts.push({ id: `new-${a.id}`, msg: `New Appointment: ${format(new Date(a.appointmentDateTime), "PP p")}`, icon: Clock, color: 'text-primary' });
            }

            const aptDate = new Date(a.appointmentDateTime);
            const startTime = aptDate.getTime();
            const endTime = startTime + (50 * 60 * 1000);
            const currentTime = now.getTime();
            
            if (currentTime >= startTime && currentTime < endTime && a.status === 'scheduled') {
                alerts.unshift({ 
                    id: `reminder-${a.id}`, 
                    msg: "SESSION STARTED - JOIN NOW", 
                    icon: Siren, 
                    color: 'text-red-500 animate-pulse font-bold',
                    isReminder: true
                });
            }
        });

        return { 
            todayAppointments: today,
            stats: { today: today.length, pending: pending, todayRevenue: todayRev, totalRevenue: lifetimeRev, totalConsults: totalCompleted },
            masterSchedule: { morning: filterSlots(timeSlots.morning), afternoon: filterSlots(timeSlots.afternoon), evening: filterSlots(timeSlots.evening) },
            notifications: alerts,
            currentDayLeaveStatus: leaveStatus
        };
    }, [appointments, mounted, viewDate, userData, requests]);

    const handleSelectApt = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsConsultOpen(true);
    };

    if (!mounted || isUserLoading) return <div className="flex min-h-screen items-center justify-center bg-secondary/30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <main className="flex-grow bg-secondary/30 py-4 sm:py-8">
            <div className="container mx-auto px-4 space-y-6 sm:space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">Clinical Command Center</h1>
                        <p className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm mt-1">
                            <Activity className="h-4 w-4 text-primary" /> 50-Minute Hourly Protocol Active.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto">
                        <Card className="p-3 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase opacity-80">Today's Revenue</p>
                            <p className="text-lg sm:text-2xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p>
                        </Card>
                        <Card className="p-3 bg-background border-none shadow-sm">
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground">Today's Patients</p>
                            <p className="text-lg sm:text-2xl font-bold text-primary">{stats.today}</p>
                        </Card>
                        <div className="col-span-2 sm:col-span-1">
                            <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full h-full font-bold gap-2 border-2 border-primary/20 hover:bg-primary/5 shadow-sm">
                                        <DollarSign className="h-4 w-4 text-primary" /> Audit Summary
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[400px] border-none shadow-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-xl font-headline">
                                            <History className="h-5 w-5 text-primary" /> Lifetime Performance
                                        </DialogTitle>
                                        <DialogDescription>Overview of your archived clinical activity.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 gap-4 py-6">
                                        <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 space-y-1 text-center">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Total Earnings</p>
                                            <p className="text-3xl font-bold text-primary">PKR {stats.totalRevenue.toLocaleString()}</p>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 space-y-1 text-center">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Completed Visits</p>
                                            <p className="text-3xl font-bold">{stats.totalConsults}</p>
                                        </div>
                                    </div>
                                    <DialogFooter><Button variant="secondary" className="w-full h-12 font-bold" onClick={() => setIsAuditOpen(false)}>Close Summary</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="border-none shadow-xl bg-white">
                             <CardHeader className="pb-2 border-b">
                                <CardTitle className="text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-amber-500" /> Alerts & Logs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} className={cn(
                                        "p-3 rounded-xl border text-[11px] flex gap-3 items-start animate-in fade-in slide-in-from-right-2",
                                        n.isReminder ? "bg-red-50 border-red-200" : "bg-muted/20 border-muted/50"
                                    )}>
                                        <n.icon className={cn("h-4 w-4 shrink-0 mt-0.5", n.color)} />
                                        <div className="flex-1">
                                            <p className={cn("leading-tight font-medium", n.isReminder ? "text-red-700" : "text-slate-700")}>{n.msg}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-xs text-muted-foreground italic text-center py-6">No unread clinical logs.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl overflow-hidden bg-white">
                            <CardHeader className="bg-background pb-3 border-b px-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tighter">
                                        <ClipboardCheck className="h-5 w-5 text-primary" /> Today's Queue
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary">LIVE</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? (
                                    <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                                ) : todayAppointments.length > 0 ? (
                                    <div className="divide-y max-h-[400px] overflow-y-auto custom-scrollbar px-2 sm:px-0">
                                        {todayAppointments.map(apt => (
                                            <AppointmentRow key={apt.id} apt={apt} onSelect={handleSelectApt} isMounted={mounted} />
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
                        <Card className="border-none shadow-2xl relative bg-white overflow-hidden">
                            <CardHeader className="border-b bg-muted/5 z-10 p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg sm:text-xl font-headline flex items-center gap-2">
                                            <Clock className="h-6 w-6 text-primary" /> Hourly Schedule
                                        </CardTitle>
                                        <CardDescription className="text-[10px] sm:text-xs">Missed sessions are automatically logged and expired after 50 mins.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm w-full sm:w-auto justify-between sm:justify-start">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={() => setViewDate(addDays(viewDate, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                                            <div className="px-3 text-xs font-bold min-w-[80px] sm:min-w-[100px] text-center uppercase tracking-tighter">{format(viewDate, "MMM dd")}</div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg mr-1 sm:mr-2 shrink-0" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                            <div className="hidden sm:flex h-6 w-px bg-muted mx-1" />
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button variant="outline" size="sm" className="h-8 gap-1.5 font-bold px-2 sm:px-3 text-[10px]" onClick={() => setIsAvailabilityOpen(true)}><Settings2 className="h-3.5 w-3.5 text-primary" /> <span className="hidden xs:inline">Slots</span></Button>
                                                <Button size="sm" className="h-8 gap-1.5 font-bold px-2 sm:px-3 text-[10px]" onClick={() => setIsLeaveOpen(true)}><Moon className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Leave</span></Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-10">
                                {currentDayLeaveStatus === 'approved' && (
                                    <div className="absolute inset-x-0 bottom-0 top-[120px] sm:top-[100px] z-20 bg-white/90 backdrop-blur-[4px] flex items-center justify-center rounded-b-2xl">
                                        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl border-2 text-center max-w-[90%] sm:max-w-sm space-y-6">
                                            <div className="h-16 w-16 sm:h-20 sm:w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldCheck className="h-10 w-10 sm:h-12 sm:w-12" /></div>
                                            <h4 className="text-xl sm:text-2xl font-bold tracking-tight">Practice Closed</h4>
                                            <p className="text-sm text-muted-foreground leading-relaxed">Absence audit approved for this date.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-400" /> Morning</h3>
                                        <div className="space-y-1">{masterSchedule.morning.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted}/>))}</div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-400" /> Afternoon</h3>
                                        <div className="space-y-1">{masterSchedule.afternoon.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted}/>))}</div>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2"><Moon className="h-3.5 w-3.5 text-indigo-400" /> Evening</h3>
                                        <div className="space-y-1">{masterSchedule.evening.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted}/>))}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {selectedAppointment && <ConsultationDialog isOpen={isConsultOpen} onOpenChange={setIsConsultOpen} appointment={selectedAppointment} isMounted={mounted} />}
                {userData && <AvailabilityDialog isOpen={isAvailabilityOpen} onOpenChange={setIsAvailabilityOpen} doctor={userData as Doctor} />}
                {user && <LeaveRequestDialog isOpen={isLeaveOpen} onOpenChange={setIsLeaveOpen} defaultDate={viewDate} doctorId={user.uid} />}
            </div>
        </main>
    );
}
