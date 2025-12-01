"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Dashboard Redirect
 * 
 * Redirects to root page which serves as the main dashboard.
 */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600">Redirecting to dashboard...</p>
    </div>
  );
}
