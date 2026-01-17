# Forgot Password Flow - Visual Diagrams & Reference

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                  COMPLETE PASSWORD RESET FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

TIME: T+0s
┌──────────────────────────────┐
│ User at Login Page           │
│ "Forgot Password?" link      │
└──────────────────────────────┘
           ↓ CLICK
TIME: T+5s
┌────────────────────────────────────────────────┐
│ /forgot-password PAGE (Client Component)       │
│ ────────────────────────────────────────────── │
│ • Email input field                            │
│ • "Send Reset Link" button                     │
│ • Rate limit cooldown indicator               │
└────────────────────────────────────────────────┘
           ↓ ENTER EMAIL + CLICK
TIME: T+10s
┌────────────────────────────────────────────────┐
│ Frontend:                                      │
│ await supabase.auth.resetPasswordForEmail()   │
│                                               │
│ → validates email                             │
│ → generates recovery token                    │
│ → creates reset link with token in fragment  │
│ → sends email with reset link                │
└────────────────────────────────────────────────┘
           ↓ EMAIL SENT
TIME: T+30s
┌────────────────────────────────────────────────┐
│ User receives email:                          │
│                                               │
│ "Subject: Reset Your Password"                │
│ [Reset Password Button]                       │
│ Link: https://.../reset-password              │
│       #access_token=xyz...&type=recovery      │
└────────────────────────────────────────────────┘
           ↓ USER CLICKS EMAIL LINK
TIME: T+2min
┌────────────────────────────────────────────────┐
│ Browser URL changes to:                        │
│ https://clientportal.../reset-password        │
│ #access_token=abc123&type=recovery            │
│                                               │
│ [Fragment never sent to server - stays client]│
└────────────────────────────────────────────────┘
           ↓ PAGE LOADS
TIME: T+2min+1s
┌────────────────────────────────────────────────┐
│ React useEffect triggers:                      │
│ 1. Supabase client checks window.location.hash│
│ 2. Finds recovery token in fragment           │
│ 3. Creates recovery SESSION in memory         │
│ 4. Session stored in localStorage             │
└────────────────────────────────────────────────┘
           ↓ SESSION CREATED
TIME: T+2min+2s
┌────────────────────────────────────────────────┐
│ /reset-password PAGE (Client Component)       │
│ ────────────────────────────────────────────── │
│ • New Password input                          │
│ • Confirm Password input                      │
│ • Password strength indicator                 │
│ • "Update Password" button                    │
│                                               │
│ ✓ Session validated                           │
│ ✓ Recovery token confirmed                    │
└────────────────────────────────────────────────┘
           ↓ USER ENTERS PASSWORD + CLICKS
TIME: T+3min
┌────────────────────────────────────────────────┐
│ Frontend:                                      │
│ 1. Validate password strength (8+, mixed)     │
│ 2. Check passwords match                      │
│ 3. await supabase.auth.updateUser({password}) │
│                                               │
│ → Uses recovery session to authenticate       │
│ → Supabase updates password in DB             │
│ → Token invalidated (one-time use)            │
│ → Recovery session cleared on server          │
└────────────────────────────────────────────────┘
           ↓ PASSWORD UPDATED
TIME: T+3min+1s
┌────────────────────────────────────────────────┐
│ Frontend:                                      │
│ 1. Show success toast: "Password updated!"    │
│ 2. await supabase.auth.signOut()              │
│    (Clear recovery session from localStorage) │
│ 3. setTimeout(() => router.push("/login"), ...) │
└────────────────────────────────────────────────┘
           ↓ REDIRECT
TIME: T+3min+2s
┌────────────────────────────────────────────────┐
│ /login PAGE                                    │
│                                               │
│ User logs in with:                            │
│ • Email: the-email@domain.com                 │
│ • Password: the-new-password                  │
│                                               │
│ ✓ Login successful!                           │
│ ✓ Normal session created                      │
│ ✓ Access dashboard                            │
└────────────────────────────────────────────────┘
           ↓ SUCCESS
