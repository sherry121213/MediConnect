
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage, useMemoFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ExternalLink, GraduationCap, Eye, BadgeCheck, ShieldAlert, Plus, X, CheckCircle2, CloudUpload, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Primary degree is required.'),
  phone: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic location is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface FileUploadTask {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'done' | 'error';
    id: string;
}

export default function DoctorProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<FileUploadTask[]>([]);

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
    setCropperImage(null);

    try {
      // Create a blob from the base64 cropped image
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
      
      const downloadURL = await new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed', null, reject, async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
          });
      });

      // Non-blocking Firestore update for the photo URL
      const updateData = { photoURL: downloadURL, updatedAt: new Date().toISOString() };
      updateDocumentNonBlocking(doc(firestore, 'doctors', user.uid), updateData);
      updateDocumentNonBlocking(doc(firestore, 'patients', user.uid), updateData);

      toast({
          title: 'Photo Synchronized',
          description: 'Your clinical identity has been updated in the cloud registry.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not sync photo.' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleImmediateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user || !storage || !firestore) return;

    const files = Array.from(e.target.files);
    e.target.value = '';

    for (const file of files) {
        const taskId = Math.random().toString(36).substring(7);
        const newTask: FileUploadTask = { file, progress: 0, status: 'uploading', id: taskId };
        setUploadQueue(prev => [...prev, newTask]);

        try {
            const fileRef = ref(storage, `doctors/${user.uid}/degrees/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadQueue(prev => prev.map(q => q.id === taskId ? { ...q, progress: p } : q));
                },
                (error) => {
                    setUploadQueue(prev => prev.map(q => q.id === taskId ? { ...q, status: 'error' } : q));
                    toast({ variant: 'destructive', title: 'Upload Error', description: `Failed to post ${file.name}` });
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Immediately append to Firestore "Facebook-style"
                    const doctorRef = doc(firestore, 'doctors', user.uid);
                    await updateDoc(doctorRef, {
                        documents: arrayUnion(url),
                        updatedAt: new Date().toISOString()
                    });

                    setExistingDocs(prev => [...prev, url]);
                    setUploadQueue(prev => prev.filter(q => q.id !== taskId));
                    toast({ title: 'Degree Posted!', description: `${file.name} is now in your portfolio.` });
                }
            );
        } catch (e) {
            console.error("Upload process failed", e);
        }
    }
  };

  const removeDegree = async (url: string) => {
    if (!firestore || !user) return;
    try {
        const doctorRef = doc(firestore, 'doctors', user.uid);
        await updateDoc(doctorRef, {
            documents: arrayRemove(url),
            updatedAt: new Date().toISOString()
        });
        setExistingDocs(prev => prev.filter(u => u !== url));
        toast({ title: 'Entry Removed', description: 'Degree has been deleted from your professional registry.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Action Failed' });
    }
  };

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        toast({ title: "Audit Passed", description: "Email verified. Profile edits are now unlocked." });
      } else {
          toast({ title: "Email Not Verified", description: "Please confirm the link in your inbox." });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'System Error', description: 'Failed to sync verification status.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const doctorData = {
            ...values,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            email: user.email || '',
            profileComplete: true,
            updatedAt: new Date().toISOString(),
        };

        const patientData = { 
            profileComplete: true, 
            updatedAt: new Date().toISOString(),
            phone: values.phone,
            firstName: userData?.firstName,
            lastName: userData?.lastName
        };

        setDocumentNonBlocking(doc(firestore, 'doctors', user.uid), doctorData, { merge: true });
        setDocumentNonBlocking(doc(firestore, 'patients', user.uid), patientData, { merge: true });

        toast({ title: 'Information Saved!', description: 'Your professional details have been synchronized.' });
        if (!userData?.profileComplete) {
            router.push('/doctor-portal');
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Save Error" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex min-h-screen items-center justify-center bg-secondary/10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <main className="flex-grow bg-secondary/30 py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">Professional Registry</h1>
                    <p className="text-muted-foreground">Manage your credentials and clinical presence.</p>
                </div>
                {isVerified && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 h-8 gap-1.5 px-3">
                        <BadgeCheck className="h-4 w-4" /> Verified Professional
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden h-fit">
                        <CardContent className="pt-8 text-center">
                            <Avatar className="h-32 w-32 mx-auto mb-6 border-4 border-background shadow-xl">
                                <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} className="object-cover" />
                                <AvatarFallback className="text-4xl bg-primary/5 text-primary">{userData?.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className='relative inline-block'>
                                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold border-2">
                                    <label htmlFor="picture-upload" className="cursor-pointer">
                                    {isUploadingPhoto ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : "Update Photo"}
                                    </label>
                                </Button>
                                <Input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploadingPhoto || isSubmitting} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl p-6">
                        <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-400 mb-4">Registry Summary</h4>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Highest Qualification</p>
                                <p className="text-sm font-bold truncate">{form.getValues('degree') || 'Not verified'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Medical School</p>
                                <p className="text-xs text-slate-300 italic truncate">{form.getValues('medicalSchool') || 'Registry pending'}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b px-6 py-6">
                            <CardTitle className="text-xl">Professional Portfolio</CardTitle>
                            <CardDescription>Documents are stored in Portal Storage for admin verification.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                             {existingDocs.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {existingDocs.map((url, idx) => {
                                        const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('image');
                                        return (
                                            <div key={idx} className="relative group">
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                                    <Card className="overflow-hidden border-2 rounded-2xl hover:border-primary/40 transition-all shadow-sm bg-muted/20">
                                                        <div className="relative aspect-video flex items-center justify-center">
                                                            {isImage ? (
                                                                <Image src={url} alt={`Degree ${idx + 1}`} fill className="object-cover" />
                                                            ) : (
                                                                <FileText className="h-10 w-10 text-primary/20" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-white flex items-center justify-between">
                                                            <span className="text-[9px] font-bold uppercase truncate pr-2">Evidence-File-{idx + 1}</span>
                                                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                        </div>
                                                    </Card>
                                                </a>
                                                <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeDegree(url)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-3xl bg-muted/5">
                                    <CloudUpload className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground italic font-medium">Your professional portfolio is currently empty.</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Attach New Clinical Credentials</p>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-3xl cursor-pointer bg-slate-50 hover:bg-slate-100 border-slate-200 transition-all">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Plus className="w-8 h-8 mb-2 text-primary" />
                                        <p className="text-sm text-slate-500 font-bold">Post to Portfolio</p>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Support for JPG, PNG, PDF (Up to 500MB)</p>
                                    </div>
                                    <Input type="file" multiple className="hidden" onChange={handleImmediateFileUpload} accept="image/*,.pdf" />
                                </label>

                                {uploadQueue.length > 0 && (
                                    <div className="space-y-3">
                                        {uploadQueue.map((item) => (
                                            <div key={item.id} className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        <span className="text-xs font-bold truncate max-w-[200px]">{item.file.name}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-primary">{Math.round(item.progress)}%</span>
                                                </div>
                                                <Progress value={item.progress} className="h-1.5" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b px-6 py-6">
                            <CardTitle className="text-xl">Clinical Audit Data</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {!isEmailVerified && (
                                <Alert variant="destructive" className="mb-8 rounded-2xl">
                                    <AlertTitle className="font-bold">Email Verification Required</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center gap-4">
                                        <span className="text-xs">Security policy: Please verify your clinical email to unlock full portal access.</span>
                                        <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing} className="bg-white border-destructive text-destructive font-bold h-8 rounded-lg shrink-0">
                                            Sync Status
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <FormField control={form.control} name="specialty" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Practice Years</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical University</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="degree" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Highest Qualification</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <FormField control={form.control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Clinical Phone</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="location" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Clinic Hub City</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>

                                    <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={isSubmitting || !isEmailVerified}>
                                        {isSubmitting ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Synchronizing...</> : "Update Registry Data"}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        <ImageCropperDialog isOpen={!!cropperImage} onOpenChange={(isOpen) => !isOpen && setCropperImage(null)} imageSrc={cropperImage} onSave={handleSaveCroppedImage} />
      </main>
  );
}
