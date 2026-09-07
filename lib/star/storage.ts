import type { CareerState, StarPhase } from "./types";
import type { EuroStanding } from "./euro";
import { makeManager } from "./manager";
import { assignSquadNumber } from "./recognition";
import { generateSquad, clubNameSeed } from "./squadData";
import { catchUpAwards } from "./potm";

const KEY = "star-career-v2";
const OLD_KEY = "star-career-v1";
const PHASE_KEY = "star-career-phase-v1";
const SAVED_AT_KEY = "star-career-saved-at-v1";

/**
 * A logged-out player's own slot — distinct from any real account id, so a
 * career played signed-out never collides with one played signed-in.
 */
export const ANON_SCOPE = "anon";

/**
 * EVERY key below is scoped by WHICH ACCOUNT this save belongs to (or
 * ANON_SCOPE for a signed-out player) — never a bare, shared key.
 *
 * Before this, `KEY` etc. were flat constants: one save per BROWSER, not per
 * account. That is fine on a device only ever used by one account, and
 * silently catastrophic the moment it isn't. Reported directly: switching to
 * a second account on one device (a phone, to reach an admin feature the
 * usual computer account needed) showed that account's OWN career as
 * whatever the browser had last cached for the FIRST account — and a few
 * seconds later, the debounced cloud-save effect in app/star-dev/page.tsx
 * uploaded that wrong career to the second account's cloud row, because the
 * upload only ever asks "who is logged in right now", never "does this
 * local copy actually belong to them". From there it cascades on its own:
 * the next device to load that now-contaminated account pulls it down
 * (cloud looks newer than local), and merely LOOKING at the other account
 * while troubleshooting repeats the exact same upload in the other
 * direction — which is exactly how both accounts ended up holding the
 * identical career.
 *
 * Scoping every key by account makes the browser cache for account A and
 * the cache for account B two entirely separate slots, on the same device —
 * switching which account is signed in can no longer leak one into the
 * other, because there is nothing shared left to leak through.
 */
function scoped(base: string, scope: string): string {
  return `${base}::${scope}`;
}

/**
 * Copies a career (plus its saved-at/phase, if present) from one set of keys
 * to `scope`'s own — but only if `scope` doesn't already have a save of its
 * own, and only once: the source keys are deleted immediately afterward, so
 * a second scope reading later finds nothing left to also inherit. Shared by
 * claimLegacySave (a pre-scoping flat save) and claimAnonSave (a save made
 * signed out, before the account reading it now ever played on this device)
 * — same shape, different source keys.
 */
function claimSave(scope: string, fromCareerKey: string, fromSavedAtKey: string, fromPhaseKey: string): void {
  try {
    if (localStorage.getItem(scoped(KEY, scope)) !== null) return; // already has its own
    const career = localStorage.getItem(fromCareerKey);
    if (career === null) return;
    localStorage.setItem(scoped(KEY, scope), career);
    const savedAt = localStorage.getItem(fromSavedAtKey);
    if (savedAt !== null) localStorage.setItem(scoped(SAVED_AT_KEY, scope), savedAt);
    const phase = localStorage.getItem(fromPhaseKey);
    if (phase !== null) localStorage.setItem(scoped(PHASE_KEY, scope), phase);
    localStorage.removeItem(fromCareerKey);
    localStorage.removeItem(fromSavedAtKey);
    localStorage.removeItem(fromPhaseKey);
  } catch { /* ignore */ }
}

/**
 * A save made before this fix shipped sits under the old flat key, with no
 * account attached to it at all. The first scope (real account, or
 * ANON_SCOPE) to ask for its data claims that flat save as its own — so
 * rather than a second account on the same device inheriting the first
 * account's pre-fix history the same way this whole bug started. Whoever is
 * actually sitting at the device when it first updates is, in practice,
 * almost always its one real owner.
 */
function claimLegacySave(scope: string): void {
  claimSave(scope, KEY, SAVED_AT_KEY, PHASE_KEY);
}

/**
 * A career played signed out, on a device that goes on to sign in for the
 * first time — claimed into that account rather than left behind under
 * ANON_SCOPE, a scope real play will never read again now that a career
 * requires an account (see app/star-dev/page.tsx's sign-in gate). Without
 * this, anyone who played during the window between that scoping fix
 * shipping and sign-in becoming required would have found their progress
 * gone the moment they were asked to sign in.
 */
function claimAnonSave(scope: string): void {
  if (scope === ANON_SCOPE) return;
  claimSave(scope, scoped(KEY, ANON_SCOPE), scoped(SAVED_AT_KEY, ANON_SCOPE), scoped(PHASE_KEY, ANON_SCOPE));
}

/**
 * The phases a refresh must land you back in.
 *
 * The career itself has always been saved, but the phase was React state only,
 * so reloading always dropped you on the dashboard. For most screens that is
 * fine — you can navigate back. For these three it was a soft-lock: the season
 * was over, the dashboard had no fixture left to play and no way to reach the
 * Ballon d'Or, and the career could never advance again.
 *
 * Deliberately NOT resumable: `match` (the match state is not saved, so it would
 * resume an empty game), `post-match` and `training` (their results live in
 * component state), and every browsing screen (just navigate).
 *
 * `season-transfer` earns its place because its offers are seeded off the season
 * and the player's fame, neither of which moves while the window is open — so
 * they can be regenerated on load and are the same offers. A retired career is
 * handled separately, by the flag on the career itself.
 */
