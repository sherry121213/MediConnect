'use client';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth, useFirestore, useUserData } from "@/firebase";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "firebase/auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const signupSchema = z.object({
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters.' }).regex(/^[^\d]*$/, { message: "First name cannot contain numbers." }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters.' }).regex(/^[^\d]*$/, { message: "Last name cannot contain numbers." }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['patient', 'doctor']),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const preverifiedDoctors: Record<string, any> = {
    'doc1@gmail.com': {
        specialty: 'Cardiology',
        experience: 15,
        medicalSchool: 'King Edward Medical University',
        degree: 'MBBS, FCPS',
        phone: '0300-1234567',
        location: 'Islamabad',
        degreeUrl: '',
    },
    'doc2@gmail.com': {
        specialty: 'Dermatology',
        experience: 8,
        medicalSchool: 'Aga Khan University',
        degree: 'MBBS, MCPS',
        phone: '0301-2345678',
        location: 'Karachi',
        degreeUrl: '',
    },
    'doc3@gmail.com': {
        specialty: 'General Physician',
        experience: 12,
        medicalSchool: 'Dow University of Health Sciences',
        degree: 'MBBS',
        phone: '0302-3456789',
        location: 'Lahore',
        degreeUrl: '',
    },
    'doc4@gmail.com': {
        specialty: 'Gynecologist',
        experience: 10,
        medicalSchool: 'Fatima Jinnah Medical University',
        degree: 'MBBS, FCPS',
        phone: '0303-4567890',
        location: 'Lahore',
        degreeUrl: '',
    },
    'doc5@gmail.com': {
        specialty: 'Orthopedics',
        experience: 7,
        medicalSchool: 'Services Institute of Medical Sciences',
        degree: 'MBBS',
        phone: '0304-5678901',
        location: 'Peshawar',
        degreeUrl: '',
    },
    'doc6@gmail.com': {
        specialty: 'Psychiatrist',
        experience: 9,
        medicalSchool: 'Rawalpindi Medical University',
        degree: 'MBBS, FCPS (Psychiatry)',
        phone: '0305-6789012',
        location: 'Rawalpindi',
        degreeUrl: '',
    },
    'doc7@gmail.com': {
        specialty: 'Cardiology',
        experience: 20,
        medicalSchool: 'National University of Medical Sciences',
        degree: 'MBBS, MRCP',
        phone: '0306-7890123',
        location: 'Islamabad',
        degreeUrl: '',
    },
    'doc8@gmail.com': {
        specialty: 'General Physician',
        experience: 5,
        medicalSchool: 'Shifa College of Medicine',
        degree: 'MBBS',
        phone: '0307-8901234',
        location: 'Islamabad',
        degreeUrl: '',
    },
    'doc9@gmail.com': {
        specialty: 'Dermatology',
        experience: 11,
        medicalSchool: 'Ziauddin University',
        degree: 'MBBS, FCPS',
        phone: '0308-9012345',
        location: 'Karachi',
        degreeUrl: '',
    },
    'doc10@gmail.com': {
        specialty: 'Gynecologist',
        experience: 14,
        medicalSchool: 'Allama Iqbal Medical College',
        degree: 'MBBS, MRCOG',
        phone: '0309-0123456',
        location: 'Lahore',
        degreeUrl: '',
    }
};

const adminEmails = ['admin@mediconnect.com', 'falakali1470@gmail.com'];

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userData, isUserLoading } = useUserData();
  
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'patient',
    },
  });

  // Redirect if user is already logged in
  useEffect(() => {
    if (!isUserLoading && user && userData) {
      if (userData.role === 'admin') {
        router.replace('/admin');
      } else if (userData.role === 'doctor') {
        router.replace('/doctor-portal');
      } else if (userData.role === 'patient') {
        router.replace('/patient-portal');
      } else {
        router.replace('/'); // Fallback to home
      }
    }
  }, [user, userData, isUserLoading, router]);


  async function onSubmit(values: SignupFormValues) {
    const { firstName, lastName, email, password, role } = values;
    if (!auth || !firestore) return;
    setLoading(true);
    
    // Special handling for pre-configured admin users
    if (adminEmails.includes(email)) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        const displayName = email === 'admin@mediconnect.com' ? 'Admin User' : 'Falak Ali';
        const adminFirstName = email === 'admin@mediconnect.com' ? 'Admin' : 'Falak';
        const adminLastName = email === 'admin@mediconnect.com' ? 'User' : 'Ali';


        await updateProfile(newUser, {
          displayName: displayName
        });

        const adminDocData = {
          id: newUser.uid,
          firstName: adminFirstName,
          lastName: adminLastName,
          email: newUser.email,
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          profileComplete: true,
        };

        const adminDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(adminDocRef, adminDocData);

        toast({
          title: 'Admin Account Created',
          description: 'Redirecting to the admin dashboard.',
        });
        router.push('/admin');
        return;
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({
              title: "Admin Account Exists",
              description: "Please log in, or use the 'Forgot your password?' link on the login page to reset it.",
            });
            router.push('/login');
        } else {
             toast({
              variant: "destructive",
              title: "Admin Creation Failed",
              description: error.message,
            });
        }
        setLoading(false);
        return;
      }
    }


    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await sendEmailVerification(newUser);

      await updateProfile(newUser, {
          displayName: `${firstName} ${lastName}`
      });

      const baseUserData = {
          id: newUser.uid,
          firstName,
          lastName,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
      }
      
      if (role === 'doctor') {
        const preverifiedData = preverifiedDoctors[email];

        const doctorData = {
          ...baseUserData,
          verified: !!preverifiedData,
          profileComplete: !!preverifiedData,
          role: 'doctor',
          ...(preverifiedData && {
              specialty: preverifiedData.specialty,
              experience: preverifiedData.experience,
              medicalSchool: preverifiedData.medicalSchool,
              degree: preverifiedData.degree,
              phone: preverifiedData.phone,
              location: preverifiedData.location,
              degreeUrl: preverifiedData.degreeUrl,
          })
        };
        const doctorDocRef = doc(firestore, 'doctors', newUser.uid);
        setDocumentNonBlocking(doctorDocRef, doctorData);

        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, {...baseUserData, role: 'doctor' });
        
      } else { // Patient role
        const patientData = {...baseUserData, role: 'patient', profileComplete: false };
        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, patientData);
      }
      
      await signOut(auth);
      router.push('/verify-email');

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({
              variant: "destructive",
              title: "Email Already Registered",
              description: (
                <span>
                  This email is already in use. Please{' '}
                  <Link href="/login" className="underline font-bold">
                    log in
                  </Link>{' '}
                  instead.
                </span>
              ),
            });
        } else {
            toast({
              variant: "destructive",
              title: "Sign Up Failed",
              description: error.message || "Could not create account. Please try again.",
            });
        }
    } finally {
        setLoading(false);
    }
  };

  // Show loading screen while checking auth status or if user is logged in
  if (isUserLoading || user) {
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex items-center justify-center py-12 px-4 bg-secondary/30">
        <Card className="mx-auto max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
            <CardDescription>
              Enter your information to create a new account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Max" {...field} disabled={loading} />
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
                          <Input placeholder="Robinson" {...field} disabled={loading} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="m@example.com" {...field} disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>I am a...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                          disabled={loading}
                        >
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value="patient" id="role-patient" />
                            </FormControl>
                            <FormLabel htmlFor="role-patient" className="font-normal">Patient</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value="doctor" id="role-doctor" />
                            </FormControl>
                            <FormLabel htmlFor="role-doctor" className="font-normal">Doctor</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create an account
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
