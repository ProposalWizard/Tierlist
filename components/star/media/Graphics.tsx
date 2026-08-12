"use client";
import type { GraphicSpec } from "@/lib/star/media/types";

/**
 * The cards a post can carry.
 *
 * Twelve variants, one component each, all reading the same tokens as the rest
 * of /star-dev — dark panels, emerald for good, amber for honours, and white or
 * near-white for every word on the screen. Nothing here loads an asset or hits
 * the network: a "graphic" is typed data and some divs.
 */

const PANEL = "rounded-xl overflow-hidden border border-white/15 bg-gray-900/70";

export default function Graphic({ spec }: { spec: GraphicSpec }) {
  switch (spec.type) {
    case "scoreline": return <Scoreline s={spec} />;
    case "breaking": return <Breaking s={spec} />;
    case "playerCard": return <PlayerCard s={spec} />;
    case "statLine": return <StatLine s={spec} />;
    case "tableSnippet": return <TableSnippet s={spec} />;
    case "topScorers": return <TopScorers s={spec} />;
    case "teamOfTheWeek": return <Totw s={spec} />;
    case "hatTrick": return <HatTrick s={spec} />;
    case "transfer": return <Transfer s={spec} />;
    case "trophy": return <Trophy s={spec} />;
    case "poll": return <Poll s={spec} />;
    case "thumbnail": return <Thumbnail s={spec} />;
  }
}

