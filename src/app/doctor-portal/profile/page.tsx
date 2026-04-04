'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, X, Plus, ExternalLink, RefreshCw, BadgeCheck, GraduationCap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
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
  contact: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic location is required.'),
  documents: z.array(z.string()).default([]),
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
        const MAX_WIDTH = 1200;
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
          0.7
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
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setTick] = useState(0); 
  
  const [existingDocs, setExistingDocs] = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; id: string; status: 'pending' | 'uploading' | 'done' }[]>([]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialty: '',
      experience: 0,
      medicalSchool: '',
      degree: '',
      contact: '',
      location: '',
      documents: [],
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
              contact: data.phone || '',
              location: data.location || '',
              documents: data.documents || [],
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
    setDocumentNonBlocking(doctorDocRef, { photoURL: croppedImage }, { merge: true });

    const patientDocRef = doc(firestore, 'patients', user.uid);
    setDocumentNonBlocking(patientDocRef, { photoURL: croppedImage }, { merge: true });

    toast({
        title: 'Profile Picture Updated',
        description: 'Your new photo is being saved.',
    });

    setTimeout(() => {
        setIsUploading(false);
    }, 2000); 
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
            description: 'Files must be PDF/JPG/PNG and under 5MB.',
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

  const removeExistingDoc = (url: string) => {
    setExistingDocs(prev => prev.filter(d => d !== url));
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setIsResending(true);
    try {
      await sendEmailVerification(user);
      toast({ title: "Verification Email Sent", description: "Check your inbox for the link." });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send verification email.' });
    } finally {
      setIsResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await user.reload();
      setTick(t => t + 1); 
      if (user.emailVerified) {
        toast({ title: "Email Verified", description: "Your email is now verified." });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh status.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore || !storage) return;
    
    setIsSubmitting(true);
    setOverallProgress(0);

    try {
        const newUrls: string[] = [];
        const totalToUpload = uploadQueue.length;
        let completedCount = 0;

        for (const item of uploadQueue) {
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            let fileToUpload: Blob | File = item.file;
            if (item.file.type.startsWith('image/')) {
                fileToUpload = await compressImage(item.file);
            }

            const uniqueName = `${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = ref(storage, `doctors/${user.uid}/documents/${uniqueName}`);
            
            await uploadBytes(fileRef, fileToUpload);
            const url = await getDownloadURL(fileRef);
            
            newUrls.push(url);
            completedCount++;
            setOverallProgress(Math.round((completedCount / totalToUpload) * 100));
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
        }

        const finalDocs = [...existingDocs, ...newUrls];
        
        const dataToSet = {
            ...values,
            documents: finalDocs,
            profileComplete: true,
            updatedAt: new Date().toISOString(),
        };

        const doctorDocRef = doc(firestore, 'doctors', user.uid);
        setDocumentNonBlocking(doctorDocRef, dataToSet, { merge: true });

        const patientDocRef = doc(firestore, 'patients', user.uid);
        setDocumentNonBlocking(patientDocRef, { updatedAt: new Date().toISOString(), profileComplete: true }, { merge: true });

        setUploadQueue([]); 
        setExistingDocs(finalDocs);
        setOverallProgress(100);

        toast({ title: 'Profile Updated!', description: 'Your professional information has been saved.' });
        if (!userData?.profileComplete) {
            router.push('/doctor-portal');
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not save your profile." });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
      <main className="flex-grow bg-secondary/30 py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Professional Profile</h1>
                    <p className="text-muted-foreground">Manage your credentials and clinical information.</p>
                </div>
                {isVerified && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 h-8 gap-1.5 px-3">
                        <BadgeCheck className="h-4 w-4" /> Verified Professional
                    </Badge>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardContent className="pt-6 text-center">
                        <Avatar className="h-32 w-32 mx-auto mb-4 border-4 border-background shadow-sm">
                            <AvatarImage src={userData?.photoURL || undefined} />
                            <AvatarFallback className="text-4xl">{userData?.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className='relative inline-block'>
                            <Button asChild variant="outline" size="sm">
                                <label htmlFor="picture-upload" className="cursor-pointer">
                                {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>) : "Change Photo"}
                                </label>
                            </Button>
                            <Input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading || isSubmitting} />
                        </div>
                        <div className="mt-6 pt-6 border-t text-left space-y-2">
                            <p className="text-sm font-semibold flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> {form.getValues('degree') || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{form.getValues('specialty') || 'Select Specialty'}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Professional Details</CardTitle>
                        <CardDescription>Keep your medical qualifications and contact details up to date.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!isEmailVerified && (
                            <Alert variant="destructive" className="mb-6">
                                <AlertTitle>Verify Your Email</AlertTitle>
                                <AlertDescription className="flex justify-between items-center">
                                    <span>Please verify your email to enable profile edits.</span>
                                    <Button variant="link" onClick={handleRefreshStatus} disabled={isRefreshing} className="p-0 h-auto font-bold text-accent">
                                        Refresh Status
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="specialty" render={({ field }) => (
                                        <FormItem><FormLabel>Specialty</FormLabel><FormControl><Input placeholder="Cardiology" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="experience" render={({ field }) => (
                                        <FormItem><FormLabel>Years Experience</FormLabel><FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                                        <FormItem><FormLabel>Medical School</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="degree" render={({ field }) => (
                                        <FormItem><FormLabel>Degrees (e.g. MBBS, FCPS)</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="contact" render={({ field }) => (
                                        <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="location" render={({ field }) => (
                                        <FormItem><FormLabel>Clinic City/Location</FormLabel><FormControl><Input {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>

                                <div className="space-y-4 border-t pt-6">
                                    <FormLabel className="text-base">Educational Documents & Certifications</FormLabel>
                                    <p className="text-xs text-muted-foreground">Upload multiple degrees or specialized certificates. Admins will review these for verification.</p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {existingDocs.map((url, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="text-xs truncate">Degree/Cert {idx + 1}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeExistingDoc(url)} disabled={isSubmitting}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {uploadQueue.length > 0 && (
                                        <div className="space-y-2 bg-primary/5 p-3 rounded-md border border-primary/10">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">New Documents to Upload:</p>
                                            {uploadQueue.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-2 bg-background border rounded-md">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {item.status === 'uploading' ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Plus className="h-3 w-3 text-green-600" />}
                                                        <span className="text-xs truncate">{item.file.name}</span>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFileFromQueue(item.id)} disabled={isSubmitting}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!isSubmitting && (
                                        <div className="relative">
                                            <Button type="button" variant="outline" className="w-full border-dashed py-8 bg-muted/5 hover:bg-muted/10" asChild>
                                                <label htmlFor="multi-doc-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                                    <Plus className="h-6 w-6 text-primary" /> 
                                                    <span className="text-sm">Click to add degrees or certificates</span>
                                                    <span className="text-[10px] text-muted-foreground">PDF, JPG, PNG (Max 5MB per file)</span>
                                                </label>
                                            </Button>
                                            <Input id="multi-doc-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelection} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isSubmitting} />
                                        </div>
                                    )}
                                </div>

                                {isSubmitting && uploadQueue.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span>Uploading Documents...</span>
                                            <span>{overallProgress}%</span>
                                        </div>
                                        <Progress value={overallProgress} className="h-2" />
                                    </div>
                                )}

                                <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isSubmitting || isUploading || !isEmailVerified}>
                                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...</> : "Save Professional Profile"}
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