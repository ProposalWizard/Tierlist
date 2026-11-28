import { gzipText, SAVE_BODY_HEADER } from "./saveBody";
import { withStars, isOldStarScale, starLevel } from "./starPoints";
import { INJURIES_ON, isRolledInjury } from "./injurySwitch";
import { migrateReputation } from "./reputation";
import type { CareerState, StarPhase } from "./types";
import { hasClub } from "./calendar";
import type { EuroStanding } from "./euro";
import { makeManager } from "./manager";
import { allPoolManagers } from "./managerPool";
import { assignSquadNumber } from "./recognition";
import { generateSquad, clubNameSeed } from "./squadData";
import { catchUpAwards, compactPotmHistory } from "./potm";
import { toSavedForm, fromSavedForm } from "./squadSaveCodec";
import { setActiveFoot } from "./kickFoot";
import { addToHall, accountOfScope } from "./hallOfFame";
import { aerialFromOld } from "./aerial";
import { migrateLife } from "./life/migrate";
import {
  type SaveStamp, type SyncRecord, type SyncedVersion, type DeviceKind, type OtherDeviceWarning,
  type LoadWhy, emptySyncRecord, sanitizeSyncRecord, readStamp, progressFingerprint, nextStamp,
  recordAfterSend, recordAfterConfirm, recordAfterTake, decideLoad, deviceKindFromUA, pickSpareSlot,
} from "./saveClash";
import { SLOT_CHECK_HEADER, type OnlineSlot } from "./onlineSlots";

const KEY = "star-career-v2";
const OLD_KEY = "star-career-v1";
const PHASE_KEY = "star-career-phase-v1";
const SAVED_AT_KEY = "star-career-saved-at-v1";
/** Per save: where this device stands with the cloud — see lib/star/saveClash.ts. */
const SYNC_KEY = "star-career-sync-v1";
/** Per browser: a random id, so an upload can say which device sent it. */
const DEVICE_KEY = "star-device-id-v1";

/**
 * A logged-out player's own slot — distinct from any real account id, so a
 * career played signed-out never collides with one played signed-in.
 */
export const ANON_SCOPE = "anon";

/**
 * How many separate careers one account can keep at once — see
 * listSaveSlots/slotScope below. Capped at three deliberately, not
 * unlimited: enough to genuinely mean something (the save you're playing
 * now, one you're not ready to give up on, and a fresh attempt) without
 * turning Settings into a scrolling list or meaningfully growing per-account
 * storage — each slot is a full CareerState, the same size whichever one
 * it's in.
 */
export const MAX_SAVE_SLOTS = 3;

/**
 * Turns "this account" into "this account's Nth save".
 *
 * Slot 1 is deliberately just `accountScope`, unchanged — the exact key
 * every existing player's one-and-only save has always lived under, and the
 * exact scope every call site already had before save slots existed (see
 * app/star-match-dev/page.tsx's own loadCareer(user.id), for one). That is
 * what makes adding save slots safe rather than a migration: an account
 * that never opens the new saves screen keeps reading and writing the
 * identical localStorage keys it always has, forever, because slot 1 IS
 * those keys, not a copy of them. Only slots 2 and 3 are genuinely new,
 * additive keys that start out empty.
 */
export function slotScope(accountScope: string, slot: number): string {
  return slot === 1 ? accountScope : `${accountScope}#slot${slot}`;
}

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
const RESUMABLE: StarPhase[] = [
  "ballon-dor", "contract-renewal", "dilemma", "retirement", "final-season", "season-transfer",
  // The season end (Leo, 22 Oct 2026): a refresh on "Your season" or on the
  // awards night lands back on it. The awards screen's Continue is the only
  // way on to a forced contract renewal, so skipping it skipped the renewal.
  "season-reel", "season-awards",
  // Relegated out of the Championship: the club you were at has dropped into
  // a pool with no fixtures and no table, so a new one has to be chosen
  // before the season can roll over at all — `advanceSeason` needs to know
  // which real division to build next season in. That makes this the one
  // transfer screen with no "stay put" button, and refreshing on it dropped
  // you on a dashboard with every fixture played and no way forward: the
  // exact soft-lock this list exists for. Its offers are regenerable on the
  // same terms `season-transfer`'s are — seeded off the season and your
  // fame, neither of which moves while the screen is open.
  "relegation-move",
  // LEGACY. The one-penalty opening, whose screen is deleted. Kept resumable
  // purely so a save still carrying it is picked up by the resume path and
  // moved to "trial-stages" rather than falling through to a dashboard it has
  // no club for. Nothing writes this phase any more.
  "trial",
  // The multi-stage trial. Every stage's result is written to the career the
  // instant it is decided, so resuming costs nothing — and the trial itself
  // quietly gets harder each time it is re-opened rather than being blocked.
  "trial-stages",
  // Life with no club. Resumable for the same reason as everything else in
  // this list: it is a screen you cannot navigate back to from the ordinary
  // dashboard, because the ordinary dashboard is about a club you do not have.
  "free-agent",
  // The clubs that came in. Regenerable from the trial's own seed and score,
  // so a reload shows the same clubs rather than re-rolling them — which
  // would be the single most farmable screen in the game otherwise.
  "scout-offers",
];

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

// ── When the device will not take the save ──────────────────────────────────

/**
 * Why the last attempt to write the save on THIS device failed, or null if
 * the last attempt worked.
 *
 * This used to be swallowed outright: a full browser store (a save is well
 * over a megabyte, and the browser allows about five) threw, `saveCareer`
 * caught it and said nothing, and the player carried on believing the game
 * was saving when on this device it had stopped. A signed-in player still
 * had the cloud copy; a signed-out one (the dev sandbox) had nothing.
 *
 * `quota` is the browser saying it is full; `other` is anything else
 * (storage blocked by the browser, a private window, …). `signedIn` is
 * whether this save also goes to the cloud — which changes what the player
 * should be told. `id` only moves when saving goes from working to failing,
 * so a message the player has dismissed stays dismissed until saving has
 * recovered and then failed again.
 */
export interface SaveFailure {
  id: number;
  /** "slot-taken": the server would not let this upload replace another
   *  device's career in the slot (lib/star/onlineSlots.ts). The save on
   *  THIS device worked; only the online copy was kept as it was. */
  reason: "quota" | "other" | "slot-taken" | "cloud";
  signedIn: boolean;
  message: string;
}

