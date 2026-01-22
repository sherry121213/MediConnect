'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, Biohazard, BriefcaseMedical, CalendarDays, Clock, GraduationCap, Heart, Loader2, MapPin, Star, UserCheck, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useState } from 'react';
import { getNext7Days, timeSlots } from '@/lib/time';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';


export default function DoctorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const doctorId = params.id as string;

    const [selectedDate, setSelectedDate] = useState(getNext7Days()[0].date);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isBooking, setIsBooking] = useState(false);
    const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading, error } = useDoc<Doctor>(doctorDocRef);

    const handleConfirmBooking = () => {
        if (isUserLoading) return; // Wait until user status is confirmed

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
        
        if (ampm === 'PM' && numericHours !== 12) {
            numericHours += 12;
        }
        if (ampm === 'AM' && numericHours === 12) {
            numericHours = 0;
        }

        appointmentDateTime.setHours(numericHours, parseInt(minutes), 0, 0);

        const newAppointment = {
            patientId: user.uid,
            doctorId: doctor.id,
            appointmentDateTime: appointmentDateTime.toISOString(),
            appointmentType: 'Video Call',
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
            description: `Your appointment with Dr. ${doctor.firstName} ${doctor.lastName} is confirmed.`,
        });

        setIsBooking(false);
        router.push('/patient-portal');
    };

    const getSpecialtyIcon = (specialty?: string) => {
        switch (specialty) {
            case 'Cardiology':
                return <Heart className="mr-2 h-4 w-4" />;
            case 'Psychiatrist':
                return <Brain className="mr-2 h-4 w-4" />;
            case 'General Physician':
                 return <BriefcaseMedical className="mr-2 h-4 w-4" />;
            default:
                return <Biohazard className="mr-2 h-4 w-4" />;
        }
    }
    
    if (isLoading || isUserLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <AppHeader />
                <main className="flex-grow flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2">Loading doctor profile...</p>
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
                        <p className="text-muted-foreground mt-2">The requested doctor could not be found.</p>
                        <Button asChild className="mt-6">
                            <Link href="/find-a-doctor">Find Another Doctor</Link>
                        </Button>
                    </div>
                </main>
                <AppFooter />
            </div>
        );
    }

    const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);
    const availableDates = getNext7Days();

    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-grow bg-secondary/30 py-12">
                <div className="container mx-auto px-4">
                    <Button asChild variant="ghost" className="mb-6">
                        <Link href="/find-a-doctor">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Doctor Search
                        </Link>
                    </Button>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Doctor Info */}
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader className="items-center text-center">
                                    {doctorImage ? (
                                        <Image
                                            src={doctorImage.imageUrl}
                                            alt={`${doctor.firstName} ${doctor.lastName}`}
                                            width={128}
                                            height={128}
                                            className="rounded-full border-4 border-background"
                                            data-ai-hint={doctorImage.imageHint}
                                        />
                                    ) : <Skeleton className="h-32 w-32 rounded-full" />}
                                    <div className="pt-4">
                                        <CardTitle className="text-2xl font-headline">Dr. {doctor.firstName} {doctor.lastName}</CardTitle>
                                        <CardDescription className="text-md text-primary mt-1">{doctor.specialty}</CardDescription>
                                        <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                                                {doctor.rating || 0}
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground space-y-4">
                                     <div className="flex items-center"><UserCheck className="mr-2 h-4 w-4" /> <strong>{doctor.experience || 0} years</strong> of experience</div>
                                     <div className="flex items-center"><GraduationCap className="mr-2 h-4 w-4" /> Studied at <strong>{doctor.medicalSchool}</strong></div>
                                     <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> Practices in <strong>{doctor.location}</strong></div>
                                     <p className="text-sm text-center pt-2 border-t mt-4">{doctor.bio || "No bio available."}</p>
                                </CardContent>
                            </Card>
                        </div>
                        {/* Booking Schedule */}
                        <div className="lg:col-span-2">
                             <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-6 w-6 text-primary"/> Select a Date and Time</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-6">
                                        <h4 className="font-semibold mb-3 text-md">Date</h4>
                                        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                                            {availableDates.map(day => (
                                                <button 
                                                    key={day.date.toISOString()}
                                                    onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                                    className={cn(
                                                        "p-2 rounded-lg border text-center transition-colors",
                                                        selectedDate.toDateString() === day.date.toDateString() ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                                                    )}
                                                >
                                                    <p className="text-sm font-medium">{day.dayName}</p>
                                                    <p className="text-2xl font-bold">{day.dayNumber}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                     <div className="mb-6">
                                        <h4 className="font-semibold mb-3 text-md">Time <span className='text-sm text-muted-foreground'>(Morning)</span></h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {timeSlots.morning.map(time => (
                                                <Button 
                                                    key={time}
                                                    variant={selectedTime === time ? 'default' : 'outline'}
                                                    onClick={() => setSelectedTime(time)}
                                                >{time}</Button>
                                            ))}
                                        </div>
                                     </div>
                                     <div>
                                        <h4 className="font-semibold mb-3 text-md">Time <span className='text-sm text-muted-foreground'>(Afternoon)</span></h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                             {timeSlots.afternoon.map(time => (
                                                <Button 
                                                    key={time}
                                                    variant={selectedTime === time ? 'default' : 'outline'}
                                                    onClick={() => setSelectedTime(time)}
                                                >{time}</Button>
                                            ))}
                                        </div>
                                     </div>
                                     
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                                className="w-full mt-8" 
                                                size="lg"
                                                disabled={!selectedTime || isBooking || isUserLoading}
                                            >
                                                <Clock className="mr-2 h-4 w-4" />
                                                Book Appointment
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Complete Your Booking</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    To confirm your appointment, please transfer the consultation fee to the account details below and upload a screenshot of your receipt.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <div className="py-4 space-y-2 text-sm">
                                                <p><strong>Bank:</strong> Faysal Bank</p>
                                                <p><strong>Account Title:</strong> Mediconnect Pvt. Ltd.</p>
                                                <p><strong>Account Number:</strong> 0123-4567890123</p>
                                                <p><strong>Consultation Fee:</strong> PKR 1,500</p>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="receipt-upload">Upload Payment Receipt</Label>
                                                 <div className="relative">
                                                    <Button asChild variant="outline" size="sm" className="w-full">
                                                        <label htmlFor="receipt-upload" className="cursor-pointer text-center w-full">
                                                            {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>) : (paymentReceipt ? 'Change Receipt' : 'Choose File')}
                                                        </label>
                                                    </Button>
                                                    <Input
                                                        id="receipt-upload"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            if (!e.target.files || e.target.files.length === 0) return;
                                                            const file = e.target.files[0];
                                                            if (file.size > 1024 * 1024) { // 1MB limit
                                                                toast({
                                                                    variant: 'destructive',
                                                                    title: 'File is too large',
                                                                    description: "The application's stability depends on files being smaller than 1MB.",
                                                                });
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            setIsUploading(true);
                                                            setPaymentReceipt(null);
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setPaymentReceipt(reader.result as string);
                                                                setIsUploading(false);
                                                                toast({
                                                                    title: 'Receipt Ready',
                                                                    description: 'Your receipt has been selected.',
                                                                })
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        disabled={isUploading}
                                                    />
                                                </div>
                                                {paymentReceipt && !isUploading && (
                                                    <p className="text-sm text-green-600 font-medium text-center">Receipt selected successfully.</p>
                                                )}
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={isBooking || isUploading}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmBooking} disabled={isBooking || isUploading || !paymentReceipt}>
                                                    {isBooking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    I've Paid, Confirm Booking
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
