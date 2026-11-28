BEGIN;
ALTER TABLE owner_applications ADD COLUMN IF NOT EXISTS approved_owner_id bigint REFERENCES owner_accounts(id) ON DELETE SET NULL;
-- v255 approval creates both timestamps in the same transaction. Only link unambiguous verified matches.
WITH matches AS (
 SELECT a.id AS application_id,o.id AS owner_id,
 count(*) OVER (PARTITION BY a.id) AS ac,
 count(*) OVER (PARTITION BY o.id) AS oc
 FROM owner_applications a JOIN owner_accounts o ON lower(a.email)=lower(o.email) AND a.decided_at=o.created_at
 WHERE a.status='APPROVED' AND a.email_verified_at IS NOT NULL AND a.approved_owner_id IS NULL
)
UPDATE owner_applications a SET approved_owner_id=m.owner_id FROM matches m
WHERE a.id=m.application_id AND m.ac=1 AND m.oc=1;
CREATE INDEX IF NOT EXISTS owner_applications_approved_owner_idx ON owner_applications(approved_owner_id);
COMMIT;