let saveFailure: SaveFailure | null = null;
let failureCount = 0;
const saveListeners = new Set<(f: SaveFailure | null) => void>();

/** The current failure, if saving on this device is failing right now. */
export function getSaveFailure(): SaveFailure | null {
  return saveFailure;
}

/** Hear about saving starting or stopping to fail. Returns the unsubscribe. */
export function onSaveFailureChange(fn: (f: SaveFailure | null) => void): () => void {
  saveListeners.add(fn);
  return () => { saveListeners.delete(fn); };
}

function setSaveFailure(next: SaveFailure | null) {
  saveFailure = next;
  saveListeners.forEach((fn) => { try { fn(next); } catch { /* a listener never breaks saving */ } });
}

/** The browser's "storage full" error — it has had several spellings over the years. */
function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: string; code?: number };
  return err.name === "QuotaExceededError"
    || err.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || err.code === 22 || err.code === 1014;
}

/** A signed-out save's scope is ANON_SCOPE, or one of its slots. */
function isSignedInScope(scope: string): boolean {
  return scope !== ANON_SCOPE && !scope.startsWith(`${ANON_SCOPE}#`);
}

/**
 * Writes the save on this device. Returns false when it could not — and,
 * unlike before, says so: see SaveFailure and SaveFailedBanner. The saved-at
 * stamp is only moved on success, so a failed write can never make an old
 * local copy look newer than the cloud.
 */
