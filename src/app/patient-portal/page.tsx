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
import { format, isAfter, subHours, isSameDay, startOfDay, isBefore, isValid } from "date-fns";
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
import { Label } from "@/components/ui/label";

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
        return query(collection(firestore, 'doctorUnavailabilityRequests'), where('doctorId', '==', appointment.doctorId));
    }, [firestore, appointment?.doctorId]);
    const { data: allRequests } = useCollection<any>(unavailabilityQuery);

    const form = useForm<PostponeFormValues>({
        resolver: zodResolver(postponeSchema),
        defaultValues: {
            newDate: undefined,
            newTime: "",
        }
    });

    const selectedDate = form.watch("newDate");

    const isDayOffByAdmin = useMemo(() => {
        if (!allRequests || !selectedDate) return false;
        return allRequests.some((leave: any) => 
            leave && 
            leave.status === 'approved' && 
            leave.requestedDate && 
            isSameDay(new Date(leave.requestedDate), selectedDate)
        );
    }, [allRequests, selectedDate]);

    const bookedTimes = useMemo(() => {
        if (!doctorAppointments || !selectedDate || !appointment) return [];
        return doctorAppointments
            .filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled' && apt.id !== appointment.id)
            .map(apt => {
                const d = new Date(apt.appointmentDateTime);
                return isValid(d) ? format(d, "hh:mm a") : null;
            }).filter(Boolean) as string[];
    }, [doctorAppointments, selectedDate, appointment?.id]);

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
        if (!firestore || !appointment) return;
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

    if (!appointment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] w-[95vw] sm:w-full border-none shadow-2xl">
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
                                    <FormLabel className="text-[10px] uppercase font-bold tracking-widest opacity-60">Step 1: Pick New Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-12 rounded-xl", !field.value && "text-muted-foreground")}>
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
                                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Step 2: Available Slots</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                                className="text-[10px] font-bold rounded-lg h-9"
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
                            <div className="p-6 bg-destructive/5 text-destructive rounded-xl text-xs text-center border border-destructive/10 italic">
                                Doctor is officially unavailable on this date.
                            </div>
                        )}

                        <DialogFooter className="flex flex-col sm:flex-row gap-2">
                            <Button type="button" variant="ghost" className="w-full sm:w-auto h-12" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8 font-bold shadow-lg shadow-primary/20" disabled={isSaving || !form.getValues("newTime")}>
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
        if (!firestore || !apt?.doctorId) return null;
        return doc(firestore, 'doctors', apt.doctorId);
    }, [firestore, apt?.doctorId]);
    
    const { data: doctor, isLoading: isLoadingDoctor } = useDoc<Doctor>(doctorDocRef);
    const doctorImage = doctor ? PlaceHolderImages.find(p => p.id === doctor.profileImageId) : null;
    
    const appointmentDate = useMemo(() => {
        if (!apt?.appointmentDateTime) return null;
        const d = new Date(apt.appointmentDateTime);
        return isValid(d) ? d : null;
    }, [apt?.appointmentDateTime]);
    
    const now = isMounted ? new Date().getTime() : 0;
    const startTime = appointmentDate ? appointmentDate.getTime() : 0;
    const endTime = startTime + (50 * 60 * 1000);
    
    const isTimeReached = isMounted && now >= startTime && now < endTime;
    const isExpired = isMounted && now >= endTime;

    if (!apt || !appointmentDate) return null;

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all border-l-4 bg-card/50 backdrop-blur-sm overflow-hidden",
            isTimeReached ? "border-l-red-500 bg-red-50/10 shadow-md scale-[1.01]" : "border-l-primary/40"
        )}>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-8">
                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                    <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 shadow-inner rounded-full overflow-hidden bg-muted">
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
                                <Stethoscope className="h-6 w-6 sm:h-8 sm:w-8" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-lg sm:text-xl leading-tight tracking-tight truncate max-w-full">
                                {isLoadingDoctor ? 'Loading...' : `Dr. ${doctor?.firstName} ${doctor?.lastName}`}
                            </p>
                            {isTimeReached && (
                                <Badge className="bg-red-600 text-white animate-pulse h-4 text-[8px] sm:text-[9px]">LIVE SESSION</Badge>
                            )}
                            {!isTimeReached && !isExpired && (
                                <Badge variant="outline" className="text-[9px] h-4 border-primary/20 text-primary font-bold shrink-0">50m Slot</Badge>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-primary font-bold uppercase tracking-wider opacity-80 truncate">{doctor?.specialty || 'General Physician'}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Badge variant="secondary" className="bg-primary/5 text-primary-dark border-primary/10 flex items-center gap-1.5 px-2 text-[10px] sm:text-xs font-bold">
                                <CalendarIcon className="w-3 h-3" /> {format(appointmentDate, "MMM dd, yyyy")}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1.5 px-2 text-[10px] sm:text-xs font-bold">
                                <Clock className="w-3 h-3" /> {format(appointmentDate, "p")}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {apt.paymentStatus === 'pending' ? (
                        <div className="flex flex-col gap-1 items-center w-full">
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-4 py-2 font-bold whitespace-nowrap w-full justify-center">
                                <Clock className="w-3 h-3 mr-2" /> Pending Verification
                            </Badge>
                        </div>
                    ) : isUpcoming ? (
                        <>
                            {!isExpired && !isTimeReached && (
                                <Button variant="outline" size="sm" className="font-bold border-2 w-full sm:w-auto h-10 sm:h-9" onClick={() => onPostpone(apt)}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Postpone
                                </Button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    {isTimeReached ? (
                                        <Button className="w-full sm:w-auto font-bold h-10 sm:h-9 shadow-lg shadow-primary/20 bg-red-600 hover:bg-red-700 animate-pulse">
                                            Join Session Now
                                        </Button>
                                    ) : isExpired ? (
                                        <Button variant="secondary" className="w-full sm:w-auto font-bold h-10 sm:h-9 opacity-50 cursor-not-allowed" disabled>
                                            Session Expired
                                        </Button>
                                    ) : (
                                        <Button className="w-full sm:w-auto font-bold opacity-70 cursor-not-allowed h-10 sm:h-9" disabled>
                                            Upcoming <Clock className="ml-2 h-3 w-3" />
                                        </Button>
                                    )}
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[95vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-headline">Clinical Connection</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Select your preferred method to connect with {doctor ? `Dr. ${doctor.firstName}` : 'your doctor'}. Session ends automatically at {format(new Date(endTime), "p")}.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="grid grid-cols-1 gap-4 py-4 sm:py-6">
                                        <Button variant="outline" className="justify-start h-20 sm:h-16 border-2 hover:border-primary group bg-muted/5" asChild>
                                            <Link href={`/consultation/${apt?.id}`}>
                                                <Video className="mr-3 sm:mr-4 h-6 w-6 text-primary shrink-0"/> 
                                                <div className="text-left min-w-0">
                                                    <p className="font-bold text-foreground truncate">Secure Video Room</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate">HD Video & Internal Audio</p>
                                                </div>
                                            </Link>
                                        </Button>
                                        <Button variant="outline" className="justify-start h-20 sm:h-16 border-2 hover:border-primary group bg-muted/5" asChild>
                                            <Link href={`/consultation/${apt?.id}`}>
                                                <MessageSquare className="mr-3 sm:mr-4 h-6 w-6 text-primary shrink-0"/>
                                                <div className="text-left min-w-0">
                                                    <p className="font-bold text-foreground truncate">Interactive Chat</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate">Integrated clinical messaging</p>
                                                </div>
                                            </Link>
                                        </Button>
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="w-full sm:w-auto rounded-xl">Back</AlertDialogCancel>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    ) : (
                        <Button variant="ghost" asChild className="gap-2 text-primary font-bold hover:bg-primary/5 w-full sm:w-auto justify-center h-10 sm:h-9">
                            <Link href={`/appointments/${apt.id}`}>
                                <FileText className="h-4 w-4" /> Visit Summary
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
        const validAppointments = appointments.filter(apt => apt !== null && apt.id && apt.appointmentDateTime);

        const upcoming = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                return isAfter(d, threshold) && 
                       apt.status !== 'cancelled' && 
                       apt.status !== 'completed' &&
                       apt.paymentStatus === 'approved';
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const pending = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                return isAfter(d, threshold) && 
                       apt.status !== 'cancelled' && 
                       apt.paymentStatus === 'pending';
            })
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());

        const past = validAppointments
            .filter(apt => {
                const d = new Date(apt.appointmentDateTime);
                if (!isValid(d)) return false;
                return !isAfter(d, threshold) || apt.status === 'completed';
            })
            .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime())
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
        <main className="flex-grow bg-secondary/30 py-6 sm:py-10">
            <div className="container mx-auto px-4">
                <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
                    
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md">
                            <CardHeader className="bg-primary text-primary-foreground pb-8 pt-8 sm:pb-10 sm:pt-10 px-6 sm:px-8">
                                <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-80">Patient Command Center</CardTitle>
                                <CardDescription className="text-2xl sm:text-3xl font-bold font-headline text-white mt-2">
                                    Hello, {userData?.firstName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 sm:pt-8 space-y-6 px-6 sm:px-8">
                                <div className="space-y-3">
                                    <Button className="w-full justify-start h-14 text-base font-bold shadow-lg shadow-primary/20 rounded-xl" asChild>
                                        <Link href="/find-a-doctor">
                                            <PlusCircle className="mr-3 h-5 w-5 shrink-0" /> Book Consultation
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2 rounded-xl" asChild>
                                        <Link href="/patient-portal/messages">
                                            <MessageSquare className="mr-3 h-5 w-5 text-primary shrink-0" /> Message Center
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start h-14 text-base font-bold border-2 rounded-xl" asChild>
                                        <Link href="/patient-portal/history">
                                            <History className="mr-3 h-5 w-5 text-primary shrink-0" /> Medical Records
                                        </Link>
                                    </Button>
                                </div>
                                <div className="mt-8 pt-8 border-t space-y-4">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Clinical Wellness Tip</p>
                                    <div className="bg-primary/5 p-4 sm:p-5 rounded-2xl border border-primary/10">
                                        <p className="text-xs sm:text-sm text-primary-dark italic leading-relaxed font-medium">
                                            "A 50-minute focused session provides the optimal balance for clinical review and guidance."
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-8 space-y-8 sm:space-y-12">
                        <section>
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-3">
                                    <div className="h-6 sm:h-8 w-1 bg-primary rounded-full"></div>
                                    Scheduled consultations
                                </h2>
                                {upcomingAppointments.length > 0 && (
                                    <Badge className="bg-primary/10 text-primary px-2 sm:px-3 py-1 font-bold text-[10px] sm:text-xs">
                                        {upcomingAppointments.length} Active
                                    </Badge>
                                )}
                            </div>
                            
                            {isLoadingAppointments ? (
                                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent rounded-2xl">
                                    <CardContent className="py-12 sm:py-16 text-center px-4">
                                        <div className="h-12 w-12 sm:h-16 sm:w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-muted-foreground font-medium text-sm sm:text-base">No verified consultations scheduled.</p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Pending payments appear in the verification section below.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4 sm:space-y-5">
                                    {upcomingAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                            )}
                        </section>

                        {pendingVerificationAppointments.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center justify-between mb-4 sm:mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-3">
                                        <div className="h-6 sm:h-8 w-1 bg-amber-500 rounded-full"></div>
                                        Verification in progress
                                    </h2>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 px-2 sm:px-3 py-1 font-bold text-[10px] sm:text-xs">
                                        {pendingVerificationAppointments.length} Awaiting Audit
                                    </Badge>
                                </div>
                                <div className="space-y-4 sm:space-y-5 opacity-90">
                                    {pendingVerificationAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={true} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                            </section>
                        )}

                        <section>
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold font-headline flex items-center gap-3">
                                     <div className="h-6 sm:h-8 w-1 bg-muted rounded-full"></div>
                                    Clinical History
                                </h2>
                                {recentPastAppointments.length > 0 && (
                                    <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary font-bold group text-xs">
                                        <Link href="/patient-portal/history" className="flex items-center gap-1">
                                            View Audit <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {isLoadingAppointments ? (
                                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                            ) : recentPastAppointments.length === 0 ? (
                                <Card className="border-dashed border-2 bg-transparent rounded-2xl">
                                    <CardContent className="py-12 sm:py-16 text-center text-muted-foreground px-4 text-sm sm:text-base">
                                        <p className="font-medium">No historical clinical records detected.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4 sm:space-y-5">
                                    {recentPastAppointments.map(apt => <AppointmentCard key={apt.id} apt={apt} isUpcoming={false} onPostpone={handlePostpone} isMounted={mounted} />)}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {isPostponeOpen && selectedApt && (
                <PostponeDialog 
                    isOpen={isPostponeOpen} 
                    onOpenChange={setIsPostponeOpen} 
                    appointment={selectedApt} 
                />
            )}
        </main>
    )
}