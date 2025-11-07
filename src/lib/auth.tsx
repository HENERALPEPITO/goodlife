"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import type { UserRole } from "@/types";
import type { User } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, role: UserRole) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (supabaseUser: User) => {
    try {
      console.log('👤 Fetching profile for user:', supabaseUser.id);
      console.log('   Email:', supabaseUser.email);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      console.log('📊 Profile query result:', { 
        hasProfile: !!profile, 
        profileId: profile?.id,
        profileRole: profile?.role,
        hasError: !!error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name
      });

      if (error) {
        // Log detailed error information - handle error object that might not serialize
        const errorDetails = {
          message: error?.message || 'No message',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
        };
        
        // Try to get all properties from error object
        try {
          const errorKeys = Object.keys(error || {});
          const errorValues = Object.values(error || {});
          console.error('❌ Error fetching user profile:', errorDetails);
          console.error('Error object keys:', errorKeys);
          console.error('Error object values:', errorValues);
          console.error('Full error object:', error);
        } catch (e) {
          console.error('❌ Error fetching user profile:', errorDetails);
          console.error('Raw error:', error);
        }

        // If profile doesn't exist, create one with default role
        if (error.code === 'PGRST116' || error.code === '42P01') {
          console.log('Profile not found, creating default profile...');
          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: supabaseUser.id,
              email: supabaseUser.email,
              role: 'artist'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user profile:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint
            });
            setUser(null);
            setLoading(false);
            return;
          }

          // Set user with default role
          if (newProfile) {
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              role: newProfile.role as UserRole
            });
            setLoading(false);
            return;
          }
        }
        
        // For other errors, check if it's a table/permission issue
        if (error.code === '42P01') {
          console.error('❌ Table "user_profiles" does not exist! Please run fix-user-profiles-rls.sql in Supabase SQL Editor');
        } else if (error.message?.includes('permission denied') || error.message?.includes('RLS')) {
          console.error('❌ RLS policy blocking access. Please check RLS policies in Supabase.');
        }
        
        setUser(null);
      } else {
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          role: profile.role as UserRole
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, role: UserRole) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: role
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          return { error: profileError };
        }
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting sign in...', email);
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('✅ Sign in response:', { error, user: data?.user?.id });
      return { error };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


