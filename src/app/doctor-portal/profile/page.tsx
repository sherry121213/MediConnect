'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const profileSchema = z.object({
  specialty: z.string().min(2, 'Specialty is required.'),
  experience: z.coerce.number().min(0, 'Experience must be a positive number.'),
  medicalSchool: z.string().min(2, 'Medical school is required.'),
  degree: z.string().min(2, 'Degree is required.'),
  contact: z.string().min(10, 'Please enter a valid contact number.').max(11, 'Contact number cannot exceed 11 digits.'),
  location: z.string().min(3, 'Clinic location is required.'),
  degreeUrl: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
        const docSnap = await getDoc(doctorDocRef);
        const isCompletingProfile = !docSnap.data()?.profileComplete;

        const dataToSet = {
            specialty: values.specialty,
            experience: values.experience,
            medicalSchool: values.medicalSchool,
            degree: values.degree,
            phone: values.contact,
            location: values.location,
            degreeUrl: values.degreeUrl,
            profileComplete: true,
            updatedAt: new Date().toISOString(),
        };

        setDocumentNonBlocking(doctorDocRef, dataToSet, { merge: true });

        if (isCompletingProfile) {
            router.push('/doctor-portal');
        } else {
            toast({
                title: 'Profile Updated!',
                description: 'Your professional information has been successfully updated.',
            });
        }
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Uh oh! Something went wrong.",
            description: "Could not load existing profile data. Please try again."
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
                      <FormLabel>Degree/Certificate</FormLabel>
                      <FormControl>
                         <div className="flex items-center gap-4">
                           <div className='relative'>
                              <Button asChild variant="outline">
                                <label htmlFor="degree-upload" className="cursor-pointer">
                                  {isUploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>) : "Upload Document"}
                                </label>
                              </Button>
                              <Input
                                id="degree-upload"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                    if (!e.target.files || e.target.files.length === 0) return;
                                    const file = e.target.files[0];
                                     if (file.size > 1024 * 1024) { // 1MB limit
                                          toast({
                                              variant: 'destructive',
                                              title: 'File is too large',
                                              description: "The application's stability depends on files being smaller than 1MB.",
                                          });
                                          e.target.value = '';
                                          return;
                                      }
                                    setIsUploading(true);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        form.setValue('degreeUrl', reader.result as string);
                                        setIsUploading(false);
                                    };
                                    reader.readAsDataURL(file);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                              />
                            </div>
                            {form.getValues('degreeUrl') && (
                                <div className="text-sm text-muted-foreground">
                                    {form.getValues('degreeUrl')?.startsWith('data:image') ? 'Image ready for upload.' : 'PDF ready for upload.'}
                                </div>
                            )}
                        </div>
                      </FormControl>
                      <FormMessage />
                       {form.getValues('degreeUrl') && form.getValues('degreeUrl')?.startsWith('data:image') && (
                          <div className="relative w-48 h-32 border rounded-md overflow-hidden mt-2">
                            <Image src={form.getValues('degreeUrl')!} alt="Degree preview" fill style={{objectFit: "contain"}} />
                          </div>
                      )}
                    </FormItem>
                  )}
                />


                <Button type="submit" className="w-full" disabled={isSubmitting || isUploading}>
                  {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save and Continue
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
  );
}
