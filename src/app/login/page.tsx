"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("artist");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password, role as any);
      } else {
        result = await signIn(email, password);
      }

      if (result.error) {
        setError(result.error.message || "Authentication failed");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Radial glow effect behind the card */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
        }}
      />
      
      {/* Glassmorphic Login Card */}
      <div className="relative w-full max-w-md">
        <form 
          onSubmit={onSubmit} 
          className="relative backdrop-blur-md rounded-2xl p-8 space-y-6 shadow-xl"
          style={{
            backgroundColor: 'rgba(18, 18, 18, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Subtle inner glow */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-20"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
            }}
          />

          {/* Title */}
          <div className="relative z-10 text-center mb-8">
            <h1 
              className="text-3xl font-bold mb-2"
              style={{
                color: 'rgba(255, 255, 255, 0.95)',
                textShadow: '0 2px 10px rgba(255, 255, 255, 0.1)',
              }}
            >
              {isSignUp ? "Join GoodLife" : "Welcome Back"}
            </h1>
            <p 
              className="text-sm"
              style={{ color: 'rgba(156, 163, 175, 0.8)' }}
            >
              {isSignUp ? "Create your account" : "Sign in to continue"}
            </p>
          </div>

          {/* Input Fields */}
          <div className="relative z-10 space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-0"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
            </div>

            {isSignUp && (
              <div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-offset-0"
                  style={{
                    backgroundColor: '#F9FAFB',
                    color: '#0A0A0A',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3B82F6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                    e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <option value="artist">Artist</option>
                  <option value="label">Label</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            )}

            {error && (
              <div 
                className="text-sm px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#FCA5A5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
            style={{
              background: 'linear-gradient(to right, #3B82F6, #06B6D4)',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)';
            }}
          >
            <span className="relative z-10">
              {loading ? "Loading..." : (isSignUp ? "Sign up" : "Sign in")}
            </span>
          </button>

          {/* Toggle Sign Up/Sign In */}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="w-full text-sm text-center transition-colors duration-200 relative z-10"
            style={{ color: '#9CA3AF' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D1D5DB';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9CA3AF';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>

          {/* Test Credentials */}
          <div 
            className="mt-6 pt-6 border-t relative z-10"
            style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
          >
            <p 
              className="text-xs font-semibold mb-3"
              style={{ color: 'rgba(156, 163, 175, 0.9)' }}
            >
              Test Accounts:
            </p>
            <div className="space-y-2 text-xs" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>
              <div>
                <span className="font-medium">Admin:</span> admin@test.com / admin123456
              </div>
              <div>
                <span className="font-medium">Artist:</span> artist@test.com / artist123456
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("admin@test.com");
                setPassword("admin123456");
                setIsSignUp(false);
              }}
              className="mt-3 w-full px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#93C5FD',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
              }}
            >
              Fill Admin Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


