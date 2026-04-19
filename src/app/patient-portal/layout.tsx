'use client';

import { useUserData } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AppHeader from '@/components/layout/header';
import AppFooter from '@/components/layout/footer';

export default function PatientPortalLayout({
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
      if (userData.role !== 'patient' && userData.role !== 'admin') {
        router.replace('/');
        return;
      }
      
      const isProfilePage = pathname === '/patient-portal/profile';
      const isProfileComplete = !!userData.profileComplete;

      // If profile is not complete, and we are not on the profile page, redirect there.
      if (!isProfileComplete && !isProfilePage) {
        router.replace('/patient-portal/profile');
        return;
      }
    }
  }, [isUserLoading, user, userData, pathname, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Entering Patient Portal...</span>
      </div>
    );
  }

  if (!user || !userData) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      {children}
      <AppFooter />
    </div>
  );
}
