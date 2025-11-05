# Correct Column Names for Database Tables

## 📊 TRACKS Table

**Required columns:**
```sql
id                  UUID PRIMARY KEY
artist_id           UUID (references artists.id)
song_title          TEXT NOT NULL
composer_name       TEXT NOT NULL
isrc                TEXT NOT NULL
artist_name         TEXT NOT NULL
split               TEXT NOT NULL
uploaded_by         UUID (references user_profiles.id)
created_at          TIMESTAMP WITH TIME ZONE
```

**Note:** The code uses `song_title` (with underscore), NOT `title` or `songTitle`.

---

## 💰 ROYALTIES Table

**Required columns:**
```sql
id                          UUID PRIMARY KEY
track_id                    UUID (references tracks.id)
artist_id                   UUID (references artists.id)
usage_count                 INTEGER
gross_amount                NUMERIC(12,2) or NUMERIC(10,2)
admin_percent               NUMERIC(5,2)
net_amount                  NUMERIC(12,2) or NUMERIC(10,2)
broadcast_date              DATE
exploitation_source_name    TEXT
territory                   TEXT
created_at                  TIMESTAMP WITH TIME ZONE
```

**Note:** 
- `admin_percent` (not `administration_percent`)
- `track_id` and `artist_id` are both required

---

## 👤 ARTISTS Table

**Required columns:**
```sql
id              UUID PRIMARY KEY
user_id         UUID (references user_profiles.id)
name            TEXT NOT NULL
email           TEXT
phone           TEXT
address         TEXT
address_locked  BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP WITH TIME ZONE
```

---

## 👥 USER_PROFILES Table

**Required columns:**
```sql
id          UUID PRIMARY KEY (references auth.users.id)
email       TEXT NOT NULL UNIQUE
role        TEXT NOT NULL CHECK (role IN ('admin', 'artist'))
created_at  TIMESTAMP WITH TIME ZONE
```

---

## 🔧 SQL to Fix Tracks Table Schema

Run this in Supabase SQL Editor to ensure correct columns:

```sql
-- Ensure tracks table has correct columns
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS song_title TEXT,
ADD COLUMN IF NOT EXISTS composer_name TEXT,
ADD COLUMN IF NOT EXISTS isrc TEXT,
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS split TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Make sure artist_id references artists table
ALTER TABLE tracks 
DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey;

ALTER TABLE tracks
ADD CONSTRAINT tracks_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;
```

---

## 📝 CSV Column Mapping for Royalty Uploader

The CSV should have these columns (can be in any order):
- **Song Title** → maps to `song_title` in tracks table
- **ISWC** → maps to `isrc` in tracks table
- **Composer** → maps to `composer_name` in tracks table
- **Date** → maps to `broadcast_date` in royalties table
- **Territory** → maps to `territory` in both tables
- **Source** → maps to `exploitation_source_name` in royalties table
- **Usage Count** → maps to `usage_count` in royalties table
- **Gross** → maps to `gross_amount` in royalties table
- **Admin %** → maps to `admin_percent` in royalties table
- **Net** → maps to `net_amount` in royalties table

