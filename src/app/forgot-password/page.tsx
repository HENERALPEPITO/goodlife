"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail } from "lucide-react";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Use the current origin for the redirect URL
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Handle rate limiting specifically
        if (error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many")) {
          toast({
            title: "Too Many Requests",
            description: "Please wait a few minutes before requesting another password reset.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to send reset link. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Password reset link sent. Check your inbox.",
        });
        
        // Set cooldown to prevent spam
        setCooldown(true);
        setTimeout(() => setCooldown(false), 60000); // 60 second cooldown
        
        // Clear form
        setEmail("");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - Forgot Password Form */}
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

          {/* Back to Login */}
          <button
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h1>
            <p className="text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || cooldown}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm tracking-wide">
                {loading ? "SENDING..." : cooldown ? "WAIT 60 SECONDS" : "SEND RESET LINK"}
              </span>
            </button>
            
            {cooldown && (
              <p className="text-xs text-center text-gray-500 -mt-2">
                Please wait before sending another request
              </p>
            )}
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
