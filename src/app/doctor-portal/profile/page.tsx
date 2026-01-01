'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';
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
  degreeFile: z.any().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [degreePreview, setDegreePreview] = useState<string | null>(null);
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
    },
  });

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
          });
          if (data.degreeUrl) {
            setDegreePreview(data.degreeUrl);
          }
           if (data.profileComplete) {
            setPageTitle("Edit Your Professional Profile");
            setPageDescription("Keep your professional information up to date.");
          }
        }
      };
      fetchDoctorProfile();
    }
  }, [user, firestore, form]);


  const handleDegreeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDegreePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setDegreePreview(null);
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
      const doctorDocRef = doc(firestore, 'doctors', user.uid);
      
      let degreeUrl = degreePreview || ''; 

      const isCompletingProfile = !((await getDoc(doctorDocRef)).data()?.profileComplete);

      await setDoc(doctorDocRef, {
        specialty: values.specialty,
        experience: values.experience,
        medicalSchool: values.medicalSchool,
        degree: values.degree,
        phone: values.contact,
        location: values.location,
        degreeUrl: degreeUrl,
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
                    name="degreeFile"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Upload Degree/Certificate</FormLabel>
                        <FormControl>
                            <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-muted-foreground text-sm mb-2">Drag & drop your file here or click to browse</p>
                                <Input 
                                  type="file" 
                                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                  accept="image/*"
                                  onChange={(e) => {
                                      field.onChange(e.target.files);
                                      handleDegreeFileChange(e);
                                  }}
                                />
                            </div>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {degreePreview && (
                    <div className="mt-4">
                        <p className="font-medium text-sm mb-2">Image Preview:</p>
                        <div className="relative w-full max-w-sm h-64 border rounded-md overflow-hidden">
                           <Image src={degreePreview} alt="Degree preview" fill objectFit="contain" />
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
