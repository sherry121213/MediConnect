'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { PlaceHolderImages as placeholderImages } from '@/lib/placeholder-images';
import { ArrowLeft, AtSign, BriefcaseMedical, Calendar, CheckCircle, GraduationCap, Loader2, MapPin, Phone, Star, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function DoctorProfilePage() {
    const params = useParams();
    const firestore = useFirestore();
    const { toast } = useToast();
    const doctorId = params.id as string;

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading, error } = useDoc<Doctor>(doctorDocRef);

    const handleVerifyDoctor = () => {
        if (!firestore || !doctorId || !doctor) return;
        const doctorDocRef = doc(firestore, 'doctors', doctorId);
        updateDocumentNonBlocking(doctorDocRef, { verified: true, updatedAt: new Date().toISOString() });
        toast({
            title: "Doctor Verified!",
            description: `Dr. ${doctor.firstName} ${doctor.lastName}'s profile has been verified.`,
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading doctor profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-destructive">
                <p>Error loading profile: {error.message}</p>
            </div>
        );
    }
    
    if (!doctor) {
        return (
            <div className="p-8 text-center">
                <p>Doctor profile not found.</p>
            </div>
        );
    }

    const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);

    return (
        <div className="p-4 md:p-8">
            <Button asChild variant="ghost" className="mb-6">
                <Link href="/admin/doctors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to All Doctors
                </Link>
            </Button>
            <Card className="max-w-4xl mx-auto">
                <CardHeader className="flex flex-col md:flex-row items-start gap-6 bg-muted/30 p-6">
                    {doctorImage ? (
                        <Image
                            src={doctorImage.imageUrl}
                            alt={`${doctor.firstName} ${doctor.lastName}`}
                            width={128}
                            height={128}
                            className="rounded-full border-4 border-background object-cover"
                            data-ai-hint={doctorImage.imageHint}
                        />
                    ) : (
                        <Skeleton className="h-32 w-32 rounded-full" />
                    )}
                    <div className="flex-grow pt-4">
                        <CardTitle className="text-3xl font-headline">{doctor.firstName} {doctor.lastName}</CardTitle>
                        <CardDescription className="text-lg text-primary mt-1">{doctor.specialty}</CardDescription>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                {doctor.location || 'N/A'}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Star className="h-4 w-4 text-amber-500" />
                                {doctor.rating || 0} ({doctor.reviews || 0} reviews)
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant={doctor.verified ? 'secondary' : 'destructive'} className={`mt-4 md:mt-0 ${doctor.verified ? 'bg-green-100 text-green-800' : ''}`}>
                            {doctor.verified ? 'Verified' : 'Pending Verification'}
                        </Badge>
                        {!doctor.verified && (
                            <Button onClick={handleVerifyDoctor}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Verify Doctor
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="flex items-center gap-3">
                        <AtSign className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{doctor.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{doctor.phone || 'Not Provided'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <BriefcaseMedical className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">Specialty: <strong>{doctor.specialty}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <UserCheck className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">Experience: <strong>{doctor.experience || 0} years</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">Degree: <strong>{doctor.degree || 'Not Provided'}</strong></span>
                    </div>
                     <div className="flex items-center gap-3">
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">Medical School: <strong>{doctor.medicalSchool || 'Not Provided'}</strong></span>
                    </div>
                     <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">Member since: {new Date(doctor.createdAt || '').toLocaleDateString()}</span>
                    </div>
                    <div className="md:col-span-2">
                        <h4 className="font-semibold mb-2">Degree/Certificate</h4>
                        {doctor.degreeUrl ? (
                             <div className="relative w-full max-w-md h-64 border rounded-md overflow-hidden">
                                <Image src={doctor.degreeUrl} alt="Degree preview" fill style={{objectFit: "contain"}} />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No degree image has been uploaded.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
