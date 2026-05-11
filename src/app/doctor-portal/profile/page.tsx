
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, X, Plus, ExternalLink, RefreshCw, BadgeCheck, GraduationCap, ShieldAlert, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfile } from 'firebase/auth';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Primary degree is required.'),
  phone: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic location is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

async function compressImage(file: File): Promise<Blob | File> {
  if (!file.type.startsWith('image/') || file.type.includes('gif')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; // Optimized for clinical readability
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.7 // Higher quality for text-heavy documents
        );
      };
    };
  });
}

export default function DoctorProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; id: string; status: 'pending' | 'uploading' | 'done' }[]>([]);

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
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropperImage(reader.result as string);
      });
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };

  const handleSaveCroppedImage = (croppedImage: string) => {
    if (!user || !firestore) return;
    
    setIsUploading(true);
    setCropperImage(null);

    const doctorDocRef = doc(firestore, 'doctors', user.uid);
    updateDocumentNonBlocking(doctorDocRef, { photoURL: croppedImage, updatedAt: new Date().toISOString() });

    const patientDocRef = doc(firestore, 'patients', user.uid);
    updateDocumentNonBlocking(patientDocRef, { photoURL: croppedImage, updatedAt: new Date().toISOString() });

    toast({
        title: 'Profile Picture Updated',
        description: 'Your photo has been synchronized across the registry.',
    });

    setTimeout(() => {
        setIsUploading(false);
    }, 1000); 
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const validFiles = files.filter(file => {
        const isTypeValid = allowedTypes.includes(file.type);
        const isSizeValid = file.size <= MAX_FILE_SIZE;
        return isTypeValid && isSizeValid;
    });
    
    if (validFiles.length < files.length) {
        toast({
            variant: 'destructive',
            title: 'Files Rejected',
            description: 'Please ensure files are PDF/JPG/PNG and under 5MB.',
        });
    }

    const newEntries = validFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending' as const
    }));

    setUploadQueue(prev => [...prev, ...newEntries]);
    e.target.value = ''; 
  };

  const removeFileFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      if (user.emailVerified) {
        toast({ title: "Email Verified", description: "You now have full profile edit access." });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Status Update Error', description: 'Failed to sync with auth servers.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore || !storage) return;
    
    setIsSubmitting(true);
    setOverallProgress(1); // Immediate movement to show activity
    const progressMap: Record<string, number> = {};

    try {
        const uploadPromises = uploadQueue.map(async (item) => {
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            let fileToUpload: Blob | File = item.file;
            if (item.file.type.startsWith('image/')) {
                fileToUpload = await compressImage(item.file);
            }

            const uniqueName = `${Date.now()}_${item.id}_${item.file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = ref(storage, `doctors/${user.uid}/documents/${uniqueName}`);
            
            // Using Resumable Upload for Granular Progress
            const uploadTask = uploadBytesResumable(fileRef, fileToUpload);

            return new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        progressMap[item.id] = progress;
                        
                        // Weighted Progress Calculation
                        const currentTotal = Object.values(progressMap).reduce((a, b) => a + b, 0);
                        const avg = currentTotal / uploadQueue.length;
                        setOverallProgress(Math.min(95, Math.round(avg)));
                    },
                    (error) => {
                        console.error("Upload error for file:", item.file.name, error);
                        reject(error);
                    },
                    async () => {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
                        resolve(url);
                    }
                );
            });
        });

        const newUrls = await Promise.all(uploadPromises);
        setOverallProgress(98);

        const finalDocs = [...existingDocs, ...newUrls];
        
        const dataToSet = {
            ...values,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            email: user.email || '',
            documents: finalDocs,
            profileComplete: true,
            updatedAt: new Date().toISOString(),
        };

        const doctorDocRef = doc(firestore, 'doctors', user.uid);
        setDocumentNonBlocking(doctorDocRef, dataToSet, { merge: true });

        const patientDocRef = doc(firestore, 'patients', user.uid);
        updateDocumentNonBlocking(patientDocRef, { 
            profileComplete: true, 
            updatedAt: new Date().toISOString(),
            phone: values.phone 
        });

        setUploadQueue([]); 
        setExistingDocs(finalDocs);
        setOverallProgress(100);

        toast({ title: 'Registry Synchronized!', description: 'Your professional credentials have been archived.' });
        if (!userData?.profileComplete) {
            router.push('/doctor-portal');
        }
    } catch (error: any) {
        console.error("Submission error:", error);
        toast({ 
            variant: "destructive", 
            title: "Transmission Failed", 
            description: "Network timeout or quota error. Please check your connection and try again." 
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
                    <h1 className="text-3xl font-bold font-headline">Professional Registry</h1>
                    <p className="text-muted-foreground">Manage your credentials and clinical presence.</p>
                </div>
                {isVerified && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 h-8 gap-1.5 px-3">
                        <BadgeCheck className="h-4 w-4" /> Verified Provider
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                    <CardContent className="pt-8 text-center">
                        <Avatar className="h-32 w-32 mx-auto mb-6 border-4 border-background shadow-xl">
                            <AvatarImage src={userData?.photoURL || undefined} className="object-cover" />
                            <AvatarFallback className="text-4xl bg-primary/5 text-primary">{userData?.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className='relative inline-block'>
                            <Button asChild variant="outline" size="sm" className="rounded-xl font-bold border-2">
                                <label htmlFor="picture-upload" className="cursor-pointer">
                                {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>) : "Update Photo"}
                                </label>
                            </Button>
                            <Input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading || isSubmitting} />
                        </div>
                        <div className="mt-8 pt-8 border-t text-left space-y-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Highest Degree</p>
                                <p className="text-sm font-bold flex items-center gap-2 mt-1"><GraduationCap className="h-4 w-4 text-primary" /> {form.getValues('degree') || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Specialty</p>
                                <p className="text-xs font-medium text-primary mt-1">{form.getValues('specialty') || 'General Practice'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b px-6 py-6">
                        <CardTitle className="text-xl">Clinical Audit Information</CardTitle>
                        <CardDescription>Ensure your medical school records and active contact details are correct.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {!isEmailVerified && (
                            <Alert variant="destructive" className="mb-8 rounded-2xl">
                                <AlertTitle className="font-bold">Email Audit Required</AlertTitle>
                                <AlertDescription className="flex justify-between items-center gap-4">
                                    <span className="text-xs">Access to profile edits is restricted until your clinical email is verified.</span>
                                    <Button variant="outline" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing} className="bg-white border-destructive text-destructive font-bold h-8 rounded-lg shrink-0">
                                        Check Status
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="specialty" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Primary Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="experience" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Years in Practice</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical University</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="degree" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Degrees (e.g. FCPS, MBBS)</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="phone" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Clinical Phone Line</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="location" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Base Hub City</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>

                                <div className="space-y-6 border-t pt-8">
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-base font-bold">Clinical Evidence Portfolio</FormLabel>
                                        <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-tighter">{existingDocs.length + uploadQueue.length} Files</Badge>
                                    </div>
                                    <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
                                        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-amber-800 leading-relaxed italic">
                                            Previously verified degrees are preserved for audit integrity. You can uniquely append new certifications, but historical evidence cannot be removed.
                                        </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {existingDocs.map((url, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border-2 rounded-xl bg-slate-50 group hover:border-primary/20 transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="text-[10px] font-bold uppercase truncate">Credential {idx + 1}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" asChild>
                                                    <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    {uploadQueue.length > 0 && (
                                        <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border-2 border-dashed border-primary/20">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Queue Status:</p>
                                            {uploadQueue.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {item.status === 'uploading' ? (
                                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                        ) : item.status === 'done' ? (
                                                            <Zap className="h-3 w-3 text-green-600 fill-green-600" />
                                                        ) : (
                                                            <Plus className="h-3 w-3 text-slate-400" />
                                                        )}
                                                        <span className={cn("text-xs truncate font-medium", item.status === 'done' && "text-green-600")}>
                                                            {item.file.name}
                                                        </span>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => removeFileFromQueue(item.id)} disabled={isSubmitting || item.status !== 'pending'}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!isSubmitting && (
                                        <div className="relative">
                                            <Button type="button" variant="outline" className="w-full border-2 border-dashed h-24 rounded-2xl bg-muted/5 hover:bg-muted/10 hover:border-primary/40 transition-all" asChild>
                                                <label htmlFor="multi-doc-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                                    <Plus className="h-6 w-6 text-primary" /> 
                                                    <span className="text-sm font-bold">Add Degree/Certificate</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">PDF, JPG, PNG (Max 5MB)</span>
                                                </label>
                                            </Button>
                                            <Input id="multi-doc-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelection} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isSubmitting} />
                                        </div>
                                    )}
                                </div>

                                {isSubmitting && (
                                    <div className="space-y-3 bg-slate-900 p-5 rounded-2xl text-white animate-in slide-in-from-bottom-2">
                                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                            <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-primary" /> Transmitting Clinical Assets</span>
                                            <span>{overallProgress}%</span>
                                        </div>
                                        <Progress value={overallProgress} className="h-1.5 bg-white/10" />
                                        <p className="text-[9px] text-slate-400 italic text-center">Optimizing data streams for rapid synchronization...</p>
                                    </div>
                                )}

                                <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={isSubmitting || isUploading || !isEmailVerified}>
                                    {isSubmitting ? "Finalizing Registry Audit..." : "Save Professional Profile"}
                                </Button>
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