export function saveCareer(state: CareerState, scope: string): boolean {
  // The foot the trial and training draw you kicking with (v0.25 item 11).
  // The New UI's page sets it too; the Old UI only ever reaches it here.
  setActiveFoot(state.player?.preferredFoot);
  try {
    // The star rating is banked on every save, so it can never drop and a
    // save from before Star Points picks its ledger up here (starPoints.ts).
    // The other clubs' squads go in thin — see lib/star/squadSaveCodec.ts.
    localStorage.setItem(scoped(KEY, scope), JSON.stringify(toSavedForm(withStars(state))));
    localStorage.setItem(scoped(SAVED_AT_KEY, scope), String(Date.now()));
    // A refused upload is not cured by saving on this device: it stays up
    // until an upload of that slot is accepted (saveCareerToCloud).
    if (saveFailure && saveFailure.reason !== "slot-taken" && saveFailure.reason !== "cloud") setSaveFailure(null);
    // A retired career goes in the Hall of Fame the first time it is saved
    // retired (hallOfFame.ts). Both UIs save through here, so both feed it,
    // and a career retired before the Hall existed goes in when next opened.
    if (state.retired) { try { addToHall(accountOfScope(scope), state); } catch { /* never block a save */ } }
    return true;
  } catch (e) {
    const reason = isQuotaError(e) ? "quota" : "other";
    const signedIn = isSignedInScope(scope);
    if (!saveFailure) failureCount += 1;
    setSaveFailure({
      id: failureCount,
      reason,
      signedIn,
      message: signedIn
        ? "Couldn't save on this device — your cloud save is still safe."
        : reason === "quota"
          ? "Couldn't save on this device — it's out of space. Free up some space or your progress won't be kept."
          : "Couldn't save on this device — this browser is blocking storage, so your progress won't be kept.",
    });
    return false;
  }
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

/**
 * The read half of loadCareer, without the legacy/anon claiming — for
 * listSaveSlots, which needs to peek at slots 2 and 3 without ever
 * mistakenly claiming a stray pre-slots or signed-out save into one of
 * them. Slot 1 IS the scope claimLegacySave/claimAnonSave have always
 * targeted (see slotScope), so loadCareer below still runs both for slot 1
 * exactly as it always has; a slot that did not exist before this feature
 * has nothing legacy to claim in the first place.
 */
function loadCareerRaw(scope: string): CareerState | null {
  try {
    const raw = localStorage.getItem(scoped(KEY, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerState;
    if (parsed.version !== 2) return null;
    return backfill(fromSavedForm(parsed));
  } catch {
    return null;
  }
}

export function loadCareer(scope: string): CareerState | null {
  claimLegacySave(scope);
  claimAnonSave(scope);
  return loadCareerRaw(scope);
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
  // Injuries are switched off (careerFlow.ts INJURIES_ON): a save carrying
  // one is healed on load. A suspension is kept.
  if (!INJURIES_ON && isRolledInjury(out.injury)) out.injury = null;
  // A career saved before attribute decay existed has no record of when
  // anything was last trained — treated as "just now" (this week), not
  // "never", so it gets the same fresh grace period a brand-new career
  // does rather than reading every skill as already overdue the moment
  // decaySkills first runs against it.
  // Aerial & Acrobatics came in on 21 Oct 2026: a save from before it starts
  // where its own Power and Technique put it (aerial.ts aerialFromOld), and
  // counts as trained this week, like the rest on a first load.
  if (out.skills && (typeof out.skills.aerial !== "number" || !Number.isFinite(out.skills.aerial))) {
    out.skills = { ...out.skills, aerial: aerialFromOld(out.skills) };
    if (out.lastTrainedWeek && out.lastTrainedWeek.aerial === undefined) out.lastTrainedWeek = { ...out.lastTrainedWeek, aerial: out.week };
  }
  if (!out.lastTrainedWeek) {
    out.lastTrainedWeek = { pace: out.week, power: out.week, technique: out.week, vision: out.week, freeKick: out.week, aerial: out.week };
  }
  // A career saved before reputation existed has no world/club/government/
  // shareholder standing on file — backfilled at the same neutral starting
  // point a brand-new career opens with (see makeInitialCareer), not left
  // `undefined` (which every `reputation.*` read would otherwise crash on).
  // Reputation became ONE number on 21 Sep 2026. An old four-bar object
  // becomes the average of the four (agreed directly); a missing one starts
  // where a new career does.
  out.reputation = migrateReputation(out.reputation);
  // Fame was rebuilt as a capped 0-100 the same day. Old saves could have
  // run it into the hundreds; anything above 100 becomes 100.
  if (typeof out.fame !== "number" || !Number.isFinite(out.fame)) out.fame = 0;
  out.fame = Math.max(0, Math.min(100, out.fame));
  // A career saved before the real-manager pool existed has no record of who
  // it's already "used" — the current manager (if any) predates the pool
  // too and was never drawn from it, so the full roster is honestly correct
  // here, not a guess.
  if (!out.availableManagers) out.availableManagers = allPoolManagers();
  // A career saved before KIB Cans came back has no shelf of them to have
  // been buying — zero, not the two-basic starter grant a brand new career
  // gets, since this career is well past its trial.
  if (!out.kibCans) out.kibCans = { basic: 0, premium: 0, elite: 0 };
  // The first run-up build saved the penalty style as `runupStyle`, before
  // penalties and free kicks became two separate sets (runupStyles.ts).
  if (out.penaltyRunup === undefined && out.runupStyle !== undefined) out.penaltyRunup = out.runupStyle;
  delete out.runupStyle;
  // A career saved before the Store came to the career (28 Sep 2026) has no
  // Coins — zero, the same as a new career.
  if (typeof out.coins !== "number" || !Number.isFinite(out.coins)) out.coins = 0;
  // A career saved before KIB Stat Cans existed has none on the shelf and
  // no boost running — both fields simply didn't exist to have a value.
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
  // A save from before Player of the Month history was trimmed at each
  // rollover gets the same trim now (see compactPotmHistory): last season
  // and this one whole, older seasons only the months you won.
  out.potm = compactPotmHistory(out.potm, out.season - 1);
  // The living world (lib/star/life): a save with a life block gets it put back
  // in shape; a save without one is left alone (it starts one at its first event).
  if (out.life !== undefined) out.life = migrateLife(out.life);
  // A save from before Star Points gets its ledger and star rating here, and
  // one from the 1.0-10.0 days is moved onto 1-100 (starPoints.ts bestOf).
  return out.stars === undefined || isOldStarScale(out) ? withStars(out) : out;
}

export function clearCareer(scope: string) {
  try {
    localStorage.removeItem(scoped(KEY, scope));
    localStorage.removeItem(scoped(SAVED_AT_KEY, scope));
    localStorage.removeItem(scoped(PHASE_KEY, scope));
    localStorage.removeItem(scoped(SYNC_KEY, scope));
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

// ── Multiple saves ───────────────────────────────────────────────────────────

/**
 * A summary of one save slot for the switcher in Settings — not the whole
 * CareerState; nobody needs a division's worth of squads just to draw three
 * cards. Local-only and synchronous, which is right for a fast list that
 * simply redraws on every render.
 *
 * This can under-report a slot THIS device has never opened yet — see the
 * account-scoping note above `scoped()` for why local and cloud are never
 * assumed to agree — but actually switching to a slot (loadCareerIntoState,
 * app/star-dev/page.tsx) always reconciles against the cloud properly first,
 * the same way loading slot 1 always has. An "Empty" card here is a day-one
 * hint, never a claim that nothing exists anywhere for that slot.
 *
 * Since 28 Nov 2026 the Saves panel also asks the server (fetchOnlineSlots)
 * and merges the two (lib/star/onlineSlots.ts mergeSaveCards), so a slot
 * made on another device shows as "On another device · Open", not "Empty".
 */
export interface SaveSlotSummary {
  slot: number;
  empty: boolean;
  club?: string;
  playerName?: string;
  season?: number;
  starRating?: number;
  retired?: boolean;
  /**
   * Whether anybody has signed this save yet — see `hasClub` (calendar.ts).
   *
   * A career now genuinely exists before it has a club: the trial runs on a
   * real, saved CareerState with no league and no fixtures. That save is NOT
   * empty — overwriting it loses the trial — but `club` is legitimately
   * blank, so a summary that only reported a name and a club would render a
   * dangling separator and invite the player to start over on top of the
   * career they are in the middle of.
   */
  signed?: boolean;
}

export function listSaveSlots(accountScope: string): SaveSlotSummary[] {
  const out: SaveSlotSummary[] = [];
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const scope = slotScope(accountScope, slot);
    // Slot 1 still gets the legacy/anon claim exactly as loadCareer always
    // has; slots 2+ never had anything to claim — see loadCareerRaw's note.
    const career = slot === 1 ? loadCareer(scope) : loadCareerRaw(scope);
    out.push(career ? summariseSave(slot, career) : { slot, empty: true });
  }
  return out;
}

/** One slot's career, read only: nothing claimed, moved or written. */
export function peekSlotCareer(accountScope: string, slot: number): CareerState | null {
  return loadCareerRaw(slotScope(accountScope, slot));
}

/**
 * Every retired career in this account's save slots, put in the Hall of Fame
 * (hallOfFame.ts) if it is not there yet. A career that retired before the
 * Hall existed sits in a slot, not the Hall: this is how it gets in. Read
 * only for the slots. Returns how many went in.
 */
export function collectRetiredIntoHall(accountScope: string): number {
  let added = 0;
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const career = loadCareerRaw(slotScope(accountScope, slot));
    if (career?.retired && addToHall(accountScope, career).added) added++;
  }
  return added;
}

/** One save's card line — shared by the Saves list and "Move my saves". */
export function summariseSave(slot: number, career: CareerState): SaveSlotSummary {
  const signed = hasClub(career);
  return {
    slot,
    empty: false,
    signed,
    // Blank for a trial rather than "" — the panel says what is happening
    // instead of printing an empty club name.
    club: signed ? career.player.club : undefined,
    playerName: `${career.player.firstName} ${career.player.lastName}`,
    season: career.season,
    // The star rating players see is the career one (starPoints.ts).
    starRating: starLevel(career),
    retired: !!career.retired,
  };
}

// ── Moving saves to another browser (lib/star/saveTransfer.ts) ───────────────
//
// An iPhone Home Screen app has its own storage, apart from Safari's. A save
// made in Safari is still there, but the app cannot see it. "Move my saves"
// packs every slot into one code here and unpacks it on the other side.

/** One slot exactly as this device stores it (the thin saved form). */
export interface StoredSlot {
  slot: number;
  /** The saved form, parsed but otherwise untouched. */
  career: unknown;
  phase?: SavedPhase;
}

/**
 * Every occupied slot of `accountScope`, as stored. Slot 1 claims a legacy
 * or signed-out save first, exactly as the Saves list does, so what is
 * copied is what the player sees.
 */
export function readStoredSlots(accountScope: string): StoredSlot[] {
  const out: StoredSlot[] = [];
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const scope = slotScope(accountScope, slot);
    if (slot === 1) { claimLegacySave(scope); claimAnonSave(scope); }
    // Only a slot that really loads is copied — a broken one would only be
    // refused on the other side.
    if (!loadCareerRaw(scope)) continue;
    try {
      const raw = localStorage.getItem(scoped(KEY, scope));
      if (!raw) continue;
      const phase = loadStarPhase(scope);
      out.push({ slot, career: JSON.parse(raw), ...(phase ? { phase } : {}) });
    } catch { /* skip a slot this browser cannot read */ }
  }
  return out;
}

/**
 * A saved form from somewhere else (a pasted code) through the SAME loader a
 * normal save goes through: version check, squads filled back in, every
 * backfill. Null when it does not load. Never throws.
 */
export function loadCareerFromStoredForm(raw: unknown): CareerState | null {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const c = raw as CareerState;
    if (c.version !== 2) return null;
    if (!c.player || typeof c.player !== "object") return null;
    if (typeof c.player.firstName !== "string" || typeof c.player.lastName !== "string") return null;
    if (typeof c.season !== "number" || !Number.isFinite(c.season)) return null;
    const out = backfill(fromSavedForm(c));
    // A photo can only be one the game made (a data: image) or one of its
    // own files — never a link to somewhere else.
    const portrait = out.player.portrait as unknown;
    if (portrait !== undefined && (typeof portrait !== "string"
      || !(portrait.startsWith("data:image/") || (portrait.startsWith("/") && !portrait.startsWith("//"))))) {
      out.player = { ...out.player, portrait: undefined };
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Every career saved in this browser, READ ONLY: nothing is claimed, moved or
 * written, unlike loadCareer (which claims a legacy save into slot 1). For a
 * test page that only SHOWS a real save — the retirement preview
 * (/star-retirement-dev) — and must never change it.
 */
export function peekDeviceSaves(): { key: string; career: CareerState }[] {
  const out: { key: string; career: CareerState }[] = [];
  try {
    if (typeof localStorage === "undefined") return out;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !(k === KEY || k.startsWith(`${KEY}::`))) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { continue; }
      const career = loadCareerFromStoredForm(parsed);
      if (career) out.push({ key: k, career });
    }
  } catch { /* private window: nothing to show */ }
  return out;
}

/** A saved phase from somewhere else, or null if it is not a real one. */
export function sanitizeSavedPhase(x: unknown): SavedPhase | null {
  if (!x || typeof x !== "object") return null;
  const p = x as SavedPhase;
  if (typeof p.phase !== "string" || !RESUMABLE.includes(p.phase)) return null;
  const out: SavedPhase = { phase: p.phase };
  if (p.offerReason === "form" || p.offerReason === "star") out.offerReason = p.offerReason;
  if (typeof p.wonBallonDor === "boolean") out.wonBallonDor = p.wonBallonDor;
  return out;
}

/**
 * Writes a moved save into `slot`, replacing what was there. The old slot's
 * cloud-sync note and resume screen go with it: they belonged to the save
 * being replaced. Returns false if this device would not take it.
 */
export function writeMovedSave(accountScope: string, slot: number, career: CareerState, phase?: SavedPhase | null): boolean {
  const scope = slotScope(accountScope, slot);
  try {
    localStorage.removeItem(scoped(SYNC_KEY, scope));
    localStorage.removeItem(scoped(PHASE_KEY, scope));
  } catch { /* ignore */ }
  heldScopes.delete(scope);
  if (!saveCareer(career, scope)) return false;
  if (phase) saveStarPhase(phase.phase, scope, phase.offerReason, phase.wonBallonDor);
  return true;
}

const ACTIVE_SLOT_KEY = "star-career-active-slot-v1";

/**
 * Which save this account was last looking at. Defaults to 1 — the save
 * every account already had before slots existed — so an account that has
 * never opened the new saves screen keeps landing exactly where it always
 * has, on every device, forever.
 */
export function loadActiveSlot(accountScope: string): number {
  try {
    const raw = localStorage.getItem(scoped(ACTIVE_SLOT_KEY, accountScope));
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isInteger(n) && n >= 1 && n <= MAX_SAVE_SLOTS ? n : 1;
  } catch {
    return 1;
  }
}

export function saveActiveSlot(accountScope: string, slot: number): void {
  try {
    localStorage.setItem(scoped(ACTIVE_SLOT_KEY, accountScope), String(slot));
  } catch {}
}

// ── Cloud save (Supabase) ────────────────────────────────────────────────────

/**
 * Persist the career to Supabase so it survives a device wipe or re-login.
 *
 * Fire-and-forget: errors are swallowed so a network hiccup or a logged-out
 * session never breaks the game. localStorage is always written first, so
 * data is never lost even if the cloud write fails.
 *
 * `slot` defaults to 1 — the save every account already had before slots
 * existed — and works unchanged whether or not star_career_slots.sql
 * (PENDING) has been run yet; see that migration's own note and the API
 * route it applies to. A slot other than 1 simply stays local-only, exactly
 * as fire-and-forget as a network hiccup, until it has.
 */
export async function saveCareerToCloud(
  state: CareerState, slot: number = 1, opts: { leavingPage?: boolean; scope?: string } = {},
): Promise<void> {
  let job: RetryJob | null = null;
  try {
    // Stamped, so the next load on any device can tell a cloud copy that is
    // simply newer from one that went its own way — see lib/star/saveClash.ts.
    // Only when the caller says which save this is (its slot scope); an
    // unstamped upload is exactly what every upload was before.
    // "Decide later" on a save clash with no free slot: this device plays
    // its own copy, but it must not overwrite the other one in the cloud.
    if (opts.scope && heldScopes.has(opts.scope)) return;
    // Refused a moment ago (the slot holds another device's career): wait a
    // little before sending the whole save again, so a phone does not upload
    // it every few seconds for nothing.
    if (opts.scope && (refusedUntil.get(opts.scope) ?? 0) > Date.now() && !wantsReplaceOnline(opts.scope)) return;
    // The newest upload of this save wins any retry still waiting.
    const retryKey = opts.scope ?? `slot${slot}`;
    const gen = (uploadGen.get(retryKey) ?? 0) + 1;
    uploadGen.set(retryKey, gen);
    cancelRetry(retryKey);
    job = { key: retryKey, gen, state, slot, opts };
    let sent: SyncedVersion | null = null;
    let payload: object = toSavedForm(state);
    if (opts.scope) {
      const rec = loadSyncRecord(opts.scope);
      const next = nextStamp(rec, {
        deviceId: getDeviceId(), device: thisDeviceKind(), at: Date.now(),
        random: randomId(), progress: progressFingerprint(state),
      });
      payload = { ...payload, sync: next.stamp };
      sent = next.sent;
      saveSyncRecord(opts.scope, recordAfterSend(rec, sent));
    }
    const body = JSON.stringify(payload);
    // Sent squeezed (gzip) where the browser can: a 180-550 KB save goes up
    // as about a quarter of that (Mikey, 10 Nov 2026: the site's data between
    // Vercel and its server was at 6.6 of 10 GB, mostly saves). Not when
    // leaving the page: squeezing takes a moment the page may not have, so
    // that save goes exactly as it always did. The route reads both.
    const packed = opts.leavingPage || typeof document === "undefined" ? null : await gzipText(body);
    // Asks the server never to replace a DIFFERENT career in this slot that
    // this device never saw (lib/star/onlineSlots.ts), unless the player
    // chose "Replace online copy" for it.
    const slotCheck = opts.scope && wantsReplaceOnline(opts.scope) ? "replace" : "check";
    const res = await fetch(`/api/star/career?slot=${slot}`, packed ? {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", [SAVE_BODY_HEADER]: "gzip", [SLOT_CHECK_HEADER]: slotCheck },
      body: packed,
    } : {
      method: "POST",
      headers: { "Content-Type": "application/json", [SLOT_CHECK_HEADER]: slotCheck },
      body,
      // Leaving the page (tab hidden, app backgrounded, tab closed): a
      // keepalive request survives the page being torn down, but browsers
      // refuse one whose body is over ~64 KB outright — the whole request
      // fails, not just the keepalive part. So it is only asked for when the
      // body fits; a bigger save goes as an ordinary request, which on a
      // phone that is merely backgrounded (the common case) still finishes.
      keepalive: !!opts.leavingPage && body.length < KEEPALIVE_BODY_LIMIT,
    });
    if (res.status === 409) {
      const refused = await res.json().catch(() => null) as { error?: string; message?: string } | null;
      if (refused?.error === "slot-taken") { cloudWorked(job); noteSlotRefused(slot, opts.scope, refused.message); }
      return;
    }
    if (!res.ok) { cloudFailed(job); return; }
    const data = await res.json().catch(() => null) as { ok?: boolean; corrected?: unknown; career?: unknown } | null;
    // Only a real "ok" moves the base: signed out, the route answers `null`.
    if (sent && opts.scope && data?.ok === true) saveSyncRecord(opts.scope, recordAfterConfirm(loadSyncRecord(opts.scope), sent));
    if (data?.ok === true) { noteSlotAccepted(opts.scope); cloudWorked(job); }
    // The server's save guard (lib/star/saveGuard.ts, enforce mode) put back
    // fields that no honest play could have reached. Its copy is the save
    // now: this device keeps it and the game reloads it.
    if (data?.ok === true && Array.isArray(data.corrected) && data.corrected.length > 0
      && data.career && typeof data.career === "object" && (data.career as CareerState).version === 2) {
      const { sync: _s, ...raw } = data.career as CareerState & { sync?: unknown };
      void _s;
      const fixed = backfill(fromSavedForm(raw as CareerState));
      if (opts.scope) saveCareer(fixed, opts.scope);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SAVE_CORRECTED_EVENT, { detail: { slot, career: fixed } }));
      }
    }
  } catch {
    // No signal, or the request died: say so, and try again (below).
    cloudFailed(job);
  }
}

