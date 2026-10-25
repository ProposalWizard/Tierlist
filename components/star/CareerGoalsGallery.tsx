"use client";

/**
 * STATS → GOALS: EVERY GOAL OF YOUR CAREER (Leo, 22 Oct 2026: "Career goals
 * gallery").
 *
 * One row per goal from the save's goal log (lib/star/goalLog.ts): a small
 * picture, the minute, who against, the competition, the season and the
 * score. Tap a goal: its video plays when this phone recorded it
 * (GoalClipViewer), otherwise its facts card shows.
 *
 * The small picture is a still from the recording when this phone has it,
 * drawn only when the row comes on screen, one at a time. Without one it is
 * a little half pitch with a dot where the shot was hit from (when the
 * distance is known), or a card in the club's colours.
 *
 * Fast with 600 goals: rows are plain, only ~100 are put on the page at
 * first (more as you scroll), and stills are drawn once and kept.
 *
 * Also exported: BestGoalsList, the Hall of Fame's "Best goals".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { bestGoals, goalHowLabel, type CareerGoal } from "@/lib/star/goalLog";
import { useLeoUpdate } from "@/lib/star/leoUpdate";
import { getClip, listClips } from "@/lib/star/goalClip/store";
import { makeEdit, posterMoment } from "@/lib/star/goalClip/edit";
import { drawEditFrame, prepareClipSprites } from "@/lib/star/goalClip/render";
import { useAnimationsLook } from "@/lib/star/animLook";
import { seasonLabelOf } from "@/lib/star/goalClip/reel";

/** "2026/27" and "26/27", from the game's own calendar (the reel uses the same). */
const longSeason = (startYear: number, season: number): string => seasonLabelOf(startYear, season);
const shortSeason = (startYear: number, season: number): string => seasonLabelOf(startYear, season).slice(2);
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import GoalClipViewer from "./GoalClipViewer";
import { ClubCard, useClubTheme, rgba } from "./ui";
import { CardTitle } from "./screenKit";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "").replace(/^(FC|AFC)\s+/i, "");
const GOLD = "#fbbf24";
/** Rows put on the page at first, and how many more each time you reach the end. */
const PAGE = 100;

// ── Words ────────────────────────────────────────────────────────────────────

/** "won 3-1" / "drew 2-2" / "lost 1-2" from a "yours-theirs" score. */
export function resultWords(score: string): string {
  const [us, them] = score.split("-").map(Number);
  if (!Number.isFinite(us) || !Number.isFinite(them)) return score;
  return `${us > them ? "won" : us < them ? "lost" : "drew"} ${score}`;
}

/** "34' v Arsenal (H)". */
export function goalHeadline(g: CareerGoal): string {
  return `${g.minute}' v ${short(g.opponent)} (${g.home ? "H" : "A"})`;
}

/** Small tags: "25 m", "Chip", "Curler", "Free kick". */
function goalTags(g: CareerGoal): string[] {
  const t: string[] = [];
  if (typeof g.distance === "number") t.push(`${Math.round(g.distance)} m`);
  if (g.finish === "chip") t.push("Chip");
  if (g.finish === "curl") t.push("Curler");
  const how = (g.how ?? "").toLowerCase();
  if (how.includes("pen")) t.push("Penalty");
  else if (how.includes("free")) t.push("Free kick");
  else if (how.includes("header")) t.push("Header");
  else if (how.includes("volley")) t.push("Volley");
  return t;
}

// ── Which recordings are on this phone ──────────────────────────────────────

/** The recordings on this phone, read once per visit (null while reading). */
function useClipsHere(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let live = true;
    listClips().then(l => { if (live) setIds(new Set(l.map(c => c.id))); }).catch(() => { if (live) setIds(new Set()); });
    return () => { live = false; };
  }, []);
  return ids;
}

// ── The small picture ────────────────────────────────────────────────────────

/** Stills already drawn this session (a picture, or null = no recording here). */
const stills = new Map<string, string | null>();
const stillJobs: (() => Promise<void>)[] = [];
let stillBusy = false;
/** One still at a time, with a breath between, so scrolling stays smooth. */
function pumpStills(): void {
  if (stillBusy || !stillJobs.length) return;
  stillBusy = true;
  const job = stillJobs.shift()!;
  job().finally(() => { stillBusy = false; setTimeout(pumpStills, 16); });
}

