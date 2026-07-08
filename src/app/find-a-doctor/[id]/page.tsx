
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
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2, MapPin, Star, UserCheck, Video, PhoneCall, Moon, ShieldAlert, CreditCard, Wallet, Landmark, CheckCircle2, XCircle, Quote, User, Activity, BriefcaseMedical, Calendar as CalendarIcon, ChevronRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
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
import { getNext7Days } from '@/lib/time';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, isSameDay, addMinutes, isBefore, isValid, parse, setHours, setMinutes } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const [selectedHour, setSelectedHour] = useState<string>("09");
    const [selectedMinute, setSelectedMinute] = useState<string>("00");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("AM");
    const [appointmentType, setAppointmentType] = useState<'Video Call' | 'Audio Call'>('Video Call');
    const [paymentMethod, setPaymentMethod] = useState<string>('Easypaisa');
    const [isBooking, setIsBooking] = useState(false);
    const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [nowTicker, setNowTicker] = useState(new Date());

    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => setNowTicker(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading } = useDoc<Doctor>(doctorDocRef);

    const reviewsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(
            collection(firestore, 'reviews'), 
            where('doctorId', '==', doctorId),
            limit(10)
        );
    }, [firestore, doctorId]);
    const { data: reviews } = useCollection<Review>(reviewsQuery);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', doctorId));
    }, [firestore, doctorId]);
    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const selectedTimeStr = useMemo(() => `${selectedHour}:${selectedMinute} ${selectedPeriod}`, [selectedHour, selectedMinute, selectedPeriod]);

    const timeValidation = useMemo(() => {
        if (!mounted || !existingAppointments || !selectedDate || !selectedTimeStr) return { isAvailable: true, message: '' };

        const proposedStart = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        const proposedEnd = addMinutes(proposedStart, 15);

        // Past time check
        if (isSameDay(selectedDate, nowTicker) && isBefore(proposedStart, nowTicker)) {
            return { isAvailable: false, message: 'This time has already passed for today.' };
        }

        // Overlap check
        const overlap = existingAppointments.find(apt => {
            if (!apt || apt.status === 'cancelled' || !apt.appointmentDateTime) return false;
            const aptStart = new Date(apt.appointmentDateTime);
            const aptEnd = addMinutes(aptStart, 15);
            return proposedStart < aptEnd && proposedEnd > aptStart;
        });

        if (overlap) {
            return { isAvailable: false, message: 'This clinical window is already booked by another patient.' };
        }

        return { isAvailable: true, message: '' };
    }, [selectedTimeStr, selectedDate, existingAppointments, mounted, nowTicker]);

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
        if (!timeValidation.isAvailable || !firestore || !doctor) {
            toast({ variant: 'destructive', title: 'Invalid Selection', description: timeValidation.message || 'Please select a valid time.' });
            return;
        }
        if (!paymentReceipt) {
            toast({ variant: 'destructive', title: 'Receipt Required' });
            return;
        }

        setIsBooking(true);
        const appointmentDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);

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
        toast({ title: "Receipt Submitted!", description: "Awaiting admin approval." });
        setIsBooking(false);
        router.push('/patient-portal');
    };
    
    if (isLoading || isUserLoading || !mounted) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>
                <AppFooter />
            </div>
        );
    }
    
    const doctorImage = placeholderImages.find(p => p.id === doctor?.profileImageId);
    const dateOptions = getNext7Days();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <AppHeader />
            <main className="flex-grow py-12">
                <div className="container mx-auto px-4 space-y-10">
                    <Button asChild variant="ghost" className="mb-2 rounded-xl group font-bold">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Registry</Link>
                    </Button>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-4 space-y-8">
                            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="items-center text-center bg-primary/5 p-8 sm:p-10">
                                    <div className="relative h-40 w-40 shadow-2xl rounded-full border-8 border-white mb-6 overflow-hidden">
                                        <Image src={doctor?.photoURL || doctorImage?.imageUrl || ''} alt={doctor?.firstName || 'Doctor'} fill className="object-cover" />
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle className="text-3xl font-headline tracking-tight">Dr. {doctor?.firstName} {doctor?.lastName}</CardTitle>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1.5 text-green-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">PMDC Verified</span>
                                            </div>
                                            <CardDescription className="text-base text-primary font-bold uppercase tracking-wider">{doctor?.specialty}</CardDescription>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{doctor?.degree || 'MBBS, FCPS'}</p>
                                        </div>
                                    </div>
                                </CardHeader>

                                <div className="grid grid-cols-3 gap-2 border-y py-6 mx-8 border-slate-50">
                                    <div className="text-center space-y-1 border-r border-slate-50">
                                        <p className="text-sm font-bold text-slate-900">15 Min</p>
                                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Duration</p>
                                    </div>
                                    <div className="text-center space-y-1 border-r border-slate-50">
                                        <p className="text-sm font-bold text-slate-900">{doctor?.experience || 12} Yrs</p>
                                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Exp.</p>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-bold text-slate-900 flex items-center justify-center gap-1">
                                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {averageRating}
                                        </p>
                                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{reviews?.length || 0} Reviews</p>
                                    </div>
                                </div>

                                <CardContent className="text-sm text-muted-foreground space-y-6 p-8">
                                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <MapPin className="h-5 w-5 text-primary shrink-0" /> 
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Hub City</p>
                                            <p className="font-bold text-slate-900">{doctor?.location}</p>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                        <GraduationCap className="h-5 w-5 text-primary shrink-0" /> 
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Institution</p>
                                            <p className="font-bold text-slate-900 line-clamp-1">{doctor?.medicalSchool || 'Verified Records'}</p>
                                        </div>
                                     </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-8">
                             <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 border-b p-8 sm:p-10">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                                <CalendarDays className="h-7 w-7 text-primary"/> Manual Clinical Scheduling
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground">Adjust your consultation start time to any exact minute.</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 sm:p-12 space-y-12">
                                    <div>
                                        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-3">
                                            <div className="h-1 w-6 bg-primary rounded-full" /> Step 1: Choose Clinical Date
                                        </h4>
                                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 custom-scrollbar">
                                            {dateOptions.map(day => (
                                                <button 
                                                    key={day.date.toISOString()}
                                                    onClick={() => { setSelectedDate(day.date); }}
                                                    className={cn(
                                                        "p-5 rounded-3xl border-2 text-center transition-all shrink-0 w-28 flex flex-col items-center gap-1",
                                                        selectedDate.toDateString() === day.date.toDateString() 
                                                            ? 'bg-primary text-primary-foreground border-primary shadow-2xl scale-105' 
                                                            : 'bg-white hover:bg-slate-50 border-slate-100'
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
                                            <div className="h-1 w-6 bg-primary rounded-full" /> Step 2: Set Precise Time (e.g. 6:08)
                                        </h4>
                                        <div className="flex flex-col gap-6 p-8 border-4 border-dashed rounded-[2rem] bg-slate-50/50">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Hour</Label>
                                                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-none shadow-2xl max-h-[250px]">
                                                            {Array.from({ length: 12 }).map((_, i) => {
                                                                const h = (i + 1).toString().padStart(2, '0');
                                                                return <SelectItem key={h} value={h} className="font-bold">{h}</SelectItem>
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Minute</Label>
                                                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-none shadow-2xl max-h-[250px]">
                                                            {Array.from({ length: 60 }).map((_, i) => {
                                                                const m = i.toString().padStart(2, '0');
                                                                return <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Period</Label>
                                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                                            <SelectItem value="AM" className="font-bold">AM</SelectItem>
                                                            <SelectItem value="PM" className="font-bold">PM</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            {selectedTimeStr && !timeValidation.isAvailable ? (
                                                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                                                    <p className="text-xs text-red-800 font-bold">{timeValidation.message}</p>
                                                </div>
                                            ) : selectedTimeStr ? (
                                                <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                        <p className="text-xs text-green-800 font-bold uppercase">Clinical Slot Valid</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">15m Professional Window</p>
                                                        <p className="text-sm font-bold text-green-800">{selectedTimeStr} - {format(addMinutes(parse(selectedTimeStr, 'hh:mm a', selectedDate), 15), "hh:mm a")}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button 
                                                    className="w-full h-20 text-xl font-bold rounded-3xl shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90" 
                                                    disabled={!timeValidation.isAvailable || isBooking}
                                                >
                                                    Book Consultation at {selectedTimeStr}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-lg max-h-[95vh] overflow-y-auto custom-scrollbar p-0">
                                                <div className="p-8 sm:p-10 space-y-8">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-2xl font-headline">Secure Payment</AlertDialogTitle>
                                                        <AlertDialogDescription>Complete the consultation fee transfer to confirm your precision 15m session.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    
                                                    <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 text-center">
                                                        <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Standard Fee</p>
                                                        <p className="text-5xl font-bold text-foreground font-headline">PKR 1,500</p>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">Select Proof of Transfer</Label>
                                                        <label htmlFor="receipt-upload" className="flex flex-col items-center justify-center w-full h-36 border-4 border-dashed rounded-[2rem] cursor-pointer bg-slate-50 hover:bg-slate-100 border-slate-200">
                                                            <div className="flex flex-col items-center justify-center pt-4 pb-5 text-center px-4">
                                                                <Activity className="w-8 h-8 mb-3 text-primary/30" />
                                                                <p className="text-sm font-bold text-primary">Upload Transfer Receipt</p>
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

                                                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-3">
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
