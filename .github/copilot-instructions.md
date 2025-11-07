## Repo quick-start for AI assistants

This file gives focused, actionable context so an AI coding agent can be immediately productive in this repository.

Summary
- Framework: Next.js 16 (app directory) + React 19 + TypeScript (strict). UI uses Tailwind + Radix components.
- Backend & data: Supabase (client and SSR helpers) — DB migrations and SQL live at repo root (many .sql files).
- Main runtime scripts: `npm run dev` (Next dev), `npm run build`, `npm start`, `npm run lint`.

High-level architecture (why/how)
- Frontend: `src/app` (Next 16 app-router). Many pages are server or client components; look for `"use client"` at top of files to identify client code.
- Shared libs: `src/lib` contains Supabase client/wrappers, auth context/hooks and helpers (`supabaseClient.ts`, `auth.tsx`, `proxy.ts`). These encapsulate session handling and are the primary integration points with Supabase.
- Components: `src/components` holds UI building blocks (Topbar, Sidebar, invoices, PDF generator). Reuse these rather than duplicating styles.
- Data flows: UI -> `supabase` client (in `src/lib/supabaseClient.ts`) -> Supabase Postgres tables. Example flows:
  - Auth: `src/lib/auth.tsx` (AuthProvider + `useAuth`) subscribes to Supabase auth state and loads `user_profiles`.
  - Route protection & SSR: `src/proxy.ts` uses `createServerClient` to refresh/read cookies and redirects non-authorized users for admin/artist routes.
  - CSV upload (royalties): `src/app/royalty-uploader/page.tsx` parses CSV (PapaParse), creates/queries `tracks` and inserts `royalties` rows.

Important files to inspect when making changes
- `src/lib/supabaseClient.ts` — single client used in client code. Environment-backed defaults are present for local dev.
- `src/proxy.ts` — Next middleware-like proxy that refreshes sessions for SSR and protects routes. matcher covers `/admin`, `/artist`, `/api`, `/invoices`.
- `src/lib/auth.tsx` — AuthProvider + `useAuth` hook. Many pages call `useAuth()` to gate UI and redirect.
- `src/app/royalty-uploader/page.tsx` — Good example of: CSV parsing expectations, DB inserts, and handling admin-only flows. Useful examples for testing or adding similar uploaders.
- `src/components` — Common UI components and small utilities (e.g., `PDFGenerator.tsx`, `InvoiceManager.tsx`).
- Root SQL files: many migration and schema files (e.g., `database-schema.sql`, `create-test-user.js`, various `*-migration.sql`) — use them when reasoning about DB shape.

Conventions and notable project-specific patterns
- Path alias: `@/*` maps to `./src/*` (see `tsconfig.json`). Use `@/...` imports when adding code.
- Auth and roles: Users get a `user_profiles` record with a `role` column (values include `admin` and `artist`). Code often does a light role check in middleware and heavy checks inside page components.
- Supabase defaults: The repo ships with hard-coded fallback values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in libs. Local dev often works without env when those are present, but do not commit real secret keys. Prefer env vars.
- Client vs Server components: Files with `"use client"` are interactive and should import client-only libs (hooks, useState, supabase client). Server components must not rely on client-only hooks.
- Toasts & UI feedback: The project uses a `use-toast` hook and components from `src/components/ui/*` for consistent messages — follow that pattern.

Build, test and debug commands (what to run)
- Start dev server: `npm run dev` — uses Next dev server.
- Build: `npm run build` then `npm start` to run production build.
- Lint: `npm run lint` (ESLint). Run this before PRs.
- Quick debug notes: Next 16 app routing + environment: ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set for auth flows. The middleware/proxy expects session cookies to be present.

Integration points & external dependencies
- Supabase: `@supabase/supabase-js` and `@supabase/ssr` used. Server-side session refreshes use `createServerClient` (see `src/proxy.ts`).
- Database: migrations and SQL files in repo root describe tables used by code (notably `user_profiles`, `tracks`, `royalties`, `invoices`). Inspect SQL files when adding columns or changing queries.
- Third-party libs to be aware of: PapaParse (CSV), jspdf + jspdf-autotable (PDF export), @tanstack/react-query used in some pages.

Small examples to reference when coding
- CSV uploader columns expected: Song Title, ISWC, Composer, Date, Territory, Source, Usage Count, Gross, Admin %, Net — see `src/app/royalty-uploader/page.tsx`.
- Route protection matcher: see `src/proxy.ts` `config.matcher` — any change to routes should keep this in sync.
- Auth hook usage: components call `const { user, loading } = useAuth();` and check `user?.role` — see `src/lib/auth.tsx` and `src/app/royalty-uploader/page.tsx`.

What NOT to change lightly
- DO NOT replace the Supabase client pattern without migrating both client and SSR usages (`supabaseClient.ts` vs `createServerClient`) — both patterns are used.
- DB schema changes: update the SQL migrations in repo root and consider downstream queries in `src` (search for table names) before pushing changes.

If you need more context or want me to expand any section (examples, tests to add, or CI steps), tell me which area to deepen and I will iterate.
