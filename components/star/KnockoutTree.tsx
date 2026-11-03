"use client";
import { useState } from "react";
import { koAggregate, type EuroBracket } from "@/lib/star/euroBracket";
import type { CupState } from "@/lib/star/cups";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
import { ClubCard, rgba } from "./ui";
import { CardTitle, youRowStyle } from "./screenKit";

/**
 * THE KNOCKOUT TREE (Mikey, 2 Nov 2026, option B of the knockout plan): the
 * last 16 to the final in four equal columns (the domestic cups: the last 8
 * to the final in three). Each box shows both clubs and their score; a name
 * that is too long is cut, the score never is. Tap a box for the full names,
 * both legs and penalties. Ties not drawn yet show "?".
 *
 * Column k+1's tie j is fed by column k's ties 2j and 2j+1 (the UEFA bracket
 * is built that way; the cups are put in that order by `cupTreeColumns`).
 */

export interface TreeTie { a?: string; b?: string; sa?: number; sb?: number; winner?: string; note?: string }
export interface TreeColumn { name: string; ties: TreeTie[] }

const BOX_H = 40;
const ROW_GAP = 8;

export function KnockoutTree({ columns, glow, you }: { columns: TreeColumn[]; glow: string; you: string }) {
  const [pick, setPick] = useState<{ c: number; t: number } | null>(null);
  const first = Math.max(1, columns[0]?.ties.length ?? 1);
  const height = first * (BOX_H + ROW_GAP);
  const n = columns.length;
  const GAP = 2; // % between columns
  const colW = (100 - GAP * (n - 1)) / n;
  const x = (c: number) => c * (colW + GAP);
  const centreY = (c: number, t: number) => {
    const slots = first / Math.max(1, columns[c].ties.length);
    return (t + 0.5) * slots * (BOX_H + ROW_GAP);
  };
  const picked = pick ? columns[pick.c]?.ties[pick.t] : null;

  return (
    <div className="space-y-2" data-knockout-tree>
      <ClubCard glow={glow} className="px-1 py-2">
        <div className="relative mb-1 flex text-[9px] font-black uppercase tracking-[0.12em] text-amber-300">
          {columns.map((col, c) => (
            <div key={col.name} className="truncate text-center" style={{ width: `${colW}%`, marginLeft: c ? `${GAP}%` : 0 }}>{label(col.name)}</div>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
            {columns.slice(1).map((col, ci) => col.ties.map((_, t) => {
              const c = ci + 1;
              const x0 = x(c - 1) + colW, x1 = x(c), xm = (x0 + x1) / 2, y = centreY(c, t);
              return [2 * t, 2 * t + 1].map(k => (
                <path key={`${c}-${t}-${k}`} d={`M${x0} ${centreY(c - 1, k)}H${xm}V${y}H${x1}`} stroke="rgba(255,255,255,.28)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" />
              ));
            }))}
          </svg>
          {columns.map((col, c) => col.ties.map((tie, t) => {
            const mine = tie.a === you || tie.b === you;
            const on = pick?.c === c && pick.t === t;
            return (
              <button
                key={`${c}-${t}`}
                type="button"
                onClick={() => setPick(on ? null : { c, t })}
                disabled={!tie.a && !tie.b}
                className="absolute flex flex-col justify-center gap-[2px] rounded-md px-[3px] text-left"
                style={{
                  left: `${x(c)}%`, width: `${colW}%`, top: centreY(c, t) - BOX_H / 2, height: BOX_H,
                  background: on ? rgba(glow, 0.45) : "rgba(255,255,255,.08)",
                  boxShadow: `inset 0 0 0 1px ${mine ? "#fde047" : "rgba(255,255,255,.16)"}`,
                }}
                data-tree-tie={`${col.name}:${t}`}
              >
                <Side club={tie.a} score={tie.sa} won={!tie.winner || tie.winner === tie.a} />
                <Side club={tie.b} score={tie.sb} won={!tie.winner || tie.winner === tie.b} />
              </button>
            );
          }))}
        </div>
      </ClubCard>
      {picked && picked.a && picked.b && (
        <ClubCard glow={glow} className="p-1.5">
          <CardTitle className="px-1 pb-1" tone="text-amber-300">{columns[pick!.c].name}</CardTitle>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[12px] font-bold text-white" style={picked.a === you || picked.b === you ? youRowStyle(glow) : { background: "rgba(255,255,255,.04)" }}>
            <span className={`flex min-w-0 items-center justify-end gap-1 ${picked.winner === picked.a ? "font-black" : "text-white/75"}`}><span className="truncate">{shortClub(picked.a)}</span><ClubBadge club={picked.a} size={16} /></span>
            <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{picked.sa !== undefined ? `${picked.sa}-${picked.sb}` : "v"}</span>
            <span className={`flex min-w-0 items-center gap-1 ${picked.winner === picked.b ? "font-black" : "text-white/75"}`}><ClubBadge club={picked.b} size={16} /><span className="truncate">{shortClub(picked.b)}</span></span>
            {picked.note && <span className="col-span-3 text-center text-[10px] font-bold text-amber-200">{picked.note}</span>}
          </div>
        </ClubCard>
      )}
    </div>
  );
}

function Side({ club, score, won }: { club?: string; score?: number; won: boolean }) {
  return (
    <span className={`flex min-w-0 items-center gap-[3px] text-[9.5px] leading-none tracking-[-0.01em] ${won ? "font-black text-white" : "font-bold text-white/45"}`}>
      {club ? <ClubBadge club={club} size={11} /> : <span className="inline-block h-[11px] w-[11px] shrink-0 rounded-full bg-white/15" />}
      <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap" style={{ WebkitMaskImage: "linear-gradient(90deg,#000 82%,transparent)", maskImage: "linear-gradient(90deg,#000 82%,transparent)" }}>{club ? shortClub(club) : "?"}</span>
      {score !== undefined && <span className="shrink-0 tabular-nums">{score}</span>}
    </span>
  );
}

const label = (name: string) =>
  name === "Round of 16" ? "Last 16" : name === "Quarter-Final" ? "Quarters" : name === "Semi-Final" ? "Semis" : name;

// ── Europe ──────────────────────────────────────────────────────────────────

/** A UEFA tie for the tree: aggregate score, both legs and penalties in the note. */
export function euroTreeTie(t: EuroBracket["rounds"][number]["ties"][number]): TreeTie {
  const agg = koAggregate(t);
  const legs = t.legs.length > 1 ? t.legs.map(l => `${l.a}-${l.b}`).join(" · ") : "";
  const pens = t.pens ? `${t.pens.a}-${t.pens.b} on penalties` : "";
  return { a: t.a, b: t.b, sa: agg?.a, sb: agg?.b, winner: t.winner, note: [legs && `Legs ${legs}`, pens].filter(Boolean).join(" · ") || undefined };
}

/** The Champions or Europa League knockout: the Round of 32 as a list (folded
 *  unless it is the round being played), then the tree from the last 16. */
export function EuroKnockout({ bracket, glow, you }: { bracket: EuroBracket; glow: string; you: string }) {
  const r32 = bracket.rounds.find(r => r.name === "Round of 32");
  const tree = ([["Round of 16", 8], ["Quarter-Final", 4], ["Semi-Final", 2], ["Final", 1]] as const).map(([name, size]) => {
    const ties = (bracket.rounds.find(r => r.name === name)?.ties ?? []).map(euroTreeTie);
    while (ties.length < size) ties.push({});
    return { name, ties: ties.slice(0, size) };
  });
  const r32Live = !!r32 && r32.ties.some(t => t.a && t.b && !t.winner);
  const [open, setOpen] = useState(r32Live);
  return (
    <div className="space-y-2" data-euro-knockout>
      {r32 && r32.ties.some(t => t.a && t.b) && (
        <ClubCard glow={glow} className="p-1.5">
          <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-1 py-1 text-left" data-r32-toggle>
            <span>
              <CardTitle tone="text-amber-300">Round of 32 · knockout play-off</CardTitle>
              <span className="block text-[10.5px] font-bold text-white/80">9th to 24th in the league stage play for the last 16</span>
            </span>
            <span className="text-[16px] font-black text-white">{open ? "▴" : "▾"}</span>
          </button>
          {open && (
            <div className="mt-1 space-y-1">
              {r32.ties.filter(t => t.a && t.b).map((t, i) => {
                const tt = euroTreeTie(t);
                const mine = t.a === you || t.b === you;
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white" style={mine ? youRowStyle(glow) : { background: "rgba(255,255,255,.04)" }}>
                    <span className={`truncate text-right ${t.winner === t.a ? "font-black" : t.winner ? "text-white/60" : ""}`}>{shortClub(t.a!)}</span>
                    <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{tt.sa !== undefined ? `${tt.sa}-${tt.sb}` : "v"}</span>
                    <span className={`truncate ${t.winner === t.b ? "font-black" : t.winner ? "text-white/60" : ""}`}>{shortClub(t.b!)}</span>
                    {tt.note && <span className="col-span-3 text-center text-[9.5px] font-bold text-white/70">{tt.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </ClubCard>
      )}
      <KnockoutTree columns={tree} glow={glow} you={you} />
    </div>
  );
}

// ── Domestic cups ───────────────────────────────────────────────────────────

const TREE_ROUNDS = ["Quarter-Final", "Semi-Final", "Final"];
type CupTie = CupState["rounds"][number]["ties"][number];

const cupWinner = (t: CupTie): string | undefined => {
  if (t.hs === undefined || t.as === undefined) return undefined;
  if (t.hs !== t.as) return t.hs > t.as ? t.home : t.away;
  return t.pens ? (t.pens.home > t.pens.away ? t.home : t.away) : undefined;
};
const cupTreeTie = (t: CupTie): TreeTie => ({
  a: t.home, b: t.away, sa: t.hs, sb: t.as, winner: cupWinner(t),
  note: t.pens ? `${t.pens.home}-${t.pens.away} on penalties` : undefined,
});

/** The last 8 to the final, in tree order: each tie sits under the tie its
 *  winner came from. A cup is drawn from a hat each round, so the order is
 *  traced back from the latest round drawn. Rounds not drawn yet are "?". */
export function cupTreeColumns(cup: CupState): TreeColumn[] {
  const cols = TREE_ROUNDS.map(n => cup.rounds.find(r => r.name === n)?.ties ?? []);
  const sizes = [4, 2, 1];
  let last = -1;
  cols.forEach((c, i) => { if (c.length) last = i; });
  const ordered: (CupTie | null)[][] = sizes.map(s => Array(s).fill(null));
  if (last >= 0) {
    ordered[last] = [...cols[last]].slice(0, sizes[last]);
    while (ordered[last].length < sizes[last]) ordered[last].push(null);
    for (let k = last - 1; k >= 0; k--) {
      const used = new Set<CupTie>();
      const out: (CupTie | null)[] = [];
      for (const t of ordered[k + 1]) {
        for (const club of t ? [t.home, t.away] : [undefined, undefined]) {
          const from = club ? cols[k].find(x => !used.has(x) && (x.home === club || x.away === club)) : undefined;
          if (from) { used.add(from); out.push(from); } else out.push(null);
        }
      }
      // Anything not traced (a tie whose winner is not in the next round yet) fills the gaps in order.
      const rest = cols[k].filter(x => !used.has(x));
      ordered[k] = out.map(x => x ?? rest.shift() ?? null);
    }
  }
  return TREE_ROUNDS.map((name, i) => ({ name, ties: ordered[i].map(t => (t ? cupTreeTie(t) : {})) }));
}

/** Rounds before the last 8 as a list, picked with chips; "Last 8" opens the
 *  tree. Opens on the round being played, or on "Last 8" once it is reached
 *  (and always at the season review). */
export function CupKnockout({ cup, glow, you, review = false, extra }: {
  cup: CupState; glow: string; you: string; review?: boolean;
  /** Anything to show above a list round (e.g. "Still to join"). */
  extra?: React.ReactNode;
}) {
  const early = cup.rounds.filter(r => !TREE_ROUNDS.includes(r.name));
  const treeStarted = cup.rounds.some(r => TREE_ROUNDS.includes(r.name));
  const current = cup.rounds.find(r => r.ties.some(t => t.hs === undefined)) ?? cup.rounds[cup.rounds.length - 1];
  const startOnTree = review || treeStarted || !current;
  const [pick, setPick] = useState<string>(startOnTree ? "tree" : current.name);
  const round = early.find(r => r.name === pick);
  return (
    <div className="space-y-2" data-cup-knockout>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {[...early.map(r => [r.name, chip(r.name)] as const), ["tree", "Quarter-finals"] as const].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setPick(k)} data-cup-chip={k}
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black"
            style={pick === k ? { background: "#fde047", color: "#111" } : { background: "rgba(255,255,255,.1)", color: "#fff" }}>{l}</button>
        ))}
      </div>
      {pick === "tree" ? <KnockoutTree columns={cupTreeColumns(cup)} glow={glow} you={you} /> : round && (
        <>
          {extra}
          <ClubCard glow={glow} className="p-1.5">
            <CardTitle className="px-1 pb-1" tone="text-amber-300">{round.name} · {round.ties.length} ties</CardTitle>
            <div className="space-y-1">
              {round.ties.map(t => {
                const mine = t.home === you || t.away === you;
                const w = cupWinner(t);
                return (
                  <div key={`${t.home}-${t.away}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-white" style={mine ? youRowStyle(glow) : { background: "rgba(255,255,255,.04)" }}>
                    <span className={`truncate text-right ${w === t.home ? "font-black" : w ? "text-white/60" : ""}`}>{shortClub(t.home)}</span>
                    <span className="rounded-md bg-black/45 px-1.5 py-0.5 font-black tabular-nums">{t.hs !== undefined ? `${t.hs}-${t.as}` : "v"}</span>
                    <span className={`truncate ${w === t.away ? "font-black" : w ? "text-white/60" : ""}`}>{shortClub(t.away)}</span>
                    {t.pens && <span className="col-span-3 text-center text-[9.5px] font-bold text-amber-300">{t.pens.home}-{t.pens.away} on penalties</span>}
                  </div>
                );
              })}
            </div>
            {round.byes && round.byes.length > 0 && (
              <p className="px-1 pt-1.5 text-[10.5px] font-bold leading-snug text-white">
                <span className="text-amber-300">Through on a bye ({round.byes.length}): </span>{round.byes.map(shortClub).join(" · ")}
              </p>
            )}
          </ClubCard>
        </>
      )}
    </div>
  );
}

const chip = (name: string) => name
  .replace("Qualifying Round", "Qual").replace(" Round", "").replace("Round of ", "Last ").replace("Round ", "R");
