/**
 * THE SOCIAL STUDIO'S HOOKS INTO THE GAME (Leo, 30 Oct 2026, /admin/social).
 *
 * Leo: "FULL CONTROL OVER EVERYTHING … without needing to do prompts." The
 * studio keeps its settings on the save (`MediaState.studio`, types.ts). The
 * feed reads them in two places only:
 *
 *  - making posts (feed.ts commit): the cast gets the account changes, the
 *    new accounts and the weights; kinds of post that are off are dropped;
 *    pictures that are off come off; the save keeps `postCap` posts.
 *  - showing posts (feed.ts feedFor): hidden posts go, pinned posts go first,
 *    authors get their account's new name and picture, pinned trends lead.
 *
 * THE RULE: with nothing set, every function here hands back exactly what it
 * was given (the same array, the same object), so a save nobody has opened
 * the studio for plays exactly as before. tests/star/socialStudio.mts checks
 * a whole run of matches comes out byte for byte the same.
 */
import type {
  AccountOverride, FootballEvent, MediaAccount, MediaStudio, StoredPost, Trend,
} from "./types";
import { accountKit } from "./accounts";

/** True when the studio has any setting that changes the feed. */
export function studioActive(st?: MediaStudio): st is MediaStudio {
  if (!st) return false;
  return Object.keys(st.accountOverrides ?? {}).length > 0
    || (st.customAccounts?.length ?? 0) > 0
    || Object.keys(st.archetypeWeights ?? {}).length > 0
    || (st.disabledEvents?.length ?? 0) > 0
    || (st.disabledTags?.length ?? 0) > 0
    || (st.disabledGraphics?.length ?? 0) > 0
    || st.postCap !== undefined
    || st.volume !== undefined
    || (st.pinnedTrends?.length ?? 0) > 0;
}

function overrideFor(st: MediaStudio | undefined, handle: string): AccountOverride | undefined {
  return st?.accountOverrides?.[handle];
}

/** Two weights together (either may be unset). Undefined when neither is. */
function weightOf(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 1) * (b ?? 1);
}

/** One account with its studio changes. The same object when there are none. */
export function studioAccount(a: MediaAccount, st?: MediaStudio): MediaAccount {
  if (!st) return a;
  const ov = overrideFor(st, a.handle);
  const w = weightOf(ov?.weight, st.archetypeWeights?.[a.archetype]);
  if (!ov && w === undefined) return a;
  const out: MediaAccount = {
    ...a,
    // The id stays the game's own: every post's wording is seeded from it,
    // so renaming an account never rewrites what it would have said.
    name: ov?.name || a.name,
    handle: ov?.handle || a.handle,
    verified: ov?.verified ?? a.verified,
    followers: ov?.followers ?? a.followers,
    platform: ov?.platform ?? a.platform,
    avatar: {
      ...a.avatar,
      ...(ov?.initials ? { initials: ov.initials } : {}),
      ...(ov?.tint ? { tint: ov.tint } : {}),
      ...(ov?.tint2 ? { tint2: ov.tint2 } : {}),
      ...(ov?.glyph ? { glyph: ov.glyph } : {}),
    },
  };
  if (w !== undefined) out.weight = w;
  return out;
}

/** The studio's own accounts, ready to post. */
export function customAccounts(st?: MediaStudio): MediaAccount[] {
  return (st?.customAccounts ?? []).map(c => {
    const kit = accountKit(c.archetype);
    const w = weightOf(c.weight, st?.archetypeWeights?.[c.archetype]);
    return {
      id: c.handle, handle: c.handle, name: c.name, archetype: c.archetype, platform: c.platform,
      verified: c.verified, followers: c.followers, avatar: { ...c.avatar },
      voice: kit.voice, interests: kit.interests,
      ...(c.allegiance ? { allegiance: { ...c.allegiance } } : {}),
      ...(w !== undefined ? { weight: w } : {}),
    };
  });
}

