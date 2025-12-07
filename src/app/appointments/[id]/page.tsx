'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Stethoscope, User, Video, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doctors } from "@/lib/data";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

const pastAppointments = [
    { id: 2, doctorId: '2', date: "2024-07-20", time: "02:30 PM", type: "Chat", summary: "Discussed skin rash and prescribed a topical cream. Follow-up in 2 weeks if no improvement." },
    { id: 3, doctorId: '6', date: "2024-06-10", time: "11:00 AM", type: "Video Call", summary: "Annual physical check-up. All vitals are normal. Discussed diet and exercise improvements." },
];

export default function AppointmentDetailsPage() {
    const params = useParams();
    const id = params.id;

    // In a real app, you'd fetch this data from your backend based on the ID.
    const appointment = pastAppointments.find(apt => apt.id.toString() === id);
    const doctor = appointment ? doctors.find(doc => doc.id === appointment.doctorId) : null;
    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;
    
    const getIcon = (type: string) => {
        if (type === 'Video Call') return <Video className="w-5 h-5" />;
        return <MessageSquare className="w-5 h-5" />;
    }

    if (!appointment || !doctor) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Appointment Not Found</h1>
                        <p className="text-muted-foreground mt-2">The requested appointment could not be found.</p>
                        <Button asChild className="mt-6">
                            <Link href="/patient-portal">Go to Portal</Link>
                        </Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-12">
                <div className="container mx-auto px-4">
                    <Button variant="ghost" asChild className="mb-6">
                        <Link href="/patient-portal">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Appointments
                        </Link>
                    </Button>
                    
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader className="text-center bg-muted/30 rounded-t-lg">
                             <div className="flex justify-center mb-4">
                                {doctorImage && (
                                    <Image
                                        src={doctorImage.imageUrl}
                                        alt={doctor.name}
                                        width={96}
                                        height={96}
                                        className="rounded-full border-4 border-background"
                                        data-ai-hint={doctorImage.imageHint}
                                    />
                                )}
                            </div>
                            <CardTitle className="text-3xl font-headline">{doctor.name}</CardTitle>
                            <CardDescription className="text-lg text-primary">{doctor.specialty}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <Calendar className="h-8 w-8 text-primary"/>
                                    <p className="font-semibold">Date</p>
                                    <p className="text-muted-foreground">{appointment.date}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <Clock className="h-8 w-8 text-primary"/>
                                    <p className="font-semibold">Time</p>
                                    <p className="text-muted-foreground">{appointment.time}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                     <div className="p-2 rounded-full bg-primary/10">
                                         {getIcon(appointment.type)}
                                     </div>
                                    <p className="font-semibold">Type</p>
                                    <p className="text-muted-foreground">{appointment.type}</p>
                                </div>
                            </div>
                             <div className="border-t pt-6">
                                <h3 className="font-bold text-xl mb-4 text-center">Consultation Summary</h3>
                                <p className="text-muted-foreground text-center bg-muted/50 p-4 rounded-md">
                                    {appointment.summary}
                                </p>
                            </div>
                             <div className="flex justify-center pt-4">
                                <Button>Book Follow-up</Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
            <AppFooter />
        </div>
    );
}
