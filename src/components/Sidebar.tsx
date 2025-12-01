"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, BarChart3, DollarSign, Music, FileUp, Users, Settings, Upload, User, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, loading, isInitialized } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (pathname === "/login") return null;

  // Show loading skeleton while auth initializes
  const showSkeleton = !isInitialized || loading;
  const isAdmin = user?.role === "admin";

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/admin/artist-tracks", label: "Track Catalog", icon: Upload, show: isAdmin },
    { href: "/analytics", label: "Analytics", icon: BarChart3, show: true },
    { href: "/royalties", label: "Royalties", icon: DollarSign, show: !isAdmin },
    { href: "/artist/payments", label: "My Payments", icon: DollarSign, show: !isAdmin },
    { href: "/artist/catalog", label: "My Catalog", icon: Music, show: !isAdmin },
    { href: "/artist/profile", label: "My Profile", icon: User, show: !isAdmin },
    { href: "/admin/artists", label: "Manage Artists", icon: Users, show: isAdmin },
    { href: "/admin/royalties", label: "Royalties Management", icon: DollarSign, show: isAdmin },
    { href: "/admin/payment-requests", label: "Payment Requests", icon: DollarSign, show: isAdmin },
    { href: "/admin/invoice-settings", label: "Invoice Settings", icon: Settings, show: isAdmin },
    { href: "/royalty-uploader", label: "Upload Royalties", icon: FileUp, show: isAdmin },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className="hidden md:flex flex-col w-64 fixed h-screen shadow-md"
      style={{
        backgroundColor: "#000000", // dark background
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
      }}
    >
      <div className="p-6 flex-shrink-0">
        <Link
          href="/"
          className="flex items-center justify-center hover:opacity-80 transition-opacity mb-8"
        >
          <Image
            src="/logo.png"
            alt="GOOD LIFE MUSIC"
            width={160}
            height={60}
            className="object-contain w-auto h-auto max-w-full"
            style={{ filter: "invert(1)" }} // invert logo color
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
                  active ? "font-semibold" : "font-normal"
                }`}
                style={{
                  backgroundColor: active ? "#1A1A1A" : "transparent",
                  color: active ? "#ffffff" : "#cccccc",
                  borderLeft: active ? "3px solid #ffffff" : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "#1A1A1A";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#cccccc";
                  }
                }}
              >
                <Icon className="h-4 w-4" style={{ color: "inherit" }} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className="mt-auto p-6 border-t flex-shrink-0 transition-colors"
        style={{ borderColor: "#222222" }}
      >
        {showSkeleton ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#aaaaaa" }} />
            <span className="text-xs" style={{ color: "#aaaaaa" }}>Loading...</span>
          </div>
        ) : user ? (
          <div className="text-xs">
            <p className="font-medium mb-1 truncate" style={{ color: "#ffffff" }}>
              {user.email}
            </p>
            <p className="capitalize" style={{ color: "#aaaaaa" }}>
              {user.role}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
