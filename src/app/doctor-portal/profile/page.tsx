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
import { Loader2, BadgeCheck, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
    setIsSubmitting(true);

    try {
        const timestamp = new Date().toISOString();
        const doctorData = {
            ...values,
            firstName: userData?.firstName || '',
            lastName: userData?.lastName || '',
            email: user.email || '',
            profileComplete: true,
            updatedAt: timestamp,
        };

        const patientData = { 
            profileComplete: true, 
            updatedAt: timestamp,
            phone: values.phone,
            firstName: userData?.firstName,
            lastName: userData?.lastName
        };

        setDocumentNonBlocking(doc(firestore, 'doctors', user.uid), doctorData, { merge: true });
        setDocumentNonBlocking(doc(firestore, 'patients', user.uid), patientData, { merge: true });

        toast({ title: 'Registry Updated', description: 'Professional data persisted successfully.' });
        if (!userData?.profileComplete) {
            router.push('/doctor-portal');
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Persistence Error" });
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
                    <p className="text-muted-foreground text-sm">Manage your credentials and clinical presence.</p>
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
                        <CardContent className="pt-8 text-center space-y-6">
                            <div className="relative group mx-auto w-32 h-32">
                                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                                    <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} className="object-cover" />
                                    <AvatarFallback className="text-4xl bg-primary/5 text-primary">{userData?.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                {isUploadingPhoto && (
                                    <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white p-4">
                                        <p className="text-[10px] font-bold uppercase mb-1">{Math.round(photoProgress)}%</p>
                                        <Progress value={photoProgress} className="h-1" />
                                    </div>
                                )}
                            </div>
                            <div className='relative inline-block'>
                                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold border-2" disabled={isUploadingPhoto}>
                                    <label htmlFor="picture-upload" className="cursor-pointer">
                                    {isUploadingPhoto ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>) : "Post New Photo"}
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
                                <p className="text-sm font-bold truncate">{form.getValues('degree') || 'Pending'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] uppercase font-bold text-slate-500 tracking-widest">Medical School</p>
                                <p className="text-xs text-slate-300 italic truncate">{form.getValues('medicalSchool') || 'Registry needed'}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b px-6 py-6">
                            <CardTitle className="text-xl">Clinical Audit Data</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {!isEmailVerified && (
                                <Alert variant="destructive" className="mb-8 rounded-2xl">
                                    <AlertTitle className="font-bold">Email Verification Required</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center gap-4">
                                        <span className="text-xs">Please verify your clinical email to unlock full portal access.</span>
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

                                    <Button type="submit" className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20" disabled={isSubmitting || !isEmailVerified || isUploadingPhoto}>
                                        {isSubmitting ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Updating...</> : "Finalize Profile Registry"}
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
