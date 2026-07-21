'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Video, Loader2, Clock, History, Activity, ClipboardCheck, ChevronLeft, ChevronRight, FileText, Zap, LayoutList, Siren, PhoneIncoming, UserCheck, AlertCircle, PlayCircle, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs } from "firebase/firestore";
import type { Appointment, Patient, Doctor } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, addDays, subDays, isBefore, addMinutes, parse, isValid } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getNext7Days } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { manageQueueShift } from "@/lib/queue-service";
import { Switch } from "@/components/ui/switch";

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
                        <div><p className="text-xs font-bold text-slate-700">Diagnosis:</p><p className="text-xs text-muted-foreground italic">{apt.diagnosis}</p></div>
                        <div><p className="text-xs font-bold text-slate-700">Advice:</p><p className="text-xs text-muted-foreground line-clamp-2">{apt.prescription}</p></div>
                    </div>
                ))
            ) : (<div className="text-center py-12 text-muted-foreground italic"><FileText className="h-10 w-10 mx-auto mb-2 opacity-10" /><p className="text-xs font-bold uppercase tracking-widest">No Prior Records Found</p></div>)}
        </div>
    );
}

function InternalDialog({ isOpen, onOpenChange, children }: { isOpen: boolean, onOpenChange: (o: boolean) => void, children: React.ReactNode }) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[95vw] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg sm:rounded-[2.5rem] overflow-hidden">
          <DialogPrimitive.Title className="sr-only">Clinical Dialog</DialogPrimitive.Title>
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 text-white"><X className="h-4 w-4" /><span className="sr-only">Close</span></DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function InternalPostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (o: boolean) => void, appointment: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedHour, setSelectedHour] = useState<string>("10");
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

    const availablePeriods = useMemo(() => ["AM", "PM"], []);

    const availableHours = useMemo(() => {
        let filtered = [];
        if (selectedPeriod === 'AM') {
            filtered = ["10", "11"];
        } else {
            filtered = ["12", "02", "03", "04", "05", "06", "07", "08"];
        }

        if (!isToday) return filtered;

        return filtered.filter(h => {
            const hNum = parseInt(h);
            if (selectedPeriod === "AM" && currentPeriod === "PM") return false;
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
        if (availableHours.length > 0 && !availableHours.includes(selectedHour)) {
            setSelectedHour(availableHours[0]);
        }
    }, [availableHours]);

    const handleConfirm = async () => {
        if (!firestore || !appointment) return;
        setIsSaving(true);
        const selectedTimeStr = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
        const newDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        
        if (!isValid(newDateTime)) {
            toast({ variant: 'destructive', title: "Invalid Time" });
            setIsSaving(false);
            return;
        }

        updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), {
            appointmentDateTime: newDateTime.toISOString(),
            status: 'scheduled', 
            updatedAt: new Date().toISOString(),
            doctorInRoom: false,
            readyToStart: false,
            queueStatus: 'waiting'
        });
        toast({ title: "Clinical Session Rescheduled" });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <InternalDialog isOpen={isOpen} onOpenChange={onOpenChange}>
                <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0"><DialogPrimitive.Title className="text-xl sm:text-2xl font-headline">Rescheduling</DialogPrimitive.Title></div>
                <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-8 space-y-8 max-h-[60dvh]">
                    <div className="flex gap-4 overflow-x-auto pb-4">{availableDates.map(day => (<button key={day.date.toISOString()} onClick={() => setSelectedDate(day.date)} className={cn("p-4 rounded-3xl border-2 transition-all shrink-0 w-24 sm:w-28 text-center", isSameDay(selectedDate, day.date) ? 'bg-primary/5 border-primary' : 'bg-background hover:bg-muted border-slate-100')}><p className="text-[10px] font-bold uppercase">{day.dayName}</p><p className="text-xl font-bold font-headline">{format(day.date, "dd")}</p></button>))}</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 p-4 border-2 rounded-2xl bg-slate-50">
                        <Select value={selectedHour} onValueChange={setSelectedHour}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent className="max-h-[200px]">{availableHours.map(h=><SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>
                        <Select value={selectedMinute} onValueChange={setSelectedMinute}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent className="max-h-[200px]">{availableMinutes.map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent>{availablePeriods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
                <div className="p-6 sm:p-8 border-t bg-slate-50 shrink-0 mt-auto"><div className="flex flex-col sm:flex-row gap-4"><Button variant="ghost" className="flex-1 h-12" onClick={() => onOpenChange(false)}>Cancel</Button><Button className="flex-1 h-12" disabled={isSaving} onClick={handleConfirm}>{isSaving ? <Loader2 className="animate-spin" /> : "Confirm Move"}</Button></div></div>
        </InternalDialog>
    );
}

const AppointmentRow = ({ apt, patient, onSelect, isMounted, onShift, isQueueMode }: { apt: Appointment, patient?: Patient, onSelect: (a: Appointment) => void, isMounted: boolean, onShift: (a: Appointment, status: any) => void, isQueueMode: boolean }) => {
    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = isMounted ? Date.now() : 0;
    const startTime = appointmentDate.getTime();
    const isLive = isMounted && now >= startTime && now < startTime + (15*60*1000);

    const getStatusBadge = () => {
        if (isLive) return <Badge className="bg-red-600 text-white animate-pulse text-[8px] h-4 uppercase">Live</Badge>;
        if (apt.queueStatus === 'in-consultation') return <Badge className="bg-green-600 text-white text-[8px] h-4 uppercase">Active</Badge>;
        if (apt.queueStatus === 'shifted') return <Badge variant="outline" className="text-[8px] h-4 uppercase border-amber-400 text-amber-600">Shifted</Badge>;
        if (apt.queueStatus === 'late') return <Badge variant="destructive" className="text-[8px] h-4 uppercase">Late</Badge>;
        return <Badge variant="outline" className="text-[8px] h-4 uppercase">{apt.status}</Badge>;
    };

    return (
        <div className={cn("flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all", (isLive || apt.queueStatus === 'in-consultation') && "bg-primary/5 border-primary/20 shadow-sm")}>
            <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => onSelect(apt)}>
                {isQueueMode && (
                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 border border-slate-200">
                        {apt.sequencePosition || '-'}
                    </div>
                )}
                <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className="text-xs">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{format(appointmentDate, "p")}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {getStatusBadge()}
                {isQueueMode && apt.queueStatus !== 'in-consultation' && apt.queueStatus !== 'completed' && (
                    <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => onShift(apt, 'in-consultation')}>
                            <PlayCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onShift(apt, 'late')}>
                            <UserMinus className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

function ConsultationDialog({ isOpen, onOpenChange, appointment, patient, isMounted, onPostpone }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null, patient?: Patient, isMounted: boolean, onPostpone: (a: any) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm({ resolver: zodResolver(z.object({ diagnosis: z.string().min(3), prescription: z.string().min(10) })), defaultValues: { diagnosis: appointment?.diagnosis || '', prescription: appointment?.prescription || '' } });
    if (!appointment) return null;
    const isCompleted = appointment.status === 'completed';
    const onSubmit = (values: any) => {
        if (!firestore || isCompleted) return;
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointment.id), { ...values, status: 'completed', queueStatus: 'completed', updatedAt: new Date().toISOString() });
        toast({ title: "Record Logged" });
        onOpenChange(false);
    };
    return (
        <InternalDialog isOpen={isOpen} onOpenChange={onOpenChange}>
                <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 p-6 sm:p-8 text-white shrink-0">
                        <DialogPrimitive.Title className="text-xl sm:text-2xl font-headline mb-6">Clinical Record</DialogPrimitive.Title>
                        <TabsList className="bg-white/10 w-full grid grid-cols-3 h-10 p-1 rounded-xl">
                            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[9px]">Record</TabsTrigger>
                            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[9px]">History</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold uppercase text-[9px]">Notes</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-8 pb-32 max-h-[60dvh]">
                        <TabsContent value="overview" className="space-y-6 m-0">
                            <div className="flex items-center gap-4 p-4 border-2 rounded-[1.5rem] bg-muted/20">
                                <Avatar className="h-12 w-12"><AvatarFallback className="text-sm font-bold">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback></Avatar>
                                {patient && <div className="min-w-0"><p className="font-bold text-lg truncate">{patient.firstName} {patient.lastName}</p></div>}
                            </div>
                            {!isCompleted && (<Button onClick={() => window.location.assign(`/consultation/${appointment.id}`)} className="w-full h-14 sm:h-16 text-base font-bold rounded-2xl"><Video className="mr-3 h-5 w-5" /> Join Session</Button>)}
                            {!isCompleted && (<Button variant="outline" className="w-full h-12 rounded-2xl text-xs" onClick={() => onPostpone(appointment)}><History className="h-4 w-4 mr-2" /> Shift Session</Button>)}
                        </TabsContent>
                        <TabsContent value="history" className="m-0"><PatientHistoryTab patientId={appointment.patientId} /></TabsContent>
                        <TabsContent value="notes" className="m-0"><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6"><FormField control={form.control} name="diagnosis" render={({ field }) => (<FormItem><FormLabel className="uppercase text-[9px]">Diagnosis</FormLabel><FormControl><Input className="h-10 text-sm" {...field} /></FormControl></FormItem>)} /><FormField control={form.control} name="prescription" render={({ field }) => (<FormItem><FormLabel className="uppercase text-[9px]">Advice</FormLabel><FormControl><Textarea className="text-sm" rows={6} {...field} /></FormControl></FormItem>)} />{!isCompleted && <Button type="submit" className="w-full h-12">Finalize Record</Button>}</form></Form></TabsContent>
                    </div>
                </Tabs>
        </InternalDialog>
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
    const [patientsMap, setPatientsMap] = useState<Map<string, Patient>>(new Map());
    const [isQueueMode, setIsQueueMode] = useState(true);

    useEffect(() => { setMounted(true); }, []);

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
            const q = query(collection(firestore, 'patients'), where('id', 'in', missingIds.slice(0, 30)));
            const snap = await getDocs(q);
            snap.forEach(doc => newMap.set(doc.id, doc.data() as Patient));
            setPatientsMap(newMap);
        };
        fetchPatients();
    }, [appointments, firestore]);

    const { activeQueue, timelineApts, stats } = useMemo(() => {
        if (!mounted || !appointments) return { activeQueue: [], timelineApts: [], stats: { today: 0, todayRevenue: 0 } };
        const now = new Date();
        const allToday = appointments.filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), now));
        const viewDayApts = appointments.filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), viewDate)).sort((a,b) => a.appointmentDateTime.localeCompare(b.appointmentDateTime));
        
        // Sorting logic for Queue Mode vs Standard
        const activeQ = [...allToday]
            .filter(apt => apt.status === 'scheduled')
            .sort((a, b) => {
                if (isQueueMode && a.sequencePosition && b.sequencePosition) {
                    return a.sequencePosition - b.sequencePosition;
                }
                return a.appointmentDateTime.localeCompare(b.appointmentDateTime);
            });

        const todayRev = allToday.filter(a => a.paymentStatus === 'approved').reduce((sum, a) => sum + (a.amount || 1500), 0);
        return { activeQueue: activeQ, timelineApts: viewDayApts, stats: { today: allToday.length, todayRevenue: todayRev } };
    }, [appointments, mounted, viewDate, isQueueMode]);

    const handleQueueAction = async (apt: Appointment, newStatus: any) => {
        if (!firestore || !appointments) return;
        
        // Group appointments by time block (same hour/minute) for "Back-to-Back" grouping
        const blockId = apt.blockId || apt.appointmentDateTime;
        const blockAppointments = appointments.filter(a => (a.blockId === blockId || a.appointmentDateTime === blockId) && a.status === 'scheduled');

        try {
            await manageQueueShift(firestore, blockAppointments, apt.id, newStatus);
            toast({
                title: newStatus === 'in-consultation' ? "Session Initiated" : "Patient Marked Late",
                description: "Queue sequence updated for this time block.",
            });
        } catch (e) {
            toast({ variant: 'destructive', title: "Queue Update Failed" });
        }
    };

    if (!mounted || isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="min-h-screen bg-slate-50/50 py-4 sm:py-8 px-4">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold font-headline">Practice Control</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Precision Schedule
                        </p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border shadow-sm">
                            <Label htmlFor="queue-mode" className="text-[10px] font-bold uppercase text-slate-500">Back-to-Back Queue</Label>
                            <Switch id="queue-mode" checked={isQueueMode} onCheckedChange={setIsQueueMode} />
                        </div>
                        <Card className="p-4 bg-primary text-white rounded-2xl w-fit">
                            <p className="text-[10px] font-bold uppercase opacity-80">Revenue Today</p>
                            <p className="text-lg sm:text-xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p>
                        </Card>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-4 space-y-6">
                         <Card className="bg-slate-900 text-white rounded-[2rem] overflow-hidden"><CardHeader className="p-6 sm:p-8"><CardTitle className="text-lg flex items-center gap-3"><Zap className="h-6 w-6 text-primary" /> Management</CardTitle></CardHeader><CardContent className="p-6 sm:p-8 pt-0 space-y-3"><Button variant="outline" className="w-full justify-start h-12 rounded-2xl bg-white/5 text-xs" asChild><Link href="/doctor-portal/patients"><LayoutList className="h-4 w-4 mr-3" /> Record Pool</Link></Button><Button variant="outline" className="w-full justify-start h-12 rounded-2xl bg-white/5 text-xs" asChild><Link href="/doctor-portal/unavailability"><CalendarIcon className="h-4 w-4 mr-3" /> Clinical Pause</Link></Button></CardContent></Card>
                        <Card className="bg-white rounded-3xl overflow-hidden">
                            <CardHeader className="bg-primary/5 p-4 sm:p-6 flex flex-row items-center justify-between">
                                <CardTitle className="text-[10px] uppercase font-bold flex items-center gap-2">
                                    <ClipboardCheck className="h-4 w-4 text-primary" /> {isQueueMode ? 'Live Queue' : 'Queue'}
                                </CardTitle>
                                {isQueueMode && <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] h-4">Active Block</Badge>}
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? (
                                    <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></div>
                                ) : activeQueue.length > 0 ? (
                                    <div className="divide-y">
                                        {activeQueue.map(apt => (
                                            <AppointmentRow 
                                                key={apt.id} 
                                                apt={apt} 
                                                patient={patientsMap.get(apt.patientId)} 
                                                onSelect={(a)=>{setSelectedAppointment(a);setIsConsultOpen(true)}} 
                                                isMounted={mounted} 
                                                onShift={handleQueueAction}
                                                isQueueMode={isQueueMode}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center text-muted-foreground text-[10px] uppercase font-bold tracking-widest">No active sessions</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-8 space-y-6">
                        <Card className="rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-white"><CardHeader className="border-b bg-slate-50 p-4 sm:p-8"><div className="flex flex-col sm:flex-row justify-between items-center gap-4"><CardTitle className="text-lg sm:text-xl font-headline flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /> Timeline</CardTitle><div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border-2 shadow-sm"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(subDays(viewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="px-2 text-[10px] font-bold uppercase">{format(viewDate, "MMM dd")}</span><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-4 w-4" /></Button></div></div></CardHeader><CardContent className="p-4 sm:p-10 min-h-[300px]">{timelineApts.length > 0 ? (<div className="space-y-4">{timelineApts.map((apt) => (<div key={apt.id} className={cn("flex items-center justify-between p-4 sm:p-6 rounded-[1.5rem] border-2 transition-all", apt.status === 'completed' ? "border-green-100 bg-green-50/50" : "border-slate-100 bg-white")}><div className="flex items-center gap-4"><div><p className="font-bold text-sm sm:text-base">{patientsMap.get(apt.patientId)?.firstName} {patientsMap.get(apt.patientId)?.lastName || '...'}</p><p className="text-[9px] text-muted-foreground uppercase">{apt.appointmentType} • {format(new Date(apt.appointmentDateTime), "p")}</p></div></div><Button variant="outline" size="sm" onClick={() => {setSelectedAppointment(apt);setIsConsultOpen(true)}} className="h-8 px-3 rounded-xl font-bold border-2 text-[9px] uppercase">Manage</Button></div>))}</div>) : (<div className="flex flex-col items-center justify-center py-24 opacity-20 grayscale"><CalendarIcon className="h-16 w-16 mb-4" /><p className="font-bold text-[10px] uppercase tracking-widest">No Records Found</p></div>)}</CardContent></Card>
                    </div>
                </div>
                {selectedAppointment && <ConsultationDialog isOpen={isConsultOpen} onOpenChange={setIsConsultOpen} appointment={selectedAppointment} patient={patientsMap.get(selectedAppointment.patientId)} isMounted={mounted} onPostpone={(a)=>{setSelectedAppointment(a);setIsConsultOpen(false);setIsPostponeOpen(true)}} />}
                {selectedAppointment && <InternalPostponeDialog isOpen={isPostponeOpen} onOpenChange={setIsPostponeOpen} appointment={selectedAppointment} />}
            </div>
        </main>
    );
}