TIME: T+3min+3s
┌──────────────────────────────┐
│ User in Dashboard            │
│ Password reset complete! ✓   │
└──────────────────────────────┘
```

---

## Supabase Session Flow

```
NO SESSION → RECOVERY SESSION → NO SESSION → NORMAL SESSION
   ↓              ↓                ↓               ↓
Login      Click reset link    Password update   Log in
page       in email            successful        success

LOCAL STATE:
    null      {recovery}          null          {user}
   [Client]   [Client]          [Client]       [Client]
             [localStorage]    [cleared]      [localStorage]
```

---

## URL Fragment vs Query Parameters

```
WRONG (with query params):
https://clientportal.../reset-password?access_token=abc&type=recovery
                                      ↑
                                  Sent to server!
                                  SECURITY RISK!

CORRECT (with fragment):
https://clientportal.../reset-password#access_token=abc&type=recovery
                                      ↑
                                 Not sent to server
                                 SECURE!
```

**Why Fragment?**
- Fragment (#) never sent to server (HTTP spec)
- Never logged in server logs
- Never exposed in referrer header
- Only accessible to client-side JavaScript

---

## Component Lifecycle

```
/FORGOT-PASSWORD PAGE
═══════════════════════════════════════════════════

[MOUNT]
  ↓
[RENDER]
  ├─ Email input
  ├─ Send button
  └─ Cooldown indicator
  ↓
[USER INTERACTION]
  └─ handleSubmit() called
      ↓
      ├─ Validate email format
      ├─ Call resetPasswordForEmail()
      ├─ Show success toast
      ├─ Set 60s cooldown
      ├─ Clear form
      └─ Disable button (cooldown)


/RESET-PASSWORD PAGE
═══════════════════════════════════════════════════

[MOUNT]
  ↓
[useEffect 1: Check Session]
  ├─ Loading state = true
  ├─ Call getSession()
  ├─ Check session exists
  ├─ Check recovery_sent_at
  └─ Set isValidToken
      ↓
      ├─ IF INVALID: Show error → Redirect to /forgot-password
      ├─ IF ALREADY LOGGED IN: Show error → Redirect to /login
      └─ IF VALID: Show password form
  ↓
[RENDER]
  ├─ IF isChecking: Loading spinner
  ├─ IF !isValidToken: Error message
  └─ IF isValidToken:
      ├─ New Password input
      ├─ Confirm Password input
      ├─ Password strength indicator
      └─ Update button
  ↓
[USER INTERACTION]
  └─ handleSubmit() called
      ↓
      ├─ Validate password (8+, mixed case, numbers)
      ├─ Check passwords match
      ├─ Call updateUser({password})
      ├─ Show success toast
      ├─ Call signOut() → clear recovery session
      └─ setTimeout(() => router.push("/login"))
```

---

## Session States

```
STATE 1: NO SESSION
─────────────────────
getSession() returns: null
location: /login or /forgot-password
status: User not authenticated
action: Show login form

         ↓ (click reset link in email)

STATE 2: RECOVERY SESSION
─────────────────────────
getSession() returns: { user, recovery_sent_at }
location: /reset-password#access_token=...
status: Authenticated for password change ONLY
action: Show password reset form
note: recovery_sent_at field indicates recovery session

         ↓ (updateUser with new password)

STATE 3: NO SESSION (after sign out)
─────────────────────────────────────
getSession() returns: null
location: /login (after redirect)
status: User not authenticated
action: Show login form
note: recovery session was cleared

         ↓ (login with new password)

STATE 4: NORMAL SESSION
───────────────────────
getSession() returns: { user, recovery_sent_at: null }
location: /dashboard (or protected page)
status: Authenticated normally
action: Show user content
note: recovery_sent_at is null for normal sessions
```

---

## Error Scenarios

```
ERROR 1: INVALID REDIRECT URL
──────────────────────────────
User action: Click reset link in email
Result: Browser shows Supabase error page
Cause: Redirect URL not in dashboard whitelist
Solution: Add URL to Authentication → URL Configuration

         ↓ NO FIX

