# Production Forgot Password Implementation Guide
## Supabase Auth v2 for https://clientportal.goodlife-publishing.com

---

## 📋 Table of Contents
1. [Supabase Dashboard Configuration](#1-supabase-dashboard-configuration)
2. [Password Reset Flow Architecture](#2-password-reset-flow-architecture)
3. [Code Implementation](#3-code-implementation)
4. [Testing & Validation](#4-testing--validation)
5. [Common Mistakes & Pitfalls](#5-common-mistakes--pitfalls)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Supabase Dashboard Configuration

### ⚠️ CRITICAL: Redirect URL Whitelist

This step determines whether password reset emails work at all. **Do not skip this.**

**Steps:**

1. Go to **[Supabase Dashboard](https://app.supabase.com)** → Your Project
2. Navigate to **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add BOTH:
   ```
   http://localhost:3000/resetpassword
   https://clientportal.goodlife-publishing.com/resetpassword
   ```

4. **Important**: The URL uses `/resetpassword` (lowercase, no hyphen) by default in Supabase redirects
   - If your app uses `/reset-password` (with hyphen), add both:
     ```
     https://clientportal.goodlife-publishing.com/resetpassword
     https://clientportal.goodlife-publishing.com/reset-password
     ```

5. Click **Save**

**Why this matters:**
- Supabase validates all reset links against this whitelist for security
- If your redirect URL is not whitelisted, reset emails will work BUT clicking the link will fail with an error
- This is a CORS-style protection mechanism

### 📧 Email Configuration (Optional but Recommended)

To customize the password reset email template:

1. Navigate to **Authentication** → **Email Templates**
2. Click on **Reset Password**
3. Customize the template (you can use variables):
   - `{{ .ConfirmationURL }}` - The reset link
   - `{{ .Token }}` - The reset token (NOT recommended for display)
   - `{{ .EmailAddress }}` - User's email

**Example custom template:**
```html
<h2>Reset Your Password</h2>
<p>Hello,</p>
<p>We received a request to reset your password. Click the button below to create a new password:</p>
<a href="{{ .ConfirmationURL }}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
  Reset Password
</a>
<p>This link expires in 24 hours.</p>
<p>If you didn't request this, ignore this email.</p>
<p>— Good Life Music Portal Team</p>
```

---

## 2. Password Reset Flow Architecture

### Complete User Journey

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PASSWORD RESET FLOW                            │
└──────────────────────────────────────────────────────────────────────┘

User visits login page
         │
         ▼
┌─────────────────────────────────┐
│ Clicks "Forgot Password?"       │  → Navigate to /forgot-password
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ /forgot-password Page           │  (React Client Component)
│ - Displays email input form     │
│ - User enters email             │
│ - Clicks "Send Reset Link"      │
└─────────────────────────────────┘
         │
         │ Calls: supabase.auth.resetPasswordForEmail(email, {
         │   redirectTo: "https://clientportal.goodlife-publishing.com/reset-password"
         │ })
         ▼
┌─────────────────────────────────┐
│ Supabase Auth Backend           │
│ - Validates email exists        │
│ - Generates recovery token      │
│ - Sends email with link:        │
│   https://.../reset-password    │
│   #access_token=...&type=...    │
└─────────────────────────────────┘
         │
         │ User receives email
         │ Clicks reset link
         ▼
┌─────────────────────────────────┐
│ Browser loads URL with fragment │
│ https://clientportal.../        │
│ reset-password                  │
│ #access_token=abc&type=...      │
└─────────────────────────────────┘
         │
         │ useEffect in React:
         │ 1. Component mounts
         │ 2. Supabase auto-detects token in URL fragment
         │ 3. Creates RECOVERY session in memory
         │ 4. session now exists (no DB lookup needed)
         ▼
┌─────────────────────────────────┐
│ /reset-password Page            │  (React Client Component)
│ - useEffect validates session   │
│ - If session exists:            │
│   - Show password form          │
│ - If NO session:                │
│   - Show "Invalid link" error   │
│   - Redirect to /login          │
└─────────────────────────────────┘
         │
         │ User enters new password
         │ Clicks "Update Password"
         ▼
┌─────────────────────────────────┐
│ Calls:                          │
│ supabase.auth.updateUser({      │
│   password: "newPassword"       │
│ })                              │
│                                 │
│ (Works ONLY because recovery    │
│  session was established)       │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Supabase Auth Backend           │
│ - Validates recovery session    │
│ - Updates password in auth      │
│ - Invalidates recovery token    │
│ - Returns success               │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ React Component:                │
│ - Clears session (sign out)     │
│ - Shows "Success!" toast        │
│ - Redirects to /login           │
│ - User logs in with new pwd     │
└─────────────────────────────────┘
```

### Key Points About the Flow

1. **Token is in URL fragment (#)**, not query params (?):
   - `https://example.com/reset-password#access_token=xyz`
   - NOT in the search: `?access_token=xyz`
   - This is for security (fragment never sent to server)

2. **Supabase auto-detects token**:
   - When the page loads, the Supabase client checks `window.location.hash`
   - If a valid recovery token is found, it creates a SESSION automatically
   - You do NOT manually parse the token

3. **Recovery session is temporary**:
   - Only valid for a specific time window (set in Supabase)
   - Expires after 1 successful password update
   - Expires if the token is old

4. **updateUser() only works in recovery session**:
   - Without the session, `updateUser()` fails
   - With the session, password is updated securely

---

## 3. Code Implementation

### 3.1 Forgot Password Page (/forgot-password)

This page handles sending the reset email.

**File:** `src/app/forgot-password/page.tsx`

```tsx
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
      // IMPORTANT: Use window.location.origin to get the correct domain
      // This ensures it works in dev (localhost:3000) and production
      const redirectUrl = `${window.location.origin}/reset-password`;

      // Call Supabase to send reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Handle rate limiting specifically
        if (
          error.message?.includes("429") ||
          error.message?.toLowerCase().includes("rate limit") ||
          error.message?.toLowerCase().includes("too many")
        ) {
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
          description: "Password reset link sent. Check your inbox and spam folder.",
        });

        // Set cooldown to prevent spam
        setCooldown(true);
        setTimeout(() => setCooldown(false), 60000); // 60 second cooldown

        // Clear form
        setEmail("");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
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
                  placeholder="your@email.com"
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

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <strong>Tip:</strong> Check your spam folder if you don't see the email within a few minutes.
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="w-full lg:w-3/5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8 lg:p-12 min-h-[50vh] lg:min-h-screen">
        <div className="text-center px-4 lg:px-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 lg:mb-4 tracking-tight leading-none">
            Good Life Music Client Portal
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-slate-400 font-light italic tracking-wide">
            "Empowering artists worldwide"
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Key Implementation Details:**

| Aspect | Details |
|--------|---------|
| **`window.location.origin`** | Dynamically gets the current domain (localhost:3000 or production) |
| **Error Handling** | Special handling for rate-limit errors (429) |
| **Cooldown** | 60-second rate limit to prevent spam |
| **Toast Messages** | User feedback on success/failure |
| **Form Clear** | Clears email after successful submission |

---

### 3.2 Reset Password Page (/reset-password)

This page validates the recovery session and updates the password.

**File:** `src/app/reset-password/page.tsx`

```tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import Image from "next/image";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check for valid recovery session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error checking session:", error);
          throw error;
        }

        // Check if session type is recovery (password reset)
        if (session && session.user.recovery_sent_at) {
          // This is a recovery session - user came from reset email
          setIsValidToken(true);
        } else if (session) {
          // Has a session but not from recovery email
          toast({
            title: "Already Logged In",
            description: "You're already logged in. Please log out first to use this link.",
            variant: "destructive",
          });
          setTimeout(() => router.push("/login"), 2000);
        } else {
          // No session - invalid or expired link
          toast({
            title: "Invalid or Expired Link",
            description: "This password reset link is invalid or has expired. Please request a new one.",
            variant: "destructive",
          });
          setTimeout(() => router.push("/forgot-password"), 3000);
        }
      } catch (err) {
        console.error("Session check error:", err);
        toast({
          title: "Error",
          description: "An error occurred while validating the reset link.",
          variant: "destructive",
        });
        setTimeout(() => router.push("/login"), 3000);
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please ensure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    // Check password complexity
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumbers = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumbers) {
      toast({
        title: "Weak Password",
        description: "Password must contain uppercase, lowercase, and numbers.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // This only works if we have a recovery session
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        if (error.message?.includes("recovery") || error.message?.includes("session")) {
          toast({
            title: "Session Expired",
            description: "Your reset link has expired. Please request a new one.",
            variant: "destructive",
          });
          setTimeout(() => router.push("/forgot-password"), 2000);
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to update password. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success!",
          description: "Your password has been updated successfully. Redirecting to login...",
        });

        // Sign out the user (clear the recovery session)
        await supabase.auth.signOut();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      console.error("Password update error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (isChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">This password reset link is invalid or has expired.</p>
          <button
            onClick={() => router.push("/forgot-password")}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  // Valid token - show form
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - Reset Password Form */}
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

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Reset Your Password
            </h1>
            <p className="text-sm text-gray-600">
              Create a strong new password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password Input */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
            </div>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <div className={`flex-1 h-1 rounded ${newPassword.length >= 8 ? "bg-yellow-400" : "bg-gray-200"}`}></div>
                  <div className={`flex-1 h-1 rounded ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "bg-blue-400" : "bg-gray-200"}`}></div>
                  <div className={`flex-1 h-1 rounded ${/[0-9]/.test(newPassword) ? "bg-green-400" : "bg-gray-200"}`}></div>
                </div>
                <div className="text-xs text-gray-600">
                  <div className={`flex items-center gap-1 ${newPassword.length >= 8 ? "text-green-600" : "text-gray-500"}`}>
                    {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                  </div>
                  <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "text-green-600" : "text-gray-500"}`}>
                    {/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "✓" : "○"} Upper and lowercase letters
                  </div>
                  <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? "text-green-600" : "text-gray-500"}`}>
                    {/[0-9]/.test(newPassword) ? "✓" : "○"} At least one number
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Match Indicator */}
            {confirmPassword && (
              <div className={`flex items-center gap-2 text-sm ${newPassword === confirmPassword ? "text-green-600" : "text-red-600"}`}>
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Passwords match
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Passwords do not match
                  </>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                loading ||
                newPassword !== confirmPassword ||
                newPassword.length < 8 ||
                !/[A-Z]/.test(newPassword) ||
                !/[a-z]/.test(newPassword) ||
                !/[0-9]/.test(newPassword)
              }
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span className="text-sm tracking-wide">
                {loading ? "UPDATING..." : "UPDATE PASSWORD"}
              </span>
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Security:</strong> This link is secure and expires in 24 hours. Your password is encrypted in transit and at rest.
          </div>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="w-full lg:w-3/5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8 lg:p-12 min-h-[50vh] lg:min-h-screen">
        <div className="text-center px-4 lg:px-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 lg:mb-4 tracking-tight leading-none">
            Good Life Music Client Portal
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-slate-400 font-light italic tracking-wide">
            "Empowering artists worldwide"
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Key Implementation Details:**

| Feature | Implementation |
|---------|-----------------|
| **Session Validation** | `supabase.auth.getSession()` checks for recovery session |
| **Token Auto-Detection** | Supabase handles URL fragment automatically |
| **Password Requirements** | 8+ chars, uppercase, lowercase, numbers |
| **Real-time Feedback** | Password strength indicator with checklist |
| **Error Handling** | Specific messages for expired/invalid links |
| **Auto Sign Out** | Clears recovery session after success |

---

### 3.3 Supabase Client Configuration

**File:** `src/lib/supabaseClient.ts`

```typescript
/**
 * Supabase Client (Legacy)
 * 
 * CRITICAL for password reset:
 * 1. detectSessionInUrl: true - REQUIRED for recovery sessions
 * 2. storage: localStorage - Persists sessions across page reloads
 * 
 * Why detectSessionInUrl is critical:
 * - When user clicks reset email, token is in URL fragment
 * - This setting tells Supabase to check window.location.hash
 * - If recovery token found, session is created automatically
 * - Without this, the recovery session won't exist!
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // ⭐ CRITICAL for password reset
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
```

**Critical Setting Explanation:**

```
detectSessionInUrl: true

When user clicks reset email link:
1. Browser loads URL with token in fragment
   https://clientportal.../reset-password#access_token=xyz&type=recovery
2. Supabase client checks window.location.hash
3. Finds the recovery token and type
4. Creates a recovery SESSION in memory
5. getSession() now returns this session
6. updateUser() will work with this session

WITHOUT this setting:
- Token is in URL but Supabase ignores it
- getSession() returns null
- User sees "Invalid link" message
```

---

## 4. Testing & Validation

### Test Cases

#### Test 1: Valid Reset Flow

```
1. Navigate to /forgot-password
2. Enter your email
3. Click "Send Reset Link"
4. Check email (wait up to 2 minutes)
5. Click link in email
6. Should land on /reset-password with form visible
7. Enter new password (must meet requirements)
8. Click "Update Password"
9. Should see success toast and redirect to /login
10. Try logging in with new password
✅ Should succeed
```

#### Test 2: Expired Link

```
1. Get a reset link email
2. Wait 24+ hours (or manually expire in Supabase)
3. Click the link
4. Navigate to /reset-password
✅ Should show "Invalid or Expired Link" error
✅ Should redirect to /forgot-password
```

#### Test 3: Invalid Email

```
1. On /forgot-password
2. Enter non-existent email
3. Click "Send Reset Link"
✅ Should still show success (for security - don't reveal emails)
✅ No email will be sent (server-side validation)
```

#### Test 4: Rate Limiting

```
1. On /forgot-password
2. Enter email and send (success)
3. Immediately try again
✅ Should see "Wait 60 seconds" on button
✅ Cannot submit until cooldown expires
```

#### Test 5: Already Logged In

```
1. Login normally
2. Visit /reset-password directly
✅ Should show "Already Logged In" message
✅ Should redirect to login after 2 seconds
```

#### Test 6: Password Requirements

```
On /reset-password form:
- Try "123" (too short) → ✅ Button disabled
- Try "password" (no uppercase/numbers) → ✅ Button disabled
- Try "Pass123!word" → ✅ Button enabled
- Try "Pass123" then "Pass124" → ✅ Match indicator shows mismatch
- Try "Pass123" then "Pass123" → ✅ Match indicator shows match
```

---

### Debugging Checklist

**Email not received?**
- ☑️ Check spam/promotions folder
- ☑️ Verify email exists in Supabase user table
- ☑️ Check Supabase logs: Authentication → Logs
- ☑️ Wait 2-3 minutes (Supabase can be slow)
- ☑️ Check redirect URL is whitelisted in dashboard

**Link clicks but shows invalid?**
- ☑️ Verify `/reset-password` is in URL whitelist (not `resetpassword`)
- ☑️ Check `detectSessionInUrl: true` in supabaseClient.ts
- ☑️ Verify `localStorage` is being used (not sessionStorage)
- ☑️ Check browser console for JavaScript errors
- ☑️ Test in private/incognito window (rules out cache issues)

**"Session Expired" after updating password?**
- ☑️ Link was valid but took too long to enter password
- ☑️ User can click "Request New Link" and try again
- ☑️ This is normal behavior - recovery sessions are short-lived

**Password update fails silently?**
- ☑️ Open browser DevTools → Network tab
- ☑️ Check supabase.auth.updateUser() request
- ☑️ Look for error response
- ☑️ Check if passwords meet complexity requirements
- ☑️ Verify no JavaScript errors in Console

---

## 5. Common Mistakes & Pitfalls

### ❌ Mistake 1: Incorrect Redirect URL

**Problem:**
```
Dashboard: https://clientportal.goodlife-publishing.com/resetpassword
Code: https://clientportal.goodlife-publishing.com/reset-password
                                              (hyphen vs no hyphen)
```

**Result:**
- Email is sent ✅
- Link is generated ✅
- User clicks link ❌
- "Invalid redirect URL" error

**Solution:**
```
Add BOTH to dashboard URL whitelist:
- https://clientportal.goodlife-publishing.com/resetpassword
- https://clientportal.goodlife-publishing.com/reset-password

Or ensure they match exactly!
```

---

### ❌ Mistake 2: Missing `detectSessionInUrl`

**Problem:**
```typescript
// ❌ WRONG
auth: {
  autoRefreshToken: true,
  persistSession: true,
  // detectSessionInUrl missing!
}
```

**Result:**
- User clicks reset link ✅
- Page loads ✅
- Component calls getSession() ❌
- Returns null (no session)
- Shows "Invalid link" error

**Solution:**
```typescript
// ✅ CORRECT
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true, // ⭐ Required!
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
}
```

---

### ❌ Mistake 3: Trying to Parse Token Manually

**Problem:**
```typescript
// ❌ WRONG - Don't do this!
const hash = window.location.hash;
const token = new URLSearchParams(hash.substring(1)).get("access_token");
// Now trying to manually use this token...
supabase.auth.session({ access_token: token }); // This won't work
```

**Result:**
- Manual parsing is fragile
- Token format changes between API versions
- Race conditions with async operations
- Security issues (exposing token in memory)

**Solution:**
```typescript
// ✅ CORRECT - Let Supabase handle it
useEffect(() => {
  // Supabase automatically detects token from URL fragment
  // Just check if session was created:
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Session exists - recovery token was detected
    setIsValidToken(true);
  }
}, []);
```

---

### ❌ Mistake 4: Using `sessionStorage` Instead of `localStorage`

**Problem:**
```typescript
// ❌ WRONG
auth: {
  storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
}
```

**Result:**
- Session stored in RAM only
- Session lost on page reload
- User clicks reset email link
- Component mounts, session is gone ❌
- Shows "Invalid link" error

**Solution:**
```typescript
// ✅ CORRECT
auth: {
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
}
```

---

### ❌ Mistake 5: Calling `updateUser()` Without Recovery Session

**Problem:**
```typescript
// ❌ WRONG - On a normal login page
const { error } = await supabase.auth.updateUser({
  password: "newPassword"
});
// Error! No recovery session exists
```

**Result:**
- Error: "Password update not allowed in this session"
- User can only change password on /reset-password page

**Solution:**
```typescript
// ✅ CORRECT - Only call updateUser() in recovery session
// This is checked on the /reset-password page
useEffect(() => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user.recovery_sent_at) {
    // This IS a recovery session - safe to call updateUser()
    setIsValidToken(true);
  }
}, []);
```

---

### ❌ Mistake 6: Forgetting to Sign Out After Password Update

**Problem:**
```typescript
// ❌ WRONG - Don't redirect immediately
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
if (!error) {
  router.push("/login"); // But recovery session is still active!
}
```

**Result:**
- Password is updated ✅
- But recovery session persists in localStorage
- User is accidentally "logged in" as recovery session
- Next time they visit the site, recovery session might still exist
- Security issue!

**Solution:**
```typescript
// ✅ CORRECT - Sign out after password update
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
if (!error) {
  await supabase.auth.signOut(); // Clear recovery session
  router.push("/login"); // Now safe to redirect
}
```

---

### ❌ Mistake 7: Not Validating Password Strength

**Problem:**
```typescript
// ❌ WRONG - Any password accepted
if (newPassword.length < 6) {
  // Error
}
// That's it... users choose weak passwords
```

**Result:**
- Users reset to passwords like "123456"
- Account is vulnerable
- Doesn't meet modern security standards

**Solution:**
```typescript
// ✅ CORRECT - Validate complexity
const hasUppercase = /[A-Z]/.test(newPassword);
const hasLowercase = /[a-z]/.test(newPassword);
const hasNumbers = /[0-9]/.test(newPassword);

if (newPassword.length < 8 || !hasUppercase || !hasLowercase || !hasNumbers) {
  toast({
    title: "Weak Password",
    description: "Password must have 8+ chars, uppercase, lowercase, and numbers."
  });
  return;
}
```

---

### ❌ Mistake 8: Not Handling Rate Limits

**Problem:**
```typescript
// ❌ WRONG - No rate limit checking
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: redirectUrl,
});
```

**Result:**
- User can spam "Send" button
- Gets 429 (Too Many Requests) error
- Confusing error message

**Solution:**
```typescript
// ✅ CORRECT - Implement cooldown
const [cooldown, setCooldown] = useState(false);

async function handleSubmit() {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  
  if (error?.message?.includes("429")) {
    toast({
      title: "Too Many Requests",
      description: "Please wait a few minutes before trying again."
    });
  } else if (!error) {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 60000); // 60 second cooldown
  }
}
```

---

## 6. Troubleshooting

### Scenario: "Reset link works on localhost but not production"

**Likely cause:** Different domain in whitelist

**Debug steps:**
1. Check dashboard URL Configuration
2. For production: must have `https://clientportal.goodlife-publishing.com/reset-password`
3. For localhost: must have `http://localhost:3000/reset-password`
4. Verify exact match (including http/https)

**Fix:**
```
Add to URL whitelist:
http://localhost:3000/reset-password
http://localhost:3000/resetpassword
https://clientportal.goodlife-publishing.com/reset-password
https://clientportal.goodlife-publishing.com/resetpassword
```

---

### Scenario: "Email template not showing custom branding"

**Likely cause:** Using email provider's default template

**Debug steps:**
1. Go to Authentication → Email Templates
2. Click "Reset Password"
3. Check if "Customize email" is enabled

**Fix:**
1. Click the pencil icon to edit
2. Customize the HTML template
3. Add company branding, logo, etc.
4. Save changes

---

### Scenario: "Password update fails with 'Invalid JWT' error"

**Likely cause:** Recovery session expired

**Debug steps:**
1. Check how long user spent on /reset-password
2. Supabase recovery tokens expire after ~1 hour
3. Verify user didn't close/reopen browser

**Fix:**
1. Instruct user to request a new reset link
2. Click link immediately
3. Complete password update quickly (within 1 hour)

---

### Scenario: "Works in Chrome but fails in Safari"

**Likely cause:** Safari blocks localStorage or blocks third-party cookies

**Debug steps:**
1. Check Safari privacy settings
2. Verify cookies are not blocked
3. Test in private browsing mode

**Fix:**
```
Browser fix:
1. Safari Settings → Privacy
2. Disable "Prevent cross-site tracking" for testing
3. Clear website data

Or detect environment in code:
const supportsStorage = typeof window !== "undefined" && window.localStorage;
if (!supportsStorage) {
  toast({
    title: "Storage Disabled",
    description: "Please enable cookies/storage in your browser."
  });
}
```

---

## Production Deployment Checklist

### Before Going Live

- ☑️ **URL Configuration**: Whitelist both production and development redirect URLs
- ☑️ **HTTPS**: Ensure your domain uses HTTPS (not HTTP)
- ☑️ **Email Domain**: Verify sender email is configured in Supabase (in SMTP settings if custom)
- ☑️ **Email Template**: Customize with company branding (logo, colors, messaging)
- ☑️ **Password Complexity**: Enforce strong passwords (8+, uppercase, lowercase, numbers)
- ☑️ **Rate Limiting**: Implement cooldowns to prevent abuse
- ☑️ **Error Messages**: Test all error paths (expired link, invalid email, etc.)
- ☑️ **Browser Testing**: Test in Chrome, Firefox, Safari, Edge
- ☑️ **Mobile Testing**: Test on iOS Safari and Android Chrome
- ☑️ **Security**: Review password reset logs in Supabase
- ☑️ **Documentation**: Ensure support team knows the flow for debugging

### Monitoring

**Set up alerts for:**
- High volume of reset requests (possible attack)
- Spike in 429 errors (rate limiting triggered)
- Failed password updates
- High recovery link expiration rate

---

## Summary

| Component | Purpose | File |
|-----------|---------|------|
| **Forgot Password Page** | Send reset email | `src/app/forgot-password/page.tsx` |
| **Reset Password Page** | Update password with valid session | `src/app/reset-password/page.tsx` |
| **Supabase Client** | Auto-detect recovery tokens | `src/lib/supabaseClient.ts` |
| **Dashboard URL Whitelist** | Security validation | Supabase Dashboard |

**Key Concepts:**
- Token is in URL **fragment** (#), not query (?params)
- Supabase **auto-detects** token (don't parse manually)
- **Recovery session** is temporary and expires after 1 hour
- **updateUser()** only works with valid recovery session
- **Sign out** after password update to clear session

