
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
import { ArrowLeft, AtSign, BriefcaseMedical, Calendar, CheckCircle, GraduationCap, Loader2, MapPin, Phone, Star, UserCheck, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
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
        
        // Mark as verified and complete profile to allow immediate portal access
        updateDocumentNonBlocking(doctorDocRef, { 
            verified: true, 
            profileComplete: true,
            updatedAt: new Date().toISOString() 
        });

        // Also update the patients collection for consistent routing
        const patientDocRef = doc(firestore, 'patients', doctorId);
        updateDocumentNonBlocking(patientDocRef, {
            profileComplete: true,
            updatedAt: new Date().toISOString()
        });

        toast({
            title: "Doctor Verified!",
            description: `Dr. ${doctor.firstName}'s professional profile has been verified and their portal is now active.`,
        });
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error || !doctor) return <div className="p-8 text-center text-destructive">Error loading profile or doctor not found.</div>;

    const doctorImage = placeholderImages.find(p => p.id === doctor.profileImageId);

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <Button asChild variant="ghost" className="mb-6">
                <Link href="/admin/doctors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to All Doctors
                </Link>
            </Button>
            
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-muted/30 p-8 rounded-t-lg">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                        <AvatarImage src={doctor.photoURL} />
                        <AvatarFallback className="text-4xl">{doctor.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-grow text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-3xl font-headline">{doctor.firstName} {doctor.lastName}</CardTitle>
                                <CardDescription className="text-lg text-primary font-medium">{doctor.specialty}</CardDescription>
                            </div>
                             <Badge variant={doctor.verified ? 'secondary' : 'destructive'} className={`h-8 gap-1.5 px-4 ${doctor.verified ? 'bg-green-100 text-green-800' : ''}`}>
                                {doctor.verified ? <ShieldCheck className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                {doctor.verified ? 'Verified Expert' : 'Awaiting Verification'}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {doctor.location || 'N/A'}</div>
                            <div className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500 fill-amber-400" /> {doctor.rating || 0} ({doctor.reviews || 0} reviews)</div>
                            <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Member since {new Date(doctor.createdAt || '').toLocaleDateString()}</div>
                        </div>
                    </div>
                     {!doctor.verified && (
                        <div className="w-full md:w-auto shrink-0 pt-4 md:pt-0">
                            <Button onClick={handleVerifyDoctor} size="lg" className="w-full shadow-md">
                                <CheckCircle className="mr-2 h-5 w-5" /> Approve Profile
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-8 grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 space-y-6">
                        <h4 className="font-bold text-lg border-b pb-2">Contact Details</h4>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full"><AtSign className="h-4 w-4 text-primary" /></div>
                                <div className="text-sm">
                                    <p className="text-muted-foreground text-xs uppercase font-bold">Email</p>
                                    <p className="font-medium">{doctor.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full"><Phone className="h-4 w-4 text-primary" /></div>
                                <div className="text-sm">
                                    <p className="text-muted-foreground text-xs uppercase font-bold">Phone</p>
                                    <p className="font-medium">{doctor.phone || 'Not Provided'}</p>
                                </div>
                            </div>
                        </div>

                        <h4 className="font-bold text-lg border-b pb-2 mt-8">Professional Stats</h4>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full"><UserCheck className="h-4 w-4 text-primary" /></div>
                                <div className="text-sm">
                                    <p className="text-muted-foreground text-xs uppercase font-bold">Experience</p>
                                    <p className="font-medium">{doctor.experience || 0} Years</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full"><BriefcaseMedical className="h-4 w-4 text-primary" /></div>
                                <div className="text-sm">
                                    <p className="text-muted-foreground text-xs uppercase font-bold">Specialty</p>
                                    <p className="font-medium">{doctor.specialty}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 space-y-6">
                        <h4 className="font-bold text-lg border-b pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-primary" /> Education & Portfolio
                            </div>
                            <Badge variant="outline" className="text-xs">{doctor.documents?.length || 0} Files</Badge>
                        </h4>
                        
                        <div className="bg-muted/20 p-4 rounded-lg border">
                            <p className="text-sm font-semibold text-primary mb-1">Primary Qualifications</p>
                            <p className="text-lg font-headline">{doctor.degree || 'MBBS'}</p>
                            <p className="text-sm text-muted-foreground">{doctor.medicalSchool || 'Medical University'}</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Verification Documents</p>
                            {doctor.documents && doctor.documents.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {doctor.documents.map((url, idx) => {
                                        const isImage = url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || url.includes('image');
                                        return (
                                            <Card key={idx} className="overflow-hidden border-muted shadow-sm hover:shadow-md transition-shadow">
                                                <div className="relative aspect-video bg-muted/30 flex items-center justify-center border-b">
                                                    {isImage ? (
                                                        <Image src={url} alt={`Credential ${idx + 1}`} fill className="object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <FileText className="h-12 w-12 text-primary/40" />
                                                            <span className="text-[10px] font-bold uppercase text-muted-foreground">PDF Credential</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <CardContent className="p-3 flex justify-between items-center bg-background">
                                                    <span className="text-xs font-bold truncate pr-2">Document {idx + 1}</span>
                                                    <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase font-bold" asChild>
                                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                                            View Full <ExternalLink className="ml-1.5 h-3 w-3" />
                                                        </a>
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/5">
                                    <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No professional documents have been uploaded for review.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Minimal Avatar components for this file context if not imported
function Avatar({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>{children}</div>;
}
function AvatarImage({ src }: { src?: string }) {
    return src ? <img src={src} className="aspect-square h-full w-full object-cover" /> : null;
}
function AvatarFallback({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={`flex h-full w-full items-center justify-center rounded-full bg-muted font-bold ${className}`}>{children}</div>;
}
