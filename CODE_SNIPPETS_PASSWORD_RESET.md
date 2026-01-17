# Forgot Password Implementation - Code Snippets

## Quick Copy-Paste Reference

Use these snippets to implement or debug the forgot password flow.

---

## 1. Sending Reset Email

**Where:** `/forgot-password` page  
**What:** Sends password reset email to user

```typescript
import { supabase } from "@/lib/supabaseClient";

async function handleForgotPassword(email: string) {
  try {
    // Get current domain dynamically
    const redirectUrl = `${window.location.origin}/reset-password`;

    // Send reset email
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error("Reset password error:", error);
      throw error;
    }

    console.log("Reset email sent successfully");
    return { success: true };
  } catch (err) {
    console.error("Failed to send reset email:", err);
    return { success: false, error: err };
  }
}
```

**Full Example:**

```typescript
"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";

export default function ForgotPasswordForm() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset link sent. Check your email.",
      });

      setEmail("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
    </form>
  );
}
```

---

## 2. Validating Recovery Session

**Where:** `/reset-password` page (useEffect)  
**What:** Checks if user has a valid recovery session from the reset link

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function useValidateRecoverySession() {
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validateSession() {
      try {
        // Get current session (Supabase auto-detects token from URL)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        // Check if this is a recovery session
        if (session && session.user.recovery_sent_at) {
          setIsValid(true);
        } else if (session) {
          setError("Already logged in. Please log out first.");
        } else {
          setError("Invalid or expired recovery link.");
        }
      } catch (err: any) {
        console.error("Session validation error:", err);
        setError(err.message || "Failed to validate session");
      } finally {
        setIsLoading(false);
      }
    }

    validateSession();
  }, []);

  return { isValid, isLoading, error };
}

// Usage in component:
export default function ResetPasswordPage() {
  const { isValid, isLoading, error } = useValidateRecoverySession();

  if (isLoading) {
    return <div>Validating reset link...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!isValid) {
    return <div>Invalid or expired link</div>;
  }

  return <ResetPasswordForm />;
}
```

---

## 3. Updating Password

**Where:** `/reset-password` page (form submission)  
**What:** Updates the user's password using the recovery session

```typescript
import { supabase } from "@/lib/supabaseClient";

async function handleUpdatePassword(newPassword: string) {
  try {
    // Validate password
    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Update password (only works with recovery session)
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    console.log("Password updated successfully");

    // Sign out to clear the recovery session
    await supabase.auth.signOut();

    return { success: true };
  } catch (err) {
    console.error("Password update failed:", err);
    return { success: false, error: err };
  }
}
```

**Full Example with Validation:**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";

export default function ResetPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("At least 8 characters");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("At least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("At least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("At least one number");
    }

    return { valid: errors.length === 0, errors };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate matching
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    // Validate strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast({
        title: "Weak Password",
        description: `Password must contain: ${validation.errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update password (requires recovery session)
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully!",
      });

      // Sign out to clear recovery session
      await supabase.auth.signOut();

      // Redirect to login
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
        />
      </div>

      <div>
        <label>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
          required
        />
      </div>

      <button
        type="submit"
        disabled={
          loading ||
          newPassword !== confirmPassword ||
          newPassword.length < 8
        }
      >
        {loading ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
```

---

## 4. Supabase Client Configuration

**File:** `src/lib/supabaseClient.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auto-refresh token when it expires
    autoRefreshToken: true,

    // Persist session across page reloads
    persistSession: true,

    // ⭐ CRITICAL: Detect recovery token in URL fragment
    detectSessionInUrl: true,

    // Use localStorage (not sessionStorage) for persistence
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
```

---

## 5. Password Strength Checker Hook

**File:** `src/hooks/usePasswordValidation.ts`

```typescript
import { useState, useMemo } from "react";

interface PasswordStrength {
  score: number; // 0-4
  label: string; // "Very Weak" to "Very Strong"
  errors: string[];
  isValid: boolean;
}

export function usePasswordValidation(password: string): PasswordStrength {
  const validation = useMemo(() => {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      errors.push("At least 8 characters");
    } else {
      score++;
      if (password.length >= 12) score++;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      errors.push("At least one uppercase letter");
    } else {
      score++;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      errors.push("At least one lowercase letter");
    } else {
      score++;
    }

    // Number check
    if (!/[0-9]/.test(password)) {
      errors.push("At least one number");
    } else {
      score++;
    }

    // Special character check (optional but recommended)
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("At least one special character (optional but recommended)");
    } else {
      score++;
    }

    const labels = ["Very Weak", "Weak", "Fair", "Good", "Very Strong"];
    const label = labels[Math.min(score, 4)];

    return {
      score: Math.min(score, 4),
      label,
      errors,
      isValid: errors.length === 0,
    };
  }, [password]);

  return validation;
}