// ── A failed upload says so, and tries again (Harry, 28 Nov 2026) ───────────
//
// Uploads used to fail silently. Now a failed one puts up "Couldn't save
// online — will retry" (SaveFailedBanner) and is sent again after 20 s, then
// 40 s, 80 s ... up to 5 minutes apart, until one gets through. A newer
// upload of the same save replaces the one waiting. The save on this device
// is never touched by any of this.

interface RetryJob { key: string; gen: number; state: CareerState; slot: number; opts: { leavingPage?: boolean; scope?: string } }
export const RETRY_FIRST_MS = 20_000;
export const RETRY_MAX_MS = 5 * 60_000;
const uploadGen = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryDelay = new Map<string, number>();

function cancelRetry(key: string): void {
  const t = retryTimers.get(key);
  if (t) { clearTimeout(t); retryTimers.delete(key); }
}

/** For tests: is an upload of this save waiting to be retried? */
export function pendingUploadRetry(scope: string): boolean {
  return retryTimers.has(scope);
}

function cloudFailed(job: RetryJob | null): void {
  // Signed out (and the packed app) never saves online: nothing to say.
  if (!job?.opts.scope || !isSignedInScope(job.opts.scope)) return;
  // A failing save on THIS device is the bigger news: that message stays.
  if (!saveFailure || saveFailure.reason === "slot-taken") {
    failureCount += 1;
    setSaveFailure({ id: failureCount, reason: "cloud", signedIn: true, message: "Couldn't save online — will retry. Your save on this device is safe." });
  }
  if (!job || job.opts.leavingPage) return;
  if (uploadGen.get(job.key) !== job.gen) return; // a newer upload is in charge
  const delay = Math.min(RETRY_MAX_MS, retryDelay.get(job.key) ?? RETRY_FIRST_MS);
  retryDelay.set(job.key, Math.min(RETRY_MAX_MS, delay * 2));
  cancelRetry(job.key);
  const t = setTimeout(() => {
    retryTimers.delete(job.key);
    if (uploadGen.get(job.key) !== job.gen) return;
    void saveCareerToCloud(job.state, job.slot, job.opts);
  }, delay);
  (t as { unref?: () => void }).unref?.();
  retryTimers.set(job.key, t);
}

