"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import ArtistInvoices from "@/components/ArtistInvoices";
import AdminInvoiceList from "@/components/AdminInvoiceList";

export default function InvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
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
    return null;
  }

  // Render different components based on user role
  if (user.role === "admin") {
    return <AdminInvoiceList user={user} />;
  }

  return <ArtistInvoices user={user} />;
}





