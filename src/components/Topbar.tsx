"use client";
import { LogOut } from "lucide-react";
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
    <header 
      className="sticky top-0 z-10 bg-white transition-colors"
      style={{
        // borderBottom: '1px solid #E5E7EB',
      }}
    >
      <div className="flex items-center justify-end gap-4 px-6 py-4">
        {user && (
          <div className="text-sm text-gray-800">
            <span className="font-medium">{user.email}</span>
            <span className="ml-2 capitalize text-gray-600">({user.role})</span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 ease-in-out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
