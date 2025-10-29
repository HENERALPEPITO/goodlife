/**
 * Admin Layout
 * Layout wrapper for all admin pages
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard - Goodlife",
  description: "Administrative dashboard for managing users and royalties",
};

export default function AdminLayout({
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
              <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-sm text-slate-600">Manage users, royalties, and system settings</p>
            </div>
            <div className="flex gap-4">
              <a
                href="/admin/users"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Users
              </a>
              <a
                href="/admin/royalties"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Royalties
              </a>
              <a
                href="/"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
      <main>{children}</main>
    </div>
  );
}



