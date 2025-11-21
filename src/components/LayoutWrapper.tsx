"use client";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should not show navigation
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password";

  if (isAuthPage) {
    // Return children without any navigation for auth pages
    return <>{children}</>;
  }

  // Return children with full navigation for all other pages
  return (
    <main className="flex h-screen bg-background text-foreground transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden bg-background">
        <Topbar />
        <div className="flex-1 overflow-auto bg-background">
          <div className="flex flex-col min-h-full">
            <section className="flex-1 p-8 bg-background">
              {children}
            </section>
            <Footer />
          </div>
        </div>
      </div>
    </main>
  );
}
