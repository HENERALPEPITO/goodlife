# Complete Forgot Password Implementation with Supabase Auth v2

## Overview

This guide explains the complete forgot-password flow implemented in the Good Life Music Client Portal using Supabase Authentication v2. The flow includes:

1. **Forgot Password Page** - User enters email
2. **Reset Email Sent** - Supabase sends reset link via email
3. **Reset Password Page** - User sets new password via the link
4. **Session Validation** - Token is automatically handled by Supabase

---

## Architecture

```
User Flow:
┌─────────────────┐
│ Login Page      │
└────────┬────────┘
         │ (Forgot Password?)
         ▼
┌─────────────────────────────────┐
│ Forgot Password Page            │
│ - User enters email             │
│ - Click "Send Reset Link"       │
└────────┬────────────────────────┘
         │ resetPasswordForEmail()
         ▼
┌─────────────────────────────────┐
│ Supabase Auth Backend           │
│ - Validates email               │
│ - Generates recovery token      │
│ - Sends email with reset link   │
└────────┬────────────────────────┘
         │ User clicks email link:
         │ https://app.com/reset-password
         │ (token in URL fragment)
         ▼
┌─────────────────────────────────┐
│ Reset Password Page             │
│ - Validates recovery session    │
│ - Shows password form           │
│ - User enters new password      │
└────────┬────────────────────────┘
         │ updateUser(password)
         ▼
┌─────────────────────────────────┐
│ Supabase Auth Backend           │
│ - Updates password              │
│ - Clears recovery session       │
│ - Returns success               │
└────────┬────────────────────────┘
         │ Redirect to login
         ▼
┌─────────────────┐
│ Login Page      │
└─────────────────┘
```

---

## Step 1: Supabase Configuration

### 1.1 Whitelist Redirect URL

This is **CRITICAL**. Without this, the reset link won't work.

