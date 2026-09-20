-- Hand-built match scenarios for the star career game.
--
-- The Scenario Builder (components/star/ScenarioEditor.tsx) writes one
-- MatchScenario per saved scenario: a camera framing plus hand-placed
-- teammate/opponent positions, in real pitch metres (lib/star/scenarios.ts,
-- lib/star/pitch.ts). Until this table existed those scenarios lived ONLY
-- in the browser that built them — lib/star/scenarioStore.ts's own header
-- said so outright, and pointed at lineupStore.ts's Supabase upgrade as the
-- next step. This is that step: real authoring work, done once, visible on
-- every device instead of one.
--
-- `scenario` is the MatchScenario record verbatim — id, name, kind, camera
-- {centerX, centerY, viewHeight, facing}, ball {x,y}, players[] and
-- updatedAt — so nothing has to be translated on the way in or out, and a
-- scenario saved today is readable by whatever eventually draws from this
-- pool at runtime.
--
-- Reads are public (every device needs the same pool of scenarios, and
-- there is nothing private in a set of pitch coordinates). Writes are NOT
-- granted to anon or authenticated at all: the only way to write this table
-- is /api/star/scenarios (POST/DELETE), which checks isAdmin() server-side
-- and writes with the service-role key. Exactly the shape star_lineups.sql
-- already uses.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_scenarios (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  scenario   JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_scenarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_scenarios' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_scenarios FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'star_scenarios';
-- Expect exactly one row: public read | SELECT | true — no insert/update/
-- delete policy at all, which is deliberate (see the note above).
--
-- select id, name, kind,
--        jsonb_array_length(scenario->'players') as players,
--        scenario->'camera'->>'facing' as facing,
--        updated_at
--   from star_scenarios order by updated_at desc;
-- Expect one row per scenario saved in the builder.
