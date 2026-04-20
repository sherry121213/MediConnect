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
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon } from 'lucide-react';
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

    const bookedTimes = useMemo(() => {
        if (!existingAppointments || !selectedDate || !mounted) return [];
        return existingAppointments
            .filter(apt => isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled')
            .map(apt => format(new Date(apt.appointmentDateTime), "hh:mm a"));
    }, [existingAppointments, selectedDate, mounted]);

    const handleConfirmBooking = () => {
        if (isUserLoading) return;

        if (!user) {
            toast({
                title: "Login Required",
                description: "Please log in to book an appointment.",
                duration: 5000,
            });
            router.push('/login');
            return;
        }

        if (!selectedTime || !firestore || !doctor) {
            toast({
                variant: 'destructive',
                title: 'Booking Error',
                description: 'Please select a date and time.',
            });
            return;
        }
        
        if (!paymentReceipt) {
            toast({
                variant: 'destructive',
                title: 'Receipt Required',
                description: 'Please upload your payment receipt to proceed.',
            });
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
        
        const appointmentsCollection = collection(firestore, 'appointments');
        addDocumentNonBlocking(appointmentsCollection, newAppointment);
        
        toast({
            title: "Appointment Booked!",
            description: `Your ${appointmentType} with Dr. ${doctor.firstName} is confirmed.`,
        });

        setIsBooking(false);
        router.push('/patient-portal');
    };
    
    if (isLoading || isUserLoading || !mounted) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
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

    const isSlotDisabledByDoctor = (time: string) => {
        return doctor.availability?.disabledSlots?.includes(time);
    };

    const isDayDisabledByDoctor = (date: Date) => {
        const dayShort = format(date, "E"); // "Mon", "Tue", etc
        // Active by default if availability.days is missing
        if (!doctor.availability?.days) return false;
        return !doctor.availability.days.includes(dayShort);
    };

    const TimeButton = ({ time }: { time: string }) => {
        const isPast = isTimeSlotPast(time, selectedDate);
        const isBooked = bookedTimes.includes(time);
        const isDisabledByDoctor = isSlotDisabledByDoctor(time);
        const isOffDuty = isDayDisabledByDoctor(selectedDate);
        
        const isDisabled = isPast || isBooked || isDisabledByDoctor || isOffDuty;

        // Hide slots explicitly disabled by doctor unless already booked
        if (isDisabledByDoctor && !isBooked) return null; 

        return (
            <Button 
                variant={selectedTime === time ? 'default' : 'outline'}
                onClick={() => setSelectedTime(time)}
                disabled={isDisabled}
                className={cn(
                    "relative",
                    isBooked && "opacity-50 grayscale cursor-not-allowed border-destructive/30"
                )}
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
                        <Link href="/find-a-doctor">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Doctor Search
                        </Link>
                    </Button>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader className="items-center text-center">
                                    {doctorImage ? (
                                        <Image
                                            src={doctor.photoURL || doctorImage.imageUrl}
                                            alt={`${doctor.firstName}`}
                                            width={128} height={128}
                                            className="rounded-full border-4 border-background object-cover aspect-square"
                                            data-ai-hint="doctor portrait"
                                        />
                                    ) : <Skeleton className="h-32 w-32 rounded-full" />}
                                    <div className="pt-4">
                                        <CardTitle className="text-2xl font-headline">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                        <CardDescription className="text-md text-primary mt-1">{doctor.specialty}</CardDescription>
                                        <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500 fill-amber-400" />{doctor.rating || 0}</div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-4">
                                     <div className="flex items-center"><UserCheck className="mr-2 h-4 w-4" /> <strong>{doctor.experience || 0} years</strong> experience</div>
                                     <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> Practices in <strong>{doctor.location}</strong></div>
                                     <p className="text-sm text-center pt-2 border-t mt-4">{doctor.bio || "No bio available."}</p>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary"/> Clinical Scheduler</CardTitle>
                                    <CardDescription>Select a date, mode, and time for your session.</CardDescription>
                                </CardHeader>
                                <CardContent>
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
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Step 2: Consultation Mode</h4>
                                            <RadioGroup defaultValue={appointmentType} onValueChange={(val) => setAppointmentType(val as any)} className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <RadioGroupItem value="Video Call" id="video" className="peer sr-only" />
                                                    <Label htmlFor="video" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer">
                                                        <Video className="mb-2 h-6 w-6" /><span className="font-bold">Video Call</span>
                                                    </Label>
                                                </div>
                                                <div>
                                                    <RadioGroupItem value="Audio Call" id="audio" className="peer sr-only" />
                                                    <Label htmlFor="audio" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer">
                                                        <PhoneCall className="mb-2 h-6 w-6" /><span className="font-bold">Audio Call</span>
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Step 3: Select Available Time</h4>
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-4">
                                                        <div className="h-2 w-2 rounded-full bg-amber-400" /> Morning
                                                    </h4>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                        {timeSlots.morning.map(time => <TimeButton key={time} time={time} />)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-4">
                                                        <div className="h-2 w-2 rounded-full bg-blue-400" /> Afternoon
                                                    </h4>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                        {timeSlots.afternoon.map(time => <TimeButton key={time} time={time} />)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-4">
                                                        <Moon className="h-3.5 w-3.5 text-indigo-400" /> Evening
                                                    </h4>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                        {timeSlots.evening.map(time => <TimeButton key={time} time={time} />)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                     </div>

                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button className="w-full mt-12 h-14 text-lg font-bold shadow-xl" disabled={!selectedTime || isBooking || isUserLoading}>
                                                {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Clock className="mr-2 h-5 w-5" />}
                                                Book {appointmentType} {selectedTime && `@ ${selectedTime}`}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="sm:max-w-[450px]">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-2xl font-headline">Secure Consultation Fee</AlertDialogTitle>
                                                <AlertDialogDescription>Please complete the PKR 1,500 transfer to finalize your session.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                             <div className="my-6 space-y-3 rounded-xl border-2 border-primary/10 bg-primary/5 p-6 text-sm">
                                                <div className="flex justify-between items-center border-b pb-2"><span className="font-bold text-muted-foreground">Mode</span><Badge variant="outline">{appointmentType}</Badge></div>
                                                <div className="flex justify-between items-center border-b pb-2"><span className="font-bold text-muted-foreground">Account</span><span>Mediconnect Pvt. Ltd.</span></div>
                                                <div className="flex justify-between items-center pt-1"><span className="font-bold text-primary">Fee Total</span><span className="text-lg font-bold text-primary">PKR 1,500</span></div>
                                            </div>
                                             <div className="space-y-3">
                                                <Label htmlFor="receipt-upload" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proof of Payment</Label>
                                                <div className="relative">
                                                    <Button asChild variant="outline" size="lg" className={cn("w-full border-dashed py-8", paymentReceipt && "bg-green-50 border-green-200")}>
                                                        <label htmlFor="receipt-upload" className="cursor-pointer text-center w-full flex flex-col gap-1">
                                                            {isUploading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> : (
                                                                paymentReceipt ? <span className="font-bold text-green-700">Receipt Attached</span> : <span className="font-bold">Upload Screenshot</span>
                                                            )}
                                                        </label>
                                                    </Button>
                                                    <Input id="receipt-upload" type="file" accept="image/*" onChange={(e) => {
                                                        if (!e.target.files?.[0]) return;
                                                        setIsUploading(true);
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => { setPaymentReceipt(reader.result as string); setIsUploading(false); };
                                                        reader.readAsDataURL(e.target.files[0]);
                                                    }} className="absolute inset-0 w-full h-full opacity-0" disabled={isUploading} />
                                                </div>
                                            </div>
                                            <AlertDialogFooter className="mt-8">
                                                <AlertDialogCancel disabled={isBooking}>Back</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmBooking} disabled={isBooking || isUploading || !paymentReceipt} className="px-8 font-bold">
                                                     Confirm Booking
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
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
