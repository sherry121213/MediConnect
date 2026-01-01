'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Degree is required.'),
  contact: z.string().min(10, 'Please enter a valid contact number.'),
  location: z.string().min(3, 'Clinic location is required.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function CompleteDoctorProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialty: '',
      experience: 0,
      medicalSchool: '',
      degree: '',
      contact: '',
      location: '',
    },
  });

  const { formState, control } = form;

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to update your profile.',
      });
      return;
    }

    try {
      const doctorDocRef = doc(firestore, 'doctors', user.uid);
      await setDoc(doctorDocRef, {
        specialty: values.specialty,
        experience: values.experience,
        medicalSchool: values.medicalSchool,
        degree: values.degree,
        phone: values.contact,
        location: values.location,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      toast({
        title: 'Profile Updated!',
        description: 'Your professional details have been saved.',
      });
      router.push('/doctor-portal');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh!',
        description: 'Could not update your profile. Please try again.',
      });
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
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Complete Your Professional Profile</CardTitle>
            <CardDescription>
              Please provide your details to continue to the doctor portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={control}
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
                      control={control}
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
                      control={control}
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
                      control={control}
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
                        control={control}
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
                      control={control}
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
                
                <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
                  {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
