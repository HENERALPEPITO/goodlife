/**
 * Admin Layout
 * Layout wrapper for all admin pages
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Dashboard - Goodlife",
  description: "Administrative dashboard for managing users and system settings",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Header Section */}
      <div 
        className="border-b shadow-sm"
        style={{ 
          backgroundColor: "#FFFFFF",
          borderColor: "#E2E8F0"
        }}
      >
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Title Section */}
            <div>
              <h1 
                className="text-2xl font-bold"
                style={{ color: "#0F172A" }}
              >
                Manage Users and System Settings
              </h1>
              <p 
                className="text-sm mt-1"
                style={{ color: "#64748B" }}
              >
                Administrative controls for the Goodlife platform
              </p>
            </div>
            
            {/* Navigation Links */}
            <nav className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ease-in-out hover:bg-slate-100"
                style={{ color: "#475569" }}
              >
                Back to Dashboard
              </Link>
              <Link
                href="/admin/users"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ease-in-out hover:bg-slate-100"
                style={{ color: "#475569" }}
              >
                Users
              </Link>
              <Link
                href="/admin/payment-requests"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ease-in-out hover:bg-slate-100"
                style={{ color: "#475569" }}
              >
                Payment Requests
              </Link>
            </nav>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}















