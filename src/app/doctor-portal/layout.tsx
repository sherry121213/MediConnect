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
    if (isUserLoading) {
      return; // Don't do anything while loading
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

      // If profile is not complete, and we are not on the profile page, redirect there.
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

  // If user is loading or doesn't exist, or no userData yet, show a generic loading/redirecting message.
  if (!user || !userData) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <p>Redirecting...</p>
        </div>
    );
  }
  
  // If the role is wrong, show redirecting message.
  if (userData.role !== 'doctor') {
      return (
         <div className="flex h-screen w-full items-center justify-center">
            <p>Redirecting...</p>
        </div>
      );
  }
  
  const isProfilePage = pathname === '/doctor-portal/profile';
  const isProfileComplete = !!userData.profileComplete;

  // While the useEffect is running the redirect, show a loading state.
  if (!isProfileComplete && !isProfilePage) {
      return (
          <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Redirecting to complete your profile...</span>
          </div>
      );
  }
  
  const isVerified = !!userData.verified;
  
  // If the profile is complete but not verified, show the pending page (unless they are on their profile page).
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
