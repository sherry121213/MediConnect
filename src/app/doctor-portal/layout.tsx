'use client';

import { useUserData, useAuth } from '@/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';
import DoctorPendingVerification from '@/components/layout/doctor-pending-verification';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signOut } from 'firebase/auth';

function DoctorAccountDisabled() {
  const auth = useAuth();
  const router = useRouter();
  
  const handleLogout = () => {
    if (auth) {
      signOut(auth).then(() => {
        router.push('/');
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex flex-col items-center justify-center bg-secondary/30 text-center p-4">
        <div className="max-w-md w-full">
            <Card className="p-6">
                <CardHeader className="p-0 mb-4">
                    <div className="mx-auto bg-destructive/10 text-destructive rounded-full p-3 w-fit">
                        <ShieldAlert className="h-10 w-10" />
                    </div>
                </CardHeader>
                <CardTitle className="text-2xl font-bold font-headline">Account Deactivated</CardTitle>
                <p className="text-muted-foreground mt-2">
                    Your professional account has been deactivated by the administration. You currently do not have access to the doctor portal.
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                    If you believe this is a mistake, please contact our support team.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                    <Button variant="outline" onClick={handleLogout} className="w-full">
                        Log Out
                    </Button>
                </div>
            </Card>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

export default function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, isUserLoading } = useUserData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isUserLoading) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (userData) {
      if (userData.role !== 'doctor') {
        router.replace('/');
        return;
      }
      
      const isProfilePage = pathname === '/doctor-portal/profile';
      const isProfileComplete = !!userData.profileComplete;

      if (!isProfileComplete && !isProfilePage) {
        router.replace('/doctor-portal/profile');
        return;
      }
    }
  }, [isUserLoading, user, userData, pathname, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Verifying access...</span>
      </div>
    );
  }

  if (!user || !userData) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Redirecting...</p>
        </div>
    );
  }
  
  if (userData.role !== 'doctor') {
      return (
         <div className="flex h-screen w-full items-center justify-center">
            <p>Redirecting...</p>
        </div>
      );
  }

  if (userData.isActive === false) {
      return <DoctorAccountDisabled />;
  }
  
  const isProfilePage = pathname === '/doctor-portal/profile';
  const isProfileComplete = !!userData.profileComplete;

  if (!isProfileComplete && !isProfilePage) {
      return (
          <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Redirecting to complete your profile...</span>
          </div>
      );
  }
  
  const isVerified = !!userData.verified;
  
  if (isProfileComplete && !isVerified && !isProfilePage) {
      return <DoctorPendingVerification />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
        {children}
      <AppFooter />
    </div>
  );
}
