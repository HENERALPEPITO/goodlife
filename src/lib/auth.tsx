"use client";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "./supabase/client";
import type { AuthUser, UserRole } from "@/types";
import type { User } from "@supabase/supabase-js";
import { clearArtistCache, setCachedSessionData, createPerfTimer } from "./artistSessionCache";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isInitialized: boolean;
  signUp: (email: string, password: string, role: UserRole) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; role?: UserRole }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider - Optimized Authentication Context
 * 
 * Key optimizations:
 * 1. Reads role from user_metadata (JWT) first - instant, no DB query
 * 2. Falls back to DB only for legacy users
 * 3. Syncs role to user_metadata automatically for future speed
 * 4. Proper loading states to prevent UI hang
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Create Supabase client once
  const supabase = useMemo(() => createClient(), []);

  /**
   * Get role from user - prioritizes user_metadata for speed
   */
  const getRoleFromUser = useCallback(async (supabaseUser: User): Promise<UserRole> => {
    // FAST PATH: Check user_metadata first (stored in JWT, no DB query)
    const metadataRole = supabaseUser.user_metadata?.role as UserRole | undefined;
    if (metadataRole && (metadataRole === "admin" || metadataRole === "artist")) {
      return metadataRole;
    }

    // SLOW PATH: Query user_profiles table (only for legacy users)
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", supabaseUser.id)
        .single();

      if (error) {
        // Profile doesn't exist - create with default role
        if (error.code === "PGRST116") {
          const defaultRole: UserRole = "artist";
          await supabase.from("user_profiles").insert({
            id: supabaseUser.id,
            email: supabaseUser.email,
            role: defaultRole,
          });
          
          // Sync to user_metadata for future instant access
          await supabase.auth.updateUser({ data: { role: defaultRole } });
          return defaultRole;
        }
        console.error("Error fetching profile:", error);
        return "artist"; // Default fallback
      }

      const role = profile.role as UserRole;

      // Sync role to user_metadata for future instant access (fire-and-forget)
      supabase.auth.updateUser({ data: { role } }).catch(console.error);

      return role;
    } catch (err) {
      console.error("Error in getRoleFromUser:", err);
      return "artist"; // Safe default
    }
  }, [supabase]);

  /**
   * Hydrate user state from Supabase user object
   */
  const hydrateUser = useCallback(async (supabaseUser: User | null) => {
    if (!supabaseUser) {
      setUser(null);
      setLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      const role = await getRoleFromUser(supabaseUser);
      
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        role,
        created_at: supabaseUser.created_at || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error hydrating user:", error);
      setUser(null);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [getRoleFromUser]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
        }
        
        if (mounted) {
          await hydrateUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (mounted) {
          setUser(null);
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Handle different auth events
        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          await hydrateUser(session?.user ?? null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, hydrateUser]);

  /**
   * Sign up with role stored in user_metadata
   */
  const signUp = useCallback(async (email: string, password: string, role: UserRole) => {
    try {
      // Sign up with role in user_metadata for instant access after login
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role }, // Store role in user_metadata
        },
      });

      if (error) return { error };

      // Also create user_profiles entry for backward compatibility
      if (data.user) {
        await supabase.from("user_profiles").insert({
          id: data.user.id,
          email: data.user.email,
          role,
        });
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [supabase]);

  /**
   * Sign in and return role for immediate redirect
   * OPTIMIZED: Prefetches artist session data for faster dashboard load
   */
  const signIn = useCallback(async (email: string, password: string) => {
    const timer = createPerfTimer('auth.signIn');
    
    try {
      setLoading(true);
      
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      timer.end();

      if (error) {
        setLoading(false);
        return { error };
      }

      // Get role from user_metadata for immediate redirect
      const role = data.user?.user_metadata?.role as UserRole | undefined;
      
      // If no role in metadata, fetch and sync it
      if (data.user && !role) {
        const fetchedRole = await getRoleFromUser(data.user);
        
        // Prefetch artist session data if artist role
        if (fetchedRole === 'artist') {
          prefetchArtistData(data.user.id);
        }
        
        return { error: null, role: fetchedRole };
      }

      // Prefetch artist session data in background for artists
      if (role === 'artist' && data.user) {
        prefetchArtistData(data.user.id);
      }

      return { error: null, role };
    } catch (error) {
      setLoading(false);
      return { error };
    }
  }, [supabase, getRoleFromUser]);

  /**
   * Prefetch artist session data after login (fire-and-forget)
   * Caches data in localStorage for instant dashboard load
   */
  const prefetchArtistData = useCallback(async (userId: string) => {
    const timer = createPerfTimer('prefetchArtistData');
    
    try {
      const { data, error } = await supabase.rpc('get_artist_session_data', {
        p_user_id: userId,
      });

      timer.end();

      if (error) {
        // RPC might not exist yet - that's ok, dashboard will fetch directly
        console.log('[auth] prefetch RPC not available:', error.code);
        return;
      }

      if (data?.found) {
        setCachedSessionData(data);
        console.log('[auth] Artist session data cached');
      }
    } catch (err) {
      // Silent fail - dashboard will fetch its own data
      console.log('[auth] prefetch failed:', err);
    }
  }, [supabase]);

  /**
   * Sign out - clears artist cache
   */
  const signOut = useCallback(async () => {
    setLoading(true);
    clearArtistCache(); // Clear cached artist data
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  }, [supabase]);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    await hydrateUser(currentUser);
  }, [supabase, hydrateUser]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isInitialized,
    signUp,
    signIn,
    signOut,
    refreshUser,
  }), [user, loading, isInitialized, signUp, signIn, signOut, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


