'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, Loader2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { useUserData, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Patient } from "@/lib/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// This component fetches its own patient data, preventing a 'list' query on the whole collection.
const AppointmentCard = ({ apt }: { apt: Appointment }) => {
    const firestore = useFirestore();

    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt.patientId]);

    const { data: patient, isLoading: isLoadingPatient } = useDoc<Patient>(patientDocRef);
    
    const appointmentDate = new Date(apt.appointmentDateTime);

    const JoinCallDialog = ({ patientName }: { patientName: string | undefined }) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button>Join</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose Consultation Method</AlertDialogTitle>
                    <AlertDialogDescription>
                        How would you like to connect with {patientName || 'the patient'}?
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

    if (isLoadingPatient) {
        return (
            <Card className="grid grid-cols-1 md:grid-cols-4 items-center gap-4 p-4">
                <div className="flex flex-row items-center gap-4 md:col-span-2">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-6 w-24" />
                </div>
                <div className="md:col-span-2">
                    <Skeleton className="h-6 w-48" />
                </div>
            </Card>
        )
    }

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
    const patientImage = patient?.photoURL;
    const patientFallback = patientName.charAt(0);

    return (
        <Card className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
            <CardHeader className="flex flex-row items-center gap-4 md:col-span-2">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={patientImage} alt={patientName} />
                    <AvatarFallback>{patientFallback}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{patientName}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-0 md:pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{appointmentDate.toLocaleDateString()} at {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </CardContent>
            <div className="p-6 pt-0 md:pt-6 text-right">
                {apt.status === "scheduled" && <JoinCallDialog patientName={patientName} />}
                {apt.status === "completed" && <Button variant="outline" asChild><Link href="#">View Notes</Link></Button>}
            </div>
        </Card>
    );
}

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments, error: appointmentsError } = useCollection<Appointment>(appointmentsQuery);
    
    const now = new Date();

    const upcomingAppointments = useMemo(() => {
        if (!appointments) return [];
        return appointments
            .filter(apt => new Date(apt.appointmentDateTime) >= now)
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());
    }, [appointments]);


    return (
        <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold font-headline">Doctor Portal</h1>
                    <p className="text-muted-foreground">Welcome back, Dr. {userData?.lastName || 'Doctor'}!</p>
                </div>

                 {isUserLoading || isLoadingAppointments ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : upcomingAppointments.length === 0 ? (
                     <Card className="text-center py-24">
                        <CardContent>
                            <h3 className="text-2xl font-medium font-headline">No Upcoming Appointments</h3>
                            <p className="text-muted-foreground mt-2 max-w-md mx-auto">Your dashboard is currently empty. As soon as a patient books a consultation with you, it will appear here.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold font-headline mb-4">Upcoming Appointments</h2>
                            <div className="space-y-4">
                                {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                            </div>
                        </div>

                        {appointmentsError && <p className="text-destructive text-center">Error loading appointments: {appointmentsError.message}</p>}
                    </div>
                )}
            </div>
        </main>
    )
}
