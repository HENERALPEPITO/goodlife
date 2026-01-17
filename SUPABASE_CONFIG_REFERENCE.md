# Supabase Dashboard Configuration - Quick Reference

## Production URL: https://clientportal.goodlife-publishing.com

---

## Step 1: Redirect URL Whitelist

**Location:** Supabase Dashboard → Authentication → URL Configuration

**Add these redirect URLs:**

```
http://localhost:3000/reset-password
http://localhost:3000/resetpassword
https://clientportal.goodlife-publishing.com/reset-password
https://clientportal.goodlife-publishing.com/resetpassword
```

> **Why both paths?** Some email clients may route to either version. Having both ensures compatibility.

---

## Step 2: Email Provider Configuration

**Location:** Supabase Dashboard → Authentication → Email Templates → Reset Password

### Default Template
Supabase provides a default email template. To view it:
1. Click the **Reset Password** template
2. Scroll down to see the default message
3. The `{{ .ConfirmationURL }}` variable contains your reset link

### Custom Template Example

```html
<html>
  <head>
    <title>Password Reset</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background-color: #f5f5f5;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: white;
        border-radius: 8px;
        padding: 40px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .logo {
        text-align: center;
        margin-bottom: 30px;
      }
      .logo img {
        max-width: 150px;
        height: auto;
      }
      h1 {
        color: #1a202c;
        font-size: 24px;
        margin-bottom: 16px;
        text-align: center;
      }
      p {
        color: #4a5568;
        line-height: 1.6;
        margin-bottom: 16px;
      }
      .cta-button {
        display: inline-block;
        padding: 12px 32px;
        background-color: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        text-align: center;
        margin: 24px 0;
      }
      .cta-button:hover {
        background-color: #2563eb;
      }
      .footer {
        border-top: 1px solid #e2e8f0;
        padding-top: 20px;
        margin-top: 30px;
        font-size: 12px;
        color: #718096;
        text-align: center;
      }
      .warning {
        background-color: #fff5e6;
        border-left: 4px solid #f59e0b;
        padding: 16px;
        margin: 24px 0;
        border-radius: 4px;
        font-size: 14px;
        color: #92400e;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Logo -->
      <div class="logo">
        <img src="https://yourdomain.com/logo.png" alt="Good Life Music" />
      </div>

      <!-- Greeting -->
      <h1>Reset Your Password</h1>
      
      <p>Hello,</p>
      
      <p>We received a request to reset the password for your Good Life Music Client Portal account. Click the button below to create a new password.</p>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="cta-button">Reset Password</a>
      </div>

      <!-- Alternative Text Link -->
      <p style="text-align: center; font-size: 12px; color: #718096;">
        Or copy and paste this link in your browser:<br/>
        <code>{{ .ConfirmationURL }}</code>
      </p>

      <!-- Warning -->
      <div class="warning">
        <strong>⏰ This link expires in 24 hours.</strong> If you didn't request a password reset, you can safely ignore this email. Your account is secure.
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>
          © 2024 Good Life Music. All rights reserved.<br/>
          If you have any questions, <a href="https://clientportal.goodlife-publishing.com/contact" style="color: #3b82f6; text-decoration: none;">contact us</a>.
        </p>
      </div>
    </div>
  </body>
</html>
```

**To upload custom template:**
1. Click "Customize email" checkbox
2. Paste the HTML above
3. Update logo URL to your actual logo
4. Update contact link to your support page
5. Click "Save"

---

## Step 3: Sender Configuration (Optional)

**Location:** Supabase Dashboard → Authentication → Email Templates

If you want emails to come from a custom sender (e.g., `support@goodlife-publishing.com`):

1. Go to **Project Settings** → **Email Provider**
2. Configure SMTP if using external provider
3. Or contact Supabase support to configure custom sender

---

## Step 4: Test Email Send

**To test the password reset flow manually:**

```bash
# Using Supabase CLI
supabase functions invoke send_reset_email --token YOUR_SERVICE_ROLE_KEY --body '{
  "email": "test@example.com",
  "redirectTo": "https://clientportal.goodlife-publishing.com/reset-password"
}'
```

Or test through the UI:
1. Create a test user in Supabase
2. On your forgot-password page, enter the test email
3. Send reset email
4. Check email inbox

---

## Step 5: Enable Rate Limiting (Optional but Recommended)

**Location:** Supabase Dashboard → Authentication → Security

**To prevent password reset spam:**
1. Check "Enable rate limiting"
2. Set reasonable limits (e.g., 5 requests per 15 minutes)
3. Save settings

> Note: The frontend also implements a 60-second cooldown

---

## Verification Checklist

- ☑️ **Redirect URLs are whitelisted** - Both http://localhost and https://production
- ☑️ **Uses HTTPS** - Production URL must use HTTPS
- ☑️ **Email template is correct** - Test that links work
- ☑️ **Error emails are configured** - Know where to check failed sends
- ☑️ **Rate limiting active** - Prevents abuse
- ☑️ **Support team knows:** If users report "invalid link" errors:
  - Check if recovery session exists
  - Verify redirect URL in dashboard
  - Check user's spam/promotions folder

---

## Troubleshooting Configuration Issues

### Issue: "Invalid Redirect URI" error

**Solution:**
- Exact URL must match dashboard entry
- Check for typos (case-sensitive)
- Verify protocol (http vs https)
- Try adding both `/resetpassword` and `/reset-password` versions

### Issue: Emails not arriving

**Solution:**
1. Check Supabase logs: **Authentication** → **Logs** → **View all**
2. Look for "Email sent successfully" or error messages
3. Check spam folder
4. Wait 2-3 minutes (can be slow)
5. Verify email exists in Supabase users table

### Issue: Link works sometimes but not always

**Solution:**
1. Check if recovery token expired
2. Verify browser localStorage is enabled
3. Try different browser/device
4. Clear browser cache and cookies

---

## Environment Variables

For your Next.js application, ensure these are set:

**.env.local**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

These are used by `src/lib/supabaseClient.ts` to initialize the Supabase client.

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Password Reset Email Guide](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Email Configuration](https://supabase.com/docs/guides/auth/email-configuration)

