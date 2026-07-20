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
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters.' }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['patient', 'doctor']),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Please select your gender.' }),
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
      gender: 'male',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user && userData) {
      if (userData.role === 'admin') router.replace('/admin');
      else if (userData.role === 'doctor') router.replace('/doctor-portal');
      else if (userData.role === 'patient') router.replace('/patient-portal');
    }
  }, [user, userData, isUserLoading, router]);

  async function onSubmit(values: SignupFormValues) {
    if (!auth || !firestore) return;
    setLoading(true);
    
    const { firstName, lastName, email, password, role, gender } = values;
    const lowercasedEmail = email.toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await sendEmailVerification(newUser);
      await updateProfile(newUser, { displayName: `${firstName} ${lastName}` });

      const timestamp = new Date().toISOString();
      const baseUserData = {
          id: newUser.uid,
          firstName,
          lastName,
          email: lowercasedEmail,
          gender,
          createdAt: timestamp,
          updatedAt: timestamp,
      };
      
      const isAdmin = adminEmails.map(e => e.toLowerCase()).includes(lowercasedEmail);

      if (isAdmin) {
        await setDocumentNonBlocking(doc(firestore, 'patients', newUser.uid), { ...baseUserData, role: 'admin', profileComplete: true, verified: true }, { merge: true });
        router.push('/admin');
      } else if (role === 'doctor') {
        const preverifiedKey = Object.keys(preverifiedDoctors).find(k => k.toLowerCase() === lowercasedEmail);
        const preverifiedData = preverifiedKey ? preverifiedDoctors[preverifiedKey] : null;
        const isPreverified = !!preverifiedData;

        const doctorData = {
          ...baseUserData,
          verified: isPreverified,
          profileComplete: isPreverified,
          isActive: true, 
          role: 'doctor',
          ...(preverifiedData && { ...preverifiedData })
        };
        await setDocumentNonBlocking(doc(firestore, 'doctors', newUser.uid), doctorData, { merge: true });
        await setDocumentNonBlocking(doc(firestore, 'patients', newUser.uid), { ...baseUserData, role: 'doctor', profileComplete: isPreverified, verified: isPreverified }, { merge: true });
        router.push('/doctor-portal');
      } else { 
        await setDocumentNonBlocking(doc(firestore, 'patients', newUser.uid), { ...baseUserData, role: 'patient', profileComplete: false }, { merge: true });
        router.push('/patient-portal');
      }
      
      toast({ title: "Account Created!", description: "Verify your email to continue." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Sign Up Failed", description: error.message });
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-secondary/30">
      <AppHeader />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-8 text-center">
            <CardTitle className="text-2xl font-headline">Registration</CardTitle>
            <CardDescription className="text-slate-400">Join the Precision Clinical network.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Max" {...field} className="h-11 rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Khan" {...field} className="h-11 rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} className="h-11 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} {...field} className="pr-12 h-11 rounded-xl" />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Gender Identity</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-2">
                        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border flex-1 min-w-[80px]">
                          <RadioGroupItem value="male" id="g-male" />
                          <label htmlFor="g-male" className="font-bold text-[10px] cursor-pointer">Male</label>
                        </div>
                        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border flex-1 min-w-[80px]">
                          <RadioGroupItem value="female" id="g-female" />
                          <label htmlFor="g-female" className="font-bold text-[10px] cursor-pointer">Female</label>
                        </div>
                         <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border flex-1 min-w-[80px]">
                          <RadioGroupItem value="other" id="g-other" />
                          <label htmlFor="g-other" className="font-bold text-[10px] cursor-pointer">Other</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Account Role</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-xl border flex-1">
                          <RadioGroupItem value="patient" id="role-patient" />
                          <label htmlFor="role-patient" className="font-bold text-xs cursor-pointer">Patient</label>
                        </div>
                        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-xl border flex-1">
                          <RadioGroupItem value="doctor" id="role-doctor" />
                          <label htmlFor="role-doctor" className="font-bold text-xs cursor-pointer">Doctor</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-12 rounded-xl font-bold shadow-lg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </Form>
            <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="underline font-bold text-primary">Log in</Link></p>
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
