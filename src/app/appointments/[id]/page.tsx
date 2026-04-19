'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Download, Loader2, MessageSquare, Stethoscope, Video } from "lucide-react";
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

    const isLoading = isUserLoading || isLoadingAppointment || (appointment && isLoadingDoctor);

    if (isLoading) {
        return (
             <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex flex-col items-center justify-center bg-secondary/30">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground animate-pulse">Loading appointment details...</p>
                </main>
                <AppFooter />
            </div>
        )
    }

    if (!appointment) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <div className="text-center p-8 bg-card rounded-lg shadow-sm border">
                        <h1 className="text-2xl font-bold font-headline">Appointment Not Found</h1>
                        <p className="text-muted-foreground mt-2 max-w-sm">The requested appointment record could not be retrieved. It might still be processing.</p>
                        <Button asChild className="mt-6">
                            <Link href="/patient-portal">Return to Portal</Link>
                        </Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        );
    }

    if (!doctor && !isLoadingDoctor) {
        return (
             <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Doctor Info Unavailable</h1>
                        <p className="text-muted-foreground mt-2">Could not retrieve information for the assigned doctor.</p>
                        <Button asChild className="mt-6">
                            <Link href="/patient-portal">Back to Portal</Link>
                        </Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        )
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
                    
                    <Card className="max-w-4xl mx-auto overflow-hidden shadow-xl border-none">
                        <CardHeader className="text-center bg-primary text-primary-foreground p-8">
                             <div className="flex justify-center mb-4">
                                {doctorImage ? (
                                    <Image
                                        src={doctorImage.imageUrl}
                                        alt={`Dr. ${doctor?.firstName}`}
                                        width={112}
                                        height={112}
                                        className="rounded-full border-4 border-primary-foreground/20 shadow-lg"
                                        data-ai-hint={doctorImage.imageHint}
                                    />
                                ) : (
                                    <div className="h-28 w-28 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground border-4 border-primary-foreground/10">
                                        <Stethoscope className="h-12 w-12" />
                                    </div>
                                )}
                            </div>
                            <CardTitle className="text-3xl font-headline">Dr. {doctor?.firstName} {doctor?.lastName}</CardTitle>
                            <CardDescription className="text-lg text-primary-foreground/80">{doctor?.specialty || 'Medical Specialist'}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 md:p-12 space-y-10 bg-card">
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center border-b pb-10">
                                <div className="space-y-2">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary w-fit mx-auto mb-2">
                                        <Calendar className="h-6 w-6"/>
                                    </div>
                                    <p className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Date</p>
                                    <p className="text-lg font-medium">{new Date(appointment.appointmentDateTime).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="p-3 rounded-full bg-primary/10 text-primary w-fit mx-auto mb-2">
                                        <Clock className="h-6 w-6"/>
                                    </div>
                                    <p className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Time</p>
                                    <p className="text-lg font-medium">{new Date(appointment.appointmentDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="space-y-2">
                                     <div className="p-3 rounded-full bg-primary/10 text-primary w-fit mx-auto mb-2">
                                         {getIcon(appointment.appointmentType)}
                                     </div>
                                    <p className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Consultation</p>
                                    <p className="text-lg font-medium">{appointment.appointmentType}</p>
                                </div>
                            </div>
                             
                             <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-xl flex items-center gap-2">
                                        <div className="h-6 w-1 bg-primary rounded-full"></div>
                                        Diagnosis
                                    </h3>
                                    <div className="text-muted-foreground bg-muted/40 p-6 rounded-xl border border-muted min-h-[120px] leading-relaxed">
                                        {appointment.diagnosis || "Your doctor has not added a diagnosis yet. This usually occurs during or after the session."}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-xl flex items-center gap-2">
                                         <div className="h-6 w-1 bg-primary rounded-full"></div>
                                        Prescription & Advice
                                    </h3>
                                    <div className="text-muted-foreground whitespace-pre-wrap bg-muted/40 p-6 rounded-xl border border-muted min-h-[120px] leading-relaxed">
                                        {appointment.prescription || "No prescription details have been uploaded yet."}
                                    </div>
                                </div>
                            </div>

                             <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4 border-t">
                                <Button size="lg" className="px-8 font-bold" onClick={handleDownload} disabled={!appointment.diagnosis}>
                                    <Download className="mr-2 h-5 w-5"/>
                                    Download Summary (PDF)
                                </Button>
                                {!appointment.diagnosis && (
                                    <p className="text-xs text-muted-foreground italic">PDF download available after diagnosis is recorded.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
            <AppFooter />
        </div>
    );
}