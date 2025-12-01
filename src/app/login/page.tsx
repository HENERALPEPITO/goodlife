"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setError(result.error.message || "Authentication failed");
        setLoading(false);
      } else {
        // Redirect to main dashboard for all users
        router.push("/");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-6 lg:p-8 min-h-[50vh] lg:min-h-screen">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo.png"
              alt="Good Life Music Logo"
              width={120}
              height={120}
              className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain"
              priority
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <input
                type="email"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password Input */}
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Keep Me Signed In Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="keepSignedIn"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="keepSignedIn" className="ml-2 text-sm text-gray-700 cursor-pointer select-none">
                Keep Me Signed In
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            {/* Sign In Button with Gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <span className="text-sm tracking-wide">{loading ? "SIGNING IN..." : "SIGN IN"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            {/* Forgot Password Link */}
            <div className="text-right pt-1">
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="text-xs text-gray-500 hover:text-gray-900 hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="w-full lg:w-3/5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8 lg:p-12 min-h-[50vh] lg:min-h-screen">
        <div className="text-center px-4 lg:px-12">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 lg:mb-4 tracking-tight leading-none">
            Good Life Music Client Portal
          </h1>
          
          {/* Quote */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-400 font-light italic tracking-wide">
            "Empowering artists worldwide"
          </p>
        </div>
      </div>
    </div>
  );
}


