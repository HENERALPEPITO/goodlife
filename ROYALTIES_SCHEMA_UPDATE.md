# Royalties Schema Update

## Important Discovery

The `royalties.artist_id` column **actually references `artists.id`**, not `auth.users.id`, despite what the constraint definition might show.

## Error Evidence

When trying to insert royalties with `auth.users.id`:
```
Error: Key (artist_id)=(920946a9-1d77-45c9-bb72-aaf80aa2769e) is not present in table "artists"
```

This clearly indicates that the database is checking the `artists` table, not `auth.users`.

## Solution

**Use `artists.id` for `royalties.artist_id`**, not `auth.users.id`.

## Updated Schema Relationships

| Table | Column | References | Use |
|-------|--------|------------|-----|
| `tracks` | `artist_id` | `artists.id` | Use `artists.id` |
| `royalties` | `artist_id` | `artists.id` | Use `artists.id` (NOT `auth.users.id`) |
| `payment_requests` | `artist_id` | `auth.users.id` | Use `auth.users.id` |
| `invoices` | `artist_id` | `auth.users.id` | Use `auth.users.id` |

## Code Changes

The royalty uploader has been updated to:
1. Use `artists.id` for both `tracks.artist_id` and `royalties.artist_id`
2. Only use `auth.users.id` for `payment_requests.artist_id` and `invoices.artist_id`

## For Artist: artist@test.com

- **User UUID** (`auth.users.id`): `920946a9-1d77-45c9-bb72-aaf80aa2769e`
- **Artist UUID** (`artists.id`): `c5e680a3-e47b-4729-8361-ae34c3c340bc`

Use:
- **Artist UUID** for: `tracks.artist_id`, `royalties.artist_id`
- **User UUID** for: `payment_requests.artist_id`, `invoices.artist_id`




