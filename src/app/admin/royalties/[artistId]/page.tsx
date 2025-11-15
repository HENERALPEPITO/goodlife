"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { EditableRoyaltyTable } from "@/components/royalties/EditableRoyaltyTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, AlertCircle, Trash2 } from "lucide-react";
import type { Royalty } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export default function ArtistRoyaltiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const artistId = params.artistId as string;
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Check authorization and fetch royalties
  useEffect(() => {
    if (loading) {
      // Still loading auth state
      return;
    }

    if (!user) {
      // No user at all
      router.push("/");
      return;
    }

    if (user.role !== "admin") {
      // Not an admin
      router.push("/");
      return;
    }

    // User is authenticated and is admin - fetch royalties
    fetchRoyalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, artistId]);

  const fetchRoyalties = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/${artistId}`, {
        headers,
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Received 401 from API, checking session...");
          setError("Authentication expired. Please refresh the page.");
          return;
        }
        if (response.status === 403) {
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch royalties");
      }

      const data = await response.json();
      setRoyalties(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch royalties";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRoyalty = async (id: string, updates: Partial<Royalty>) => {
    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/record/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update royalty record");
      }

      const updated = await response.json();
      
      // Update local state
      setRoyalties((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );

      toast({
        title: "Success",
        description: "Royalty record updated",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update royalty record";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoyalty = async (id: string) => {
    if (!confirm("Are you sure you want to delete this royalty record?")) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/record/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete royalty record");
      }

      // Update local state
      setRoyalties((prev) => prev.filter((r) => r.id !== id));

      toast({
        title: "Success",
        description: "Royalty record deleted",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete royalty record";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(
      "Are you sure you want to delete ALL royalty records for this artist? This action cannot be undone."
    )) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `/api/admin/royalties/delete-all/${artistId}`,
        {
          method: "DELETE",
          headers,
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete artist royalties");
      }

      // Clear the royalties
      setRoyalties([]);
      setShowDeleteAllConfirm(false);

      toast({
        title: "Success",
        description: "All royalty records deleted",
      });

      // Redirect back to list after a short delay
      setTimeout(() => {
        router.push("/admin/royalties");
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete artist royalties";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setShowDeleteAllConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/royalties">
              <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Royalty Records
              </h1>
              <p className="text-slate-600 mt-1">
                Artist ID: {artistId}
              </p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4 mb-8">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">{error}</h3>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-slate-600" />
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <>
            {/* Info Bar */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>{royalties.length}</strong> royalty {royalties.length === 1 ? "record" : "records"} found.
                Click any cell to edit values. Press Enter to save or Escape to cancel.
              </p>
            </div>

            {/* Table or Empty State */}
            {royalties.length > 0 ? (
              <>
                <EditableRoyaltyTable
                  royalties={royalties}
                  onUpdate={handleUpdateRoyalty}
                  onDelete={handleDeleteRoyalty}
                  isLoading={isSaving}
                />

                {/* Delete All Button */}
                <div className="mt-8 flex justify-end">
                  {showDeleteAllConfirm ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-red-900">
                        Delete all records? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAll}
                          disabled={isSaving}
                          className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? "Deleting..." : "Yes, Delete All"}
                        </button>
                        <button
                          onClick={() => setShowDeleteAllConfirm(false)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-slate-200 text-slate-900 rounded font-medium hover:bg-slate-300 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowDeleteAllConfirm(true)}
                      variant="destructive"
                      className="flex items-center gap-2"
                      disabled={isSaving}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete All Records
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No Royalty Records
                </h3>
                <p className="text-slate-600">
                  This artist has no royalty records yet
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
