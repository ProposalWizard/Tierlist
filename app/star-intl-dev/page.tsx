"use client";

/**
 * INTERNATIONAL WORLD — the test page (Mikey, 12 Oct 2026). Every national
 * team's competitions played out from August 2026 (lib/star/intl), without
 * playing a career to get there: pick a date and a nation, see every final
 * so far, the FIFA ranking, that nation's tables and matches, and the
 * squad-announcement screen exactly as the game draws it.
 * Nothing is saved.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import CallUpScreen from "@/components/star/CallUpScreen";
import NationFlag from "@/components/star/NationFlag";
import { newWorld } from "@/lib/star/intl/replay";
import { NATIONS } from "@/lib/star/intl/nations";
import { table, played } from "@/lib/star/intl/engine";
import type { IntlDecision, Period } from "@/lib/star/intl/career";

const YEARS = Array.from({ length: 20 }, (_, i) => 2027 + i);
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function IntlDevPage() {
  const [year, setYear] = useState(2028);
  const [nation, setNation] = useState("England");
  const [shot, setShot] = useState<null | "called" | "out">(null);
  const nations = useMemo(() => NATIONS.map((n) => n.name).sort(), []);
  const w = useMemo(() => {
    const world = newWorld({ xi: {}, played: {}, firstYear: 2026 });
    world.run(Date.UTC(year, 7, 1));
    return world;
  }, [year]);
  const mine = w.matches.filter((m) => (m.home === nation || m.away === nation)).sort((a, b) => a.date - b.date);
  const done = mine.filter(played);
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: { title: string; rows: ReturnType<typeof table> }[] = [];
    for (const m of [...done].reverse()) {
      if (!m.group || seen.has(`${m.edition}|${m.group}`)) continue;
      seen.add(`${m.edition}|${m.group}`);
      const ms = w.edition(m.edition).filter((x) => x.group === m.group);
      const teams = Array.from(new Set(ms.flatMap((x) => [x.home, x.away])));
      out.push({ title: `${m.comp} · ${m.stage.split(" · ")[0]}`, rows: table(teams, ms, "h2h", w.rankOf) });
      if (out.length >= 3) break;
    }
    return out;
  }, [done, w]);

  if (shot) {
    const lastWindow = done.filter((m) => m.comp !== "World Cup").slice(-2);
    const period: Period = {
      key: "sample", kind: "window", label: "September–October 2026", matches: lastWindow,
      start: lastWindow[0]?.date ?? 0, end: lastWindow[1]?.date ?? 0,
    };
    const d: IntlDecision = shot === "called"
      ? { period, nation, called: true, chance: 0.9, starter: true, reason: "You're one of his first names on the team sheet.", manager: 62, line: `${nation}'s manager sees you as a starter.` }
      : { period, nation, called: false, chance: 0.1, starter: false, reason: `${nation}'s manager isn't looking at you yet.`, manager: 12, line: `${nation}'s manager doesn't know your name yet. Their squad is picked at about 81.` };
    return <CallUpScreen decision={d} onContinue={() => setShot(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-5 text-white">
      <h1 className="text-[20px] font-black">International world</h1>
      <div className="mt-1 text-[12px] font-bold text-white/80">Every competition played from August 2026 to 1 August of the year picked. Nothing is saved.</div>
      <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-bold">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded bg-white/10 px-2 py-1">
          {YEARS.map((y) => <option key={y} value={y} className="bg-gray-900">Up to Aug {y}</option>)}
        </select>
        <select value={nation} onChange={(e) => setNation(e.target.value)} className="rounded bg-white/10 px-2 py-1">
          {nations.map((n) => <option key={n} value={n} className="bg-gray-900">{n}</option>)}
        </select>
        <button onClick={() => setShot("called")} className="rounded bg-sky-600 px-2 py-1">▶ Called up screen</button>
        <button onClick={() => setShot("out")} className="rounded bg-slate-600 px-2 py-1">▶ Left out screen</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl bg-white/5 p-3">
          <h2 className="text-[12px] font-black uppercase tracking-wider">Who won ({w.finals.length})</h2>
          {[...w.finals].reverse().map((f) => (
            <div key={f.edition} className="flex items-center gap-1.5 border-t border-white/5 py-1 text-[12px] font-bold">
              <span className="w-9 text-white/70">{f.year}</span><span className="min-w-0 flex-1 truncate">{f.comp}</span>
              <NationFlag nation={f.winner} width={16} /><span className="max-w-[6rem] truncate font-black">{f.winner}</span>
              <span className="shrink-0 text-white/70">{f.hs}–{f.as}{f.pens ? ` (${f.pens.hs}–${f.pens.as} p)` : ""}</span>
              <span className="max-w-[5rem] truncate text-white/80">{f.runnerUp}</span>
            </div>
          ))}
        </section>
        <section className="min-w-0 overflow-hidden rounded-xl bg-white/5 p-3">
          <h2 className="text-[12px] font-black uppercase tracking-wider">FIFA ranking</h2>
          {w.ranking().slice(0, 20).map((n, i) => (
            <div key={n} className={`flex items-center gap-1.5 py-0.5 text-[12px] font-bold ${n === nation ? "text-amber-300" : ""}`}>
              <span className="w-5 text-right text-white/70">{i + 1}</span><NationFlag nation={n} width={16} /><span className="flex-1">{n}</span>
              <span className="text-white/70">{Math.round(w.points.get(n) ?? 0)}</span>
            </div>
          ))}
          <div className="mt-1 text-[12px] font-bold">{nation}: #{w.rankOf(nation)}</div>
        </section>
        {groups.map((g) => (
          <section key={g.title} className="min-w-0 overflow-hidden rounded-xl bg-white/5 p-3">
            <h2 className="text-[12px] font-black uppercase tracking-wider">{g.title}</h2>
            {g.rows.map((r, i) => (
              <div key={r.name} className={`grid grid-cols-[1fr_repeat(5,2rem)] py-0.5 text-[12px] font-bold ${r.name === nation ? "text-amber-300" : ""}`}>
                <span>{i + 1}. {r.name}</span><span>{r.p}</span><span>{r.w}</span><span>{r.d}</span><span>{r.gf - r.ga}</span><span className="font-black">{r.pts}</span>
              </div>
            ))}
          </section>
        ))}
        <section className="min-w-0 overflow-hidden rounded-xl bg-white/5 p-3 md:col-span-2">
          <h2 className="text-[12px] font-black uppercase tracking-wider">{nation}: last 20 matches</h2>
          {done.slice(-20).reverse().map((m) => (
            <div key={m.id} className="flex flex-wrap gap-x-2 border-t border-white/5 py-1 text-[12px] font-bold">
              <span className="w-24 text-white/70">{day(m.date)}</span>
              <span className="min-w-0 flex-1">{m.home} {m.hs}–{m.as} {m.away}{m.pens ? ` (${m.pens.hs}–${m.pens.as} p)` : ""}</span>
              <span className="w-full text-[10.5px] text-white/70">{m.comp} · {m.stage}</span>
            </div>
          ))}
        </section>
      </div>
      <PageGuide page="/star-intl-dev" corner="bottom-left" />
    </div>
  );
}
