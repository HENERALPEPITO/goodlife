-- Artist Management Migration
-- Add phone and address_locked fields to artists table

-- Add phone and address_locked fields
ALTER TABLE artists 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address_locked BOOLEAN DEFAULT FALSE;

-- Add email field to artists table (for easier access without joining user_profiles)
ALTER TABLE artists 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing artists to have email from user_profiles
UPDATE artists a
SET email = (
  SELECT email 
  FROM user_profiles up 
  WHERE up.id = a.user_id
)
WHERE email IS NULL;

-- Set default address if not set
UPDATE artists
SET address = 'Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain'
WHERE address IS NULL OR address = '';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_artists_email ON artists(email);


