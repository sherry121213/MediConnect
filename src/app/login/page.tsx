'use client';
import Link from "next/link";
import AppHeader from "@/components/layout/header";
import AppFooter from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useAuth, useUserData } from "@/firebase";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
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
import { preverifiedDoctors, adminEmails } from "@/lib/auth-config";


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userData, isUserLoading } = useUserData();

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


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const isPreverifiedDoctor = preverifiedDoctors.hasOwnProperty(email);

      if (!user.emailVerified && !adminEmails.includes(user.email || '') && !isPreverifiedDoctor) {
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: "Your email is not yet verified. Please check your inbox for the verification link that was sent when you first signed up.",
          duration: 10000,
        });
        setLoading(false);
        return;
      }
      
      // On successful and verified login, do not redirect.
      // The `useEffect` hook is the single source of truth for redirection and
      // will handle it once the user and userData state is updated.
      // The loading spinner will persist until the redirect occurs.

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
      setLoading(false);
    }
  };
  
  const handlePasswordReset = async () => {
    if (!auth) return;
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
      });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({
        title: "Password Reset Email Sent",
        description: `Check your inbox at ${resetEmail} for a link to reset your password.`,
      });
      setIsResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
       let description = "Could not send password reset email. Please try again.";
      if(error.code === 'auth/invalid-email') {
        description = "The email address is not valid.";
      } else if (error.code === 'auth/user-not-found') {
        description = "No user found with this email address.";
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: description,
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
                     <AlertDialog open={isResetDialogOpen} onOpenChange={(open) => {
                         setIsResetDialogOpen(open);
                         if (!open) setResetEmail(''); // Clear on close
                     }}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="link" 
                          type="button" 
                          className="ml-auto inline-block text-sm p-0 h-auto"
                          onClick={() => {
                            setResetEmail(email); // Pre-fill with login email
                            setIsResetDialogOpen(true);
                          }}
                        >
                            Forgot your password?
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Password</AlertDialogTitle>
                          <AlertDialogDescription>
                            Enter your email address below and we'll send you a link to reset your password.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid gap-2 py-4">
                          <Label htmlFor="reset-email" className="sr-only">Email Address</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="m@example.com"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePasswordReset} disabled={loading || !resetEmail}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Reset Link
                          </AlertDialogAction>
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
