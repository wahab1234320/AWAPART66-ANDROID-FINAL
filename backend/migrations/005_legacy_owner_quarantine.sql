BEGIN;
LOCK TABLE units, bookings, owner_accounts IN ACCESS EXCLUSIVE MODE;
-- Only the observed legacy state is supported. Do not guess mappings.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM owner_accounts) OR EXISTS (SELECT 1 FROM bookings WHERE owner_id_snapshot IS NOT NULL) THEN
 RAISE EXCEPTION 'Owner mapping requires manual review'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS legacy_unit_owner_review (
 unit_id integer PRIMARY KEY REFERENCES units(id), legacy_owner_id text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now());
INSERT INTO legacy_unit_owner_review(unit_id,legacy_owner_id)
 SELECT id,owner_id::text FROM units WHERE owner_id IS NOT NULL
 ON CONFLICT(unit_id) DO NOTHING;
-- Preserve the legacy reference before clearing the incompatible active relation.
ALTER TABLE units ALTER COLUMN owner_id DROP NOT NULL;
UPDATE units SET owner_id=NULL WHERE owner_id IS NOT NULL;
-- Replace only foreign keys on owner_id pointing to the legacy owners table.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.conname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname='owner_id'
 WHERE c.conrelid='units'::regclass AND c.contype='f' AND c.conkey=ARRAY[a.attnum] AND c.confrelid=to_regclass('public.owners')
 LOOP EXECUTE format('ALTER TABLE units DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE units ADD CONSTRAINT units_owner_accounts_v248_fk FOREIGN KEY(owner_id) REFERENCES owner_accounts(id) ON DELETE SET NULL;
COMMIT;