function Scoreline({ s }: { s: Extract<GraphicSpec, { type: "scoreline" }> }) {
  // `scorers` is the old single list, saved into careers before the goals were
  // split by side. It was always printed under the left-hand team, so that is
  // where it stays.
  const homeScorers = s.homeScorers ?? s.scorers ?? [];
  const awayScorers = s.awayScorers ?? [];
  return (
    <div className={PANEL}>
      <div className="bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/85">
        {s.competition}
      </div>
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex-1 text-right text-sm font-black text-white leading-tight">{s.home}</div>
        <div className="rounded-lg bg-white/10 px-3 py-1 text-xl font-black tabular-nums text-white">
          {s.hs}<span className="px-1 text-white/60">–</span>{s.as}
        </div>
        <div className="flex-1 text-left text-sm font-black text-white leading-tight">{s.away}</div>
      </div>
      {(homeScorers.length > 0 || awayScorers.length > 0) && (
        // Under the team that scored them: home on the left, away on the right,
        // matching the two names above. A scorer floating on the wrong side of a
        // 0-1 reads as the wrong team having scored.
        <div className="flex items-start gap-2 border-t border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/80">
          <div className="flex-1 space-y-0.5 text-left">
            {homeScorers.map(g => <div key={g}>{g}</div>)}
          </div>
          <div className="flex-1 space-y-0.5 text-right">
            {awayScorers.map(g => <div key={g}>{g}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Breaking({ s }: { s: Extract<GraphicSpec, { type: "breaking" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-red-500/40">
      <div className="bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-white">
        {s.strapline}
      </div>
      <div className="bg-gray-900/80 px-3 py-3 text-base font-black uppercase leading-snug text-white">
        {s.headline}
      </div>
    </div>
  );
}

function PlayerCard({ s }: { s: Extract<GraphicSpec, { type: "playerCard" }> }) {
  const tone = s.rating >= 8 ? "text-emerald-300" : s.rating >= 7 ? "text-amber-300" : "text-white";
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 text-lg font-black text-white">
          {s.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-white">{s.name}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{s.position}</div>
        </div>
        <div className={`text-2xl font-black tabular-nums ${tone}`}>{s.rating.toFixed(1)}</div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
        {s.rows.map(r => (
          <div key={r.label} className="bg-gray-900/80 px-2 py-1.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">{r.label}</div>
            <div className={`text-sm font-black ${r.highlight ? "text-emerald-300" : "text-white"}`}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLine({ s }: { s: Extract<GraphicSpec, { type: "statLine" }> }) {
  return (
    <div className={PANEL}>
      <div className="bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/85">
        {s.title}
      </div>
      <div className="divide-y divide-white/10">
        {s.rows.map(r => (
          <div key={r.label} className="flex items-center px-3 py-1.5">
            <div className="flex-1 text-[11px] font-bold text-white/85">{r.label}</div>
            <div className={`text-sm font-black tabular-nums ${r.highlight ? "text-emerald-300" : "text-white"}`}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSnippet({ s }: { s: Extract<GraphicSpec, { type: "tableSnippet" }> }) {
  return (
    <div className={PANEL}>
      <div className="flex bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white/85">
        <span className="w-6">#</span><span className="flex-1">Team</span>
        <span className="w-7 text-right">P</span><span className="w-8 text-right">GD</span><span className="w-8 text-right">Pts</span>
      </div>
      {s.rows.map(r => (
        <div key={r.name}
          className={`flex px-3 py-1.5 text-[11px] font-bold tabular-nums ${
            r.name === s.highlight ? "bg-emerald-600/25 text-white" : "text-white/85"}`}>
          <span className="w-6">{r.pos}</span>
          <span className="flex-1 truncate font-black">{r.name}</span>
          <span className="w-7 text-right">{r.played}</span>
          <span className="w-8 text-right">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
          <span className="w-8 text-right font-black text-white">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

function TopScorers({ s }: { s: Extract<GraphicSpec, { type: "topScorers" }> }) {
  return (
    <div className={PANEL}>
      <div className="bg-amber-400 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-gray-950">
        🥇 {s.title}
      </div>
      {s.rows.map((r, i) => (
        <div key={r.label + i}
          className={`flex items-center px-3 py-1.5 ${r.highlight ? "bg-amber-400/20" : ""}`}>
          <span className="w-5 text-[10px] font-black text-white/70">{i + 1}</span>
          <span className="flex-1 truncate text-[11px] font-black text-white">{r.label}</span>
          <span className="text-sm font-black tabular-nums text-white">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Totw({ s }: { s: Extract<GraphicSpec, { type: "teamOfTheWeek" }> }) {
  return (
    <div className={PANEL}>
      <div className="bg-emerald-600 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">
        Team of the Week · {s.formation}
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/10">
        {s.players.map((p, i) => (
          <div key={p.name + i} className={`px-2.5 py-1.5 ${p.isYou ? "bg-emerald-700/50" : "bg-gray-900/80"}`}>
            <div className="truncate text-[11px] font-black text-white">{p.name}</div>
            <div className="text-[9px] font-bold text-white/75">{p.position} · {p.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HatTrick({ s }: { s: Extract<GraphicSpec, { type: "hatTrick" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-gray-900/80">
      <div className="px-3 py-2.5 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">Matchball</div>
        <div className="mt-0.5 text-lg font-black uppercase text-white">{s.name}</div>
        <div className="mt-1.5 flex justify-center gap-1.5">
          {s.minutes.map((m, i) => (
            <span key={i} className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-black tabular-nums text-white">
              {m}&apos;
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Transfer({ s }: { s: Extract<GraphicSpec, { type: "transfer" }> }) {
  return (
    <div className={PANEL}>
      <div className="bg-emerald-600 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">
        ✍️ Transfer Confirmed
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-black text-white">{s.player}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-white/85">
          <span className="truncate">{s.from}</span>
          <span className="text-emerald-300">→</span>
          <span className="truncate font-black text-white">{s.to}</span>
          {s.fee && <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-black text-white">{s.fee}</span>}
        </div>
      </div>
    </div>
  );
}

function Trophy({ s }: { s: Extract<GraphicSpec, { type: "trophy" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-400/30 to-gray-900/80 px-3 py-4 text-center">
      <div className="text-3xl">🏆</div>
      <div className="mt-1 text-base font-black uppercase leading-tight text-white">{s.competition}</div>
      <div className="text-[11px] font-black text-amber-200">{s.club} · Season {s.season}</div>
    </div>
  );
}

function Poll({ s }: { s: Extract<GraphicSpec, { type: "poll" }> }) {
  const total = Math.max(1, s.votes.reduce((a, b) => a + b, 0));
  return (
    <div className={PANEL}>
      <div className="px-3 pt-2 text-[11px] font-black text-white">{s.question}</div>
      <div className="space-y-1 px-3 py-2">
        {s.options.map((o, i) => {
          const pct = Math.round((s.votes[i] / total) * 100);
          return (
            <div key={o} className="relative overflow-hidden rounded-md bg-white/10">
              <div className="absolute inset-y-0 left-0 bg-emerald-600/50" style={{ width: `${pct}%` }} />
              <div className="relative flex px-2 py-1 text-[11px] font-bold text-white">
                <span className="flex-1 truncate">{o}</span>
                <span className="font-black tabular-nums">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 pb-2 text-[9px] font-bold text-white/70">{total.toLocaleString()} votes</div>
    </div>
  );
}

function Thumbnail({ s }: { s: Extract<GraphicSpec, { type: "thumbnail" }> }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-gray-700 to-gray-900">
      <div className="flex h-24 items-end p-3">
        <div className="text-sm font-black uppercase leading-tight text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
          {s.title}
        </div>
      </div>
      <div className="absolute right-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
        {s.badge}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/25 backdrop-blur-sm">
          <div className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
        </div>
      </div>
    </div>
  );
}
