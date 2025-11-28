# GoodLife System Overview & Setup

This document replaces all the scattered feature/guide Markdown files. It is the **single source of truth** for:

- **Database schema & functions**
- **Core features** (artists, tracks, royalties, invoices, payments)
- **Supabase setup** (Auth, Storage, RLS overview)
- **Key frontend flows** (Artist Track Manager, CSV Royalty Uploader, Artist Royalties)

---

## 1. Database Schema (High Level)

Tables:

- **user_profiles**
  - `id` (uuid, PK, references `auth.users.id`)
  - `email` (text, unique)
  - `role` (text: `admin` | `artist`)
  - `created_at` (timestamptz)

- **artists**
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → `user_profiles.id`)
  - `name` (text)
  - `email` (text, optional)
  - `phone` (text, optional)
  - `address` (text, optional)
  - `address_locked` (boolean, default false)
  - `created_at` (timestamptz)

- **tracks**
  - `id` (uuid, PK)
  - `artist_id` (uuid, FK → `artists.id`)
  - `title` (text, optional)
  - `song_title` (text, main catalog title)
  - `artist_name` (text)
  - `composer_name` (text)
  - `isrc` (text)
  - `iswc` (text, optional)
  - `split` (text, e.g. `"100%"`)
  - `release_date`, `platform`, `territory` (optional)
  - `uploaded_by` (uuid, FK → `user_profiles.id`)
  - `created_at` (timestamptz)

- **royalties**
  - `id` (uuid, PK)
  - `track_id` (uuid, FK → `tracks.id`)
  - `artist_id` (uuid, FK → `artists.id`)
  - `usage_count` (int)
  - `gross_amount` (numeric)
  - `admin_percent` (numeric)
  - `net_amount` (numeric)
  - `broadcast_date` (date)
  - `exploitation_source_name` (text)
  - `territory` (text)
  - `is_paid` (boolean, default false)
  - `created_at` (timestamptz)

- **payment_requests**
  - `id` (uuid, PK)
  - `artist_id` (uuid, FK → `artists.id`)
  - `amount` (numeric)
  - `status` (`pending` | `approved` | `rejected` | `paid`)
  - `created_at`, `updated_at`

- **invoices**
  - `id` (uuid, PK)
  - `artist_id` (uuid, FK → `artists.id`)
  - `payment_request_id` (uuid, FK → `payment_requests.id`)
  - `amount` (numeric)
  - `invoice_number` (text, unique)
  - `mode_of_payment` (text)
  - `status` (`pending` | `approved` | `paid` | `rejected`)
  - `remarks` (text)
  - `file_url` (text, PDF in storage)
  - `created_at`, `updated_at`

Indexes and functions are defined in `RESTORE_DATABASE.sql`.

---

## 2. One-Click DB Setup

Use **`RESTORE_DATABASE.sql`** in Supabase SQL Editor to:

- Create all tables and indexes
- Disable RLS for development
- Add `get_unpaid_royalties_total(artist_uuid)`
- Add `mark_royalties_as_paid(artist_uuid)`
- Grant required permissions

Then, in Supabase **Storage**:

- Create bucket **`royalties`** – for CSV royalty uploads
- Create bucket **`invoices`** – for generated PDF invoices

---

## 3. Core Features

### 3.1 Artist Management

- Admin creates users in Supabase Auth.
- Insert matching rows in `user_profiles` (role `artist` or `admin`).
- Create rows in `artists` referencing `user_profiles.id`.

Used in:

- `src/app/admin/artist-tracks/page.tsx` (Artist Track Manager)
- `src/app/royalties/page.tsx` (Artist royalties view)

---

### 3.2 Track Catalog (Artist Track Manager)

**Frontend:** `src/app/admin/artist-tracks/page.tsx`

- Admin selects an artist.
- Uploads a CSV containing track metadata.
- CSV is parsed client-side (PapaParse via `parseCatalogCsv`).
- Valid rows are inserted into `tracks`.

**Required CSV columns (exact headers):**

- `Song Title`
- `Composer Name`
- `ISRC`
- `Artist`
- `Split`

**Template export:**

- Button in Artist Track Manager exports `track-catalog-template.csv` with required headers + example row.

**Validation:**

- Missing `Song Title` → row rejected.
- Missing `ISRC` → row rejected with error.
- Different `Artist` vs selected artist → allowed, but adds a warning.

---

### 3.3 Royalty CSV Uploader

