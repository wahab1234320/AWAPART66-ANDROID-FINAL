ALTER TABLE units ADD COLUMN IF NOT EXISTS commission_bps integer CHECK (commission_bps BETWEEN 0 AND 10000);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_bps_snapshot integer CHECK (commission_bps_snapshot BETWEEN 0 AND 10000);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_id_snapshot bigint;
CREATE INDEX IF NOT EXISTS bookings_owner_snapshot_idx ON bookings(owner_id_snapshot);
