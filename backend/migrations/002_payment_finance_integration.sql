-- Additive/idempotent: retain all existing booking and finance rows.
BEGIN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_verified_by TEXT;
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'UNKNOWN';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_payment_method_check') THEN
  ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('CASH','TRANSFER','UNKNOWN'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='finance_entries_payment_method_check') THEN
  ALTER TABLE finance_entries ADD CONSTRAINT finance_entries_payment_method_check CHECK (payment_method IN ('CASH','TRANSFER','UNKNOWN'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bookings_verified_at ON bookings(payment_verified_at);
COMMIT;
