'use client';
import Link from "next/link";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useAuth, useFirestore, useUserData } from "@/firebase";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const preverifiedDoctors: Record<string, any> = {
    'doc1@gmail.com': {},
    'doc2@gmail.com': {},
    'doc3@gmail.com': {},
    'doc4@gmail.com': {},
    'doc5@gmail.com': {},
    'doc6@gmail.com': {},
    'doc7@gmail.com': {},
    'doc8@gmail.com': {},
    'doc9@gmail.com': {},
    'doc10@gmail.com': {}
};


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userData, isUserLoading } = useUserData();

  // Redirect if user is already logged in
  useEffect(() => {
    if (!isUserLoading && user && userData) {
       const isPreverifiedDoctor = preverifiedDoctors.hasOwnProperty(user.email || '');
       if (!user.emailVerified && user.email !== 'admin@mediconnect.com' && !isPreverifiedDoctor) {
         // If they are logged in but not verified, we sign them out so they stay on the login page.
         signOut(auth);
         return;
      }

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
  }, [user, userData, isUserLoading, router, auth]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const isPreverifiedDoctor = preverifiedDoctors.hasOwnProperty(email);

      if (!user.emailVerified && user.email !== 'admin@mediconnect.com' && !isPreverifiedDoctor) {
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: "Please verify your email address before logging in. A verification link was sent to you on signup.",
          duration: 10000,
        });
        setLoading(false);
        return;
      }

      // OPTIMIZATION: Redirect immediately after successful login to improve user experience.
      if (user.email === 'admin@mediconnect.com') {
        router.replace('/admin');
        return;
      }
      
      const collectionName = isPreverifiedDoctor ? 'doctors' : 'patients';
      const userDocRef = doc(firestore, collectionName, user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const role = userDocSnap.data().role;
        if (role === 'doctor') {
          router.replace('/doctor-portal');
          return;
        }
        if (role === 'patient') {
          router.replace('/patient-portal');
          return;
        }
      }
      
      // Fallback for any other case
      router.replace('/');

    } catch (error: any) {
      console.error("Login Error:", error);
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        description = "The email or password you entered is incorrect. Please try again.";
      }
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: description,
      });
      setLoading(false); // Only set loading false on error, as success causes a redirect.
    }
  };
  
  const handlePasswordReset = async () => {
    if (!auth) return;
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
      });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your inbox for a link to reset your password.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not send password reset email. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Show a loading screen while the initial auth check is running, or if a user is
  // already logged in (in which case the useEffect will redirect them).
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
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="link" type="button" className="ml-auto inline-block text-sm p-0 h-auto">
                            Forgot your password?
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Password?</AlertDialogTitle>
                          <AlertDialogDescription>
                            We will send a password reset link to <strong>{email || 'the email you entered'}</strong>. Are you sure you want to continue?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePasswordReset}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </div>
            </form>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
