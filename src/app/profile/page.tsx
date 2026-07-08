'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth, useUserData } from '@/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  const onChangePassword = async (values: ChangePasswordFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (!user.email) throw new Error("User email not found.");
      const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, values.newPassword);
      
      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
      form.reset();
    } catch (error: any) {
      console.error('Password change error:', error);
       let description = 'An unexpected error occurred.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'The current password you entered is incorrect.';
      } else if (error.code === 'auth/too-many-requests') {
        description = 'Too many attempts. Please try again later.';
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!auth || !user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Check your inbox for a link to reset your password.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not send password reset email. Please try again.',
      });
    }
  };


  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <AppHeader />
      <main className="flex-grow py-12">
        <div className="container mx-auto px-4 max-w-3xl space-y-8">
          <div className="flex items-center gap-3">
             <ShieldCheck className="h-8 w-8 text-primary" />
             <h1 className="text-3xl font-bold font-headline tracking-tight">Security Center</h1>
          </div>
          
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 p-8 border-b">
              <CardTitle className="text-xl">Identity Verification</CardTitle>
              <CardDescription>Primary profile data linked to your account.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Full Identity</Label>
                        <p className="font-bold text-lg text-slate-900 px-4 py-3 bg-slate-50 rounded-xl border border-dashed">{userData?.firstName} {userData?.lastName}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Authenticated Email</Label>
                        <p className="font-bold text-lg text-slate-900 px-4 py-3 bg-slate-50 rounded-xl border border-dashed truncate">{user.email}</p>
                    </div>
                </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-xl">Authentication Key</CardTitle>
              <CardDescription className="text-slate-400">Update your clinical access credentials.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showCurrentPassword ? "text" : "password"} {...field} className="pr-12 h-12 rounded-xl border-2" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                                {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">New Secure Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showNewPassword ? "text" : "password"} {...field} className="pr-12 h-12 rounded-xl border-2" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="h-12 rounded-xl font-bold px-8 shadow-lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password Key
                  </Button>
                </form>
              </Form>
              <Separator className="my-8" />
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border border-dashed">
                <div className="space-y-1">
                    <h4 className="font-bold text-slate-900">Need a Password Reset?</h4>
                    <p className="text-xs text-muted-foreground">We will send a high-fidelity recovery link to your registered email.</p>
                </div>
                <Button variant="outline" onClick={onForgotPassword} className="w-full sm:w-auto h-11 rounded-xl border-2 font-bold bg-white">
                    Send Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
