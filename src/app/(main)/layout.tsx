import Header from "@/components/layout/header";
import { MainSidebar } from "@/components/layout/main-sidebar";
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import FirebaseProvider from "@/firebase/client-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseProvider>
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
    </FirebaseProvider>
  );
}
