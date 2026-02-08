'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Download, Loader2, MessageSquare, Stethoscope, User, Video } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useDoc, useFirestore, useUserData, useMemoFirebase } from '@/firebase';
import type { Appointment, Doctor } from '@/lib/types';
import { doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { PlaceHolderImages } from "@/lib/placeholder-images";


export default function AppointmentDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const firestore = useFirestore();
    const { user, userData, isUserLoading } = useUserData();

    const appointmentDocRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'appointments', id);
    }, [firestore, id]);
    const { data: appointment, isLoading: isLoadingAppointment } = useDoc<Appointment>(appointmentDocRef);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return doc(firestore, 'doctors', appointment.doctorId);
    }, [firestore, appointment?.doctorId]);
    const { data: doctor, isLoading: isLoadingDoctor } = useDoc<Doctor>(doctorDocRef);
    
    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;

    const handleDownload = () => {
        if (!appointment || !doctor || !userData) return;

        const doc = new jsPDF();
        const patientName = `${userData.firstName} ${userData.lastName}`;
        const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;

        // Header
        doc.setFontSize(22);
        doc.text("Appointment Summary", 105, 20, { align: 'center' });

        // Patient and Doctor Info
        doc.setFontSize(12);
        doc.text(`Patient: ${patientName}`, 20, 40);
        doc.text(`Doctor: ${doctorName}`, 20, 50);
        doc.text(`Specialty: ${doctor.specialty}`, 20, 60);

        // Appointment Details
        doc.text(`Date: ${new Date(appointment.appointmentDateTime).toLocaleDateString()}`, 120, 40);
        doc.text(`Time: ${new Date(appointment.appointmentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 120, 50);
        doc.text(`Amount Paid: PKR ${appointment.amount?.toLocaleString() || '1,500'}`, 120, 60);

        doc.line(20, 70, 190, 70); // separator

        // Diagnosis
        doc.setFontSize(16);
        doc.text("Diagnosis", 20, 80);
        doc.setFontSize(12);
        doc.text(appointment.diagnosis || 'Not provided.', 20, 88);

        doc.line(20, 100, 190, 100); // separator

        // Prescription
        doc.setFontSize(16);
        doc.text("Prescription & Advice", 20, 110);
        doc.setFontSize(12);
        const splitPrescription = doc.splitTextToSize(appointment.prescription || 'No specific prescription provided.', 170);
        doc.text(splitPrescription, 20, 118);

        // Footer
        doc.line(20, doc.internal.pageSize.height - 30, 190, doc.internal.pageSize.height - 30);
        doc.setFontSize(10);
        doc.text("Mediconnect - Your Health Partner", 105, doc.internal.pageSize.height - 20, { align: 'center' });
        
        doc.save(`Mediconnect-Appointment-${appointment.id}.pdf`);
    }

    const isLoading = isUserLoading || isLoadingAppointment || isLoadingDoctor;

    if (isLoading) {
        return (
             <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
                <AppFooter />
            </div>
        )
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
    
    const getIcon = (type: string) => {
        if (type === 'Video Call') return <Video className="w-5 h-5" />;
        return <MessageSquare className="w-5 h-5" />;
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
                        <CardHeader className="text-center bg-muted/30 rounded-t-lg p-6">
                             <div className="flex justify-center mb-4">
                                {doctorImage && (
                                    <Image
                                        src={doctorImage.imageUrl}
                                        alt={`Dr. ${doctor.firstName}`}
                                        width={96}
                                        height={96}
                                        className="rounded-full border-4 border-background"
                                        data-ai-hint={doctorImage.imageHint}
                                    />
                                )}
                            </div>
                            <CardTitle className="text-3xl font-headline">Dr. {doctor.firstName}</CardTitle>
                            <CardDescription className="text-lg text-primary">{doctor.specialty}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 md:p-8 space-y-8">
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center border-b pb-8">
                                <div className="flex flex-col items-center gap-2">
                                    <Calendar className="h-8 w-8 text-primary"/>
                                    <p className="font-semibold">Date</p>
                                    <p className="text-muted-foreground">{new Date(appointment.appointmentDateTime).toLocaleDateString()}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <Clock className="h-8 w-8 text-primary"/>
                                    <p className="font-semibold">Time</p>
                                    <p className="text-muted-foreground">{new Date(appointment.appointmentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                     <div className="p-3 rounded-full bg-primary/10 text-primary">
                                         {getIcon(appointment.appointmentType)}
                                     </div>
                                    <p className="font-semibold">Type</p>
                                    <p className="text-muted-foreground">{appointment.appointmentType}</p>
                                </div>
                            </div>
                             <div>
                                <h3 className="font-bold text-xl mb-4">Diagnosis</h3>
                                <p className="text-muted-foreground bg-muted/50 p-4 rounded-md">
                                    {appointment.diagnosis || "Your doctor has not added a diagnosis yet."}
                                </p>
                            </div>
                             <div>
                                <h3 className="font-bold text-xl mb-4">Prescription & Doctor's Advice</h3>
                                <p className="text-muted-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-md">
                                    {appointment.prescription || "Your doctor has not added a prescription yet."}
                                </p>
                            </div>
                             <div className="flex justify-center pt-4">
                                <Button onClick={handleDownload} disabled={!appointment.diagnosis}>
                                    <Download className="mr-2 h-4 w-4"/>
                                    Download Details
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
            <AppFooter />
        </div>
    );
}
