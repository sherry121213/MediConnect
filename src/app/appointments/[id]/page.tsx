
'use client';

import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Download, Loader2, MessageSquare, Stethoscope, Video, FileText, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useDoc, useFirestore, useUserData, useMemoFirebase, useCollection } from '@/firebase';
import type { Appointment, Doctor, Review } from '@/lib/types';
import { doc, collection, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { format } from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const reviewSchema = z.object({
    rating: z.number().min(1, "Please select a rating").max(5),
    comment: z.string().min(10, "Please provide more detailed feedback (min 10 characters).").max(300),
});

export default function AppointmentDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const firestore = useFirestore();
    const { userData, isUserLoading } = useUserData();
    const { toast } = useToast();
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
    
    // Check if review already exists
    const reviewQuery = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return query(collection(firestore, 'reviews'), where('appointmentId', '==', id));
    }, [firestore, id]);
    const { data: reviews, isLoading: isLoadingReviews } = useCollection<Review>(reviewQuery);
    const existingReview = reviews?.[0];

    const form = useForm({
        resolver: zodResolver(reviewSchema),
        defaultValues: { rating: 5, comment: '' }
    });

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

    const onSubmitReview = async (values: any) => {
        if (!userData || !appointment || !firestore) return;
        setIsSubmittingReview(true);
        
        try {
            const reviewData = {
                patientId: userData.id,
                doctorId: appointment.doctorId,
                appointmentId: appointment.id,
                rating: values.rating,
                comment: values.comment,
                createdAt: new Date().toISOString()
            };

            await addDocumentNonBlocking(collection(firestore, 'reviews'), reviewData);
            toast({ title: "Review Submitted", description: "Thank you for your valuable feedback." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Error", description: "Could not submit review." });
        } finally {
            setIsSubmittingReview(false);
        }
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

    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;
    const photoSrc = doctor?.photoURL || doctorImage?.imageUrl;
    const isPerformed = appointment.status === 'completed';

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-8 sm:py-12">
                <div className="container mx-auto px-4 max-w-5xl space-y-12">
                    <Button variant="ghost" asChild className="mb-2 rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-muted">
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

                    {/* RATING SECTION - ONLY FOR PERFORMED SESSIONS */}
                    {isPerformed && (
                        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b p-8">
                                <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                    <Star className="h-6 w-6 text-amber-500 fill-amber-500" /> Rate your Experience
                                </CardTitle>
                                <CardDescription>Your feedback helps us maintain high clinical standards.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                {isLoadingReviews ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                ) : existingReview ? (
                                    <div className="p-8 bg-green-50 border-2 border-green-100 rounded-3xl flex flex-col items-center text-center space-y-4">
                                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                            <Star className="h-10 w-10 text-green-600 fill-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg text-green-800">Feedback Received</p>
                                            <p className="text-xs text-green-600 italic mt-1">" {existingReview.comment} "</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={cn("h-4 w-4", i < existingReview.rating ? "text-amber-500 fill-amber-500" : "text-slate-300")} />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmitReview)} className="space-y-8">
                                            <div className="flex flex-col items-center gap-4">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Clinical Rating</p>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button 
                                                            key={star} 
                                                            type="button" 
                                                            onClick={() => form.setValue('rating', star)}
                                                            className="transition-transform active:scale-90"
                                                        >
                                                            <Star 
                                                                className={cn(
                                                                    "h-10 w-10", 
                                                                    star <= form.watch('rating') ? "text-amber-500 fill-amber-500" : "text-slate-200"
                                                                )} 
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name="comment"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Detailed Testimonial</FormLabel>
                                                        <FormControl>
                                                            <Textarea 
                                                                placeholder="How was your consultation? Describe Dr. {doctor?.lastName}'s approach..." 
                                                                rows={4}
                                                                className="resize-none rounded-2xl border-2"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <Button type="submit" className="w-full h-14 rounded-2xl font-bold shadow-lg" disabled={isSubmittingReview}>
                                                {isSubmittingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Submit Professional Feedback
                                            </Button>
                                        </form>
                                    </Form>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <div className="p-8 bg-slate-900 text-white rounded-[2rem] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <MessageSquare className="h-6 w-6 text-accent" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Need to discuss these results?</p>
                                <p className="text-xs text-slate-400">Book a follow-up consultation with Dr. {doctor?.lastName}.</p>
                            </div>
                        </div>
                        <Button asChild variant="outline" className="rounded-xl border-2 border-white/20 bg-transparent hover:bg-white/10 text-white font-bold px-8">
                            <Link href={`/find-a-doctor/${appointment.doctorId}`}>Book Follow-up</Link>
                        </Button>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
