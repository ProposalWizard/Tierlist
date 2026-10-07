-- The gem wallet: paid things that cannot be faked (Harry, 7 Oct 2026).
--
-- "We are DEFINITELY going to have paid items … ideally everything is safe."
--
-- The star career save is worked out on the player's device and sent to the
-- server as it is, so anyone with browser dev tools can change it: money,
-- skills, trophies. That is fine for a free game. It is NOT fine for things
-- people pay real money for. So paid things never live in the save:
--
--   star_paid_items      the paid catalogue: what can be bought with gems,
--                        and for how many. The price is read from HERE, never
--                        from the browser.
--   star_wallet          one row per account: how many gems it has.
--   star_wallet_ledger   every gem change ever, one row each, never edited.
--                        The balance in star_wallet is kept in step by a
--                        trigger on this table, and only by it.
--   star_entitlements    what each account owns (one row per account + item).
--
-- Players can READ their own rows. Nobody can write any of these tables from
-- the browser: no insert/update/delete policy exists, and the rights are
-- revoked as well. Every change goes through two functions:
--
--   spend_gems(item, idem_key, expected_price)   signed-in players
--       Takes the price from star_paid_items, checks the balance, writes the
--       ledger row and the entitlement in one go. Running it twice with the
--       same key does nothing the second time.
--   grant_gems(user, amount, reason, idem_key)   SERVICE ROLE ONLY
--       For the future payment webhooks (Apple / Google / Stripe) and for
--       admin test grants (/api/admin/wallet/grant). The browser cannot call
--       it at all.
--   grant_item(user, item, source, idem_key)     SERVICE ROLE ONLY
--       For an item bought directly with real money (no gems in between).
--
-- Until this runs, /api/star/wallet answers `migrationMissing: true` and the
-- game says "Gems aren't switched on yet". Nothing else breaks.
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run. Not run against
-- a live database when written: the logic is reasoned, and the checks at the
-- bottom are there to confirm it once it has run.

