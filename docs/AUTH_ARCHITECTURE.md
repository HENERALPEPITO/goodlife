# Authentication Architecture

This document explains the optimized authentication system for the Goodlife Music app.

## Overview

The authentication system has been refactored for speed and reliability:

1. **Role stored in `user_metadata`** - Role is embedded in the JWT token, eliminating database queries
2. **Middleware-based route protection** - Redirects happen at the edge before page loads
3. **Proper loading states** - No UI hang during auth initialization
4. **Persistent sessions** - Using `localStorage` instead of `sessionStorage`

## Folder Structure

```
src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts      # Browser client (use in client components)
│   │   ├── server.ts      # Server client (use in server components, API routes)
│   │   └── middleware.ts  # Middleware client (used by middleware.ts)
│   ├── auth.tsx           # AuthProvider and useAuth hook
│   ├── authHelpers.ts     # Server-side auth helpers
│   └── hooks/
│       └── useUser.ts     # Convenient hook for user data
├── components/
│   ├── AuthLoading.tsx    # Loading spinner component
│   └── ProtectedRoute.tsx # Route protection wrapper
└── middleware.ts          # Root middleware for session refresh
```

## Key Concepts

### 1. Role in user_metadata

Instead of querying `user_profiles` table on every page load, the role is stored in `user_metadata`:

```typescript
// During signup
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: "artist" }, // Stored in JWT
  },
});
```

This is accessible instantly from the JWT token without any database query:

```typescript
const role = user.user_metadata?.role; // Instant, no DB query
```

### 2. Middleware Route Protection

The `middleware.ts` at the root handles:
- Session refresh on every request
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login`
- Role-based access control for `/admin/*` and `/artist/*` routes

### 3. AuthProvider

The `AuthProvider` in `src/lib/auth.tsx`:
- Creates a single Supabase client instance
- Reads role from `user_metadata` first (fast path)
- Falls back to DB query only for legacy users (slow path)
- Auto-syncs role to `user_metadata` for future instant access

### 4. Loading States

Use `isInitialized` from `useAuth()` to prevent UI hang:

```typescript
const { user, loading, isInitialized } = useAuth();

if (!isInitialized) {
  return <AuthLoading message="Initializing..." />;
}
```

## Usage Examples

### 1. Client Component with Auth

```tsx
"use client";
import { useAuth } from "@/lib/auth";
import AuthLoading from "@/components/AuthLoading";

export default function MyPage() {
  const { user, loading, isInitialized } = useAuth();

  if (!isInitialized || loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return <div>Welcome, {user.email}</div>;
}
```

### 2. Protected Page (Admin Only)

```tsx
"use client";
import ProtectedRoute from "@/components/ProtectedRoute";

function AdminContent() {
  return <div>Admin Dashboard</div>;
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminContent />
    </ProtectedRoute>
  );
}
```

### 3. Server Component

```tsx
import { getCurrentUser } from "@/lib/authHelpers";
import { redirect } from "next/navigation";

export default async function ServerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <div>Welcome, {user.email}</div>;
}
```

### 4. API Route

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  // ... rest of API logic
}
```

### 5. Login Redirect

```tsx
const result = await signIn(email, password);

if (!result.error) {
  router.push("/"); // Main dashboard for all users
}
```

## Migration for Existing Users

Run the SQL migration to sync existing users' roles to `user_metadata`:

```bash
# Option 1: Run in Supabase SQL Editor
# Copy contents of: supabase/migrations/20241202_sync_role_to_user_metadata.sql

# Option 2: Run the Node.js script
# Set SUPABASE_SERVICE_ROLE_KEY in environment
node scripts/sync-user-metadata.js
```

## Route Protection Matrix

| Route Pattern | Admin Access | Artist Access |
|--------------|--------------|---------------|
| `/login` | Redirect to `/` | Redirect to `/` |
| `/admin/*` | ✅ Allowed | ❌ Redirect to `/` |
| `/artist/*` | ❌ Redirect to `/` | ✅ Allowed |
| `/` | ✅ Allowed (shows admin view) | ✅ Allowed (shows artist view) |
| `/analytics` | ✅ Allowed | ✅ Allowed |

## Performance Benefits

1. **No DB query on page load** - Role comes from JWT token
2. **Session persists across browser close** - Using `localStorage`
3. **Early redirects** - Middleware handles auth before page renders
4. **Single source of truth** - All auth logic in `AuthProvider`
5. **Optimized for Supabase Free Tier** - Minimal API calls

## Troubleshooting

### "Role is undefined"
Run the migration script to sync existing users' roles to `user_metadata`.

### "Infinite loading"
Check if `isInitialized` is being used in your loading conditions.

### "Session lost on refresh"
Ensure `localStorage` is being used (check `supabaseClient.ts`).

### "Middleware not running"
Ensure `middleware.ts` is at the project root (not in `src/`).
