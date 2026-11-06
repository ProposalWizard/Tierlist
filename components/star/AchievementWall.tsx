"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, type Achievement, type AchievementTier } from "@/lib/star/achievements";
import { formatMoney } from "@/lib/star/money";
import { achievementXp } from "@/lib/star/xpConfig";

/**
 * THE TROPHY WALL (Mikey, 3 Nov 2026: design A with "Nearly there"). Every
 * completed achievement is a gold medal, whatever its tier; the tier is the
 * medal's rim and its label. Not completed: a dark medal with a padlock and,
 * where there is a number to chase, how far along you are. A ring at the top
 * counts them; "Nearly there" shows the three closest; tap any medal for its
 * detail. Filters: All · Completed · Not completed · Nearly there.
 */

const TIER: Record<AchievementTier, { label: string; rim: string; ink: string }> = {
  easy: { label: "Bronze", rim: "#cd7f32", ink: "#f2b27a" },
  medium: { label: "Silver", rim: "#d9dee5", ink: "#e5e9ef" },
  hard: { label: "Gold", rim: "#fbbf24", ink: "#fde68a" },
  legendary: { label: "Legend", rim: "#c084fc", ink: "#ddb8ff" },
};
const TIERS: AchievementTier[] = ["easy", "medium", "hard", "legendary"];
const GOLD_TEXT: React.CSSProperties = {
  background: "linear-gradient(180deg,#fff7c2,#fde047 40%,#f59e0b 75%,#b45309)",
  WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
};

type Filter = "all" | "done" | "todo" | "near";
/** How far along counts as "nearly there". */
const NEAR = 0.5;

const shortMoney = (v: number) => (v >= 1_000_000 ? `★${+(v / 1_000_000).toFixed(1)}m` : v >= 1_000 ? `★${Math.floor(v / 1_000)}k` : `★${formatMoney(v)}`);
const progressOf = (a: Achievement, c: CareerState): [number, number] | null => {
  if (!a.progress) return null;
  try { return a.progress(c); } catch { return null; }
};
const fmt = (a: Achievement, v: number) => (a.money ? shortMoney(v) : v.toLocaleString("en-GB"));

function Medal({ a, size, done }: { a: Achievement; size: number; done: boolean }) {
  const t = TIER[a.tier];
  if (!done) {
    return (
      <div className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: "radial-gradient(circle at 35% 30%,#2a3530 0,#17201b 70%)", boxShadow: "inset 0 0 0 3px rgba(255,255,255,.08)" }}>
        <span style={{ fontSize: size * 0.42, opacity: 0.28, filter: "grayscale(1)" }}>{a.icon}</span>
        <span className="absolute -bottom-0.5 -right-0.5" style={{ fontSize: size * 0.26 }}>🔒</span>
      </div>
    );
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-full" style={{
      width: size, height: size,
      background: "radial-gradient(circle at 35% 28%,#fff8c9 0,#fde047 22%,#f5b70b 55%,#b45309 100%)",
      boxShadow: `0 0 0 3px ${t.rim}, 0 0 18px -2px rgba(251,191,36,.75), inset 0 -6px 10px rgba(146,64,14,.55), inset 0 4px 8px rgba(255,255,255,.55)`,
    }}>
      <span style={{ fontSize: size * 0.44 }}>{a.icon}</span>
    </div>
  );
}

/** The gold medal for an achievement found by its label (the pop-ups only
 *  know the label). Anything not on the list — a first step — gets null. */
export function AchievementMedal({ label, size = 56 }: { label: string; size?: number }) {
  const a = ACHIEVEMENTS.find(x => x.label === label);
  if (!a) return null;
  return (
    <span className="inline-flex flex-col items-center">
      <Medal a={a} size={size} done />
      <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: TIER[a.tier].ink }}>{TIER[a.tier].label}</span>
    </span>
  );
}

