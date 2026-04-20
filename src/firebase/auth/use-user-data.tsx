'use client';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Patient } from '@/lib/types';

/**
 * Hook that returns the authenticated Firebase User and their corresponding
 * profile data from the 'patients' collection (which contains roles).
 */
export function useUserData() {
  const { user, isUserLoading: isAuthLoading, userError } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'patients', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isDocLoading } = useDoc<Patient>(userDocRef);

  return {
    user,
    userData,
    isUserLoading: isAuthLoading || (!!user && isDocLoading),
    userError,
  };
}
