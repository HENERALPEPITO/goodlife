"use client";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import LegalFooter from "@/components/LegalFooter";

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Pages that should not show navigation
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password";

  // Legal pages with simplified layout
  const isLegalPage = pathname === "/privacy-policy" || pathname === "/terms-and-conditions";

  if (isAuthPage) {
    // Return children without any navigation for auth pages
    return <>{children}</>;
  }

  if (isLegalPage) {
    // Return simplified layout for legal pages (no sidebar, no topbar)
    return (
      <main className="min-h-screen bg-white text-foreground transition-colors">
        <div className="flex flex-col min-h-screen">
          <div className="flex-1">
            {children}
          </div>
          <LegalFooter />
        </div>
      </main>
    );
  }

  // Return children with full navigation for all other pages
  return (
    <main className="flex h-screen bg-background text-foreground transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 overflow-hidden bg-background pt-16 md:pt-0">
        <Topbar />
        <div className="flex-1 overflow-auto bg-background">
          <div className="flex flex-col min-h-full">
            <section className="flex-1 p-4 md:p-8 bg-background">
              {children}
            </section>
            <Footer />
          </div>
        </div>
      </div>
    </main>
  );
}