**Frontend:** `src/app/royalty-uploader/page.tsx`

- Admin selects an artist.
- Uploads a **royalties CSV**.
- File is uploaded to Storage bucket `royalties`.
- API route `/api/royalties/ingest` processes the CSV server-side.

**Required CSV columns (displayed in UI):**

- `Song Title`
- `ISWC`
- `Composer`
- `Date`
- `Territory`
- `Source`
- `Usage Count`
- `Gross`
- `Admin %`
- `Net`

**Template export:**

- Button in CSV Royalty Uploader exports `royalty-upload-template.csv` with the above headers + example row.

**Server-side ingestion:** `src/app/api/royalties/ingest/route.ts`

- Downloads CSV from Storage.
- Parses with PapaParse (Node).
- Normalizes columns (case-insensitive matching).
- For each unique `Song Title`:
  - Finds or creates a `tracks` row.
- Inserts royalties into `royalties` in batches.

---

### 3.4 Artist Royalties & Balance

**Frontend:** `src/app/royalties/page.tsx`

- For logged-in artist:
  - Finds their `artists.id` via `user_profiles`.
  - Fetches unpaid royalties from `royalties` where `is_paid = false`.
  - Shows current unpaid balance.

- `handleRequestPayment()`:
  - Calls `/api/payment/request` with `artist_id`.

**API:** `src/app/api/payment/request/route.ts`

Workflow:

1. **Compute unpaid total**
   - Calls `get_unpaid_royalties_total(artist_uuid)`.
   - Requires balance ≥ 100.
2. **Check existing payment requests**
   - No existing `pending/approved` for this artist.
3. **Create payment request** in `payment_requests`.
4. **Mark royalties as paid** via `mark_royalties_as_paid(artist_uuid)`.
5. **Generate invoice PDF**
   - Uses `getInvoiceSettingsAdmin`, `generatePaymentRequestInvoicePDF`.
6. **Upload PDF** to `invoices` bucket → store `file_url`.
7. **Create invoice record** in `invoices`.
8. **Send admin notification email**.

---

## 4. Supabase Setup Summary

- **Auth:**
  - Use Supabase Dashboard to create users.
  - Mirror users in `user_profiles` with `role`.

- **Database:**
  - Run `RESTORE_DATABASE.sql` once.
  - For production, re-enable RLS and policies as needed.

- **Storage:**
  - `royalties` – CSV uploads
  - `invoices` – PDFs

- **Functions:**
  - `get_unpaid_royalties_total(artist_uuid UUID)`
  - `mark_royalties_as_paid(artist_uuid UUID)`

---

## 5. Admin Workflows

- **Create Admin:**
  - Create user in Auth with email `admin@test.com` (for example).
  - In SQL:
    ```sql
    INSERT INTO user_profiles (id, email, role)
    SELECT id, email, 'admin'
    FROM auth.users
    WHERE email = 'admin@test.com'
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
    ```

- **Create Artist:**
  - Create user in Auth.
  - Insert into `user_profiles` with role `artist`.
  - Insert into `artists` with `user_id` and `name`.

---

## 6. Files to Know

- **Database:**
  - `RESTORE_DATABASE.sql` – full schema + functions + indexes.

- **Key frontend pages:**
  - `src/app/admin/artist-tracks/page.tsx` – Artist Track Manager (catalog CSV).
  - `src/app/royalty-uploader/page.tsx` – Admin Royalty CSV Uploader.
  - `src/app/royalties/page.tsx` – Artist view of royalties + request payment.

- **API routes:**
  - `src/app/api/royalties/ingest/route.ts` – Royalty ingestion.
  - `src/app/api/payment/request/route.ts` – Payment request + invoice generation.

---

## 7. How to Rebuild from Scratch

1. **Create fresh Supabase project.**
2. In **SQL Editor**, paste and run `RESTORE_DATABASE.sql`.
3. In **Storage**, create buckets `royalties` and `invoices`.
4. In **Auth**, create:
   - An admin user → insert into `user_profiles` with role `admin`.
   - Artist users → insert into `user_profiles` with role `artist` and create `artists` rows.
5. Deploy the frontend with existing env config (Supabase URL, anon key, service key for admin functions).
6. Test flows:
   - Login as admin → Artist Track Manager, CSV Royalty Uploader.
   - Login as artist → Royalties page, request payment flow.

This single document + `RESTORE_DATABASE.sql` is all you need to understand and restore the GoodLife system.
