'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ExternalLink, GraduationCap, Eye, BadgeCheck, ShieldAlert, Plus, X, CheckCircle2, CloudUpload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  const [globalProgress, setGlobalProgress] = useState(0);

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
      // Robust Base64 to Blob conversion
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
          uploadTask.on('state_changed', null, 
            (error) => {
                console.error("Photo upload error:", error);
                reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
      });

      const updateData = { photoURL: downloadURL, updatedAt: new Date().toISOString() };
      setDocumentNonBlocking(doc(firestore, 'doctors', user.uid), updateData, { merge: true });
      setDocumentNonBlocking(doc(firestore, 'patients', user.uid), updateData, { merge: true });

      toast({
          title: 'Photo Synchronized',
          description: 'Your clinical identity has been updated in the cloud registry.',
      });
    } catch (error: any) {
      console.error("Image upload failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Upload Failed', 
        description: error.message || 'Check your internet connection and try again.' 
      });
    } finally {
      setIsUploadingPhoto(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files).map(file => ({
            file,
            progress: 0,
            status: 'pending' as const,
            id: Math.random().toString(36).substring(7)
        }));
        setUploadQueue(prev => [...prev, ...files]);
        e.target.value = '';
    }
  };

  const removeQueuedFile = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore || !storage) return;
    
    setIsSubmitting(true);
    setGlobalProgress(0);

    try {
        const newUrls: string[] = [];
        const totalFiles = uploadQueue.length;

        // SEQUENTIAL UPLOAD FOR 500MB STABILITY
        for (let i = 0; i < uploadQueue.length; i++) {
            const item = uploadQueue[i];
            
            // Skip already uploaded or failed ones
            if (item.status === 'done') {
                continue;
            }

            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            const fileRef = ref(storage, `doctors/${user.uid}/degrees/${Date.now()}_${item.file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, item.file);
            
            const url = await new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: p } : q));
                        // Update global progress for the button
                        setGlobalProgress(((i / totalFiles) * 100) + (p / totalFiles));
                    },
                    (error) => {
                        console.error("Storage Error:", error);
                        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
                        reject(error);
                    },
                    async () => {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', progress: 100 } : q));
                        resolve(downloadUrl);
                    }
                );
            });
            newUrls.push(url);
        }

        const updatedDocs = [...existingDocs, ...newUrls];

        const doctorData = {
            ...values,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            email: user.email || '',
            documents: updatedDocs,
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

        // SET-MERGE ensures zero data loss
        setDocumentNonBlocking(doc(firestore, 'doctors', user.uid), doctorData, { merge: true });
        setDocumentNonBlocking(doc(firestore, 'patients', user.uid), patientData, { merge: true });

        toast({ 
            title: 'Registry Updated!', 
            description: `Successfully archived ${newUrls.length} new credentials.` 
        });
        
        setExistingDocs(updatedDocs);
        setUploadQueue([]);
        setGlobalProgress(0);
        
        if (!userData?.profileComplete) {
            router.push('/doctor-portal');
        }
    } catch (error: any) {
        console.error("Submission error:", error);
        toast({ 
            variant: "destructive", 
            title: "Transmission Error", 
            description: "Some clinical assets failed to upload. Check your connection or storage rules." 
        });
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
                <Card className="lg:col-span-1 border-none shadow-xl bg-white rounded-3xl overflow-hidden h-fit">
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
                        <div className="mt-8 pt-8 border-t text-left space-y-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Highest Qualification</p>
                                <p className="text-sm font-bold flex items-center gap-2 mt-1"><GraduationCap className="h-4 w-4 text-primary" /> {form.getValues('degree') || 'Medical Professional'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Primary Specialty</p>
                                <p className="text-xs font-medium text-primary mt-1">{form.getValues('specialty') || 'General Practice'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b px-6 py-6">
                        <CardTitle className="text-xl">Clinical Audit Data</CardTitle>
                        <CardDescription>Ensure your medical records are accurately indexed for verification.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {!isEmailVerified && (
                            <Alert variant="destructive" className="mb-8 rounded-2xl">
                                <AlertTitle className="font-bold">Email Verification Required</AlertTitle>
                                <AlertDescription className="flex justify-between items-center gap-4">
                                    <span className="text-xs">Security policy: Please verify your clinical email to unlock portal access.</span>
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
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Degrees (e.g. MBBS)</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
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

                                <div className="space-y-6 border-t pt-8">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-base font-bold">Clinical Evidence Portfolio</FormLabel>
                                        <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-tighter">{existingDocs.length} Verified Files</Badge>
                                    </div>
                                    
                                    {existingDocs.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {existingDocs.map((url, idx) => {
                                                const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('image');
                                                return (
                                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block group">
                                                        <Card className="overflow-hidden border-2 rounded-2xl hover:border-primary/40 transition-all shadow-sm">
                                                            <div className="relative aspect-video bg-muted/40 flex items-center justify-center border-b">
                                                                {isImage ? (
                                                                    <Image src={url} alt={`Degree ${idx + 1}`} fill className="object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <FileText className="h-10 w-10 text-primary/20" />
                                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Clinical PDF</span>
                                                                    </div>
                                                                )}
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                    <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                                                                </div>
                                                            </div>
                                                            <div className="p-2 flex items-center justify-between bg-white">
                                                                <span className="text-[9px] font-bold uppercase truncate">Registry-Evidence-{idx + 1}</span>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                            </div>
                                                        </Card>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-muted/5 rounded-2xl border-2 border-dashed">
                                            <p className="text-xs text-muted-foreground italic">No professional documents found in your registry profile.</p>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <FormLabel className="text-base font-bold flex items-center gap-2">
                                            <Plus className="h-5 w-5 text-primary" /> Attach Clinical Certification
                                        </FormLabel>
                                        <div className="relative">
                                            <label 
                                                htmlFor="degree-upload" 
                                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-3xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-slate-200"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <CloudUpload className="w-8 h-8 mb-3 text-slate-400" />
                                                    <p className="mb-2 text-sm text-slate-500"><span className="font-bold text-primary">Click to select</span> degrees</p>
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">PDF, JPG, PNG (Max 500MB per file)</p>
                                                </div>
                                                <Input id="degree-upload" type="file" multiple className="hidden" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                        
                                        {uploadQueue.length > 0 && (
                                            <div className="space-y-3 mt-4">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Upload Queue</p>
                                                {uploadQueue.map((item) => (
                                                    <div key={item.id} className="p-4 bg-muted/30 rounded-2xl border flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="p-2 bg-white rounded-lg">
                                                                    <FileText className={cn("h-4 w-4", item.status === 'done' ? "text-green-600" : "text-primary")} />
                                                                </div>
                                                                <span className="text-xs font-bold truncate max-w-[150px]">{item.file.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {item.status === 'done' ? (
                                                                    <Badge className="bg-green-100 text-green-800 border-none text-[8px] h-5 font-bold uppercase">Ready</Badge>
                                                                ) : item.status === 'uploading' ? (
                                                                    <span className="text-[9px] font-bold text-primary animate-pulse uppercase">Transmitting...</span>
                                                                ) : (
                                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeQueuedFile(item.id)}>
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {(item.status === 'uploading' || item.status === 'done') && (
                                                            <Progress value={item.progress} className="h-1" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6">
                                    {isSubmitting && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Transmitting Evidence Assets...</p>
                                                <p className="text-[10px] font-bold">{Math.round(globalProgress)}%</p>
                                            </div>
                                            <Progress value={globalProgress} className="h-2 bg-slate-100" />
                                        </div>
                                    )}
                                    <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={isSubmitting || isUploadingPhoto || !isEmailVerified}>
                                        {isSubmitting ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Finalizing Assets...</> : "Save Professional Profile"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
        <ImageCropperDialog isOpen={!!cropperImage} onOpenChange={(isOpen) => !isOpen && setCropperImage(null)} imageSrc={cropperImage} onSave={handleSaveCroppedImage} />
      </main>
  );
}
