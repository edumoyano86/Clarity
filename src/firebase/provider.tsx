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
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);


/**
 * The main Firebase provider. It initializes Firebase services and handles anonymous authentication.
 * It shows a loading screen until all services and user auth are ready.
 */
export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Memoize services so they are initialized only once
  const services = useMemo(() => {
    try {
      return initializeFirebase();
    } catch (e) {
      console.error("Failed to initialize Firebase", e);
      return null;
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Handle authentication state and anonymous sign-in.
  useEffect(() => {
    if (!services) return;

    const unsubscribe = onAuthStateChanged(services.auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsUserLoading(false);
      } else {
        // If no user, initiate anonymous sign-in
        initiateAnonymousSignIn(services.auth);
        // The listener will pick up the new user state, setting isLoading to false then.
      }
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, [services]);

  // The isLoading state is true if services are not ready OR the user is still loading.
  const isLoading = !services || isUserLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Conectando...</p>
      </div>
    );
  }
  
  // Memoize context value once everything is loaded
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp: services.firebaseApp,
    firestore: services.firestore,
    auth: services.auth,
    user,
    isUserLoading,
  }), [services, user, isUserLoading]);

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
