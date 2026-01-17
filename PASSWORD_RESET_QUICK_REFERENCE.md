# Forgot Password - Quick Reference Card

Print this page and keep it on your desk! 📋

---

## ⚡ 30-Second Setup

```
1. Supabase Dashboard → Authentication → URL Configuration
   Add: https://clientportal.goodlife-publishing.com/reset-password
   Add: https://clientportal.goodlife-publishing.com/resetpassword
   Click: SAVE ✓

2. Terminal:
   npm run dev
   
3. Browser:
   http://localhost:3000/forgot-password
   
4. Test complete flow ✓
```

---

## 🔑 Critical Code Snippets

### Send Reset Email
```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`
});
```

### Check Recovery Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.user.recovery_sent_at) {
  // Valid recovery session ✓
}
```

### Update Password
```typescript
await supabase.auth.updateUser({
  password: newPassword
});
await supabase.auth.signOut(); // Important!
```

---

## ✅ Configuration Checklist

- [ ] Supabase URL Configuration: 4 redirect URLs added
- [ ] .env.local: NEXT_PUBLIC_SUPABASE_URL set
- [ ] .env.local: NEXT_PUBLIC_SUPABASE_ANON_KEY set
- [ ] supabaseClient.ts: detectSessionInUrl = true
- [ ] supabaseClient.ts: storage = localStorage
- [ ] Password validation: 8+, uppercase, lowercase, numbers

---

## 🐛 Debugging Flowchart

```
Problem: "Invalid link" error
├─ Is URL in Supabase whitelist? No → Add it
├─ Is detectSessionInUrl true? No → Change it
├─ Is localStorage enabled? No → Enable it
└─ Check browser console for errors

Problem: Email not received
├─ Wait 2-3 minutes (can be slow)
├─ Check spam/promotions folder
├─ Check Supabase logs: Authentication → Logs
└─ Verify email exists in Supabase

Problem: Password update fails
├─ Is recovery session valid? Check: session?.user.recovery_sent_at
├─ Is password strong enough? Need 8+, mixed case, numbers
├─ Has link expired? Recovery sessions expire after 1 hour
└─ Are you signed in? Must have recovery session
```

---

## 📱 Test Cases (5 minutes)

```
Test 1: Happy Path
  Input: Valid email, strong password
  Expected: Password updated ✓

Test 2: Weak Password
  Input: Password < 8 chars
  Expected: Button disabled, error message

Test 3: Password Mismatch
  Input: Different confirm password
  Expected: Match indicator shows red

Test 4: Expired Link
  Input: Old reset link (wait 1+ hour)
  Expected: "Invalid or Expired Link" message

Test 5: Rate Limit
  Input: Send 3 reset emails in 60 seconds
  Expected: 3rd blocked, "Wait 60 seconds"
```

---

## 🔐 Security Summary

| Aspect | Status | How |
|--------|--------|-----|
| Token in Fragment | ✅ Secure | # instead of ? params |
| Session Auto-Detection | ✅ Secure | Supabase handles it |
| Rate Limiting | ✅ Secure | 60 second cooldown |
| Password Strength | ✅ Secure | 8+, mixed case, numbers |
| HTTPS | ✅ Secure | Production only |

---

## 📞 Key Resources

| Need | File | Section |
|------|------|---------|
| Overview | PASSWORD_RESET_SUMMARY.md | Top section |
| Setup | SUPABASE_CONFIG_REFERENCE.md | Step 1-2 |
| Code Examples | CODE_SNIPPETS_PASSWORD_RESET.md | Any snippet |
| Deep Dive | FORGOT_PASSWORD_PRODUCTION.md | Full guide |
| Diagrams | PASSWORD_RESET_VISUAL_GUIDE.md | All sections |
| Index | PASSWORD_RESET_DOCS_INDEX.md | Navigation |

---

## ⚠️ Top 5 Mistakes

1. **Redirect URL not whitelisted** → Reset link fails
   Fix: Add 4 URLs to Supabase dashboard

2. **Missing detectSessionInUrl** → Session not detected
   Fix: Set to `true` in supabaseClient.ts

3. **Using sessionStorage** → Session lost on page reload
   Fix: Use `localStorage` instead

4. **Not signing out** → Recovery session persists
   Fix: Call `signOut()` after `updateUser()`

5. **Parsing token manually** → Security risk
   Fix: Let Supabase auto-detect via `detectSessionInUrl`

---

## 🚀 Deployment Steps

