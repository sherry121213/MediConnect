'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, BadgeCheck, RefreshCw, FileText, Upload, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Primary degree title is required.'),
  phone: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic hub city is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UploadingFile {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    url?: string;
}

export default function DoctorProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Document Upload State
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [existingDocs, setExistingDocs] = useState<string[]>([]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialty: '',
      experience: 0,
      medicalSchool: '',
      degree: '',
      phone: '',
      location: '',
    },
  });
  
  const isEmailVerified = !!user?.emailVerified;
  const isVerified = !!userData?.verified;

  useEffect(() => {
    if (user && firestore) {
      const fetchDoctorProfile = async () => {
        try {
          const doctorDocRef = doc(firestore, 'doctors', user.uid);
          const docSnap = await getDoc(doctorDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({
              specialty: data.specialty || '',
              experience: data.experience || 0,
              medicalSchool: data.medicalSchool || '',
              degree: data.degree || '',
              phone: data.phone || '',
              location: data.location || '',
            });
            setExistingDocs(data.documents || []);
          }
        } catch (error) {
          console.error("Error fetching doctor profile:", error);
        }
      };
      fetchDoctorProfile();
    }
  }, [user, firestore, form]);
  
  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      setCropperImage(objectUrl);
      e.target.value = ''; 
    }
  };

  const handleSaveCroppedImage = async (croppedImage: string) => {
    if (!user || !firestore || !storage) return;
    
    setIsUploadingPhoto(true);
    setPhotoProgress(1);
    setCropperImage(null);

    try {
      const base64Data = croppedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      const fileRef = ref(storage, `doctors/${user.uid}/profile_${Date.now()}.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, blob);
      
      uploadTask.on('state_changed', 
          (snapshot) => {
              const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setPhotoProgress(Math.max(p, 1)); 
          },
          (error) => {
              toast({ variant: 'destructive', title: 'Photo Sync Failed' });
              setIsUploadingPhoto(false);
          },
          async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const updateData = { photoURL: downloadURL, updatedAt: new Date().toISOString() };
              updateDocumentNonBlocking(doc(firestore, 'doctors', user.uid), updateData);
              updateDocumentNonBlocking(doc(firestore, 'patients', user.uid), updateData);

              toast({ title: 'Identity Secured', description: 'Profile photo updated.' });
              setIsUploadingPhoto(false);
              setPhotoProgress(0);
          }
      );
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'System Error', description: 'Could not process photo.' });
      setIsUploadingPhoto(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newItems = files.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        progress: 0,
        status: 'pending' as const
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
    e.target.value = ''; 
  };

  const startUploads = async () => {
    if (!user || !storage || !firestore) return;
    
    const pending = uploadQueue.filter(q => q.status === 'pending');
    if (pending.length === 0) return;

    for (const item of pending) {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 1 } : q));

        const fileRef = ref(storage, `doctors/${user.uid}/degrees/${item.id}_${item.file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, item.file);

        await new Promise<void>((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: Math.max(p, 1) } : q));
                },
                (error) => {
                    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', url: downloadURL, progress: 100 } : q));
                    
                    await updateDoc(doc(firestore, 'doctors', user.uid), {
                        documents: arrayUnion(downloadURL),
                        updatedAt: new Date().toISOString()
                    });
                    setExistingDocs(prev => [...prev, downloadURL]);
                    resolve();
                }
            );
        });
    }
  };

  useEffect(() => {
    if (uploadQueue.some(q => q.status === 'pending')) {
        startUploads();
    }
  }, [uploadQueue]);

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        toast({ title: "Email verified. Access active." });
      } else {
          toast({ title: "Verification link sent.", description: "Check your inbox." });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Sync Error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore) return;
    
    const allDocs = [...existingDocs, ...uploadQueue.filter(q => q.status === 'done' && q.url).map(q => q.url!)];
    if (allDocs.length === 0) {
        toast({
            variant: "destructive",
            title: "Credentials Required",
            description: "Please upload at least one degree image for admin verification."
        });
        return;
    }

    setIsSubmitting(true);

    try {
        const timestamp = new Date().toISOString();
        const doctorData = {
            ...values,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            email: user.email || '',
            profileComplete: true,
            verified: false, 
            updatedAt: timestamp,
            documents: allDocs
        };

        const patientData = { 
            profileComplete: true, 
            verified: false,
            updatedAt: timestamp,
            phone: values.phone,
            firstName: userData?.firstName,
            lastName: userData?.lastName
        };

        setDocumentNonBlocking(doc(firestore, 'doctors', user.uid), doctorData, { merge: true });
        setDocumentNonBlocking(doc(firestore, 'patients', user.uid), patientData, { merge: true });

        toast({ title: 'Application Submitted', description: 'Your credentials have been sent to the Admin team for review.' });
        router.push('/doctor-portal');
    } catch (error) {
        toast({ variant: "destructive", title: "Persistence Error" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const totalUploadedCount = existingDocs.length + uploadQueue.filter(q => q.status === 'done').length;

  if (isUserLoading) return <div className="flex min-h-screen items-center justify-center bg-secondary/10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <main className="flex-grow bg-secondary/30 py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-primary" /> Onboarding Registry
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Submit your professional credentials to unlock the Mediconnect portal.</p>
                </div>
                {isVerified ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 h-10 gap-2 px-6 rounded-full font-bold">
                        <BadgeCheck className="h-5 w-5" /> Verified Professional
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 h-10 gap-2 px-6 rounded-full font-bold">
                        <Loader2 className="h-4 w-4 animate-spin" /> Audit Required
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden h-fit">
                        <CardContent className="pt-8 text-center space-y-6">
                            <div className="relative group mx-auto w-36 h-36">
                                <Avatar className="h-36 w-36 border-4 border-background shadow-xl">
                                    <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} className="object-cover" />
                                    <AvatarFallback className="text-5xl bg-primary/5 text-primary">{userData?.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white p-4">
                                        <p className="text-[10px] font-bold uppercase mb-1">{Math.round(photoProgress)}%</p>
                                        <Progress value={photoProgress} className="h-1 w-full" />
                                    </div>
                                )}
                            </div>
                            <div className='relative inline-block'>
                                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold border-2" disabled={isUploadingPhoto}>
                                    <label htmlFor="picture-upload" className="cursor-pointer">
                                    {isUploadingPhoto ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>) : "Upload ID Photo"}
                                    </label>
                                </Button>
                                <Input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploadingPhoto || isSubmitting} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl p-8 space-y-6">
                        <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-400">Clinical Application Progress</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Personal Info</span>
                                {form.formState.isValid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="h-2 w-2 rounded-full bg-slate-700" />}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Degree Uploads</span>
                                {totalUploadedCount > 0 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="h-2 w-2 rounded-full bg-slate-700" />}
                            </div>
                        </div>
                        <Separator className="bg-slate-800" />
                        <p className="text-[10px] text-slate-500 italic leading-relaxed">
                            MEDICONNECT POLICY: Verification typically takes 12-24 hours. Ensure your uploaded degree name matches your registry name.
                        </p>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-8">
                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b px-8 py-8">
                            <CardTitle className="text-xl">Step 1: Clinical Registry Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            {!isEmailVerified && (
                                <Alert variant="destructive" className="mb-10 rounded-2xl">
                                    <AlertTitle className="font-bold">Email Verification Needed</AlertTitle>
                                    <AlertDescription className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                                        <span className="text-xs">Your clinical email must be verified before final submission.</span>
                                        <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing} className="bg-white border-destructive text-destructive font-bold h-9 rounded-xl shrink-0">
                                            Sync Status
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            <Form {...form}>
                                <form className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="specialty" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical Specialty</FormLabel><FormControl><Input placeholder="e.g. Cardiology" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Practice Years</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical University</FormLabel><FormControl><Input placeholder="e.g. Aga Khan University" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="degree" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Primary Degree Title</FormLabel><FormControl><Input placeholder="e.g. MBBS, FCPS" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Clinical Contact</FormLabel><FormControl><Input placeholder="03XXXXXXXXX" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="location" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Practice Hub City</FormLabel><FormControl><Input placeholder="e.g. Karachi" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                         <CardHeader className="bg-muted/10 border-b px-8 py-8">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">Step 2: Professional Credentials</CardTitle>
                                <Badge className="bg-primary/10 text-primary border-none">{totalUploadedCount} Linked Assets</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2rem] bg-muted/5 group hover:bg-muted/10 transition-colors relative">
                                <Upload className="h-12 w-12 text-muted-foreground/30 mb-4 group-hover:text-primary transition-colors" />
                                <div className="text-center">
                                    <p className="text-sm font-bold">Select Degrees or Certifications</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">High-Resolution (Max 500MB)</p>
                                </div>
                                <Input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,.pdf" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={handleFileSelect}
                                />
                            </div>

                            {uploadQueue.filter(q => q.status !== 'done').length > 0 && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Transmission Queue</p>
                                    {uploadQueue.filter(q => q.status !== 'done').map(item => (
                                        <div key={item.id} className="p-4 rounded-2xl bg-muted/30 border space-y-3">
                                            <div className="flex justify-between items-center text-xs">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="truncate font-bold italic">{item.file.name}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-primary">{Math.round(item.progress)}%</span>
                                            </div>
                                            <Progress value={item.progress} className="h-1.5" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {totalUploadedCount > 0 && (
                                <div className="space-y-4 pt-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Verified Professional Portfolio</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {existingDocs.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-video rounded-xl overflow-hidden border shadow-sm group bg-muted/20 flex items-center justify-center">
                                                <FileText className="h-8 w-8 text-primary/20" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    <Badge className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-slate-900">View Evidence</Badge>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button 
                        onClick={form.handleSubmit(onSubmit)} 
                        className="w-full h-20 text-xl font-bold rounded-[2rem] shadow-2xl shadow-primary/20" 
                        disabled={isSubmitting || !isEmailVerified || totalUploadedCount === 0}
                    >
                        {isSubmitting ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Submitting for Verification...</> : "Finalize & Send for Audit"}
                    </Button>
                </div>
            </div>
        </div>
        <ImageCropperDialog isOpen={!!cropperImage} onOpenChange={(isOpen) => !isOpen && setCropperImage(null)} imageSrc={cropperImage} onSave={handleSaveCroppedImage} />
      </main>
  );
}
