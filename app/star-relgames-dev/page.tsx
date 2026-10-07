"use client";

/**
 * RELATIONSHIP GAMES — the test page (Mikey, 4 Oct 2026). Every relationship
 * game from the revamp (components/star/relgames/) on a made-up career, so
 * each can be tried without playing a career up to it. Nothing is saved.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import RelationshipGame, { type GameResult } from "@/components/star/relgames/RelationshipGame";
import AdvertShoot from "@/components/star/relgames/AdvertShoot";
import type { RelationshipKind } from "@/components/star/RelationshipMinigame";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { NATIONAL_LEAGUE_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import type { BrandDeal } from "@/lib/star/sponsorDeals";
import { CaptainInOffice, ManagerSays } from "@/components/star/ManagerMoments";
import { benchMomentFor } from "@/lib/star/managerMoments";

type Pick = RelationshipKind | "advert" | "captain" | "bench";
const GAMES: { id: Pick; name: string }[] = [
  { id: "boss", name: "The manager (pick 1 of 3)" }, { id: "team", name: "Woodwork challenge" },
  { id: "fans", name: "Signing session" }, { id: "advert", name: "Shoot an advert" },
  { id: "captain", name: "Moment: made captain" }, { id: "bench", name: "Moment: dropped to the bench" },
];
const FORMS: Record<string, number[]> = { "In form": [8, 8.2, 7.9], Ordinary: [6.5, 6.6, 6.4], "Out of form": [5.2, 5.5, 5.4] };

export default function RelGamesTest() {
  const [game, setGame] = useState<Pick | null>(null);
  const [form, setForm] = useState("Ordinary");
  const [benched, setBenched] = useState(false);
  const [style, setStyle] = useState<"trusting" | "demanding" | "rotational">("trusting");
  const [bar, setBar] = useState(50);
  const [last, setLast] = useState<GameResult | null>(null);
  const [key, setKey] = useState(0);

  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 19, skinTone: "medium", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...NATIONAL_LEAGUE_CLUBS], "national_league");
    c.squad = generateSquad(7);
    c.form = FORMS[form];
    c.status = benched ? "Substitute" : "1st Team";
    c.money = 50_000;
    c.manager = { name: "Test Gaffer", style, since: 1, arrival: "summer", reputation: 50 };
    c.relationships = { ...c.relationships, boss: bar, team: bar, fans: bar };
    c.happiness = bar;
    return c;
  }, [form, benched, style, bar]);
  const deal: BrandDeal = { id: "test", brand: "Volt Energy", category: "Sports Drink", color: "#22d3ee", weekly: 500, seasonsLeft: 2, seasonsTotal: 2, guaranteed: 0, happiness: bar, targets: [] };
  const done = (r: GameResult) => { setLast(r); setGame(null); };

  // The game's own look (bars, font) comes from the career screen's wrapper.
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}>{el}</div>;
  if (game === "advert") return wrap(<AdvertShoot key={key} deal={deal} onFinish={done} onCancel={() => setGame(null)} />);
  // The two manager moments (lib/star/managerMoments.ts): office, or the plain
  // card with the boss-room look on Old. "Out of form" gives the form reason.
  if (game === "captain") return wrap(<CaptainInOffice key={key} career={{ ...career, captain: true, captainMomentPending: true }} onDone={() => setGame(null)} />);
  if (game === "bench") {
    const fx = career.fixtures.find((f) => !f.played) ?? { week: 1, opponent: "Test FC" };
    const m = benchMomentFor({ ...career, lastPick: { status: "1st Team" } }, { status: "Substitute" }, fx);
    return wrap(<ManagerSays key={key} career={career} title="Team news" text={m?.text ?? ""} onContinue={() => setGame(null)} />);
  }
  if (game) return wrap(<RelationshipGame key={key} kind={game} career={career} onFinish={done} onCancel={() => setGame(null)} />);

  const chip = (on: boolean): React.CSSProperties => ({ padding: "6px 10px", borderRadius: 4, fontWeight: 900, fontSize: 13, background: on ? "#facc15" : "rgba(255,255,255,.1)", color: on ? "#111" : "#fff" });
  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-5 text-white">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="text-[20px] font-black uppercase">Relationship games</div>
        <div className="text-[14px] font-bold">Try each game on a made-up player. Nothing is saved.</div>
        <div className="space-y-2">
          {GAMES.map((g) => (
            <button key={g.id} onClick={() => { setKey((k) => k + 1); setGame(g.id); }} className="kib-press block w-full bg-emerald-600 px-3 py-3 text-left text-[15px] font-black uppercase" style={{ borderRadius: 4 }}>▶ {g.name}</button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">Bar level (all bars)</div>
          <div className="flex flex-wrap gap-1.5">{[20, 50, 75, 90].map((v) => <button key={v} style={chip(bar === v)} onClick={() => setBar(v)}>{v}</button>)}</div>
          <div className="text-[12px] font-black uppercase tracking-widest text-amber-300">For the manager chat</div>
          <div className="flex flex-wrap gap-1.5">{Object.keys(FORMS).map((f) => <button key={f} style={chip(form === f)} onClick={() => setForm(f)}>{f}</button>)}</div>
          <div className="flex flex-wrap gap-1.5"><button style={chip(!benched)} onClick={() => setBenched(false)}>Starting</button><button style={chip(benched)} onClick={() => setBenched(true)}>On the bench</button></div>
          <div className="flex flex-wrap gap-1.5">{(["trusting", "demanding", "rotational"] as const).map((s) => <button key={s} style={chip(style === s)} onClick={() => setStyle(s)}>{s}</button>)}</div>
        </div>
        {last && <div className="bg-white/10 p-3 text-[14px] font-bold" style={{ borderRadius: 4 }}>Last game: {last.won ? "won" : "lost"}, {last.gain > 0 ? "+" : ""}{last.gain}{last.cost ? ` · cost ★${last.cost}` : ""}</div>}
      </div>
      <PageGuide page="/star-relgames-dev" corner="bottom-left" />
    </div>
  );
}
