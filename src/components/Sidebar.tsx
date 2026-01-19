"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, BarChart3, DollarSign, Music, FileUp, Users, Settings, Upload, User, Loader2, Menu, X, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isInitialized, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  useEffect(() => setMounted(true), []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  if (pathname === "/login") return null;

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

  const SidebarContent = () => (
    <>
      <div className="p-6 flex-shrink-0">
        <Link
          href="/"
          className="flex items-center justify-center hover:opacity-80 transition-opacity mb-8"
          onClick={() => setMobileMenuOpen(false)}
        >
          <Image
            src="/logo.png"
            alt="GOOD LIFE MUSIC"
            width={160}
            height={60}
            className="object-contain w-auto h-auto max-w-full"
            style={{ filter: "invert(1)" }}
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out ${active ? "font-semibold" : "font-normal"
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
                onClick={() => setMobileMenuOpen(false)}
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
            <button
              onClick={handleSignOut}
              className="md:hidden mt-4 flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors w-full p-2 rounded hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-4 bg-black shadow-md"
        role="banner"
      >
        <Link href="/" className="flex items-center" aria-label="Go to homepage">
          <Image
            src="/logo.png"
            alt="GOOD LIFE MUSIC"
            width={100}
            height={36}
            className="object-contain w-auto h-8"
            style={{ filter: "invert(1)" }}
            priority
          />
        </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        id="mobile-sidebar"
        className={`md:hidden fixed top-0 left-0 bottom-0 w-64 z-[70] bg-black shadow-2xl transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        aria-label="Mobile navigation"
      >
        <div className="flex flex-col h-full">
          {/* Mobile Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="text-white font-semibold">Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pb-6">
            <SidebarContent />
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 fixed h-screen shadow-md"
        style={{
          backgroundColor: "#000000",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}