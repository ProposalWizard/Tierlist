/**
 * THE REAL DRESSING ROOMS: the phone's port of page.tsx's squad fetches.
 *
 * The website asks its server for every club's real players; the packed app
 * answers the same asks from its packed files (lib/app/offline.ts). The phone
 * does what the packed app does: the SAME lib/star entry points
 * (fetchRealSquad, fetchLeagueSquads, fetchFreeAgents, fetchSharedLineups,
 * refreshXpConfig) at the SAME moments page.tsx calls them, answered from the
 * same packed files by data/offline.ts (installed when this file loads).
 *
 * Each function returns a promise that settles once its squads are in the
 * career (the headless check waits on them; the screens do not need to).
 * Every update re-reads the career and checks it is still the one the
 * squad was fetched for, as page.tsx's setCareer(c => …) callbacks do.
 */
import type { CareerState } from "@/lib/star/types";
import { fetchRealSquad, shouldUpgradeSquad, squadAfterFetch } from "@/lib/star/realSquad";
import { fetchLeagueSquads, fetchFreeAgents, syncLeagueStrengthFromSquads, withoutPlayersElsewhere, addFullRoster, isRealFetch, shouldUpgradeLeagueSquads, mergeLeagueSquadStats, reconcileExternalSquads, relabelOutOfPosition } from "@/lib/star/leagueSquads";
import { fetchSharedLineups } from "@/lib/star/lineupStore";
import { refreshXpConfig } from "@/lib/star/xpStore";
import { externalClubsFor } from "@/lib/star/clubs";
import { divisionOf, hasClub } from "@/lib/star/calendar";
import { ageFetchedForCareer, ageOwnFetchedForCareer } from "@/lib/star/worldAgeing";
import { hydrateSquads } from "@/lib/star/squadSaveCodec";
import { installOfflineFetch } from "../data/offline";
import { getCareer, setCareer } from "./store";

installOfflineFetch();

/** setCareer(c => …) that leaves "no career" alone (page.tsx's `c ? … : c`). */
function update(fn: (c: CareerState) => CareerState) {
  if (getCareer()) setCareer(fn);
}

/** page.tsx handleProfileComplete: shared team sheets, the XP Book, free agents, the wider world. */
export function afterNewCareer(clubs: string[] = []): Promise<unknown> {
  return Promise.all([
    fetchSharedLineups(),
    Promise.resolve(refreshXpConfig()),
    fetchFreeAgents().then((freeAgents) => update((c) => ({ ...c, freeAgents }))),
    fetchLeagueSquads(externalClubsFor(clubs)).then((externalSquads) => update((c) => ({ ...c, externalSquads }))),
  ]);
}

/** page.tsx's signing from the trial (and youthOrFreeAgent): your club's real squad, then the division's. */
export function afterSigning(homeClub: string, clubs: string[]): Promise<unknown> {
  return Promise.all([
    fetchRealSquad(homeClub).then((squad) => update((c) => (c.player.club === homeClub ? { ...c, squad } : c))),
    fetchLeagueSquads(clubs).then((leagueSquads) => update((c) => ({
      ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)),
    }))),
  ]);
}

/** page.tsx handleSigningDone: the new club's dressing room, aged to this career's world. */
export function afterTransfer(club: string): Promise<unknown> {
  return fetchRealSquad(club).then((squad) => update((c) => (c.player.club === club ? { ...c, squad: ageOwnFetchedForCareer(c, club, squad) } : c)));
}

