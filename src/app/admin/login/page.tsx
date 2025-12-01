"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin Login Redirect
 * 
 * Redirects to main login page since we use a unified login flow.
 */
export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600">Redirecting to login...</p>
    </div>
  );
}
