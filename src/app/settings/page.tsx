"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { User, Mail, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const isDark = mounted && theme === "dark";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Settings</h1>
        <p className="text-sm mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          Manage your account settings
        </p>
      </div>

      <section 
        className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Profile Information</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
              }}
            >
              <User className="h-5 w-5" style={{ color: '#60A5FA' }} />
            </div>
            <div>
              <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>User ID</div>
              <div className="font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{user.id.substring(0, 8)}...</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
              }}
            >
              <Mail className="h-5 w-5" style={{ color: '#4ADE80' }} />
            </div>
            <div>
              <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Email Address</div>
              <div className="font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
              }}
            >
              <Shield className="h-5 w-5" style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Role</div>
              <div className="font-medium capitalize transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{user.role}</div>
            </div>
          </div>
        </div>
      </section>

      <section 
        className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 className="text-lg font-semibold mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Account Type</h2>
        <p className="text-sm mb-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          {user.role === "admin" 
            ? "You have full administrative access to the system. You can manage all artists, upload royalty data, and approve payment requests."
            : "You have artist access. You can view your personal data, analytics, and request payments."}
        </p>
        
        {user.role === "artist" && (
          <div 
            className="rounded-lg p-4 backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)',
            }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: '#93C5FD' }}>
              Artist Features
            </div>
            <ul className="text-sm space-y-1" style={{ color: '#BFDBFE' }}>
              <li>✓ View personal analytics and charts</li>
              <li>✓ Access royalty statements</li>
              <li>✓ Request payments</li>
              <li>✓ View track catalog</li>
            </ul>
          </div>
        )}

        {user.role === "admin" && (
          <div 
            className="rounded-lg p-4 backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.2)',
            }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: '#C4B5FD' }}>
              Admin Features
            </div>
            <ul className="text-sm space-y-1" style={{ color: '#DDD6FE' }}>
              <li>✓ Manage all artists</li>
              <li>✓ Upload CSV royalty data</li>
              <li>✓ Edit tracks and royalties</li>
              <li>✓ Approve payment requests</li>
              <li>✓ View system-wide analytics</li>
            </ul>
          </div>
        )}
      </section>

      <section 
        className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 className="text-lg font-semibold mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Support</h2>
        <p className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          Need help? Contact the GoodLife support team for assistance with your account.
        </p>
      </section>
    </div>
  );
}
