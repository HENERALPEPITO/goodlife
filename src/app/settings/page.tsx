"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { User, Mail, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Manage your account settings
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-zinc-500">User ID</div>
              <div className="font-medium">{user.id.substring(0, 8)}...</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm text-zinc-500">Email Address</div>
              <div className="font-medium">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-sm text-zinc-500">Role</div>
              <div className="font-medium capitalize">{user.role}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-semibold mb-2">Account Type</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          {user.role === "admin" 
            ? "You have full administrative access to the system. You can manage all artists, upload royalty data, and approve payment requests."
            : "You have artist access. You can view your personal data, analytics, and request payments."}
        </p>
        
        {user.role === "artist" && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Artist Features
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>✓ View personal analytics and charts</li>
              <li>✓ Access royalty statements</li>
              <li>✓ Request payments</li>
              <li>✓ View track catalog</li>
            </ul>
          </div>
        )}

        {user.role === "admin" && (
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 p-4 border border-purple-200 dark:border-purple-800">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
              Admin Features
            </div>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>✓ Manage all artists</li>
              <li>✓ Upload CSV royalty data</li>
              <li>✓ Edit tracks and royalties</li>
              <li>✓ Approve payment requests</li>
              <li>✓ View system-wide analytics</li>
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-semibold mb-2">Support</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Need help? Contact the GoodLife support team for assistance with your account.
        </p>
      </section>
    </div>
  );
}
