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
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";


const notesSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required."),
  prescription: z.string().min(10, "Prescription details are required."),
});
type NotesFormValues = z.infer<typeof notesSchema>;

function AddNotesDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: Appointment | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<NotesFormValues>({
        resolver: zodResolver(notesSchema),
        defaultValues: { diagnosis: '', prescription: '' }
    });

    useEffect(() => {
        if (appointment) {
            form.reset({
                diagnosis: appointment.diagnosis || '',
                prescription: appointment.prescription || '',
            });
        }
    }, [appointment, form]);

    if (!appointment) return null;

    const onSubmit = (values: NotesFormValues) => {
        if (!firestore) return;
        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, { ...values, status: 'completed' });
        toast({ title: "Notes Saved", description: "The appointment notes have been updated." });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Consultation Notes</DialogTitle>
                    <DialogDescription>
                        Add diagnosis and prescription for the appointment on {new Date(appointment.appointmentDateTime).toLocaleDateString()}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="diagnosis"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Diagnosis</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Viral Infection" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="prescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prescription & Advice</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Paracetamol 500mg, twice a day for 3 days..." rows={5} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Saving..." : "Save Notes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// This component fetches its own patient data, preventing a 'list' query on the whole collection.
const AppointmentCard = ({ apt, onAddNotes }: { apt: Appointment, onAddNotes: () => void }) => {
    const firestore = useFirestore();

    const patientDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'patients', apt.patientId);
    }, [firestore, apt.patientId]);

    const { data: patient, isLoading: isLoadingPatient } = useDoc<Patient>(patientDocRef);
    
    const appointmentDate = new Date(apt.appointmentDateTime);
    const isPast = appointmentDate < new Date();

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

    const getPaymentStatusBadge = (status?: string) => {
        switch (status) {
        case 'approved':
            return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
        case 'rejected':
            return <Badge variant="destructive">Rejected</Badge>;
        case 'pending':
        default:
            return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
        }
    };

    if (isLoadingPatient) {
        return (
             <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>
                        <div className="flex-1">
                             <Skeleton className="h-4 w-40" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 w-24" />
                            <Skeleton className="h-9 w-20" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
    const patientImage = patient?.photoURL;
    const patientFallback = patientName.charAt(0);

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={patientImage} alt={patientName} />
                            <AvatarFallback>{patientFallback}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{patientName}</p>
                            <div className="mt-1">
                                {getPaymentStatusBadge(apt.paymentStatus)}
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{appointmentDate.toLocaleDateString()} at {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 sm:pt-0">
                        {!isPast && apt.status === "scheduled" && <JoinCallDialog patientName={patientName} />}
                        {apt.paymentReceiptUrl && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={apt.paymentReceiptUrl} target="_blank" rel="noopener noreferrer">
                                    View Receipt
                                </Link>
                            </Button>
                        )}
                        {(isPast || apt.status === "completed") && <Button variant="outline" size="sm" onClick={onAddNotes}>Add/View Notes</Button>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DoctorPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);

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

    const pastAppointments = useMemo(() => {
        if (!appointments) return [];
        return appointments
            .filter(apt => new Date(apt.appointmentDateTime) < now)
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());
    }, [appointments]);

    const handleAddNotes = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setIsNotesDialogOpen(true);
    }

    return (
        <main className="flex-grow bg-secondary/30 py-12">
            <div className="container mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold font-headline">Doctor Portal</h1>
                    <p className="text-muted-foreground">Welcome back, Dr. {userData?.firstName || 'Doctor'}!</p>
                </div>

                 {isUserLoading || isLoadingAppointments ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (appointments && appointments.length === 0) ? (
                     <Card className="text-center py-24">
                        <CardContent>
                            <h3 className="text-2xl font-medium font-headline">No Appointments Yet</h3>
                            <p className="text-muted-foreground mt-2 max-w-md mx-auto">Your dashboard is currently empty. As soon as a patient books a consultation with you, it will appear here.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        <section>
                            <h2 className="text-2xl font-bold font-headline mb-4">Upcoming Appointments</h2>
                            {upcomingAppointments.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} onAddNotes={() => handleAddNotes(apt)} />)}
                                </div>
                            ) : (
                                <Card className="text-center py-12">
                                    <CardContent className="p-0">
                                        <p className="text-muted-foreground">You have no scheduled appointments at this time.</p>
                                    </CardContent>
                                </Card>
                            )}
                        </section>
                        
                        {pastAppointments.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold font-headline mb-4">Past Appointments</h2>
                                <div className="space-y-4">
                                    {pastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} onAddNotes={() => handleAddNotes(apt)} />)}
                                </div>
                            </section>
                        )}

                        {appointmentsError && <p className="text-destructive text-center">Error loading appointments: {appointmentsError.message}</p>}
                    </div>
                )}
                 <AddNotesDialog 
                    isOpen={isNotesDialogOpen}
                    onOpenChange={setIsNotesDialogOpen}
                    appointment={selectedAppointment}
                />
            </div>
        </main>
    )
}
