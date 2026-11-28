ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS customer_email_tokens (digest text PRIMARY KEY, customer_id bigint NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE, purpose text NOT NULL CHECK(purpose IN ('verify','reset')), expires_at timestamptz NOT NULL);
