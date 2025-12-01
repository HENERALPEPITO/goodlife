"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@/types";

interface UseUserOptions {
  /** Required roles to access the page */
  requiredRoles?: UserRole[];
  /** Redirect path if user is not authenticated */
  redirectTo?: string;
  /** Whether to redirect on role mismatch */
  redirectOnRoleMismatch?: boolean;
}

/**
 * useUser Hook
 * 
 * A convenient hook for accessing user data with automatic redirect logic.
 * 
 * Usage:
 * const { user, loading, isAuthenticated, isAdmin, isArtist } = useUser({
 *   requiredRoles: ["admin"],
 *   redirectTo: "/login"
 * });
 */
export function useUser(options: UseUserOptions = {}) {
  const { 
    requiredRoles, 
    redirectTo = "/login",
    redirectOnRoleMismatch = true
  } = options;
  
  const { user, loading, isInitialized } = useAuth();
  const router = useRouter();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isArtist = user?.role === "artist";
  
  const hasRequiredRole = !requiredRoles || (user && requiredRoles.includes(user.role));

  useEffect(() => {
    if (!isInitialized) return;

    // Redirect if not authenticated
    if (!user && !loading) {
      router.push(redirectTo);
      return;
    }

    // Redirect if role doesn't match
    if (redirectOnRoleMismatch && user && requiredRoles && !requiredRoles.includes(user.role)) {
      router.push("/");
    }
  }, [user, loading, isInitialized, requiredRoles, redirectTo, redirectOnRoleMismatch, router]);

  return {
    user,
    loading: loading || !isInitialized,
    isInitialized,
    isAuthenticated,
    isAdmin,
    isArtist,
    hasRequiredRole,
  };
}
