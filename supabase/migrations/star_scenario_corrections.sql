-- Corrections recorded with the Tune button, shared by the whole team.
--
-- A correction is what somebody dragged on a generated chance and WHY it was
-- wrong (lib/star/scenarioCorrections.ts). The auto-tuner proposes a rule once
-- three corrections of the same chance kind agree on the same fault.
--
-- Until this table existed they lived ONLY in the browser that made them
-- (localStorage), which meant the tuner could never add up the team's work:
-- Harry, Leo and Mikey each making one correction was three separate "1 of
-- 3"s on three machines, and it never reached a proposal anywhere. Asked for
-- directly: "store corrections in the database".
--
-- `correction` is the Correction record verbatim — id, kind, faults[],
-- moves[], values{}, at — so nothing is translated on the way in or out.
--
-- Reads are public: the proposals are read by a terminal script
-- (scripts/tuner-proposals.mts) as well as by the dev tools, and there is
-- nothing private in "a defender was moved 3m". Writes are NOT granted to
-- anon or authenticated at all: the only way in is /api/star/corrections,
-- which checks isAdmin() server-side and writes with the service-role key.
-- Exactly the shape star_scenarios.sql already uses.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_scenario_corrections (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  correction JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_scenario_corrections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_scenario_corrections' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_scenario_corrections FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'star_scenario_corrections';
-- Expect exactly one row: public read | SELECT | true.
--
-- select kind, count(*) from star_scenario_corrections group by kind order by 2 desc;
-- Expect one row per chance kind that has been corrected with Tune.
