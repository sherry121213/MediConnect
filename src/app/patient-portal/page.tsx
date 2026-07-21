
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, Stethoscope, Clock, History, ChevronRight, FileText, RefreshCw, CalendarIcon, ShieldCheck, PhoneIncoming, X, HelpCircle, AlertCircle, CheckCircle2, XCircle, Siren, Layers, BellRing } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isAfter, isSameDay, isBefore, isValid, addMinutes, parse } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { getNext7Days } from "@/lib/time";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function PostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (o: boolean) => void, appointment: any }) {
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

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return doc(firestore, 'doctors', appointment.doctorId);
    }, [firestore, appointment?.doctorId]);
    const { data: doctor } = useDoc<Doctor>(doctorDocRef);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', appointment.doctorId));
    }, [firestore, appointment?.doctorId]);
    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const selectedTimeStr = useMemo(() => `${selectedHour}:${selectedMinute} ${selectedPeriod}`, [selectedHour, selectedMinute, selectedPeriod]);

    const timeValidation = useMemo(() => {
        if (!existingAppointments || !selectedDate || !selectedTimeStr) return { isAvailable: true, message: '' };

        const proposedStart = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        if (!isValid(proposedStart)) return { isAvailable: false, message: 'Invalid time selection.' };

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

        if (overlap) return { isAvailable: false, message: 'This clinical window is already booked.' };

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
            readyToStart: false,
            queueStatus: 'waiting'
        });

        toast({ title: "Clinical Session Rescheduled", description: `Your visit with Dr. ${doctor?.lastName} is now set for ${format(newDateTime, "PPP p")}.` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-primary p-6 sm:p-8 text-white shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">Reschedule Clinical Session</DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 mt-1 font-medium">Adjust your precision start time (10 AM - 9 PM).</DialogDescription>
                </div>
                <div className="flex-1 overflow-y-auto bg-white overscroll-contain custom-scrollbar">
                    <div className="p-4 sm:p-8 space-y-8 pb-32">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Step 1: Choose Date</p>
                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
                                {availableDates.map(day => (
                                    <button 
                                        key={day.date.toISOString()}
                                        onClick={() => { setSelectedDate(day.date); }}
                                        className={cn(
                                            "p-4 rounded-3xl border-2 transition-all shrink-0 w-24 sm:w-28 text-center flex flex-col items-center justify-center gap-1",
                                            isSameDay(selectedDate, day.date) ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background hover:bg-muted border-slate-100'
                                        )}
                                    >
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">{day.dayName}</p>
                                        <p className="text-lg sm:text-xl font-bold font-headline text-slate-900">{format(day.date, "dd")}</p>
                                        <p className="text-[10px] text-muted-foreground">{format(day.date, "MMM")}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-8">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 2: Precise Adjustment</p>
                            <div className="p-4 sm:p-6 border-4 border-dashed rounded-[2rem] bg-slate-50/50 space-y-6">
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Hour</Label>
                                        <Select value={selectedHour} onValueChange={setSelectedHour}>
                                            <SelectTrigger className="h-10 sm:h-12 rounded-xl border-2 bg-white font-bold text-xs sm:text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                                {availableHours.map(h => (
                                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Minute</Label>
                                        <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                            <SelectTrigger className="h-10 sm:h-12 rounded-xl border-2 bg-white font-bold text-xs sm:text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[200px] rounded-xl border-none shadow-xl">
                                                {availableMinutes.map(m => (
                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Period</Label>
                                        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                            <SelectTrigger className="h-10 sm:h-12 rounded-xl border-2 bg-white font-bold text-xs sm:text-sm">
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
                                
                                {selectedTimeStr && !timeValidation.isAvailable ? (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <p className="text-[10px] text-red-800 font-bold uppercase">{timeValidation.message}</p>
                                    </div>
                                ) : selectedTimeStr ? (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <p className="text-[10px] text-green-800 font-bold uppercase">Valid: {selectedTimeStr}</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 sm:p-8 border-t bg-slate-50 shrink-0 mt-auto">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="ghost" className="flex-1 h-12 sm:h-14 rounded-2xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="flex-1 h-12 sm:h-14 rounded-2xl font-bold shadow-2xl shadow-primary/20 bg-primary text-white" disabled={!timeValidation.isAvailable || isSaving} onClick={handleConfirm}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Move"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const AppointmentCard = ({ apt, isUpcoming, onPostpone, isMounted, variant = 'default' }: { apt: any, isUpcoming: boolean, onPostpone: (a: any) => void, isMounted: boolean, variant?: 'default' | 'compact' }) => {
    const firestore = useFirestore();
    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !apt?.doctorId) return null;
        return doc(firestore, 'doctors', apt.doctorId);
    }, [firestore, apt?.doctorId]);
    
    const { data: doctor, isLoading: isLoadingDoctor } = useDoc<Doctor>(doctorDocRef);
    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;
    
    const appointmentDate = useMemo(() => {
        if (!apt?.appointmentDateTime) return null;
        const d = new Date(apt.appointmentDateTime);
        return isValid(d) ? d : null;
    }, [apt?.appointmentDateTime]);
    
    const now = isMounted ? Date.now() : 0;
    const bufferTime = appointmentDate ? appointmentDate.getTime() - (5 * 60 * 1000) : 0; 
    const startTime = appointmentDate ? appointmentDate.getTime() : 0; 
    const endTime = appointmentDate ? appointmentDate.getTime() + (15 * 60 * 1000) : 0; 
    
    const isLive = isMounted && now >= startTime && now < endTime;
    const isFlexibleBuffer = isMounted && now >= bufferTime && now < startTime;
    const isExpired = isMounted && now >= endTime;

    if (!apt || !appointmentDate) return null;

    const photoSrc = doctor?.photoURL || doctorImage?.imageUrl;

    const handleJoin = () => {
        if (!isLive && !(isFlexibleBuffer && apt.readyToStart)) return;
        window.location.assign(`/consultation/${apt.id}`);
    };

    if (variant === 'compact') {
        return (
            <Card className="h-full border-none shadow-md bg-white rounded-2xl overflow-hidden group hover:shadow-xl transition-all" asChild>
                <div className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center gap-3">
                         <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-primary/5">
                            {photoSrc ? <Image src={photoSrc} alt="Doctor" fill className="object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold text-primary">{doctor?.firstName?.[0]}</div>}
                         </div>
                         <div className="min-w-0">
                            <p className="font-bold text-xs truncate">Dr. {doctor?.lastName || '...'}</p>
                            <p className="text-[8px] text-primary uppercase font-bold tracking-tight truncate">{doctor?.specialty || 'Professional'}</p>
                         </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                            <CalendarIcon className="h-3 w-3" /> {format(appointmentDate, "MMM dd")}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                            <Clock className="h-3 w-3" /> {format(appointmentDate, "p")}
                        </div>
                    </div>
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                         <Badge className={cn("text-[8px] sm:text-[10px] uppercase font-bold px-2 py-0.5 shrink-0 h-auto", apt.status === 'completed' ? "bg-green-100 text-green-800" : (isExpired || apt.status === 'expired') ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600")}>
                            {apt.status === 'completed' ? 'Performed' : (isExpired || apt.status === 'expired') ? 'Missed' : apt.status}
                        </Badge>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[9px] font-bold text-primary shrink-0">
                            <Link href={`/appointments/${apt.id}`}>View Record</Link>
                        </Button>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all border-l-4 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl",
            (isLive || (isFlexibleBuffer && apt.readyToStart)) && apt.paymentStatus === 'approved' ? "border-l-red-500 bg-red-50/10 shadow-md scale-[1.01]" : "border-l-primary/40",
            (isExpired || apt.status === 'expired') && "opacity-80 border-l-destructive/40"
        )} asChild>
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-8">
                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                    <div className="relative h-12 w-12 sm:h-16 sm:w-16 shrink-0 shadow-inner rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {isLoadingDoctor ? (
                             <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : photoSrc ? (
                            <Image
                                src={photoSrc}
                                alt={doctor?.firstName || 'Doctor'}
                                fill
                                className="object-cover border-2 border-primary/5"
                                data-ai-hint="doctor portrait"
                            />
                        ) : (
                            <div className="h-full w-full bg-primary/5 flex items-center justify-center text-primary font-bold text-lg">
                                {doctor?.firstName?.[0] || 'D'}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <p className="font-bold text-base sm:text-lg leading-tight tracking-tight truncate max-w-full">
                                {isLoadingDoctor ? 'Loading...' : `Dr. ${doctor?.firstName} ${doctor?.lastName}`}
                            </p>
                            {(isLive || (isFlexibleBuffer && apt.readyToStart)) && apt.status === 'scheduled' && apt.paymentStatus === 'approved' && <Badge className="bg-red-600 text-white animate-pulse h-4 text-[7px] px-1.5 uppercase font-bold">LIVE</Badge>}
                        </div>
                        <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider opacity-80 truncate">{doctor?.specialty || 'Medical Specialist'}</p>
                        <div className="flex wrap items-center gap-1.5 sm:gap-2 pt-1">
                            <Badge variant="secondary" className="bg-primary/5 text-primary-dark border-primary/10 flex items-center gap-1 px-1.5 text-[8px] sm:text-[10px] font-bold">
                                <CalendarIcon className="w-2.5 h-2.5" /> {format(appointmentDate, "MMM dd")}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1 px-1.5 text-[8px] sm:text-[10px] font-bold">
                                <Clock className="w-2.5 h-2.5" /> {format(appointmentDate, "p")}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                    {apt.paymentStatus === 'pending' ? (
                        <div className="flex flex-col gap-2 w-full min-w-[140px]">
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-3 py-2 font-bold text-[9px] sm:text-[10px] whitespace-nowrap w-full justify-center h-auto">
                                <Clock className="w-3 h-3 mr-1.5" /> Reviewing Payment
                            </Badge>
                        </div>
                    ) : isUpcoming && !isExpired && apt.status === 'scheduled' ? (
                        <div className="flex flex-row sm:flex-col gap-2 w-full">
                            {(!isLive && !(isFlexibleBuffer && apt.readyToStart)) && (
                                <Button variant="outline" size="sm" className="font-bold border-2 h-9 flex-1 sm:w-auto text-[10px]" onClick={() => onPostpone(apt)}>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reschedule
                                </Button>
                            )}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className={cn("font-bold h-9 flex-1 sm:w-auto transition-all", (isLive || (isFlexibleBuffer && apt.readyToStart)) ? "bg-red-600 hover:bg-red-700 animate-pulse" : "opacity-70 cursor-not-allowed")} disabled={!isLive && !(isFlexibleBuffer && apt.readyToStart)}>
                                        {(isLive || (isFlexibleBuffer && apt.readyToStart)) ? "Join Clinical Room" : "Upcoming"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] sm:max-w-lg rounded-3xl border-none shadow-2xl bg-white animate-in zoom-in-95 duration-200">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-headline">Clinical Connection</DialogTitle>
                                        <DialogDescription>
                                            {isLive ? `Secure session closes at ${format(addMinutes(appointmentDate, 15), "p")}.` : `Secure session opens at ${format(appointmentDate, "p")}.`}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Button variant="outline" className="w-full justify-start h-20 border-2 hover:border-primary group bg-muted/5 rounded-2xl" onClick={handleJoin}>
                                            <Video className="mr-4 h-6 w-6 text-primary shrink-0"/> <div className="text-left"><p className="font-bold text-foreground">Professional Consultation</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">HD Video Feed Active</p></div>
                                        </Button>
                                    </div>
                                    {!isLive && isFlexibleBuffer && apt.readyToStart && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-pulse">
                                            <Siren className="h-5 w-5 text-red-600 shrink-0" />
                                            <p className="text-xs text-red-800 font-bold">Your doctor is ready to start early.</p>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                    ) : (
                        <div className="flex flex-row sm:flex-col gap-2 w-full">
                             <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5 flex-1 sm:w-auto justify-center h-9 text-[10px]">
                                <Link href={`/appointments/${apt.id}`}><FileText className="h-4 w-4" /> View Summary</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
};

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [mounted, setMounted] = useState(false);
    const [selectedApt, setSelectedApt] = useState<any>(null);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);
    const [nowState, setNowState] = useState(Date.now());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNowState(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { upcomingAppointments, recentPastAppointments, ringingApt, activeQueueApt } = useMemo(() => {
        if (!mounted || !appointments) return { upcomingAppointments: [], recentPastAppointments: [], ringingApt: null, activeQueueApt: null };
        
        const now = new Date();
        const validAppointments = appointments.filter(apt => apt !== null && apt.id && apt.appointmentDateTime);

        // Active Queue Logic
        const queueApt = validAppointments.find(apt => 
            apt.status === 'scheduled' && 
            apt.paymentStatus === 'approved' &&
            apt.queueStatus && apt.queueStatus !== 'completed' &&
            isSameDay(new Date(apt.appointmentDateTime), now)
        );

        const currentRinging = validAppointments.find(apt => 
            (apt.doctorInRoom === true || apt.readyToStart === true) && 
            apt.status === 'scheduled' && 
            apt.paymentStatus === 'approved' &&
            (now.getTime() >= new Date(apt.appointmentDateTime).getTime() - (15 * 60 * 1000)) &&
            (now.getTime() < new Date(apt.appointmentDateTime).getTime() + (15 * 60 * 1000))
        );

        const upcoming = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (15 * 60 * 1000); 
                const isMissed = now.getTime() > endTime;
                return !isMissed && (apt.status === 'scheduled' || apt.status === 'expired');
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (15 * 60 * 1000); 
                return now.getTime() > endTime || apt.status === 'completed' || apt.status === 'expired';
            })
            .sort((a, b) => b.appointmentDateTime.localeCompare(a.appointmentDateTime))
            .slice(0, 10);

        return { upcomingAppointments: upcoming, recentPastAppointments: past, ringingApt: currentRinging, activeQueueApt: queueApt };
    }, [appointments, mounted, nowState]);

    const handlePostpone = (apt: any) => {
        setSelectedApt(apt);
        setIsPostponeOpen(true);
    };

    if (!mounted || isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-secondary/30"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>;

    return (
        <main className="min-h-screen flex flex-col bg-secondary/30 py-6 sm:py-10 overflow-x-hidden">
            <div className="container mx-auto px-4 lg:px-8 max-w-7xl flex-1 pb-24">
                {ringingApt && (
                    <div className="mb-6 sm:mb-8 animate-in slide-in-from-top-4 duration-500">
                        <Card className="bg-red-600 text-white border-none shadow-2xl overflow-hidden rounded-3xl">
                            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                                        <BellRing className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">Early Signal Received</p>
                                        <p className="text-base sm:text-lg font-bold">Doctor is available to start early.</p>
                                    </div>
                                </div>
                                <Button asChild className="bg-white text-red-600 hover:bg-slate-100 font-bold px-8 h-10 sm:h-12 rounded-2xl w-full sm:w-auto shadow-lg">
                                    <Link href={`/consultation/${ringingApt.id}`}>Join Now</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md rounded-[2rem]">
                            <CardHeader className="bg-primary text-primary-foreground p-6 sm:p-10">
                                <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] opacity-80">Patient Portal</CardTitle>
                                <CardDescription className="text-2xl sm:text-3xl font-bold font-headline text-white mt-3 truncate">Hello, {userData?.firstName}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-8 space-y-3">
                                <Button className="w-full justify-start h-14 sm:h-16 text-sm font-bold shadow-xl shadow-primary/20 rounded-2xl" asChild><Link href="/find-a-doctor"><PlusCircle className="mr-3 h-5 w-5" /> Book Session</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-14 sm:h-16 text-sm font-bold border-2 rounded-2xl hover:bg-primary/5 transition-all" asChild><Link href="/patient-portal/messages"><MessageSquare className="mr-3 h-5 w-5 text-primary" /> Care Center</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-14 sm:h-16 text-sm font-bold border-2 rounded-2xl hover:bg-primary/5 transition-all" asChild><Link href="/patient-portal/history"><History className="mr-3 h-5 w-5 text-primary" /> My History</Link></Button>
                            </CardContent>
                        </Card>

                        {activeQueueApt && (
                            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-[2rem]">
                                <CardHeader className="bg-primary/10 border-b border-white/5 p-6">
                                    <CardTitle className="text-[10px] uppercase font-bold tracking-widest text-primary flex items-center gap-2">
                                        <Layers className="h-4 w-4" /> Live Queue Monitor
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[8px] uppercase font-bold text-slate-500">Your Position</p>
                                            <p className="text-3xl font-bold text-white">#{activeQueueApt.sequencePosition}</p>
                                        </div>
                                        <Badge className={cn(
                                            "h-6 px-3 rounded-full text-[8px] font-bold uppercase",
                                            activeQueueApt.queueStatus === 'in-consultation' ? "bg-green-600 animate-pulse" :
                                            activeQueueApt.queueStatus === 'shifted' ? "bg-amber-600" : "bg-primary"
                                        )}>
                                            {activeQueueApt.queueStatus?.replace('-', ' ')}
                                        </Badge>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                                        {activeQueueApt.queueStatus === 'shifted' ? (
                                            <p className="text-[10px] text-amber-400 italic">"You were bypassed/late and shifted to the end of the current block."</p>
                                        ) : activeQueueApt.queueStatus === 'in-consultation' ? (
                                            <p className="text-[10px] text-green-400 font-bold uppercase">"It is your turn! Please join the clinical room now."</p>
                                        ) : activeQueueApt.sequencePosition === 1 ? (
                                            <p className="text-[10px] text-slate-300">"You are next in line. Please stay on this page."</p>
                                        ) : (
                                            <p className="text-[10px] text-slate-400">"Average wait: 5-10 mins per patient."</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-[2rem] hidden lg:block">
                            <CardContent className="p-8 space-y-4 text-center">
                                <HelpCircle className="h-8 w-8 text-primary mx-auto" />
                                <div>
                                    <h4 className="font-bold text-base">Administrative Help</h4>
                                    <p className="text-xs text-slate-400 mt-1">Facing issues? Chat with us instantly via the Support Messenger below.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-10">
                        <section>
                            <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-4 mb-6">
                                <div className="h-6 sm:h-8 w-1.5 bg-primary rounded-full shrink-0"></div>
                                Scheduled Sessions
                            </h2>
                            {isLoadingAppointments ? <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div> : 
                             upcomingAppointments.length === 0 ? <Card className="border-dashed border-2 bg-transparent rounded-[2.5rem]"><CardContent className="py-16 text-center text-muted-foreground text-sm">No upcoming clinical sessions scheduled.</CardContent></Card> :
                             <div className="space-y-4">{upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}</div>}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-4">
                                    <div className="h-6 sm:h-8 w-1.5 bg-muted rounded-full shrink-0"></div>
                                    Clinical History
                                </h2>
                                {recentPastAppointments.length > 0 && <Link href="/patient-portal/history" className="text-primary font-bold text-xs hover:underline flex items-center">Archive <ChevronRight className="h-3 w-3" /></Link>}
                            </div>
                            
                            {recentPastAppointments.length > 0 ? (
                                <Carousel
                                    opts={{ align: "start", loop: false }}
                                    className="w-full"
                                >
                                    <CarouselContent className="-ml-2 sm:-ml-4">
                                        {recentPastAppointments.map(apt => (
                                            <CarouselItem key={apt.id} className="pl-2 sm:pl-4 basis-[85%] sm:basis-1/2">
                                                <AppointmentCard apt={apt} isUpcoming={false} onPostpone={handlePostpone} isMounted={mounted} variant="compact" />
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <div className="hidden sm:flex justify-end gap-2 mt-4">
                                        <CarouselPrevious className="relative translate-y-0 left-0" />
                                        <CarouselNext className="relative translate-y-0 right-0" />
                                    </div>
                                </Carousel>
                            ) : (
                                <div className="text-center py-12 bg-muted/10 rounded-[2.5rem] border-2 border-dashed">
                                    <p className="text-muted-foreground text-xs italic font-medium">No past clinical sessions logged.</p>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
            {selectedApt && <PostponeDialog isOpen={isPostponeOpen} onOpenChange={setIsPostponeOpen} appointment={selectedApt} />}
        </main>
    )
}
