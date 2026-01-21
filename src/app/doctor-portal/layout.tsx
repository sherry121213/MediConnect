'use client';

import { useUserData } from '@/firebase';
import { Loader2 } from 'lucide-react';
import DoctorPendingVerification from '@/components/layout/doctor-pending-verification';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';

export default function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, isUserLoading } = useUserData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

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
    router.replace('/');
    return null;
  }
  
  const isProfilePage = pathname === '/doctor-portal/profile';
  const isVerified = userData.verified === true;
  const isProfileComplete = userData.profileComplete === true;
  
  if (!isVerified && isProfileComplete) {
      return <DoctorPendingVerification />;
  }
  
  if (!isVerified && !isProfileComplete && !isProfilePage) {
      router.replace('/doctor-portal/profile');
      return (
         <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Redirecting to complete profile...</span>
        </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
        {children}
      <AppFooter />
    </div>
  );
}
