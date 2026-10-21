/**
 * APPROVED SCENE EDITS — which 3D Scene Editor edits the real game uses.
 *
 * Harry, 20 Oct 2026 (answer 3D-4): "once we have approved them in the
 * editor, maybe there's an approve button. They can still be edited, but they
 * can be used, and we could choose maybe when and where." And 3D-3: database
 * saves now, then "Commit to game" pushes them into the repo.
 *
 * An edit (one row of star_cutscene_edits, or one entry of the committed file
 * lib/star/data/sceneEdits.json) carries an optional `approval`:
 *   approved  — the game may use it (unapproved edits only show in the editor)
 *   where     — which screens may use it ("career" = the real game, "test" = the place's test page)
 *   when      — "always", or one condition from the place's own list below
 *   at        — when it was approved (the newer copy wins: database or committed file)
 *
 * Everything here is pure: tests/star/sceneEdits.mts runs it with no server.
 */

export type ScenePlace = "director" | "signing" | "office" | "shop" | "garden" | "house";

export interface SceneApproval {
  approved: boolean;
  /** ISO time it was approved (or last changed). */
  at?: string;
  /** Which screens use it: "career" and/or "test". Empty = nowhere. */
  where: string[];
  /** "always", or one id from the place's `when` list. */
  when: string;
}

/** An edit as saved: whatever the place's dials wrote, plus the approval. */
export type SavedSceneEdit = Record<string, unknown> & { approval?: SceneApproval; place?: string };

export interface UseOption { id: string; label: string }

const EVENT_KINDS = [
  "signed", "scored", "won-trophy", "injured", "dropped", "sacked", "record-broken", "transfer-request", "rivalry",
  "debut", "walkout", "press-conference", "award", "promoted", "relegated", "retired", "arrival", "mentor-advice",
] as const;

const HERE_CAREER = (what: string): UseOption => ({ id: "career", label: `In a career (${what})` });
const HERE_TEST = (what: string): UseOption => ({ id: "test", label: `The ${what} test page` });
const ALWAYS: UseOption = { id: "always", label: "Always" };

/** Per place: where an approved edit may be used, and the "when" choices. */
export const PLACE_USE: Record<ScenePlace, { name: string; where: UseOption[]; when: UseOption[] }> = {
  signing: {
    name: "3D Signing",
    where: [HERE_CAREER("the first contract and moves to a new club"), HERE_TEST("3D signing")],
    when: [ALWAYS, { id: "trial", label: "Only the first contract (after the trial)" }, { id: "transfer", label: "Only a move to a new club" }],
  },
  office: {
    name: "Manager's Office",
    where: [HERE_CAREER("talks with your manager"), HERE_TEST("manager's office")],
    when: [ALWAYS],
  },
  shop: {
    name: "3D Shop",
    where: [HERE_CAREER("Walk the 3D shop"), HERE_TEST("3D shop")],
    when: [ALWAYS, { id: "door", label: "Only walking in from the garden" }, { id: "page", label: "Only opened from the Shop page" }],
  },
  garden: {
    name: "3D Garden",
    where: [HERE_CAREER("Home → Garden"), HERE_TEST("3D garden")],
    when: [ALWAYS, { id: "day", label: "Only by day" }, { id: "sunset", label: "Only at sunset" }, { id: "night", label: "Only at night" }],
  },
  house: {
    name: "3D House",
    where: [HERE_CAREER("Your house"), HERE_TEST("3D house")],
    when: [ALWAYS, ...["starter", "flat", "penthouse", "house", "villa", "estate"].map((t) => ({ id: t, label: `Only the ${t} home` }))],
  },
  director: {
    name: "Cut-scene Director",
    // cut scenes do not play in a career yet (lib/star/cutscene/whenPlays.ts): "career" is
    // stored and honoured the day they do
    where: [HERE_CAREER("when the game plays this cut scene: not yet"), { id: "test", label: "The 3D bench's cut-scene shots" }],
    when: [ALWAYS, ...EVENT_KINDS.map((k) => ({ id: k, label: `Only for a "${k.replace(/-/g, " ")}" moment` }))],
  },
};

/** A hand-made director scene's save id ("Contract signing" saves as "director:signing": the 3D Signing place owns "signing"). */
export const directorScriptId = (fixture: string) => (fixture === "signing" ? "director:signing" : fixture);

/** Which place a saved edit belongs to (a place's saves carry `place`; the rest are director scenes). */
export function placeOf(scriptId: string, e: SavedSceneEdit | null | undefined): ScenePlace {
  const p = e?.place;
  if (p === "signing" || p === "office" || p === "shop" || p === "garden" || p === "house") return p;
  if (scriptId === "signing" || scriptId === "office" || scriptId === "shop" || scriptId === "garden" || scriptId === "house") return scriptId;
  return "director";
}

/** A fresh approval for a place: approved, the real game only, always. */
export function defaultApproval(now = new Date()): SceneApproval {
  return { approved: true, at: now.toISOString(), where: ["career"], when: "always" };
}

