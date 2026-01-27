'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2 } from "lucide-react";
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


export default function PatientPortalPage() {
    const { user, isUserLoading } = useUserData();
    const firestore = useFirestore();

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments, error: appointmentsError } = useCollection<Appointment>(appointmentsQuery);

    const doctorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'doctors');
    }, [firestore]);
    const { data: doctors, isLoading: isLoadingDoctors, error: doctorsError } = useCollection<Doctor>(doctorsQuery);

    const now = new Date();

    const upcomingAppointments = useMemo(() => {
        if (!appointments || !doctors) return [];
        return appointments
            .filter(apt => new Date(apt.appointmentDateTime) >= now)
            .map(apt => ({
                ...apt,
                doctor: doctors.find(d => d.id === apt.doctorId)
            }))
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());
    }, [appointments, doctors]);


    const pastAppointments = useMemo(() => {
        if (!appointments || !doctors) return [];
        return appointments
            .filter(apt => new Date(apt.appointmentDateTime) < now)
            .map(apt => ({
                ...apt,
                doctor: doctors.find(d => d.id === apt.doctorId)
            }))
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments, doctors]);


    const JoinCallDialog = ({ apt }: { apt: any }) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button>Join</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose Consultation Method</AlertDialogTitle>
                    <AlertDialogDescription>
                        How would you like to connect with Dr. {apt.doctor.firstName}?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                    <Button variant="outline" asChild>
                        <Link href="https://meet.google.com" target="_blank">
                            <Video className="mr-2 h-4 w-4"/> Video Call
                        </Link>
                    </Button>
                    <Button variant="outline">
                       <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        Audio Call
                    </Button>
                     <Button variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4"/> Chat
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    const AppointmentCard = ({ apt, isUpcoming }: { apt: any, isUpcoming: boolean }) => {
        if (!apt.doctor) {
            return <Card className="p-4 text-muted-foreground">Loading doctor details...</Card>;
        }
        const doctorImage = PlaceHolderImages.find(p => p.id === apt.doctor.profileImageId);
        const appointmentDate = new Date(apt.appointmentDateTime);

        return (
            <Card>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        {doctorImage && (
                            <Image
                                src={doctorImage.imageUrl}
                                alt={apt.doctor.firstName}
                                width={56}
                                height={56}
                                className="rounded-full"
                                data-ai-hint={doctorImage.imageHint}
                            />
                        )}
                        <div>
                            <p className="font-bold">Dr. {apt.doctor.firstName}</p>
                            <p className="text-sm text-muted-foreground">{apt.doctor.specialty}</p>
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{appointmentDate.toLocaleDateString()} at {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                    <div className="flex sm:flex-col md:flex-row gap-2 justify-end pt-4 sm:pt-0">
                        {isUpcoming && apt.status === "scheduled" && <JoinCallDialog apt={apt}/>}
                        {!isUpcoming && <Button variant="outline" asChild><Link href={`/appointments/${apt.id}`}>View Details</Link></Button>}
                    </div>
                </CardContent>
            </Card>
        )
    };


    return (
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Patient Portal</h1>
                        <p className="text-muted-foreground">Welcome back, {user?.displayName || 'User'}!</p>
                    </div>
                    <Button asChild className="w-full md:w-auto">
                        <Link href="/find-a-doctor">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Book New Appointment
                        </Link>
                    </Button>
                </div>
                
                {isUserLoading || isLoadingAppointments || isLoadingDoctors ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : appointments && appointments.length === 0 ? (
                     <Card className="text-center py-16 md:py-24">
                        <CardContent>
                            <h3 className="text-2xl font-medium font-headline">Welcome to Your Portal</h3>
                            <p className="text-muted-foreground mt-2 mb-6 max-w-md mx-auto">It looks like you don't have any appointments yet. Book your first consultation to get started.</p>
                            <Button asChild>
                                <Link href="/find-a-doctor">
                                     <PlusCircle className="mr-2 h-4 w-4" />
                                    Book an Appointment
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {upcomingAppointments.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold font-headline mb-4">Upcoming Appointments</h2>
                                <div className="space-y-4">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} />)}
                                </div>
                            </section>
                        )}

                        {pastAppointments.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold font-headline mb-4">Past Appointments</h2>
                                <div className="space-y-4">
                                    {pastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} />)}
                                </div>
                            </section>
                        )}

                        {appointmentsError && <p className="text-destructive text-center">Error loading appointments: {appointmentsError.message}</p>}
                        {doctorsError && <p className="text-destructive text-center">Error loading doctor data: {doctorsError.message}</p>}
                    </div>
                )}
            </div>
          </main>
          <AppFooter />
        </div>
    )
}
