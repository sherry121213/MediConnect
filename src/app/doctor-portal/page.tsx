'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, Loader2, Clock, History, Activity, ClipboardCheck, Settings2, ShieldCheck, Moon, ChevronLeft, ChevronRight, User, Bell, AlertCircle, Siren, Trash2, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, subDays, isBefore, isAfter, isValid, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { timeSlots } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";

function PatientHistoryTab({ patientId }: { patientId: string }) {
    const firestore = useFirestore();
    const historyQuery = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return query(
            collection(firestore, 'appointments'),
            where('patientId', '==', patientId),
            where('status', '==', 'completed')
        );
    }, [firestore, patientId]);

    const { data: pastApts, isLoading } = useCollection<Appointment>(historyQuery);

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-4 pr-2 pb-20">
            {pastApts && pastApts.length > 0 ? (
                pastApts.filter(a => a && a.appointmentDateTime).sort((a,b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime()).map(apt => (
                    <div key={apt.id} className="p-4 border-2 rounded-2xl bg-muted/5 space-y-2">
                        <div className="flex justify-between items-start">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{format(new Date(apt.appointmentDateTime), "PPP")}</p>
                            <Badge variant="outline" className="text-[10px] font-bold px-2.5 py-0.5 h-auto">Performed</Badge>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">Diagnosis:</p>
                            <p className="text-xs text-muted-foreground italic">{apt.diagnosis}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">Advice:</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{apt.prescription}</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 text-muted-foreground italic">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No Prior Records Found</p>
                </div>
            )}
        </div>
    );
}

function InternalPostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (o: boolean) => void, appointment: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const availableDates = getNext7Days();

    const handleConfirm = async () => {
        if (!firestore || !appointment || !selectedTime) return;
        setIsSaving(true);

        const newDateTime = new Date(selectedDate);
        const [hours, minutesPart] = selectedTime.split(':');
        const [minutes, ampm] = minutesPart.split(' ');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        newDateTime.setHours(numericHours, parseInt(minutes), 0, 0);

        updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), {
            appointmentDateTime: newDateTime.toISOString(),
            status: 'scheduled', 
            updatedAt: new Date().toISOString(),
            doctorInRoom: false
        });

        toast({ title: "Session Rescheduled", description: `Appointment moved to ${format(newDateTime, "PPP p")}.` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 max-h-[95dvh] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">Clinical Rescheduling</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1 font-medium">Pick a new 30-minute clinical window.</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain">
                    <div className="p-6 sm:p-8 space-y-10 pb-32">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Step 1: Pick Clinical Date</p>
                            <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
                                {availableDates.map(day => (
                                    <button 
                                        key={day.date.toISOString()}
                                        onClick={() => setSelectedDate(day.date)}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 transition-all shrink-0 w-28 text-center flex flex-col items-center justify-center gap-1",
                                            isSameDay(selectedDate, day.date) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background hover:bg-muted border-slate-100'
                                        )}
                                    >
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">{day.dayName}</p>
                                        <p className="text-xl font-bold font-headline text-slate-900">{format(day.date, "dd")}</p>
                                        <p className="text-[10px] text-muted-foreground">{format(day.date, "MMM")}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-10">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 2: Professional Time Slots</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[...timeSlots.morning, ...timeSlots.afternoon, ...timeSlots.evening].map(time => (
                                    <Button 
                                        key={time}
                                        variant={selectedTime === time ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedTime(time)}
                                        className={cn(
                                            "rounded-xl text-[10px] font-bold h-12 border-2",
                                            selectedTime === time ? "bg-primary border-primary text-white" : "border-slate-100 hover:border-primary/30"
                                        )}
                                    >
                                        {time}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 sm:p-8 border-t bg-slate-50 shrink-0 mt-auto">
                    <div className="flex gap-4">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-bold shadow-2xl shadow-primary/20 bg-slate-900 hover:bg-slate-800 text-white" disabled={!selectedTime || isSaving} onClick={handleConfirm}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Changes"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const AppointmentRow = ({ apt, onSelect, isMounted }: { apt: Appointment, onSelect: (a: Appointment) => void, isMounted: boolean }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !apt?.patientId) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt?.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    const startTime = appointmentDate.getTime() - (10 * 60 * 1000); 
    const endTime = appointmentDate.getTime() + (30 * 60 * 1000); 
    const isLive = isMounted && now >= startTime && now < endTime && apt.status === 'scheduled';

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
                        <Clock className="h-2.5 w-2.5 shrink-0" /> {format(appointmentDate, "p")} • 30m
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {isLive && <Badge className="bg-red-600 text-white animate-pulse text-[9px] px-2 font-bold h-auto py-1">LIVE NOW</Badge>}
                <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("shrink-0 text-[10px] px-2.5 py-1 h-auto font-bold", apt.status === 'completed' ? "bg-green-100 text-green-800" : "text-primary border-primary/20")}>
                    {apt.status === 'scheduled' ? (isLive ? 'Start' : 'Upcoming') : apt.status === 'completed' ? 'Performed' : apt.status}
                </Badge>
            </div>
        </div>
    );
};