/** The cast that may post, with the studio's changes. Same array when nothing is set. */
export function studioRoster(accounts: MediaAccount[], st?: MediaStudio): MediaAccount[] {
  if (!studioActive(st)) return accounts;
  const own = accounts.map(a => studioAccount(a, st));
  const known = new Set(own.map(a => a.id));
  return [...own, ...customAccounts(st).filter(a => !known.has(a.id))];
}

/** Whether a kind of post (an event id) may be made. */
export function studioAllowsEvent(id: string, st?: MediaStudio): boolean {
  return !(st?.disabledEvents?.includes(id));
}

/** The events the studio has not turned off. Same array when nothing is off. */
export function studioEvents(events: FootballEvent[], st?: MediaStudio): FootballEvent[] {
  const ids = st?.disabledEvents ?? [], tags = st?.disabledTags ?? [];
  if (!ids.length && !tags.length) return events;
  return events.filter(e => !ids.includes(e.id) && !e.tags.some(t => tags.includes(t)));
}

/** Posts the game made, minus kinds that are off, with pictures that are off taken off. */
export function studioPosts(posts: StoredPost[], st?: MediaStudio): StoredPost[] {
  const ids = st?.disabledEvents ?? [], pics = st?.disabledGraphics ?? [];
  if (!ids.length && !pics.length) return posts;
  return posts
    .filter(p => !ids.includes(p.eventId))
    .map(p => (p.graphic && pics.includes(p.graphic.type) ? { ...p, graphic: undefined } : p));
}

/** Most posts the save keeps. */
export function studioCap(st: MediaStudio | undefined, gameCap: number): number {
  const c = st?.postCap;
  return c !== undefined && Number.isFinite(c) && c >= 10 ? Math.round(c) : gameCap;
}

/** More or fewer posts a match (undefined = as the game decides). */
export function studioVolume(st?: MediaStudio): number | undefined {
  const v = st?.volume;
  return v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** A post's author as the account looks now. Same object when it has no changes. */
export function studioAuthor(author: StoredPost["author"], st?: MediaStudio): StoredPost["author"] {
  const ov = overrideFor(st, author.handle) ?? renamedFrom(st, author.handle);
  if (!ov) return author;
  return {
    ...author,
    name: ov.name || author.name,
    handle: ov.handle || author.handle,
    verified: ov.verified ?? author.verified,
    platform: ov.platform ?? author.platform,
    initials: ov.initials || author.initials,
    tint: ov.tint || author.tint,
    tint2: ov.tint2 || author.tint2,
    glyph: ov.glyph ?? author.glyph,
  };
}

/** A post made after an account's handle was changed carries the new one. */
function renamedFrom(st: MediaStudio | undefined, handle: string): AccountOverride | undefined {
  for (const ov of Object.values(st?.accountOverrides ?? {})) if (ov.handle && ov.handle === handle) return ov;
  return undefined;
}

/**
 * What the feed shows: hidden posts out, pinned posts first (in the order
 * they were), every author as the account looks now. The same array when no
 * post is hidden or pinned and no account was changed.
 */
export function studioShown(posts: StoredPost[], st?: MediaStudio): StoredPost[] {
  const anyFlag = posts.some(p => p.hidden || p.pinned);
  const restyle = Object.keys(st?.accountOverrides ?? {}).length > 0;
  if (!anyFlag && !restyle) return posts;
  const kept = anyFlag ? posts.filter(p => !p.hidden) : posts;
  const ordered = anyFlag ? [...kept.filter(p => p.pinned), ...kept.filter(p => !p.pinned)] : kept;
  if (!restyle) return ordered;
  return ordered.map(p => {
    const author = studioAuthor(p.author, st);
    return author === p.author ? p : { ...p, author };
  });
}

/** Pinned trends lead the ticker. Same array when there are none. */
export function studioTrends(trends: Trend[], st?: MediaStudio): Trend[] {
  const pinned = st?.pinnedTrends ?? [];
  if (!pinned.length) return trends;
  const labels = new Set(pinned.map(t => t.label.toLowerCase()));
  return [...pinned, ...trends.filter(t => !labels.has(t.label.toLowerCase()))];
}
