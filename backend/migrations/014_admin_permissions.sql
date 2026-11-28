ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;
