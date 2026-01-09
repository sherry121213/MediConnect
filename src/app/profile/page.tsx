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
import { Loader2, Upload } from 'lucide-react';
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });
  
  useEffect(() => {
    if (userData?.photoURL) {
      setPhotoPreview(userData.photoURL);
    }
  }, [userData]);


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = async () => {
    if (!user || !firestore || !photoFile) return;
    setIsUploading(true);
    
    // In a real app, you would upload the file to a storage service (like Firebase Storage)
    // and get a URL. For this demo, we'll simulate this by converting the image to a base64 Data URL.
    const reader = new FileReader();
    reader.readAsDataURL(photoFile);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      
      try {
        // Update Firebase Auth profile
        await updateProfile(user, { photoURL: dataUrl });

        // Update Firestore document
        const collectionName = userData?.role === 'doctor' ? 'doctors' : 'patients';
        const userDocRef = doc(firestore, collectionName, user.uid);
        await setDoc(userDocRef, { photoURL: dataUrl }, { merge: true });

        toast({
          title: 'Profile Picture Updated',
          description: 'Your new photo has been saved.',
        });
        setPhotoFile(null); // Clear the file after upload
      } catch (error) {
         toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: 'Could not save your new profile picture.',
        });
        console.error("Error uploading photo:", error);
      } finally {
        setIsUploading(false);
      }
    };
     reader.onerror = (error) => {
      console.error("Error reading file:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not read file.' });
      setIsUploading(false);
    };
  };

  const onChangePassword = async (values: ChangePasswordFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email!, values.currentPassword);
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
    if (!user?.email) return;
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
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={photoPreview || undefined} alt={userData?.displayName || 'User'} />
                        <AvatarFallback>{userData?.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                     <label htmlFor="photo-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                       <Upload className="h-6 w-6" />
                       <Input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  </div>
                  <div className="flex-grow">
                     <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>First Name</Label>
                        <p className="font-medium">{userData?.firstName}</p>
                      </div>
                      <div>
                        <Label>Last Name</Label>
                        <p className="font-medium">{userData?.lastName}</p>
                      </div>
                    </div>
                     <div>
                      <Label>Email</Label>
                      <p className="font-medium">{user.email}</p>
                    </div>
                     <div>
                      <Label>Role</Label>
                      <p className="font-medium capitalize">{userData?.role}</p>
                    </div>
                  </div>
                </div>
                 {photoFile && (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" onClick={() => { setPhotoFile(null); setPhotoPreview(userData?.photoURL || null); }}>Cancel</Button>
                      <Button onClick={handlePhotoUpload} disabled={isUploading}>
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