// Usage:
export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, label, errors, isValid } = usePasswordValidation(password);

  return (
    <div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded ${
              i <= score ? "bg-blue-500" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={isValid ? "text-green-600" : "text-yellow-600"}>
        {label}
      </p>
      {errors.length > 0 && (
        <ul className="text-sm text-gray-600">
          {errors.map((error) => (
            <li key={error}>• {error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 6. Testing Helpers

**File:** `src/lib/testHelpers.ts`

```typescript
/**
 * Helpers for testing forgot password flow
 */
import { supabase } from "./supabaseClient";

export async function createTestUser(email: string, password: string = "TestPass123!") {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Failed to create test user:", error);
    return null;
  }

  return data.user;
}

export async function deleteTestUser(userId: string) {
  // Note: Only works with service role key (not anon key)
  // Use this in a backend function or CLI script
  console.log(`Delete user ${userId} using Supabase CLI or dashboard`);
}

export async function simulateForgotPasswordFlow(email: string) {
  console.log("🧪 Testing forgot password flow...");

  // Step 1: Send reset email
  console.log("1️⃣ Sending reset email...");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    console.error("❌ Failed to send reset email:", error);
    return false;
  }

  console.log("✅ Reset email sent");
  console.log("📧 Check your email for the reset link");
  console.log("💡 Tip: Check spam/promotions folder");

  return true;
}

export function debugSessionState() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("🔐 Auth State Change:", {
      event,
      hasSession: !!session,
      sessionType: session?.user.recovery_sent_at ? "recovery" : "normal",
      user: session?.user.email,
    });
  });
}
```

---

## 7. Common Debugging Commands

**Console Log Helpers:**

```typescript
// Check current session
const { data: { session } } = await supabase.auth.getSession();
console.log("Current Session:", session);

// Check if recovery session
console.log("Is Recovery:", session?.user.recovery_sent_at ? "Yes" : "No");

// Get URL hash (where token is)
console.log("URL Fragment:", window.location.hash);

// Check localStorage
console.log("Stored Session:", localStorage.getItem("sb-nyxedsuflhvxzijjiktj-auth-token"));

// Sign out (for testing)
await supabase.auth.signOut();
console.log("Signed out");

// Check Supabase client config
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Anon Key set:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
```

---

## 8. Error Handling Examples

```typescript
/**
 * Handle different error scenarios
 */
async function handlePasswordResetError(error: any) {
  const errorMessage = error.message?.toLowerCase() || "";

  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return {
      title: "Too Many Requests",
      message: "Please wait a few minutes before trying again",
      recoverable: true,
    };
  }

  if (errorMessage.includes("recovery") || errorMessage.includes("session")) {
    return {
      title: "Session Expired",
      message: "Your reset link has expired. Please request a new one.",
      recoverable: true,
    };
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("not found")) {
    return {
      title: "Invalid Email",
      message: "This email is not registered",
      recoverable: true,
    };
  }

  if (errorMessage.includes("weak") || errorMessage.includes("password")) {
    return {
      title: "Weak Password",
      message: "Password does not meet security requirements",
      recoverable: true,
    };
  }

  return {
    title: "Error",
    message: error.message || "An unexpected error occurred",
    recoverable: false,
  };
}
```

---

## 9. Analytics Events

```typescript
/**
 * Track password reset events for analytics
 */

function trackEvent(eventName: string, properties?: Record<string, any>) {
  // Replace with your analytics provider (e.g., Mixpanel, Segment, etc.)
  console.log(`📊 Event: ${eventName}`, properties);

  if (window.gtag) {
    window.gtag("event", eventName, properties);
  }
}

// Track forgot password email sent
async function trackForgotPasswordEmailSent(email: string) {
  trackEvent("forgot_password_email_sent", {
    email_domain: email.split("@")[1],
    timestamp: new Date().toISOString(),
  });
}

// Track password reset successful
async function trackPasswordResetSuccess(userId: string) {
  trackEvent("password_reset_success", {
    user_id: userId,
    timestamp: new Date().toISOString(),
  });
}

// Track password reset failed
async function trackPasswordResetFailed(reason: string) {
  trackEvent("password_reset_failed", {
    reason,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 10. Rate Limiting Implementation

```typescript
/**
 * Client-side rate limiting for password reset requests
 */

const RESET_COOLDOWN_MS = 60000; // 60 seconds
const RESET_COOLDOWN_KEY = "last_reset_request";

export function getResetCooldownTime(): number {
  const lastRequest = localStorage.getItem(RESET_COOLDOWN_KEY);
  if (!lastRequest) return 0;

  const elapsed = Date.now() - parseInt(lastRequest);
  const remaining = Math.max(0, RESET_COOLDOWN_MS - elapsed);

  return Math.ceil(remaining / 1000); // Return seconds
}

export function setResetCooldown(): void {
  localStorage.setItem(RESET_COOLDOWN_KEY, Date.now().toString());
}

export function canRequestReset(): boolean {
  return getResetCooldownTime() === 0;
}

// Usage in component:
export function ForgotPasswordForm() {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds === 0) return;

    const timer = setTimeout(() => {
      setCooldownSeconds(cooldownSeconds - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canRequestReset()) {
      setCooldownSeconds(getResetCooldownTime());
      return;
    }

    // Send reset email...
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (!error) {
      setResetCooldown();
      setCooldownSeconds(60);
    }
  }

  return (
    <button disabled={cooldownSeconds > 0}>
      {cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : "Send Reset Link"}
    </button>
  );
}
```

---

## Quick Debugging Checklist

```bash
# 1. Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Check if email was sent (in Supabase dashboard)
# Go to: Authentication → Logs → View all

# 3. Verify redirect URLs whitelisted
# Go to: Authentication → URL Configuration

# 4. Test in browser console
await supabase.auth.resetPasswordForEmail("test@example.com", {
  redirectTo: window.location.origin + "/reset-password"
})

# 5. Check if session exists
const { data: { session } } = await supabase.auth.getSession()
console.log(session)

# 6. Check localStorage
localStorage.getItem("sb-YOUR_PROJECT_ID-auth-token")

# 7. Check if recovery session
if (session?.user.recovery_sent_at) {
  console.log("✅ Recovery session detected")
} else {
  console.log("❌ No recovery session")
}
```

