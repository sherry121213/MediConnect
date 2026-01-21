'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { useState, useEffect } from 'react';
import Image from 'next/image';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Degree is required.'),
  contact: z.string().min(10, 'Please enter a valid contact number.'),
  location: z.string().min(3, 'Clinic location is required.'),
  degreeUrl: z.string().url({ message: "Please provide a valid URL." }).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageTitle, setPageTitle] = useState('Complete Your Professional Profile');
  const [pageDescription, setPageDescription] = useState('Please provide your details to get your profile verified by our team.');


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialty: '',
      experience: 0,
      medicalSchool: '',
      degree: '',
      contact: '',
      location: '',
      degreeUrl: '',
    },
  });

  const watchedDegreeUrl = form.watch('degreeUrl');

  useEffect(() => {
    if (user && firestore) {
      const fetchDoctorProfile = async () => {
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
            degreeUrl: data.degreeUrl || '',
          });
          if (data.profileComplete) {
            setPageTitle("Edit Your Professional Profile");
            setPageDescription("Keep your professional information up to date.");
          }
        }
      };
      fetchDoctorProfile();
    }
  }, [user, firestore, form]);

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
      const doctorDocRef = doc(firestore, 'doctors', user.uid);
      
      const isCompletingProfile = !((await getDoc(doctorDocRef)).data()?.profileComplete);

      await setDoc(doctorDocRef, {
        specialty: values.specialty,
        experience: values.experience,
        medicalSchool: values.medicalSchool,
        degree: values.degree,
        phone: values.contact,
        location: values.location,
        degreeUrl: values.degreeUrl,
        profileComplete: true, 
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if(isCompletingProfile) {
        toast({
          title: 'Profile Submitted!',
          description: 'Your profile is now under review. You will be notified once it is approved.',
          duration: 5000,
        });
        router.push('/');
      } else {
         toast({
          title: 'Profile Updated!',
          description: 'Your professional information has been successfully updated.',
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex items-center justify-center bg-secondary/30 py-12">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialty</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Cardiology" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="medicalSchool"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medical School / University</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., King Edward Medical University" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="degree"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Degree(s)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., MBBS, FCPS" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="contact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 0300-1234567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinic Location</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Blue Area, Islamabad" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
                 
                 <FormField
                    control={form.control}
                    name="degreeUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Degree/Certificate URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/degree.jpg" {...field} />
                        </FormControl>
                        <FormDescription>
                          Upload your document to a file hosting service and paste the public link here.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                
                {watchedDegreeUrl && (
                    <div className="mt-4">
                        <p className="font-medium text-sm mb-2">Image Preview:</p>
                        <div className="relative w-full max-w-sm h-64 border rounded-md overflow-hidden">
                           <Image src={watchedDegreeUrl} alt="Degree preview" fill style={{objectFit:"contain"}} />
                        </div>
                    </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save and Continue
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
