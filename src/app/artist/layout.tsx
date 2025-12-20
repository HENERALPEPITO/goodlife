/**
 * Artist Layout
 * Layout wrapper for all artist pages
 */

import type { Metadata } from "next";

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
      <main>{children}</main>
    </div>
  );
}











