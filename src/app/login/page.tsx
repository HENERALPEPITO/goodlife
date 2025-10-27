"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        // Redirect to home - it will show the right dashboard based on role
        router.push("/");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
        <h1 className="text-lg font-semibold">{isSignUp ? "Sign up" : "Sign in"}</h1>
        
        <Input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <Input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        {isSignUp && (
          <select 
            className="w-full px-3 py-2 rounded border bg-transparent" 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="artist">Artist</option>
            <option value="label">Label</option>
            <option value="manager">Manager</option>
          </select>
        )}
        
        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
        
        <Button 
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Loading..." : (isSignUp ? "Sign up" : "Sign in")}
        </Button>
        
        <button 
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
        
        {/* Quick test credentials */}
        <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">
          <p className="font-semibold mb-2">Test Accounts:</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium">Admin:</p>
              <p className="text-xs">admin@test.com / admin123456</p>
            </div>
            <div>
              <p className="text-xs font-medium">Artist:</p>
              <p className="text-xs">artist@test.com / artist123456</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail("admin@test.com");
                setPassword("admin123456");
                setIsSignUp(false);
              }}
              className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Fill Admin Credentials
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