async function drawStill(clipId: string, moves: "new" | "old"): Promise<string | null> {
  if (stills.has(clipId)) return stills.get(clipId)!;
  const track = await getClip(clipId);
  if (!track) { stills.set(clipId, null); return null; }
  try {
    const edit = makeEdit([track], "broadcast", moves);
    await prepareClipSprites(edit.moves);
    const big = document.createElement("canvas");
    big.width = edit.w; big.height = edit.h;
    const bctx = big.getContext("2d");
    if (!bctx) { stills.set(clipId, null); return null; }
    drawEditFrame(bctx, edit, 0, undefined, posterMoment(edit));
    // Kept small: 192 × 108 is sharp at 96 px on a phone.
    const small = document.createElement("canvas");
    small.width = 192; small.height = 108;
    const sctx = small.getContext("2d");
    if (!sctx) { stills.set(clipId, null); return null; }
    sctx.drawImage(big, 0, 0, small.width, small.height);
    const url = small.toDataURL("image/jpeg", 0.72);
    stills.set(clipId, url);
    return url;
  } catch {
    stills.set(clipId, null);
    return null;
  }
}

/** A number from a string, to place a dot the same way every time. */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/**
 * A little half pitch, goal at the top, with a dot where it was hit from.
 * The angle is not saved, so it is picked from the goal's id: the distance is
 * true, the side is not.
 */
export function MiniPitch({ goal, className = "" }: { goal: CareerGoal; className?: string }) {
  const d = Math.max(3, Math.min(38, goal.distance ?? 12));
  const pen = (goal.how ?? "").toLowerCase().includes("pen");
  const a = pen ? 0 : (seedOf(goal.id) - 0.5) * Math.min(1.5, 22 / d);
  const x = Math.max(4, Math.min(64, 34 + Math.sin(a) * d));
  const y = Math.max(3, Math.min(37, Math.cos(a) * d));
  const line = "rgba(255,255,255,.55)";
  return (
    <svg viewBox="0 0 68 40" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="68" height="40" fill="#1f6b3a" />
      {[0, 2, 4, 6].map(k => <rect key={k} y={k * 7} width="68" height="3.5" fill="rgba(255,255,255,.05)" />)}
      <rect x="13.8" y="0" width="40.3" height="16.5" fill="none" stroke={line} strokeWidth=".5" />
      <rect x="24.8" y="0" width="18.3" height="5.5" fill="none" stroke={line} strokeWidth=".5" />
      <circle cx="34" cy="11" r=".6" fill={line} />
      <rect x="30.3" y="0" width="7.3" height="1.4" fill="#fff" />
      <line x1={x} y1={y} x2="34" y2="0.8" stroke="rgba(253,224,71,.85)" strokeWidth=".7" strokeDasharray="1.4 1" />
      <circle cx={x} cy={y} r="2" fill="#fde047" stroke="#111827" strokeWidth=".6" />
    </svg>
  );
}

/** No distance: a card in the club's colours with the minute on it. */
function ClubTile({ goal, className = "" }: { goal: CareerGoal; className?: string }) {
  const k = kitsOf(goal.club).home;
  return (
    <div className={`grid place-items-center ${className}`} style={{ background: `linear-gradient(135deg, ${k.shirt}, ${k.trim})` }}>
      <span className="text-[15px] font-black tabular-nums text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>⚽ {goal.minute}&apos;</span>
    </div>
  );
}

