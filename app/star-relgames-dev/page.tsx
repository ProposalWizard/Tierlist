"use client";

/**
 * RELATIONSHIP GAMES — the test page (Mikey, 4 Oct 2026). Every relationship
 * game from the revamp (components/star/relgames/) on a made-up career, so
 * each can be tried without playing a career up to it. Nothing is saved.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./relationship-games.css";
import { BOSS_KICKS, BOSS_GAIN_PER_HIT, BOSS_NO_HITS } from "@/lib/star/bossPenalties";
import { SESSION_REPS, SESSION_FIRST_LEVEL } from "@/lib/star/bossSession";
import { TALK_ROUNDS } from "@/lib/star/bossTalk";
import { SIGNING_QUEUE, SIGNING_PAR } from "@/components/star/relgames/SigningSession";
import AdvertShoot, { ADVERT_WIN, ADVERT_LOSS } from "@/components/star/relgames/AdvertShoot";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import RelationshipGame, { type GameResult } from "@/components/star/relgames/RelationshipGame";
import type { RelationshipKind } from "@/components/star/RelationshipMinigame";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { NATIONAL_LEAGUE_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import type { BrandDeal } from "@/lib/star/sponsorDeals";
import { CaptainInOffice, ManagerSays } from "@/components/star/ManagerMoments";
import { benchMomentFor } from "@/lib/star/managerMoments";

type Pick = RelationshipKind | "advert" | "captain" | "bench";
const GAMES: { id: Pick; name: string; bar: string; what: string }[] = [
  { id: "boss", name: "The manager (pick 1 of 3)", bar: "Boss", what: "Pick one: Penalties, Office talk or Extra session. All three move the Boss bar." },
  { id: "team", name: "Woodwork challenge", bar: "Team", what: "Hit the posts and bar with your team-mates watching. Moves the Team bar." },
  { id: "fans", name: "Signing session", bar: "Fans", what: "Sign what each fan holds, in order. Never sign for a journalist. Moves the Fans bar." },
  { id: "advert", name: "Shoot an advert", bar: "Sponsor", what: "Hit your mark when the director calls. Moves the sponsor's happiness." },
  { id: "captain", name: "Moment: made captain", bar: "Boss", what: "What the manager says when he gives you the armband." },
  { id: "bench", name: "Moment: dropped to the bench", bar: "Boss", what: "What the manager says when he drops you. The reason follows the bar level and form." },
];
const FORMS: Record<string, number[]> = { "In form": [8, 8.2, 7.9], Ordinary: [6.5, 6.6, 6.4], "Out of form": [5.2, 5.5, 5.4] };

export default function RelGamesTest() {
  const [game, setGame] = useState<Pick | null>(null);
  const [pick, setPick] = useState<Pick>("boss");
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

  const sel = GAMES.find((g) => g.id === pick) ?? GAMES[0];
  const open = (id: Pick) => { setKey((k) => k + 1); setGame(id); };
  return (
    <BroadcastPage title="Relationship games" sub="Try each game on a made-up player. Nothing is saved." width={1240}>
      <div className="rg-layout">
        <Panel title="Games" note="Tap to look · ▶ to play">
          <div className="rg-list">
            {GAMES.map((g) => (
              <div key={g.id} className="rg-row" aria-current={sel.id === g.id ? "true" : undefined}>
                <button className="rg-pick" onClick={() => setPick(g.id)} aria-pressed={sel.id === g.id}>
                  <span className="rg-thumb" style={{ backgroundImage: `url(/admin/relationship-games/${g.id}.webp)` }} />
                  <span className="rg-txt">
                    <b>{g.name}</b>
                    <span className="rg-bar-name">{g.bar} bar</span>
                    <span className="rg-meter" aria-label={`${g.bar} bar ${bar} of 100`}><i style={{ width: `${bar}%` }} /></span>
                  </span>
                </button>
                <button className="rg-play" onClick={() => open(g.id)} aria-label={`Play ${g.name}`} title={`Play ${g.name}`}>▶</button>
              </div>
            ))}
          </div>
        </Panel>

        <div className="rg-main">
          <Panel title={`Preview: ${sel.name}`}>
            <div className="rg-preview">
              <div className="rg-pic" style={{ backgroundImage: `url(/admin/relationship-games/${sel.id}.webp)` }} role="img" aria-label={`The first screen of ${sel.name}`} />
              <div className="rg-side">
                <div className="rg-what">{sel.what}</div>
                <Btn main onClick={() => open(sel.id)}>▶ Start</Btn>
                {last ? (
                  <div className="rg-last">Last game: <b>{last.won ? "won" : "lost"}</b>, {last.gain > 0 ? "+" : ""}{last.gain}{last.cost ? ` · cost ★${last.cost}` : ""}</div>
                ) : <Note>Play a game to see what it pays here.</Note>}
              </div>
            </div>
          </Panel>

          <PanelGrid min={300}>
            <Panel title="Before the game" note="Changes the test player">
              <Label>Bar level (all bars)</Label>
              <div className="rg-pills">{[20, 50, 75, 90].map((v) => <Pill key={v} on={bar === v} onClick={() => setBar(v)}>{v}</Pill>)}</div>
              <Note>Every game. See what a win pays at each level.</Note>
              <Label>Last match rating</Label>
              <div className="rg-pills">{Object.keys(FORMS).map((f) => <Pill key={f} on={form === f} onClick={() => setForm(f)}>{f}</Pill>)}</div>
              <Note>Office talk and the bench moment.</Note>
              <Label>Old manager talk only</Label>
              <div className="rg-pills"><Pill on={!benched} onClick={() => setBenched(false)}>Starting</Pill><Pill on={benched} onClick={() => setBenched(true)}>On the bench</Pill></div>
              <div className="rg-pills">{(["trusting", "demanding", "rotational"] as const).map((s) => <Pill key={s} on={style === s} onClick={() => setStyle(s)}>{s}</Pill>)}</div>
              <Note>That talk is no longer in the game.</Note>
            </Panel>
            <Panel title="Fixed in the game" note="Change in code only">
              <table className="rg-rules"><tbody>
                <tr><td>Penalties</td><td>{BOSS_KICKS} kicks · +{BOSS_GAIN_PER_HIT} a hit · {BOSS_NO_HITS} if none</td></tr>
                <tr><td>Office talk</td><td>{TALK_ROUNDS} questions</td></tr>
                <tr><td>Extra session</td><td>{SESSION_REPS} shots, from drill level {SESSION_FIRST_LEVEL}</td></tr>
                <tr><td>Signing session</td><td>{SIGNING_QUEUE} fans · score = fans done − {SIGNING_PAR}</td></tr>
                <tr><td>Advert</td><td>good shoot +{ADVERT_WIN} · bad {ADVERT_LOSS} happiness</td></tr>
              </tbody></table>
              <Note>Read from the game&apos;s own files, so they are always the real numbers.</Note>
            </Panel>
          </PanelGrid>
        </div>
      </div>
      <PageGuide page="/star-relgames-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
