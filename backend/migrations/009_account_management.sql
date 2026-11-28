ALTER TABLE admins ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS super_admin boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS owner_applications(id bigserial PRIMARY KEY, full_name text NOT NULL, email text NOT NULL, phone text NOT NULL, status text NOT NULL DEFAULT 'PENDING', created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS owner_application_pending_email ON owner_applications(lower(email)) WHERE status='PENDING';
CREATE TABLE IF NOT EXISTS account_email_changes(digest text PRIMARY KEY, role text NOT NULL, account_id bigint NOT NULL, old_email text NOT NULL, new_email text NOT NULL, old_hash text NOT NULL, new_hash text NOT NULL, expires_at timestamptz NOT NULL);