/** The row's picture: the recording's still when this phone has it. */
function GoalThumb({ goal, here }: { goal: CareerGoal; here: boolean }) {
  const moves = useAnimationsLook();
  const box = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState<string | null>(goal.clipId ? stills.get(goal.clipId) ?? null : null);
  useEffect(() => {
    const id = goal.clipId;
    if (!id || !here || stills.has(id)) return;
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let live = true;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      stillJobs.push(async () => {
        if (!live) return;
        const url = await drawStill(id, moves);
        if (live) setStill(url);
      });
      pumpStills();
    }, { rootMargin: "200px 0px" });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [goal.clipId, here, moves]);
  const cls = "absolute inset-0 h-full w-full";
  return (
    <div ref={box} className="relative h-[54px] w-[96px] shrink-0 overflow-hidden" style={{ borderRadius: 3, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
      {still
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={still} alt="" className={`${cls} object-cover`} />
        : typeof goal.distance === "number" ? <MiniPitch goal={goal} className={cls} /> : <ClubTile goal={goal} className={cls} />}
      {here && (
        <span className="absolute bottom-0.5 right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] text-gray-950" style={{ background: GOLD }} aria-label="Video on this phone">▶</span>
      )}
    </div>
  );
}

// ── A row ────────────────────────────────────────────────────────────────────

function GoalRow({ goal, startYear, here, rank, onOpen }: {
  goal: CareerGoal; startYear: number; here: boolean; rank?: number; onOpen: () => void;
}) {
  const tags = goalTags(goal);
  return (
    <button onClick={onOpen} className="kib-press flex w-full items-center gap-2.5 px-2 py-1.5 text-left" style={{ background: "rgba(255,255,255,.035)" }} data-goal-row={goal.id}>
      {rank !== undefined && <span className="sk-num w-5 shrink-0 text-center text-[17px] tabular-nums text-amber-300">{rank}</span>}
      <GoalThumb goal={goal} here={here} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-black leading-tight text-white">{goalHeadline(goal)}</div>
        <div className="truncate text-[11px] font-bold text-white/70">
          {goal.competition} · {shortSeason(startYear, goal.season)} · {resultWords(goal.score)}
        </div>
        {tags.length > 0 && (
          <div className="mt-0.5 flex gap-1">
            {tags.map(t => <span key={t} className="px-1 text-[9.5px] font-black uppercase tracking-wide text-amber-200" style={{ background: "rgba(251,191,36,.14)", borderRadius: 2 }}>{t}</span>)}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Tapped: the video, or the facts ──────────────────────────────────────────

/** Full-screen sheets go on the page itself, so a moving card above them
 *  (the Stats page's rise-in) cannot pin them inside it. */
function onTop(node: React.ReactElement): React.ReactElement {
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

function FactsCard({ goal, startYear, note, picture = true }: { goal: CareerGoal; startYear: number; note?: string; picture?: boolean }) {
  const bugFixesOn = useLeoUpdate("bugFixes");
  const facts: [string, string][] = [
    ["Minute", `${goal.minute}'`],
    ["Against", `${goal.opponent} (${goal.home ? "home" : "away"})`],
    ["For", goal.club],
    ["Competition", goal.competition],
    ["Season", longSeason(startYear, goal.season)],
    ["Result", resultWords(goal.score)],
  ];
  if (typeof goal.distance === "number") facts.push(["Distance", `${Math.round(goal.distance)} m`]);
  if (goal.finish) facts.push(["Finish", goal.finish === "chip" ? "Chip" : "Curler"]);
  if (goal.how) facts.push(["How", bugFixesOn ? goalHowLabel(goal.how) : goal.how]);
  if (goal.assist) facts.push(["Assist", goal.assist]);
  return (
    <div data-goal-facts>
      {picture && (
        <div className="relative mb-2 aspect-video w-full overflow-hidden" style={{ borderRadius: 4 }}>
          {typeof goal.distance === "number"
            ? <MiniPitch goal={goal} className="absolute inset-0 h-full w-full" />
            : <ClubTile goal={goal} className="absolute inset-0 h-full w-full" />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 px-2 py-1" style={{ background: "rgba(255,255,255,.05)" }}>
            <div className="text-[9px] font-black uppercase tracking-wider text-white/55">{k}</div>
            <div className="truncate text-[13px] font-black text-white">{v}</div>
          </div>
        ))}
      </div>
      {note && <div className="mt-2 text-[11px] font-bold text-white/60">{note}</div>}
    </div>
  );
}

/** Full screen over the list: the goal's video (this phone) or its facts. */
export function GoalSheet({ goal, startYear, here, onClose }: { goal: CareerGoal; startYear: number; here: boolean; onClose: () => void }) {
  const title = `${goalHeadline(goal)} · ${goal.competition}`;
  const away = goal.clipId && !here
    ? "Its video is on the phone that recorded it."
    : !goal.clipId ? "No video of this one: it was not recorded." : undefined;
  const facts = <FactsCard goal={goal} startYear={startYear} note={away} />;
  return onTop(
    <div className="fixed inset-0 z-[80] overflow-y-auto px-3 pb-6 pt-3" style={{ background: "#05080f" }} role="dialog" aria-label={title} data-goal-sheet>
      <div className="mx-auto max-w-[480px]">
        <div className="mb-2 flex items-center gap-2">
          <button onClick={onClose} className="kib-press grid h-9 w-9 shrink-0 place-items-center text-[20px] font-black text-white" style={{ background: "rgba(255,255,255,.08)", borderRadius: 4 }} aria-label="Close">✕</button>
          <div className="min-w-0">
            <div className="truncate text-[16px] font-black text-white">{goalHeadline(goal)}</div>
            <div className="truncate text-[11px] font-bold text-white/65">{goal.competition} · {longSeason(startYear, goal.season)} · {resultWords(goal.score)}</div>
          </div>
        </div>
        {here && goal.clipId
          ? (
            <>
              <GoalClipViewer clipId={goal.clipId} title={title} fallback={facts} />
              <div className="mt-3"><FactsCard goal={goal} startYear={startYear} picture={false} /></div>
            </>
          )
          : facts}
      </div>
    </div>
  );
}

// ── The gallery ──────────────────────────────────────────────────────────────

type Filter = "all" | "best" | "video" | `comp:${string}`;

export default function CareerGoalsGallery({ career, goals: given }: {
  career: CareerState;
  /** A different list (the test page); otherwise the career's own log. */
  goals?: CareerGoal[];
}) {
  const goals = useMemo(() => given ?? career.goalLog ?? [], [given, career.goalLog]);
  const startYear = career.player.startYear ?? 2027;
  const { glow } = useClubTheme(career);
  const here = useClipsHere();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<CareerGoal | null>(null);
  const [shown, setShown] = useState(PAGE);

  const comps = useMemo(() => {
    const n = new Map<string, number>();
    for (const g of goals) n.set(g.competition, (n.get(g.competition) ?? 0) + 1);
    return Array.from(n.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [goals]);

  const isHere = (g: CareerGoal) => !!g.clipId && !!here?.has(g.clipId);
  const videos = here ? goals.filter(isHere).length : 0;

  const list = useMemo(() => {
    if (filter === "best") return bestGoals(goals, 10);
    let l = goals;
    if (filter === "video") l = l.filter(g => g.clipId && here?.has(g.clipId));
    else if (filter.startsWith("comp:")) l = l.filter(g => g.competition === filter.slice(5));
    // Newest first: the log is in the order they were scored.
    return [...l].reverse();
  }, [goals, filter, here]);

  // More rows when the end of the list comes near.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { setShown(PAGE); }, [filter]);
  useEffect(() => {
    const el = end.current;
    if (!el || shown >= list.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e.some(x => x.isIntersecting)) setShown(s => s + PAGE); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, list.length]);

  const perSeason = useMemoCounts(list);

  if (goals.length === 0) {
    return (
      <ClubCard glow={glow} className="mt-2 p-4 text-center" data-goals-empty>
        <div className="text-[30px]">⚽</div>
        <div className="mt-1 text-[15px] font-black text-white">Your goals are listed from now on</div>
        <div className="mt-1 text-[12px] font-bold text-white/65">Every goal you score from here lands on this page, with its video when this phone records it.</div>
      </ClubCard>
    );
  }

  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `All ${goals.length}` },
    { id: "best", label: "Best 10" },
    ...(videos > 0 ? [{ id: "video" as Filter, label: `▶ Videos ${videos}` }] : []),
    ...comps.map(c => ({ id: `comp:${c}` as Filter, label: c })),
  ];

  // Grouped by season (the Best 10 is one ranked list).
  const visible = list.slice(0, shown);
  const groups: { season: number; goals: CareerGoal[] }[] = [];
  if (filter !== "best") {
    for (const g of visible) {
      const last = groups[groups.length - 1];
      if (last && last.season === g.season) last.goals.push(g);
      else groups.push({ season: g.season, goals: [g] });
    }
  }
  return (
    <div className="min-w-0" data-career-goals>
      <div className="-mx-1 mb-1.5 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Which goals">
        {chips.map(c => {
          const on = c.id === filter;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(c.id)}
              className="kib-press shrink-0 px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-wide"
              style={{ borderRadius: 3, background: on ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.07)", color: on ? "#111827" : "rgba(255,255,255,.88)" }}
              data-goals-filter={c.id}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {filter === "best" ? (
        <ClubCard glow={glow} className="p-2">
          <CardTitle className="mb-1.5">Best 10 · these go into the Hall of Fame</CardTitle>
          <div className="space-y-1">
            {list.map((g, k) => <GoalRow key={g.id} goal={g} startYear={startYear} here={isHere(g)} rank={k + 1} onOpen={() => setOpen(g)} />)}
          </div>
        </ClubCard>
      ) : list.length === 0 ? (
        <div className="py-6 text-center text-[12px] font-bold text-white/60">No goals here yet.</div>
      ) : (
        <div className="space-y-2">
          {groups.map(gr => (
            <ClubCard key={gr.season} glow={glow} className="p-2" style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${gr.goals.length * 66 + 30}px` }}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <CardTitle>{longSeason(startYear, gr.season)}</CardTitle>
                <span className="text-[10px] font-black uppercase tracking-wider text-white/55">{perSeason.get(gr.season) ?? gr.goals.length} goals · {short(gr.goals[0].club)}</span>
              </div>
              <div className="space-y-1">
                {gr.goals.map(g => <GoalRow key={g.id} goal={g} startYear={startYear} here={isHere(g)} onOpen={() => setOpen(g)} />)}
              </div>
            </ClubCard>
          ))}
          {shown < list.length && <div ref={end} className="h-10 text-center text-[11px] font-bold text-white/50">More goals…</div>}
        </div>
      )}

      <div className="mt-2 px-1 text-[10.5px] font-bold text-white/50" data-goals-note>
        ▶ = video on this phone. Videos stay on the phone that recorded them; on another phone a goal shows its picture and facts.
      </div>

      {open && <GoalSheet goal={open} startYear={startYear} here={isHere(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Goals per season in the whole filtered list (a group on screen may be cut short). */
function useMemoCounts(list: CareerGoal[]): Map<number, number> {
  return useMemo(() => {
    const m = new Map<number, number>();
    for (const g of list) m.set(g.season, (m.get(g.season) ?? 0) + 1);
    return m;
  }, [list]);
}

// ── The Hall of Fame's "Best goals" ─────────────────────────────────────────

/**
 * A finished career's best goals (the Hall keeps 10, lib/star/hallOfFame.ts
 * slimCareer). Tap one: its video when this phone has it, else its facts.
 */
export function BestGoalsList({ career }: { career: CareerState }) {
  const goals = useMemo(() => bestGoals(career.goalLog ?? [], 10), [career.goalLog]);
  const here = useClipsHere();
  const [open, setOpen] = useState<CareerGoal | null>(null);
  const startYear = career.player.startYear ?? 2027;
  const isHere = (g: CareerGoal) => !!g.clipId && !!here?.has(g.clipId);
  return (
    <div data-best-goals>
      {goals.length === 0 ? (
        <div className="py-4 text-center text-[12px] font-bold text-white/60">This career ended before goals were listed.</div>
      ) : (
        <div className="space-y-1">
          {goals.map((g, k) => <GoalRow key={g.id} goal={g} startYear={startYear} here={isHere(g)} rank={k + 1} onOpen={() => setOpen(g)} />)}
        </div>
      )}
      {goals.length > 0 && (
        <div className="mt-2 text-[10.5px] font-bold text-white/50">▶ = video on this phone. Videos stay on the phone that recorded them.</div>
      )}
      {open && <GoalSheet goal={open} startYear={startYear} here={isHere(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The Hall of Fame's sheet: a career's best goals over its overview. */
export function BestGoalsSheet({ career, onClose }: { career: CareerState; onClose: () => void }) {
  return onTop(
    <div className="fixed inset-0 z-[70] overflow-y-auto px-3 pb-6 pt-3" style={{ background: "#05080f" }} role="dialog" aria-label="Best goals" data-best-goals-sheet>
      <div className="mx-auto max-w-[480px]">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onClose} className="kib-press grid h-9 w-9 shrink-0 place-items-center text-[20px] font-black text-white" style={{ background: "rgba(255,255,255,.08)", borderRadius: 4 }} aria-label="Close">✕</button>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">{career.player.firstName} {career.player.lastName}</div>
            <div className="text-[22px] font-black uppercase leading-none text-white">Best <span style={{ color: GOLD }}>goals</span></div>
          </div>
        </div>
        <div className="p-2" style={{ background: rgba(GOLD, 0.06), boxShadow: `inset 0 0 0 1px ${rgba(GOLD, 0.25)}` }}>
          <BestGoalsList career={career} />
        </div>
      </div>
    </div>
  );
}
