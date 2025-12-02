'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Hook to determine if the current user has admin privileges.
 * It now checks the user's role from their Firestore document.
 * @returns An object with `isAdmin`, `isLoading`, and `error`.
 */
export function useAdmin() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If the initial user check is still loading, we are also loading.
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }

    // If there is no user, they are definitely not an admin.
    if (!user || !firestore) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // User is available, now check their role in Firestore.
    const checkAdminRole = async () => {
      try {
        // The user's role is stored in the 'patients' collection.
        const userDocRef = doc(firestore, 'patients', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err: any) {
        console.error("Error fetching user role from Firestore:", err);
        setError(err);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminRole();

  }, [user, isUserLoading, firestore]);

  return { isAdmin, isLoading, error };
}
