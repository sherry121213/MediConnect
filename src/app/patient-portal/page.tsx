
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, Stethoscope, Clock, History, ChevronRight, FileText, PhoneCall, RefreshCw, CalendarIcon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useUserData, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isAfter, subHours, isSameDay, startOfDay, isBefore, isValid } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

const AppointmentCard = ({ apt, isUpcoming, onPostpone, isMounted }: { apt: any, isUpcoming: boolean, onPostpone: (a: any) => void, isMounted: boolean }) => {
    const firestore = useFirestore();
    const router = useRouter();
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
    
    const now = isMounted ? new Date().getTime() : 0;
    const startTime = appointmentDate ? appointmentDate.getTime() - (10 * 60 * 1000) : 0; // 10m early
    const endTime = appointmentDate ? appointmentDate.getTime() + (50 * 60 * 1000) : 0;
    
    const isLive = isMounted && now >= startTime && now < endTime;
    const isExpired = isMounted && now >= endTime;

    if (!apt || !appointmentDate) return null;

    const photoSrc = doctor?.photoURL || doctorImage?.imageUrl;

    const handleJoin = () => {
        router.push(`/consultation/${apt.id}`);
    };

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all border-l-4 bg-card/50 backdrop-blur-sm overflow-hidden",
            isLive ? "border-l-red-500 bg-red-50/10 shadow-md scale-[1.01]" : "border-l-primary/40",
            isExpired && "opacity-60 border-l-destructive/40"
        )}>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-8">
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
                            {isLive && <Badge className="bg-red-600 text-white animate-pulse h-4 text-[7px] px-1.5 uppercase font-bold">LIVE</Badge>}
                            {isExpired && <Badge variant="destructive" className="h-4 text-[7px] px-1.5 uppercase font-bold">EXPIRED</Badge>}
                        </div>
                        <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider opacity-80 truncate">{doctor?.specialty || 'Medical Specialist'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
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
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-3 py-2 font-bold text-[9px] sm:text-[10px] whitespace-nowrap w-full justify-center">
                            <Clock className="w-3 h-3 mr-1.5" /> Verifying Payment
                        </Badge>
                    ) : isUpcoming && !isExpired ? (
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
                                <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-headline">Clinical Connection</DialogTitle>
                                        <DialogDescription>Secure room window closes at {format(new Date(endTime), "p")}.</DialogDescription>
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
                        <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5 flex-1 sm:w-auto justify-center h-9 text-[10px]">
                            <Link href={`/appointments/${apt.id}`}><FileText className="h-4 w-4" /> Visit Summary</Link>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
};

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [mounted, setMounted] = useState(false);
    const [selectedApt, setSelectedApt] = useState<any>(null);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);
    const [nowState, setNowState] = useState(new Date().getTime());

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNowState(new Date().getTime()), 15000);
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { upcomingAppointments, pendingVerificationAppointments, recentPastAppointments } = useMemo(() => {
        if (!mounted || !appointments) return { upcomingAppointments: [], pendingVerificationAppointments: [], recentPastAppointments: [] };
        
        const now = new Date();
        const validAppointments = appointments.filter(apt => apt !== null && apt.id && apt.appointmentDateTime);

        const upcoming = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (50 * 60 * 1000);
                const isMissed = now.getTime() > endTime;
                return !isMissed && 
                       apt.status === 'scheduled' &&
                       apt.paymentStatus === 'approved';
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const pending = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (50 * 60 * 1000);
                const isMissed = now.getTime() > endTime;
                return !isMissed && apt.paymentStatus === 'pending';
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                const endTime = d.getTime() + (50 * 60 * 1000);
                const isMissed = now.getTime() > endTime;
                return isMissed || apt.status === 'completed' || apt.status === 'expired';
            })
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime())
            .slice(0, 8);

        return { upcomingAppointments: upcoming, pendingVerificationAppointments: pending, recentPastAppointments: past };
    }, [appointments, mounted, nowState]);

    const handlePostpone = (apt: any) => {
        setSelectedApt(apt);
        setIsPostponeOpen(true);
    };

    if (!mounted || isUserLoading) return <div className="flex-grow flex items-center justify-center bg-secondary/30"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <main className="flex-grow bg-secondary/30 py-6 sm:py-10">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md">
                            <CardHeader className="bg-primary text-primary-foreground pb-8 pt-8 sm:pb-10 sm:pt-10 px-6 sm:px-8">
                                <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-80">Patient Portal</CardTitle>
                                <CardDescription className="text-2xl sm:text-3xl font-bold font-headline text-white mt-2">Hello, {userData?.firstName}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 sm:pt-8 space-y-3 px-6 sm:px-8">
                                <Button className="w-full justify-start h-14 text-base font-bold shadow-lg rounded-xl" asChild><Link href="/find-a-doctor"><PlusCircle className="mr-3 h-5 w-5" /> Book Consultation</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2 rounded-xl" asChild><Link href="/patient-portal/messages"><MessageSquare className="mr-3 h-5 w-5 text-primary" /> Message Center</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2 rounded-xl" asChild><Link href="/patient-portal/history"><History className="mr-3 h-5 w-5 text-primary" /> Medical Records</Link></Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-8 sm:space-y-12">
                        <section>
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-3"><div className="h-6 sm:h-8 w-1 bg-primary rounded-full"></div>Scheduled consultations</h2>
                            </div>
                            {isLoadingAppointments ? <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div> : 
                             upcomingAppointments.length === 0 ? <Card className="border-dashed border-2 bg-transparent rounded-2xl"><CardContent className="py-12 sm:py-16 text-center px-4"><Calendar className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" /><p className="text-muted-foreground">No upcoming verified consultations.</p></CardContent></Card> :
                             <div className="space-y-4">{upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}</div>}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-3"><div className="h-6 sm:h-8 w-1 bg-muted rounded-full"></div>Historical Audit</h2>
                                {recentPastAppointments.length > 0 && <Button variant="ghost" size="sm" asChild className="text-primary font-bold text-xs"><Link href="/patient-portal/history">View All <ChevronRight className="h-4 w-4" /></Link></Button>}
                            </div>
                            {recentPastAppointments.length > 0 ? <div className="space-y-4">{recentPastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} onPostpone={handlePostpone} isMounted={mounted} />)}</div> :
                             <p className="text-center py-12 text-muted-foreground text-sm italic">No historical clinical records.</p>}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}
