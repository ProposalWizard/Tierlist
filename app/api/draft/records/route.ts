import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRecordBody, EVENT_KEY, type RecordBody, type SavedRun } from "@/lib/draftRecordRules";

const MAX_PER_CATEGORY = 5;
const ASCENDING_RECORD_TYPES = new Set(["goals_conceded"]);

function isDevPlayer(name: string | null): boolean {
  if (!name) return false;
  return /^Dev\s/i.test(name);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const personal = url.searchParams.get("personal");
  const mode = url.searchParams.get("mode") === "prime" ? "prime" : "normal";

  if (personal === "true") {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const svc = createServiceClient();
    const personalSelect = () => svc
      .from("draft_personal_records")
      .select("competition, record_type, value, player_name, player_ovr, season_number")
      .eq("user_id", user.id);

    let { data, error } = await personalSelect().eq("mode", mode);

    // mode column doesn't exist yet (migration not run) — retry without the filter
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      ({ data, error } = await personalSelect());
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records: Record<string, { value: number; playerName: string | null; playerOvr: number | null; seasonNumber: number | null }> = {};
    for (const row of data ?? []) {
      if (isDevPlayer(row.player_name)) continue;
      records[`${row.competition}_${row.record_type}`] = {
        value: row.value,
        playerName: row.player_name,
        playerOvr: row.player_ovr,
        seasonNumber: row.season_number,
      };
    }

    return NextResponse.json({ personal: records });
  }

  // Global leaderboard
  const supabase = createServiceClient();

  const globalSelect = () => supabase
    .from("draft_records")
    .select("competition, record_type, value, player_name, player_ovr, username, season_number, created_at")
    .order("value", { ascending: false });

  let { data, error } = await globalSelect().eq("mode", mode);

  // mode column doesn't exist yet (migration not run) — retry without the filter
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await globalSelect());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped: Record<string, { value: number; playerName: string | null; playerOvr: number | null; username: string; seasonNumber: number | null; createdAt: string }[]> = {};

  for (const row of data ?? []) {
    if (isDevPlayer(row.player_name)) continue;
    const key = `${row.competition}_${row.record_type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      value: row.value,
      playerName: row.player_name,
      playerOvr: row.player_ovr,
      username: row.username,
      seasonNumber: row.season_number,
      createdAt: row.created_at,
    });
  }

  // Re-sort ascending record types so index 0 = best (lowest)
  for (const key of Object.keys(grouped)) {
    const recordType = key.split("_").slice(1).join("_");
    if (ASCENDING_RECORD_TYPES.has(recordType)) {
      grouped[key].sort((a, b) => a.value - b.value);
    }
  }

  return NextResponse.json({ records: grouped });
}

interface CandidateRow {
  user_id: string;
  username: string;
  competition: string;
  record_type: string;
  value: number;
  player_name: string | null;
  player_ovr: number | null;
  season_number: number | null;
  mode: string;
}

/**
 * POST — one finished draft season's records, for the public board and the
 * player's own bests. Every number is checked first (lib/draftRecordRules.ts):
 * real limits, the season already saved in draft_runs (same account, same
 * season key `eventKey`) and agreeing with it, and each player name a real
 * player in sofifa_players. A season that fails is refused (422) and logged,
 * never trimmed to fit. A record whose player can't be found is left out and
 * named in `rejected`.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: RecordBody & { hasDevPlayers?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const mode = body.mode === "prime" ? "prime" : "normal";

  // A dev team never posts (the server also refuses unknown player names below).
  if (body.hasDevPlayers === true) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: "dev_team" });
  }

  const serviceClient = createServiceClient();

  // The season this claims to be, as already saved in the player's history.
  let run: SavedRun | null = null;
  if (typeof body.eventKey === "string" && EVENT_KEY.test(body.eventKey)) {
    const { data: runRow, error: runErr } = await serviceClient
      .from("draft_runs")
      .select("season_number, finish, points, wins, draws, losses, goals_for, goals_against, avg_ovr, longest_unbeaten_run")
      .eq("user_id", user.id)
      .eq("event_key", body.eventKey)
      .limit(1)
      .maybeSingle();
    if (runErr) {
      console.error("[draft-records] could not read draft_runs:", runErr.message);
      return NextResponse.json({ error: "Could not check this season against your history. Try again." }, { status: 500 });
    }
    run = (runRow as SavedRun | null) ?? null;
  }

  const check = checkRecordBody(body, run);
  if (!check.ok) {
    console.warn(`[draft-records] refused for user ${user.id}:`, check.errors.join("; "));
    return NextResponse.json({ error: "These records were refused.", reasons: check.errors }, { status: 422 });
  }

  // Every named player must be a real player.
  const names = Array.from(new Set(check.candidates.filter(c => c.needsPlayer).map(c => c.player_name as string)));
  const known = new Set<string>();
  if (names.length) {
    const { data: found, error: nameErr } = await serviceClient
      .from("sofifa_players")
      .select("name")
      .in("name", names)
      .limit(500);
    if (nameErr) console.error("[draft-records] could not check player names:", nameErr.message);
    for (const row of (found ?? []) as { name: string }[]) known.add(row.name);
  }
  const rejected: string[] = [];
  const accepted = check.candidates.filter(c => {
    if (!c.needsPlayer) return true;
    if (known.has(c.player_name as string)) return true;
    rejected.push(`${c.competition} ${c.record_type}: "${c.player_name}" is not a known player`);
    return false;
  });
  if (rejected.length) console.warn(`[draft-records] names refused for user ${user.id}:`, rejected.join("; "));

  const { data: profile } = await serviceClient
    .from("user_profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();
  const username = profile?.username || user.email?.split("@")[0] || "Player";
  const seasonNumber = body.seasonNumber as number;

  const candidates: CandidateRow[] = accepted.map(c => ({
    user_id: user.id, username, competition: c.competition, record_type: c.record_type,
    value: c.value, player_name: c.player_name, player_ovr: c.player_ovr,
    season_number: seasonNumber, mode,
  }));

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, rejected });
  }

  // Whether the mode column exists — discovered lazily on first error, then
  // remembered for the rest of this request so we don't hit the DB 20× times.
  let modeColExists: boolean | null = null;
  const NO_COL = (code: string | undefined) => code === "42703" || code === "PGRST204";

  let inserted = 0;
  // Errors collected during global-record processing — returned in the response
  // so the client can log them in DevTools (server logs are inaccessible to users).
  const recordErrors: string[] = [];
  // Per-candidate action log for debugging — what happened to each record type.
  const actions: Record<string, string> = {};

  for (const candidate of candidates) {
    const ascending = ASCENDING_RECORD_TYPES.has(candidate.record_type);

    let baseQuery = serviceClient
      .from("draft_records")
      .select("id, value, player_name")
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type);
    if (modeColExists !== false) baseQuery = baseQuery.eq("mode", candidate.mode);
    // Fetch extra rows so that after filtering dev-player records we still have up to MAX_PER_CATEGORY
    let { data: rawExisting, error: fetchErr } = await baseQuery.order("value", { ascending }).limit(MAX_PER_CATEGORY + 20);

    // mode column doesn't exist — retry without the filter
    if (fetchErr && NO_COL(fetchErr.code)) {
      modeColExists = false;
      const fallback = serviceClient
        .from("draft_records")
        .select("id, value, player_name")
        .eq("competition", candidate.competition)
        .eq("record_type", candidate.record_type);
      ({ data: rawExisting, error: fetchErr } = await fallback.order("value", { ascending }).limit(MAX_PER_CATEGORY + 20));
    } else if (fetchErr == null && modeColExists == null) {
      modeColExists = true;
    }

    // Filter out dev-player records — they are hidden on the leaderboard display
    // but without this filter they block real records from being inserted or updated.
    const existing = (rawExisting ?? [])
      .filter(r => !isDevPlayer((r as Record<string, unknown>).player_name as string | null))
      .slice(0, MAX_PER_CATEGORY);

    if (fetchErr) {
      const msg = `fetch ${candidate.competition}/${candidate.record_type}: ${fetchErr.message}`;
      console.error(`Failed to fetch records for ${candidate.competition}/${candidate.record_type}:`, fetchErr.message);
      recordErrors.push(msg);
      actions[`${candidate.competition}_${candidate.record_type}`] = `fetch-error: ${fetchErr.code} ${fetchErr.message}`;
      continue;
    }
    actions[`${candidate.competition}_${candidate.record_type}`] = `top5=[${(existing ?? []).map(r => r.value).join(",")}] modeColExists=${modeColExists}`;

    // Enforce at most one row per user per (competition, record_type, mode) on
    // the global board. Without this, a single user's first 5 seasons each get
    // their own row (the board inserts unconditionally while < 5 rows exist),
    // filling the leaderboard with one person's duplicates. If the user already
    // has a row, update it in place when this value is better, otherwise skip.
    let userQuery = serviceClient
      .from("draft_records")
      .select("id, value, player_name")
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type)
      .eq("user_id", candidate.user_id);
    if (modeColExists !== false) userQuery = userQuery.eq("mode", candidate.mode);
    let { data: userExisting, error: userFetchErr } = await userQuery.maybeSingle();

    // If the user's existing row is a dev-player record (invisible on the
    // leaderboard but blocking real records from saving), delete it so the
    // real record can be inserted fresh.
    if (userExisting && isDevPlayer((userExisting as Record<string, unknown>).player_name as string | null)) {
      await serviceClient.from("draft_records").delete().eq("id", userExisting.id);
      actions[`${candidate.competition}_${candidate.record_type}`] = (actions[`${candidate.competition}_${candidate.record_type}`] ?? "") + ` | deleted-dev-player-row(${userExisting.value})`;
      userExisting = null;
      userFetchErr = null;
    }

    // PGRST116 means multiple rows exist for this user — a legacy artifact from
    // before per-user dedup was enforced. Clean up the duplicates (keep only the
    // best row) so future saves work correctly.
    if (userFetchErr && userFetchErr.code === "PGRST116") {
      actions[`${candidate.competition}_${candidate.record_type}`] += ` | PGRST116-dedup`;
      let allUserQuery = serviceClient
        .from("draft_records")
        .select("id, value")
        .eq("competition", candidate.competition)
        .eq("record_type", candidate.record_type)
        .eq("user_id", candidate.user_id);
      if (modeColExists !== false) allUserQuery = allUserQuery.eq("mode", candidate.mode);
      const { data: allUserRows } = await allUserQuery.order("value", { ascending });
      if (allUserRows && allUserRows.length > 0) {
        const bestRow = allUserRows[0];
        const idsToDelete = allUserRows.slice(1).map(r => r.id as string);
        if (idsToDelete.length > 0) {
          await serviceClient.from("draft_records").delete().in("id", idsToDelete);
        }
        const isBetter = ascending ? candidate.value < bestRow.value : candidate.value > bestRow.value;
        if (isBetter) {
          const { error: updErr } = await serviceClient
            .from("draft_records")
            .update({
              value: candidate.value,
              player_name: candidate.player_name,
              player_ovr: candidate.player_ovr,
              season_number: candidate.season_number,
              username: candidate.username,
            })
            .eq("id", bestRow.id);
          if (updErr) {
            const msg = `dedup-update ${candidate.competition}/${candidate.record_type}: ${updErr.message}`;
            console.error(msg);
            recordErrors.push(msg);
            actions[`${candidate.competition}_${candidate.record_type}`] += ` dedup-update-err`;
          } else {
            actions[`${candidate.competition}_${candidate.record_type}`] += ` dedup-updated(${bestRow.value}->${candidate.value})`;
          }
        } else {
          actions[`${candidate.competition}_${candidate.record_type}`] += ` dedup-not-better(best=${bestRow.value},new=${candidate.value})`;
        }
        continue;
      }
      // No rows returned (unexpected) — fall through to normal insert path
    } else if (userFetchErr) {
      actions[`${candidate.competition}_${candidate.record_type}`] += ` | user-fetch-err:${userFetchErr.code}`;
    }

    if (userExisting) {
      const isBetter = ascending ? candidate.value < userExisting.value : candidate.value > userExisting.value;
      if (isBetter) {
        const { error: updErr } = await serviceClient
          .from("draft_records")
          .update({
            value: candidate.value,
            player_name: candidate.player_name,
            player_ovr: candidate.player_ovr,
            season_number: candidate.season_number,
            username: candidate.username,
          })
          .eq("id", userExisting.id);
        if (updErr) {
          const msg = `update ${candidate.competition}/${candidate.record_type}: ${updErr.message}`;
          console.error(`Failed to update user record:`, updErr.message);
          recordErrors.push(msg);
          actions[`${candidate.competition}_${candidate.record_type}`] += ` | update-err`;
        } else {
          actions[`${candidate.competition}_${candidate.record_type}`] += ` | updated(${userExisting.value}->${candidate.value})`;
        }
      } else {
        actions[`${candidate.competition}_${candidate.record_type}`] += ` | not-better(existing=${userExisting.value},new=${candidate.value})`;
      }
      continue;
    }

    const count = existing?.length ?? 0;

    // Build insert payload — omit mode when the column is absent
    const insertPayload = modeColExists === false
      ? (({ mode: _m, ...rest }) => rest)(candidate)
      : candidate;

    if (count < MAX_PER_CATEGORY) {
      const { error: insErr } = await serviceClient.from("draft_records").insert(insertPayload);
      if (insErr && NO_COL(insErr.code) && modeColExists !== false) {
        modeColExists = false;
        const { mode: _m, ...withoutMode } = candidate;
        const { error: retryErr } = await serviceClient.from("draft_records").insert(withoutMode);
        if (retryErr) {
          const msg = `insert-retry ${candidate.competition}/${candidate.record_type}: ${retryErr.message}`;
          console.error(`Failed to insert record (retry):`, retryErr.message);
          recordErrors.push(msg);
          actions[`${candidate.competition}_${candidate.record_type}`] += ` | insert-retry-err:${retryErr.code}`;
        } else {
          inserted++;
          actions[`${candidate.competition}_${candidate.record_type}`] += ` | inserted-no-mode`;
        }
      } else if (insErr) {
        const msg = `insert ${candidate.competition}/${candidate.record_type}: ${insErr.message}`;
        console.error(`Failed to insert record:`, insErr.message);
        recordErrors.push(msg);
        actions[`${candidate.competition}_${candidate.record_type}`] += ` | insert-err:${insErr.code} ${insErr.message}`;
      } else {
        inserted++;
        actions[`${candidate.competition}_${candidate.record_type}`] += ` | inserted`;
      }
    } else {
      const worst = existing![count - 1];
      const beatsWorst = ascending ? candidate.value < worst.value : candidate.value > worst.value;
      if (beatsWorst) {
        const { error: insErr } = await serviceClient.from("draft_records").insert(insertPayload);
        if (insErr) {
          const msg = `insert-beats-worst ${candidate.competition}/${candidate.record_type}: ${insErr.message}`;
          console.error(`Failed to insert record:`, insErr.message);
          recordErrors.push(msg);
          actions[`${candidate.competition}_${candidate.record_type}`] += ` | beats-worst-insert-err:${insErr.code}`;
          continue;
        }
        inserted++;
        actions[`${candidate.competition}_${candidate.record_type}`] += ` | beats-worst-inserted(worst=${worst.value})`;
        const { error: delErr } = await serviceClient
          .from("draft_records")
          .delete()
          .eq("id", worst.id);
        if (delErr) {
          const msg = `prune ${candidate.competition}/${candidate.record_type}: ${delErr.message}`;
          console.error(`Failed to prune worst record:`, delErr.message);
          recordErrors.push(msg);
        }
      } else {
        actions[`${candidate.competition}_${candidate.record_type}`] += ` | board-full-not-better(worst=${worst.value},new=${candidate.value})`;
      }
    }
  }

  // Upsert personal bests
  let modeColExistsPersonal: boolean | null = null;

  for (const candidate of candidates) {
    const ascending = ASCENDING_RECORD_TYPES.has(candidate.record_type);

    let personalQuery = serviceClient
      .from("draft_personal_records")
      .select("id, value, player_name")
      .eq("user_id", user.id)
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type);
    if (modeColExistsPersonal !== false) personalQuery = personalQuery.eq("mode", candidate.mode);
    let { data: existing, error: personalFetchErr } = await personalQuery.maybeSingle();

    if (personalFetchErr && NO_COL(personalFetchErr.code)) {
      modeColExistsPersonal = false;
      const fallback = serviceClient
        .from("draft_personal_records")
        .select("id, value, player_name")
        .eq("user_id", user.id)
        .eq("competition", candidate.competition)
        .eq("record_type", candidate.record_type);
      ({ data: existing, error: personalFetchErr } = await fallback.maybeSingle());
    } else if (personalFetchErr == null && modeColExistsPersonal == null) {
      modeColExistsPersonal = true;
    }

    if (personalFetchErr) continue;

    // Auto-delete dev-player personal records so they don't block real saves.
    if (existing && isDevPlayer((existing as Record<string, unknown>).player_name as string | null)) {
      await serviceClient.from("draft_personal_records").delete().eq("id", existing.id);
      existing = null;
    }

    const personalInsertPayload: Record<string, unknown> = {
      user_id: user.id,
      competition: candidate.competition,
      record_type: candidate.record_type,
      value: candidate.value,
      player_name: candidate.player_name,
      player_ovr: candidate.player_ovr,
      season_number: candidate.season_number,
    };
    if (modeColExistsPersonal !== false) personalInsertPayload.mode = candidate.mode;

    if (!existing) {
      const { error: insErr } = await serviceClient.from("draft_personal_records").insert(personalInsertPayload);
      if (insErr && NO_COL(insErr.code)) {
        modeColExistsPersonal = false;
        delete personalInsertPayload.mode;
        await serviceClient.from("draft_personal_records").insert(personalInsertPayload);
      } else if (insErr && insErr.code === "23505") {
        // Unique conflict — a record exists for this (user, competition, type) from
        // a different mode (unique constraint doesn't include mode yet). Fetch
        // without mode filter and update if this value is better.
        const { data: any } = await serviceClient
          .from("draft_personal_records")
          .select("id, value")
          .eq("user_id", user.id)
          .eq("competition", candidate.competition)
          .eq("record_type", candidate.record_type)
          .maybeSingle();
        if (any) {
          const isBetter = ascending ? candidate.value < any.value : candidate.value > any.value;
          if (isBetter) {
            await serviceClient
              .from("draft_personal_records")
              .update({ value: candidate.value, player_name: candidate.player_name, player_ovr: candidate.player_ovr, season_number: candidate.season_number, updated_at: new Date().toISOString() })
              .eq("id", any.id);
          }
        }
      } else if (insErr) {
        const msg = `personal-insert ${candidate.competition}/${candidate.record_type}: ${insErr.message}`;
        console.error(`Failed to insert personal record:`, insErr.message);
        recordErrors.push(msg);
      }
    } else {
      const isNewBest = ascending ? candidate.value < existing.value : candidate.value > existing.value;
      if (isNewBest) {
        await serviceClient
          .from("draft_personal_records")
          .update({
            value: candidate.value,
            player_name: candidate.player_name,
            player_ovr: candidate.player_ovr,
            season_number: candidate.season_number,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, recordErrors, actions, rejected });
}
