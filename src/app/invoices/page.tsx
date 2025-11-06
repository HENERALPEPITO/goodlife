"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import InvoiceManagement from "@/components/InvoiceManagement";

export default function InvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we're sure the user isn't authenticated
    // Wait a bit to avoid race conditions with auth loading
    if (!authLoading && !user) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Redirecting to login...</div>
      </div>
    );
  }

  // Render InvoiceManagement component (handles both admin and artist views)
  return <InvoiceManagement user={user} />;
}







