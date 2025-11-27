"use client";

import Link from "next/link";

export default function LegalFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-600">
              © 2025 Good Life Music
            </p>
            <p className="text-xs text-gray-500 mt-1">
              All Rights Reserved
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy-policy"
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-and-conditions"
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline transition-colors"
            >
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
