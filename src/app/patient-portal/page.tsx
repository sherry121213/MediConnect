'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, MessageSquare, PlusCircle, Loader2, Stethoscope, Clock, History, ChevronRight, FileText, PhoneCall, RefreshCw, CalendarIcon } from "lucide-react";
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
import { useUserData, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import type { Appointment, Doctor } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { format, isAfter, subHours, isSameDay, startOfDay, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { getNext7Days, timeSlots } from "@/lib/time";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";

const postponeSchema = z.object({
  newDate: z.date({ required_error: "Please select a new date." }),
  newTime: z.string().min(1, "Please select a new time."),
});
type PostponeFormValues = z.infer<typeof postponeSchema>;

function PostponeDialog({ isOpen, onOpenChange, appointment }: { isOpen: boolean, onOpenChange: (open: boolean) => void, appointment: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return doc(firestore, 'doctors', appointment.doctorId);
    }, [firestore, appointment?.doctorId]);
    const { data: doctor } = useDoc<Doctor>(doctorDocRef);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', appointment.doctorId));
    }, [firestore, appointment?.doctorId]);
    const { data: doctorAppointments } = useCollection<Appointment>(appointmentsQuery);

    const unavailabilityQuery = useMemoFirebase(() => {
        if (!firestore || !appointment?.doctorId) return null;
        return query(
            collection(firestore, 'doctorUnavailabilityRequests'),
            where('doctorId', '==', appointment.doctorId),
            where('status', '==', 'approved')
        );
    }, [firestore, appointment?.doctorId]);
    const { data: approvedLeave } = useCollection<any>(unavailabilityQuery);

    const form = useForm<PostponeFormValues>({
        resolver: zodResolver(postponeSchema),
        defaultValues: {
            newDate: undefined,
            newTime: "",
        }
    });

    const selectedDate = form.watch("newDate");

    const isDayOffByAdmin = useMemo(() => {
        if (!approvedLeave || !selectedDate) return false;
        return approvedLeave.some((leave: any) => isSameDay(new Date(leave.requestedDate), selectedDate));
    }, [approvedLeave, selectedDate]);

    const bookedTimes = useMemo(() => {
        if (!doctorAppointments || !selectedDate) return [];
        return doctorAppointments
            .filter(apt => isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled' && apt.id !== appointment.id)
            .map(apt => format(new Date(apt.appointmentDateTime), "hh:mm a"));
    }, [doctorAppointments, selectedDate, appointment.id]);

    const isTimeSlotPast = (time: string, date: Date) => {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (!isToday) return false;
        const [timePart, ampm] = time.split(' ');
        const [hours, minutes] = timePart.split(':');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        const timeSlotDateTime = new Date(date);
        timeSlotDateTime.setHours(numericHours, parseInt(minutes), 0, 0);
        return timeSlotDateTime < now;
    };

    const onSubmit = async (values: PostponeFormValues) => {
        if (!firestore) return;
        setIsSaving(true);

        const newDateTime = new Date(values.newDate);
        const [hours, minutesPart] = values.newTime.split(':');
        const [minutes, ampm] = minutesPart.split(' ');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        newDateTime.setHours(numericHours, parseInt(minutes), 0, 0);

        const appointmentRef = doc(firestore, 'appointments', appointment.id);
        updateDocumentNonBlocking(appointmentRef, {
            appointmentDateTime: newDateTime.toISOString(),
            updatedAt: new Date().toISOString()
        });

        toast({ title: "Appointment Rescheduled", description: `Session moved to ${format(newDateTime, "PPP p")}` });
        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-primary" /> Reschedule Consultation
                    </DialogTitle>
                    <DialogDescription>Select a new time for your session with {doctor ? `Dr. ${doctor.firstName}` : 'your doctor'}.</DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="newDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Pick New Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Select date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <DayPickerCalendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => isBefore(date, startOfDay(new Date()))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedDate && !isDayOffByAdmin && (
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase opacity-60">Available Slots</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[...timeSlots.morning, ...timeSlots.afternoon, ...timeSlots.evening].map(time => {
                                        const isPast = isTimeSlotPast(time, selectedDate);
                                        const isBooked = bookedTimes.includes(time);
                                        const isDisabledByDoctor = doctor?.availability?.disabledSlots?.includes(time);
                                        const isDisabled = isPast || isBooked || isDisabledByDoctor;

                                        if (isDisabledByDoctor && !isBooked) return null;

                                        return (
                                            <Button 
                                                key={time} 
                                                type="button"
                                                variant={form.getValues("newTime") === time ? "default" : "outline"}
                                                size="sm"
                                                className="text-[10px] font-bold"
                                                disabled={isDisabled}
                                                onClick={() => form.setValue("newTime", time)}
                                            >
                                                {time}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {isDayOffByAdmin && (
                            <div className="p-4 bg-destructive/5 text-destructive rounded-lg text-xs text-center border border-destructive/10">
                                Doctor is unavailable on this date. Please select another day.
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving || !form.getValues("newTime")}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm New Slot"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const AppointmentCard = ({ apt, isUpcoming, onPostpone, isMounted }: { apt: any, isUpcoming: boolean, onPostpone: (a: any) => void, isMounted: boolean }) => {
    const firestore = useFirestore();
    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !apt.doctorId) return null;
        return doc(firestore, 'doctors', apt.doctorId);
    }, [firestore, apt.doctorId]);
    
    const { data: doctor, isLoading: isLoadingDoctor } = useDoc<Doctor>(doctorDocRef);
    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;
    const appointmentDate = new Date(apt.appointmentDateTime);
    
    // Hydration-safe timing check
    const isTimeReached = isMounted && new Date().getTime() >= appointmentDate.getTime();

    const JoinCallDialog = () => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                {isTimeReached ? (
                    <Button className="w-full sm:w-auto font-bold">
                        Join Session
                    </Button>
                ) : (
                    <Button className="w-full sm:w-auto font-bold opacity-70 cursor-not-allowed" disabled>
                        Not Started Yet <Clock className="ml-2 h-3 w-3" />
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-headline">Clinical Connection</AlertDialogTitle>
                    <AlertDialogDescription>
                        Select your preferred method to connect with {doctor ? `Dr. ${doctor.firstName}` : 'your doctor'}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 gap-4 py-6">
                    <Button 
                        variant="outline" 
                        className={cn(
                            "justify-start h-16 border-2 group",
                            apt.appointmentType === 'Video Call' ? "border-primary bg-primary/5" : "hover:border-primary"
                        )} 
                        asChild
                    >
                        <Link href={`/consultation/${apt.id}`}>
                            <Video className="mr-4 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/> 
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-foreground">Secure Video Room</p>
                                    {apt.appointmentType === 'Video Call' && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white">Direct Integration</Badge>}
                                </div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">HD Video & Internal Audio</p>
                            </div>
                        </Link>
                    </Button>
                    <Button 
                        variant="outline" 
                        className={cn(
                            "justify-start h-16 border-2 group",
                            apt.appointmentType === 'Audio Call' ? "border-primary bg-primary/5" : "hover:border-primary"
                        )} 
                        asChild
                    >
                        <Link href={`/consultation/${apt.id}`}>
                            <PhoneCall className="mr-4 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/> 
                            <div className="text-left">
                                 <div className="flex items-center gap-2">
                                    <p className="font-bold text-foreground">Secure Audio Room</p>
                                    {apt.appointmentType === 'Audio Call' && <Badge variant="secondary" className="h-4 text-[8px] bg-primary text-white">Direct Integration</Badge>}
                                </div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Voice Consultation</p>
                            </div>
                        </Link>
                    </Button>
                    <Button variant="outline" className="justify-start h-16 border-2 hover:border-primary group" asChild>
                        <Link href={`/consultation/${apt.id}`}>
                            <MessageSquare className="mr-4 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/>
                            <div className="text-left">
                                <p className="font-bold text-foreground">Interactive Chat Room</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Integrated Real-time messaging</p>
                            </div>
                        </Link>
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return (
        <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary/40 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className="relative h-16 w-16 shrink-0 shadow-inner rounded-full overflow-hidden bg-muted">
                        {isLoadingDoctor ? (
                             <div className="h-full w-full flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                        ) : doctor?.photoURL || doctorImage ? (
                            <Image
                                src={doctor?.photoURL || doctorImage?.imageUrl || ''}
                                alt={doctor?.firstName || 'Doctor'}
                                fill
                                className="object-cover border-2 border-primary/5"
                                data-ai-hint="doctor portrait"
                            />
                        ) : (
                            <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary">
                                <Stethoscope className="h-8 w-8" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-xl leading-tight tracking-tight truncate">
                                {isLoadingDoctor ? 'Loading Doctor...' : `Dr. ${doctor?.firstName} ${doctor?.lastName}`}
                            </p>
                            <Badge variant="outline" className="text-[9px] h-4 border-primary/20 text-primary font-bold shrink-0">{apt.appointmentType}</Badge>
                        </div>
                        <p className="text-sm text-primary font-bold uppercase tracking-wider opacity-80 truncate">{doctor?.specialty || 'General Physician'}</p>
                        <div className="flex items-center gap-4 pt-1">
                            <Badge variant="secondary" className="bg-primary/5 text-primary-dark border-primary/10 flex items-center gap-1.5 px-2.5">
                                <Calendar className="w-3 h-3" /> {format(appointmentDate, "MMM dd, yyyy")}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1.5 px-2.5">
                                <Clock className="w-3 h-3" /> {format(appointmentDate, "p")}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {apt.paymentStatus === 'pending' ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-4 py-2 font-bold whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-2" /> Pending Verification
                        </Badge>
                    ) : isUpcoming ? (
                        <>
                            <Button variant="outline" size="sm" className="font-bold border-2" onClick={() => onPostpone(apt)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Postpone
                            </Button>
                            <JoinCallDialog />
                        </>
                    ) : (
                        <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5">
                            <Link href={`/appointments/${apt.id}`}>
                                <FileText className="h-4 w-4" /> View Visit Summary
                            </Link>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
};

export default function PatientPortalPage() {
    const { user, userData, isUserLoading } = useUserData();
    const firestore = useFirestore();
    const [mounted, setMounted] = useState(false);
    const [selectedApt, setSelectedApt] = useState<any>(null);
    const [isPostponeOpen, setIsPostponeOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'appointments'), where('patientId', '==', user.uid));
    }, [firestore, user]);
    const { data: appointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const { upcomingAppointments, pendingVerificationAppointments, recentPastAppointments } = useMemo(() => {
        if (!mounted || !appointments) return { upcomingAppointments: [], pendingVerificationAppointments: [], recentPastAppointments: [] };
        
        const now = new Date();
        const threshold = subHours(now, 1); 

        // Only show upcoming appointments if the payment is APPROVED
        const upcoming = appointments
            .filter(apt => 
                isAfter(new Date(apt.appointmentDateTime), threshold) && 
                apt.status !== 'cancelled' && 
                apt.status !== 'completed' &&
                apt.paymentStatus === 'approved'
            )
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        // Appointments awaiting payment verification
        const pending = appointments
            .filter(apt => 
                isAfter(new Date(apt.appointmentDateTime), threshold) && 
                apt.status !== 'cancelled' && 
                apt.paymentStatus === 'pending'
            )
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = appointments
            .filter(apt => !isAfter(new Date(apt.appointmentDateTime), threshold) || apt.status === 'completed')
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime())
            .slice(0, 5);

        return { upcomingAppointments: upcoming, pendingVerificationAppointments: pending, recentPastAppointments: past };
    }, [appointments, mounted]);

    const handlePostpone = (apt: any) => {
        setSelectedApt(apt);
        setIsPostponeOpen(true);
    };

    if (!mounted || isUserLoading) {
        return (
            <div className="flex-grow flex items-center justify-center bg-secondary/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="flex-grow bg-secondary/30 py-10">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-12 gap-10">
                    
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md">
                            <CardHeader className="bg-primary text-primary-foreground pb-10 pt-10">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80">Patient Command Center</CardTitle>
                                <CardDescription className="text-3xl font-bold font-headline text-white mt-2">
                                    Hello, {userData?.firstName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 space-y-6">
                                <div className="space-y-3">
                                    <Button className="w-full justify-start h-14 text-base font-bold shadow-lg shadow-primary/20" asChild>
                                        <Link href="/find-a-doctor">
                                            <PlusCircle className="mr-3 h-5 w-5" /> Book Medical Consultation
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2" asChild>
                                        <Link href="/patient-portal/messages">
                                            <MessageSquare className="mr-3 h-5 w-5 text-primary" /> Clinical Message Center
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2" asChild>
                                        <Link href="/patient-portal/history">
                                            <History className="mr-3 h-5 w-5 text-primary" /> Audit Medical Records
                                        </Link>
                                    </Button>
                                </div>
                                <div className="mt-8 pt-8 border-t space-y-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Clinical Wellness Tip</p>
                                    <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                                        <p className="text-sm text-primary-dark italic leading-relaxed font-medium">
                                            "Maintaining a consistent sleep schedule of 7-9 hours per night significantly boosts your immune system's efficacy."
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-12">
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                                    <div className="h-8 w-1 bg-primary rounded-full"></div>
                                    Scheduled consultations
                                </h2>
                                {upcomingAppointments.length > 0 && (
                                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1 font-bold">
                                        {upcomingAppointments.length} Active
                                    </Badge>
                                )}
                            </div>
                            
                            {isLoadingAppointments ? (
                                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent">
                                    <CardContent className="py-16 text-center">
                                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Calendar className="h-8 w-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-muted-foreground font-medium">No verified consultations scheduled.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Pending payments will appear in the verification section below.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-5">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                            )}
                        </section>

                        {pendingVerificationAppointments.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                                        <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
                                        Verification in progress
                                    </h2>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-3 py-1 font-bold">
                                        {pendingVerificationAppointments.length} Awaiting Audit
                                    </Badge>
                                </div>
                                <div className="space-y-5 opacity-90">
                                    {pendingVerificationAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                                <p className="text-[11px] text-muted-foreground italic mt-4 text-center">
                                    Admins review receipts during standard business hours. Once verified, these will move to your active schedule.
                                </p>
                            </section>
                        )}

                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold font-headline flex items-center gap-3">
                                     <div className="h-8 w-1 bg-muted rounded-full"></div>
                                    Clinical History
                                </h2>
                                {recentPastAppointments.length > 0 && (
                                    <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary font-bold group">
                                        <Link href="/patient-portal/history" className="flex items-center gap-1">
                                            View Audit <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {isLoadingAppointments ? (
                                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                            ) : recentPastAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent">
                                    <CardContent className="py-16 text-center text-muted-foreground">
                                        <p className="font-medium">No historical clinical records detected.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-5">
                                    {recentPastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            <PostponeDialog 
                isOpen={isPostponeOpen} 
                onOpenChange={setIsPostponeOpen} 
                appointment={selectedApt} 
            />
        </main>
    )
}
