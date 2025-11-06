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
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Artist Dashboard</h1>
              <p className="text-sm text-slate-600">Manage your royalties and payments</p>
            </div>
            <div className="flex gap-4">
              <a
                href="/artist/royalties"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Royalties
              </a>
              <a
                href="/artist/payments"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Payments
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
      <main>{children}</main>
    </div>
  );
}











