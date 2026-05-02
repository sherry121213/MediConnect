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
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon, ShieldAlert, CreditCard } from 'lucide-react';
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
    const [paymentMethod, setPaymentMethod] = useState<string>('Easypaisa');
    const [isBooking, setIsBooking] = useState(false);
    const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
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
            .filter(apt => apt && isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled')
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
            paymentMethod: paymentMethod,
        };
        
        addDocumentNonBlocking(collection(firestore, 'appointments'), newAppointment);
        
        toast({ 
            title: "Receipt Submitted!", 
            description: "Once your payment is approved your booking will be done. Please check your portal for status updates.",
            duration: 6000
        });

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

    const TimeButton = ({ time }: { time: string }) => {
        const isPast = isTimeSlotPast(time, selectedDate);
        const isBooked = bookedTimes.includes(time);
        const isDisabledByDoctor = isSlotDisabledByDoctor(time);
        const isDisabled = isPast || isBooked || isDisabledByDoctor || isDayOffByAdmin;

        if (isDisabledByDoctor && !isBooked) return null; 

        return (
            <Button 
                variant={selectedTime === time ? 'default' : 'outline'}
                onClick={() => setSelectedTime(time)}
                disabled={isDisabled}
                className={cn("relative rounded-xl font-bold", isBooked && "opacity-50 grayscale cursor-not-allowed border-destructive/30")}
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
                    <Button asChild variant="ghost" className="mb-6 rounded-xl">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
                    </Button>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <Card className="rounded-2xl border-none shadow-xl overflow-hidden">
                                <CardHeader className="items-center text-center bg-white">
                                    <div className="relative h-32 w-32 shadow-lg rounded-full">
                                        <Image src={doctor.photoURL || doctorImage?.imageUrl || ''} alt={doctor.firstName} fill className="rounded-full border-4 border-white object-cover" />
                                    </div>
                                    <div className="pt-4">
                                        <CardTitle className="text-2xl font-headline">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                        <CardDescription className="text-md text-primary font-bold">{doctor.specialty}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-4 p-6 bg-muted/5">
                                     <div className="flex items-center gap-3"><UserCheck className="h-4 w-4 text-primary" /> <strong>{doctor.experience || 0} years</strong> experience</div>
                                     <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-primary" /> {doctor.location}</div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                             <Card className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary"/> Clinical Scheduler</CardTitle>
                                    <CardDescription>Select a date and time for your consultation.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8">
                                    {isDayOffByAdmin ? (
                                      <div className="bg-destructive/5 border border-destructive/10 rounded-3xl p-12 text-center space-y-6 animate-in zoom-in-95">
                                        <div className="h-20 w-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto shadow-inner">
                                            <ShieldAlert className="h-10 w-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-2xl font-bold text-destructive tracking-tight">Doctor Unavailable</h4>
                                            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                                Dr. {doctor.firstName} is officially off-duty on this date. Please select a different date from the calendar above to view available slots.
                                            </p>
                                        </div>
                                      </div>
                                    ) : (
                                    <div className="space-y-12">
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 1: Select Date</h4>
                                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 custom-scrollbar">
                                                {availableDates.map(day => (
                                                    <button 
                                                        key={day.date.toISOString()}
                                                        onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                                        className={cn(
                                                            "p-4 rounded-2xl border text-center transition-all shrink-0 w-24 flex flex-col items-center gap-1",
                                                            selectedDate.toDateString() === day.date.toDateString() 
                                                                ? 'bg-primary text-primary-foreground border-primary shadow-xl scale-105' 
                                                                : 'bg-background hover:bg-muted border-muted-foreground/10 shadow-sm'
                                                        )}
                                                    >
                                                        <p className="text-[10px] font-bold uppercase opacity-80">{day.dayName}</p>
                                                        <p className="text-3xl font-bold">{day.dayNumber}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 2: Select Session Time</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                              {[...timeSlots.morning, ...timeSlots.afternoon, ...timeSlots.evening].map(time => <TimeButton key={time} time={time} />)}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Step 3: Consultation Mode</h4>
                                            <RadioGroup defaultValue="Video Call" onValueChange={(val) => setAppointmentType(val as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="flex items-center space-x-3 p-5 rounded-2xl border-2 hover:bg-muted/50 transition-all cursor-pointer group">
                                                    <RadioGroupItem value="Video Call" id="video" />
                                                    <Label htmlFor="video" className="flex items-center gap-3 cursor-pointer font-bold">
                                                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                                            <Video className="h-5 w-5" />
                                                        </div>
                                                        Video Room
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-5 rounded-2xl border-2 hover:bg-muted/50 transition-all cursor-pointer group">
                                                    <RadioGroupItem value="Audio Call" id="audio" />
                                                    <Label htmlFor="audio" className="flex items-center gap-3 cursor-pointer font-bold">
                                                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                                            <PhoneCall className="h-5 w-5" />
                                                        </div>
                                                        Audio Room
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={!selectedTime || isBooking}>
                                                    Finalize Booking {selectedTime && `@ ${selectedTime}`}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl max-w-lg">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-2xl font-headline">Clinical Confirmation</AlertDialogTitle>
                                                    <AlertDialogDescription>Select a payment method and upload the transfer receipt to finalize your session.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <div className="space-y-6 py-6">
                                                    <div className="bg-muted/30 p-4 rounded-2xl border border-dashed text-center">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Total Fee Payable</p>
                                                        <p className="text-3xl font-bold text-primary">PKR 1,500</p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <Label className="text-xs font-bold uppercase opacity-60">Step 1: Select Payment Source (Chain)</Label>
                                                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 gap-2">
                                                            <div className={cn("flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer", paymentMethod === 'Easypaisa' ? "border-primary bg-primary/5" : "border-muted")}>
                                                                <RadioGroupItem value="Easypaisa" id="ep" />
                                                                <Label htmlFor="ep" className="flex-1 cursor-pointer flex items-center justify-between">
                                                                    <div>
                                                                        <p className="font-bold text-sm">Easypaisa</p>
                                                                        <p className="text-[10px] text-muted-foreground">Account: 03120555772</p>
                                                                    </div>
                                                                    <div className="h-8 w-8 rounded bg-white p-1 border">
                                                                        <CreditCard className="h-full w-full text-slate-400" />
                                                                    </div>
                                                                </Label>
                                                            </div>
                                                            <div className={cn("flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer", paymentMethod === 'Jazzcash' ? "border-primary bg-primary/5" : "border-muted")}>
                                                                <RadioGroupItem value="Jazzcash" id="jc" />
                                                                <Label htmlFor="jc" className="flex-1 cursor-pointer flex items-center justify-between">
                                                                    <div>
                                                                        <p className="font-bold text-sm">Jazzcash</p>
                                                                        <p className="text-[10px] text-muted-foreground">Account: 03120555772</p>
                                                                    </div>
                                                                    <div className="h-8 w-8 rounded bg-white p-1 border">
                                                                        <CreditCard className="h-full w-full text-slate-400" />
                                                                    </div>
                                                                </Label>
                                                            </div>
                                                            <div className={cn("flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer", paymentMethod === 'MasterCard' ? "border-primary bg-primary/5" : "border-muted")}>
                                                                <RadioGroupItem value="MasterCard" id="mc" />
                                                                <Label htmlFor="mc" className="flex-1 cursor-pointer flex items-center justify-between">
                                                                    <div>
                                                                        <p className="font-bold text-sm">MasterCard / IBAN</p>
                                                                        <p className="text-[10px] text-muted-foreground">Account: pk013120555772</p>
                                                                    </div>
                                                                    <div className="h-8 w-8 rounded bg-white p-1 border">
                                                                        <CreditCard className="h-full w-full text-slate-400" />
                                                                    </div>
                                                                </Label>
                                                            </div>
                                                        </RadioGroup>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase opacity-60">Step 2: Upload Payment Slip</Label>
                                                        <Input type="file" accept="image/*" className="rounded-xl border-2 h-14 pt-3.5" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setPaymentReceipt(reader.result as string);
                                                            reader.readAsDataURL(file);
                                                        }} />
                                                    </div>
                                                </div>
                                                <AlertDialogFooter className="gap-3">
                                                    <AlertDialogCancel className="rounded-xl h-12">Discard</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking} className="rounded-xl h-12 bg-primary font-bold">
                                                        Confirm & Notify Doctor
                                                    </AlertDialogAction>
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
