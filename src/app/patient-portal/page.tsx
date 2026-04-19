'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
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
import { useMemo } from "react";
import { format, isAfter, isBefore } from "date-fns";

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const doctorsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsCollection);

    const now = new Date();

    const upcomingAppointments = useMemo(() => {
        if (!appointments || !doctors) return [];
        return appointments
            .filter(apt => isAfter(new Date(apt.appointmentDateTime), now) && apt.status !== 'cancelled')
            .map(apt => ({
                ...apt,
                doctor: doctors.find(d => d.id === apt.doctorId)
            }))
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());
    }, [appointments, doctors]);

    const recentPastAppointments = useMemo(() => {
        if (!appointments || !doctors) return [];
        return appointments
            .filter(apt => isBefore(new Date(apt.appointmentDateTime), now) || apt.status === 'completed')
            .map(apt => ({
                ...apt,
                doctor: doctors.find(d => d.id === apt.doctorId)
            }))
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime())
            .slice(0, 3); // Only show top 3 on dashboard
    }, [appointments, doctors]);

    const JoinCallDialog = ({ apt }: { apt: any }) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full sm:w-auto">Join Consultation</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose Consultation Method</AlertDialogTitle>
                    <AlertDialogDescription>
                        How would you like to connect with {apt.doctor ? `Dr. ${apt.doctor.firstName}` : 'your doctor'}?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 gap-3 py-4">
                    <Button variant="outline" className="justify-start h-12" asChild>
                        <Link href="https://meet.google.com" target="_blank">
                            <Video className="mr-3 h-5 w-5 text-primary"/> 
                            <div className="text-left">
                                <p className="font-bold">Video Call</p>
                                <p className="text-[10px] text-muted-foreground">High-quality face-to-face session</p>
                            </div>
                        </Link>
                    </Button>
                    <Button variant="outline" className="justify-start h-12">
                        <MessageSquare className="mr-3 h-5 w-5 text-primary"/>
                        <div className="text-left">
                            <p className="font-bold">Chat Support</p>
                            <p className="text-[10px] text-muted-foreground">Text-based quick queries</p>
                        </div>
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    const AppointmentCard = ({ apt, isUpcoming }: { apt: any, isUpcoming: boolean }) => {
        const doctorImage = apt.doctor ? PlaceHolderImages.find(p => p.id === apt.doctor.profileImageId) : null;
        const appointmentDate = new Date(apt.appointmentDateTime);

        return (
            <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative h-14 w-14 shrink-0">
                            {doctorImage ? (
                                <Image
                                    src={doctorImage.imageUrl}
                                    alt={apt.doctor.firstName}
                                    fill
                                    className="rounded-full object-cover border-2 border-primary/10"
                                    data-ai-hint={doctorImage.imageHint}
                                />
                            ) : (
                                <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Stethoscope className="h-7 w-7" />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-lg leading-tight">{apt.doctor ? `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}` : 'Verified Doctor'}</p>
                            <p className="text-sm text-primary font-medium">{apt.doctor?.specialty || 'General Physician'}</p>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {format(appointmentDate, "MMM dd, yyyy")}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {format(appointmentDate, "p")}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        {isUpcoming ? (
                            <JoinCallDialog apt={apt}/>
                        ) : (
                            <Button variant="outline" asChild className="gap-2">
                                <Link href={`/appointments/${apt.id}`}>
                                    <FileText className="h-4 w-4" /> View Records
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    };

    if (isUserLoading || isLoadingAppointments || isLoadingDoctors) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </main>
                <AppFooter />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-grow bg-secondary/30 py-10">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-3 gap-8">
                    
                    {/* Sidebar/Profile Summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="overflow-hidden border-none shadow-lg">
                            <CardHeader className="bg-primary text-primary-foreground pb-8">
                                <CardTitle className="text-xl">Welcome back,</CardTitle>
                                <CardDescription className="text-primary-foreground/80 text-2xl font-bold font-headline">
                                    {userData?.firstName} {userData?.lastName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <Button className="w-full justify-start h-12 text-base" asChild>
                                        <Link href="/find-a-doctor">
                                            <PlusCircle className="mr-3 h-5 w-5" /> Book New Session
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-12 text-base" asChild>
                                        <Link href="/patient-portal/history">
                                            <History className="mr-3 h-5 w-5" /> Full Medical History
                                        </Link>
                                    </Button>
                                </div>
                                <div className="mt-8 pt-8 border-t space-y-3">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Health Tip of the Day</p>
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <p className="text-sm text-blue-800 italic leading-relaxed">
                                            "Drinking at least 8 glasses of water a day helps maintain your energy levels and keeps your skin glowing."
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-10">
                        {/* Upcoming Section */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
                                    <Clock className="h-6 w-6 text-primary" /> Upcoming Sessions
                                </h2>
                                {upcomingAppointments.length > 0 && (
                                    <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                                        {upcomingAppointments.length} Scheduled
                                    </span>
                                )}
                            </div>
                            
                            {upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed bg-transparent">
                                    <CardContent className="py-10 text-center text-muted-foreground">
                                        <p>No upcoming appointments found.</p>
                                        <Button variant="link" asChild className="mt-1">
                                            <Link href="/find-a-doctor">Book your first session now</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} />)}
                                </div>
                            )}
                        </section>

                        {/* Recent History Section */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
                                    <History className="h-6 w-6 text-primary" /> Recent History
                                </h2>
                                {recentPastAppointments.length > 0 && (
                                    <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                                        <Link href="/patient-portal/history" className="flex items-center gap-1">
                                            View All <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {recentPastAppointments.length === 0 ? (
                                <Card className="border-dashed bg-transparent">
                                    <CardContent className="py-10 text-center text-muted-foreground">
                                        <p>You haven't completed any consultations yet.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {recentPastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} />)}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
          </main>
          <AppFooter />
        </div>
    )
}