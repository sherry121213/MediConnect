'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, Loader2, Clock, History, Activity, ClipboardCheck, ChevronLeft, ChevronRight, FileText, PhoneCall, Zap, LayoutList } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, subDays, isBefore, addMinutes, parse } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getNext7Days } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const [selectedHour, setSelectedHour] = useState<string>("09");
    const [selectedMinute, setSelectedMinute] = useState<string>("00");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("AM");
    const [isSaving, setIsSaving] = useState(false);
    const [nowTicker, setNowTicker] = useState(new Date());
    const availableDates = getNext7Days();

    useEffect(() => {
        const interval = setInterval(() => setNowTicker(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const isToday = isSameDay(selectedDate, nowTicker);
    const currentHour24 = nowTicker.getHours();
    const currentMin = nowTicker.getMinutes();
    const currentPeriod = currentHour24 >= 12 ? "PM" : "AM";
    const currentHour12 = currentHour24 > 12 ? currentHour24 - 12 : (currentHour24 === 0 ? 12 : currentHour24);

    const availablePeriods = useMemo(() => {
        if (!isToday) return ["AM", "PM"];
        if (currentPeriod === "PM") return ["PM"];
        return ["AM", "PM"];
    }, [isToday, currentPeriod]);

    const availableHours = useMemo(() => {
        const allHours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
        if (!isToday) return allHours;

        return allHours.filter(h => {
            const hNum = parseInt(h);
            if (selectedPeriod === currentPeriod) {
                const compareH = hNum === 12 ? 0 : hNum;
                const currentCompareH = currentHour12 === 12 ? 0 : currentHour12;
                return compareH >= currentCompareH;
            }
            return true;
        });
    }, [isToday, selectedPeriod, currentPeriod, currentHour12]);

    const availableMinutes = useMemo(() => {
        const allMins = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
        if (!isToday) return allMins;

        const hNum = parseInt(selectedHour);
        if (selectedPeriod === currentPeriod && hNum === currentHour12) {
            return allMins.filter(m => parseInt(m) > currentMin);
        }
        return allMins;
    }, [isToday, selectedHour, selectedPeriod, currentPeriod, currentHour12, currentMin]);

    useEffect(() => {
        if (isToday) {
            if (!availablePeriods.includes(selectedPeriod)) setSelectedPeriod(availablePeriods[0]);
            if (!availableHours.includes(selectedHour)) setSelectedHour(availableHours[0] || "09");
            if (!availableMinutes.includes(selectedMinute)) setSelectedMinute(availableMinutes[0] || "00");
        }
    }, [isToday, availablePeriods, availableHours, availableMinutes, selectedPeriod, selectedHour, selectedMinute]);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', appointment.doctorId));
    }, [firestore, appointment?.doctorId]);
    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const selectedTimeStr = useMemo(() => `${selectedHour}:${selectedMinute} ${selectedPeriod}`, [selectedHour, selectedMinute, selectedPeriod]);

    const timeValidation = useMemo(() => {
        if (!existingAppointments || !selectedDate || !selectedTimeStr) return { isAvailable: true, message: '' };

        const proposedStart = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        const proposedEnd = addMinutes(proposedStart, 20);
        const now = new Date();

        if (isSameDay(selectedDate, now) && isBefore(proposedStart, now)) {
            return { isAvailable: false, message: 'This time has already passed for today.' };
        }

        const overlap = existingAppointments.find(apt => {
            if (!apt || apt.status === 'cancelled' || !apt.appointmentDateTime || apt.id === appointment.id) return false;
            const aptStart = new Date(apt.appointmentDateTime);
            const aptEnd = addMinutes(aptStart, 20);
            return proposedStart < aptEnd && proposedEnd > aptStart;
        });

        if (overlap) return { isAvailable: false, message: 'This precision clinical window is already booked.' };

        return { isAvailable: true, message: '' };
    }, [selectedTimeStr, selectedDate, existingAppointments, appointment.id]);

    const handleConfirm = async () => {
        if (!firestore || !appointment || !timeValidation.isAvailable) return;
        setIsSaving(true);
        
        const newDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);

        updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), {
            appointmentDateTime: newDateTime.toISOString(),
            status: 'scheduled', 
            updatedAt: new Date().toISOString(),
            doctorInRoom: false,
            readyToStart: false
        });
        toast({ title: "Precision Clinical Session Rescheduled", description: `Appointment moved to ${format(newDateTime, "PPP p")}.` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">Clinical Rescheduling</DialogTitle>
                    <DialogDescription className="text-slate-400 mt-1 font-medium">Shift this Precision Clinical Session precisely.</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                    <div className="p-8 space-y-10 pb-32">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Select Date</p>
                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
                                {availableDates.map(day => (
                                    <button 
                                        key={day.date.toISOString()}
                                        onClick={() => { setSelectedDate(day.date); }}
                                        className={cn(
                                            "p-4 rounded-3xl border-2 transition-all shrink-0 w-28 text-center flex flex-col items-center justify-center gap-1",
                                            isSameDay(selectedDate, day.date) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background hover:bg-muted border-slate-100'
                                        )}
                                    >
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">{day.dayName}</p>
                                        <p className="text-xl font-bold font-headline text-slate-900">{format(day.date, "dd")}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="border-t pt-10">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Manual Time Adjustment</p>
                            <div className="grid grid-cols-3 gap-3 p-4 border-2 rounded-2xl bg-slate-50">
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Hour</Label>
                                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                            {availableHours.map(h => (
                                                <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Min</Label>
                                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                            {availableMinutes.map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">Per</Label>
                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                        <SelectTrigger className="h-10 rounded-lg border-2 bg-white font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-xl">
                                            {availablePeriods.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 sm:p-8 border-t bg-slate-50 shrink-0 mt-auto">
                    <div className="flex gap-4">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-bold shadow-2xl shadow-primary/20 bg-slate-900 hover:bg-slate-800 text-white" disabled={!timeValidation.isAvailable || isSaving} onClick={handleConfirm}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Move"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const AppointmentRow = ({ apt, patient, onSelect, onNotify, isMounted }: { apt: Appointment, patient?: Patient, onSelect: (a: Appointment) => void, onNotify: (a: Appointment) => void, isMounted: boolean }) => {
    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    
    const startTime = appointmentDate.getTime();
    const earlyBufferTime = startTime - (5 * 60 * 1000);
    const endTime = startTime + (15 * 60 * 1000); 

    const isLive = isMounted && now >= startTime && now < endTime && apt.status === 'scheduled';
    const isNotifyRange = isMounted && now >= earlyBufferTime && now < startTime && apt.status === 'scheduled';
    const isMissed = isMounted && now >= endTime && apt.status !== 'completed';

    return (
        <div className={cn(
            "flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all border-b last:border-0 group cursor-pointer",
            isLive && "bg-primary/5 border-primary/20 shadow-sm"
        )} onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tighter truncate">
                        <Clock className="h-2.5 w-2.5 shrink-0" /> {format(appointmentDate, "p")} • Precision Clinical Session
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {isLive && <Badge className="bg-red-600 text-white animate-pulse text-[9px] px-2 font-bold h-auto py-1">LIVE NOW</Badge>}
                {isNotifyRange && (
                    <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold" onClick={(e) => { e.stopPropagation(); onNotify(apt); }} disabled={apt.readyToStart}>
                        <PhoneCall className="h-3 w-3 mr-1" /> {apt.readyToStart ? 'Signaled' : 'Signal'}
                    </Button>
                )}
                {!isLive && !isNotifyRange && !isMissed && (
                    <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("shrink-0 text-[10px] px-2.5 py-1 h-auto font-bold", apt.status === 'completed' ? "bg-green-100 text-green-800" : "text-primary border-primary/20")}>
                        {apt.status === 'scheduled' ? 'Scheduled' : apt.status === 'completed' ? 'Performed' : apt.status}
                    </Badge>
                )}
            </div>
        </div>
    );
};

function ConsultationDialog({ isOpen, onOpenChange, appointment, patient, isMounted, onPostpone }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null, patient?: Patient, isMounted: boolean, onPostpone: (a: any) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const form = useForm({
        resolver: zodResolver(z.object({ diagnosis: z.string().min(3), prescription: z.string().min(10) })),
        defaultValues: { diagnosis: appointment?.diagnosis || '', prescription: appointment?.prescription || '' }
    });

    if (!appointment) return null;

    const isCompleted = appointment.status === 'completed';

    const onSubmit = (values: any) => {
        if (!firestore || isCompleted) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed', updatedAt: new Date().toISOString(), doctorInRoom: false, readyToStart: false });
        toast({ title: "Clinical Record Logged" });
        onOpenChange(false);
    };

    const appointmentDate = new Date(appointment.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    const startTime = appointmentDate.getTime();
    const earlyNotifyTime = startTime - (5 * 60 * 1000); 
    const endTime = startTime + (15 * 60 * 1000); 

    const isLive = isMounted && now >= startTime && now < endTime && appointment.status === 'scheduled';
    const isFlexibleEarly = isMounted && now >= earlyNotifyTime && now < startTime && appointment.status === 'scheduled';

    const handleStartRoom = () => {
        if (isFlexibleEarly && !appointment.readyToStart && firestore) {
            updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), { readyToStart: true, doctorInRoom: true });
        }
        onOpenChange(false);
        window.location.assign(`/consultation/${appointment.id}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] max-h-[95dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                        <DialogTitle className="text-2xl font-headline mb-6 text-white">Clinical Record</DialogTitle>
                        <TabsList className="bg-white/10 w-full grid grid-cols-3 h-12 p-1 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Registry</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">History</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[10px]">Notes</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-white p-6 sm:p-10 pb-32">
                        <TabsContent value="overview" className="space-y-8 m-0">
                            <div className="flex items-center gap-6 p-6 border-2 rounded-[2rem] bg-muted/20">
                                <Avatar className="h-16 w-16 shadow-lg border-2 border-white"><AvatarFallback className="bg-primary text-white font-bold text-lg">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                                {patient && <div className="min-w-0"><p className="font-bold text-xl truncate text-slate-900">{patient.firstName} {patient.lastName}</p><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{patient.email}</p></div>}
                            </div>
                            {(isLive || isFlexibleEarly) && !isCompleted && (
                                <Button onClick={handleStartRoom} className={cn("w-full h-16 text-lg font-bold shadow-2xl rounded-2xl", isLive ? "bg-red-600 animate-pulse" : "bg-primary")}>
                                    <Video className="mr-3 h-6 w-6" /> {isLive ? "Join Precision Session" : "Start Early (Flexible)"}
                                </Button>
                            )}
                            {!isCompleted && !isLive && !isFlexibleEarly && (
                                <Button variant="outline" className="w-full h-14 text-sm font-bold rounded-2xl gap-3 border-2" onClick={() => onPostpone(appointment)}>
                                    <History className="h-4 w-4 text-primary" /> Shift Session
                                </Button>
                            )}
                        </TabsContent>
                        <TabsContent value="history" className="m-0">
                            <PatientHistoryTab patientId={appointment.patientId} />
                        </TabsContent>
                        <TabsContent value="notes" className="m-0">
                            <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <FormField control={form.control} name="diagnosis" render={({ field }) => (
                                    <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Clinical Diagnosis</FormLabel><FormControl><Input placeholder="Clinical Summary..." className="h-14 border-2 rounded-2xl" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="prescription" render={({ field }) => (
                                    <FormItem><FormLabel className="uppercase text-[10px] font-bold tracking-[0.2em] text-muted-foreground">Advice</FormLabel><FormControl><Textarea placeholder="Treatment plan..." rows={8} className="resize-none border-2 rounded-2xl" {...field} disabled={isCompleted} /></FormControl><FormMessage /></FormItem>
                                )} />
                                {!isCompleted && <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl bg-primary text-white">Finalize Record</Button>}
                            </form></Form>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

export default function DoctorPortalPage() {
    const { user, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [nowState, setNowState] = useState(Date.now());
    const [patientsMap, setPatientsMap] = useState<Map<string, Patient>>(new Map());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNowState(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', user.uid), where('paymentStatus', '==', 'approved'));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    useEffect(() => {
        if (!appointments || !firestore) return;
        const fetchPatients = async () => {
            const pIds = Array.from(new Set(appointments.map(a => a?.patientId).filter(Boolean)));
            if (pIds.length === 0) return;
            const newMap = new Map<string, Patient>(patientsMap);
            const missingIds = pIds.filter(id => !newMap.has(id));
            if (missingIds.length === 0) return;
            for (let i = 0; i < missingIds.length; i += 30) {
                const chunk = missingIds.slice(i, i + 30);
                const q = query(collection(firestore, 'patients'), where('id', 'in', chunk));
                const snap = await getDocs(q);
                snap.forEach(doc => newMap.set(doc.id, doc.data() as Patient));
            }
            setPatientsMap(newMap);
        };
        fetchPatients();
    }, [appointments, firestore]);

    const { activeQueue, timelineApts, stats } = useMemo(() => {
        if (!mounted || !appointments) return { activeQueue: [], timelineApts: [], stats: { today: 0, todayRevenue: 0 } };
        const now = new Date();
        const allToday = appointments.filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), now) && apt.status !== 'cancelled');
        const viewDayApts = appointments.filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), viewDate) && apt.status !== 'cancelled').sort((a,b) => a.appointmentDateTime.localeCompare(b.appointmentDateTime));
        const activeQ = allToday.filter(apt => apt.status === 'scheduled' && Date.now() < new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000));
        const todayRev = allToday.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        return { activeQueue: activeQ, timelineApts: viewDayApts, stats: { today: allToday.length, todayRevenue: todayRev } };
    }, [appointments, mounted, viewDate, nowState]);

    const handleSelectApt = (apt: Appointment) => { setSelectedAppointment(apt); setIsConsultOpen(true); };
    const handleTriggerPostpone = (apt: any) => { setSelectedAppointment(apt); setIsConsultOpen(false); setIsPostponeOpen(true); };
    
    const handleNotifyPatient = (apt: Appointment) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'appointments', apt.id), { readyToStart: true, doctorInRoom: true });
        toast({ title: "Clinical Signal Sent" });
    };

    if (!mounted || isUserLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <main className="min-h-screen bg-slate-50/50 py-8 px-4">
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <h1 className="text-3xl font-bold font-headline text-slate-900">Practice Control</h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Real-time Precision Clinical Schedule</p>
                    </div>
                    <div className="flex gap-4">
                        <Card className="p-4 bg-primary text-white border-none rounded-2xl"><p className="text-[10px] font-bold uppercase opacity-80">Revenue Today</p><p className="text-xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p></Card>
                        <Card className="p-4 bg-white border-none shadow-sm rounded-2xl"><p className="text-[10px] font-bold uppercase text-muted-foreground">Load Today</p><p className="text-xl font-bold text-primary">{stats.today} Sessions</p></Card>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-4 space-y-8">
                         <Card className="border-none shadow-2xl bg-slate-900 text-white rounded-[2rem] overflow-hidden">
                            <CardHeader className="p-8"><CardTitle className="text-lg flex items-center gap-3"><Zap className="h-6 w-6 text-primary" /> Management</CardTitle></CardHeader>
                            <CardContent className="p-8 space-y-4">
                                <Button variant="outline" className="w-full h-14 rounded-2xl bg-white/5 border-white/10 text-white font-bold" asChild><Link href="/doctor-portal/patients"><LayoutList className="h-5 w-5 mr-3" /> Registry</Link></Button>
                                <Button variant="outline" className="w-full h-14 rounded-2xl bg-white/5 border-white/10 text-white font-bold" asChild><Link href="/doctor-portal/unavailability"><CalendarIcon className="h-5 w-5 mr-3" /> Clinical Pause</Link></Button>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                            <CardHeader className="bg-primary/5 p-6"><CardTitle className="text-xs uppercase font-bold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Clinical Queue</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/30" /></div> : 
                                 activeQueue.length > 0 ? <div className="divide-y">{activeQueue.map(apt => apt && <AppointmentRow key={apt.id} apt={apt} patient={patientsMap.get(apt.patientId)} onSelect={handleSelectApt} onNotify={handleNotifyPatient} isMounted={mounted} />)}</div> :
                                 <div className="p-12 text-center text-muted-foreground italic text-xs">No pending sessions.</div>}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                        <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
                            <CardHeader className="border-b bg-slate-50 p-6 sm:p-8">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-xl font-headline flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /> Timeline</CardTitle>
                                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 shadow-sm">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(subDays(viewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                        <span className="px-3 text-xs font-bold uppercase tracking-widest">{format(viewDate, "MMM dd")}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 sm:p-10 min-h-[400px]">
                                {timelineApts.length > 0 ? (
                                    <div className="space-y-4">
                                        {timelineApts.map((apt) => {
                                            const timing = {
                                                isLive: Date.now() >= new Date(apt.appointmentDateTime).getTime() && Date.now() < new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000),
                                                isCompleted: apt.status === 'completed'
                                            };
                                            return (
                                                <div key={apt.id} className={cn("flex items-center justify-between p-6 rounded-[1.5rem] border-2 transition-all", timing.isLive ? "border-primary bg-primary/5 scale-[1.01]" : timing.isCompleted ? "border-green-100 bg-green-50/50" : "border-slate-100 bg-white")}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="text-center w-16 border-r-2 border-slate-100"><p className="text-sm font-bold">{format(new Date(apt.appointmentDateTime), "hh:mm")}</p><p className="text-[10px] font-bold uppercase">{format(new Date(apt.appointmentDateTime), "a")}</p></div>
                                                        <div><p className="font-bold">{patientsMap.get(apt.patientId)?.firstName} {patientsMap.get(apt.patientId)?.lastName || '...'}</p><p className="text-[10px] text-muted-foreground uppercase font-bold">{apt.appointmentType} • Precision Window</p></div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {timing.isCompleted ? <Badge className="bg-green-100 text-green-800 font-bold text-[10px] px-3 h-7">Performed</Badge> :
                                                         timing.isLive ? <Button size="sm" onClick={() => handleSelectApt(apt)} className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-6 rounded-xl animate-pulse">Join Session</Button> :
                                                         <Button variant="outline" size="sm" onClick={() => handleSelectApt(apt)} className="h-9 px-4 rounded-xl font-bold border-2 text-xs">Manage</Button>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-32 opacity-20 grayscale"><CalendarIcon className="h-20 w-20 mb-4" /><p className="font-bold text-xs uppercase tracking-[0.3em]">No Records Found</p></div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {selectedAppointment && <ConsultationDialog isOpen={isConsultOpen} onOpenChange={setIsConsultOpen} appointment={selectedAppointment} patient={patientsMap.get(selectedAppointment.patientId)} isMounted={mounted} onPostpone={handleTriggerPostpone} />}
                {selectedAppointment && <InternalPostponeDialog isOpen={isPostponeOpen} onOpenChange={setIsPostponeOpen} appointment={selectedAppointment} />}
            </div>
        </main>
    );
}