/** Keep only choices the place knows ("when" falls back to always). */
export function cleanApproval(place: ScenePlace, a: Partial<SceneApproval> | null | undefined): SceneApproval | null {
  if (!a || typeof a !== "object") return null;
  const use = PLACE_USE[place];
  const where = Array.isArray(a.where) ? a.where.filter((w) => use.where.some((o) => o.id === w)) : [];
  const when = typeof a.when === "string" && use.when.some((o) => o.id === a.when) ? a.when : "always";
  return { approved: !!a.approved, at: typeof a.at === "string" ? a.at : undefined, where: where.filter((w, i) => where.indexOf(w) === i), when };
}

/** Where the game is asking from: which screen, and the moment's own facts. */
export interface UseContext {
  where: "career" | "test";
  /** The facts that a "when" may match (the shop: "door" or "page"; the garden: its sky; …). */
  facts?: string[];
}

/** Does this saved edit apply here? Only an approved one, used here, whose "when" holds. */
export function appliesHere(place: ScenePlace, e: SavedSceneEdit | null | undefined, ctx: UseContext): boolean {
  const a = cleanApproval(place, e?.approval);
  if (!a || !a.approved) return false;
  if (!a.where.includes(ctx.where)) return false;
  return a.when === "always" || (ctx.facts ?? []).includes(a.when);
}

/**
 * The edit as a scene's setEdit takes it: the bookkeeping (approval, place)
 * dropped, and the editor's scene-wide `scene: { exposure, keyLight, … }`
 * laid flat beside the shots/views (SigningSceneEdit, WalkSceneEdit and
 * DirectorEdit all take them flat).
 */
export function sceneEditOf<T = Record<string, unknown>>(e: SavedSceneEdit): T {
  const rest: Record<string, unknown> = { ...e };
  delete rest.approval;
  delete rest.place;
  const scene = rest.scene;
  delete rest.scene;
  return { ...rest, ...(scene && typeof scene === "object" && !Array.isArray(scene) ? scene : {}) } as T;
}

const atOf = (e?: SavedSceneEdit | null) => {
  const t = Date.parse(e?.approval?.at ?? "");
  return Number.isFinite(t) ? t : 0;
};

/**
 * The edit the game uses for one scene: of the shared copy (database) and the
 * committed copy (repo file), those that apply here; the newer approval wins.
 * None apply → null (the scene plays exactly as written).
 */
export function pickApproved(scriptId: string, shared: Record<string, unknown> | null | undefined, committed: Record<string, unknown> | null | undefined, ctx: UseContext): SavedSceneEdit | null {
  const cands = [shared?.[scriptId], committed?.[scriptId]]
    .filter((e): e is SavedSceneEdit => !!e && typeof e === "object" && !Array.isArray(e))
    .filter((e) => appliesHere(placeOf(scriptId, e), e, ctx));
  if (!cands.length) return null;
  return cands.reduce((a, b) => (atOf(b) > atOf(a) ? b : a));
}

/** Only the approved rows of a { scriptId: edit } map (the game's download, the commit). */
export function approvedOnly(all: Record<string, unknown>): Record<string, SavedSceneEdit> {
  const out: Record<string, SavedSceneEdit> = {};
  for (const [id, e] of Object.entries(all ?? {})) {
    if (!e || typeof e !== "object" || Array.isArray(e)) continue;
    const s = e as SavedSceneEdit;
    if (s.approval && (s.approval as SceneApproval).approved === true) out[id] = s;
  }
  return out;
}

// ── The committed file (lib/star/data/sceneEdits.json) ──

export const SCENE_EDITS_PATH = "lib/star/data/sceneEdits.json";
const NOTE = "Approved 3D Scene Editor edits the game uses (/star-scene-editor-dev → Approve → Commit to game). One entry per scene; the shared table star_cutscene_edits sits on top (the newer approval wins).";

export function editsFromFile(parsed: unknown): Record<string, SavedSceneEdit> {
  const e = (parsed as { edits?: unknown } | null)?.edits;
  return e && typeof e === "object" && !Array.isArray(e) ? (e as Record<string, SavedSceneEdit>) : {};
}

/**
 * Merge approved edits into the file's text. Unapproved ones are left out (and
 * an edit that was un-approved since is taken OUT of the file, so the game
 * stops using it). Returns the new text and the ids written or removed.
 */
export function mergeSceneEditsFile(text: string, rows: { scriptId: string; edits: SavedSceneEdit }[]): { text: string; ids: string[] } {
  let parsed: unknown = null;
  try { parsed = text.trim() ? JSON.parse(text) : null; } catch { parsed = null; }
  const edits = { ...editsFromFile(parsed) };
  const ids: string[] = [];
  for (const r of rows) {
    if (!r || typeof r.scriptId !== "string" || !r.scriptId.trim() || !r.edits || typeof r.edits !== "object") continue;
    const place = placeOf(r.scriptId, r.edits);
    const a = cleanApproval(place, r.edits.approval);
    if (a?.approved) { edits[r.scriptId] = { ...r.edits, approval: a }; ids.push(r.scriptId); }
    else if (edits[r.scriptId]) { delete edits[r.scriptId]; ids.push(r.scriptId); }
  }
  const sorted = Object.fromEntries(Object.keys(edits).sort().map((k) => [k, edits[k]]));
  return { text: `${JSON.stringify({ note: NOTE, edits: sorted }, null, 2)}\n`, ids };
}
