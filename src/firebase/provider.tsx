'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initializeFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from './non-blocking-login';

interface FirebaseServices {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  isServicesLoading: boolean;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);


/**
 * The main Firebase provider. It initializes Firebase services and handles anonymous authentication.
 * It shows a loading screen until all services and user auth are ready.
 */
export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [services, setServices] = useState<FirebaseServices | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [isServicesLoading, setIsServicesLoading] = useState(true);

  // 1. Initialize Firebase services ONCE.
  useEffect(() => {
    // This effect runs only once on mount
    try {
      const firebaseServices = initializeFirebase();
      setServices(firebaseServices);
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
    } finally {
      setIsServicesLoading(false);
    }
  }, []);

  // 2. Handle authentication state and anonymous sign-in.
  useEffect(() => {
    // This effect runs when 'services' are available.
    if (!services) return;

    const unsubscribe = onAuthStateChanged(services.auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsUserLoading(false);
      } else {
        // If no user, initiate anonymous sign-in
        initiateAnonymousSignIn(services.auth);
        // The listener will pick up the new user state.
      }
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, [services]);

  // Memoize context value
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp: services?.firebaseApp ?? null,
    firestore: services?.firestore ?? null,
    auth: services?.auth ?? null,
    user,
    isUserLoading,
    isServicesLoading,
  }), [services, user, isUserLoading, isServicesLoading]);

  // Render loading screen or children
  if (isServicesLoading || isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Conectando...</p>
      </div>
    );
  }
  
  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


// --- HOOKS ---

function useFirebaseContext() {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
    }
    return context;
}

export const useFirebase = () => {
  const context = useFirebaseContext();
  if (!context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase services not available. Check FirebaseProvider setup.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
  };
};

export const useAuth = (): Auth => {
  return useFirebase().auth;
};

export const useFirestore = (): Firestore => {
  return useFirebase().firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  return useFirebase().firebaseApp;
};

export const useUser = () => {
    const { user, isUserLoading } = useFirebaseContext();
    return { user, isUserLoading };
};
