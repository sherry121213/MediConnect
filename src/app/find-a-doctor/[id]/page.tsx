
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Doctor, Appointment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, CalendarDays, Loader2, MapPin, CheckCircle2, XCircle, Copy, Wallet, Landmark, Smartphone, Clock as ClockIcon } from 'lucide-react';
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
import { format, isSameDay, isBefore, isValid, parse, addMinutes } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAYMENT_METHODS = [
    { id: 'Easypaisa', label: 'Easypaisa', icon: Smartphone, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'Jazz Cash', label: 'Jazz Cash', icon: Smartphone, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'UBL Bank', label: 'UBL Bank', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50' }
];

export default function DoctorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const doctorId = params.id as string;

    const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].date);
    const [selectedHour, setSelectedHour] = useState<string>("10");
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

    const isToday = isSameDay(selectedDate, nowTicker);
    const currentHour24 = nowTicker.getHours();
    const currentMin = nowTicker.getMinutes();
    const currentPeriod = currentHour24 >= 12 ? "PM" : "AM";
    const currentHour12 = currentHour24 > 12 ? currentHour24 - 12 : (currentHour24 === 0 ? 12 : currentHour24);

    const availablePeriods = useMemo(() => ["AM", "PM"], []);

    const availableHours = useMemo(() => {
        let filtered = [];
        if (selectedPeriod === 'AM') {
            filtered = ["10", "11"];
        } else {
            filtered = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09"];
        }
        if (!isToday) return filtered;
        return filtered.filter(h => {
            const hNum = parseInt(h);
            if (selectedPeriod === "AM" && currentPeriod === "PM") return false;
            if (selectedPeriod === currentPeriod) {
                const compareH = hNum === 12 ? 0 : hNum;
                const currentCompareH = currentHour12 === 12 ? 0 : currentHour12;
                return compareH >= currentCompareH;
            }
            return true;
        });
    }, [isToday, selectedPeriod, currentPeriod, currentHour12]);

    const availableMinutes = useMemo(() => {
        const mins = [];
        for (let i = 0; i < 60; i++) {
            mins.push(i.toString().padStart(2, '0'));
        }
        if (!isToday) return mins;
        const hNum = parseInt(selectedHour);
        if (selectedPeriod === currentPeriod && hNum === currentHour12) {
            return mins.filter(m => parseInt(m) > currentMin);
        }
        return mins;
    }, [isToday, selectedHour, selectedPeriod, currentPeriod, currentHour12, currentMin]);

    useEffect(() => {
        if (mounted) {
            if (!availableHours.includes(selectedHour)) {
                if (availableHours.length > 0) setSelectedHour(availableHours[0]);
            }
            if (!availableMinutes.includes(selectedMinute)) {
                if (availableMinutes.length > 0) setSelectedMinute(availableMinutes[0]);
            }
        }
    }, [isToday, availableHours, availableMinutes, selectedPeriod, selectedHour, mounted]);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading } = useDoc<Doctor>(doctorDocRef);

    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(collection(firestore, 'appointments'), where('doctorId', '==', doctorId));
    }, [firestore, doctorId]);
    const { data: existingAppointments } = useCollection<Appointment>(appointmentsQuery);

    const selectedTimeStr = useMemo(() => `${selectedHour}:${selectedMinute} ${selectedPeriod}`, [selectedHour, selectedMinute, selectedPeriod]);

    const timeValidation = useMemo(() => {
        if (!mounted || !existingAppointments || !selectedDate || !selectedTimeStr) return { isAvailable: true, message: '' };

        const proposedStart = parse(selectedTimeStr, 'hh:mm a', selectedDate);
        if (!isValid(proposedStart)) return { isAvailable: false, message: 'Select a valid time.' };

        if (isSameDay(selectedDate, nowTicker) && isBefore(proposedStart, nowTicker)) {
            return { isAvailable: false, message: 'This time has already passed.' };
        }

        const proposedEnd = addMinutes(proposedStart, 20);
        const overlap = existingAppointments.find(apt => {
            if (!apt || apt.status === 'cancelled' || !apt.appointmentDateTime) return false;
            const aptStart = new Date(apt.appointmentDateTime);
            const aptEnd = addMinutes(aptStart, 20);
            return proposedStart < aptEnd && proposedEnd > aptStart;
        });

        if (overlap) {
            return { isAvailable: false, message: 'Window Occupied (Consultation + 5m Break).' };
        }

        return { isAvailable: true, message: '' };
    }, [selectedTimeStr, selectedDate, existingAppointments, mounted, nowTicker]);

    const handleConfirmBooking = async () => {
        if (isUserLoading || !user || !firestore || !doctor || !paymentReceipt) return;
        
        setIsBooking(true);
        try {
            const appointmentDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);
            
            // Calculate Token Rank locally using already-loaded existingAppointments to avoid index errors
            const dayApts = (existingAppointments || []).filter(a => a && a.appointmentDateTime && isSameDay(new Date(a.appointmentDateTime), selectedDate));
            const tokenRank = dayApts.filter(a => new Date(a.appointmentDateTime!) < appointmentDateTime).length + 1;

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
                sequencePosition: tokenRank,
                queueStatus: 'waiting',
                patientCheckedIn: false,
                doctorInRoom: false
            };
            
            await addDocumentNonBlocking(collection(firestore, 'appointments'), newAppointment);
            toast({ title: "Receipt Submitted", description: `Daily Token #${tokenRank} assigned. Awaiting audit.` });
            router.push('/patient-portal');
        } catch (e) {
            console.error("Booking failed:", e);
            toast({ variant: 'destructive', title: "Booking Failed", description: "Could not finalize clinical record." });
        } finally {
            setIsBooking(false);
        }
    };

    if (isLoading || isUserLoading || !mounted) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    const doctorImage = placeholderImages.find(p => p.id === doctor?.profileImageId);
    const dateOptions = getNext7Days();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <AppHeader />
            <main className="flex-grow py-8 md:py-12">
                <div className="container mx-auto px-4 space-y-8 md:space-y-10">
                    <Button asChild variant="ghost" className="rounded-xl group font-bold">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Records</Link>
                    </Button>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
                        <div className="lg:col-span-4 space-y-6 md:space-y-8">
                            <Card className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="items-center text-center bg-primary/5 p-6 md:p-8">
                                    <div className="relative h-32 w-32 md:h-40 md:w-40 shadow-xl rounded-full border-4 md:border-8 border-white mb-4 md:mb-6 overflow-hidden">
                                        <Image src={doctor?.photoURL || doctorImage?.imageUrl || ''} alt="Doctor" fill className="object-cover" />
                                    </div>
                                    <CardTitle className="text-2xl md:text-3xl font-headline tracking-tight">Dr. {doctor?.firstName} {doctor?.lastName}</CardTitle>
                                    <CardDescription className="text-sm md:text-base text-primary font-bold uppercase tracking-wider">{doctor?.specialty}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 md:p-8 text-center">
                                    <div className="space-y-4">
                                        <Badge className="bg-green-100 text-green-800 h-9 md:h-10 px-4 md:px-6 rounded-full font-bold">PMDC Verified Professional</Badge>
                                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                                            <MapPin className="h-3.5 w-3.5 text-primary" />
                                            {doctor?.location || 'Pakistan'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-8">
                             <Card className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 border-b p-6 md:p-8">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-xl md:text-2xl font-headline flex items-center gap-3">
                                                <CalendarDays className="h-6 w-6 md:h-7 md:h-7 text-primary"/> Precision Scheduling
                                            </CardTitle>
                                            <p className="text-xs md:text-sm text-muted-foreground mt-1">Select your 20-minute window (15m consult + 5m buffer).</p>
                                        </div>
                                        <Badge className="w-fit bg-primary text-white px-3 py-1 text-[10px] uppercase font-bold">Live Availability</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 md:p-12 space-y-10 md:space-y-12">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px]">1</span> 
                                            Choose Date
                                        </p>
                                        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                            {dateOptions.map(day => (
                                                <button 
                                                    key={day.date.toISOString()}
                                                    onClick={() => setSelectedDate(day.date)}
                                                    className={cn(
                                                        "p-4 md:p-5 rounded-2xl md:rounded-3xl border-2 transition-all shrink-0 w-24 md:w-28 text-center flex flex-col gap-1",
                                                        selectedDate.toDateString() === day.date.toDateString() ? 'bg-primary text-white border-primary shadow-xl scale-105' : 'bg-white border-slate-100 hover:border-primary/20 hover:bg-slate-50'
                                                    )}
                                                >
                                                    <p className="text-[9px] md:text-[10px] font-bold uppercase">{day.dayName}</p>
                                                    <p className="text-xl md:text-2xl font-bold font-headline">{day.dayNumber}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px]">2</span> 
                                            Precise Time (1-Min Intervals)
                                        </p>
                                        <div className="p-6 md:p-8 border-2 md:border-4 border-dashed rounded-[2rem] bg-slate-50/50 space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1 text-slate-500">Hour</Label>
                                                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                                                        <SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="max-h-[200px] rounded-xl shadow-2xl">{availableHours.map(h => (<SelectItem key={h} value={h} className="font-bold">{h}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1 text-slate-500">Minute</Label>
                                                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                                        <SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="max-h-[200px] rounded-xl shadow-2xl">{availableMinutes.map(m => (<SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1 text-slate-500">Period</Label>
                                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                                        <SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="rounded-xl shadow-2xl">{availablePeriods.map(p => (<SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            {selectedTimeStr && !timeValidation.isAvailable ? (
                                                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95">
                                                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                                                    <p className="text-xs text-red-800 font-bold">{timeValidation.message}</p>
                                                </div>
                                            ) : <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95">
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                    <p className="text-xs text-green-800 font-bold">Slot is available (Includes 5m Buffer)</p>
                                                </div>}
                                        </div>
                                    </div>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full h-16 md:h-20 text-lg md:text-xl font-bold rounded-[1.5rem] md:rounded-3xl shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95" disabled={!timeValidation.isAvailable || isBooking}>
                                                Secure Slot at {selectedTimeStr}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="w-[95vw] max-w-xl rounded-[2rem] md:rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90dvh]">
                                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 space-y-8">
                                                <AlertDialogHeader>
                                                    <div className="flex items-center gap-3 text-primary mb-2">
                                                        <Wallet className="h-5 w-5" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">Final Step</span>
                                                    </div>
                                                    <AlertDialogTitle className="text-2xl font-headline tracking-tight">Clinical Settlement</AlertDialogTitle>
                                                    <AlertDialogDescription>Select your payment method and upload the verification receipt.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                
                                                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 text-center space-y-1">
                                                    <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Standard Consultation Fee</p>
                                                    <p className="text-4xl md:text-5xl font-bold font-headline">PKR 1,500</p>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-slate-500">1. Select Payment Method</Label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        {PAYMENT_METHODS.map((method) => (
                                                            <button 
                                                                key={method.id}
                                                                onClick={() => setPaymentMethod(method.id)}
                                                                className={cn(
                                                                    "flex flex-row sm:flex-col items-center justify-start sm:justify-center p-4 rounded-2xl border-2 transition-all gap-4 sm:gap-2",
                                                                    paymentMethod === method.id 
                                                                        ? "border-primary bg-primary/5 shadow-md scale-105" 
                                                                        : "border-slate-100 bg-white hover:border-slate-200"
                                                                )}
                                                            >
                                                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", method.bg)}>
                                                                    <method.icon className={cn("h-5 w-5", method.color)} />
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase">{method.label}</span>
                                                                {paymentMethod === method.id && <div className="ml-auto sm:ml-0 h-2 w-2 rounded-full bg-primary" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-slate-500">2. Official Receiver Details</Label>
                                                    <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
                                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                            <h4 className="text-lg font-bold flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4 text-primary" /> {paymentMethod}
                                                            </h4>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white" onClick={() => { navigator.clipboard.writeText('03120555772'); toast({ title: "Acc. Number Copied" }); }}>
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-3xl font-mono font-bold tracking-tight">03120555772</p>
                                                            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">MediConnect Support Division</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1 text-slate-500">3. Verification Evidence</Label>
                                                    <label htmlFor="receipt-upload" className="group flex flex-col items-center justify-center w-full min-h-[160px] border-4 border-dashed rounded-[2.5rem] bg-slate-50 hover:bg-slate-100 border-slate-200 cursor-pointer transition-all p-6 text-center">
                                                        {paymentReceipt ? (
                                                            <div className="space-y-2 animate-in zoom-in-95">
                                                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                                                                <p className="text-sm font-bold text-green-700">Digital Receipt Secured</p>
                                                                <p className="text-[8px] uppercase font-bold text-slate-400">Click to change evidence</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-primary/30 group-hover:scale-110 transition-transform">
                                                                    <Smartphone className="h-7 w-7" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-bold text-primary">Upload Transfer Receipt</p>
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Images (JPG, PNG) supported</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setPaymentReceipt(reader.result as string);
                                                            reader.readAsDataURL(file);
                                                        }} />
                                                    </label>
                                                </div>
                                            </div>
                                            <AlertDialogFooter className="p-6 sm:p-8 bg-slate-50 border-t flex flex-col sm:flex-row gap-3 shrink-0">
                                                <AlertDialogCancel className="rounded-2xl h-14 border-2 flex-1 font-bold order-2 sm:order-1">Modify Selection</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking} className="rounded-2xl h-14 bg-primary font-bold shadow-2xl flex-1 order-1 sm:order-2">
                                                    {isBooking ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Processing...</> : "Finalize Clinical Booking"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardContent>
                            </Card>

                            <div className="mt-8 p-6 bg-slate-900 text-white rounded-[2rem] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                                        <ClockIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Need immediate care?</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Average wait time: 12 minutes</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="rounded-xl border-white/20 bg-transparent hover:bg-white/10 text-white font-bold h-11 px-8">View Urgent Slots</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    );
}
