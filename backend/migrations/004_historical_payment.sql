BEGIN;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE finance_entries DROP CONSTRAINT IF EXISTS finance_entries_payment_method_check;
ALTER TABLE bookings ALTER COLUMN payment_method SET DEFAULT 'UNKNOWN';
ALTER TABLE finance_entries ALTER COLUMN payment_method SET DEFAULT 'UNKNOWN';
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('CASH','TRANSFER','UNKNOWN'));
ALTER TABLE finance_entries ADD CONSTRAINT finance_entries_payment_method_check CHECK (payment_method IN ('CASH','TRANSFER','UNKNOWN'));
COMMIT;
