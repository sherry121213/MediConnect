'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, Stethoscope, Clock, History, ChevronRight, FileText, PhoneCall, RefreshCw, CalendarIcon, ShieldCheck, PhoneIncoming, X, HelpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useUserData, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isAfter, subHours, isSameDay, startOfDay, isBefore, isValid, addDays, addMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { getNext7Days, timeSlots } from "@/lib/time";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ScrollArea } from "@/components/ui/scroll-area";

function PostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (o: boolean) => void, appointment: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const availableDates = getNext7Days();

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return doc(firestore, 'doctors', appointment.doctorId);
    }, [firestore, appointment?.doctorId]);
    const { data: doctor } = useDoc<Doctor>(doctorDocRef);

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
            updatedAt: new Date().toISOString(),
            doctorInRoom: false 
        });

        toast({ title: "Session Rescheduled", description: `Your 30m visit with Dr. ${doctor?.lastName} is now set for ${format(newDateTime, "PPP p")}.` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-primary p-6 sm:p-8 text-white shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-headline">Reschedule Consultation</DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 mt-1 font-medium">Pick a new 30-minute clinical window.</DialogDescription>
                </div>
                <ScrollArea className="flex-1 bg-white">
                    <div className="p-6 sm:p-8 space-y-10 pb-20">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Step 1: Select Date</p>
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
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 2: Available 30m Slots</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[...timeSlots.morning, ...timeSlots.afternoon, ...timeSlots.evening].map(time => (
                                    <Button 
                                        key={time}
                                        variant={selectedTime === time ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedTime(time)}
                                        className={cn(
                                            "rounded-xl text-[10px] font-bold h-12 border-2",
                                            selectedTime === time ? "bg-primary border-primary text-white" : "border-slate-100"
                                        )}
                                        disabled={doctor?.availability?.disabledSlots?.includes(time)}
                                    >
                                        {time}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <div className="p-6 sm:p-8 border-t bg-slate-50 shrink-0">
                    <div className="flex gap-4">
                        <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="flex-1 h-14 rounded-2xl font-bold shadow-2xl shadow-primary/20 bg-primary text-white" disabled={!selectedTime || isSaving} onClick={handleConfirm}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Postpone"}
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
    const startTime = appointmentDate ? appointmentDate.getTime() - (10 * 60 * 1000) : 0; 
    const endTime = appointmentDate ? appointmentDate.getTime() + (30 * 60 * 1000) : 0; 
    
    const isLive = isMounted && now >= startTime && now < endTime;
    const isExpired = isMounted && now >= endTime;

    if (!apt || !appointmentDate) return null;

    const photoSrc = doctor?.photoURL || doctorImage?.imageUrl;

    const handleJoin = () => {
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
                            <p className="font-bold text-xs truncate">Dr. {doctor?.lastName}</p>
                            <p className="text-[8px] text-primary uppercase font-bold tracking-tight truncate">{doctor?.specialty}</p>
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
                         <Badge className={cn("text-[10px] uppercase font-bold px-2 py-0.5 shrink-0 h-auto", apt.status === 'completed' ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600")}>
                            {apt.status === 'completed' ? 'Performed' : apt.status}
                        </Badge>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[9px] font-bold text-primary shrink-0">
                            <Link href={`/appointments/${apt.id}`}>View</Link>
                        </Button>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all border-l-4 bg-card/50 backdrop-blur-sm overflow-hidden",
            isLive && apt.paymentStatus === 'approved' ? "border-l-red-500 bg-red-50/10 shadow-md scale-[1.01]" : "border-l-primary/40",
            (isExpired || apt.status === 'expired') && "opacity-60 border-l-destructive/40"
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
                            {isLive && apt.status === 'scheduled' && apt.paymentStatus === 'approved' && <Badge className="bg-red-600 text-white animate-pulse h-4 text-[7px] px-1.5 uppercase font-bold">LIVE</Badge>}
                            {(isExpired || apt.status === 'expired') && <Badge variant="destructive" className="h-4 text-[7px] px-1.5 uppercase font-bold">EXPIRED</Badge>}
                        </div>
                        <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider opacity-80 truncate">{doctor?.specialty || 'Medical Specialist'}</p>
                        <div className="flex wrap items-center gap-1.5 sm:gap-2 pt-1">
                            <Badge variant="secondary" className="bg-primary/5 text-primary-dark border-primary/10 flex items-center gap-1 px-1.5 text-[8px] sm:text-[10px] font-bold">
                                <CalendarIcon className="w-2.5 h-2.5" /> {format(appointmentDate, "MMM dd")}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1 px-1.5 text-[8px] sm:text-[10px] font-bold">
                                <Clock className="w-2.5 h-2.5" /> {format(appointmentDate, "p")} (30m)
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                    {apt.paymentStatus === 'pending' ? (
                        <div className="flex flex-col gap-2 w-full min-w-[150px]">
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-3 py-2 font-bold text-[9px] sm:text-[10px] whitespace-nowrap w-full justify-center h-auto">
                                <Clock className="w-3 h-3 mr-1.5" /> Payment Under Review
                            </Badge>
                            <p className="text-[8px] text-muted-foreground text-center uppercase font-bold tracking-tighter">Awaiting Admin Approval</p>
                        </div>
                    ) : apt.paymentStatus === 'rejected' ? (
                        <div className="flex flex-col gap-2 w-full min-w-[150px]">
                            <Badge variant="destructive" className="px-3 py-2 font-bold text-[9px] sm:text-[10px] whitespace-nowrap w-full justify-center h-auto">
                                <X className="w-3 h-3 mr-1.5" /> Payment Rejected
                            </Badge>
                            <p className="text-[8px] text-destructive text-center uppercase font-bold tracking-tighter">Contact Support Chat</p>
                        </div>
                    ) : isUpcoming && !isExpired && apt.status === 'scheduled' ? (
                        <>
                            {!isLive && (
                                <Button variant="outline" size="sm" className="font-bold border-2 h-9 flex-1 sm:w-auto text-[10px]" onClick={() => onPostpone(apt)}>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Postpone
                                </Button>
                            )}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className={cn("font-bold h-9 flex-1 sm:w-auto", isLive ? "bg-red-600 hover:bg-red-700 animate-pulse" : "opacity-70 cursor-not-allowed")} disabled={!isLive}>
                                        {isLive ? "Join Now" : "Upcoming"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl border-none shadow-2xl bg-white">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-headline">Clinical Connection</DialogTitle>
                                        <DialogDescription>Secure room window closes at {appointmentDate ? format(addMinutes(appointmentDate, 30), "p") : "the end of the session"}.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 gap-4 py-4 sm:py-6">
                                        <Button variant="outline" className="justify-start h-20 sm:h-16 border-2 hover:border-primary group bg-muted/5" onClick={handleJoin}>
                                            <Video className="mr-3 sm:mr-4 h-6 w-6 text-primary shrink-0"/> <div className="text-left min-w-0"><p className="font-bold text-foreground truncate">Video Consultation</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate">HD Video Feed</p></div>
                                        </Button>
                                        <Button variant="outline" className="justify-start h-20 sm:h-16 border-2 hover:border-primary group bg-muted/5" onClick={handleJoin}>
                                            <MessageSquare className="mr-3 sm:mr-4 h-6 w-6 text-primary shrink-0"/> <div className="text-left min-w-0"><p className="font-bold text-foreground truncate">Secure Patient Chat</p><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate">Real-time Messaging</p></div>
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <div className="flex flex-col gap-2">
                             <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5 flex-1 sm:w-auto justify-center h-9 text-[10px]">
                                <Link href={`/appointments/${apt.id}`}><FileText className="h-4 w-4" /> Visit Summary</Link>
                            </Button>
                            <Badge variant={apt.status === 'completed' ? 'secondary' : 'destructive'} className="text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 mx-auto shrink-0 h-auto">
                                {apt.status === 'completed' ? 'Performed' : apt.status}
                            </Badge>
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

    const { upcomingAppointments, recentPastAppointments, ringingApt } = useMemo(() => {
        if (!mounted || !appointments) return { upcomingAppointments: [], recentPastAppointments: [], ringingApt: null };
        
        const now = new Date();
        const validAppointments = appointments.filter(apt => apt !== null && apt.id && apt.appointmentDateTime);

        const currentRinging = validAppointments.find(apt => 
            apt.doctorInRoom === true && 
            apt.status === 'scheduled' && 
            apt.paymentStatus === 'approved' &&
            Math.abs(now.getTime() - new Date(apt.appointmentDateTime).getTime()) < (30 * 60 * 1000)
        );

        const upcoming = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (30 * 60 * 1000); 
                const isMissed = now.getTime() > endTime;
                return !isMissed && 
                       (apt.status === 'scheduled' || apt.status === 'expired') &&
                       (apt.paymentStatus === 'approved' || apt.paymentStatus === 'pending' || apt.paymentStatus === 'rejected');
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (30 * 60 * 1000); 
                const isMissed = now.getTime() > endTime;
                return isMissed || apt.status === 'completed' || apt.status === 'expired';
            })
            .sort((a, b) => b.appointmentDateTime.localeCompare(a.appointmentDateTime))
            .slice(0, 10);

        return { upcomingAppointments: upcoming, recentPastAppointments: past, ringingApt: currentRinging };
    }, [appointments, mounted, nowState]);

    const handlePostpone = (apt: any) => {
        setSelectedApt(apt);
        setIsPostponeOpen(true);
    };

    if (!mounted || isUserLoading) return <div className="flex-grow flex items-center justify-center bg-secondary/30"><Loader2 className="h-10 w-10 animate-spin text-primary/30" /></div>;

    return (
        <main className="flex-grow bg-secondary/30 py-6 sm:py-10">
            <div className="container mx-auto px-4">
                {ringingApt && (
                    <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                        <Card className="bg-red-600 text-white border-none shadow-2xl overflow-hidden rounded-3xl" asChild>
                            <div className="p-6 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                                        <PhoneIncoming className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">Incoming Consultation</p>
                                        <p className="text-lg font-bold">Your doctor has entered the room.</p>
                                    </div>
                                </div>
                                <Button asChild className="bg-white text-red-600 hover:bg-slate-100 font-bold px-8 h-12 rounded-2xl">
                                    <Link href={`/consultation/${ringingApt.id}`}>Join Now</Link>
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md rounded-[2rem]">
                            <CardHeader className="bg-primary text-primary-foreground pb-8 pt-8 sm:pb-12 sm:pt-12 px-6 sm:px-10">
                                <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] opacity-80">Patient Portal</CardTitle>
                                <CardDescription className="text-3xl sm:text-4xl font-bold font-headline text-white mt-3">Hello, {userData?.firstName}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 sm:pt-10 space-y-4 px-6 sm:px-10 pb-12">
                                <Button className="w-full justify-start h-16 text-base font-bold shadow-xl shadow-primary/20 rounded-2xl" asChild><Link href="/find-a-doctor"><PlusCircle className="mr-3 h-6 w-6" /> Book Consultation</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-16 text-base font-bold border-2 rounded-2xl hover:bg-primary/5 transition-all" asChild><Link href="/patient-portal/messages"><MessageSquare className="mr-3 h-6 w-6 text-primary" /> Message Center</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-16 text-base font-bold border-2 rounded-2xl hover:bg-primary/5 transition-all" asChild><Link href="/patient-portal/history"><History className="mr-3 h-6 w-6 text-primary" /> My History</Link></Button>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-[2rem]">
                            <CardContent className="p-8 space-y-5 text-center">
                                <div className="h-14 w-14 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto shadow-inner">
                                    <HelpCircle className="h-7 w-7 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-bold text-lg">Need Help?</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">Facing issues with payments or bookings? Chat with our Admin team instantly using the bubble below.</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Encrypted Support Link Active
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-10 sm:space-y-16">
                        <section>
                            <div className="flex items-center justify-between mb-6 sm:mb-8">
                                <h2 className="text-2xl sm:text-3xl font-bold font-headline flex items-center gap-5">
                                    <div className="h-8 sm:h-10 w-2 bg-primary rounded-full shrink-0"></div>
                                    Scheduled consultations
                                </h2>
                            </div>
                            {isLoadingAppointments ? <div className="py-16 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/30" /></div> : 
                             upcomingAppointments.length === 0 ? <Card className="border-dashed border-4 bg-transparent rounded-[2.5rem]"><CardContent className="py-20 sm:py-24 text-center px-4"><Calendar className="h-16 w-16 text-muted-foreground/10 mx-auto mb-6" /><p className="text-muted-foreground font-medium">No upcoming 30m consultations.</p></CardContent></Card> :
                             <div className="space-y-5">{upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}</div>}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-6 sm:mb-8">
                                <h2 className="text-2xl sm:text-3xl font-bold font-headline flex items-center gap-5">
                                    <div className="h-8 sm:h-10 w-2 bg-muted rounded-full shrink-0"></div>
                                    History
                                </h2>
                                {recentPastAppointments.length > 0 && <Button variant="ghost" size="sm" asChild className="text-primary font-bold text-sm hover:bg-primary/5 px-4 h-10 rounded-xl"><Link href="/patient-portal/history">View Full Archive <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>}
                            </div>
                            
                            {recentPastAppointments.length > 0 ? (
                                <div className="relative group">
                                    <Carousel
                                        opts={{ align: "start", loop: false }}
                                        className="w-full"
                                    >
                                        <CarouselContent className="-ml-4">
                                            {recentPastAppointments.map(apt => (
                                                <CarouselItem key={apt.id} className="pl-4 md:basis-1/2 lg:basis-1/2">
                                                    <AppointmentCard apt={apt} isUpcoming={false} onPostpone={handlePostpone} isMounted={mounted} variant="compact" />
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        <CarouselPrevious className="hidden sm:flex -left-4 bg-white/90 backdrop-blur shadow-lg border-none" />
                                        <CarouselNext className="hidden sm:flex -right-4 bg-white/90 backdrop-blur shadow-lg border-none" />
                                    </Carousel>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-muted/10 rounded-[2.5rem] border-2 border-dashed">
                                    <p className="text-muted-foreground text-sm italic font-medium">No past clinical records found.</p>
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
