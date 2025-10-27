"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Music2, LayoutDashboard, BarChart3, DollarSign, Music, FileUp, Users, Settings } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

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
    { href: "/catalog", label: "Catalog", icon: Music, show: true },
    { href: "/artists", label: "Artists", icon: Users, show: isAdmin },
    { href: "/royalty-uploader", label: "Upload CSV", icon: FileUp, show: isAdmin },
    { href: "/settings", label: "Settings", icon: Settings, show: true },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex flex-col gap-2 border-r border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Music2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        <span className="font-bold text-lg">GoodLife</span>
      </div>
      
      {user && (
        <div className="mb-2 px-2 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Signed in as
          </div>
          <div className="text-sm font-medium mt-0.5 truncate">{user.email}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Role: <span className="font-semibold capitalize">{user.role}</span>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-1 text-sm">
        {navItems.map((item) => {
          if (!item.show) return null;
          
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 text-center">
          © {new Date().getFullYear()} GoodLife
        </div>
      </div>
    </aside>
  );
}

