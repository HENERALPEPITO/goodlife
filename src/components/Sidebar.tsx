"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { LayoutDashboard, BarChart3, DollarSign, Music, FileUp, Users, Settings, Upload, User } from "lucide-react";
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
    { href: "/artist/payment-request", label: "Payment Request", icon: DollarSign, show: !isAdmin },
    { href: "/artist/payments", label: "My Payments", icon: DollarSign, show: !isAdmin },
    { href: "/artist/catalog", label: "My Catalog", icon: Music, show: !isAdmin },
    { href: "/artist/profile", label: "My Profile", icon: User, show: !isAdmin },
    { href: "/artists", label: "Artists", icon: Users, show: isAdmin },
    { href: "/admin/artists", label: "Manage Artists", icon: Users, show: isAdmin },
    { href: "/admin/payment-requests", label: "Payment Requests", icon: DollarSign, show: isAdmin },
    { href: "/admin/invoice-settings", label: "Invoice Settings", icon: Settings, show: isAdmin },
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
      className="hidden md:flex flex-col w-64 fixed h-screen bg-white transition-colors"
      style={{
        borderRight: '1px solid #E5E7EB',
        boxShadow: '2px 0 20px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div className="p-6 flex-shrink-0">
        <Link href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity mb-8">
          <Image
            src="/logo.png"
            alt="GOOD LIFE MUSIC"
            width={160}
            height={60}
            className="object-contain w-auto h-auto max-w-full brightness-0"
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out ${
                  active
                    ? "font-medium"
                    : "font-normal"
                }`}
                style={{
                  backgroundColor: active 
                    ? '#EFF6FF' 
                    : 'transparent',
                  color: active 
                    ? '#2563EB' 
                    : '#6B7280',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                    e.currentTarget.style.color = '#2563EB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6B7280';
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
        style={{ borderColor: '#E5E7EB' }}
      >
        {user && (
          <div className="text-xs">
            <p className="font-medium mb-1 truncate text-gray-800">{user.email}</p>
            <p className="capitalize text-gray-600">{user.role}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