/** page.tsx's save load (the mount effect): an existing career gets the real dressing rooms too. */
export function afterLoad(saved: CareerState): Promise<unknown> {
  const jobs: Promise<unknown>[] = [fetchSharedLineups()];
  if (!hasClub(saved)) return Promise.all(jobs);
  const clubs = saved.league.map((t) => t.name);
  if (shouldUpgradeSquad(saved.squad ?? [])) {
    jobs.push(fetchRealSquad(saved.player.club).then((real) => update((c) => {
      if (c.player.club !== saved.player.club || !shouldUpgradeSquad(c.squad ?? [])) return c;
      const squad = squadAfterFetch(c.squad ?? [], ageOwnFetchedForCareer(c, saved.player.club, real));
      return squad ? { ...c, squad } : c;
    })));
  }
  if (!(saved.leagueSquads ?? []).length) {
    jobs.push(fetchLeagueSquads(clubs).then((leagueSquads) => update((c) => (!(c.leagueSquads ?? []).length
      ? { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)) } : c))));
  } else {
    jobs.push(fetchLeagueSquads(clubs).then((fresh) => update((c) => {
      if (!(c.leagueSquads ?? []).length) return c;
      const filled = relabelOutOfPosition(hydrateSquads(c.leagueSquads ?? []));
      if (isRealFetch(fresh) && shouldUpgradeLeagueSquads(filled)) {
        const leagueSquads = mergeLeagueSquadStats(ageFetchedForCareer(c, fresh), filled);
        return { ...c, leagueSquads, league: syncLeagueStrengthFromSquads(c.league, leagueSquads, divisionOf(c)) };
      }
      return filled === c.leagueSquads ? c : { ...c, leagueSquads: filled };
    })));
  }
  if (!(saved.externalSquads ?? []).length) {
    jobs.push(fetchLeagueSquads(externalClubsFor(clubs)).then((externalSquads) => update((c) => (!(c.externalSquads ?? []).length ? { ...c, externalSquads } : c))));
  } else {
    jobs.push(fetchLeagueSquads(externalClubsFor(clubs)).then((fresh) => update((c) => {
      if (!(c.externalSquads ?? []).length) return c;
      const externalSquads = reconcileExternalSquads(
        relabelOutOfPosition(hydrateSquads(c.externalSquads ?? [])), ageFetchedForCareer(c, fresh),
        (club) => !!c.ownedClubs?.[club]?.dissolvedInto,
      );
      return { ...c, externalSquads };
    })));
  }
  return Promise.all(jobs);
}

// ── page.tsx's three squad effects, run after any change (flow.settle) ──

let missingAsked = "";
let ownClubDone: string | null = null;
let freeAgentsAsked = false;

/**
 * The squad effects page.tsx runs whenever the career changes:
 * 1. a division you have not played before needs its dressing rooms (clubs in
 *    the table with no squad: after a rollover, a transfer, an old save);
 * 2. your own club's FULL roster (keepAll), once per club you play for;
 * 3. free agents, for a save that predates them.
 */
export function keepSquadsInStep(c: CareerState | null = getCareer()): Promise<unknown> {
  if (!c) return Promise.resolve();
  const jobs: Promise<unknown>[] = [];

  // 1. Keyed, like the effect, on the club list and how many squads there are.
  if (c.league?.length) {
    const have = new Set((c.leagueSquads ?? []).map((s) => s.club));
    const missing = c.league.map((t) => t.name).filter((n) => !have.has(n));
    const key = c.league.map((t) => t.name).join("|") + "#" + (c.leagueSquads?.length ?? 0);
    if (missing.length && key !== missingAsked) {
      missingAsked = key;
      jobs.push(fetchLeagueSquads(missing).then((fresh) => update((cur) => {
        const already = new Set((cur.leagueSquads ?? []).map((s) => s.club));
        const clean = withoutPlayersElsewhere(ageFetchedForCareer(cur, fresh), [...(cur.leagueSquads ?? []), ...(cur.externalSquads ?? [])]);
        const leagueSquads = [...(cur.leagueSquads ?? []), ...clean.filter((s) => !already.has(s.club))];
        return { ...cur, leagueSquads, league: syncLeagueStrengthFromSquads(cur.league, leagueSquads, divisionOf(cur)) };
      })));
    }
  }

  // 2. Your own club's full roster, once per club.
  const club = c.player.club;
  if (club && ownClubDone !== club) {
    ownClubDone = club;
    jobs.push(fetchLeagueSquads([club], undefined, true).then(([full]) => {
      if (!full || full.players.some((p) => p.id.startsWith("gen:"))) return;
      update((cur) => {
        if (cur.player.club !== club) return cur;
        const current = (cur.leagueSquads ?? []).find((s) => s.club === club);
        const elsewhere = [...(cur.leagueSquads ?? []), ...(cur.externalSquads ?? [])].filter((s) => s.club !== club);
        const merged = addFullRoster(ageFetchedForCareer(cur, [full])[0], current, elsewhere);
        const leagueSquads = current
          ? (cur.leagueSquads ?? []).map((s) => (s.club === club ? merged : s))
          : [...(cur.leagueSquads ?? []), merged];
        return { ...cur, leagueSquads };
      });
    }));
  }

  // 3. Free agents, only when never fetched (undefined, not []).
  if (c.freeAgents === undefined && !freeAgentsAsked) {
    freeAgentsAsked = true;
    jobs.push(fetchFreeAgents().then((freeAgents) => update((cur) => (cur.freeAgents === undefined ? { ...cur, freeAgents } : cur))));
  }
  return Promise.all(jobs);
}

/** A new career (or a different save) starts the effects' memory afresh, as a fresh page would. */
export function resetSquadEffects() {
  missingAsked = "";
  ownClubDone = null;
  freeAgentsAsked = false;
}