function Bar({ have, need, h = 5 }: { have: number; need: number; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/12" style={{ height: h, background: "rgba(0,0,0,.45)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(3, (100 * have) / Math.max(1, need))}%`, background: "linear-gradient(90deg,#f59e0b,#fde047)" }} />
    </div>
  );
}

function Ring({ got, total }: { got: number; total: number }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <div className="relative h-[108px] w-[108px] shrink-0">
      <svg width={108} height={108} aria-hidden>
        <defs><linearGradient id="ach-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff7c2" /><stop offset=".5" stopColor="#fde047" /><stop offset="1" stopColor="#f59e0b" /></linearGradient></defs>
        <circle cx={54} cy={54} r={r} stroke="rgba(0,0,0,.45)" strokeWidth={10} fill="none" />
        <circle cx={54} cy={54} r={r} stroke="url(#ach-ring)" strokeWidth={10} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * got) / Math.max(1, total)} ${c}`} transform="rotate(-90 54 54)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span>
          <b className="block text-[26px] font-black leading-none" style={GOLD_TEXT}>{got}/{total}</b>
          <span className="block text-[9.5px] font-black tracking-[0.12em] text-amber-200">{Math.round((100 * got) / Math.max(1, total))}% DONE</span>
        </span>
      </div>
    </div>
  );
}

