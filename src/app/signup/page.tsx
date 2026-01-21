'use client';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { doc } from 'firebase/firestore';
import { useFirestore } from "@/firebase";
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setLoading(true);
    
    // Special handling for pre-configured admin user
    if (email === 'admin@mediconnect.com') {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        await updateProfile(newUser, {
          displayName: 'Admin User'
        });

        const adminDocData = {
          id: newUser.uid,
          firstName: 'Admin',
          lastName: 'User',
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
              description: "Please log in with the admin credentials.",
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
        const isPreverifiedDoctor = email === 'doc1@gmail.com';

        const doctorData = {
          ...baseUserData,
          verified: isPreverifiedDoctor,
          profileComplete: isPreverifiedDoctor,
          role: 'doctor',
          ...(isPreverifiedDoctor && {
              specialty: 'Cardiology',
              experience: 15,
              medicalSchool: 'King Edward Medical University',
              degree: 'MBBS, FCPS',
              phone: '0300-1234567',
              location: 'Islamabad',
              degreeUrl: '',
          })
        };
        const doctorDocRef = doc(firestore, 'doctors', newUser.uid);
        setDocumentNonBlocking(doctorDocRef, doctorData);

        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, {...baseUserData, role: 'doctor' });
        
        if (isPreverifiedDoctor) {
            router.push('/doctor-portal');
        } else {
           router.push('/doctor-portal/profile');
        }

      } else { // Patient role
        const patientData = {...baseUserData, role: 'patient', profileComplete: false };
        const patientDocRef = doc(firestore, 'patients', newUser.uid);
        setDocumentNonBlocking(patientDocRef, patientData);
        router.push('/patient-portal/profile');
      }

    } catch (error: any) {
        console.error("Signup Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            toast({
              variant: "destructive",
              title: "Email Already Registered",
              description: "This email is already in use. Please log in instead.",
            });
        } else {
            toast({
              variant: "destructive",
              title: "Sign Up Failed",
              description: error.message || "Could not create account. Please try again.",
            });
        }
        setLoading(false);
    }
  };

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
            <form onSubmit={handleSignUp}>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input id="first-name" placeholder="Max" required value={firstName} onChange={e => setFirstName(e.target.value)} disabled={loading} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input id="last-name" placeholder="Robinson" required value={lastName} onChange={e => setLastName(e.target.value)} disabled={loading} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
                </div>
                <div className="grid gap-2">
                  <Label>I am a...</Label>
                  <RadioGroup defaultValue="patient" onValueChange={setRole} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="patient" id="role-patient" />
                      <Label htmlFor="role-patient">Patient</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="doctor" id="role-doctor" />
                      <Label htmlFor="role-doctor">Doctor</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create an account
                </Button>
              </div>
            </form>
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
