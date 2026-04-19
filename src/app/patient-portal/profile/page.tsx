'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser, useUserData } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ImageCropperDialog from '@/components/ImageCropperDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Last name is required.'),
  email: z.string().email('Please enter a valid email.').optional(),
  phone: z.string().min(10, 'Please enter a valid phone number.').max(11, 'Phone number cannot exceed 11 digits.'),
  dateOfBirth: z.date({
    required_error: 'A date of birth is required.',
  }),
  address: z.string().min(5, 'Address is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function PatientProfilePage() {
  const { user, isUserLoading } = useUser();
  const { userData } = useUserData();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pageTitle, setPageTitle] = useState('Complete Your Profile');
  const [pageDescription, setPageDescription] = useState("We need a few more details to set up your account.");
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  const isEmailVerified = !!user?.emailVerified;

  useEffect(() => {
    if (user && firestore) {
      form.setValue('email', user.email || '');
      const fetchPatientProfile = async () => {
        const patientDocRef = doc(firestore, 'patients', user.uid);
        const docSnap = await getDoc(patientDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          form.reset({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || user.email || '',
            phone: data.phone || '',
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            address: data.address || '',
          });
           if (data.profileComplete) {
            setPageTitle("Edit Your Profile");
            setPageDescription("Keep your personal information up to date.");
          }
        }
      };
      fetchPatientProfile();
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

    const patientDocRef = doc(firestore, 'patients', user.uid);
    setDocumentNonBlocking(patientDocRef, { photoURL: croppedImage }, { merge: true });

    if (userData?.role === 'doctor') {
      const doctorDocRef = doc(firestore, 'doctors', user.uid);
      setDocumentNonBlocking(doctorDocRef, { photoURL: croppedImage }, { merge: true });
    }

    toast({
      title: 'Profile Picture Updated',
      description: 'Your new photo is being saved.',
    });
    
    setTimeout(() => {
        setIsUploading(false);
    }, 2000); 
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
          description: "Your email has been successfully verified.",
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
        description: 'Failed to refresh account status.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };


  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to update your profile.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      const patientDocRef = doc(firestore, 'patients', user.uid);
      const docSnap = await getDoc(patientDocRef);
      const isCompletingProfile = !docSnap.data()?.profileComplete;

      await updateProfile(user, {
        displayName: `${values.firstName} ${values.lastName}`,
      });

      const dataToSet = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth.toISOString(),
        address: values.address,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      };
      
      setDocumentNonBlocking(patientDocRef, dataToSet, { merge: true });

      if (isCompletingProfile) {
        toast({
          title: 'Profile Complete!',
          description: "Thank you! Your profile has been set up.",
        });
        router.push('/patient-portal');
      } else {
        toast({
          title: 'Profile Updated!',
          description: 'Your information has been successfully updated.',
        });
      }

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh!',
        description: 'Could not update your profile. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
      <main className="flex-grow flex items-center justify-center bg-secondary/30 py-12 px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isEmailVerified && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Verify Your Email Address</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <span>You must verify your email to submit your profile.</span>
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <Button 
                                variant="link" 
                                onClick={handleResendVerification} 
                                disabled={isResending}
                                className="p-0 h-auto"
                            >
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
                    <Input
                        id="picture-upload"
                        type="file"
                        accept="image/*"
                        onChange={handlePictureChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploading}
                    />
                </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="grid md:grid-cols-2 gap-6">
                   <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="0300-1234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date of Birth</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                defaultMonth={field.value || new Date(new Date().setFullYear(new Date().getFullYear() - 25))}
                                captionLayout="dropdown"
                                fromYear={new Date().getFullYear() - 80}
                                toYear={new Date().getFullYear() - 10}
                                disabled={(date) =>
                                  date > new Date(new Date().setFullYear(new Date().getFullYear() - 10)) || date < new Date(new Date().setFullYear(new Date().getFullYear() - 80))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="123, Street Name, City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <Button type="submit" className="w-full" disabled={isSubmitting || isUploading || !isEmailVerified}>
                  {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Information
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
