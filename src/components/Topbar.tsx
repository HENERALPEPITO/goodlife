"use client";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Topbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header 
      className="sticky top-0 z-10 backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--glass-bg)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: '0 1px 10px var(--shadow)',
      }}
    >
      <div className="flex items-center justify-end gap-4 px-6 py-4">
        {user && (
          <div className="text-sm transition-colors" style={{ color: 'var(--text-primary)' }}>
            <span className="font-medium">{user.email}</span>
            <span className="ml-2 capitalize" style={{ color: 'var(--text-secondary)' }}>({user.role})</span>
          </div>
        )}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)',
              backgroundColor: 'var(--glass-bg)',
            }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            backgroundColor: 'var(--glass-bg)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
