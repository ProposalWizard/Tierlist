/**
 * lib/patchNotes.ts
 *
 * THE SHAPE OF A PATCH NOTE. The notes themselves live in
 * lib/patchNotesData.ts.
 *
 * Patch notes are STORED AS STRUCTURED DATA, never as HTML or markdown.
 * That is a deliberate decision, not a convenience:
 *
 *   - The page renders in the site's own style. A stored page brings its own
 *     stylesheet and immediately looks like a different site.
 *   - Stored markup is stored injection. Nothing written to this table can
 *     put a tag on the page — the renderer only reads the fields below.
 *   - It stays queryable. "Which versions still list this known issue" is a
 *     question you can ask the JSONB, not a text search.
 *
 * The visual target is the v0.1 artifact
 * (.claude/skills/artifact-house-style/references/patch-notes-v0.1.html):
 * a stat strip, coloured dot headings, one bold line per item with a thin
 * rule under it, before/after bars, and anything longer behind a toggle.
 * Every field below exists because that page needed it.
 */

/** The section kinds, in the order a patch notes page shows them. */
export type PatchSectionKind =
  | "fixed"
  | "added"
  | "changed"
  | "known"
  | "next"
  | "history";

/** How a before/after bar is coloured. Green fixed, amber half fixed, red still wrong. */
export type PatchBarState = "good" | "warn" | "bad";

/** A pill sits at the end of an item's headline: "half fixed", "blocked on Harry". */
export interface PatchPill {
  text: string;
  tone: "amber" | "red";
}

/** One of the four big numbers at the top. */
export interface PatchStat {
  value: string;
  label: string;
}

/**
 * A before/after bar. `was` and `now` are the real measured numbers; the
 * renderer works out the fill widths itself, scaled against `target` when
 * one is given, otherwise against the larger of the two.
 */
export interface PatchBar {
  label: string;
  was: number;
  now: number;
  target?: number;
  state: PatchBarState;
  unit?: string;
}

/** The contents of a `<details>` toggle — a label and a plain list. */
export interface PatchMore {
  summary: string;
  points: string[];
}

export interface PatchItem {
  /** The bold headline. Should read out loud as a sentence. */
  title: string;
  /** At most one line. Anything longer belongs in `more`. */
  detail?: string;
  pill?: PatchPill;
  bars?: PatchBar[];
  more?: PatchMore;
  /** Renders as the red left-bordered callout instead of a list row. */
  alert?: boolean;
  /**
   * Names a hand-built visual that belongs with this item — a diagram, or a
   * small thing you can press. The shareable artifact looks the name up in
   * lib/patchNotesDemos.ts and drops it in under the item; the archive
   * here ignores it.
   *
   * Why they live outside this file: an interactive demo is markup and
   * script, and everything else here is plain data that can be read, queried
   * and diffed. Mixing a page's worth of HTML into it would end that. The
   * words stay the single copy; the demo is an extra the artifact can show.
   */
  demo?: string;
}

export interface PatchSection {
  kind: PatchSectionKind;
  title: string;
  items: PatchItem[];
}

export interface PatchNote {
  version: string;
  title: string;
  publishedAt: string;
  summary: string | null;
  stats: PatchStat[];
  sections: PatchSection[];
  artifactUrl: string | null;
  updatedAt: string | null;
}

/* ── Colours ──────────────────────────────────────────────────────────────
 * Lifted from the v0.1 artifact's own tokens so the page is recognisably
 * the same thing: green fixed, blue added, violet changed, amber known
 * issues, muted for next and history.
 */
export const SECTION_COLOR: Record<PatchSectionKind, { dot: string; text: string }> = {
  fixed:   { dot: "bg-[#3ddc84]", text: "text-[#3ddc84]" },
  added:   { dot: "bg-[#6fb8ff]", text: "text-[#6fb8ff]" },
  changed: { dot: "bg-[#b18cff]", text: "text-[#b18cff]" },
  known:   { dot: "bg-[#f5b942]", text: "text-[#f5b942]" },
  next:    { dot: "bg-[#6f8679]", text: "text-[#6f8679]" },
  history: { dot: "bg-[#6f8679]", text: "text-[#6f8679]" },
};

/** Fallback headings, used when a section arrives without its own title. */
export const SECTION_DEFAULT_TITLE: Record<PatchSectionKind, string> = {
  fixed: "Fixed",
  added: "Added",
  changed: "Changed",
  known: "Known issues",
  next: "Next",
  history: "Previous versions",
};

