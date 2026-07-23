'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Clock, History, Activity, ClipboardCheck, ChevronLeft, ChevronRight, Zap, BellRing, UserCheck, AlertCircle, PlayCircle, LogIn, CheckCircle2, User, FileText, Stethoscope, Eye, CreditCard, X, ShieldCheck } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const AppointmentRow = ({ 
    apt, 
    patient, 
    onSelect, 
    onPreview,
    isMounted, 
    nowTicker 
}: { 
    apt: Appointment, 
    patient?: Patient, 
    onSelect: (a: Appointment) => void, 
    onPreview: (url: string) => void,
    isMounted: boolean, 
    nowTicker: Date | null 
}) => {
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
                        {apt.patientCheckedIn && <Badge className="bg-green-100 text-green-700 border-green-200 h-3.5 text-[6px] px-1.5 font-bold uppercase">Arrived</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground uppercase">{format(appointmentDate, "p")}</p>
                        {apt.paymentReceiptUrl && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 text-slate-400 hover:text-primary transition-colors" 
                                onClick={(e) => { e.stopPropagation(); onPreview(apt.paymentReceiptUrl!); }}
                            >
                                <Eye className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isLive && apt.status === 'scheduled' && <Badge className="bg-red-600 text-white animate-pulse text-[8px] h-4 uppercase px-1.5">Live</Badge>}
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
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

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

    useEffect(() => {
        if (showArrivalDialog) {
            const autoDismiss = setTimeout(() => {
                setShowArrivalDialog(false);
            }, 15000);
            return () => clearTimeout(autoDismiss);
        }
    }, [showArrivalDialog]);

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
        
        const viewDay = appointments
            .filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), viewDate))
            .sort((a,b) => b.appointmentDateTime.localeCompare(a.appointmentDateTime));
            
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
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2">
                             <Stethoscope className="h-3 w-3" /> Professional Hub
                        </div>
                        <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-900">Doctors Portal</h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Precision Clinical Intelligence & Practice Management
                        </p>
                    </div>
                    <Card className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-none flex items-center gap-6">
                        <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary shadow-inner">
                            <Zap className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Today's Revenue</p>
                            <p className="text-2xl font-bold tracking-tight">PKR {stats.todayRevenue.toLocaleString()}</p>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-8">
                         <Card className="bg-primary text-white rounded-[2rem] shadow-2xl overflow-hidden border-none">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-xl flex items-center gap-3 font-headline">
                                    <Zap className="h-6 w-6 text-white" /> Rapid Operations
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 pt-0 space-y-3">
                                <Button variant="outline" className="w-full justify-start h-12 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl font-bold" asChild>
                                    <Link href="/doctor-portal/patients">
                                        <ClipboardCheck className="mr-3 h-4 w-4" /> Patient Records
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-12 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl font-bold" asChild>
                                    <Link href="/doctor-portal/unavailability">
                                        <Clock className="mr-3 h-4 w-4" /> Clinical Pause
                                    </Link>
                                </Button>
                            </CardContent>
                         </Card>
                         
                         <Card className="bg-white rounded-[2rem] shadow-xl overflow-hidden border-none">
                            <CardHeader className="bg-primary/5 p-6 border-b">
                                <CardTitle className="text-[11px] uppercase font-bold flex items-center gap-2 text-primary tracking-widest">
                                    <ClipboardCheck className="h-4 w-4" /> Live Patient Queue
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAppointments ? (
                                    <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto opacity-10" /></div>
                                ) : activeQueue.length > 0 ? (
                                    <div className="divide-y divide-slate-50">
                                        {activeQueue.map(apt => (
                                            <AppointmentRow 
                                                key={apt.id} 
                                                apt={apt} 
                                                patient={patientsMap.get(apt.patientId)} 
                                                onSelect={(a)=>{setSelectedApt(a);setIsConsultOpen(true)}} 
                                                onPreview={(url) => setReceiptPreview(url)}
                                                isMounted={true} 
                                                nowTicker={nowTicker} 
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center">
                                        <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-[10px] font-bold uppercase text-slate-300">No active queue</p>
                                    </div>
                                )}
                            </CardContent>
                         </Card>
                    </div>

                    <div className="lg:col-span-8">
                        <Card className="rounded-[2.5rem] bg-white shadow-2xl border-none overflow-hidden h-full flex flex-col">
                            <CardHeader className="border-b bg-slate-900 text-white p-8 flex flex-row justify-between items-center shrink-0">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-headline flex items-center gap-3">
                                        <Clock className="h-6 w-6 text-primary" /> Daily Timeline
                                    </CardTitle>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Consultations</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setViewDate(subDays(viewDate, 1))}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider">{format(viewDate, "MMM dd")}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setViewDate(addDays(viewDate, 1))}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col justify-center min-h-[450px]">
                                {timelineApts.length > 0 ? (
                                    <div className="relative w-full px-12">
                                        <Carousel opts={{ align: "start", loop: false }} className="w-full">
                                            <CarouselContent className="-ml-4">
                                                {timelineApts.map(apt => {
                                                    const patient = patientsMap.get(apt.patientId);
                                                    return (
                                                        <CarouselItem key={apt.id} className="pl-4 md:basis-1/2 lg:basis-1/2 xl:basis-1/2">
                                                            <Card className="border-2 border-slate-50 bg-slate-50/30 rounded-[2.5rem] hover:border-primary/20 transition-all group p-6 h-full flex flex-col justify-between shadow-sm hover:shadow-md">
                                                                <div className="space-y-4">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center border shadow-inner">
                                                                            <User className="h-6 w-6 text-slate-400" />
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-2">
                                                                            <Badge variant="outline" className="text-[8px] font-bold uppercase border-slate-200 bg-white">
                                                                                {format(new Date(apt.appointmentDateTime), "p")}
                                                                            </Badge>
                                                                            {apt.paymentReceiptUrl && (
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="sm" 
                                                                                    className="h-7 w-7 rounded-xl bg-white border hover:text-primary p-0 shadow-sm"
                                                                                    onClick={() => setReceiptPreview(apt.paymentReceiptUrl!)}
                                                                                >
                                                                                    <Eye className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900 text-lg line-clamp-1">{patient?.firstName} {patient?.lastName || '...'}</p>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">{apt.appointmentType}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 pt-2">
                                                                        <Badge variant={apt.status === 'completed' ? 'secondary' : 'outline'} className={cn("text-[8px] font-bold uppercase", apt.status === 'completed' ? "bg-green-100 text-green-700" : "")}>
                                                                            {apt.status}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="text-[8px] font-bold uppercase border-primary/20 text-primary">PKR 1,500</Badge>
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    onClick={() => {setSelectedApt(apt);setIsConsultOpen(true)}} 
                                                                    className="w-full mt-6 rounded-2xl font-bold h-12 text-[10px] uppercase border-2 bg-white group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all shadow-sm"
                                                                >
                                                                    Audit Record
                                                                </Button>
                                                            </Card>
                                                        </CarouselItem>
                                                    );
                                                })}
                                            </CarouselContent>
                                            <CarouselPrevious className="-left-6 bg-white border-2 shadow-lg h-12 w-12 rounded-2xl" />
                                            <CarouselNext className="-right-6 bg-white border-2 shadow-lg h-12 w-12 rounded-2xl" />
                                        </Carousel>
                                    </div>
                                ) : (
                                    <div className="py-24 text-center text-slate-200 animate-in fade-in zoom-in-95">
                                        <Clock className="h-20 w-20 mx-auto mb-6 opacity-5" />
                                        <p className="font-bold uppercase text-[10px] tracking-[0.3em] text-slate-300">No scheduled sessions</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <DialogPrimitive.Root open={isConsultOpen} onOpenChange={setIsConsultOpen}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 animate-in fade-in duration-200" />
                        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl z-50 focus:outline-none animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-900 p-8 text-white relative">
                                <h2 className="text-2xl font-headline">Clinical Record</h2>
                                <DialogPrimitive.Close className="absolute right-6 top-6 text-white/50 hover:text-white"><X className="h-5 w-5" /></DialogPrimitive.Close>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/10 text-primary font-bold">{patientsMap.get(selectedApt?.patientId || '')?.firstName?.[0]}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="font-bold text-lg">{patientsMap.get(selectedApt?.patientId || '')?.firstName} {patientsMap.get(selectedApt?.patientId || '')?.lastName}</p>
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Identity Verified</p>
                                        </div>
                                    </div>
                                    {selectedApt?.paymentReceiptUrl && (
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl border-2 shadow-sm text-primary"
                                            onClick={() => setReceiptPreview(selectedApt.paymentReceiptUrl!)}
                                        >
                                            <Eye className="h-5 w-5" />
                                        </Button>
                                    )}
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
                                            <div className="space-y-1"><p className="text-[10px] font-bold uppercase">{selectedApt?.patientCheckedIn ? "Presence Confirmed" : "Awaiting Patient"}</p><p className="text-[9px] leading-tight">Start is only enabled once the patient completes their digital check-in.</p></div>
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

                {/* BUBBLE-UP RECEIPT PREVIEW DIALOG */}
                <Dialog open={!!receiptPreview} onOpenChange={(open) => !open && setReceiptPreview(null)}>
                    <DialogContent className="w-[95vw] max-w-4xl rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                        <div className="bg-slate-950 p-6 sm:p-8 text-white flex justify-between items-center shrink-0 border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/20 rounded-[1.25rem] border border-primary/30">
                                    <ShieldCheck className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="font-headline text-lg sm:text-xl tracking-tight">Audit Confirmation</h3>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em]">Clinical Settlement Secure View</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setReceiptPreview(null)} className="h-12 w-12 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all">
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="p-4 sm:p-12 bg-slate-100 flex items-center justify-center min-h-[400px] max-h-[85vh] overflow-y-auto custom-scrollbar">
                            {receiptPreview && (
                                <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
                                    <img 
                                        src={receiptPreview} 
                                        alt="Payment Evidence" 
                                        className="max-w-full h-auto object-contain rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border-[6px] sm:border-[12px] border-white ring-1 ring-slate-200 animate-in zoom-in-95 duration-500"
                                    />
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

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