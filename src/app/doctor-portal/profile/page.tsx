'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUserData, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, BadgeCheck, FileText, Upload, ShieldCheck, Trash2, ExternalLink, RefreshCw, Mail, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Primary degree title is required.'),
  phone: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic hub city is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FETCHING DE-COUPLED CREDENTIALS
  const credentialsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'doctorCredentials'), where('doctorId', '==', user.uid));
  }, [firestore, user]);
  const { data: credentials } = useCollection<any>(credentialsQuery);

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
    if (!user || !firestore) return;
    
    setIsSyncing(true);
    setCropperImage(null);

    try {
      const updateData = { photoURL: croppedImage, updatedAt: new Date().toISOString() };
      await setDoc(doc(firestore, 'doctors', user.uid), updateData, { merge: true });
      await setDoc(doc(firestore, 'patients', user.uid), updateData, { merge: true });

      toast({ title: 'Identity Secured', description: 'Profile photo updated.' });
      setIsSyncing(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'System Error', description: 'Could not process photo.' });
      setIsSyncing(false);
    }
  };

  const handleDegreeSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user || !firestore) return;
    
    setIsSyncing(true);
    const files = Array.from(e.target.files);

    for (const file of files) {
        const reader = new FileReader();
        
        await new Promise<void>((resolve) => {
            reader.onload = async (event) => {
                const base64String = event.target?.result as string;
                
                const credentialData = {
                    doctorId: user.uid,
                    fileUrl: base64String, // Storing Base64 directly for instant viewing
                    fileName: file.name,
                    uploadedAt: new Date().toISOString(),
                };
                
                await addDocumentNonBlocking(collection(firestore, 'doctorCredentials'), credentialData);
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    toast({ title: "Clinical Assets Synced", description: `${files.length} degree(s) added to portal.` });
    setIsSyncing(false);
    e.target.value = ''; 
  };

  const removeDoc = async (credId: string) => {
    if (!user || !firestore) return;
    try {
        await deleteDoc(doc(firestore, 'doctorCredentials', credId));
        toast({ title: "Asset Removed" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Removal Failed" });
    }
  };

  const handleRefreshEmailStatus = async () => {
      if (!user) return;
      setIsRefreshing(true);
      try {
          await user.reload();
          if (user.emailVerified) {
              toast({ title: "Email Verified", description: "You can now finalize your professional information." });
          } else {
              toast({ title: "Verification Pending", description: "Please check your inbox." });
          }
      } catch (e) {
          toast({ variant: 'destructive', title: "Error", description: "Could not refresh status." });
      } finally {
          setIsRefreshing(false);
      }
  }

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

        await setDoc(doc(firestore, 'doctors', user.uid), doctorData, { merge: true });
        await setDoc(doc(firestore, 'patients', user.uid), patientData, { merge: true });

        toast({ title: 'Registry Updated', description: 'Your information has been secured.' });
        router.push('/doctor-portal');
    } catch (error) {
        toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const totalUploadedCount = credentials?.length || 0;

  if (isUserLoading) return <div className="flex min-h-screen items-center justify-center bg-secondary/10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <main className="flex-grow bg-secondary/30 py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-primary" /> Professional Identity
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your clinical registry and credential portfolio.</p>
                </div>
                {isVerified ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 h-10 gap-2 px-6 rounded-full font-bold">
                        <BadgeCheck className="h-5 w-5" /> Provider Verified
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 h-10 gap-2 px-6 rounded-full font-bold">
                        <Loader2 className="h-4 w-4 animate-spin" /> Audit Pending
                    </Badge>
                )}
            </div>

            {!isEmailVerified && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <Mail className="h-4 w-4" />
                    <AlertTitle className="font-bold">Email Verification Required</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span>You must verify your email address to save professional information for administrative review.</span>
                        <Button variant="outline" size="sm" onClick={handleRefreshEmailStatus} disabled={isRefreshing} className="bg-white rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                            {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                            Refresh Email Status
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden h-fit">
                        <CardContent className="pt-8 text-center space-y-6">
                            <div className="relative group mx-auto w-36 h-36">
                                <Avatar className="h-36 w-36 border-4 border-background shadow-xl">
                                    <AvatarImage src={userData?.photoURL || user?.photoURL || undefined} className="object-cover" />
                                    <AvatarFallback className="text-5xl bg-primary/5 text-primary">{userData?.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                {isSyncing && (
                                    <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white p-4">
                                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                        <p className="text-[8px] font-bold uppercase">Syncing...</p>
                                    </div>
                                )}
                            </div>
                            <div className='relative inline-block'>
                                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold border-2" disabled={isSyncing}>
                                    <label htmlFor="picture-upload" className="cursor-pointer">
                                    {isSyncing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</>) : "Change Photo"}
                                    </label>
                                </Button>
                                <input id="picture-upload" type="file" accept="image/*" onChange={handlePictureChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isSyncing || isSubmitting} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl p-8 space-y-6">
                        <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-400">Application Progress</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Email Verified</span>
                                {isEmailVerified ? <BadgeCheck className="h-4 w-4 text-green-500" /> : <div className="h-2 w-2 rounded-full bg-slate-700" />}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Info Submitted</span>
                                {userData?.profileComplete ? <BadgeCheck className="h-4 w-4 text-green-500" /> : <div className="h-2 w-2 rounded-full bg-slate-700" />}
                            </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">Admin Approved</span>
                                {isVerified ? <BadgeCheck className="h-4 w-4 text-green-500" /> : <div className="h-2 w-2 rounded-full bg-slate-700" />}
                            </div>
                        </div>
                        <Separator className="bg-slate-800" />
                        <p className="text-[10px] text-slate-500 italic leading-relaxed">
                            MEDICONNECT POLICY: Verification typically takes 12-24 hours. Ensure your details match your clinical credentials.
                        </p>
                    </Card>
                </div>

                <div className="lg:col-span-8 space-y-8">
                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b px-8 py-8">
                            <CardTitle className="text-xl">Professional Information</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <Form {...form}>
                                <form className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="specialty" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical Specialty</FormLabel><FormControl><Input placeholder="e.g. Cardiology" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Years in Practice</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="medicalSchool" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Medical Institution</FormLabel><FormControl><Input placeholder="e.g. Aga Khan University" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="degree" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Highest Qualification</FormLabel><FormControl><Input placeholder="e.g. MBBS, FCPS" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <FormField control={form.control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Clinical Phone</FormLabel><FormControl><Input placeholder="03XXXXXXXXX" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="location" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase font-bold tracking-widest opacity-60">Practice City</FormLabel><FormControl><Input placeholder="e.g. Karachi" {...field} className="h-12 rounded-xl border-2" disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                         <CardHeader className="bg-muted/10 border-b px-8 py-8">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">Degrees & Assets</CardTitle>
                                <Badge className="bg-primary/10 text-primary border-none">{totalUploadedCount} Synced Assets</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2rem] bg-muted/5 group hover:bg-muted/10 transition-colors relative">
                                <Upload className="h-12 w-12 text-muted-foreground/30 mb-4 group-hover:text-primary transition-colors" />
                                <div className="text-center mb-6">
                                    <p className="text-sm font-bold">Attach Professional Evidence</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Images or PDFs</p>
                                </div>
                                
                                <label htmlFor="degree-upload" className="cursor-pointer">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="rounded-xl font-bold border-2 pointer-events-none"
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                        Select Degree Files
                                    </Button>
                                </label>
                                <input 
                                    id="degree-upload"
                                    type="file" 
                                    multiple 
                                    accept="image/*,.pdf" 
                                    className="hidden" 
                                    onChange={handleDegreeSelect}
                                    disabled={isSyncing}
                                />
                            </div>

                            {totalUploadedCount > 0 && (
                                <div className="space-y-4 pt-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Evidence Archive</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {credentials?.map((cred, idx) => (
                                            <div key={cred.id} className="group relative p-3 rounded-2xl border bg-muted/10 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-10 w-10 rounded-xl bg-white border flex items-center justify-center text-primary shrink-0">
                                                        <FileText className="h-5 v-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter truncate">{cred.fileName || `Asset-${idx + 1}`}</p>
                                                        <p className="text-[8px] text-green-600 font-bold uppercase flex items-center gap-1">
                                                            <CheckCircle2 className="h-2 w-2" /> Secured
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button asChild size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary">
                                                        <a href={cred.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => removeDoc(cred.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button 
                        onClick={form.handleSubmit(onSubmit)} 
                        className="w-full h-16 text-lg font-bold rounded-[2rem] shadow-2xl shadow-primary/20" 
                        disabled={isSubmitting || isSyncing || !isEmailVerified}
                    >
                        {isSubmitting ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Finalizing...</> : "Save Professional Information"}
                    </Button>
                    {!isEmailVerified && (
                        <p className="text-center text-[10px] font-bold uppercase text-destructive tracking-widest">
                            Email verification required before submission.
                        </p>
                    )}
                </div>
            </div>
        </div>
        <ImageCropperDialog isOpen={!!cropperImage} onOpenChange={(isOpen) => !isOpen && setCropperImage(null)} imageSrc={cropperImage} onSave={handleSaveCroppedImage} />
      </main>
  );
}
