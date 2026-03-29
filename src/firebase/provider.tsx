'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, DocumentData, DocumentReference, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
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
  storage: FirebaseStorage | null;
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
  storage: FirebaseStorage;
  user: User | null;
  userData: DocumentData | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { 
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
  storage,
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

    let patientDocUnsubscribe: (() => void) | null = null;
    let doctorDocUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // Clean up previous doc listeners
        if (patientDocUnsubscribe) patientDocUnsubscribe();
        if (doctorDocUnsubscribe) doctorDocUnsubscribe();
        patientDocUnsubscribe = null;
        doctorDocUnsubscribe = null;

        if (firebaseUser) {
          const patientDocRef = doc(firestore, 'patients', firebaseUser.uid);
          
          patientDocUnsubscribe = onSnapshot(patientDocRef, 
            (patientSnap) => {
              const patientData = patientSnap.exists() ? patientSnap.data() : null;

              if (patientData && patientData.role === 'doctor') {
                const doctorDocRef = doc(firestore, 'doctors', firebaseUser.uid);
                doctorDocUnsubscribe = onSnapshot(doctorDocRef, 
                  (doctorSnap) => {
                    const doctorData = doctorSnap.exists() ? doctorSnap.data() : {};
                    // Merge patient and doctor data, with doctor data taking precedence for overlapping fields
                    const mergedData = { ...patientData, ...doctorData };
                    setUserAuthState({ user: firebaseUser, userData: mergedData, isUserLoading: false, userError: null });
                  },
                  (error) => {
                    // Handle error for doctor doc
                    const contextualError = new FirestorePermissionError({ operation: 'get', path: doctorDocRef.path });
                    errorEmitter.emit('permission-error', contextualError);
                    setUserAuthState({ user: firebaseUser, userData: patientData, isUserLoading: false, userError: contextualError });
                  }
                );
              } else {
                // User is not a doctor, or patient doc doesn't exist yet
                setUserAuthState({ user: firebaseUser, userData: patientData, isUserLoading: false, userError: null });
              }
            },
            (error) => {
              // Handle error for patient doc
              const contextualError = new FirestorePermissionError({ operation: 'get', path: patientDocRef.path });
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
      if (patientDocUnsubscribe) patientDocUnsubscribe();
      if (doctorDocUnsubscribe) doctorDocUnsubscribe();
    };
  }, [auth, firestore]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: userAuthState.user,
      userData: userAuthState.userData,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, storage, userAuthState]);

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

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
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

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage;
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
