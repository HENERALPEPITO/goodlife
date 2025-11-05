"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { LayoutDashboard, BarChart3, DollarSign, Music, FileUp, Users, Settings, Receipt, Upload, User } from "lucide-react";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show sidebar on login page
  if (pathname === "/login") {
    return null;
  }

  const isAdmin = user?.role === "admin";

  // Navigation items based on role
  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/analytics", label: "Analytics", icon: BarChart3, show: true },
    { href: "/royalties", label: "Royalties", icon: DollarSign, show: true },
    { href: "/invoices", label: "Invoices", icon: Receipt, show: true },
    { href: "/catalog", label: "Catalog", icon: Music, show: true },
    { href: "/artist/catalog", label: "My Catalog", icon: Music, show: !isAdmin },
    { href: "/artist/profile", label: "My Profile", icon: User, show: !isAdmin },
    { href: "/artists", label: "Artists", icon: Users, show: isAdmin },
    { href: "/admin/artists", label: "Manage Artists", icon: Users, show: isAdmin },
    { href: "/admin/artist-tracks", label: "Track Catalog", icon: Upload, show: isAdmin },
    { href: "/royalty-uploader", label: "Upload Royalties", icon: FileUp, show: isAdmin },
    { href: "/settings", label: "Settings", icon: Settings, show: true },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside 
      className="hidden md:flex flex-col w-64 fixed h-screen backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--glass-bg)',
        borderRight: '1px solid var(--glass-border)',
        boxShadow: '2px 0 20px var(--shadow)',
      }}
    >
      <div className="p-6 flex-shrink-0">
        <Link href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity mb-8">
          <Image
            src="/logo.png"
            alt="GOOD LIFE MUSIC"
            width={160}
            height={60}
            className={`object-contain w-auto h-auto max-w-full transition-all ${
              mounted && theme === "light" 
                ? "brightness-0" 
                : "brightness-0 invert"
            }`}
            priority
          />
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            if (!item.show) return null;
            
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  active
                    ? "font-medium"
                    : "font-normal"
                }`}
                style={{
                  backgroundColor: active 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : 'transparent',
                  color: active 
                    ? 'var(--accent-blue)' 
                    : 'var(--text-secondary)',
                  borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--glass-bg)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon className="h-4 w-4" style={{ color: 'inherit' }} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div 
        className="mt-auto p-6 border-t flex-shrink-0 transition-colors"
        style={{ borderColor: 'var(--glass-border)' }}
      >
        {user && (
          <div className="text-xs transition-colors">
            <p className="font-medium mb-1 truncate" style={{ color: 'var(--text-primary)' }}>{user.email}</p>
            <p className="capitalize" style={{ color: 'var(--text-secondary)' }}>{user.role}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