const ScheduleSlot = ({ time, appointment, onSelect, isDisabled, isMounted, viewDate }: { time: string, appointment?: Appointment, onSelect: (a: Appointment) => void, isDisabled?: boolean, isMounted: boolean, viewDate: Date }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.patientId) return null;
        return doc(firestore, 'patients', appointment.patientId);
    }, [firestore, appointment?.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    const isPast = useMemo(() => {
        if (!isMounted) return false;
        const now = new Date();
        if (isBefore(viewDate, startOfDay(now))) return true;
        if (!isSameDay(viewDate, now)) return false;
        
        const [timePart, ampm] = time.split(' ');
        const [hours, minutes] = timePart.split(':');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        
        const slotDate = new Date(viewDate);
        slotDate.setHours(numericHours, parseInt(minutes), 0, 0);
        return slotDate < now;
    }, [time, viewDate, isMounted]);

    const isLive = useMemo(() => {
        if (!appointment || !isMounted || appointment.status !== 'scheduled') return false;
        const aptDate = new Date(appointment.appointmentDateTime);
        const now = Date.now();
        const startTime = aptDate.getTime() - (10 * 60 * 1000);
        const endTime = aptDate.getTime() + (30 * 60 * 1000);
        return now >= startTime && now < endTime;
    }, [appointment, isMounted]);

    const isExpired = useMemo(() => {
        if (!appointment || !isMounted) return false;
        const aptDate = new Date(appointment.appointmentDateTime);
        const now = Date.now();
        const endTime = aptDate.getTime() + (30 * 60 * 1000);
        return now >= endTime && appointment.status === 'scheduled';
    }, [appointment, isMounted]);

    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border transition-all mb-2",
            appointment ? (
                appointment.status === 'completed' ? "bg-green-50 border-green-200" :
                isLive ? "bg-primary/10 border-primary shadow-md scale-[1.02]" : 
                isExpired ? "bg-destructive/5 border-destructive/20 opacity-70" :
                "bg-primary/5 border-primary/20 shadow-sm"
            ) : isPast ? "bg-slate-50 border-slate-100 opacity-50" : "bg-muted/20 border-transparent opacity-60",
            isDisabled && !appointment && "bg-destructive/5 border-destructive/10"
        )}>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground w-20 shrink-0">{time}</p>
                {appointment ? (
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={cn("h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shrink-0", appointment.status === 'completed' ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary")}>
                            <User className="h-3 w-3" />
                        </div>
                        <p className={cn("text-xs sm:text-sm font-semibold truncate", appointment.status === 'completed' && "text-green-800")}>
                            {patient ? `${patient.firstName} ${patient.lastName}` : '...'}
                        </p>
                    </div>
                ) : (
                    <p className={cn(
                        "text-[10px] sm:text-xs italic font-medium truncate",
                        isDisabled ? "text-destructive" : isPast ? "text-slate-400" : "text-muted-foreground"
                    )}>
                        {isDisabled ? "Unavailable" : isPast ? "Closed" : "Open Slot"}
                    </p>
                )}
            </div>
            {appointment && (
                <div className="flex items-center gap-2">
                    {appointment.status === 'completed' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-[9px] px-2.5 py-1 font-bold uppercase tracking-tight shrink-0 h-auto">Performed</Badge>
                    ) : isExpired ? (
                        <Badge variant="destructive" className="text-[9px] px-2.5 py-1 font-bold uppercase tracking-tight shrink-0 h-auto">Expired</Badge>
                    ) : (
                        <Button 
                            size="sm" 
                            variant={isLive ? "default" : "ghost"} 
                            className={cn(
                                "h-8 px-3 text-[10px] font-bold uppercase tracking-wider shrink-0 rounded-lg",
                                isLive ? "bg-red-600 hover:bg-red-700 animate-pulse text-white" : "hover:bg-primary/10"
                            )} 
                            onClick={() => onSelect(appointment)}
                        >
                            {isLive ? "Start" : "Manage"}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

function ConsultationDialog({ isOpen, onOpenChange, appointment, isMounted, onPostpone }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null, isMounted: boolean, onPostpone: (a: any) => void }) {
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

    const isCompleted = appointment.status === 'completed';

    const onSubmit = (values: any) => {
        if (!firestore || isCompleted) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString(), doctorInRoom: false });
        toast({ title: "Consultation Logged", description: "Patient records have been archived." });
        onOpenChange(false);
    };

    const appointmentDate = new Date(appointment.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    const startTime = appointmentDate.getTime() - (10 * 60 * 1000); 
    const endTime = appointmentDate.getTime() + (30 * 60 * 1000); 
    const isLive = isMounted && now >= startTime && now < endTime && appointment.status === 'scheduled';
    const isExpired = isMounted && now >= endTime && appointment.status === 'scheduled';

    const handleStartRoom = () => {
        onOpenChange(false);
        window.location.assign(`/consultation/${appointment.id}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl w-[95vw] sm:w-full rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[95dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                        <DialogTitle className="text-2xl font-headline mb-6 text-white">Patient Management</DialogTitle>
                        <TabsList className="bg-white/10 border-none text-white w-full grid grid-cols-3 h-12 p-1 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Overview</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">History</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Clinical Notes</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                        <div className="p-6 sm:p-10 pb-32">
                            <TabsContent value="overview" className="space-y-8 m-0">
                                <div className="flex items-center gap-6 p-6 border-2 rounded-[2rem] bg-muted/20">
                                    <Avatar className="h-16 w-16 shadow-lg border-2 border-white"><AvatarFallback className="bg-primary text-white font-bold text-lg">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                                    {patient && <div className="min-w-0"><p className="font-bold text-xl truncate text-slate-900">{patient.firstName} {patient.lastName}</p><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{patient.email}</p></div>}
                                </div>
                                <div className="flex flex-col gap-4 pt-4">
                                    {isCompleted ? (
                                        <div className="p-8 bg-green-50 border-2 border-green-100 rounded-3xl text-center space-y-3">
                                            <ShieldCheck className="h-12 w-12 text-green-600 mx-auto" />
                                            <div className="space-y-1">
                                                <p className="font-bold text-xl text-green-800">Session Performed</p>
                                                <p className="text-xs text-green-600 font-medium italic">Clinical record secured and archived.</p>
                                            </div>
                                        </div>
                                    ) : isLive ? (
                                        <>
                                            <Button onClick={handleStartRoom} className="h-16 text-lg font-bold shadow-2xl shadow-red-500/20 bg-red-600 hover:bg-red-700 animate-pulse rounded-2xl text-white">
                                                <Video className="mr-3 h-6 w-6" /> Start Video Room
                                            </Button>
                                            <Button variant="outline" className="h-14 text-sm font-bold w-full rounded-2xl gap-3 border-2" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-4 w-4 text-primary" /> Postpone Session
                                            </Button>
                                        </>
                                    ) : isExpired ? (
                                        <div className="space-y-6">
                                            <div className="p-8 bg-red-50 border-2 border-red-100 rounded-3xl text-center space-y-3">
                                                <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                                                <div className="space-y-1">
                                                    <p className="font-bold text-xl text-red-800">30m Session Expired</p>
                                                    <p className="text-xs text-green-600 font-medium italic">Clinical window has concluded automatically.</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" className="h-16 text-lg font-bold w-full rounded-2xl gap-3 border-2 hover:bg-primary/5 transition-all" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-5 w-5 text-primary" /> Reschedule Session
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <Button className="h-16 text-lg font-bold opacity-70 cursor-not-allowed w-full rounded-2xl bg-slate-100 text-slate-500" disabled>30m Window Locked <Clock className="ml-3 h-6 w-6" /></Button>
                                            <Button variant="outline" className="h-16 text-lg font-bold w-full rounded-2xl gap-3 border-2 hover:bg-primary/5 transition-all" onClick={() => onPostpone(appointment)}>
                                                <RefreshCw className="h-5 w-5 text-primary" /> Postpone Session
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="history" className="m-0">
                                <PatientHistoryTab patientId={appointment.patientId} />
                            </TabsContent>
                            <TabsContent value="notes" className="m-0">
                                <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                        <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Clinical Findings</FormLabel><FormControl><Input placeholder="Summary of primary diagnosis..." className="h-14 border-2 rounded-2xl px-5" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="prescription" render={({ field }) => (
                                        <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Treatment & Advice</FormLabel><FormControl><Textarea placeholder="Prescriptions, dosage, and follow-up patient instructions..." rows={8} className="resize-none border-2 rounded-2xl p-5" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    {!isCompleted ? (
                                        <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20 bg-primary text-white">Finalize & Perform Consultation</Button>
                                    ) : (
                                        <div className="p-5 bg-muted/30 text-center rounded-2xl text-xs font-bold uppercase tracking-widest text-muted-foreground border-2 border-dashed">Session Performed • Edits Locked</div>
                                    )}
                                </form></Form>
                            </TabsContent>
                        </div>
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
        toast({ title: "Clinical Slots Synced" });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[95dvh] overflow-hidden sm:max-w-xl rounded-t-[2.5rem] sm:rounded-3xl p-0 flex flex-col border-none shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-8 sm:p-10 border-b bg-slate-900 text-white shrink-0">
                    <DialogTitle className="text-2xl font-headline">Clinical Hour Configuration</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">Audit and update your available 30-minute blocks.</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                    <div className="space-y-8 p-8 sm:p-10 pb-32">
                        <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 flex gap-4">
                            <AlertCircle className="h-6 w-6 text-primary shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed font-medium italic">
                                Unchecked slots are marked as <strong>Unavailable</strong> and are instantly hidden from patient booking views across the platform.
                            </p>
                        </div>
                        {Object.entries(timeSlots).map(([session, slots]) => (
                            <div key={session} className="p-6 rounded-[2rem] bg-muted/20 border">
                                <h5 className="text-[10px] font-bold uppercase mb-6 text-primary tracking-[0.2em]">{session} 30m Session Block</h5>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {slots.map(slot => (
                                        <div key={slot} className="flex items-center space-x-3 p-4 border-2 rounded-2xl bg-white hover:border-primary/30 transition-all shadow-sm group">
                                            <Checkbox 
                                                id={`slot-${slot}`} 
                                                checked={!disabledSlots.includes(slot)} 
                                                onCheckedChange={() => setDisabledSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])}
                                                className="h-5 w-5 rounded-lg border-2"
                                            />
                                            <label htmlFor={`slot-${slot}`} className="text-xs font-bold cursor-pointer select-none group-hover:text-primary transition-colors">{slot}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-8 sm:p-10 border-t bg-slate-50 shrink-0 mt-auto">
                    <Button onClick={handleSave} className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 text-white bg-primary" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                        Apply Slot Schedule
                    </Button>
                </div>
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
        toast({ title: "Absence History Logged", description: "Admin review pending for " + format(values.requestedDate, "MMM dd") });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-t-[2.5rem] sm:rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden max-h-[95dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 p-8 text-white text-center shrink-0">
                    <DialogTitle className="text-2xl font-headline">Absence History Entry</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1">Audit trail for professional clinical pauses.</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-8 pb-24 bg-white">
                            <FormField control={form.control} name="requestedDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground ml-1">Select Clinical Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className="w-full h-14 border-2 rounded-2xl text-left font-bold px-5 text-sm">
                                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                                    {field.value ? format(field.value, "PPP") : "Pick an audit date"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 rounded-3xl shadow-2xl border-none" align="center">
                                            <DayPickerCalendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => isBefore(d, addDays(new Date(), 1))} initialFocus className="rounded-3xl" />
                                        </PopoverContent>
                                    </Popover>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="reason" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground ml-1">Professional Justification</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Detail the context (e.g. Travel, Workshop, Personal Audit)" rows={5} className="resize-none border-2 rounded-2xl p-5 text-sm focus:border-primary transition-colors" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20 text-white bg-primary">Log for Audit History</Button>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
    const [nowState, setNowState] = useState(Date.now());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNowState(Date.now()), 15000);
        
        const saved = localStorage.getItem('dismissed_alerts');
        if (saved) {
            try {
                setDismissedAlertIds(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error("Alert recovery error", e);
            }
        }

        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'appointments'), 
            where('doctorId', '==', user.uid),
            where('paymentStatus', '==', 'approved')
        );
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
            const now = Date.now();
            const missedAppointments = appointments.filter(apt => {
                if (!apt || apt.status !== 'scheduled' || !apt.appointmentDateTime) return false;
                const endTime = new Date(apt.appointmentDateTime).getTime() + (30 * 60 * 1000); 
                return now > endTime;
            });

            for (const apt of missedAppointments) {
                if (!apt || !apt.id) continue;
                const aptRef = doc(firestore, 'appointments', apt.id);
                updateDocumentNonBlocking(aptRef, { status: 'expired', updatedAt: new Date().toISOString() });

                addDocumentNonBlocking(collection(firestore, 'missedSessionAudits'), {
                    appointmentId: apt.id,
                    doctorId: user.uid,
                    patientId: apt.patientId,
                    scheduledTime: apt.appointmentDateTime,
                    loggedAt: new Date().toISOString(),
                });

                toast({
                    variant: 'destructive',
                    title: "Session Time-Out",
                    description: `The 30m clinical window has passed for a session. Logged for history audit.`,
                });
            }
        };

        checkMissedSessions();
    }, [appointments, mounted, firestore, user, toast, nowState]);

    const { todayAppointments, stats, masterSchedule, notifications, currentDayLeaveStatus } = useMemo(() => {
        if (!mounted || !appointments) return { 
            todayAppointments: [], 
            stats: { today: 0, pending: 0, todayRevenue: 0, totalRevenue: 0, totalConsults: 0, uniquePatients: 0 }, 
            masterSchedule: { morning: [], afternoon: [], evening: [] },
            notifications: [],
            currentDayLeaveStatus: null as string | null
        };
        
        const now = new Date();
        const yesterday = subDays(now, 1);

        const allToday = appointments.filter(apt => {
            if (!apt || !apt.appointmentDateTime) return false;
            if (apt.status === 'cancelled') return false;
            return isSameDay(new Date(apt.appointmentDateTime), now);
        });

        const activeQueue = allToday.filter(apt => {
            if (apt.status === 'completed' || apt.status === 'expired') return false;
            const aptDate = new Date(apt.appointmentDateTime);
            const endTime = aptDate.getTime() + (30 * 60 * 1000); 
            const isExpired = Date.now() > endTime;
            return !isExpired;
        });

        const pending = appointments.filter(apt => apt && apt.status === 'scheduled').length;
        
        const todayPaidAndValid = allToday.filter(a => a && a.paymentStatus === 'approved');
        const todayRev = todayPaidAndValid.reduce((sum, a) => sum + (a.amount || 1500), 0);
        
        const lifetimeRev = appointments.filter(a => a && a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        const totalCompleted = appointments.filter(a => a && a.status === 'completed').length;
        const uniquePatients = new Set(appointments.filter(a => a && a.status === 'completed' && a.patientId).map(a => a.patientId)).size;

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
            if (a.status === 'completed' || a.status === 'cancelled') return;

            const alertId = a.id + (a.status === 'expired' ? '-exp' : '-notif');
            if (dismissedAlertIds.has(alertId)) return;

            if (a.status === 'expired') {
                alerts.push({ id: alertId, msg: `History: 30m Session Expired (${format(new Date(a.appointmentDateTime), "p")})`, icon: AlertCircle, color: 'text-destructive', timestamp: new Date(a.updatedAt || a.createdAt).getTime() });
                return;
            }
            
            const isNew = isAfter(new Date(a.createdAt), yesterday);
            if (isNew && a.status === 'scheduled') {
                alerts.push({ id: alertId, msg: `New Booking: ${format(new Date(a.appointmentDateTime), "PP p")}`, icon: Clock, color: 'text-primary', timestamp: new Date(a.createdAt).getTime() });
            }

            const aptDate = new Date(a.appointmentDateTime);
            const startTime = aptDate.getTime() - (10 * 60 * 1000); 
            const endTime = aptDate.getTime() + (30 * 60 * 1000); 
            const currentTime = Date.now();
            
            if (currentTime >= startTime && currentTime < endTime && a.status === 'scheduled') {
                alerts.push({ id: alertId + '-live', msg: "PATIENT WAITING - JOIN NOW", icon: Siren, color: 'text-red-500 animate-pulse font-bold', isReminder: true, timestamp: Date.now() + 1000000 });
            }
        });

        const sortedNotifications = alerts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return { 
            todayAppointments: activeQueue,
            stats: { today: allToday.length, pending: pending, todayRevenue: todayRev, totalRevenue: lifetimeRev, totalConsults: totalCompleted, uniquePatients },
            masterSchedule: { morning: filterSlots(timeSlots.morning), afternoon: filterSlots(timeSlots.afternoon), evening: filterSlots(timeSlots.evening) },
            notifications: sortedNotifications,
            currentDayLeaveStatus: leaveStatus
        };
    }, [appointments, mounted, viewDate, userData, requests, dismissedAlertIds, nowState]);

    const handleSelectApt = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsConsultOpen(true);
    };

    const handleClearNotifications = () => {
        const newDismissed = new Set(dismissedAlertIds);
        notifications.forEach(n => n && n.id && newDismissed.add(n.id));
        setDismissedAlertIds(newDismissed);
        localStorage.setItem('dismissed_alerts', JSON.stringify(Array.from(newDismissed)));
        toast({ title: "Operational history archived." });
    };

    const handleTriggerPostpone = (apt: any) => {
        setSelectedAppointment(apt);
        setIsConsultOpen(false);
        setIsPostponeOpen(true);
    };

    if (!mounted || isUserLoading) return <div className="flex min-h-svh items-center justify-center bg-secondary/30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <main className="min-h-svh flex flex-col bg-secondary/30 py-6 sm:py-10 overflow-x-hidden overflow-y-auto overscroll-none">
            <div className="container mx-auto px-4 space-y-8 sm:space-y-12 flex-1 pb-24">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-bold font-headline tracking-tight text-foreground">Clinical Command Center</h1>
                        <p className="text-muted-foreground flex items-center gap-2 text-sm sm:text-base font-medium">
                            <Activity className="h-5 w-5 text-primary" /> Active Platform Surveillance • 30m Protocol
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto">
                        <Card className="p-4 bg-primary text-primary-foreground border-none shadow-2xl shadow-primary/20 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Today's Revenue</p>
                            <p className="text-xl sm:text-2xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p>
                        </Card>
                        <Card className="p-4 bg-white border-none shadow-xl rounded-2xl">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today's Pool</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary">{stats.today} Patients</p>
                        </Card>
                        <div className="col-span-2 sm:col-span-1">
                            <Button onClick={() => setIsHistoryOpen(true)} variant="outline" className="w-full h-full font-bold gap-3 border-2 border-primary/20 hover:bg-primary/5 shadow-md rounded-2xl text-sm">
                                <History className="h-5 w-5 text-primary" /> My History
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-start">
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
                             <CardHeader className="pb-4 border-b bg-muted/10 px-6">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
                                        <Bell className="h-5 w-5 text-amber-500" /> History Logs
                                    </CardTitle>
                                    {notifications.length > 0 && (
                                        <Button variant="ghost" size="sm" onClick={handleClearNotifications} className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-3 w-3 mr-1" /> Clear
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 p-6 max-h-[400px] overflow-y-auto custom-scrollbar overscroll-contain">
                                {notifications.length > 0 ? notifications.map(n => n && (
                                    <div key={n.id} className={cn(
                                        "p-4 rounded-2xl border-2 flex gap-4 items-start animate-in fade-in slide-in-from-right-3 transition-all",
                                        n.isReminder ? "bg-red-50 border-red-200 shadow-lg shadow-red-500/10" : "bg-muted/30 border-muted/50"
                                    )}>
                                        <n.icon className={cn("h-5 w-5 shrink-0 mt-0.5", n.color)} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-xs leading-relaxed font-bold tracking-tight", n.isReminder ? "text-red-700" : "text-slate-700")}>{n.msg}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 space-y-2">
                                        <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">History Clear</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-3xl">
                            <CardHeader className="bg-primary/5 pb-4 border-b px-6">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold flex items-center gap-3 uppercase tracking-tighter text-foreground">
                                        <ClipboardCheck className="h-6 w-6 text-primary" /> Active Queue
                                    </CardTitle>
                                    <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary bg-white px-2 h-auto py-1">REAL-TIME</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? (
                                    <div className="p-16 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></div>
                                ) : todayAppointments.length > 0 ? (
                                    <div className="divide-y max-h-[500px] overflow-y-auto custom-scrollbar overscroll-contain">
                                        {todayAppointments.map(apt => apt && (
                                            <AppointmentRow key={apt.id} apt={apt} onSelect={handleSelectApt} isMounted={mounted} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-20 text-center text-muted-foreground space-y-6">
                                        <CalendarIcon className="h-16 w-16 mx-auto opacity-10" />
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em]">No Active Sessions</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-8 h-full">
                        <Card className="border-none shadow-2xl relative bg-white overflow-hidden rounded-[2.5rem] flex flex-col">
                            <CardHeader className="border-b bg-muted/5 z-10 p-6 sm:p-10 shrink-0">
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                                    <div className="space-y-2">
                                        <CardTitle className="text-2xl sm:text-3xl font-headline flex items-center gap-4 text-foreground">
                                            <Clock className="h-8 w-8 text-primary" /> Clinical Timetable
                                        </CardTitle>
                                        <CardDescription className="text-xs sm:text-sm font-medium">Standardised 30-minute shifts active.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-3 bg-white p-2 rounded-[1.25rem] border-2 shadow-sm w-full xl:w-auto justify-between sm:justify-start">
                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => setViewDate(addDays(viewDate, -1))}><ChevronLeft className="h-5 w-5" /></Button>
                                            <div className="px-4 text-xs sm:text-sm font-bold min-w-[100px] text-center uppercase tracking-widest">{format(viewDate, "MMM dd")}</div>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
                                            <div className="hidden sm:flex h-8 w-px bg-muted mx-2" />
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button variant="outline" size="sm" className="h-10 gap-2 font-bold px-3 sm:px-4 text-[10px] sm:text-xs rounded-xl border-2" onClick={() => setIsAvailabilityOpen(true)}><Settings2 className="h-4 w-4 text-primary" /> Slots</Button>
                                                <Button size="sm" className="h-10 gap-2 font-bold px-3 sm:px-4 text-[10px] sm:text-xs rounded-xl shadow-lg text-white" onClick={() => setIsLeaveOpen(true)}><Moon className="h-4 w-4" /> Leave</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 sm:p-10 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
                                {currentDayLeaveStatus === 'approved' && (
                                    <div className="absolute inset-x-0 bottom-0 top-[220px] sm:top-[160px] z-20 bg-white/95 backdrop-blur-[6px] flex items-center justify-center rounded-b-[2.5rem]">
                                        <div className="bg-white p-10 sm:p-14 rounded-[3rem] shadow-2xl border-2 text-center max-w-[90%] sm:max-w-md space-y-8 animate-in zoom-in-95">
                                            <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-white"><ShieldCheck className="h-14 w-14" /></div>
                                            <div className="space-y-3">
                                                <h4 className="text-2xl sm:text-3xl font-bold tracking-tight">Practice Suspended</h4>
                                                <p className="text-sm text-muted-foreground leading-relaxed font-medium italic">Professional absence history audit approved for this date.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pb-24">
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary flex items-center gap-4"><div className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm shrink-0" /> Morning</h3>
                                        <div className="space-y-2">{masterSchedule.morning.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted} viewDate={viewDate}/>))}</div>
                                    </div>
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary flex items-center gap-4"><div className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-sm shrink-0" /> Afternoon</h3>
                                        <div className="space-y-2">{masterSchedule.afternoon.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted} viewDate={viewDate}/>))}</div>
                                    </div>
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary flex items-center gap-4"><Moon className="h-4 w-4 text-indigo-400 shrink-0" /> Evening</h3>
                                        <div className="space-y-2">{masterSchedule.evening.map((slot, idx) => (<ScheduleSlot key={idx} time={slot.time} appointment={slot.appointment} onSelect={handleSelectApt} isDisabled={slot.isDisabled} isMounted={mounted} viewDate={viewDate}/>))}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-t-[2.5rem] sm:rounded-3xl p-0 overflow-hidden max-h-[95dvh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-8 text-white text-center shrink-0">
                            <DialogTitle className="flex items-center justify-center gap-3 text-2xl font-headline text-white">
                                <History className="h-6 w-6 text-primary" /> My History
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 mt-1">Summary of your professional clinical activity.</DialogDescription>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-white p-8 space-y-6 overscroll-contain pb-24 custom-scrollbar">
                            <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/10 space-y-1 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Aggregate Earnings</p>
                                <p className="text-3xl sm:text-4xl font-bold text-primary">PKR {stats.totalRevenue.toLocaleString()}</p>
                            </div>
                            <div className="p-6 rounded-3xl bg-muted/30 border-2 border-muted/50 space-y-1 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Performed Consultations</p>
                                <p className="text-3xl sm:text-4xl font-bold">{stats.totalConsults}</p>
                            </div>
                            <div className="p-6 rounded-3xl bg-blue-50 border-2 border-blue-100 space-y-1 text-center">
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Unique Patients Pool</p>
                                <p className="text-3xl sm:text-4xl font-bold text-blue-600">{stats.uniquePatients}</p>
                            </div>
                        </div>
                        <DialogFooter className="p-8 pt-0 bg-white shrink-0 mt-auto"><Button variant="secondary" className="w-full h-14 font-bold rounded-2xl" onClick={() => setIsHistoryOpen(false)}>Close Summary</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                {selectedAppointment && <ConsultationDialog isOpen={isConsultOpen} onOpenChange={setIsConsultOpen} appointment={selectedAppointment} isMounted={mounted} onPostpone={handleTriggerPostpone} />}
                {userData && <AvailabilityDialog isOpen={isAvailabilityOpen} onOpenChange={setIsAvailabilityOpen} doctor={userData as Doctor} />}
                {user && <LeaveRequestDialog isOpen={isLeaveOpen} onOpenChange={setIsLeaveOpen} defaultDate={viewDate} doctorId={user.uid} />}
                {selectedAppointment && <InternalPostponeDialog isOpen={isPostponeOpen} onOpenChange={setIsPostponeOpen} appointment={selectedAppointment} />}
            </div>
        </main>
    );
}

function getNext7Days() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        next7Days.push({
            date: date,
            dayName: days[date.getDay()],
            dayNumber: date.getDate(),
            fullDayName: days[date.getDay()] 
        });
    }
    return next7Days;
}
