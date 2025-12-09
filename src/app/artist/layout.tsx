/**
 * Artist Layout
 * Layout wrapper for all artist pages
 */

import type { Metadata } from "next";
import { ArtistHeader } from "@/components/ArtistHeader";

export const metadata: Metadata = {
  title: "Artist Dashboard - Goodlife",
  description: "View your royalties and manage payments",
};

export default function ArtistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ArtistHeader />
      <main>{children}</main>
    </div>
  );
}











