"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthLoading from "./AuthLoading";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

/**
 * ProtectedRoute Component
 * 
 * Wraps pages that require authentication and optionally specific roles.
 * Shows loading state while auth is initializing to prevent UI hang.
 * 
 * Usage:
 * <ProtectedRoute allowedRoles={["admin"]}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = "/login"
}: ProtectedRouteProps) {
  const { user, loading, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    // Not logged in - redirect to login
    if (!user && !loading) {
      router.push(redirectTo);
      return;
    }

    // Check role if allowedRoles is specified
    if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect to main dashboard
      router.push("/");
    }
  }, [user, loading, isInitialized, allowedRoles, redirectTo, router]);

  // Show loading while auth is initializing
  if (!isInitialized || loading) {
    return <AuthLoading message="Verifying authentication..." />;
  }

  // Not logged in
  if (!user) {
    return <AuthLoading message="Redirecting to login..." />;
  }

  // Wrong role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AuthLoading message="Checking permissions..." />;
  }

  return <>{children}</>;
}
