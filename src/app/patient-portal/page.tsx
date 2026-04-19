'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, Stethoscope, Clock, History, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUserData, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isAfter, subHours } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Stable query for appointments
    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    // Stable query for doctors
    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

    const { upcomingAppointments, recentPastAppointments } = useMemo(() => {
        if (!mounted || !appointments || !doctors) return { upcomingAppointments: [], recentPastAppointments: [] };
        
        const now = new Date();
        const threshold = subHours(now, 1); // Generous buffer to keep active sessions visible

        const allMapped = appointments.map(apt => ({
            ...apt,
            doctor: doctors.find(d => d.id === apt.doctorId)
        }));

        const upcoming = allMapped
            .filter(apt => isAfter(new Date(apt.appointmentDateTime), threshold) && apt.status !== 'cancelled' && apt.status !== 'completed')
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = allMapped
            .filter(apt => !isAfter(new Date(apt.appointmentDateTime), threshold) || apt.status === 'completed')
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime())
            .slice(0, 5);

        return { upcomingAppointments: upcoming, recentPastAppointments: past };
    }, [appointments, doctors, mounted]);

    const JoinCallDialog = ({ apt }: { apt: any }) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full sm:w-auto font-bold">Join Session</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-headline">Clinical Connection</AlertDialogTitle>
                    <AlertDialogDescription>
                        Select your preferred method to connect with {apt.doctor ? `Dr. ${apt.doctor.firstName}` : 'your doctor'}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 gap-4 py-6">
                    <Button variant="outline" className="justify-start h-16 border-2 hover:border-primary group" asChild>
                        <Link href="https://meet.google.com" target="_blank">
                            <Video className="mr-4 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/> 
                            <div className="text-left">
                                <p className="font-bold text-foreground">Secure Video Link</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">HD Video & Audio Consultation</p>
                            </div>
                        </Link>
                    </Button>
                    <Button variant="outline" className="justify-start h-16 border-2 hover:border-primary group opacity-60">
                        <MessageSquare className="mr-4 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/>
                        <div className="text-left">
                            <p className="font-bold text-foreground">Interactive Chat</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Real-time messaging support</p>
                        </div>
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    const AppointmentCard = ({ apt, isUpcoming }: { apt: any, isUpcoming: boolean }) => {
        const doctorImage = apt.doctor ? PlaceHolderImages.find(p => p.id === apt.doctor.profileImageId) : null;
        const appointmentDate = new Date(apt.appointmentDateTime);

        return (
            <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary/40 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                    <div className="flex items-center gap-6 flex-1">
                        <div className="relative h-16 w-16 shrink-0 shadow-inner rounded-full overflow-hidden">
                            {apt.doctor?.photoURL || doctorImage ? (
                                <Image
                                    src={apt.doctor?.photoURL || doctorImage?.imageUrl || ''}
                                    alt={apt.doctor?.firstName || 'Doctor'}
                                    fill
                                    className="object-cover border-2 border-primary/5"
                                    data-ai-hint="doctor portrait"
                                />
                            ) : (
                                <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Stethoscope className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-xl leading-tight tracking-tight">Dr. {apt.doctor?.firstName} {apt.doctor?.lastName}</p>
                            <p className="text-sm text-primary font-bold uppercase tracking-wider opacity-80">{apt.doctor?.specialty || 'General Physician'}</p>
                            <div className="flex items-center gap-4 pt-1">
                                <Badge variant="secondary" className="bg-primary/5 text-primary-dark border-primary/10 flex items-center gap-1.5 px-2.5">
                                    <Calendar className="w-3 h-3" /> {format(appointmentDate, "MMM dd, yyyy")}
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1.5 px-2.5">
                                    <Clock className="w-3 h-3" /> {format(appointmentDate, "p")}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                        {isUpcoming ? (
                            <JoinCallDialog apt={apt}/>
                        ) : (
                            <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5">
                                <Link href={`/appointments/${apt.id}`}>
                                    <FileText className="h-4 w-4" /> View Visit Summary
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    };

    if (!mounted || isUserLoading || (user && isLoadingAppointments) || (user && isLoadingDoctors)) {
        return (
            <div className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="flex-grow bg-secondary/30 py-10">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-12 gap-10">
                    
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md">
                            <CardHeader className="bg-primary text-primary-foreground pb-10 pt-10">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80">Patient Command Center</CardTitle>
                                <CardDescription className="text-3xl font-bold font-headline text-white mt-2">
                                    Hello, {userData?.firstName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 space-y-6">
                                <div className="space-y-3">
                                    <Button className="w-full justify-start h-14 text-base font-bold shadow-lg shadow-primary/20" asChild>
                                        <Link href="/find-a-doctor">
                                            <PlusCircle className="mr-3 h-5 w-5" /> Book Medical Consultation
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2" asChild>
                                        <Link href="/patient-portal/history">
                                            <History className="mr-3 h-5 w-5 text-primary" /> Audit Medical Records
                                        </Link>
                                    </Button>
                                </div>
                                <div className="mt-8 pt-8 border-t space-y-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Clinical Wellness Tip</p>
                                    <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                                        <p className="text-sm text-primary-dark italic leading-relaxed font-medium">
                                            "Maintaining a consistent sleep schedule of 7-9 hours per night significantly boosts your immune system's efficacy."
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-12">
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                                    <div className="h-8 w-1 bg-primary rounded-full"></div>
                                    Scheduled consultations
                                </h2>
                                {upcomingAppointments.length > 0 && (
                                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1 font-bold">
                                        {upcomingAppointments.length} Active
                                    </Badge>
                                )}
                            </div>
                            
                            {upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent">
                                    <CardContent className="py-16 text-center">
                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Clock className="h-8 w-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-muted-foreground font-medium">Your current clinical queue is empty.</p>
                                        <Button variant="link" asChild className="mt-2 text-primary font-bold">
                                            <Link href="/find-a-doctor">Find a specialist and book now</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-5">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} />)}
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                                     <div className="h-8 w-1 bg-muted rounded-full"></div>
                                    Clinical History
                                </h2>
                                {recentPastAppointments.length > 0 && (
                                    <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary font-bold group">
                                        <Link href="/patient-portal/history" className="flex items-center gap-1">
                                            View Audit <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {recentPastAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent">
                                    <CardContent className="py-16 text-center text-muted-foreground">
                                        <p className="font-medium">No historical clinical records detected.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-5">
                                    {recentPastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} />)}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}
