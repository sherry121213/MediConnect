'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Doctor } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { ArrowLeft, AtSign, BriefcaseMedical, Calendar, CheckCircle, GraduationCap, Loader2, MapPin, Phone, Star, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
        
        updateDocumentNonBlocking(doctorDocRef, { 
            verified: true, 
            profileComplete: true,
            updatedAt: new Date().toISOString() 
        });

        const patientDocRef = doc(firestore, 'patients', doctorId);
        updateDocumentNonBlocking(patientDocRef, {
            verified: true,
            profileComplete: true,
            updatedAt: new Date().toISOString()
        });

        toast({
            title: "Doctor Verified!",
            description: `Dr. ${doctor.firstName}'s clinical profile is now active.`,
        });
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-secondary/10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error || !doctor) return <div className="p-8 text-center text-destructive font-bold">Error loading clinical profile.</div>;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <Button asChild variant="ghost" className="rounded-xl hover:bg-white shadow-sm border">
                <Link href="/admin/doctors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Registry
                </Link>
            </Button>
            
            <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-white">
                <CardHeader className="flex flex-col md:flex-row items-center md:items-start gap-8 bg-primary/5 p-8 sm:p-12">
                    <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-8 border-white shadow-xl">
                        <AvatarImage src={doctor.photoURL} className="object-cover" />
                        <AvatarFallback className="text-5xl bg-primary/10 text-primary">{doctor.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-grow text-center md:text-left space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-3xl sm:text-4xl font-headline tracking-tight">{doctor.firstName} {doctor.lastName}</CardTitle>
                                <CardDescription className="text-lg text-primary font-bold uppercase tracking-wider mt-1">{doctor.specialty}</CardDescription>
                            </div>
                             <Badge variant={doctor.verified ? 'secondary' : 'destructive'} className={`h-10 gap-2 px-6 rounded-full font-bold shadow-sm ${doctor.verified ? 'bg-green-100 text-green-800 border-green-200' : ''}`}>
                                {doctor.verified ? <ShieldCheck className="h-5 w-5" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                                {doctor.verified ? 'Verified Professional' : 'Audit Required'}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm font-medium text-muted-foreground pt-2">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm"><MapPin className="h-4 w-4 text-primary" /> {doctor.location || 'N/A'}</div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm"><Star className="h-4 w-4 text-amber-500 fill-amber-400" /> {doctor.rating || 0} Rating</div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm"><Calendar className="h-4 w-4 text-primary" /> Registry Date: {doctor.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : 'N/A'}</div>
                        </div>
                    </div>
                     {!doctor.verified && (
                        <div className="w-full md:w-auto shrink-0 pt-6 md:pt-0">
                            <Button onClick={handleVerifyDoctor} size="lg" className="w-full sm:px-10 rounded-2xl shadow-xl shadow-primary/20 font-bold h-14">
                                <CheckCircle className="mr-2 h-5 w-5" /> Approve Registry
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-8 sm:p-12 grid md:grid-cols-3 gap-12">
                    <div className="md:col-span-1 space-y-8">
                        <div className="space-y-4">
                            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground border-b pb-3">Contact Information</h4>
                            <div className="space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-2xl"><AtSign className="h-5 w-5 text-primary" /></div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Clinical Email</p>
                                        <p className="font-bold text-sm truncate">{doctor.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-2xl"><Phone className="h-5 w-5 text-primary" /></div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Phone Line</p>
                                        <p className="font-bold text-sm">{doctor.phone || 'Private'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground border-b pb-3 pt-6">Experience Audit</h4>
                            <div className="space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-slate-100 rounded-2xl"><BriefcaseMedical className="h-5 w-5 text-slate-600" /></div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Practice Years</p>
                                        <p className="font-bold text-sm">{doctor.experience || 0} Years Active</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 space-y-8">
                        <h4 className="font-bold text-lg border-b pb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-1 bg-primary rounded-full" />
                                <GraduationCap className="h-6 w-6 text-primary" /> Professional Portfolio
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{doctor.documents?.length || 0} Total Degrees</Badge>
                        </h4>
                        
                        <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-primary/20 space-y-2">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Highest Qualification</p>
                            <p className="text-xl font-headline font-bold">{doctor.degree || 'General Practitioner'}</p>
                            <p className="text-sm text-muted-foreground italic">{doctor.medicalSchool || 'Medical University Records'}</p>
                        </div>

                        <div className="space-y-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Clinical Evidence (Tap to expand)</p>
                            {doctor.documents && doctor.documents.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {doctor.documents.map((url, idx) => {
                                        const isImageUrl = typeof url === 'string' && (url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.png') || url.toLowerCase().includes('.jpeg') || url.toLowerCase().includes('image'));
                                        return (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block outline-none group">
                                                <Card className="overflow-hidden border-muted shadow-lg group-hover:shadow-xl group-hover:border-primary/20 transition-all rounded-2xl">
                                                    <div className="relative aspect-video bg-muted/40 flex items-center justify-center border-b overflow-hidden">
                                                        {isImageUrl ? (
                                                            <Image src={url} alt={`Document ${idx + 1}`} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-3">
                                                                <FileText className="h-16 w-16 text-primary/20" />
                                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">PDF Registry</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                            <ExternalLink className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                                        </div>
                                                    </div>
                                                    <CardContent className="p-4 flex justify-between items-center bg-white">
                                                        <span className="text-[10px] font-bold uppercase tracking-tighter truncate pr-2">Evidence-File-{idx + 1}</span>
                                                        <span className="text-[8px] text-primary font-bold uppercase tracking-widest border border-primary/20 rounded px-1.5 py-0.5 group-hover:bg-primary group-hover:text-white transition-colors">Expand</span>
                                                    </CardContent>
                                                </Card>
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 space-y-4">
                                    <div className="h-20 w-20 bg-muted/10 rounded-full flex items-center justify-center mx-auto"><FileText className="h-10 w-10 text-muted-foreground/30" /></div>
                                    <p className="text-sm text-muted-foreground font-medium italic">No professional documents available for review.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}