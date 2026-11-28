-- AWAPART 66 additive migration: safe to re-run; does not delete existing records.
BEGIN;

CREATE TABLE IF NOT EXISTS owner_accounts (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE units ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES owner_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_units_owner_id ON units(owner_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_verified_by TEXT;

CREATE TABLE IF NOT EXISTS finance_entries (
  id BIGSERIAL PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME','EXPENSE')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  unit_id INT REFERENCES units(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON finance_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_booking ON finance_entries(booking_id);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT REFERENCES owner_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
