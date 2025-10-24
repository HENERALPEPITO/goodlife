"use client";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 p-3 md:p-4">
        <button className="md:hidden p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {user && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.email} ({user.role})
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  return (
    <button
      className="px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      onClick={() => {
        const html = document.documentElement;
        html.classList.toggle("dark");
      }}
    >
      Toggle theme
    </button>
  );
}



