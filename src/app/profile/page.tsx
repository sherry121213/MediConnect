'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth, useUserData, useFirestore } from '@/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { user, userData, isUserLoading } = useUserData();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });
  
  useEffect(() => {
    if (userData?.photoURL) {
      setPhotoUrlInput(userData.photoURL);
    }
  }, [userData]);


  const handleSavePhotoUrl = async () => {
    if (!user || !firestore) return;
    setIsUploading(true);

    try {
      // Basic validation to check if it's a URL.
      if (photoUrlInput) {
        new URL(photoUrlInput);
      }
      
      await updateProfile(user, { photoURL: photoUrlInput });

      const collectionName = userData?.role === 'doctor' ? 'doctors' : 'patients';
      const userDocRef = doc(firestore, collectionName, user.uid);
      await setDoc(userDocRef, { photoURL: photoUrlInput }, { merge: true });

      toast({
        title: 'Profile Picture Updated',
        description: 'Your new photo has been saved.',
      });
    } catch (error) {
      let description = 'Could not save your new profile picture.';
      if (error instanceof TypeError) {
        description = 'Please enter a valid URL.';
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description,
      });
      console.error("Error updating photo URL:", error);
    } finally {
      setIsUploading(false);
    }
  };


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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
             <main className="flex-grow flex items-center justify-center bg-secondary/30">
                 <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                        <CardDescription>You must be logged in to view this page.</CardDescription>
                    </CardHeader>
                 </Card>
            </main>
            <AppFooter/>
        </div>
    )
  }

  const originalPhotoUrl = userData?.photoURL || '';
  const hasChanged = photoUrlInput !== originalPhotoUrl;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow bg-secondary/30 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-bold font-headline mb-8">My Profile</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                  <div className="flex-grow space-y-4">
                    <div>
                      <Label>First Name</Label>
                      <p className="font-medium">{userData?.firstName}</p>
                    </div>
                     <div>
                      <Label>Last Name</Label>
                      <p className="font-medium">{userData?.lastName}</p>
                    </div>
                     <div>
                      <Label>Email</Label>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-center gap-4 w-full sm:w-auto">
                    <Avatar className="h-28 w-28">
                        <AvatarImage src={photoUrlInput || undefined} alt={userData?.displayName || 'User'} />
                        <AvatarFallback className="text-3xl">{userData?.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="w-full space-y-2">
                        <Label htmlFor="photo-url-input">Photo URL</Label>
                        <Input 
                            id="photo-url-input"
                            type="text"
                            value={photoUrlInput}
                            onChange={(e) => setPhotoUrlInput(e.target.value)}
                            placeholder="https://example.com/photo.png"
                        />
                    </div>
                  </div>
                </div>
                 {hasChanged && (
                    <div className="flex items-center justify-end gap-2 border-t pt-4">
                      <Button variant="ghost" onClick={() => setPhotoUrlInput(originalPhotoUrl)}>Cancel</Button>
                      <Button onClick={handleSavePhotoUrl} disabled={isUploading}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Picture
                      </Button>
                    </div>
                  )}
            </CardContent>
          </Card>

          <Separator className="my-8" />

          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account password.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
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
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </form>
              </Form>
              <Separator className="my-6" />
               <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium">Forgot your password?</h4>
                    <p className="text-sm text-muted-foreground">Send a password reset link to your email.</p>
                </div>
                <Button variant="outline" onClick={onForgotPassword}>
                    Send Reset Link
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
