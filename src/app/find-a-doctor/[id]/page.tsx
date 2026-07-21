
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import type { Doctor, Appointment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, CalendarDays, Loader2, MapPin, CheckCircle2, XCircle, Copy, Activity, Wallet, Landmark, Smartphone } from 'lucide-react';
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
import { format, isSameDay, isBefore, isValid, parse, startOfDay, endOfDay, addMinutes } from 'date-fns';
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

    // 1-minute intervals for minutes
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

        // NO-OVERLAP RULE: 15m consultation + 5m break = 20m window
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
        const appointmentDateTime = parse(selectedTimeStr, 'hh:mm a', selectedDate);

        const start = startOfDay(selectedDate);
        const end = endOfDay(selectedDate);
        const dailySnap = await getDocs(query(
            collection(firestore, 'appointments'), 
            where('doctorId', '==', doctor.id),
            where('appointmentDateTime', '>=', start.toISOString()),
            where('appointmentDateTime', '<=', end.toISOString())
        ));

        const prevApts = dailySnap.docs.map(d => d.data() as Appointment);
        const tokenRank = prevApts.filter(a => new Date(a.appointmentDateTime) < appointmentDateTime).length + 1;

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
        
        addDocumentNonBlocking(collection(firestore, 'appointments'), newAppointment);
        toast({ title: "Receipt Submitted", description: `Daily Token #${tokenRank} assigned. Awaiting audit.` });
        setIsBooking(false);
        router.push('/patient-portal');
    };

    if (isLoading || isUserLoading || !mounted) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }
    
    const doctorImage = placeholderImages.find(p => p.id === doctor?.profileImageId);
    const dateOptions = getNext7Days();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <AppHeader />
            <main className="flex-grow py-12">
                <div className="container mx-auto px-4 space-y-10">
                    <Button asChild variant="ghost" className="rounded-xl group font-bold">
                        <Link href="/find-a-doctor"><ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back</Link>
                    </Button>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-4 space-y-8">
                            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="items-center text-center bg-primary/5 p-8">
                                    <div className="relative h-40 w-40 shadow-xl rounded-full border-8 border-white mb-6 overflow-hidden">
                                        <Image src={doctor?.photoURL || doctorImage?.imageUrl || ''} alt="Doctor" fill className="object-cover" />
                                    </div>
                                    <CardTitle className="text-3xl font-headline tracking-tight">Dr. {doctor?.firstName} {doctor?.lastName}</CardTitle>
                                    <CardDescription className="text-base text-primary font-bold uppercase tracking-wider">{doctor?.specialty}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 text-center">
                                    <Badge className="bg-green-100 text-green-800 h-10 px-6 rounded-full font-bold">PMDC Verified</Badge>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-8">
                             <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 border-b p-8">
                                    <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                        <CalendarDays className="h-7 w-7 text-primary"/> Precision Scheduling
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground">Select your 20-minute window (15m consult + 5m buffer).</p>
                                </CardHeader>
                                <CardContent className="p-8 sm:p-12 space-y-12">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-6">1. Choose Date</p>
                                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                            {dateOptions.map(day => (
                                                <button 
                                                    key={day.date.toISOString()}
                                                    onClick={() => setSelectedDate(day.date)}
                                                    className={cn(
                                                        "p-5 rounded-3xl border-2 transition-all shrink-0 w-28 text-center flex flex-col gap-1",
                                                        selectedDate.toDateString() === day.date.toDateString() ? 'bg-primary text-white border-primary shadow-xl' : 'bg-white border-slate-100 hover:border-primary/20'
                                                    )}
                                                >
                                                    <p className="text-[10px] font-bold uppercase">{day.dayName}</p>
                                                    <p className="text-2xl font-bold font-headline">{day.dayNumber}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-6">2. Precise Time (1-Min Intervals)</p>
                                        <div className="p-8 border-4 border-dashed rounded-[2rem] bg-slate-50/50 space-y-6">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1">Hour</Label>
                                                    <Select value={selectedHour} onValueChange={setSelectedHour}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="max-h-[200px]">{availableHours.map(h => (<SelectItem key={h} value={h} className="font-bold">{h}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1">Minute</Label>
                                                    <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="max-h-[300px]">{availableMinutes.map(m => (<SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase ml-1">Period</Label>
                                                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                                        <SelectTrigger className="h-14 rounded-2xl border-2 bg-white font-bold text-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{availablePeriods.map(p => (<SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            {selectedTimeStr && !timeValidation.isAvailable ? (
                                                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3"><XCircle className="h-5 w-5 text-red-600" /><p className="text-xs text-red-800 font-bold">{timeValidation.message}</p></div>
                                            ) : <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-600" /><p className="text-xs text-green-800 font-bold">Slot is available (Includes 5m Break)</p></div>}
                                        </div>
                                    </div>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full h-20 text-xl font-bold rounded-3xl shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90" disabled={!timeValidation.isAvailable || isBooking}>Secure Slot at {selectedTimeStr}</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-xl max-h-[90vh] overflow-y-auto p-0">
                                            <div className="p-8 sm:p-10 space-y-8">
                                                <AlertDialogHeader><AlertDialogTitle className="text-2xl font-headline">Clinical Settlement</AlertDialogTitle><AlertDialogDescription>Select your payment method and upload the receipt.</AlertDialogDescription></AlertDialogHeader>
                                                
                                                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 text-center"><p className="text-[10px] uppercase font-bold text-primary tracking-widest">Standard Fee</p><p className="text-5xl font-bold font-headline">PKR 1,500</p></div>
                                                
                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">1. Select Payment Method</Label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        {PAYMENT_METHODS.map((method) => (
                                                            <button 
                                                                key={method.id}
                                                                onClick={() => setPaymentMethod(method.id)}
                                                                className={cn(
                                                                    "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                                                                    paymentMethod === method.id 
                                                                        ? "border-primary bg-primary/5 shadow-md" 
                                                                        : "border-slate-100 bg-white hover:border-slate-200"
                                                                )}
                                                            >
                                                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", method.bg)}>
                                                                    <method.icon className={cn("h-5 w-5", method.color)} />
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase">{method.label}</span>
                                                                {paymentMethod === method.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">2. Transfer Details</Label>
                                                    <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
                                                        <div className="flex justify-between items-center"><h4 className="text-xl font-bold">{paymentMethod}</h4><Copy className="h-4 w-4 text-slate-500 cursor-pointer hover:text-white" onClick={() => { navigator.clipboard.writeText('03120555772'); toast({ title: "Copied" }); }} /></div>
                                                        <p className="text-2xl font-mono font-bold tracking-tight">03120555772</p>
                                                        <p className="text-[9px] text-slate-500 italic">Acc Holder: MediConnect Support</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest ml-1">3. Upload Receipt</Label>
                                                    <label htmlFor="receipt-upload" className="flex flex-col items-center justify-center w-full h-40 border-4 border-dashed rounded-[2.5rem] bg-slate-50 hover:bg-slate-100 border-slate-200 cursor-pointer transition-all">
                                                        {paymentReceipt ? <CheckCircle2 className="h-10 w-10 text-green-500" /> : <Activity className="h-10 w-10 text-primary/30" />}
                                                        <p className="text-sm font-bold text-primary mt-2">{paymentReceipt ? "Receipt Attached" : "Click to Upload"}</p>
                                                        <input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setPaymentReceipt(reader.result as string);
                                                            reader.readAsDataURL(file);
                                                        }} />
                                                    </label>
                                                </div>
                                                <AlertDialogFooter className="flex flex-col sm:flex-row gap-3">
                                                    <AlertDialogCancel className="rounded-2xl h-14 border-2 flex-1">Back</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleConfirmBooking} disabled={!paymentReceipt || isBooking} className="rounded-2xl h-14 bg-primary font-bold shadow-2xl flex-1">
                                                        {isBooking ? <Loader2 className="animate-spin h-4 w-4" /> : "Finalize Booking"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </div>
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
