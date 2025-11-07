# Artist Schema Relationships

## Important: Understanding the Database Schema

The database has **two different ID systems** for artists:

### 1. `auth.users.id` (User UUID)
- Primary identifier for authentication
- Example: `920946a9-1d77-45c9-bb72-aaf80aa2769e`
- Used in:
  - `user_profiles.id`
  - `royalties.artist_id`
  - `payment_requests.artist_id`
  - `invoices.artist_id`
  - `artists.user_id`

### 2. `artists.id` (Artist Record UUID)
- Primary key of the `artists` table
- Example: `c5e680a3-e47b-4729-8361-ae34c3c340bc`
- Used in:
  - `tracks.artist_id` ⚠️ **IMPORTANT**

## Key Relationships

```
auth.users (id)
    ↓
artists (user_id → auth.users.id)
    ↓
artists (id) ← tracks.artist_id
```

## Common Issues

### ❌ Wrong: Using user_id for tracks
```sql
-- This will FAIL with foreign key error
INSERT INTO tracks (artist_id, title)
VALUES ('920946a9-1d77-45c9-bb72-aaf80aa2769e', 'My Track');
-- Error: Key (artist_id)=(920946a9-1d77-45c9-bb72-aaf80aa2769e) is not present in table "artists"
```

### ✅ Correct: Using artists.id for tracks
```sql
-- First get the artists.id from user_id
SELECT id FROM artists WHERE user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';
-- Result: c5e680a3-e47b-4729-8361-ae34c3c340bc

-- Then use it
INSERT INTO tracks (artist_id, title)
VALUES ('c5e680a3-e47b-4729-8361-ae34c3c340bc', 'My Track');
```

## Helper Function

Use `getArtistIdFromUserId()` from `src/lib/artistHelpers.ts`:

```typescript
import { getArtistIdFromUserId } from '@/lib/artistHelpers';

const userId = '920946a9-1d77-45c9-bb72-aaf80aa2769e';
const artistId = await getArtistIdFromUserId(userId);
// Returns: 'c5e680a3-e47b-4729-8361-ae34c3c340bc'

// Now use artistId for tracks
await supabase
  .from('tracks')
  .insert({ artist_id: artistId, title: 'My Track' });
```

## Quick Reference Table

| Table | Column | References | Type |
|-------|--------|------------|------|
| `user_profiles` | `id` | `auth.users.id` | User UUID |
| `artists` | `id` | (primary key) | Artist UUID |
| `artists` | `user_id` | `auth.users.id` | User UUID |
| `tracks` | `artist_id` | `artists.id` | **Artist UUID** ⚠️ |
| `royalties` | `artist_id` | `auth.users.id` | User UUID |
| `payment_requests` | `artist_id` | `auth.users.id` | User UUID |
| `invoices` | `artist_id` | `auth.users.id` | User UUID |

## For Artist: artist@test.com

- **User UUID**: `920946a9-1d77-45c9-bb72-aaf80aa2769e`
- **Artist UUID**: `c5e680a3-e47b-4729-8361-ae34c3c340bc`

Use:
- **User UUID** for: royalties, payment_requests, invoices
- **Artist UUID** for: tracks