ERROR 2: EXPIRED RECOVERY LINK
───────────────────────────────
User action: Wait 1+ hour, then click reset link
Result: Page shows "Invalid or Expired Link"
Cause: Recovery session expired
Solution: Request new reset link from /forgot-password

         ↓ NO FIX

ERROR 3: ALREADY LOGGED IN
──────────────────────────
User action: Click reset link while already logged in
Result: Page shows "Already Logged In" message
Cause: Active session exists (not recovery session)
Solution: User must log out first

         ↓ NO FIX

ERROR 4: WEAK PASSWORD
─────────────────────
User action: Enter password < 8 chars
Result: "Update Password" button is disabled
Cause: Password fails validation
Solution: Enter stronger password

         ↓ FIXABLE

ERROR 5: PASSWORDS DONT MATCH
─────────────────────────────
User action: Mistype confirm password
Result: "Passwords do not match" indicator appears
Cause: Confirmation field doesn't match new password
Solution: Retype to match

         ↓ FIXABLE

ERROR 6: RATE LIMIT (429)
────────────────────────
User action: Click "Send Reset Link" too many times
Result: Error toast: "Too Many Requests"
Cause: Hit rate limit (5 requests per 15 min)
Solution: Wait a few minutes and try again

         ↓ TEMPORARY
```

---

## Supabase Configuration Checklist

```
STEP 1: REDIRECT URLS
───────────────────────────────────────────────────────────
Dashboard: Authentication → URL Configuration
Add:  [ ] http://localhost:3000/reset-password
      [ ] http://localhost:3000/resetpassword
      [ ] https://clientportal.goodlife-publishing.com/reset-password
      [ ] https://clientportal.goodlife-publishing.com/resetpassword
Save: [ ] Click Save button
Test: [ ] Send reset email to test account

STEP 2: EMAIL PROVIDER
───────────────────────────────────────────────────────────
Dashboard: Authentication → Email (Providers)
Status:   [ ] Confirm "Email" provider is enabled
          [ ] Check authentication method allows email
Default:  [ ] Supabase provides default email template
Custom:   [ ] (Optional) Customize template with branding

STEP 3: RATE LIMITING
───────────────────────────────────────────────────────────
Dashboard: Authentication → Security
Rate Limit: [ ] Check if enabled
            [ ] Set reasonable limits (5 per 15 min suggested)
Frontend:   [ ] Verify 60-second cooldown in code

STEP 4: PASSWORD POLICY
───────────────────────────────────────────────────────────
Dashboard: Authentication → Policies → Password
Min Length: [ ] Set to 8 characters
Options:    [ ] Require mixed case (recommended)
            [ ] Require numbers (recommended)
            [ ] Require special chars (optional)
Frontend:   [ ] Validate before sending to Supabase

STEP 5: SESSION EXPIRY
───────────────────────────────────────────────────────────
Dashboard: Authentication → Configuration
Recovery Token Expiry: [ ] Set to 24 hours
Session Expiry:        [ ] Set to 1 hour (recovery sessions)
```

---

## Code Flow Diagram

```
INPUT: User email on /forgot-password
       ↓
VALIDATE: Format check (basic regex)
       ↓
ASYNC: resetPasswordForEmail(email, {redirectTo})
       ├─ Supabase validates email exists
       ├─ Generates recovery token (secure random)
       ├─ Creates reset link with token in fragment
       ├─ Sends email to user
       └─ Returns success/error
       ↓
OUTPUT: Success toast + 60s cooldown
        OR
        Error toast + retry option

═══════════════════════════════════════════════════

INPUT: User clicks reset link in email
       Browser loads: https://.../reset-password#token=abc
       ↓
REACT: useEffect on mount
       ├─ Supabase client detects token in fragment
       ├─ createRecoverySession() from token
       └─ Stores in localStorage
       ↓
