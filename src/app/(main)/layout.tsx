'use client';
import { useUser, useFirebase } from '@/firebase';
import Header from "@/components/layout/header";
import { MainSidebar } from "@/components/layout/main-sidebar";
import {
  Sidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { FirebaseProvider } from "@/firebase/provider";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if loading is complete and there's no user.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // While loading, don't render children to avoid executing hooks with null user.
  if (isUserLoading || !user) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <p>Verificando sesión...</p>
      </div>
    );
  }

  // Render children only when loading is complete and user exists.
  return <>{children}</>;
}


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseProvider>
      <AuthGuard>
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
      </AuthGuard>
    </FirebaseProvider>
  );
}
