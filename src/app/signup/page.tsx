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
import { Label } from "@/components/ui/label";
import { useAuth, useUser } from "@/firebase";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

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
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isUserLoading) {
      let redirectPath = '/patient-portal';
      if (role === 'doctor') {
        redirectPath = '/doctor-portal';
      } else if (role === 'admin') {
        redirectPath = '/admin';
      }
      router.push(redirectPath);
    }
  }, [user, isUserLoading, router, role]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      if (newUser) {
        const userDocRef = doc(firestore, 'patients', newUser.uid);
        const userData = {
          id: newUser.uid,
          firstName,
          lastName,
          email,
          role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Use the non-blocking function with contextual error handling
        setDocumentNonBlocking(userDocRef, userData, { merge: true });
        // The useEffect will handle redirection.
      }
    } catch (error: any) {
        console.error("Signup Error:", error);
        toast({
          variant: "destructive",
          title: "Sign Up Failed",
          description: error.message || "Could not create account. Please try again.",
        });
    } finally {
      // setLoading is not turned off here immediately because redirection will happen.
      // If redirection fails or user creation has an issue not caught by the try/catch,
      // you might want to handle that case. For now, we assume success leads to redirect.
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
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="admin" id="role-admin" />
                      <Label htmlFor="role-admin">Admin</Label>
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
