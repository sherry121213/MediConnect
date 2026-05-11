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
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon, ShieldAlert, CreditCard, Wallet, Landmark, CheckCircle2, XCircle } from 'lucide-react';
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
        where('doctorId', '==', doctorId)
      );
    }, [firestore, doctorId]);

    const { data: allLeaveRequests } = useCollection<any>(unavailabilityQuery);

    const isDayOffByAdmin = useMemo(() => {
      if (!allLeaveRequests || !selectedDate) return false;
      return allLeaveRequests.some((leave: any) => 
        leave && 
        leave.status === 'approved' && 
        leave.requestedDate && 
        isSameDay(new Date(leave.requestedDate), selectedDate)
      );
    }, [allLeaveRequests, selectedDate]);

    const bookedTimes = useMemo(() => {
        if (!existingAppointments || !selectedDate || !mounted) return [];
        return existingAppointments
            .filter(apt => apt && apt.appointmentDateTime && isSameDay(new Date(apt.appointmentDateTime), selectedDate) && apt.status !== 'cancelled')
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
        
        // REQUIREMENT: If doctor disables a slot, it should not be visible to patients.
        if (isDisabledByDoctor && !isBooked) return null; 

        return (
            <Button 
                variant={selectedTime === time ? 'default' : 'outline'}
                onClick={() => setSelectedTime(time)}
                disabled={isPast || isBooked || isDayOffByAdmin}
                className={cn(
                    "relative rounded-xl font-bold h-11", 
                    isBooked && "opacity-50 grayscale cursor-not-allowed border-destructive/30",
                    isPast && "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
            >
                {isPast ? "Closed" : isBooked ? "Booked" : time}
                {isBooked && !isPast && <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-destructive" />}
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
                                    <CardDescription>All sessions are fixed to 30 minutes.</CardDescription>
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
                                                Dr. {doctor.firstName} is officially off-duty on this date. Please select a different date to view available slots.
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

                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                                    <Clock className="h-3 w-3" /> Morning Slots
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {timeSlots.morning.map(time => <TimeButton key={time} time={time} />)}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                                    <Clock className="h-3 w-3" /> Afternoon Slots
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {timeSlots.afternoon.map(time => <TimeButton key={time} time={time} />)}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                                    <Clock className="h-3 w-3" /> Evening Slots
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {timeSlots.evening.map(time => <TimeButton key={time} time={time} />)}
                                                </div>
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
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl max-w-lg max-h-[95vh] overflow-y-auto custom-scrollbar p-0">
                                                <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-xl sm:text-2xl font-headline">Secure Payment Gateway</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-xs sm:text-sm">Complete your consultation fee transfer to confirm booking.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    
                                                    <div className="space-y-4 sm:space-y-6 py-1">
                                                        <div className="bg-primary/5 p-3 sm:p-4 rounded-2xl border border-primary/10 text-center">
                                                            <p className="text-[9px] uppercase font-bold text-primary tracking-widest mb-1">Consultation Fee</p>
                                                            <p className="text-3xl sm:text-4xl font-bold text-foreground">PKR 1,500</p>
                                                        </div>

                                                        <div className="space-y-2 sm:space-y-3">
                                                            <Label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Step 1: Select Channel</Label>
                                                            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 gap-2 sm:gap-3">
                                                                <div className={cn(
                                                                    "relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                                                                    paymentMethod === 'Easypaisa' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200"
                                                                )}>
                                                                    <RadioGroupItem value="Easypaisa" id="ep" className="sr-only" />
                                                                    <div className={cn(
                                                                        "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                                                        paymentMethod === 'Easypaisa' ? "bg-primary text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                                                                    )}>
                                                                        <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                                                                    </div>
                                                                    <Label htmlFor="ep" className="flex-1 cursor-pointer">
                                                                        <div className="flex justify-between items-center">
                                                                            <p className="font-bold text-sm sm:text-base">Easypaisa</p>
                                                                            {paymentMethod === 'Easypaisa' && <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                                                                        </div>
                                                                        <p className="text-[10px] sm:text-xs font-mono text-muted-foreground">03120555772</p>
                                                                    </Label>
                                                                </div>

                                                                <div className={cn(
                                                                    "relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                                                                    paymentMethod === 'Jazzcash' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200"
                                                                )}>
                                                                    <RadioGroupItem value="Jazzcash" id="jc" className="sr-only" />
                                                                    <div className={cn(
                                                                        "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                                                        paymentMethod === 'Jazzcash' ? "bg-primary text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                                                                    )}>
                                                                        <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                                                                    </div>
                                                                    <Label htmlFor="jc" className="flex-1 cursor-pointer">
                                                                        <div className="flex justify-between items-center">
                                                                            <p className="font-bold text-sm sm:text-base">Jazzcash</p>
                                                                            {paymentMethod === 'Jazzcash' && <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                                                                        </div>
                                                                        <p className="text-[10px] sm:text-xs font-mono text-muted-foreground">03120555772</p>
                                                                    </Label>
                                                                </div>

                                                                <div className={cn(
                                                                    "relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                                                                    paymentMethod === 'MasterCard' ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200"
                                                                )}>
                                                                    <RadioGroupItem value="MasterCard" id="mc" className="sr-only" />
                                                                    <div className={cn(
                                                                        "h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                                                        paymentMethod === 'MasterCard' ? "bg-primary text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                                                                    )}>
                                                                        <Landmark className="h-5 w-5 sm:h-6 sm:w-6" />
                                                                    </div>
                                                                    <Label htmlFor="mc" className="flex-1 cursor-pointer">
                                                                        <div className="flex justify-between items-center">
                                                                            <p className="font-bold text-sm sm:text-base">Bank Transfer</p>
                                                                            {paymentMethod === 'MasterCard' && <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                                                                        </div>
                                                                        <p className="text-[9px] sm:text-[10px] font-mono text-muted-foreground">pk013120555772</p>
                                                                    </Label>
                                                                </div>
                                                            </RadioGroup>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Step 2: Upload Proof</Label>
                                                            <div className="relative group">
                                                                <div className="flex items-center justify-center w-full">
                                                                    <label htmlFor="receipt-upload" className="flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-slate-200 group-hover:border-primary/50">
                                                                        <div className="flex flex-col items-center justify-center pt-4 pb-5">
                                                                            <Landmark className="w-6 h-6 sm:w-8 sm:h-8 mb-2 text-slate-400 group-hover:text-primary transition-colors" />
                                                                            <p className="mb-1 text-xs sm:text-sm text-slate-500"><span className="font-semibold text-primary">Click to upload</span></p>
                                                                            <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-tight">Receipt Screenshot</p>
                                                                        </div>
                                                                        <Input 
                                                                            id="receipt-upload"
                                                                            type="file" 
                                                                            accept="image/*" 
                                                                            className="hidden" 
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (!file) return;
                                                                                const reader = new FileReader();
                                                                                reader.onloadend = () => setPaymentReceipt(reader.result as string);
                                                                                reader.readAsDataURL(file);
                                                                            }} 
                                                                        />
                                                                    </label>
                                                                </div>
                                                                {paymentReceipt && (
                                                                    <div className="mt-2 flex items-center gap-2 p-1.5 bg-green-50 rounded-lg border border-green-100">
                                                                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                                                                        <span className="text-[8px] sm:text-[9px] font-bold text-green-700 uppercase">Attached</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 pb-2">
                                                        <AlertDialogCancel className="rounded-xl h-12 text-sm sm:h-14 border-2 w-full sm:w-auto">Back</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking} className="rounded-xl h-12 text-sm sm:h-14 bg-primary font-bold shadow-lg shadow-primary/20 w-full sm:flex-1">
                                                            {isBooking ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                                            Complete Booking
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </div>
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