-- ── 1. The paid catalogue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS star_paid_items (
  item_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'cosmetic',
  gem_price  INTEGER NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_paid_items_id_shape') THEN
    ALTER TABLE star_paid_items ADD CONSTRAINT star_paid_items_id_shape
      CHECK (item_id ~ '^[a-z0-9][a-z0-9-]{1,47}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_paid_items_price_positive') THEN
    ALTER TABLE star_paid_items ADD CONSTRAINT star_paid_items_price_positive
      CHECK (gem_price > 0 AND gem_price <= 1000000);
  END IF;
END $$;

-- The one example paid item, to prove the whole path end to end on
-- /star-wallet-dev. Only an admin can give anyone gems until a payment
-- provider exists, so nobody can buy it by accident.
INSERT INTO star_paid_items (item_id, name, kind, gem_price, active)
VALUES ('test-golden-boots', 'Golden boots (test)', 'test', 50, true)
ON CONFLICT (item_id) DO NOTHING;

-- ── 2. The wallet (the balance) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS star_wallet (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gems       BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_wallet_gems_not_negative') THEN
    ALTER TABLE star_wallet ADD CONSTRAINT star_wallet_gems_not_negative CHECK (gems >= 0);
  END IF;
END $$;

-- ── 3. The ledger (every gem change, append-only) ────────────────────────────
CREATE TABLE IF NOT EXISTS star_wallet_ledger (
  id       BIGSERIAL PRIMARY KEY,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta    BIGINT NOT NULL,
  reason   TEXT NOT NULL,
  item_id  TEXT,
  idem_key TEXT NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_wallet_ledger_idem_key_unique') THEN
    ALTER TABLE star_wallet_ledger ADD CONSTRAINT star_wallet_ledger_idem_key_unique UNIQUE (idem_key);
  END IF;
  -- purchase = gems bought with real money; grant = given by an admin or a
  -- promotion; spend = gems paid for an item; refund = a store refund taken
  -- back; correction = a fix by hand (either way).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_wallet_ledger_reason') THEN
    ALTER TABLE star_wallet_ledger ADD CONSTRAINT star_wallet_ledger_reason CHECK (
      (reason IN ('purchase', 'grant') AND delta > 0)
      OR (reason IN ('spend', 'refund') AND delta < 0)
      OR (reason = 'correction' AND delta <> 0)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_wallet_ledger_spend_has_item') THEN
    ALTER TABLE star_wallet_ledger ADD CONSTRAINT star_wallet_ledger_spend_has_item
      CHECK (reason <> 'spend' OR item_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_wallet_ledger_key_shape') THEN
    ALTER TABLE star_wallet_ledger ADD CONSTRAINT star_wallet_ledger_key_shape
      CHECK (char_length(idem_key) BETWEEN 8 AND 200);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS star_wallet_ledger_user_idx ON star_wallet_ledger (user_id, at DESC);

-- ── 4. What each account owns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS star_entitlements (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL REFERENCES star_paid_items(item_id),
  source     TEXT NOT NULL,
  ledger_id  BIGINT REFERENCES star_wallet_ledger(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_entitlements_source') THEN
    ALTER TABLE star_entitlements ADD CONSTRAINT star_entitlements_source
      CHECK (source IN ('purchase', 'grant', 'gems'));
  END IF;
END $$;

-- ── 5. Guards: the balance moves only through the ledger ─────────────────────
-- The ledger trigger is the only thing allowed to write star_wallet. A direct
-- INSERT/UPDATE on star_wallet (even with the service key, which skips RLS but
-- never skips triggers) is refused. "Only from inside another trigger" is
-- pg_trigger_depth() > 1: the ledger trigger is depth 1, its write here is
-- depth 2. A cascade delete when an account is deleted also runs inside the
-- foreign key's own trigger, so it is let through.
CREATE OR REPLACE FUNCTION star_wallet_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'star_wallet only changes through star_wallet_ledger (insert a ledger row instead)';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS star_wallet_guard ON star_wallet;
CREATE TRIGGER star_wallet_guard
  BEFORE INSERT OR UPDATE OR DELETE ON star_wallet
  FOR EACH ROW EXECUTE FUNCTION star_wallet_guard();

-- The ledger is append-only: no row is ever changed, and none is deleted
-- except by the cascade when the account itself is deleted. A mistake is put
-- right with a new 'correction' row, so the history always adds up.
CREATE OR REPLACE FUNCTION star_wallet_ledger_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'star_wallet_ledger is append-only: add a correction row instead of editing';
  END IF;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'star_wallet_ledger is append-only: add a correction row instead of deleting';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS star_wallet_ledger_append_only ON star_wallet_ledger;
CREATE TRIGGER star_wallet_ledger_append_only
  BEFORE UPDATE OR DELETE ON star_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION star_wallet_ledger_append_only();

-- Every new ledger row moves the balance by its delta. The CHECK on
-- star_wallet (gems >= 0) refuses an overdraft, which rolls the ledger row
-- back with it. A spend with no wallet row would insert a negative balance,
-- which the same CHECK refuses.
CREATE OR REPLACE FUNCTION star_wallet_apply_ledger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO star_wallet (user_id, gems, updated_at)
  VALUES (NEW.user_id, NEW.delta, now())
  ON CONFLICT (user_id) DO UPDATE
    SET gems = star_wallet.gems + EXCLUDED.gems, updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS star_wallet_apply_ledger ON star_wallet_ledger;
CREATE TRIGGER star_wallet_apply_ledger
  AFTER INSERT ON star_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION star_wallet_apply_ledger();

-- ── 6. Row level security: read your own, write nothing ─────────────────────
ALTER TABLE star_paid_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_wallet        ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_entitlements  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "star_paid_items_read" ON star_paid_items;
CREATE POLICY "star_paid_items_read" ON star_paid_items
  FOR SELECT USING (active);

DROP POLICY IF EXISTS "star_wallet_read_own" ON star_wallet;
CREATE POLICY "star_wallet_read_own" ON star_wallet
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_wallet_ledger_read_own" ON star_wallet_ledger;
CREATE POLICY "star_wallet_ledger_read_own" ON star_wallet_ledger
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_entitlements_read_own" ON star_entitlements;
CREATE POLICY "star_entitlements_read_own" ON star_entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policy on any of the four tables: with RLS on,
-- that alone refuses every write from the browser. Taking the rights away as
-- well means a policy added by mistake later still could not open a write.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON star_paid_items, star_wallet, star_wallet_ledger, star_entitlements
  FROM anon, authenticated;
REVOKE USAGE ON SEQUENCE star_wallet_ledger_id_seq FROM anon, authenticated;

-- ── 7. spend_gems: buy a paid item with gems (signed-in players) ─────────────
-- p_idem_key comes from the browser (a random id per tap on Buy). It is
-- stored as 'spend:<account>:<key>', so one account's keys can never collide
-- with another's or with a payment provider's. p_expected_price is the price
-- the player saw; if the catalogue price has changed since, nothing is
-- charged and the answer says so. The price charged is ALWAYS the catalogue's.
--
-- Answers JSON: { ok, error?, gems?, item_id?, replay?, already_owned? }.
CREATE OR REPLACE FUNCTION spend_gems(p_item_id TEXT, p_idem_key TEXT, p_expected_price INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_key    TEXT;
  v_price  INTEGER;
  v_active BOOLEAN;
  v_gems   BIGINT;
  v_ledger BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signed-out');
  END IF;
  IF p_idem_key IS NULL OR p_idem_key !~ '^[A-Za-z0-9_-]{8,64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad-key');
  END IF;
  v_key := 'spend:' || v_uid::text || ':' || p_idem_key;

  -- Lock this account's wallet row first, so two taps at once queue up
  -- behind each other and the second sees what the first did.
  SELECT gems INTO v_gems FROM star_wallet WHERE user_id = v_uid FOR UPDATE;
  v_gems := COALESCE(v_gems, 0);

  -- The same tap sent twice: answer as the first time did, charge nothing.
  IF EXISTS (SELECT 1 FROM star_wallet_ledger WHERE idem_key = v_key) THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'gems', v_gems, 'item_id', p_item_id);
  END IF;

  SELECT gem_price, active INTO v_price, v_active FROM star_paid_items WHERE item_id = p_item_id;
  IF v_price IS NULL OR NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not-for-sale', 'gems', v_gems);
  END IF;
  IF p_expected_price IS NOT NULL AND p_expected_price <> v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price-changed', 'price', v_price, 'gems', v_gems);
  END IF;

  -- Owned already (bought on another device, or a different key): never
  -- charge twice for the same thing.
  IF EXISTS (SELECT 1 FROM star_entitlements WHERE user_id = v_uid AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'gems', v_gems, 'item_id', p_item_id);
  END IF;

  IF v_gems < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not-enough-gems', 'price', v_price, 'gems', v_gems);
  END IF;

  INSERT INTO star_wallet_ledger (user_id, delta, reason, item_id, idem_key)
  VALUES (v_uid, -v_price, 'spend', p_item_id, v_key)
  RETURNING id INTO v_ledger;

  INSERT INTO star_entitlements (user_id, item_id, source, ledger_id)
  VALUES (v_uid, p_item_id, 'gems', v_ledger);

  RETURN jsonb_build_object('ok', true, 'gems', v_gems - v_price, 'item_id', p_item_id);
EXCEPTION
  -- A second identical request that slipped past the checks above lands
  -- here when its ledger key or entitlement already exists: everything this
  -- call wrote is rolled back, and it answers as a replay.
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'item_id', p_item_id,
      'gems', COALESCE((SELECT gems FROM star_wallet WHERE user_id = v_uid), 0));
END $$;

-- Functions are callable by everyone by default: take that away, then give
-- spend_gems to signed-in players only.
REVOKE ALL ON FUNCTION spend_gems(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION spend_gems(TEXT, TEXT, INTEGER) TO authenticated;

-- ── 8. grant_gems: add gems (service role only) ──────────────────────────────
-- Called by the payment webhook once a store says a payment is real
-- (reason 'purchase', key like 'stripe:evt_…' or 'apple:<transaction id>'),
-- and by /api/admin/wallet/grant for testing (reason 'grant', key 'admin:…').
-- The same key twice adds nothing the second time.
CREATE OR REPLACE FUNCTION grant_gems(p_user UUID, p_amount BIGINT, p_reason TEXT, p_idem_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gems BIGINT;
  v_old  star_wallet_ledger%ROWTYPE;
BEGIN
  -- Belt and braces: the rights below already keep players out.
  IF auth.role() IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'grant_gems is for the server only';
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no-such-user');
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 1000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad-amount');
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('purchase', 'grant') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad-reason');
  END IF;
  IF p_idem_key IS NULL OR char_length(p_idem_key) NOT BETWEEN 8 AND 200 OR p_idem_key LIKE 'spend:%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad-key');
  END IF;

  PERFORM 1 FROM star_wallet WHERE user_id = p_user FOR UPDATE;

  SELECT * INTO v_old FROM star_wallet_ledger WHERE idem_key = p_idem_key;
  IF FOUND THEN
    IF v_old.user_id <> p_user OR v_old.delta <> p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'key-reused');
    END IF;
    SELECT gems INTO v_gems FROM star_wallet WHERE user_id = p_user;
    RETURN jsonb_build_object('ok', true, 'replay', true, 'gems', COALESCE(v_gems, 0));
  END IF;

  INSERT INTO star_wallet_ledger (user_id, delta, reason, idem_key)
  VALUES (p_user, p_amount, p_reason, p_idem_key);

  SELECT gems INTO v_gems FROM star_wallet WHERE user_id = p_user;
  RETURN jsonb_build_object('ok', true, 'gems', COALESCE(v_gems, 0));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'replay', true,
      'gems', COALESCE((SELECT gems FROM star_wallet WHERE user_id = p_user), 0));
END $$;

REVOKE ALL ON FUNCTION grant_gems(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grant_gems(UUID, BIGINT, TEXT, TEXT) TO service_role;

-- ── 9. grant_item: give an item directly (service role only) ─────────────────
-- For an item bought straight with real money (an Apple/Google one-off
-- purchase, source 'purchase') or given by an admin (source 'grant'). Owning
-- it already is not an error. No gems move.
CREATE OR REPLACE FUNCTION grant_item(p_user UUID, p_item_id TEXT, p_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'grant_item is for the server only';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('purchase', 'grant') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad-source');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM star_paid_items WHERE item_id = p_item_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no-such-item');
  END IF;
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no-such-user');
  END IF;
  INSERT INTO star_entitlements (user_id, item_id, source)
  VALUES (p_user, p_item_id, p_source)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id);
END $$;

REVOKE ALL ON FUNCTION grant_item(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grant_item(UUID, TEXT, TEXT) TO service_role;

-- The trigger functions are never called directly, but take the default
-- "anyone may call" right away from them too.
REVOKE ALL ON FUNCTION star_wallet_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION star_wallet_ledger_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION star_wallet_apply_ledger() FROM PUBLIC, anon, authenticated;

-- ── Verify, after running ────────────────────────────────────────────────────
-- 1. The four tables, RLS on (all four rows say true):
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('star_paid_items','star_wallet','star_wallet_ledger','star_entitlements');
--
-- 2. Only SELECT policies (four rows, every cmd = 'SELECT'):
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('star_paid_items','star_wallet','star_wallet_ledger','star_entitlements');
--
-- 3. Who may run the functions. spend_gems: authenticated (and postgres,
--    service_role). grant_gems and grant_item: service_role (and postgres),
--    never anon or authenticated:
-- SELECT p.proname, r.rolname,
--        has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_run
--   FROM pg_proc p CROSS JOIN pg_roles r
--  WHERE p.proname IN ('spend_gems','grant_gems','grant_item')
--    AND r.rolname IN ('anon','authenticated','service_role')
--  ORDER BY 1, 2;
--
-- 4. The browser roles cannot write the tables (every can_write is false):
-- SELECT t, r, has_table_privilege(r, t, 'INSERT') OR has_table_privilege(r, t, 'UPDATE')
--          OR has_table_privilege(r, t, 'DELETE') AS can_write
--   FROM unnest(ARRAY['star_paid_items','star_wallet','star_wallet_ledger','star_entitlements']) t
--   CROSS JOIN unnest(ARRAY['anon','authenticated']) r;
--
-- 5. The example item is in the catalogue (one row, 50 gems):
-- SELECT * FROM star_paid_items WHERE item_id = 'test-golden-boots';
--
-- 6. A dry run in one transaction, rolled back at the end so it leaves no
--    trace. Put a real account id in place of the zeros.
-- BEGIN;
--   SELECT grant_gems('00000000-0000-0000-0000-000000000000', 100, 'grant', 'verify:grant:1');
--   SELECT grant_gems('00000000-0000-0000-0000-000000000000', 100, 'grant', 'verify:grant:1'); -- replay, still 100
--   SELECT gems FROM star_wallet WHERE user_id = '00000000-0000-0000-0000-000000000000';    -- 100 (plus any earlier)
--   UPDATE star_wallet SET gems = 999999
--     WHERE user_id = '00000000-0000-0000-0000-000000000000';                                  -- ERROR: only through the ledger
-- ROLLBACK;
--    (spend_gems needs a signed-in player, so test it from /star-wallet-dev.)
--
-- 7. The balance always equals the ledger (no rows back = all good):
-- SELECT w.user_id, w.gems, COALESCE(SUM(l.delta), 0) AS ledger_total
--   FROM star_wallet w LEFT JOIN star_wallet_ledger l ON l.user_id = w.user_id
--  GROUP BY w.user_id, w.gems
-- HAVING w.gems <> COALESCE(SUM(l.delta), 0);
