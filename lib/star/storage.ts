import type { CareerState, StarPhase } from "./types";
import { makeManager } from "./manager";
import { assignSquadNumber } from "./recognition";
import { generateSquad, clubNameSeed } from "./squadData";
import { catchUpAwards } from "./potm";

const KEY = "star-career-v2";
const OLD_KEY = "star-career-v1";
const PHASE_KEY = "star-career-phase-v1";
const SAVED_AT_KEY = "star-career-saved-at-v1";

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

export function saveStarPhase(phase: StarPhase, offerReason?: "form" | "star", wonBallonDor?: boolean) {
  try {
    if (!RESUMABLE.includes(phase)) { localStorage.removeItem(PHASE_KEY); return; }
    localStorage.setItem(PHASE_KEY, JSON.stringify({ phase, offerReason, wonBallonDor }));
  } catch {}
}

export function loadStarPhase(): SavedPhase | null {
  try {
    const raw = localStorage.getItem(PHASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPhase;
    return RESUMABLE.includes(parsed.phase) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCareer(state: CareerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(SAVED_AT_KEY, String(Date.now()));
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
export function loadCareerSavedAt(): number {
  try {
    const raw = localStorage.getItem(SAVED_AT_KEY);
    return raw ? Number(raw) : Date.now();
  } catch {
    return Date.now();
  }
}

export function loadCareer(): CareerState | null {
  try {
    const raw = localStorage.getItem(KEY);
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
  // ── …and the squad, which is the third of exactly the same kind ──
  //
  // A squad is only ever created when a career is created or when you sign for
  // somebody, so a career saved before squads existed had none and could never
  // get one. `LeagueScreen` reads `career.squad ?? []`, so the Squad tab showed
  // one row — you — for the rest of that save, while a career started a week
  // later had a full dressing room. Reported as exactly that: "it just says me
  // on there."
  if (!out.squad?.length) out.squad = generateSquad(clubNameSeed(out.player.club));

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

export function clearCareer() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    localStorage.removeItem(PHASE_KEY);
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