**Steps:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/reset-password
   https://yourdomain.com/reset-password
   ```

**Why?** Supabase validates that reset links only redirect to whitelisted URLs for security.

### 1.2 Email Template (Optional)

Supabase provides a default email template. To customize:

1. Go to **Authentication** → **Email Templates**
2. Click on **Reset Password**
3. Customize the email template

**Example custom template:**
```html
<h2>Reset Your Password</h2>
<p>Follow this link to reset your password:</p>
<a href="{{ .ConfirmationURL }}">Reset Password</a>
<p>This link expires in 24 hours.</p>
```

The `{{ .ConfirmationURL }}` will be automatically replaced with the reset link.

---

## Step 2: Forgot Password Page

**File:** `/src/app/forgot-password/page.tsx`

### Implementation

```typescript
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
      // CRITICAL: Use the full redirect URL including protocol
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Handle rate limiting (Supabase limits to 4 requests per hour)
        if (error.message?.includes("429") || 
            error.message?.toLowerCase().includes("rate limit") || 
            error.message?.toLowerCase().includes("too many")) {
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
      {/* Form Section */}
      <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-6 lg:p-8 min-h-[50vh] lg:min-h-screen">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo.png"
              alt="Logo"
              width={120}
              height={120}
              className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain"
              priority
            />
          </div>

          {/* Back Button */}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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

      {/* Branding Section */}
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

### Key Points

- ✅ **Use full URL**: `${window.location.origin}/reset-password` ensures the correct protocol (http/https)
- ✅ **Rate limiting**: Supabase limits to 4 reset emails per hour per email
- ✅ **Cooldown**: Prevent spam with client-side 60-second cooldown
- ✅ **Error handling**: Distinguish between rate limiting and other errors
- ❌ **Don't**: Try to parse the token manually from the URL

---

## Step 3: Reset Password Page

**File:** `/src/app/reset-password/page.tsx`

### Implementation

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Eye, EyeOff } from "lucide-react";
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

  useEffect(() => {
    // IMPORTANT: Check if we have a valid recovery session
    // Supabase automatically creates a session from the reset link
    const checkSession = async () => {
      // Small delay to ensure Supabase has processed the link
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidToken(true);
      } else {
        toast({
          title: "Invalid or Expired Link",
          description: "This password reset link is invalid or has expired. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    };

    checkSession();
  }, [router, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    if (newPassword.length < 6) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters long.",
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

    setLoading(true);

    try {
      // IMPORTANT: updateUser automatically uses the recovery session
      // No need to manually handle the token
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Password updated successfully. Redirecting to login...",
        });

        // Sign out to clear the recovery session
        await supabase.auth.signOut();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
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

  // Loading state while checking session
  if (!isValidToken) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Form Section */}
      <div className="w-full lg:w-2/5 bg-white flex items-center justify-center p-6 lg:p-8 min-h-[50vh] lg:min-h-screen">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo.png"
              alt="Logo"
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
              Enter your new password below.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
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
                  minLength={6}
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
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            </div>

            {/* Confirm Password */}
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
                  minLength={6}
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
              <div className={`text-xs ${newPassword === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span className="text-sm tracking-wide">
                {loading ? "UPDATING..." : "UPDATE PASSWORD"}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Branding Section */}
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

### Key Points

- ✅ **Check session on mount**: Validates the recovery token from the reset link
- ✅ **Small delay**: Gives Supabase time to process the redirect
- ✅ **Auto-handled token**: `updateUser()` uses the session automatically
- ✅ **Sign out after**: Clears the recovery session
- ✅ **Password validation**: Minimum 6 characters, must match
- ❌ **Don't**: Try to parse the `#access_token` from URL

---

## Best Practices

### 1. Redirect URL Configuration

**Do:**
```
http://localhost:3000/reset-password
https://app.goodlifemusic.com/reset-password
https://www.goodlifemusic.com/reset-password
```

**Don't:**
- ❌ Forget to whitelist the URL
- ❌ Use relative URLs like `/reset-password`
- ❌ Include query parameters in the whitelist

### 2. Token Handling

**Do:**
```typescript
// Let Supabase handle it automatically
const { data: { session } } = await supabase.auth.getSession();
```

**Don't:**
- ❌ Manually parse `location.hash` or `location.search`
- ❌ Store the token in localStorage
- ❌ Send the token to your backend

### 3. Error Messages

**Do:**
```typescript
if (error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit")) {
  // Handle rate limiting specifically
}
```

**Don't:**
- ❌ Expose technical error details to users
- ❌ Show different errors for "email not found" (security risk)

### 4. Session Validation

**Do:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  router.push("/login"); // Expired or invalid link
}
```

**Don't:**
- ❌ Skip session validation
- ❌ Trust the URL parameters

### 5. Password Requirements

**Recommended:**
- Minimum 8 characters (we use 6 for flexibility)
- Mix of uppercase, lowercase, numbers, symbols (optional)
- Regular expression validation

**Example:**
```typescript
const isStrongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
```

---

## Common Pitfalls

### 1. **Token Expires in URL Fragment**
- Token is in `#access_token=...` (URL fragment)
- Not sent to server (stays client-side)
- Expires after 15 minutes by default
- User must click link immediately

**Solution:** Show clear message if link is expired

### 2. **Redirect URL Not Whitelisted**
- Email link won't redirect properly
- User sees Supabase error page
- Check Supabase dashboard → Authentication → URL Configuration

**Solution:**
```typescript
// Always use full URL
const redirectUrl = `${window.location.origin}/reset-password`;
```

### 3. **Multiple Reset Requests (Rate Limited)**
- Supabase limits to 4 requests per hour per email
- Returns error: "Rate limit exceeded"

**Solution:** Implement cooldown timer
```typescript
setCooldown(true);
setTimeout(() => setCooldown(false), 60000); // 60 seconds
```

### 4. **Session Not Available After Redirect**
- Sometimes `getSession()` returns null immediately
- Browser needs time to process redirect

**Solution:** Add small delay
```typescript
await new Promise(resolve => setTimeout(resolve, 500));
```

### 5. **User Not Signed Out After Password Reset**
- Old session still valid
- User not logged out automatically

**Solution:** Sign out explicitly
```typescript
await supabase.auth.signOut();
```

---

## Testing the Flow

### Local Testing

1. **Set environment variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

2. **Whitelist localhost:**
   - Dashboard → Authentication → URL Configuration
   - Add: `http://localhost:3000/reset-password`

3. **Test the flow:**
   - Go to `/forgot-password`
   - Enter your email
   - Check inbox for email (or check Supabase logs)
   - Click reset link
   - Enter new password
   - Should redirect to login

### Production Testing

1. **Whitelist production domain:**
   ```
   https://yourdomain.com/reset-password
   ```

2. **Test with real email:**
   - Use a test email account
   - Verify email arrives
   - Click link from email

3. **Monitor errors:**
   - Check Supabase logs
   - Monitor application error tracking

---

## Debugging

### Reset Email Not Arriving

1. Check Supabase logs:
   - Dashboard → Logs → Auth
   - Look for `resetPasswordForEmail` calls

2. Check email configuration:
   - Confirm SMTP settings in Supabase
   - Check spam/promotions folder

3. Verify email address:
   - User must have account
   - Email must be confirmed (depends on settings)

### Reset Link Not Working

1. Check URL whitelist:
   - Dashboard → Authentication → URL Configuration
   - Verify exact match (protocol, domain, path)

2. Check token validity:
   - Token expires in 15 minutes
   - User must click immediately

3. Check browser:
   - Clear cookies
   - Try incognito mode
   - Try different browser

### Password Update Fails

1. Check session:
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session); // Should not be null
   ```

2. Check password requirements:
   - Minimum 6 characters
   - Different from old password (optional)

3. Check user status:
   - User must not be banned
   - Email must be confirmed

---

## Security Considerations

1. **Never expose tokens in URLs**
   - Supabase handles this automatically
   - Don't log or send to backend

2. **Rate limit password resets**
   - Supabase: 4 per hour per email
   - Frontend: 60-second cooldown

3. **Validate password strength**
   - Minimum 8 characters recommended
   - Enforce complexity requirements

4. **Log password changes**
   - For audit trail
   - Detect suspicious activity

5. **Notify user of password change**
   - Send email confirmation
   - Include security information

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Password Recovery](https://supabase.com/docs/guides/auth/auth-forgot-password)
- [resetPasswordForEmail API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [updateUser API](https://supabase.com/docs/reference/javascript/auth-updateuser)

---

## Summary

✅ **Forgot Password Implementation Checklist:**

- [x] Whitelist redirect URL in Supabase dashboard
- [x] Implement forgot password page with email input
- [x] Use `resetPasswordForEmail()` with full redirect URL
- [x] Implement reset password page
- [x] Validate recovery session on page load
- [x] Use `updateUser()` to set new password
- [x] Sign out user after password update
- [x] Handle rate limiting gracefully
- [x] Test with real emails
- [x] Monitor error logs

Your implementation is **production-ready**! 🚀
