"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Footer() {
  const pathname = usePathname();

  // Don't show footer on login page
  if (pathname === "/login") {
    return null;
  }

  return (
    <footer className="bg-white border-t border-gray-200 transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col items-center justify-center gap-3">
          {/* Links */}
          <div className="flex items-center gap-4 text-sm">
            <Link 
              href="/terms" 
              className="text-gray-600 hover:text-emerald-600 transition-colors"
            >
              Terms & Conditions
            </Link>
            <span className="text-gray-300">|</span>
            <Link 
              href="/privacy" 
              className="text-gray-600 hover:text-emerald-600 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
          
          {/* Copyright */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              © 2025 Good Life Music
            </p>
            <p className="text-xs text-gray-500 mt-1">
              All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
