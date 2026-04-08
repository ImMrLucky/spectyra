-- Per-organization cap on distinct users (rows in org_memberships).
-- Backfill so existing orgs are not below current membership count.

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS seat_limit INTEGER;

UPDATE orgs o
SET seat_limit = GREATEST(
  5,
  COALESCE(
    (SELECT count(*)::int FROM org_memberships m WHERE m.org_id = o.id),
    0
  )
)
WHERE seat_limit IS NULL;

ALTER TABLE orgs ALTER COLUMN seat_limit SET NOT NULL;
ALTER TABLE orgs ALTER COLUMN seat_limit SET DEFAULT 5;

ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_seat_limit_check;
ALTER TABLE orgs ADD CONSTRAINT orgs_seat_limit_check CHECK (seat_limit >= 1);

COMMENT ON COLUMN orgs.seat_limit IS 'Max users (org_memberships rows) for this org; Stripe subscription quantity updates this when set.';

-- Enforce cap for any insert path (API, scripts, or future Supabase policies).
CREATE OR REPLACE FUNCTION org_memberships_enforce_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  lim INTEGER;
  cnt INTEGER;
BEGIN
  SELECT seat_limit INTO lim FROM orgs WHERE id = NEW.org_id FOR UPDATE;
  IF lim IS NULL THEN
    lim := 5;
  END IF;
  SELECT count(*)::int INTO cnt FROM org_memberships WHERE org_id = NEW.org_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'Seat limit reached for this organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_memberships_check_seat_limit ON org_memberships;
CREATE TRIGGER org_memberships_check_seat_limit
  BEFORE INSERT ON org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION org_memberships_enforce_seat_limit();