function cloudWorked(job: RetryJob | null): void {
  if (job) retryDelay.delete(job.key);
  if (saveFailure?.reason === "cloud") setSaveFailure(null);
}

// ── Another device's career in this slot (lib/star/onlineSlots.ts) ──────────

/** How long a refused slot waits before its next upload is tried. */
export const REFUSED_RETRY_MS = 2 * 60_000;
const refusedUntil = new Map<string, number>();
const REPLACE_KEY = "star-career-replace-online-v1";

/** The player chose, in Saves, to replace the online copy of this slot with
 *  the career on this device. Kept until an upload is accepted. */
export function allowReplaceOnline(scope: string): void {
  try { localStorage.setItem(scoped(REPLACE_KEY, scope), "1"); } catch {}
  refusedUntil.delete(scope);
}
export function wantsReplaceOnline(scope: string): boolean {
  try { return localStorage.getItem(scoped(REPLACE_KEY, scope)) === "1"; } catch { return false; }
}

function noteSlotRefused(slot: number, scope: string | undefined, message: string | undefined): void {
  if (scope) refusedUntil.set(scope, Date.now() + REFUSED_RETRY_MS);
  if (!saveFailure || saveFailure.reason !== "slot-taken") failureCount += 1;
  setSaveFailure({
    id: failureCount,
    reason: "slot-taken",
    signedIn: true,
    message: message || `Not saved online: Save ${slot} holds a different career from another device. Open Settings → Saves.`,
  });
}