```
1. ✅ Configure Supabase (10 min)
   Dashboard → Authentication → URL Configuration
   Add 4 URLs, save

2. ✅ Test Locally (15 min)
   npm run dev
   Test complete flow

3. ✅ Build (5 min)
   npm run build

4. ✅ Deploy (5 min)
   Push to production
   Set env variables

5. ✅ Test Production (10 min)
   https://clientportal.goodlife-publishing.com/forgot-password
   Complete flow test

Total: ~45 minutes
```

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| Setup Time | 10 min |
| Testing Time | 20 min |
| Deployment Time | 10 min |
| Total Time | ~40 min |
| Recovery Token Expiry | 24 hours |
| Session Duration | 1 hour |
| Cooldown Period | 60 seconds |
| Password Min Length | 8 characters |

---

## 🎯 URLs to Remember

```
Development:
http://localhost:3000/forgot-password
http://localhost:3000/reset-password

Production:
https://clientportal.goodlife-publishing.com/forgot-password
https://clientportal.goodlife-publishing.com/reset-password

Supabase Dashboard:
https://app.supabase.com → Your Project → Authentication
```

---

## 💡 Pro Tips

✅ **Use `window.location.origin`** - Gets correct domain (dev/prod)  
✅ **Check `recovery_sent_at`** - Only set for recovery sessions  
✅ **Test in private window** - Bypasses cache issues  
✅ **Monitor 429 errors** - Indicates rate limit hit  
✅ **Check spam folder** - Emails sometimes go there  
✅ **Use browser DevTools** - Console, Network, Application tabs  
✅ **Set up error logging** - Monitor production issues  

---

## 🔗 Code File Locations

```
src/app/forgot-password/page.tsx     ← Send reset email
src/app/reset-password/page.tsx      ← Update password
src/lib/supabaseClient.ts            ← Config (detectSessionInUrl)
src/lib/auth.tsx                     ← Auth context
```

---

## 📋 Forgot Password Email Template Variables

```html
<!-- Available in Supabase email template -->
{{ .ConfirmationURL }}   ← Reset link with token
{{ .Token }}             ← Just the token (not recommended)
{{ .EmailAddress }}      ← User's email
```

Example in email:
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

---

## 🎓 One-Liner Definitions

**Recovery Session:**  
Temporary authentication that allows password updates via reset link.

**URL Fragment:**  
The `#hash` part of URL; not sent to server, more secure for tokens.

**detectSessionInUrl:**  
Supabase setting that watches URL fragment for recovery tokens.

**Recovery Token:**  
Secure random string that validates reset email link, expires after 24 hours.

**One-Time Token:**  
Token can only be used once; invalidated after password update.

---

## ✨ Final Checklist Before Going Live

- [ ] Supabase URLs whitelisted (4 URLs)
- [ ] detectSessionInUrl = true
- [ ] storage = localStorage
- [ ] Environment variables set
- [ ] Build succeeds: npm run build
- [ ] Local testing passed (all 5 tests)
- [ ] Production domain HTTPS active
- [ ] Email template customized (optional)
- [ ] Error logging configured
- [ ] Support team trained

**Ready to deploy!** 🚀

---

## 🆘 Emergency Fixes (Super Quick)

| Issue | Fix in 30 seconds |
|-------|-------------------|
| Reset link doesn't work | Check Supabase URL whitelist |
| Session not detected | Set detectSessionInUrl: true |
| Session lost on reload | Use localStorage not sessionStorage |
| Email not received | Check spam, wait 2 min, check logs |
| Button won't enable | Password doesn't meet requirements |
| Rate limit error | Wait 60 seconds, try again |

---

## 📞 Quick Support Responses

**User: "I didn't receive the reset email"**
> Check your spam/promotions folder. Also, it can take 2-3 minutes to arrive. If still nothing after 5 minutes, try requesting another reset link.

**User: "The reset link says it's invalid"**
> This usually means the link expired. Please go back and request a new reset link. Recovery links are only valid for 24 hours.

**User: "Password update keeps failing"**
> Make sure your password is at least 8 characters and includes uppercase letters, lowercase letters, and numbers.

**User: "I clicked the reset link but nothing happened"**
> Try in a private/incognito window. Sometimes cached data causes issues. Make sure JavaScript is enabled in your browser.

---

## 🎉 Success Indicators

✅ User receives reset email within 2 minutes  
✅ Clicking link lands on /reset-password with form visible  
✅ Password form validates in real-time  
✅ Submit button enables when password is strong  
✅ "Update Password" shows loading state  
✅ Success toast appears  
✅ Redirects to login after 2 seconds  
✅ User logs in with new password ✓

---

**Print this card and keep it handy!** 📌