VALIDATE: getSession()
       ├─ Check session exists
       ├─ Check recovery_sent_at field
       └─ Set isValidToken state
       ↓
OUTPUT: Password reset form (if valid)
        OR
        Error message (if invalid/expired)

═══════════════════════════════════════════════════

INPUT: New password on /reset-password
       ↓
VALIDATE: 
       ├─ Length >= 8
       ├─ Has uppercase
       ├─ Has lowercase
       ├─ Has number
       ├─ Passwords match
       └─ Enable button only if all pass
       ↓
ASYNC: updateUser({password: newPassword})
       ├─ Supabase validates recovery session active
       ├─ Checks password meets policy
       ├─ Updates password in auth table
       ├─ Invalidates recovery token
       └─ Returns success/error
       ↓
CLEANUP: signOut()
       ├─ Clears recovery session from localStorage
       ├─ Clears in-memory session
       └─ Ready for new login
       ↓
REDIRECT: setTimeout(() => router.push("/login"))
       ↓
OUTPUT: User at login page with success message
```

---

## Browser Developer Tools Inspection

```
CONSOLE TAB
═══════════════════════════════════════════════════

// Check current session
const { data: { session } } = await supabase.auth.getSession();
console.log(session);

Output:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "recovery_sent_at": "2024-01-18T10:30:00Z"  ← Recovery session!
  }
}

// Check if recovery session
console.log(session?.user.recovery_sent_at ? "Recovery ✓" : "Normal");

// Check localStorage
console.log(localStorage.getItem("sb-PROJECT_ID-auth-token"));


NETWORK TAB
═══════════════════════════════════════════════════

Look for:
- Request: POST /auth/v1/recover
  Status: 200 (success) or error
  
- Request: POST /auth/v1/user
  Headers: Authorization: Bearer <token>
  Body: {"password": "new_password"}
  Status: 200 (success) or error


APPLICATION TAB → STORAGE → LOCAL STORAGE
═══════════════════════════════════════════════════

Key: sb-YOUR_PROJECT_ID-auth-token
Value: JSON with auth data

Look for: "recovery_sent_at" field
If present → Recovery session active
If null/missing → Normal session


COOKIES
═══════════════════════════════════════════════════

Look for: sb-YOUR_PROJECT_ID-auth-token
Should exist and contain auth data
If missing → Session not persisted!
```

---

## Production Deployment Checklist Visual

```
PHASE 1: SUPABASE SETUP (Estimated: 10 min)
═══════════════════════════════════════════════════════════
☐ Access Supabase Dashboard
☐ Navigate to Authentication → URL Configuration
☐ Add 4 redirect URLs (with both resetpassword & reset-password)
☐ Click Save
☐ (Optional) Customize email template with branding
☐ Verify email provider is enabled

PHASE 2: ENVIRONMENT SETUP (Estimated: 5 min)
═══════════════════════════════════════════════════════════
☐ Set NEXT_PUBLIC_SUPABASE_URL in .env.local
☐ Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
☐ Verify env vars on production server
☐ Do NOT commit real keys to git!

PHASE 3: CODE VERIFICATION (Estimated: 5 min)
═══════════════════════════════════════════════════════════
☐ Check src/lib/supabaseClient.ts has detectSessionInUrl: true
☐ Check src/lib/supabaseClient.ts uses localStorage
☐ Verify src/app/forgot-password/page.tsx exists
☐ Verify src/app/reset-password/page.tsx exists
☐ Build: npm run build (should succeed)

PHASE 4: LOCAL TESTING (Estimated: 10 min)
═══════════════════════════════════════════════════════════
☐ Start dev server: npm run dev
☐ Navigate to http://localhost:3000/forgot-password
☐ Enter test email → Send Reset Link
☐ Check email inbox (wait 2-3 minutes)
☐ Click reset link in email
☐ Should land on /reset-password with form visible
☐ Enter new password (must be 8+, mixed case, numbers)
☐ Click Update Password
☐ Should show success message
☐ Should redirect to /login
☐ Log in with new password → Should work ✓

