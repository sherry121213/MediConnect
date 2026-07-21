
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, History, ChevronRight, FileText, RefreshCw, CalendarIcon, ShieldCheck, Clock, BellRing, UserCheck, Layers, HelpCircle, Siren } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isSameDay, isValid, addMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const AppointmentCard = ({ apt, isUpcoming, isMounted }: { apt: any, isUpcoming: boolean, isMounted: boolean }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    
    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !apt?.doctorId) return null;
        return doc(firestore, 'doctors', apt.doctorId);
    }, [firestore, apt?.doctorId]);
    const { data: doctor, isLoading: isLoadingDoctor } = useDoc<Doctor>(doctorDocRef);
    
    const appointmentDate = useMemo(() => {
        if (!apt?.appointmentDateTime) return null;
        const d = new Date(apt.appointmentDateTime);
        return isValid(d) ? d : null;
    }, [apt?.appointmentDateTime]);
    
    const now = isMounted ? Date.now() : 0;
    const checkInBuffer = appointmentDate ? appointmentDate.getTime() - (15 * 60 * 1000) : 0;
    const endTime = appointmentDate ? appointmentDate.getTime() + (20 * 60 * 1000) : 0; 
    
    const isCheckInAvailable = isMounted && now >= checkInBuffer && now < endTime;
    const isExpired = isMounted && now >= endTime;

    if (!apt || !appointmentDate) return null;

    const photoSrc = doctor?.photoURL || PlaceHolderImages.find(p => p.id === doctor?.profileImageId)?.imageUrl;

    const handleCheckIn = async () => {
        if (!firestore || isCheckingIn) return;
        setIsCheckingIn(true);
        try {
            await updateDoc(doc(firestore, 'appointments', apt.id), {
                patientCheckedIn: true,
                updatedAt: new Date().toISOString()
            });
            toast({ title: "Checked In!", description: "Doctor has been notified of your arrival." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Check-in Failed" });
        } finally {
            setIsCheckingIn(false);
        }
    };

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all border-l-4 bg-white/80 backdrop-blur-sm overflow-hidden rounded-2xl h-full",
            (apt.doctorInRoom && apt.patientCheckedIn) ? "border-l-red-500 bg-red-50/5" : "border-l-primary/40",
            (isExpired || apt.status === 'expired') && "opacity-60 grayscale border-l-slate-200"
        )}>
            <div className="p-4 sm:p-6 flex flex-col justify-between h-full gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden bg-slate-50">
                        {photoSrc ? <Image src={photoSrc} alt="Doctor" fill className="object-cover" /> : <div className="h-full w-full flex items-center justify-center font-bold text-primary">{doctor?.firstName?.[0]}</div>}
                    </div>
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-base truncate">Dr. {doctor?.firstName} {doctor?.lastName || '...'}</p>
                            {apt.patientCheckedIn && <Badge className="bg-green-100 text-green-700 border-green-200 text-[8px] px-1.5 font-bold uppercase">Checked In</Badge>}
                        </div>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{doctor?.specialty || 'Professional'}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Badge variant="outline" className="flex items-center gap-1 text-[9px] font-bold"><CalendarIcon className="w-2.5 h-2.5" /> {format(appointmentDate, "MMM dd")}</Badge>
                            <Badge variant="outline" className="flex items-center gap-1 text-[9px] font-bold"><Clock className="w-2.5 h-2.5" /> {format(appointmentDate, "p")}</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                    {apt.paymentStatus === 'pending' ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-3 py-2 font-bold text-[9px] uppercase w-full justify-center">Audit Pending</Badge>
                    ) : isUpcoming && !isExpired && apt.status === 'scheduled' ? (
                        <>
                            {isCheckInAvailable && !apt.patientCheckedIn && (
                                <Button onClick={handleCheckIn} disabled={isCheckingIn} className="bg-green-600 hover:bg-green-700 text-white font-bold h-9 text-[10px] uppercase shadow-lg shadow-green-100 w-full">
                                    {isCheckingIn ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <UserCheck className="mr-1.5 h-3.5 w-3.5" />} Check-in
                                </Button>
                            )}
                            {apt.patientCheckedIn ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className={cn("font-bold h-9 text-[10px] uppercase shadow-lg w-full", apt.doctorInRoom ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-slate-900")}>
                                            {apt.doctorInRoom ? "Join Clinical Room" : "Awaiting Doctor..."}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-3xl border-none shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-headline">Clinical Tunnel</DialogTitle>
                                            <DialogDescription>{apt.doctorInRoom ? "Your provider has started the session. Secure tunnel is active." : "Please wait. Your doctor will open the room shortly."}</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-6">
                                            {apt.doctorInRoom ? (
                                                <Button className="w-full h-16 rounded-2xl font-bold bg-primary text-white text-lg gap-3" onClick={() => window.location.assign(`/consultation/${apt.id}`)}>
                                                    <Video className="h-6 w-6" /> Join Consultation
                                                </Button>
                                            ) : (
                                                <div className="text-center p-12 border-4 border-dashed rounded-3xl bg-slate-50 space-y-4">
                                                    <Loader2 className="h-10 w-10 text-primary/30 animate-spin mx-auto" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Handshake in progress...</p>
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ) : !isCheckInAvailable && (
                                <Button variant="outline" className="h-9 text-[10px] font-bold border-2 w-full" disabled>Pending Window</Button>
                            )}
                        </>
                    ) : (
                        <Button asChild variant="ghost" className="text-primary font-bold text-[10px] uppercase gap-2 w-full justify-center">
                            <Link href={`/appointments/${apt.id}`}><FileText className="h-4 w-4" /> View Record</Link>
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [mounted, setMounted] = useState(false);
    const [nowState, setNowState] = useState<number | null>(null);

    useEffect(() => {
        setMounted(true);
        setNowState(Date.now());
        const timer = setInterval(() => setNowState(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { upcomingAppointments, recentPastAppointments, ringingApt, signalApt, activeQueueApt } = useMemo(() => {
        if (!mounted || !appointments || !nowState) return { upcomingAppointments: [], recentPastAppointments: [], ringingApt: null, signalApt: null, activeQueueApt: null };
        const now = new Date(nowState);
        const valid = appointments.filter(apt => apt && apt.id && apt.appointmentDateTime);
        const upcoming = valid.filter(apt => {
            const d = new Date(apt.appointmentDateTime);
            return (apt.status === 'scheduled' || apt.status === 'expired') && (nowState < d.getTime() + (20 * 60 * 1000));
        }).sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());
        const past = valid.filter(apt => {
            const d = new Date(apt.appointmentDateTime);
            return apt.status === 'completed' || nowState >= d.getTime() + (20 * 60 * 1000);
        }).sort((a, b) => b.appointmentDateTime.localeCompare(a.appointmentDateTime)).slice(0, 10);
        
        const ringing = valid.find(apt => apt.doctorInRoom && apt.status === 'scheduled' && apt.paymentStatus === 'approved' && isSameDay(new Date(apt.appointmentDateTime), now));
        
        // REFINED: Only show early signal if it is actually BEFORE session time
        const signaled = valid.find(apt => {
            if (!apt.readyToStart || apt.doctorInRoom || apt.status !== 'scheduled' || apt.paymentStatus !== 'approved') return false;
            const startTime = new Date(apt.appointmentDateTime).getTime();
            return nowState < startTime; // Trigger banner ONLY if early
        });

        const queue = valid.find(apt => apt.status === 'scheduled' && apt.paymentStatus === 'approved' && isSameDay(new Date(apt.appointmentDateTime), now) && apt.queueStatus !== 'completed');
        
        return { upcomingAppointments: upcoming, recentPastAppointments: past, ringingApt: ringing, signalApt: signaled, activeQueueApt: queue };
    }, [appointments, mounted, nowState]);

    if (!mounted || isUserLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <main className="min-h-screen bg-secondary/30 py-10 px-4">
            <div className="max-w-7xl mx-auto space-y-10 pb-24">
                
                {/* LIVE CALL BANNER */}
                {ringingApt && (
                    <Card className="bg-red-600 text-white border-none shadow-2xl rounded-3xl animate-in slide-in-from-top-4 duration-500">
                        <CardContent className="p-6 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse"><BellRing className="h-6 w-6" /></div>
                                <div><p className="text-[10px] uppercase font-bold opacity-80">Consultation Live</p><p className="text-lg font-bold">Your doctor has entered the clinical room.</p></div>
                            </div>
                            <Button asChild className="bg-white text-red-600 hover:bg-slate-100 font-bold px-8 h-12 rounded-2xl shadow-lg"><Link href={`/consultation/${ringingApt.id}`}>Join Now</Link></Button>
                        </CardContent>
                    </Card>
                )}

                {/* EARLY SIGNAL BANNER (DOCTOR CLICKED RING) */}
                {signalApt && !ringingApt && (
                    <Card className="bg-primary text-white border-none shadow-2xl rounded-3xl animate-in slide-in-from-top-4 duration-500">
                        <CardContent className="p-6 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center"><Siren className="h-6 w-6 animate-pulse" /></div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold opacity-80">Early Availability</p>
                                    <p className="text-lg font-bold">Your doctor is ready to start earlier than scheduled.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button asChild className="bg-white text-primary hover:bg-slate-100 font-bold px-8 h-12 rounded-2xl shadow-lg">
                                    <Link href="/patient-portal">View Alert</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white rounded-[2rem]">
                            <CardHeader className="bg-primary text-primary-foreground p-8">
                                <CardTitle className="text-[10px] uppercase font-bold opacity-80">Patient Identity</CardTitle>
                                <CardDescription className="text-2xl font-bold text-white mt-2">Hello, {userData?.firstName}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-3">
                                <Button className="w-full justify-start h-14 font-bold rounded-2xl shadow-lg" asChild><Link href="/find-a-doctor"><PlusCircle className="mr-3 h-5 w-5" /> Book Session</Link></Button>
                                <Button variant="outline" className="w-full justify-start h-14 font-bold border-2 rounded-2xl" asChild><Link href="/patient-portal/history"><History className="mr-3 h-5 w-5 text-primary" /> My History</Link></Button>
                            </CardContent>
                        </Card>

                        {activeQueueApt && (
                            <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[2rem]">
                                <CardHeader className="p-6 border-b border-white/5"><CardTitle className="text-[10px] uppercase font-bold text-primary flex items-center gap-2"><Layers className="h-4 w-4" /> Live Queue</CardTitle></CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div><p className="text-[8px] uppercase text-slate-500 font-bold">Daily Token</p><p className="text-4xl font-bold">#{activeQueueApt.sequencePosition}</p></div>
                                        <Badge className={cn("h-6 px-3 rounded-full text-[8px] font-bold uppercase", activeQueueApt.queueStatus === 'in-consultation' ? "bg-green-600 animate-pulse" : "bg-primary")}>{activeQueueApt.queueStatus?.replace('-', ' ')}</Badge>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] text-slate-400 italic">"Ensure your device is ready. The doctor will open your clinical tunnel shortly."</div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="lg:col-span-8 space-y-10">
                        <section>
                            <h2 className="text-xl font-bold font-headline flex items-center gap-4 mb-6"><div className="h-8 w-1.5 bg-primary rounded-full" /> Scheduled Sessions</h2>
                            {isLoadingAppointments ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin opacity-20" /></div> : upcomingAppointments.length === 0 ? <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl">No upcoming sessions.</div> : <div className="space-y-4">{upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} isMounted={mounted} />)}</div>}
                        </section>

                        <section className="space-y-6">
                             <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold font-headline flex items-center gap-4"><div className="h-8 w-1.5 bg-slate-300 rounded-full" /> Clinical History</h2>
                                <Link href="/patient-portal/history" className="text-primary font-bold text-xs hover:underline flex items-center gap-1 group">
                                    View Full Archive <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                            
                            {recentPastAppointments.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide no-scrollbar custom-scrollbar snap-x">
                                    {recentPastAppointments.map((apt) => (
                                        <div key={apt.id} className="min-w-[280px] sm:min-w-[340px] flex-shrink-0 snap-start">
                                            <AppointmentCard apt={apt} isUpcoming={false} isMounted={mounted} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 text-center text-muted-foreground border-2 border-dashed rounded-[2rem] bg-white/40">
                                    <History className="h-10 w-10 mx-auto mb-3 opacity-10" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No History Indexed</p>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}