const RESUMABLE: StarPhase[] = ["ballon-dor", "contract-renewal", "dilemma", "retirement", "season-transfer"];

export interface SavedPhase {
  phase: StarPhase;
  offerReason?: "form" | "star";
  /**
   * Whether the Ballon d'Or was won at the ceremony this phase follows.
   *
   * It is decided at the ceremony and not credited until the season rolls over,
   * and BOTH screens in between — retirement and the transfer window — are
   * resumable. It lived in React state, so refreshing on either of them lost the
   * win: you would watch yourself collect it and then find it had never
   * happened.
   */
  wonBallonDor?: boolean;
}

/**
 * `scope` is the current account's user id, or ANON_SCOPE for a signed-out
 * player — see the note above `scoped()` for why this can no longer be
 * optional. Every call site knows which account (if any) it's acting for.
 */
export function saveStarPhase(phase: StarPhase, scope: string, offerReason?: "form" | "star", wonBallonDor?: boolean) {
  try {
    const key = scoped(PHASE_KEY, scope);
    if (!RESUMABLE.includes(phase)) { localStorage.removeItem(key); return; }
    localStorage.setItem(key, JSON.stringify({ phase, offerReason, wonBallonDor }));
  } catch {}
}

export function loadStarPhase(scope: string): SavedPhase | null {
  try {
    const raw = localStorage.getItem(scoped(PHASE_KEY, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPhase;
    return RESUMABLE.includes(parsed.phase) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCareer(state: CareerState, scope: string) {
  try {
    localStorage.setItem(scoped(KEY, scope), JSON.stringify(state));
    localStorage.setItem(scoped(SAVED_AT_KEY, scope), String(Date.now()));
  } catch {}
}

/**
 * When the local save last changed — the other half of the comparison that
 * decides whether a cloud save is actually newer. See loadCareerFromCloud.
 *
 * A save with no recorded timestamp predates this existing at all, which
 * means it is simply whatever the player was just looking at — the most
 * current thing there is, as far as this device knows. Defaulting that to
 * "now" rather than "the beginning of time" matters: the alternative is a
 * save that has never been timestamped losing to ANY cloud row, however old,
 * the very first time this runs — the exact bug this exists to fix.
 */
export function loadCareerSavedAt(scope: string): number {
  try {
    const raw = localStorage.getItem(scoped(SAVED_AT_KEY, scope));
    return raw ? Number(raw) : Date.now();
  } catch {
    return Date.now();
  }
}

export function loadCareer(scope: string): CareerState | null {
  claimLegacySave(scope);
  claimAnonSave(scope);
  try {
    const raw = localStorage.getItem(scoped(KEY, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== 2) return null;
    return backfill(parsed);
  } catch {
    return null;
  }
}

/**
 * Fill in anything a career saved by an older version has never heard of.
 *
 * Almost every field added since is optional and reads sensibly when absent —
 * but two do not. A career with no `manager` can never have one, because a
 * manager is only ever replaced by SACKING the previous one; and a career with
 * no `squadNumber` is only ever given one on signing for somebody. Both would
 * stay invisible for the rest of that save.
 *
 * Everything else is left alone deliberately: cups and European qualification
 * fill themselves in at the next season rollover, which is when they would
 * naturally arrive anyway.
 */
function backfill(c: CareerState): CareerState {
  const out = { ...c };
  if (!out.manager) out.manager = makeManager(out, out.player.club, out.season);
  // A manager saved before reputation existed has no free-agent standing on
  // file — treated as an unremarkable, average appointment rather than left
  // `undefined` (which `reputationTier`/`sackCheck` both guard against
  // anyway, but a real number here is honest and avoids relying on that).
  else if (out.manager.reputation === undefined) out.manager = { ...out.manager, reputation: 50 };
  if (out.squadNumber === undefined) out.squadNumber = assignSquadNumber(out, out.player.club);
  if (out.clubAppearances === undefined) out.clubAppearances = out.careerStats.appearances;
  // A career saved before energy existed has no meter to have run down —
  // treated the same as a fresh one, full, rather than 0 (which `energy -=`
  // would otherwise silently corrupt into NaN from here on).
  if (out.energy === undefined) out.energy = 100;
  if (out.injury === undefined) out.injury = null;
  // A career saved before KIB Cans came back has no shelf of them to have
  // been buying — zero, not the two-basic starter grant a brand new career
  // gets, since this career is well past its trial.
  if (!out.kibCans) out.kibCans = { basic: 0, premium: 0, elite: 0 };
  // ── …and the squad, which is the third of exactly the same kind ──
  //
  // A squad is only ever created when a career is created or when you sign for
  // somebody, so a career saved before squads existed had none and could never
  // get one. `LeagueScreen` reads `career.squad ?? []`, so the Squad tab showed
  // one row — you — for the rest of that save, while a career started a week
  // later had a full dressing room. Reported as exactly that: "it just says me
  // on there."
  if (!out.squad?.length) out.squad = generateSquad(clubNameSeed(out.player.club));

  // A euroState saved before the league phase became a real, matchday-by-
  // matchday table (`simulateEuroMatchday`, euro.ts) has no `liveTable` or
  // `matchdaysPlayed` at all — reading either would crash outright rather
  // than just show an empty table. Rebuilt from what the save DOES have:
  // your own matchdays already played, credited for real, exactly as
  // `simulateEuroMatchday` would have left them. The background thirty-five
  // are NOT retroactively simulated for matchdays already gone — the whole
  // point of this fix is never fabricating a game that hasn't happened —
  // they simply start accumulating from here, same as any club would.
  if (out.euroState && (out.euroState as { liveTable?: unknown }).liveTable === undefined) {
    const state = out.euroState;
    const liveTable: EuroStanding[] = state.clubs.map((c) => ({
      name: c.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, isYou: c.name === out.player.club,
    }));
    const byName = new Map(liveTable.map((r) => [r.name, r]));
    const credit = (name: string, gf: number, ga: number) => {
      const r = byName.get(name);
      if (!r) return;
      r.played += 1; r.goalsFor += gf; r.goalsAgainst += ga;
      if (gf > ga) { r.won += 1; r.points += 3; }
      else if (gf === ga) { r.drawn += 1; r.points += 1; }
      else r.lost += 1;
    };
    let matchdaysPlayed = 0;
    for (const m of state.leaguePhase) {
      if (m.us === undefined || m.them === undefined) continue;
      credit(out.player.club, m.us, m.them);
      credit(m.opponent, m.them, m.us);
      matchdaysPlayed += 1;
    }
    out.euroState = { ...state, liveTable, matchdaysPlayed };
  }

  // ── …and the months that were played before anybody was counting ──
  //
  // Player of the Month reads results that were always being kept, so a career
  // that was mid-season when the award arrived has everything it needs to be
  // judged — it was simply never asked. Same for a career saved when a "month"
  // was four weeks rather than a month. Both are silent: the tab just says
  // nothing has been awarded, in February.
  const caught = catchUpAwards(out);
  if (caught.length) {
    out.potm = [...(out.potm ?? []), ...caught];
    // Winning one is an honour, and an honour credited late is still an honour.
    const won = caught.filter(a => a.isYou).map(a => ({
      season: a.season,
      kind: "Player of the Month",
      detail: `${a.monthName} — ${a.goals} goals, ${a.assists} assists`,
    }));
    if (won.length) out.awards = [...(out.awards ?? []), ...won];
  }
  return out;
}

export function clearCareer(scope: string) {
  try {
    localStorage.removeItem(scoped(KEY, scope));
    localStorage.removeItem(scoped(SAVED_AT_KEY, scope));
    localStorage.removeItem(scoped(PHASE_KEY, scope));
    // Pre-fix saves under the flat keys, and a stray v1 record — neither is
    // scoped to begin with, so there's nothing to pick a scope for; clearing
    // them here just means a reset also cleans up anything left over from
    // before this fix shipped.
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    localStorage.removeItem(PHASE_KEY);
    localStorage.removeItem(SAVED_AT_KEY);
  } catch {}
}

// ── Cloud save (Supabase) ────────────────────────────────────────────────────

/**
 * Persist the career to Supabase so it survives a device wipe or re-login.
 *
 * Fire-and-forget: errors are swallowed so a network hiccup or a logged-out
 * session never breaks the game. localStorage is always written first, so
 * data is never lost even if the cloud write fails.
 */
export async function saveCareerToCloud(state: CareerState): Promise<void> {
  try {
    await fetch("/api/star/career", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {}
}

/**
 * Fetch the career from Supabase, with when it was saved.
 *
 * Returns null when the user is not logged in, has no cloud save, or the
 * request fails — in all three cases the caller should fall back to
 * localStorage. The timestamp is what lets the caller tell a cloud save that
 * is genuinely ahead of this device apart from one that is behind it — see
 * the note on loadCareerSavedAt for why blindly preferring cloud regressed
 * players' squads.
 */
export async function loadCareerFromCloud(): Promise<{ career: CareerState; savedAt: number } | null> {
  try {
    const res = await fetch("/api/star/career");
    if (!res.ok) return null;
    const data = await res.json() as { career: CareerState; updatedAt: string } | null;
    if (!data?.career || data.career.version !== 2) return null;
    return { career: backfill(data.career), savedAt: new Date(data.updatedAt).getTime() };
  } catch {
    return null;
  }
}

/**
 * Delete the cloud save — called alongside clearCareer() when starting over,
 * so the old career does not reappear on next login.
 */
export async function clearCareerFromCloud(): Promise<void> {
  try {
    await fetch("/api/star/career", { method: "DELETE" });
  } catch {}
}
