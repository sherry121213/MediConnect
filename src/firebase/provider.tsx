'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, DocumentData, DocumentReference, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { adminEmails, preverifiedDoctors } from '@/lib/auth-config';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  userData: DocumentData | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  userData: DocumentData | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  userData: DocumentData | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUserData()
export interface UserDataHookResult {
  user: User | null;
  userData: DocumentData | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    userData: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth || !firestore) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, userData: null, isUserLoading: false, userError: new Error("Auth or Firestore service not provided.") });
      return;
    }

    setUserAuthState({ user: null, userData: null, isUserLoading: true, userError: null }); // Reset on auth instance change

    let docUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // Clean up previous doc listener
        if (docUnsubscribe) {
          docUnsubscribe();
          docUnsubscribe = null;
        }

        if (firebaseUser) {
          const isSpecialUser = adminEmails.includes(firebaseUser.email || '') || preverifiedDoctors.hasOwnProperty(firebaseUser.email || '');
          if (!firebaseUser.emailVerified && !isSpecialUser) {
              setUserAuthState({ user: null, userData: null, isUserLoading: false, userError: null });
              return;
          }
          
          // All users, regardless of role, have a document in the 'patients' collection
          // which acts as the central user record. We will listen to this for real-time updates.
          const userDocRef = doc(firestore, 'patients', firebaseUser.uid);
          
          docUnsubscribe = onSnapshot(userDocRef, 
            (docSnap) => {
              if (docSnap.exists()) {
                setUserAuthState({ user: firebaseUser, userData: docSnap.data(), isUserLoading: false, userError: null });
              } else {
                // This can happen during the signup process before the doc is created.
                setUserAuthState({ user: firebaseUser, userData: null, isUserLoading: false, userError: null });
              }
            },
            (error) => {
              const contextualError = new FirestorePermissionError({
                  operation: 'get',
                  path: userDocRef.path,
              });
              errorEmitter.emit('permission-error', contextualError);
              setUserAuthState({ user: firebaseUser, userData: null, isUserLoading: false, userError: contextualError });
            }
          );
        } else {
          // No user is logged in
          setUserAuthState({ user: null, userData: null, isUserLoading: false, userError: null });
        }
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, userData: null, isUserLoading: false, userError: error });
      }
    );

    return () => {
      authUnsubscribe();
      if (docUnsubscribe) {
        docUnsubscribe();
      }
    };
  }, [auth, firestore]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      userData: userAuthState.userData,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    userData: context.userData,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { 
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError };
};

/**
 * Hook for accessing the full user data from Firestore along with auth state.
 */
export const useUserData = (): UserDataHookResult => {
  const { user, userData, isUserLoading, userError } = useFirebase();
  return { user, userData, isUserLoading, userError };
};
