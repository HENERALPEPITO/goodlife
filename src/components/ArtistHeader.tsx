"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

export function ArtistHeader() {
  const [artistId, setArtistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArtistId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get artist ID from artists table
          const { data: artist } = await supabase
            .from("artists")
            .select("id")
            .eq("user_id", user.id)
            .single();
          
          if (artist) {
            setArtistId(artist.id);
          }
        }
      } catch (error) {
        console.error("Error fetching artist ID:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchArtistId();
  }, []);

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Artist Dashboard</h1>
            <p className="text-sm text-slate-600">Manage your royalties and payments</p>
          </div>
          <div className="flex items-center gap-4">
            {!loading && (
              <NotificationsDropdown artistId={artistId} />
            )}
            <a
              href="/artist/royalties"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              Royalties
            </a>
            <a
              href="/"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