function noteSlotAccepted(scope: string | undefined): void {
  if (scope) {
    refusedUntil.delete(scope);
    try { localStorage.removeItem(scoped(REPLACE_KEY, scope)); } catch {}
  }
  if (saveFailure?.reason === "slot-taken") setSaveFailure(null);
}

/** What the server said about this account's slots online. */
export type OnlineSlotsAnswer =
  | { check: "ok"; slots: OnlineSlot[] }
  | { check: "device-only" }
  | { check: "failed" };

/**
 * Ask the server which slots hold a career online (headline only — see
 * app/api/star/career/slots/route.ts). Never throws. A timeout, no signal or
 * a server error is "failed": the Saves list then says "Couldn't check your
 * other devices" instead of calling those slots empty.
 */
export async function fetchOnlineSlots(timeoutMs = 4000): Promise<OnlineSlotsAnswer> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetch("/api/star/career/slots", { cache: "no-store", ...(ctl ? { signal: ctl.signal } : {}) });
    if (!res.ok) return { check: "failed" };
    const data = await res.json() as { mode?: string; slots?: unknown };
    if (data?.mode === "device-only") return { check: "device-only" };
    if (data?.mode !== "online" || !Array.isArray(data.slots)) return { check: "failed" };
    const slots = (data.slots as OnlineSlot[]).filter((s) => s && typeof s.slot === "number" && typeof s.live === "boolean");
    return { check: "ok", slots };
  } catch {
    return { check: "failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Backups of a career that lost a choice (kept 30 days) ───────────────────
//
// When two copies of a slot are settled with no free slot, the one not kept
// is NOT thrown away: it goes here, on this device, for at least 30 days.
// Nothing deletes a backup younger than that.

const BACKUP_KEY = "star-career-backups-v1";
export const BACKUP_KEEP_MS = 30 * 24 * 3600_000;

export interface CareerBackup {
  /** Set on every backup since 28 Nov 2026; older ones get one when read. */
  id: string;
  /** Its progress fingerprint, so the same copy is never kept twice. */
  progress?: string;
  at: number;
  slot: number;
  why: string;
  playerName: string;
  season: number;
  /** The thin saved form (squadSaveCodec), as saveCareer writes it. */
  career: unknown;
}

export function listCareerBackups(accountScope: string): CareerBackup[] {
  try {
    const raw = localStorage.getItem(scoped(BACKUP_KEY, accountScope));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((b) => b && typeof b.at === "number")
        .map((b) => (typeof b.id === "string" && b.id ? b : { ...b, id: `old-${b.at}-${b.slot}` }) as CareerBackup)
      : [];
  } catch { return []; }
}

/** One backup back as a career, or null. */
export function careerFromBackup(b: CareerBackup): CareerState | null {
  return loadCareerFromStoredForm(b.career);
}

/** A copy's progress, read the way the game reads it back (load, then save
 *  form again), so a backup that was opened and kept again compares equal. */
function backupProgress(savedForm: unknown): string | null {
  try {
    const c = loadCareerFromStoredForm(savedForm);
    return c ? progressFingerprint(toSavedForm(withStars(c))) : null;
  } catch { return null; }
}

/**
 * Keep a copy of `career` and return the backup that holds it, or null if
 * this device would not store it. A copy already kept for the same slot
 * (same progress) is not stored twice: that backup is returned instead, so
 * restoring and undoing back and forth never fills the device.
 * Only backups older than 30 days are ever dropped, and only to make room.
 */
export function keepCareerBackup(accountScope: string, slot: number, career: CareerState, why: string, now = Date.now()): CareerBackup | null {
  const form = toSavedForm(withStars(career));
  const have = listCareerBackups(accountScope);
  const fp = backupProgress(form);
  const same = fp ? have.find((b) => b.slot === slot && (b.progress ?? backupProgress(b.career)) === fp) : undefined;
  if (same) return same;
  const entry: CareerBackup = {
    id: `b-${now.toString(36)}-${randomId()}`,
    ...(fp ? { progress: fp } : {}),
    at: now, slot, why,
    playerName: `${career.player?.firstName ?? ""} ${career.player?.lastName ?? ""}`.trim(),
    season: career.season,
    career: form,
  };
  const all = [...have, entry];
  const young = all.filter((b) => now - b.at < BACKUP_KEEP_MS);
  for (const list of [all, young]) {
    try {
      localStorage.setItem(scoped(BACKUP_KEY, accountScope), JSON.stringify(list));
      return entry;
    } catch { /* full: try again without the old ones */ }
  }
  return null;
}

/**
 * Keep a copy of `career`. Returns false if this device would not store it.
 * Only backups older than 30 days are ever dropped, and only to make room.
 */
export function backupCareer(accountScope: string, slot: number, career: CareerState, why: string, now = Date.now()): boolean {
  return !!keepCareerBackup(accountScope, slot, career, why, now);
}

/** The `why` written on the copy kept when a backup is restored. */
export const WHY_BEFORE_RESTORE = "before restoring a backup";
/** The `why` written on the copy kept when a save is deleted. */
export const WHY_DELETED = "deleted";

export type RestoreResult =
  | { ok: true; slot: number; career: CareerState; restored: CareerBackup;
      /** The backup now holding the save that was replaced (Undo restores
       *  it). Null when the slot was empty. */
      kept: CareerBackup | null }
  | { ok: false; why: string };

/**
 * SAVES → BACKUPS → "Restore this" (components/star/SaveBackupsView.tsx).
 *   1. The save in that slot now (`current`: the career on screen, for the
 *      slot being played; else what this device has stored) is kept as a
 *      backup first. If it cannot be kept, nothing changes.
 *   2. The chosen backup becomes the slot's save on this device.
 *   3. Signed in: it is sent online as "replace", so it replaces the online
 *      copy and every device signed in gets it. Nothing is deleted: the
 *      chosen backup stays in the list too.
 * Undo is the same call on `kept`.
 */
export function restoreCareerBackup(
  accountScope: string, backupId: string, current?: CareerState | null, now = Date.now(),
): RestoreResult {
  const b = listCareerBackups(accountScope).find((x) => x.id === backupId);
  if (!b) return { ok: false, why: "That backup is not on this device any more. Nothing was changed." };
  const career = careerFromBackup(b);
  if (!career) return { ok: false, why: "That backup could not be read. Nothing was changed." };
  const scope = slotScope(accountScope, b.slot);
  const was = current ?? loadCareerRaw(scope);
  let kept: CareerBackup | null = null;
  if (was) {
    kept = keepCareerBackup(accountScope, b.slot, was, WHY_BEFORE_RESTORE, now);
    if (!kept) return { ok: false, why: "This device is full, so your save could not be kept as a backup first. Nothing was changed." };
  }
  if (!saveCareer(career, scope)) return { ok: false, why: "This device would not save it. Nothing was changed." };
  // The screen the old save was on is not this save's: it opens on Home.
  try { localStorage.removeItem(scoped(PHASE_KEY, scope)); } catch { /* ignore */ }
  // The player's own choice settles a clash that was put off for this slot.
  heldScopes.delete(scope);
  if (isSignedInScope(scope)) {
    allowReplaceOnline(scope);
    void saveCareerToCloud(career, b.slot, { scope });
  }
  return { ok: true, slot: b.slot, career, restored: b, kept };
}

/** Fired when the server corrected a save (see saveCareerToCloud). */
export const SAVE_CORRECTED_EVENT = "star-save-corrected";

/** Listen for a corrected save. Returns the unsubscribe. */
export function onSaveCorrected(fn: (slot: number, career: CareerState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const d = (e as CustomEvent<{ slot: number; career: CareerState }>).detail;
    if (d && d.career) fn(d.slot, d.career);
  };
  window.addEventListener(SAVE_CORRECTED_EVENT, handler);
  return () => window.removeEventListener(SAVE_CORRECTED_EVENT, handler);
}

/**
 * Does this device hold progress the cloud hasn't confirmed? True when no
 * upload of this save has ever been confirmed, or the last confirmed one
 * was of different progress. Used to upload the moment signal comes back
 * (Harry, 30 Sep 2026: "upload first thing the moment you reopen with
 * signal") instead of waiting for the next change to trigger a save.
 */
export function hasUnsyncedProgress(scope: string, state: CareerState): boolean {
  const base = loadSyncRecord(scope).base;
  return !base || base.progress !== progressFingerprint(state);
}

/** Just under the ~64 KB cap browsers put on keepalive/sendBeacon bodies. */
export const KEEPALIVE_BODY_LIMIT = 60_000;

/**
 * Fetch one save slot from Supabase, with when it was saved.
 *
 * Returns null when the user is not logged in, has no cloud save for this
 * slot, or the request fails — in all three cases the caller should fall
 * back to localStorage. The timestamp is what lets the caller tell a cloud
 * save that is genuinely ahead of this device apart from one that is behind
 * it — see the note on loadCareerSavedAt for why blindly preferring cloud
 * regressed players' squads.
 */
export async function loadCareerFromCloud(slot: number = 1): Promise<{ career: CareerState; savedAt: number; stamp: SaveStamp | null } | null> {
  try {
    const res = await fetch(`/api/star/career?slot=${slot}`);
    if (!res.ok) return null;
    const data = await res.json() as { career: CareerState & { sync?: unknown }; updatedAt: string } | null;
    if (!data?.career || data.career.version !== 2) return null;
    // The stamp describes the upload, not the career: it never goes back
    // into the career itself (or into this device's local copy).
    const { sync, ...career } = data.career;
    return {
      career: backfill(fromSavedForm(career as CareerState)),
      savedAt: new Date(data.updatedAt).getTime(),
      stamp: readStamp(sync),
    };
  } catch {
    return null;
  }
}

/**
 * Delete one save slot's cloud copy — called alongside clearCareer() when
 * starting over, so the old career does not reappear on next login.
 */
export async function clearCareerFromCloud(slot: number = 1): Promise<void> {
  try {
    await fetch(`/api/star/career?slot=${slot}`, { method: "DELETE" });
  } catch {}
}

// ── Two different saves (lib/star/saveClash.ts) ──────────────────────────────

function randomId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 10);
  } catch { /* fall through */ }
  return Math.random().toString(36).slice(2, 12).padEnd(10, "0");
}

