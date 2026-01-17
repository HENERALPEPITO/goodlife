"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Artist {
  id: string;
  email: string;
  record_count: number;
}

export default function AdminRoyaltiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authorization
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchArtists = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      };

      const response = await fetch("/api/admin/royalties/artists", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          router.push("/");
          return;
        }
        throw new Error(`Failed to fetch artists (HTTP ${response.status})`);
      }

      const data = await response.json();
      setArtists(data);
      
      if (data.length === 0) {
        setError("No artists with royalty records found");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch artists";
      console.error("[fetchArtists] Error:", message);
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  // Fetch artists when user is authenticated and authorized
  useEffect(() => {
    if (user?.role === "admin") {
      fetchArtists();
    }
  }, [user, fetchArtists]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Royalties Management
          </h1>
          <p className="text-slate-600">
            Select an artist to view and manage their royalty records
          </p>
        </div>

        {/* Error State */}
        {error && !isLoading && artists.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-yellow-900">{error}</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Upload royalty data using the royalty uploader to get started.
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-slate-600" />
          </div>
        )}

        {/* Artists List */}
        {!isLoading && artists.length > 0 && (
          <div className="space-y-3">
            {artists.map((artist) => (
              <Link key={artist.id} href={`/admin/royalties/${artist.id}`}>
                <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {artist.email}
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">
                        {artist.record_count} royalty {artist.record_count === 1 ? "record" : "records"}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State with Button */}
        {!isLoading && artists.length === 0 && !error && (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Artists Found
            </h3>
            <p className="text-slate-600 mb-6">
              Start by uploading royalty data
            </p>
            <Link href="/royalty-uploader">
              <Button>
                Go to Royalty Uploader
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}