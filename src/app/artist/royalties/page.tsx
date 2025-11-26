"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

/**
 * Artist Royalties Page
 * Redirects to the main royalties page
 */
export default function ArtistRoyaltiesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else {
        // Redirect to main royalties page
        router.push("/royalties");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  );
}
