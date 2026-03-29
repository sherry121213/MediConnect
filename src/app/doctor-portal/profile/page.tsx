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
import { Loader2, FileText, X, Plus, ExternalLink, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Degree is required.'),
  contact: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic location is required.'),
  documents: z.array(z.string()).default([]),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pageTitle, setPageTitle] = useState('Complete Your Professional Profile');
  const [pageDescription, setPageDescription] = useState('Please provide your details to get your profile verified by our team.');
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
            if (data.profileComplete) {
              setPageTitle("Edit Your Professional Profile");
              setPageDescription("Keep your professional information up to date.");
            }
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
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    
    if (validFiles.length < files.length) {
        toast({
            variant: 'destructive',
            title: 'Invalid Files Detected',
            description: 'Only PDF, JPG, and PNG files are allowed.',
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
      toast({
        title: "Verification Email Sent",
        description: "A new verification link has been sent to your email address.",
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send verification email. Please try again later.'
      });
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
        toast({
          title: "Email Verified",
          description: "Thank you! Your email has been verified.",
        });
      } else {
        toast({
          title: "Still Not Verified",
          description: "Please check your inbox and click the verification link before refreshing.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to refresh account status. Please try logging in again.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore || !storage) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection error.' });
      return;
    }
    
    setIsSubmitting(true);

    try {
        // 1. Parallelize uploads for much faster performance
        const uploadPromises = uploadQueue.map(async (item) => {
            if (item.status === 'done') return null;

            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            const uniqueName = `${Date.now()}_${Math.floor(Math.random() * 1000)}_${item.file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = ref(storage, `doctors/${user.uid}/documents/${uniqueName}`);
            
            try {
              await uploadBytes(fileRef, item.file);
              const url = await getDownloadURL(fileRef);
              setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
              return url;
            } catch (err) {
              console.error(`Failed to upload ${item.file.name}`, err);
              throw err;
            }
        });

        const newUrlsResult = await Promise.all(uploadPromises);
        const newUrls = newUrlsResult.filter((url): url is string => url !== null);
        const finalDocs = [...existingDocs, ...newUrls];

        // 2. Use existing userData to avoid extra database fetch
        const isCompletingProfile = !userData?.profileComplete;
        
        // Update Firebase Auth profile if display name is missing
        if (!user.displayName) {
            const firstName = userData?.firstName || 'Doctor';
            const lastName = userData?.lastName || '';
            await updateProfile(user, {
                displayName: `${firstName} ${lastName}`.trim(),
            });
        }

        const dataToSet = {
            specialty: values.specialty,
            experience: values.experience,
            medicalSchool: values.medicalSchool,
            degree: values.degree,
            phone: values.contact,
            location: values.location,
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

        if (isCompletingProfile) {
            router.push('/doctor-portal');
        } else {
            toast({ title: 'Profile Updated!', description: 'Your information has been successfully updated.' });
        }
    } catch (error: any) {
        console.error("Submission error:", error);
        toast({ 
          variant: "destructive", 
          title: "Update Failed", 
          description: "Something went wrong while saving your profile. Please check your internet connection." 
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
      <main className="flex-grow flex items-center justify-center bg-secondary/30 py-12">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
             {!isEmailVerified && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Verify Your Email Address</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <span>You must verify your email to complete your profile.</span>
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <Button variant="link" onClick={handleResendVerification} disabled={isResending} className="p-0 h-auto">
                                {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Resend Link
                            </Button>
                            <span className="text-muted-foreground text-xs">|</span>
                            <Button variant="link" onClick={handleRefreshStatus} disabled={isRefreshing} className="p-0 h-auto font-bold text-accent">
                                {isRefreshing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refresh Status
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex flex-col items-center gap-4 mb-8">
                <Avatar className="h-28 w-28">
                    <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} alt={userData?.displayName || 'User'} />
                    <AvatarFallback className="text-3xl">{userData?.email?.[0].toUpperCase() ?? "U"}</AvatarFallback>
                </Avatar>
                <div className='relative'>
                    <Button asChild variant="outline" size="sm">
                        <label htmlFor="picture-upload" className="cursor-pointer">
                        {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : "Change Picture"}
                        </label>
                    </Button>
                    <Input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="specialty" render={({ field }) => (
                        <FormItem><FormLabel>Specialty</FormLabel><FormControl><Input placeholder="e.g., Cardiology" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="experience" render={({ field }) => (
                        <FormItem><FormLabel>Years of Experience</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                        <FormItem><FormLabel>Medical School / University</FormLabel><FormControl><Input placeholder="e.g., King Edward Medical University" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="degree" render={({ field }) => (
                        <FormItem><FormLabel>Degree(s)</FormLabel><FormControl><Input placeholder="e.g., MBBS, FCPS" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="contact" render={({ field }) => (
                        <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input placeholder="e.g., 0300-1234567" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><FormLabel>Clinic Location</FormLabel><FormControl><Input placeholder="e.g., Blue Area, Islamabad" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                 </div>
                 
                <div className="space-y-4">
                    <FormLabel>Professional Documents (Degrees, Certificates)</FormLabel>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {existingDocs.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-xs truncate">Document {idx + 1}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeExistingDoc(url)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {uploadQueue.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ready to upload:</p>
                            {uploadQueue.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2 border border-dashed rounded-md">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        {item.status === 'uploading' ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                                        <span className="text-xs truncate">{item.file.name}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFileFromQueue(item.id)} disabled={isSubmitting}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <Button type="button" variant="outline" className="w-full border-dashed" asChild>
                            <label htmlFor="multi-doc-upload" className="cursor-pointer flex items-center justify-center gap-2">
                                <Plus className="h-4 w-4" /> Add More Documents
                            </label>
                        </Button>
                        <Input 
                            id="multi-doc-upload" 
                            type="file" 
                            multiple 
                            accept=".pdf,.jpg,.jpeg,.png" 
                            onChange={handleFileSelection} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            disabled={isSubmitting}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Allowed formats: PDF, JPG, PNG. Maximum size per file: 5MB.</p>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting || isUploading || !isEmailVerified}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save and Continue
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
         <ImageCropperDialog
          isOpen={!!cropperImage}
          onOpenChange={(isOpen) => !isOpen && setCropperImage(null)}
          imageSrc={cropperImage}
          onSave={handleSaveCroppedImage}
        />
      </main>
  );
}