export default function AchievementWall({ career, top }: { career: CareerState; top?: React.ReactNode }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Achievement | null>(null);
  const done = useMemo(() => new Set(career.achievements ?? []), [career.achievements]);
  const got = ACHIEVEMENTS.filter(a => done.has(a.id)).length;
  const near = useMemo(() => ACHIEVEMENTS
    .filter(a => !done.has(a.id))
    .map(a => ({ a, p: progressOf(a, career) }))
    // "Nearly there" means at least half-way (one rule for the strip and the filter).
    .filter((x): x is { a: Achievement; p: [number, number] } => !!x.p && x.p[0] < x.p[1] && x.p[0] / x.p[1] >= NEAR)
    .sort((x, y) => y.p[0] / y.p[1] - x.p[0] / x.p[1]), [career, done]);
  const nearIds = new Set(near.map(x => x.a.id));
  const shown = (a: Achievement) =>
    filter === "all" || (filter === "done" ? done.has(a.id) : filter === "todo" ? !done.has(a.id) : nearIds.has(a.id));

  return (
    <div data-achievement-list className="pb-12">
      {top}
      {/* The ring and the four tiers. */}
      <div className="flex items-center gap-4 rounded-[18px] p-4" style={{ background: "linear-gradient(135deg,rgba(253,224,71,.22),rgba(245,158,11,.08) 60%,rgba(0,0,0,.2))", boxShadow: "inset 0 0 0 1.5px rgba(253,224,71,.55)" }}>
        <Ring got={got} total={ACHIEVEMENTS.length} />
        <div className="grid min-w-0 flex-1 gap-[7px]">
          {TIERS.map(t => {
            const all = ACHIEVEMENTS.filter(a => a.tier === t);
            const g = all.filter(a => done.has(a.id)).length;
            return (
              <div key={t} className="flex items-center gap-[7px] text-[12px] font-extrabold text-white" data-ach-tier={t}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: TIER[t].rim }} />
                <span className="w-[50px] shrink-0">{TIER[t].label}</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.4)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${(100 * g) / Math.max(1, all.length)}%`, background: TIER[t].rim }} />
                </span>
                <span className="w-[38px] shrink-0 text-right tabular-nums text-amber-200">{g}/{all.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nearly there: the three you are closest to. */}
      {near.length > 0 && (
        <div className="mt-3" data-ach-near>
          <div className="mb-2 px-1 text-[11px] font-black tracking-[0.2em] text-amber-300">NEARLY THERE</div>
          {near.slice(0, 3).map(({ a, p }) => (
            <button key={a.id} type="button" onClick={() => setOpen(a)} className="kib-press mb-1.5 flex w-full items-center gap-2.5 rounded-xl bg-white/[0.06] p-2.5 text-left">
              <Medal a={a} size={40} done={false} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[13px] font-black text-white">
                  <span className="truncate">{a.label}</span>
                  <span className="shrink-0 tabular-nums text-amber-200">{fmt(a, p[0])}/{fmt(a, p[1])}</span>
                </div>
                <div className="mt-1.5"><Bar have={p[0]} need={p[1]} h={6} /></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filters. */}
      <div className="mt-3 flex flex-wrap gap-1.5" data-ach-filters>
        {([["all", "All"], ["done", "Completed"], ["todo", "Not completed"], ["near", "Nearly there"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} data-ach-filter={k}
            className="kib-press rounded-full px-3 py-1.5 text-[11px] font-black"
            style={filter === k ? { background: "linear-gradient(180deg,#fde047,#f59e0b)", color: "#2a1700" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.88)" }}>{l}</button>
        ))}
      </div>

      {/* The wall, group by group. */}
      {ACHIEVEMENT_GROUPS.map(g => {
        const all = ACHIEVEMENTS.filter(a => a.group === g);
        const list = all.filter(shown);
        if (!list.length) return null;
        const n = all.filter(a => done.has(a.id)).length;
        return (
          <div key={g} data-ach-group={g}>
            <div className="flex items-baseline justify-between px-1 pb-2 pt-4">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{g}</span>
              <span className="text-[11px] font-black tabular-nums text-amber-300">{n} / {all.length}{n === all.length ? "  ✓ COMPLETE" : ""}</span>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3.5">
              {list.map(a => {
                const isDone = done.has(a.id);
                const p = isDone ? null : progressOf(a, career);
                return (
                  <button key={a.id} type="button" onClick={() => setOpen(a)} data-ach={a.id} data-ach-done={isDone || undefined}
                    className="kib-press flex min-w-0 flex-col items-center text-center">
                    <Medal a={a} size={62} done={isDone} />
                    <b className="mt-[7px] line-clamp-2 text-[11px] font-black leading-tight" style={{ color: isDone ? "#fde68a" : "rgba(255,255,255,.72)" }}>{a.label}</b>
                    {p ? (
                      <>
                        <span className="mt-0.5 text-[9.5px] font-extrabold tabular-nums text-white/60">{fmt(a, p[0])}/{fmt(a, p[1])}</span>
                        <span className="mt-1 w-[62px]"><Bar have={p[0]} need={p[1]} /></span>
                      </>
                    ) : (
                      <span data-ach-rarity className="mt-0.5 text-[9.5px] font-extrabold" style={{ color: TIER[a.tier].ink }}>{TIER[a.tier].label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {open && <Detail a={open} career={career} done={done.has(open.id)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One medal, tapped: what it is, its tier, and how far along you are. */
function Detail(props: { a: Achievement; career: CareerState; done: boolean; onClose: () => void }) {
  // On the body: the Stats page slides sideways (a transform), which would
  // carry a fixed panel off the screen with it.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(<DetailSheet {...props} />, host) : null;
}

function DetailSheet({ a, career, done, onClose }: { a: Achievement; career: CareerState; done: boolean; onClose: () => void }) {
  const p = done ? null : progressOf(a, career);
  const t = TIER[a.tier];
  const ofTier = ACHIEVEMENTS.filter(x => x.tier === a.tier).length;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={a.label} data-ach-detail={a.id}>
      <div className="w-full max-w-md rounded-t-[22px] px-5 pb-10 pt-5 text-center" style={{ background: "linear-gradient(180deg,#1b2a21,#0b1510)", boxShadow: "0 -10px 40px rgba(0,0,0,.6)" }} onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-white/25" />
        <div className="flex justify-center"><Medal a={a} size={104} done={done} /></div>
        <div className="mt-3 text-[10px] font-black tracking-[0.2em]" style={{ color: t.rim }}>{t.label.toUpperCase()} · {a.group.toUpperCase()}</div>
        <div className="mt-1 text-[26px] font-black uppercase leading-tight" style={done ? GOLD_TEXT : { color: "#fff" }}>{a.label}</div>
        <div className="mt-1 text-[14px] text-white/85">{a.description}</div>
        {done && <div className="mt-3 text-[13px] font-black text-amber-200">✓ Completed</div>}
        {p && (
          <div className="mx-auto mt-4 max-w-[280px]">
            <div className="flex justify-between text-[12px] font-black text-white"><span>{fmt(a, p[0])}</span><span className="text-amber-200">{fmt(a, p[1])}</span></div>
            <div className="mt-1.5"><Bar have={p[0]} need={p[1]} h={10} /></div>
            <div className="mt-2 text-[11.5px] text-white/75">{fmt(a, p[1] - p[0])} to go</div>
          </div>
        )}
        <div className="mt-4 text-[13px] font-black text-amber-200">{done ? "Earned" : "Worth"} +{achievementXp(a.id).toLocaleString("en-GB")} XP</div>
        <div className="mt-1 text-[11px] font-extrabold text-white/60">One of {ofTier} {t.label} achievements</div>
        <button type="button" onClick={onClose} className="kib-press mt-4 rounded-full bg-white/10 px-5 py-2 text-[13px] font-black text-white">Close</button>
      </div>
    </div>
  );
}