const KINDS: PatchSectionKind[] = ["fixed", "added", "changed", "known", "next", "history"];
const BAR_STATES: PatchBarState[] = ["good", "warn", "bad"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Coerce whatever came out of the JSONB column into the shape above.
 *
 * Anything unrecognised is DROPPED rather than rendered — a stat with no
 * value, a bar with no numbers, a section with an invented kind. A patch
 * note that is partly malformed still shows the parts that are fine; it
 * never throws on the page and never puts an empty row on screen.
 */
export function parseStats(raw: unknown): PatchStat[] {
  if (!Array.isArray(raw)) return [];
  const out: PatchStat[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const value = str(o.value);
    const label = str(o.label);
    if (value && label) out.push({ value, label });
  }
  return out;
}

function parseBars(raw: unknown): PatchBar[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: PatchBar[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const label = str(o.label);
    const was = num(o.was);
    const now = num(o.now);
    if (label === null || was === null || now === null) continue;
    const state = BAR_STATES.includes(o.state as PatchBarState) ? (o.state as PatchBarState) : "good";
    const target = num(o.target);
    const unit = str(o.unit);
    out.push({
      label,
      was,
      now,
      state,
      ...(target !== null ? { target } : {}),
      ...(unit ? { unit } : {}),
    });
  }
  return out.length ? out : undefined;
}

function parseItems(raw: unknown): PatchItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PatchItem[] = [];
  for (const i of raw) {
    if (!i || typeof i !== "object") continue;
    const o = i as Record<string, unknown>;
    const title = str(o.title);
    if (!title) continue;

    const item: PatchItem = { title };
    const detail = str(o.detail);
    if (detail) item.detail = detail;

    const pill = o.pill as Record<string, unknown> | undefined;
    const pillText = pill && typeof pill === "object" ? str(pill.text) : null;
    if (pillText) {
      item.pill = { text: pillText, tone: pill!.tone === "red" ? "red" : "amber" };
    }

    const bars = parseBars(o.bars);
    if (bars) item.bars = bars;

    const more = o.more as Record<string, unknown> | undefined;
    if (more && typeof more === "object" && Array.isArray(more.points)) {
      const points = more.points.filter((p): p is string => typeof p === "string" && !!p.trim());
      const summary = str(more.summary);
      if (summary && points.length) item.more = { summary, points };
    }

    if (o.alert === true) item.alert = true;
    const demo = str(o.demo);
    if (demo) item.demo = demo;
    out.push(item);
  }
  return out;
}

export function parseSections(raw: unknown): PatchSection[] {
  if (!Array.isArray(raw)) return [];
  const out: PatchSection[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (!KINDS.includes(o.kind as PatchSectionKind)) continue;
    const kind = o.kind as PatchSectionKind;
    out.push({
      kind,
      title: str(o.title) ?? SECTION_DEFAULT_TITLE[kind],
      items: parseItems(o.items),
    });
  }
  return out;
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Sep 2026" — spelled out here rather than via toLocaleDateString, which
 *  returns "Sept" for September under current ICU and reads odd next to the
 *  other eleven three-letter months. */
export function formatPatchDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The shared scale a group of bars is drawn against.
 *
 * Every bar under one item shares one ceiling, so the bars compare with each
 * other — which is the only reason to draw them as bars at all. Scaling each
 * bar to its own maximum instead makes every improved number full width and
 * the picture says nothing.
 */
export function barGroupCeiling(bars: PatchBar[]): number {
  let max = 0;
  for (const b of bars) max = Math.max(max, b.was, b.now, b.target ?? 0);
  return max;
}

/**
 * How wide the two halves of a before/after bar are drawn, 0-100.
 *
 * `ceiling` comes from barGroupCeiling so a whole group shares one scale.
 * Without one a single bar falls back to its own larger value.
 */
export function barWidths(bar: PatchBar, ceiling?: number): { was: number; now: number } {
  const top = ceiling && ceiling > 0 ? ceiling : Math.max(bar.was, bar.now, bar.target ?? 0);
  if (top <= 0) return { was: 0, now: 0 };
  const pct = (v: number) => Math.max(0, Math.min(100, (v / top) * 100));
  return { was: pct(bar.was), now: pct(bar.now) };
}

/** "41.3%" / "1,221" — trailing zeroes trimmed, thousands separated. */
export function formatBarValue(v: number, unit?: string): string {
  const n = Number.isInteger(v) ? v.toLocaleString("en-GB") : String(v);
  return unit ? `${n}${unit}` : n;
}