PHASE 5: STAGING DEPLOYMENT (Estimated: 15 min)
═══════════════════════════════════════════════════════════
☐ Deploy to staging server
☐ Test complete flow on staging domain
☐ Verify email template displays correctly
☐ Test error scenarios (expired link, invalid email)
☐ Test on multiple browsers (Chrome, Firefox, Safari, Edge)
☐ Test on mobile (iOS Safari, Android Chrome)

PHASE 6: PRODUCTION DEPLOYMENT (Estimated: 5 min)
═══════════════════════════════════════════════════════════
☐ Deploy to production: https://clientportal.goodlife-publishing.com
☐ Verify environment variables set on production
☐ Test complete flow on production domain
☐ Verify HTTPS is active (lock icon in browser)
☐ Verify redirect URL is whitelisted in dashboard
☐ Final sanity check: forgot password → reset → login

PHASE 7: MONITORING & DOCS (Estimated: 10 min)
═══════════════════════════════════════════════════════════
☐ Set up error logging/monitoring
☐ Document password reset flow for support team
☐ Create FAQ for common user issues
☐ Test rate limiting behavior
☐ Verify session expiry times

TOTAL TIME TO PRODUCTION: ~60 minutes
```

---

## Key Metrics to Monitor

```
METRIC 1: PASSWORD RESET REQUEST RATE
─────────────────────────────────────
Track: Number of resetPasswordForEmail() calls
Normal: 5-10 per day per 1000 users
Alert if: Spike above 50% normal (possible attack)
Action: Increase rate limiting


METRIC 2: PASSWORD RESET SUCCESS RATE
──────────────────────────────────────
Track: Successful updateUser() calls
Normal: 80-90% (accounting for expired links, user abandon)
Alert if: Below 70% (possible configuration issue)
Action: Check error logs, verify redirect URLs


METRIC 3: PASSWORD RESET FAILURE RATE
──────────────────────────────────────
Track: Error responses from resetPasswordForEmail()
Normal: < 5%
Alert if: Above 10%
Likely causes:
  - User email not found
  - Rate limit hit
  - Supabase service issue


METRIC 4: SESSION VALIDATION FAILURES
──────────────────────────────────────
Track: /reset-password page shows "Invalid Link"
Normal: 5-15% (accounting for expired links)
Alert if: Above 30%
Likely causes:
  - Redirect URL misconfigured
  - Recovery session not persisting
  - Browser privacy settings


METRIC 5: LINK CLICK-THROUGH RATE
──────────────────────────────────
Track: User clicks reset link in email
Normal: 70-85% of reset emails
Alert if: Below 50%
Likely causes:
  - Email filtering
  - Link not visible
  - Email template issue
```

---

## Quick Debugging Flowchart

```
PROBLEM: User says "Invalid link" on reset-password page
│
├─ Step 1: Is the email in the link correct?
│   ├─ NO → Email not sent, check Supabase logs
│   └─ YES → Continue
│
├─ Step 2: Check browser console for JavaScript errors
│   ├─ YES errors → Fix JavaScript errors
│   └─ NO errors → Continue
│
├─ Step 3: Is localStorage enabled in browser?
│   ├─ NO → Tell user to enable localStorage
│   └─ YES → Continue
│
├─ Step 4: Check if recovery_sent_at exists in session
│   ├─ session is null → Supabase didn't detect token
│   │   ├─ Verify detectSessionInUrl: true in code
│   │   ├─ Verify URL fragment contains token
│   │   └─ Try in private/incognito window
│   │
│   └─ session exists but recovery_sent_at missing
│       ├─ Normal session (user already logged in)
│       └─ Tell user to logout first
│
└─ Step 5: Check Supabase logs
    └─ Authentication → Logs → View all
        ├─ Look for recovery_token_generated ✓
        ├─ Look for auth errors ✗
        └─ Check if token was used/expired
```

---

**Visual diagrams complete! Print or bookmark this page for reference.** 📋