/**
 * This browser's own id, made once and kept. Not an identity of the person —
 * only a way for an upload to say "this came from the same browser as that".
 * It only ever travels inside this account's own save.
 */
export function getDeviceId(): string {
  try {
    const have = localStorage.getItem(DEVICE_KEY);
    if (have) return have;
    const made = `d-${randomId()}`;
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    return "d-unknown";
  }
}

function thisDeviceKind(): DeviceKind {
  try { return deviceKindFromUA(navigator.userAgent); } catch { return "computer"; }
}

export function loadSyncRecord(scope: string): SyncRecord {
  try {
    const raw = localStorage.getItem(scoped(SYNC_KEY, scope));
    return raw ? sanitizeSyncRecord(JSON.parse(raw)) : emptySyncRecord();
  } catch {
    return emptySyncRecord();
  }
}

function saveSyncRecord(scope: string, rec: SyncRecord): void {
  try { localStorage.setItem(scoped(SYNC_KEY, scope), JSON.stringify(rec)); } catch {}
}

// "This career was saved on your phone a few minutes ago" — published here,
// shown by components/star/OtherDeviceBanner.tsx (mounted in the star-dev
// layout, like SaveFailedBanner), so page.tsx only has to load the career.
let otherDevice: OtherDeviceWarning | null = null;
const otherDeviceListeners = new Set<(w: OtherDeviceWarning | null) => void>();
export function getOtherDeviceWarning(): OtherDeviceWarning | null { return otherDevice; }
export function onOtherDeviceWarningChange(fn: (w: OtherDeviceWarning | null) => void): () => void {
  otherDeviceListeners.add(fn);
  return () => { otherDeviceListeners.delete(fn); };
}
export function setOtherDeviceWarning(next: OtherDeviceWarning | null): void {
  otherDevice = next;
  otherDeviceListeners.forEach((fn) => { try { fn(next); } catch {} });
}

/** Two copies of one save, both with progress the other lacks. */
export interface SaveClash {
  slot: number;
  local: { career: CareerState; savedAt: number };
  cloud: { career: CareerState; savedAt: number; device: DeviceKind | null };
  /** Where the copy that isn't kept goes. Null: every other slot is taken. */
  spareSlot: number | null;
  /** The cloud copy as a version to remember once a choice is made. */
  cloudVersion: SyncedVersion | null;
  why: LoadWhy;
}

