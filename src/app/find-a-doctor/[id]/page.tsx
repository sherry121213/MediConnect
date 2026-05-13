
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Doctor, Appointment, Review, Patient } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon, ShieldAlert, CreditCard, Wallet, Landmark, CheckCircle2, XCircle, Quote, User, Activity } from 'lucide-react';
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
import { getNext7Days, generateAvailableTimes } from '@/lib/time';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, isSameDay, addMinutes, isBefore, isValid } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ReviewItem = ({ review }: { review: Review }) => {
    const firestore = useFirestore();
    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !review.patientId) return null;
        return doc(firestore, 'patients', review.patientId);
    }, [firestore, review.patientId]);
    const { data: patient } = useDoc<Patient>(patientDocRef);

    return (
        <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden group">
            <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/5">
                            <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                                {patient?.firstName?.[0] || '?'}{patient?.lastName?.[0] || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{patient ? `${patient.firstName} ${patient.lastName}` : 'Anonymous Patient'}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Verified Patient</p>
                        </div>
                    </div>
                    <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3 w-3", i < review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                        ))}
                    </div>
                </div>
                <div className="relative">
                    <Quote className="absolute -top-2 -left-2 h-8 w-8 text-primary/5" />
                    <p className="text-xs text-slate-600 leading-relaxed italic pl-2">
                        {review.comment}
                    </p>
                </div>
                <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest text-right">
                    {review.createdAt ? format(new Date(review.createdAt), "MMM yyyy") : 'Recently'}
                </p>
            </CardContent>
        </Card>
    );
}

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

    const reviewsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(
            collection(firestore, 'reviews'), 
            where('doctorId', '==', doctorId),
            limit(6)
        );
    }, [firestore, doctorId]);
    const { data: reviews, isLoading: isLoadingReviews } = useCollection<Review>(reviewsQuery);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', doctorId)
        );
    }, [firestore, doctorId]);

    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

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

    /**
     * Checks if a proposed 30-minute window overlaps with existing booked sessions.
     * This removes the "Fixed Slot" restriction while maintaining medical window integrity.
     */
    const isSlotAvailable = (timeStr: string) => {
        if (!existingAppointments || !selectedDate || !mounted) return true;
        
        const now = new Date();
        const [timePart, ampm] = timeStr.split(' ');
        const [hours, minutes] = timePart.split(':');
        let numericHours = parseInt(hours);
        if (ampm === 'PM' && numericHours !== 12) numericHours += 12;
        if (ampm === 'AM' && numericHours === 12) numericHours = 0;
        
        const proposedStart = new Date(selectedDate);
        proposedStart.setHours(numericHours, parseInt(minutes), 0, 0);
        const proposedEnd = addMinutes(proposedStart, 30);

        // Don't allow past times today
        if (isSameDay(selectedDate, now) && proposedStart < now) return false;

        return !existingAppointments.some(apt => {
            if (!apt || apt.status === 'cancelled' || !apt.appointmentDateTime) return false;
            const aptStart = new Date(apt.appointmentDateTime);
            const aptEnd = addMinutes(aptStart, 30);
            
            // Overlap check logic
            return proposedStart < aptEnd && proposedEnd > aptStart;
        });
    };

    const availableTimes = useMemo(() => generateAvailableTimes(), []);

    const averageRating = useMemo(() => {
        if (!reviews || reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return (sum / reviews.length).toFixed(1);
    }, [reviews]);

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
            description: "Once your payment is approved your booking will be confirmed.",
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
    const dateOptions = getNext7Days();

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-12">
                <div className="container mx-auto px-4 space-y-12">
                    <Button asChild variant="ghost" className="mb-2 rounded-xl">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
                    </Button>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-4 space-y-8">
                            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="items-center text-center bg-primary/5 p-8 sm:p-10">
                                    <div className="relative h-40 w-40 shadow-2xl rounded-full border-4 border-white mb-6 overflow-hidden">
                                        <Image src={doctor.photoURL || doctorImage?.imageUrl || ''} alt={doctor.firstName} fill className="object-cover" />
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle className="text-3xl font-headline tracking-tight">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                        <CardDescription className="text-base text-primary font-bold uppercase tracking-wider">{doctor.specialty}</CardDescription>
                                    </div>
                                    <div className="flex items-center justify-center gap-4 pt-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-1 text-amber-500 font-bold text-xl">
                                                <Star className="h-5 w-5 fill-current" /> {averageRating}
                                            </div>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Avg. Rating</p>
                                        </div>
                                        <div className="w-px h-8 bg-slate-100" />
                                        <div className="flex flex-col items-center">
                                            <p className="font-bold text-xl">{reviews?.length || 0}</p>
                                            <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Reviews</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-6 p-8 bg-white">
                                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-muted-foreground/5">
                                        <UserCheck className="h-5 w-5 text-primary shrink-0" /> 
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Experience</p>
                                            <p className="font-bold text-foreground">{doctor.experience || 0} Professional Years</p>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-muted-foreground/5">
                                        <MapPin className="h-5 w-5 text-primary shrink-0" /> 
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Hub City</p>
                                            <p className="font-bold text-foreground">{doctor.location}</p>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-muted-foreground/5">
                                        <GraduationCap className="h-5 w-5 text-primary shrink-0" /> 
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Institution</p>
                                            <p className="font-bold text-foreground line-clamp-1">{doctor.medicalSchool || 'Verified Records'}</p>
                                        </div>
                                     </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <h3 className="font-bold text-lg font-headline flex items-center gap-2 px-2">
                                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" /> Patient Feedback
                                </h3>
                                <div className="space-y-4">
                                    {isLoadingReviews ? (
                                        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>
                                    ) : reviews && reviews.length > 0 ? (
                                        reviews.map(review => <ReviewItem key={review.id} review={review} />)
                                    ) : (
                                        <div className="p-10 bg-white/50 border-2 border-dashed rounded-[2rem] text-center text-muted-foreground italic">
                                            <Quote className="h-8 w-8 mx-auto mb-2 opacity-10" />
                                            <p className="text-xs">No feedback logs found yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8">
                             <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 border-b p-8 sm:p-10">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                                <CalendarDays className="h-7 w-7 text-primary"/> Clinical Availability
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground">Dynamic scheduling without pre-defined slot restrictions.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">Live Status</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 sm:p-12">
                                    {isDayOffByAdmin ? (
                                      <div className="bg-destructive/5 border border-destructive/10 rounded-[2.5rem] p-12 text-center space-y-6">
                                        <ShieldAlert className="h-20 w-20 text-destructive mx-auto opacity-50" />
                                        <div className="space-y-2">
                                            <h4 className="text-2xl font-bold text-destructive font-headline">Practice Suspended</h4>
                                            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                                Dr. {doctor.lastName} is unavailable for consultation on this date due to clinical audit or personal pause.
                                            </p>
                                        </div>
                                      </div>
                                    ) : (
                                    <div className="space-y-12">
                                        <div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3">
                                                <div className="h-1 w-6 bg-primary rounded-full" /> Step 1: Select Date
                                            </h4>
                                            <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 custom-scrollbar">
                                                {dateOptions.map(day => (
                                                    <button 
                                                        key={day.date.toISOString()}
                                                        onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                                        className={cn(
                                                            "p-5 rounded-3xl border text-center transition-all shrink-0 w-28 flex flex-col items-center gap-1",
                                                            selectedDate.toDateString() === day.date.toDateString() 
                                                                ? 'bg-primary text-primary-foreground border-primary shadow-2xl scale-105' 
                                                                : 'bg-background hover:bg-muted border-slate-100 shadow-sm'
                                                        )}
                                                    >
                                                        <p className="text-[10px] font-bold uppercase opacity-80">{day.dayName}</p>
                                                        <p className="text-3xl font-bold font-headline">{day.dayNumber}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                             <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3">
                                                <div className="h-1 w-6 bg-primary rounded-full" /> Step 2: Pick any free 30m window
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar pb-4">
                                                {availableTimes.map(time => {
                                                    const available = isSlotAvailable(time);
                                                    if (!available) return null;
                                                    return (
                                                        <Button 
                                                            key={time}
                                                            variant={selectedTime === time ? 'default' : 'outline'}
                                                            onClick={() => setSelectedTime(time)}
                                                            className={cn("rounded-xl font-bold h-12 text-[11px] border-2", selectedTime === time ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'hover:border-primary/40')}
                                                        >
                                                            {time}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground italic mt-4 text-center">Only available start times are displayed based on current bookings.</p>
                                        </div>

                                        <div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3">
                                                <div className="h-1 w-6 bg-primary rounded-full" /> Step 3: Consultation Channel
                                            </h4>
                                            <RadioGroup defaultValue="Video Call" onValueChange={(val) => setAppointmentType(val as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="flex items-center space-x-3 p-6 rounded-3xl border-2 hover:bg-muted/30 transition-all cursor-pointer group bg-muted/5">
                                                    <RadioGroupItem value="Video Call" id="video" />
                                                    <Label htmlFor="video" className="flex items-center gap-4 cursor-pointer font-bold flex-1">
                                                        <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                                            <Video className="h-6 w-6" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm">Video Room</p>
                                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Secure HD Feed</p>
                                                        </div>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 p-6 rounded-3xl border-2 hover:bg-muted/30 transition-all cursor-pointer group bg-muted/5">
                                                    <RadioGroupItem value="Audio Call" id="audio" />
                                                    <Label htmlFor="audio" className="flex items-center gap-4 cursor-pointer font-bold flex-1">
                                                        <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                                            <PhoneCall className="h-6 w-6" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm">Audio Call</p>
                                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Voice Tunnel</p>
                                                        </div>
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="w-full h-20 text-xl font-bold rounded-3xl shadow-2xl shadow-primary/20" disabled={!selectedTime || isBooking}>
                                                    Finalize Booking {selectedTime && `@ ${selectedTime}`}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-lg max-h-[95vh] overflow-y-auto custom-scrollbar p-0">
                                                <div className="p-8 sm:p-10 space-y-8">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-2xl font-headline">Secure Payment</AlertDialogTitle>
                                                        <AlertDialogDescription>Please complete the consultation fee transfer to confirm this session.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    
                                                    <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 text-center">
                                                        <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Standard Fee</p>
                                                        <p className="text-5xl font-bold text-foreground font-headline">PKR 1,500</p>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Step 1: Select Method</Label>
                                                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 gap-3">
                                                            {['Easypaisa', 'Jazzcash', 'MasterCard'].map(m => (
                                                                <div key={m} className={cn(
                                                                    "flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer",
                                                                    paymentMethod === m ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200"
                                                                )}>
                                                                    <RadioGroupItem value={m} id={m} className="sr-only" />
                                                                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", paymentMethod === m ? "bg-primary text-white" : "bg-slate-50")}>
                                                                        {m === 'MasterCard' ? <Landmark className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                                                                    </div>
                                                                    <Label htmlFor={m} className="flex-1 cursor-pointer font-bold">{m} <span className="block text-[10px] font-mono font-normal text-muted-foreground mt-0.5">{m === 'MasterCard' ? 'pk013120555772' : '03120555772'}</span></Label>
                                                                    {paymentMethod === m && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Step 2: Proof of Transfer</Label>
                                                        <label htmlFor="receipt-upload" className="flex flex-col items-center justify-center w-full h-36 border-4 border-dashed rounded-[2rem] cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-slate-200">
                                                            <div className="flex flex-col items-center justify-center pt-4 pb-5 text-center px-4">
                                                                <Activity className="w-8 h-8 mb-3 text-primary/30" />
                                                                <p className="text-sm font-bold text-primary">Click to upload receipt</p>
                                                                <p className="text-[9px] text-muted-foreground uppercase mt-1">High-fidelity audit required</p>
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
                                                        {paymentReceipt && (
                                                            <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 rounded-2xl border border-green-100">
                                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                <span className="text-[10px] font-bold text-green-700 uppercase">Evidence Logged Successfully</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                                                        <AlertDialogCancel className="rounded-2xl h-14 border-2 flex-1">Go Back</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking} className="rounded-2xl h-14 bg-primary font-bold shadow-2xl shadow-primary/20 flex-1">
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
