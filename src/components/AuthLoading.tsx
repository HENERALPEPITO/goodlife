"use client";

import { Loader2 } from "lucide-react";

interface AuthLoadingProps {
  message?: string;
}

/**
 * AuthLoading Component
 * 
 * Displays a loading spinner while authentication is being verified.
 * Prevents UI hang by showing a clear loading state.
 */
export default function AuthLoading({ message = "Loading..." }: AuthLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}