export type LoadOutcome =
  | { kind: "career"; career: CareerState | null; why: LoadWhy }
  | { kind: "clash"; clash: SaveClash };

/**
 * Which copy of save `slot` to open: this device's or the cloud's — or,
 * when they have genuinely gone different ways, neither yet (a SaveClash for
 * the player to settle). The decision itself is lib/star/saveClash.ts's
 * decideLoad; this only gathers what it needs and writes down the result.
 */
export async function reconcileCareerLoad(accountScope: string, slot: number): Promise<LoadOutcome> {
  const scope = slotScope(accountScope, slot);
  const local = loadCareer(scope);
  const localAt = local ? loadCareerSavedAt(scope) : -1;
  const cloud = await loadCareerFromCloud(slot);
  const decision = decideLoad({
    local: local ? { at: localAt, progress: progressFingerprint(local) } : null,
    cloud: cloud ? { at: cloud.savedAt, progress: progressFingerprint(cloud.career), stamp: cloud.stamp } : null,
    record: loadSyncRecord(scope),
    deviceId: getDeviceId(),
    now: Date.now(),
  });
  // Two DIFFERENT careers in one slot (a different player each side): never
  // pick one by its time. That rule is for two copies of ONE career; here
  // it would replace one career with another (Harry, 28 Nov 2026: "my saves
  // are completely different on my phone and PC"). The player chooses.
  if (local && cloud && differentCareers(local, cloud.career) && decision.use !== "clash") {
    decision.use = "clash";
    decision.why = "cloud-overwrote";
  }
  setOtherDeviceWarning(decision.use === "clash" ? null : decision.warn);

  if (decision.use === "clash" && local && cloud) {
    saveSyncRecord(scope, decision.record);
    return {
      kind: "clash",
      clash: {
        slot,
        local: { career: local, savedAt: localAt },
        cloud: { career: cloud.career, savedAt: cloud.savedAt, device: cloud.stamp?.device ?? null },
        spareSlot: await findSpareSlot(accountScope, slot),
        cloudVersion: decision.cloudVersion,
        why: decision.why,
      },
    };
  }
  if (decision.use === "cloud" && cloud) {
    // The cloud copy is written here straight away, BEFORE the record says
    // this device holds it. Left to the page's own save a moment later, a
    // tab closed in between would leave the record claiming the cloud copy
    // while the old local copy sat on disk — and the next load would read
    // that old copy as "ahead" and upload it over the newer one.
    if (saveCareer(cloud.career, scope)) saveSyncRecord(scope, decision.record);
    return { kind: "career", career: cloud.career, why: decision.why };
  }
  saveSyncRecord(scope, decision.record);
  return { kind: "career", career: decision.use === "local" ? local : null, why: decision.why };
}

/** Not the same player: a different career, not another copy of this one. */
export function differentCareers(a: CareerState, b: CareerState): boolean {
  const pa = a.player ?? ({} as CareerState["player"]), pb = b.player ?? ({} as CareerState["player"]);
  return pa.firstName !== pb.firstName || pa.lastName !== pb.lastName
    || (pa as { startYear?: unknown }).startYear !== (pb as { startYear?: unknown }).startYear;
}

async function findSpareSlot(accountScope: string, current: number): Promise<number | null> {
  const slots: { slot: number; localEmpty: boolean; cloudEmpty: boolean }[] = [];
  for (const s of listSaveSlots(accountScope)) {
    if (s.slot === current) continue;
    // A slot this device has never used can still hold another device's
    // save in the cloud; writing a spare over it would lose that instead.
    const cloudEmpty = s.empty ? !(await loadCareerFromCloud(s.slot)) : false;
    slots.push({ slot: s.slot, localEmpty: s.empty, cloudEmpty });
  }
  return pickSpareSlot(current, slots);
}

/**
 * The player picked one. The other goes to the spare slot (this device, and
 * the cloud when that slot can reach it — see star_career_slots.sql), or,
 * when there is none, is let go: the prompt has already said so and been
 * told "Overwrite". Returns the career to open.
 */
export function resolveSaveClash(
  accountScope: string, clash: SaveClash, keep: "local" | "cloud",
  /** "spare" (the default, and the Old UI's only way): the other copy moves
   *  to the free slot, or to a backup when there is none. "backup": the
   *  player chose to keep only one; the other goes to a 30-day backup. */
  other: "spare" | "backup" = "spare",
): CareerState {
  const scope = slotScope(accountScope, clash.slot);
  const chosen = keep === "local" ? clash.local.career : clash.cloud.career;
  const otherCopy = keep === "local" ? clash.cloud.career : clash.local.career;
  if (clash.spareSlot !== null && other === "spare") {
    const spareScope = slotScope(accountScope, clash.spareSlot);
    saveCareer(otherCopy, spareScope);
    void saveCareerToCloud(otherCopy, clash.spareSlot, { scope: spareScope });
  } else {
    // No free slot: the other copy is kept as a backup for 30 days, on this
    // device. If this device will not even store that, nothing is replaced:
    // the choice is put off exactly like "Decide later".
    const why = keep === "local" ? "kept this device's copy" : "kept the online copy";
    if (!backupCareer(accountScope, clash.slot, otherCopy, why)) {
      heldScopes.add(scope);
      return clash.local.career;
    }
  }
  // Whichever was kept, this device has now SEEN the cloud copy, so it is
  // the base: keeping this device's copy then reads as "ahead" and uploads
  // over it (the cloud copy is safe in the spare slot), and keeping the
  // cloud copy reads as "in sync".
  heldScopes.delete(scope);
  // A choice was made: the next upload may go straight away.
  refusedUntil.delete(scope);
  if (saveCareer(chosen, scope)) saveSyncRecord(scope, recordAfterTake(clash.cloudVersion));
  return chosen;
}

/** Save scopes whose cloud uploads are paused until the clash is settled. */
const heldScopes = new Set<string>();

/**
 * "Decide later" (no free slot): open this device's copy, upload nothing
 * for this save until the page is reopened. The sync record is left as it
 * was, so the next load finds the same clash and asks again.
 */
export function deferSaveClash(accountScope: string, clash: SaveClash): CareerState {
  heldScopes.add(slotScope(accountScope, clash.slot));
  return clash.local.career;
}
