ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS google_sub text UNIQUE;
CREATE TABLE IF NOT EXISTS google_attempts(state text PRIMARY KEY,poll_digest text UNIQUE NOT NULL,verifier text NOT NULL,expires_at timestamptz NOT NULL,used boolean NOT NULL DEFAULT false,failed boolean NOT NULL DEFAULT false,customer_id bigint REFERENCES customer_accounts(id) ON DELETE CASCADE);
