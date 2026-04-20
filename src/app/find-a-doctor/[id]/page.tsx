'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Doctor, Appointment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useState, useMemo, useEffect } from 'react';
import { getNext7Days, timeSlots } from '@/lib/time';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, isSameDay } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function DoctorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const doctorId = params.id as string;

    const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].date);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [appointmentType, setAppointmentType] = useState<'Video Call' | 'Audio Call'>('Video Call');
    const [isBooking, setIsBooking] = useState(false);
    const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading, error } = useDoc<Doctor>(doctorDocRef);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', doctorId)
        );
    }, [firestore, doctorId]);

    const { data: existingAppointments, isLoading: isLoadingAppointments } = useCollection<Appointment>(appointmentsQuery);

    // Unavailability requests check
    const unavailabilityQuery = useMemoFirebase(() => {
      if (!firestore || !doctorId) return null;
      return query(
        collection(firestore, 'doctorUnavailabilityRequests'),
        where('doctorId', '==', doctorId),
        where('status', '==', 'approved')
      );
    }, [firestore, doctorId]);

    const { data: approvedLeave } = useCollection<any>(unavailabilityQuery);

    const isDayOffByAdmin = useMemo(() => {
      if (!approvedLeave || !selectedDate) return false;
      return approvedLeave.some((leave: any) => isSameDay(new Date(leave.requestedDate), selectedDate));
    }, [approvedLeave, selectedDate]);

    const bookedTimes = useMemo(() => {
        if (!existingAppointments || !selectedDate || !mounted) return [];
        return existingAppointments
            .filter(apt => isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled')
            .map(apt => format(new Date(apt.appointmentDateTime), "hh:mm a"));
    }, [existingAppointments, selectedDate, mounted]);

    const handleConfirmBooking = () => {
        if (isUserLoading) return;

        if (!user) {
            toast({ title: "Login Required", description: "Please log in to book an appointment." });
            router.push('/login');
            return;
        }

        if (!selectedTime || !firestore || !doctor) {
            toast({ variant: 'destructive', title: 'Booking Error', description: 'Please select a date and time.' });
            return;
        }
        
        if (!paymentReceipt) {
            toast({ variant: 'destructive', title: 'Receipt Required', description: 'Please upload your payment receipt.' });
            return;
        }

        setIsBooking(true);

        const appointmentDateTime = new Date(selectedDate);
        const [hours, minutesPart] = selectedTime.split(':');
        const [minutes, ampm] = minutesPart.split(' ');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        appointmentDateTime.setHours(numericHours, parseInt(minutes), 0, 0);

        const newAppointment = {
            patientId: user.uid,
            doctorId: doctor.id,
            appointmentDateTime: appointmentDateTime.toISOString(),
            appointmentType: appointmentType,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            amount: 1500,
            paymentReceiptUrl: paymentReceipt,
            paymentStatus: 'pending',
        };
        
        addDocumentNonBlocking(collection(firestore, 'appointments'), newAppointment);
        toast({ title: "Appointment Booked!", description: `Confirmed with Dr. ${doctor.firstName}.` });
        setIsBooking(false);
        router.push('/patient-portal');
    };
    
    if (isLoading || isUserLoading || !mounted) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>
                <AppFooter />
            </div>
        );
    }
    
    if (error || !doctor) {
        return (
             <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-secondary/30">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Doctor Not Found</h1>
                        <Button asChild className="mt-6"><Link href="/find-a-doctor">Find Another Doctor</Link></Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        );
    }

    const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
    const availableDates = getNext7Days();
    const now = new Date();

    const isTimeSlotPast = (time: string, date: Date) => {
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

    const isSlotDisabledByDoctor = (time: string) => doctor.availability?.disabledSlots?.includes(time);

    const isDayDisabledByDoctor = (date: Date) => {
        const dayShort = format(date, "E");
        if (!doctor.availability?.days) return false;
        return !doctor.availability.days.includes(dayShort);
    };

    const TimeButton = ({ time }: { time: string }) => {
        const isPast = isTimeSlotPast(time, selectedDate);
        const isBooked = bookedTimes.includes(time);
        const isDisabledByDoctor = isSlotDisabledByDoctor(time);
        const isOffDuty = isDayDisabledByDoctor(selectedDate);
        const isDisabled = isPast || isBooked || isDisabledByDoctor || isOffDuty || isDayOffByAdmin;

        if (isDisabledByDoctor && !isBooked) return null; 

        return (
            <Button 
                variant={selectedTime === time ? 'default' : 'outline'}
                onClick={() => setSelectedTime(time)}
                disabled={isDisabled}
                className={cn("relative", isBooked && "opacity-50 grayscale cursor-not-allowed border-destructive/30")}
            >
                {time}
                {isBooked && <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-destructive" />}
            </Button>
        );
    };

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-12">
                <div className="container mx-auto px-4">
                    <Button asChild variant="ghost" className="mb-6">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
                    </Button>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader className="items-center text-center">
                                    <div className="relative h-32 w-32">
                                        <Image src={doctor.photoURL || doctorImage?.imageUrl || ''} alt={doctor.firstName} fill className="rounded-full border-4 border-background object-cover" />
                                    </div>
                                    <div className="pt-4">
                                        <CardTitle className="text-2xl font-headline">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                        <CardDescription className="text-md text-primary">{doctor.specialty}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-4">
                                     <div className="flex items-center"><UserCheck className="mr-2 h-4 w-4" /> <strong>{doctor.experience || 0} years</strong> experience</div>
                                     <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> {doctor.location}</div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary"/> Clinical Scheduler</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isDayOffByAdmin ? (
                                      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-8 text-center space-y-4">
                                        <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
                                        <h4 className="text-xl font-bold text-destructive">Doctor Unavailable</h4>
                                        <p className="text-muted-foreground">Dr. {doctor.firstName} has requested a full day off on this date. Please select another day.</p>
                                      </div>
                                    ) : (
                                    <div className="space-y-10">
                                        <div>
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Step 1: Select a Date</h4>
                                            <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 custom-scrollbar">
                                                {availableDates.map(day => {
                                                    const isOff = isDayDisabledByDoctor(day.date);
                                                    return (
                                                        <button 
                                                            key={day.date.toISOString()}
                                                            onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                                            disabled={isOff}
                                                            className={cn(
                                                                "p-3 rounded-xl border text-center transition-all shrink-0 w-24",
                                                                selectedDate.toDateString() === day.date.toDateString() 
                                                                    ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                                                                    : 'bg-background hover:bg-muted border-muted-foreground/10',
                                                                isOff && "opacity-30 grayscale cursor-not-allowed"
                                                            )}
                                                        >
                                                            <p className="text-xs font-bold uppercase opacity-80">{day.dayName}</p>
                                                            <p className="text-2xl font-bold mt-1">{day.dayNumber}</p>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Step 2: Select Time</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                              {[...timeSlots.morning, ...timeSlots.afternoon, ...timeSlots.evening].map(time => <TimeButton key={time} time={time} />)}
                                            </div>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="w-full h-14 text-lg font-bold" disabled={!selectedTime || isBooking}>
                                                    Book Consultation {selectedTime && `@ ${selectedTime}`}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Finalize Consultation</AlertDialogTitle>
                                                    <AlertDialogDescription>Complete the PKR 1,500 fee transfer to confirm your session.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <Label>Upload Receipt Screenshot</Label>
                                                    <Input type="file" accept="image/*" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setPaymentReceipt(reader.result as string);
                                                        reader.readAsDataURL(file);
                                                    }} />
                                                </div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking}>Confirm Booking</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
