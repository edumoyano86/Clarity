'use client';
import { useUser } from '@/firebase';
import Header from "@/components/layout/header";
import { MainSidebar } from "@/components/layout/main-sidebar";
import {
  Sidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppointmentNotifier } from '@/components/layout/appointment-notifier';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if loading is complete and there's no user.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // While loading, or if no user, show a loading message.
  // This prevents rendering children that might depend on the user.
  if (isUserLoading || !user) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <p>Verificando sesión...</p>
      </div>
    );
  }

  // Render children only when loading is complete and user exists.
  return (
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
      <AppointmentNotifier />
    </SidebarProvider>
  );
}
