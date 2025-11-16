"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Don't show footer on login page
  if (pathname === "/login") {
    return null;
  }

  return (
    <footer className="bg-white border-t border-gray-200 transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
        <p className="text-sm text-gray-600">
          © 2025 Good Life Music
        </p>
        <p className="text-xs text-gray-500 mt-1">
          All Rights Reserved
        </p>
      </div>
    </footer>
  );
}
