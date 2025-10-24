GoodLife: Cloud Workspace for Streamlined Music Business
========================================================

MVP web app to manage catalog, royalties, analytics, and settings.

Tech Stack
----------
- Next.js (App Router), TypeScript, TailwindCSS
- Supabase (Auth/DB/Storage) – client stubbed; wire `.env` to enable
- Recharts, jsPDF, PapaParse

Getting Started
---------------
1. Create `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
2. Install and run:
   - `npm install`
   - `npm run dev` → `http://localhost:3000`

Auth (MVP)
----------
- Client auth context + cookie gate via middleware.
- Go to `/login` to choose role and sign in. Replace with Supabase Auth for production.

Modules
-------
- Dashboard: KPIs and recent activity (mock)
- Analytics: Line/Bar charts (Recharts, mock data)
- Catalog: CRUD via mock API routes
- Royalties: Pagination/filter, CSV and PDF export
- Settings: Profile and invoicing forms

Deployment
----------
- Vercel recommended. Ensure env vars are set in project settings.
