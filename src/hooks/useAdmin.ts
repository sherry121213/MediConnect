'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';

/**
 * Hook to determine if the current user has admin privileges.
 * It forces a token refresh to ensure custom claims are up-to-date.
 * @returns An object with `isAdmin`, `isLoading`, and `error`.
 */
export function useAdmin() {
  const { user, isUserLoading } = useUser();
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
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // User is available, now check their custom claims.
    // We force a token refresh by passing `true` to `getIdTokenResult`.
    // This is crucial to get the latest claims after a user logs in.
    user.getIdTokenResult(true)
      .then(idTokenResult => {
        // The `admin` claim is set via a backend function (e.g., Cloud Function).
        const isAdminClaim = !!idTokenResult.claims.admin;
        setIsAdmin(isAdminClaim);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching admin token:", err);
        setError(err);
        setIsAdmin(false);
        setIsLoading(false);
      });

  }, [user, isUserLoading]);

  return { isAdmin, isLoading, error };
}
