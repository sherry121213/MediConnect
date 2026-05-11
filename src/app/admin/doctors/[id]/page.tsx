
'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useStorage, useCollection } from '@/firebase';
import { doc, setDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Doctor } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { ArrowLeft, AtSign, BriefcaseMedical, CheckCircle, Loader2, MapPin, Phone, FileText, ShieldCheck, Eye, ClipboardCheck, ExternalLink, Plus, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function DoctorProfilePage() {
    const params = useParams();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const doctorId = params.id as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

    const doctorDocRef = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return doc(firestore, 'doctors', doctorId);
    }, [firestore, doctorId]);

    const { data: doctor, isLoading, error } = useDoc<Doctor>(doctorDocRef);

    // FETCHING DE-COUPLED CREDENTIALS
    const credentialsQuery = useMemoFirebase(() => {
        if (!firestore || !doctorId) return null;
        return query(collection(firestore, 'doctorCredentials'), where('doctorId', '==', doctorId));
    }, [firestore, doctorId]);
    const { data: credentials, isLoading: isLoadingCreds } = useCollection<any>(credentialsQuery);

    const handleVerifyDoctor = async () => {
        if (!firestore || !doctorId || !doctor) return;
        
        const timestamp = new Date().toISOString();
        await setDoc(doc(firestore, 'doctors', doctorId), { 
            verified: true, 
            profileComplete: true,
            updatedAt: timestamp 
        }, { merge: true });

        await setDoc(doc(firestore, 'patients', doctorId), {
            verified: true,
            profileComplete: true,
            updatedAt: timestamp
        }, { merge: true });

        toast({
            title: "Doctor Verified!",
            description: `Dr. ${doctor.firstName}'s clinical profile is now active.`,
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !storage || !firestore || !doctorId) return;
        
        const file = e.target.files[0];
        setIsUploading(true);
        setUploadProgress(1);

        const storageRef = ref(storage, `doctors/${doctorId}/degrees/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(Math.max(progress, 1));
            },
            (error) => {
                toast({ variant: 'destructive', title: "Sync Error", description: "Storage link failed." });
                setIsUploading(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // DE-COUPLED PERSISTENCE
                const credentialData = {
                    doctorId: doctorId,
                    fileUrl: downloadURL,
                    fileName: file.name,
                    uploadedAt: new Date().toISOString(),
                };
                
                await addDocumentNonBlocking(collection(firestore, 'doctorCredentials'), credentialData);

                toast({ title: "Asset Secured", description: "Independent record created for this credential." });
                setIsUploading(false);
                setUploadProgress(0);
                setIsUploadDialogOpen(false);
            }
        );
    };

    const handleRemoveCred = async (credId: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'doctorCredentials', credId));
        toast({ title: "Record Deleted" });
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
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm"><BriefcaseMedical className="h-4 w-4 text-primary" /> {doctor.experience || 0} Years Exp.</div>
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
                <CardContent className="p-8 sm:p-12">
                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="md:col-span-1 space-y-8">
                            <div className="space-y-4">
                                <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground border-b pb-3">Clinical Contacts</h4>
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
                        </div>
                        
                        <div className="md:col-span-2 space-y-8">
                            <h4 className="font-bold text-lg border-b pb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-1 bg-primary rounded-full" />
                                    <ClipboardCheck className="h-6 w-6 text-primary" /> Professional Portfolio Archive
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{credentials?.length || 0} Assets</Badge>
                                    
                                    <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="h-8 px-3 rounded-lg font-bold gap-2">
                                                <Plus className="h-3.5 w-3.5" /> Add Asset
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="rounded-3xl sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Independent Asset Entry</DialogTitle>
                                                <DialogDescription>Create a separate credential record for Dr. {doctor.lastName}.</DialogDescription>
                                            </DialogHeader>
                                            <div className="py-8">
                                                <div className="p-10 border-4 border-dashed rounded-[2rem] bg-muted/5 flex flex-col items-center justify-center text-center space-y-4 group hover:bg-muted/10 transition-colors">
                                                    <div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-muted-foreground/30 group-hover:text-primary transition-colors">
                                                        <Upload className="h-8 w-8" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">Force Sync Credential</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Images or PDFs (Max 500MB)</p>
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        className="rounded-xl border-2 font-bold h-10 px-6"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isUploading}
                                                    >
                                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                        Select File
                                                    </Button>
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        className="hidden" 
                                                        accept="image/*,.pdf" 
                                                        onChange={handleFileUpload} 
                                                    />
                                                </div>
                                                {isUploading && (
                                                    <div className="mt-6 space-y-2">
                                                        <div className="flex justify-between items-center text-[10px] font-bold uppercase text-primary">
                                                            <span>Syncing Record...</span>
                                                            <span>{Math.round(uploadProgress)}%</span>
                                                        </div>
                                                        <Progress value={uploadProgress} className="h-1.5" />
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button variant="ghost" className="rounded-xl" onClick={() => setIsUploadDialogOpen(false)} disabled={isUploading}>Cancel</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </h4>
                            
                            <div className="bg-muted/30 p-6 rounded-2xl border border-dashed border-primary/20 space-y-2">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Primary Qualification</p>
                                <p className="text-xl font-headline font-bold">{doctor.degree || 'General Practitioner'}</p>
                                <p className="text-sm text-muted-foreground italic">{doctor.medicalSchool || 'Medical University Records'}</p>
                            </div>

                            <div className="space-y-6">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">High-Fidelity Assets</p>
                                {isLoadingCreds ? (
                                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                                ) : credentials && credentials.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {credentials.map((cred) => {
                                            const url = cred.fileUrl;
                                            const isImage = url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg') || url.toLowerCase().includes('.png') || url.toLowerCase().includes('.webp') || url.includes('alt=media');
                                            return (
                                                <Card key={cred.id} className="overflow-hidden border-muted shadow-lg group hover:shadow-xl transition-all rounded-2xl">
                                                    <div className="relative aspect-video bg-muted/40 flex items-center justify-center border-b overflow-hidden">
                                                        {isImage ? (
                                                            <div className="relative w-full h-full">
                                                                <Image src={url} alt={cred.fileName} fill className="object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-3">
                                                                <FileText className="h-16 w-16 text-primary/20" />
                                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Document File</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-3">
                                                            <Button asChild variant="outline" size="sm" className="bg-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                                                <a href={url} target="_blank" rel="noopener noreferrer">
                                                                    <Eye className="h-4 w-4 mr-2" /> Open Raw
                                                                </a>
                                                            </Button>
                                                            <Button variant="destructive" size="icon" className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" onClick={() => handleRemoveCred(cred.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardContent className="p-4 flex justify-between items-center bg-white">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] font-bold uppercase tracking-tighter truncate text-slate-500">{cred.fileName}</p>
                                                            <p className="text-[7px] text-muted-foreground">{new Date(cred.uploadedAt).toLocaleDateString()}</p>
                                                        </div>
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 space-y-4">
                                        <div className="h-20 w-20 bg-muted/10 rounded-full flex items-center justify-center mx-auto"><FileText className="h-10 w-10 text-muted-foreground/30" /></div>
                                        <p className="text-sm text-muted-foreground font-medium italic">No independent records found for this doctor.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
