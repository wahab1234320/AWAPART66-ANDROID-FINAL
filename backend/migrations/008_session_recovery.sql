ALTER TABLE admins ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE owner_accounts ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS revoked_sessions(jti text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS privileged_recovery(digest text PRIMARY KEY, role text NOT NULL CHECK(role IN ('admin','owner')), account_id bigint NOT NULL, email text NOT NULL, expires_at timestamptz NOT NULL);
