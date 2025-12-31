'use client';
import { useEffect } from 'react';
import Header from "@/components/layout/header";
import { MainSidebar } from "@/components/layout/main-sidebar";
import {
  Sidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import FirebaseProvider from "@/firebase/client-provider";
import { useAuth, useUser, useFirebase } from "@/firebase";
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';

function AuthHandler({ children }: { children: React.ReactNode }) {
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (auth && !isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Wait until Firebase services are available, auth state is resolved, and we have a user.
  if (isUserLoading || !auth || !firestore || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><p>Conectando...</p></div>;
  }

  return <>{children}</>;
}


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseProvider>
      <AuthHandler>
        <SidebarProvider>
          <div className="flex min-h-screen">
            <Sidebar>
              <MainSidebar />
            </Sidebar>
            <div className="flex flex-col w-full">
                <Header />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
          </div>
        </SidebarProvider>
      </AuthHandler>
    </FirebaseProvider>
  );
}
