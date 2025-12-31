'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { useAuth, useUser } from './provider';
import { initiateAnonymousSignIn } from './non-blocking-login';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function AuthHandler({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  React.useEffect(() => {
    // If auth is ready, and the user state is determined but there's no user,
    // initiate a sign-in.
    if (auth && !isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth, user, isUserLoading]);

  // While the initial user state is loading, you might want to show a loader.
  if (isUserLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><p>Conectando...</p></div>;
  }

  // Once loading is complete, render children. If sign-in is initiated,
  // the onAuthStateChanged listener in FirebaseProvider will handle the update.
  return <>{children}</>;
}


export default function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []); 

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthHandler>
        {children}
      </AuthHandler>
    </FirebaseProvider>
  );
}
