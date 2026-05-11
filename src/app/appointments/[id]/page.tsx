'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Download, Loader2, MessageSquare, Stethoscope, Video, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useDoc, useFirestore, useUserData, useMemoFirebase } from '@/firebase';
import type { Appointment, Doctor } from '@/lib/types';
import { doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { format } from "date-fns";

export default function AppointmentDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const firestore = useFirestore();
    const { userData, isUserLoading } = useUserData();

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

        // Header Style
        doc.setFillColor(20, 184, 166); // Primary Color
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.text("Mediconnect", 20, 20);
        doc.setFontSize(10);
        doc.text("OFFICIAL CONSULTATION SUMMARY", 20, 30);

        // Reset Text Color
        doc.setTextColor(40, 40, 40);
        
        // Doctor & Patient Block
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Healthcare Professional", 20, 55);
        doc.setFont("helvetica", "normal");
        doc.text(doctorName, 20, 62);
        doc.text(doctor.specialty || 'Medical Specialist', 20, 68);
        doc.text(doctor.location || 'Pakistan', 20, 74);

        doc.setFont("helvetica", "bold");
        doc.text("Patient Information", 120, 55);
        doc.setFont("helvetica", "normal");
        doc.text(patientName, 120, 62);
        doc.text(`ID: ${userData.id.slice(0, 8)}`, 120, 68);
        doc.text(`Contact: ${userData.phone || 'N/A'}`, 120, 74);

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 85, 190, 85);

        // Appointment Metadata
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Session Metadata:", 20, 95);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${format(new Date(appointment.appointmentDateTime), "PPP")}`, 20, 102);
        doc.text(`Time: ${format(new Date(appointment.appointmentDateTime), "p")}`, 20, 108);
        doc.text(`Mode: ${appointment.appointmentType}`, 120, 102);
        doc.text(`Fee: PKR ${appointment.amount?.toLocaleString() || '1,500'} (Approved)`, 120, 108);

        // Clinical Findings
        doc.setFillColor(245, 245, 245);
        doc.rect(20, 115, 170, 40, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Diagnosis", 25, 125);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitDiagnosis = doc.splitTextToSize(appointment.diagnosis || 'No diagnosis recorded during session.', 160);
        doc.text(splitDiagnosis, 25, 132);

        // Prescriptions
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Treatment & Advice", 20, 165);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitPrescription = doc.splitTextToSize(appointment.prescription || 'No specific prescription provided.', 170);
        doc.text(splitPrescription, 20, 172);

        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(20, 184, 166);
        doc.line(20, pageHeight - 30, 190, pageHeight - 30);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("This is an electronically generated record. No signature required.", 105, pageHeight - 20, { align: 'center' });
        doc.text("For any queries, contact support@mediconnect.com", 105, pageHeight - 15, { align: 'center' });
        
        doc.save(`Mediconnect-Summary-${appointment.id.slice(0, 8)}.pdf`);
    }

    const isLoading = isUserLoading || isLoadingAppointment || (appointment && isLoadingDoctor);

    if (isLoading) {
        return (
             <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex flex-col items-center justify-center bg-secondary/30">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground animate-pulse">Loading clinical archive...</p>
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
                    <div className="text-center p-8 bg-card rounded-3xl shadow-sm border max-w-md mx-4">
                        <FileText className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold font-headline">Record Not Found</h1>
                        <p className="text-muted-foreground mt-2">The requested consultation summary could not be retrieved. It may have been archived or deleted.</p>
                        <Button asChild className="mt-6 w-full rounded-xl">
                            <Link href="/patient-portal">Back to Portal</Link>
                        </Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        );
    }

    const photoSrc = doctor?.photoURL || doctorImage?.imageUrl;

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-8 sm:py-12">
                <div className="container mx-auto px-4 max-w-5xl">
                    <Button variant="ghost" asChild className="mb-6 rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-muted">
                        <Link href="/patient-portal">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Appointments
                        </Link>
                    </Button>
                    
                    <Card className="overflow-hidden shadow-2xl border-none rounded-[2rem] bg-white">
                        <CardHeader className="text-center bg-primary text-primary-foreground p-8 sm:p-12 relative">
                             <div className="flex justify-center mb-6">
                                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-white/20 shadow-xl overflow-hidden relative bg-white/10">
                                    {photoSrc ? (
                                        <Image
                                            src={photoSrc}
                                            alt={`Dr. ${doctor?.firstName}`}
                                            fill
                                            className="object-cover"
                                            data-ai-hint="doctor portrait"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <Stethoscope className="h-12 w-12 text-white/50" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <CardTitle className="text-3xl sm:text-4xl font-headline tracking-tight">Dr. {doctor?.firstName} {doctor?.lastName}</CardTitle>
                            <CardDescription className="text-lg text-white/80 font-bold uppercase tracking-[0.2em] mt-2">{doctor?.specialty || 'Medical Specialist'}</CardDescription>
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <Badge className="bg-white/20 text-white border-none px-4 py-1 rounded-full"><MapPin className="h-3 w-3 mr-1.5" /> {doctor?.location || 'Pakistan'}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-12 space-y-12">
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center border-b pb-12">
                                <div className="space-y-2">
                                    <div className="p-4 rounded-3xl bg-primary/5 text-primary w-fit mx-auto mb-3 shadow-inner">
                                        <Calendar className="h-7 w-7"/>
                                    </div>
                                    <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Consultation Date</p>
                                    <p className="text-lg font-bold">{format(new Date(appointment.appointmentDateTime), "PPP")}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="p-4 rounded-3xl bg-primary/5 text-primary w-fit mx-auto mb-3 shadow-inner">
                                        <Clock className="h-7 w-7"/>
                                    </div>
                                    <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Session Time</p>
                                    <p className="text-lg font-bold">{format(new Date(appointment.appointmentDateTime), "p")}</p>
                                </div>
                                <div className="space-y-2">
                                     <div className="p-4 rounded-3xl bg-primary/5 text-primary w-fit mx-auto mb-3 shadow-inner">
                                         {appointment.appointmentType === 'Video Call' ? <Video className="h-7 w-7" /> : <MessageSquare className="h-7 w-7" />}
                                     </div>
                                    <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Channel</p>
                                    <p className="text-lg font-bold">{appointment.appointmentType}</p>
                                </div>
                            </div>
                             
                             <div className="grid md:grid-cols-2 gap-12 pt-4">
                                <div className="space-y-6">
                                    <h3 className="font-bold text-xl flex items-center gap-3">
                                        <div className="h-8 w-1.5 bg-primary rounded-full"></div>
                                        Clinical Diagnosis
                                    </h3>
                                    <div className="text-slate-700 bg-muted/30 p-8 rounded-[1.5rem] border-2 border-dashed border-primary/10 min-h-[160px] leading-relaxed italic">
                                        {appointment.diagnosis || "The clinical findings for this session are being finalized by your doctor. Please check back shortly."}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="font-bold text-xl flex items-center gap-3 text-foreground">
                                         <div className="h-8 w-1.5 bg-primary rounded-full"></div>
                                        Treatment & Advice
                                    </h3>
                                    <div className="text-slate-700 whitespace-pre-wrap bg-muted/30 p-8 rounded-[1.5rem] border-2 border-dashed border-primary/10 min-h-[160px] leading-relaxed">
                                        {appointment.prescription || "Prescription details and follow-up advice will appear here once uploaded."}
                                    </div>
                                </div>
                            </div>

                             <div className="flex flex-col items-center gap-6 pt-10 border-t mt-8">
                                <Button size="lg" className="px-10 h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 gap-3 group" onClick={handleDownload} disabled={!appointment.diagnosis}>
                                    <Download className="h-6 w-6 group-hover:translate-y-0.5 transition-transform"/>
                                    Download Clinical Summary (PDF)
                                </Button>
                                {!appointment.diagnosis && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-100">
                                        <Clock className="h-4 w-4" /> PDF export is generated only after clinical notes are recorded.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="mt-12 p-8 bg-primary/5 rounded-3xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <MessageSquare className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Need to discuss these results?</p>
                                <p className="text-xs text-muted-foreground">Book a follow-up consultation with Dr. {doctor?.lastName}.</p>
                            </div>
                        </div>
                        <Button asChild variant="outline" className="rounded-xl border-2 font-bold px-8">
                            <Link href={`/find-a-doctor/${appointment.doctorId}`}>Book Follow-up</Link>
                        </Button>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
