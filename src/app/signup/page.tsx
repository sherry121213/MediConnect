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
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { preverifiedDoctors, adminEmails } from "@/lib/auth-config";

const signupSchema = z.object({
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters.' }).regex(/^[^\d]*$/, { message: "First name cannot contain numbers." }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters.' }).regex(/^[^\d]*$/, { message: "Last name cannot contain numbers." }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).max(32, { message: 'Password cannot exceed 32 characters.' }),
  role: z.enum(['patient', 'doctor']),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    if (!isUserLoading && user && userData) {
      if (userData.role === 'admin') {
        router.replace('/admin');
      } else if (userData.role === 'doctor') {
        router.replace('/doctor-portal');
      } else if (userData.role === 'patient') {
        router.replace('/patient-portal');
      } else {
        router.replace('/'); 
      }
    }
  }, [user, userData, isUserLoading, router]);


  async function onSubmit(values: SignupFormValues) {
    const { firstName, lastName, email, password, role } = values;
    if (!auth || !firestore) return;
    setLoading(true);
    
    const lowercasedEmail = email.toLowerCase();
    const adminEmailsLower = adminEmails.map(e => e.toLowerCase());

    if (adminEmailsLower.includes(lowercasedEmail)) {
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
        setDocumentNonBlocking(adminDocRef, adminDocData, { merge: true });

        // CRITICAL: Register in roles_admin for Firestore Security Rules
        const roleDocRef = doc(firestore, 'roles_admin', newUser.uid);
        setDocumentNonBlocking(roleDocRef, { active: true }, { merge: true });

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
              description: "Please log in.",
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
        const preverifiedKey = Object.keys(preverifiedDoctors).find(k => k.toLowerCase() === lowercasedEmail);
        const preverifiedData = preverifiedKey ? preverifiedDoctors[preverifiedKey] : null;
        const isPreverified = !!preverifiedData;

        const doctorData = {
          ...baseUserData,
          verified: isPreverified,
          profileComplete: isPreverified,
          isActive: true, 
          role: 'doctor',
          ...(preverifiedData && {
              specialty: preverifiedData.specialty,
              experience: preverifiedData.experience,
              medicalSchool: preverifiedData.medicalSchool,
              degree: preverifiedData.degree,
              phone: preverifiedData.phone,
              location: preverifiedData.location,
              documents: preverifiedData.degreeUrl ? [preverifiedData.degreeUrl] : [],
          })
        };
        const doctorDocRef = doc(firestore, 'doctors', newUser.uid);
        setDocumentNonBlocking(doctorDocRef, doctorData, { merge: true });

        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, {
            ...baseUserData, 
            role: 'doctor', 
            profileComplete: isPreverified,
            verified: isPreverified
        }, { merge: true });
        
      } else { 
        const patientData = {...baseUserData, role: 'patient', profileComplete: false };
        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, patientData, { merge: true });
      }
      
      toast({
        title: "Account Created!",
        description: "A verification link has been sent to your email.",
      });

      if (role === 'doctor') {
        router.push('/doctor-portal');
      } else {
        router.push('/patient-portal');
      }

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({
              variant: "destructive",
              title: "Email Already Registered",
              description: "This email is already in use.",
            });
        } else {
            toast({
              variant: "destructive",
              title: "Sign Up Failed",
              description: error.message || "Could not create account.",
            });
        }
    } finally {
        setLoading(false);
    }
  };

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
        <Card className="mx-auto max-w-sm w-full">
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
                         <div className="relative">
                            <Input 
                                type={showPassword ? "text" : "password"} 
                                {...field} 
                                disabled={loading} 
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                        </div>
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
