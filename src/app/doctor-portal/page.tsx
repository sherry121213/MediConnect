
'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Clock, History, Activity, ClipboardCheck, ChevronLeft, ChevronRight, Zap, BellRing, UserCheck, AlertCircle, PlayCircle, LogIn, CheckCircle2, User, FileText } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserData, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs, updateDoc } from "firebase/firestore";
import type { Appointment, Patient } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, subDays, addDays, addMinutes, isAfter } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const AppointmentRow = ({ apt, patient, onSelect, isMounted, nowTicker }: { apt: Appointment, patient?: Patient, onSelect: (a: Appointment) => void, isMounted: boolean, nowTicker: Date | null }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const appointmentDate = new Date(apt.appointmentDateTime);
    const now = nowTicker ? nowTicker.getTime() : 0;
    const startTime = appointmentDate.getTime();
    const endTime = startTime + (20 * 60 * 1000);
    const isLive = isMounted && now >= startTime && now < endTime;

    const handleNotifyPatient = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!firestore || !apt.id) return;
        updateDoc(doc(firestore, 'appointments', apt.id), { readyToStart: true });
        toast({ title: "Early Signal Sent", description: "Patient notified you are ready." });
    };

    return (
        <div className={cn("flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-all cursor-pointer", isLive && "bg-primary/5 border-primary/20")} onClick={() => onSelect(apt)}>
            <div className="flex items-center gap-3 min-w-0">
                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 border border-slate-200">
                    {apt.sequencePosition || '-'}
                </div>
                <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs bg-slate-100">{patient?.firstName?.[0]}{patient?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : '...'}</p>
                        {apt.patientCheckedIn && <Badge className="bg-green-100 text-green-700 border-green-200 h-3.5 text-[6px] px-1.5 font-bold uppercase">Patient Arrived</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">{format(appointmentDate, "p")}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isLive && apt.status === 'scheduled' && <Badge className="bg-red-600 text-white animate-pulse text-[8px] h-4 uppercase px-1.5">Live Window</Badge>}
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-full", apt.readyToStart ? "text-primary" : "text-slate-400")} onClick={handleNotifyPatient}>
                    <BellRing className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default function DoctorPortalPage() {
    const { user, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [isConsultOpen, setIsConsultOpen] = useState(false);
    const [arrivalApt, setArrivalApt] = useState<Appointment | null>(null);
    const [showArrivalDialog, setShowArrivalDialog] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [patientsMap, setPatientsMap] = useState<Map<string, Patient>>(new Map());
    const [nowTicker, setNowTicker] = useState<Date | null>(null);

    useEffect(() => { 
        setNowTicker(new Date());
        const timer = setInterval(() => setNowTicker(new Date()), 15000);
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', user.uid), where('paymentStatus', '==', 'approved'));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    // AUTO-HIDE ARRIVAL DIALOG AFTER 15 SECONDS
    useEffect(() => {
        if (showArrivalDialog) {
            const autoDismiss = setTimeout(() => {
                setShowArrivalDialog(false);
            }, 15000);
            return () => clearTimeout(autoDismiss);
        }
    }, [showArrivalDialog]);

    // REAL-TIME ARRIVAL POP-UP LOGIC
    useEffect(() => {
        if (!appointments || !nowTicker) return;
        
        const arrivedApt = appointments.find(apt => 
            apt && 
            apt.status === 'scheduled' && 
            apt.patientCheckedIn && 
            !apt.doctorInRoom &&
            isSameDay(new Date(apt.appointmentDateTime), nowTicker)
        );

        if (arrivedApt && arrivedApt.id !== arrivalApt?.id) {
            setArrivalApt(arrivedApt);
            setShowArrivalDialog(true);
        }
    }, [appointments, nowTicker, arrivalApt]);

    useEffect(() => {
        if (!appointments || !firestore) return;
        const fetchPatients = async () => {
            const pIds = Array.from(new Set(appointments.map(a => a?.patientId).filter(Boolean)));
            if (pIds.length === 0) return;
            const newMap = new Map<string, Patient>(patientsMap);
            const missing = pIds.filter(id => !newMap.has(id));
            if (missing.length === 0) return;
            const q = query(collection(firestore, 'patients'), where('id', 'in', missing.slice(0, 30)));
            const snap = await getDocs(q);
            snap.forEach(doc => newMap.set(doc.id, doc.data() as Patient));
            setPatientsMap(newMap);
        };
        fetchPatients();
    }, [appointments, firestore]);

    const { activeQueue, timelineApts, stats } = useMemo(() => {
        if (!appointments || !nowTicker) return { activeQueue: [], timelineApts: [], stats: { todayRevenue: 0 } };
        const allToday = appointments.filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), nowTicker));
        const viewDay = appointments.filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), viewDate)).sort((a,b) => a.appointmentDateTime.localeCompare(b.appointmentDateTime));
        const activeQ = allToday.filter(apt => apt.status === 'scheduled' && isAfter(addMinutes(new Date(apt.appointmentDateTime), 20), nowTicker)).sort((a, b) => (a.sequencePosition || 0) - (b.sequencePosition || 0));
        const revenue = allToday.reduce((sum, a) => sum + (a.amount || 1500), 0);
        return { activeQueue: activeQ, timelineApts: viewDay, stats: { todayRevenue: revenue } };
    }, [appointments, viewDate, nowTicker]);

    const handleStartSession = async (apt: Appointment) => {
        if (!firestore || !apt.patientCheckedIn) {
            toast({ variant: 'destructive', title: "Entry Restricted", description: "Please wait for patient check-in." });
            return;
        }
        await updateDoc(doc(firestore, 'appointments', apt.id), {
            doctorInRoom: true,
            queueStatus: 'in-consultation',
            updatedAt: new Date().toISOString()
        });
        window.location.assign(`/consultation/${apt.id}`);
    };

    if (isUserLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="min-h-screen bg-slate-50/50 py-10 px-4">
            <div className="max-w-7xl mx-auto space-y-10 pb-20">
                <div className="flex justify-between items-end">
                    <div><h1 className="text-3xl font-bold font-headline">Practice Control</h1><p className="text-muted-foreground text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Precision Schedule</p></div>
                    <Card className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20"><p className="text-[10px] font-bold uppercase opacity-80">Today's Revenue</p><p className="text-xl font-bold">PKR {stats.todayRevenue.toLocaleString()}</p></Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-8">
                         <Card className="bg-slate-900 text-white rounded-[2rem] shadow-2xl overflow-hidden"><CardHeader className="p-8"><CardTitle className="text-lg flex items-center gap-3"><Zap className="h-6 w-6 text-primary" /> Practice Center</CardTitle></CardHeader><CardContent className="p-8 pt-0 space-y-3"><Button variant="outline" className="w-full justify-start h-12 bg-white/5 border-none hover:bg-white/10" asChild><Link href="/doctor-portal/patients">Clinical Records</Link></Button><Button variant="outline" className="w-full justify-start h-12 bg-white/5 border-none hover:bg-white/10" asChild><Link href="/doctor-portal/unavailability">Pause Practice</Link></Button></CardContent></Card>
                         <Card className="bg-white rounded-3xl shadow-xl overflow-hidden"><CardHeader className="bg-primary/5 p-6"><CardTitle className="text-[10px] uppercase font-bold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /> Back-to-Back Queue</CardTitle></CardHeader><CardContent className="p-0">{isLoadingAppointments ? <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto opacity-10" /></div> : activeQueue.length > 0 ? <div className="divide-y">{activeQueue.map(apt => <AppointmentRow key={apt.id} apt={apt} patient={patientsMap.get(apt.patientId)} onSelect={(a)=>{setSelectedApt(a);setIsConsultOpen(true)}} isMounted={true} nowTicker={nowTicker} />)}</div> : <div className="p-12 text-center text-[10px] font-bold uppercase text-slate-300">No active sequences</div>}</CardContent></Card>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="rounded-[2.5rem] bg-white shadow-xl overflow-hidden">
                            <CardHeader className="border-b bg-slate-50 p-8 flex flex-row justify-between items-center">
                                <CardTitle className="text-xl font-headline flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /> Timeline</CardTitle>
                                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border-2 shadow-sm">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(subDays(viewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                    <span className="px-2 text-[10px] font-bold uppercase">{format(viewDate, "MMM dd")}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(addDays(viewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 min-h-[300px]">
                                {timelineApts.length > 0 ? (
                                    <div className="space-y-4">{timelineApts.map(apt => (<div key={apt.id} className="flex items-center justify-between p-6 rounded-[1.5rem] border-2 border-slate-50 bg-white shadow-sm"><div><p className="font-bold">{patientsMap.get(apt.patientId)?.firstName} {patientsMap.get(apt.patientId)?.lastName}</p><p className="text-[10px] text-muted-foreground uppercase">{apt.appointmentType} • {format(new Date(apt.appointmentDateTime), "p")}</p></div><Button variant="outline" size="sm" onClick={() => {setSelectedApt(apt);setIsConsultOpen(true)}} className="rounded-xl font-bold h-9 px-4 text-[9px] uppercase border-2">Details</Button></div>))}</div>
                                ) : <div className="py-24 text-center text-slate-200"><Clock className="h-16 w-16 auto mx-auto mb-4" /><p className="font-bold uppercase text-xs">No Records Found</p></div>}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* CLINICAL SELECTION DIALOG */}
                <DialogPrimitive.Root open={isConsultOpen} onOpenChange={setIsConsultOpen}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 animate-in fade-in duration-200" />
                        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl z-50 focus:outline-none animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-900 p-8 text-white relative">
                                <h2 className="text-2xl font-headline">Clinical Record</h2>
                                <DialogPrimitive.Close className="absolute right-6 top-6 text-white/50 hover:text-white"><X className="h-5 w-5" /></DialogPrimitive.Close>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2">
                                    <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/10 text-primary font-bold">{patientsMap.get(selectedApt?.patientId || '')?.firstName?.[0]}</AvatarFallback></Avatar>
                                    <div><p className="font-bold text-lg">{patientsMap.get(selectedApt?.patientId || '')?.firstName} {patientsMap.get(selectedApt?.patientId || '')?.lastName}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Patient Identity Verified</p></div>
                                </div>

                                {selectedApt?.status === 'completed' ? (
                                    <div className="p-8 bg-green-50 border-2 border-green-100 rounded-3xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                                        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-green-800 text-lg">Consultation Completed</p>
                                            <p className="text-[10px] text-green-600 uppercase font-bold tracking-widest">Medical Record Finalized</p>
                                        </div>
                                        <Button variant="outline" className="w-full rounded-xl border-2 h-12 font-bold bg-white text-green-700 shadow-sm" asChild>
                                            <Link href={`/appointments/${selectedApt.id}`}>
                                                <FileText className="mr-2 h-5 w-5" /> View Clinical Summary
                                            </Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className={cn("p-4 rounded-2xl flex items-center gap-3 border-2 transition-all", selectedApt?.patientCheckedIn ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800")}>
                                            {selectedApt?.patientCheckedIn ? <UserCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                            <div className="space-y-1"><p className="text-[10px] font-bold uppercase">{selectedApt?.patientCheckedIn ? "Presence Confirmed" : "Patient Not Arrived"}</p><p className="text-[9px] leading-tight">Gated entry: Start is only enabled once the patient completes their digital check-in.</p></div>
                                        </div>
                                        <Button className="w-full h-16 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" disabled={!selectedApt?.patientCheckedIn} onClick={() => selectedApt && handleStartSession(selectedApt)}>
                                            {selectedApt?.patientCheckedIn ? <><Video className="mr-3 h-6 w-6" /> Start Consultation</> : "Waiting for Check-in..."}
                                        </Button>
                                        {!selectedApt?.patientCheckedIn && <Button variant="ghost" className="w-full text-[10px] uppercase font-bold text-muted-foreground hover:text-primary h-10" onClick={() => selectedApt && window.location.assign(`/consultation/${selectedApt.id}`)}><LogIn className="mr-2 h-3.5 w-3.5" /> Emergency Bypass</Button>}
                                    </>
                                )}
                            </div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>

                {/* PATIENT ARRIVAL DIALOG (AUTO-DISMISS AFTER 15S) */}
                <Dialog open={showArrivalDialog} onOpenChange={setShowArrivalDialog}>
                    <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-sm">
                        <div className="bg-green-600 p-8 text-white text-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center mx-auto border-4 border-white/20 animate-bounce">
                                <CheckCircle2 className="h-10 w-10 text-white" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-headline">Patient Arrived!</DialogTitle>
                                <DialogDescription className="text-green-50 font-medium">
                                    Token #{arrivalApt?.sequencePosition} is ready for clinical tunnel.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="p-8 space-y-6 bg-white">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{patientsMap.get(arrivalApt?.patientId || '')?.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold text-lg">{patientsMap.get(arrivalApt?.patientId || '')?.firstName} {patientsMap.get(arrivalApt?.patientId || '')?.lastName}</p>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Digital Check-in Verified</p>
                                </div>
                            </div>
                            <DialogFooter className="flex flex-col gap-3">
                                <Button className="w-full h-14 rounded-2xl font-bold bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100" onClick={() => arrivalApt && handleStartSession(arrivalApt)}>
                                    <Video className="mr-2 h-5 w-5" /> Open Room Now
                                </Button>
                                <Button variant="ghost" className="w-full h-12 rounded-xl text-slate-400 font-bold" onClick={() => setShowArrivalDialog(false)}>Ignore (Auto-dismiss in 15s)</Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}
