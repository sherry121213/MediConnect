'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle } from "lucide-react";
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
import { useUserData } from "@/firebase";

const demoUpcomingAppointments = [
    { id: 1, doctor: "Dr. Hassan Raza", specialty: "General Physician", date: "2024-08-20", time: "10:00 AM", status: "Upcoming", imageId: "doctor6" },
];

const demoPastAppointments = [
    { id: 2, doctor: "Dr. Amina Khan", specialty: "Cardiology", date: "2024-07-20", time: "02:30 PM", status: "Completed", imageId: "doctor1" },
    { id: 3, doctor: "Dr. Ayesha Malik", specialty: "Cardiology", date: "2024-06-10", time: "11:00 AM", status: "Completed", imageId: "doctor7" },
];


export default function PatientPortalPage() {
    const { userData } = useUserData();

    const isDemoPatient = userData?.email === 'patient@mediconnect.com';

    const upcomingAppointments = isDemoPatient ? demoUpcomingAppointments : [];
    const pastAppointments = isDemoPatient ? demoPastAppointments : [];

    const JoinCallDialog = ({ apt }: { apt: any }) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button>Join</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose Consultation Method</AlertDialogTitle>
                    <AlertDialogDescription>
                        How would you like to connect with {apt.doctor}?
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

    const AppointmentCard = ({ apt }: { apt: any }) => {
        const doctorImage = PlaceHolderImages.find(p => p.id === apt.imageId);
        return (
            <Card className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                <CardHeader className="flex flex-row items-center gap-4 md:col-span-2">
                    {doctorImage && (
                        <Image
                            src={doctorImage.imageUrl}
                            alt={apt.doctor}
                            width={56}
                            height={56}
                            className="rounded-full"
                            data-ai-hint={doctorImage.imageHint}
                        />
                    )}
                    <div>
                        <CardTitle>{apt.doctor}</CardTitle>
                        <CardDescription>{apt.specialty}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 md:pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{apt.date} at {apt.time}</span>
                    </div>
                </CardContent>
                <div className="p-6 pt-0 md:pt-6 text-right">
                    {apt.status === "Upcoming" && <JoinCallDialog apt={apt}/>}
                    {apt.status === "Completed" && <Button variant="outline" asChild><Link href={`/appointments/${apt.id}`}>View Details</Link></Button>}
                </div>
            </Card>
        )
    };


    return (
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Patient Portal</h1>
                        <p className="text-muted-foreground">Welcome back, {userData?.firstName || 'User'}!</p>
                    </div>
                    <Button asChild>
                        <Link href="/find-a-doctor">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Book New Appointment
                        </Link>
                    </Button>
                </div>
                
                {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
                     <Card className="text-center py-24">
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
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                                </div>
                            </section>
                        )}

                        {pastAppointments.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold font-headline mb-4">Past Appointments</h2>
                                <div className="space-y-4">
                                    {pastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} />)}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
          </main>
          <AppFooter />
        </div>
    )
}
