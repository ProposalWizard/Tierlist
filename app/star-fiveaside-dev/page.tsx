"use client";

/**
 * FIVE-A-SIDE — its own test area (Harry, 19 Oct 2026, A-7): "old five-a-side
 * game isn't used anywhere … bring it back as its own test area: five-a-side
 * with scenarios and a full match. Give things tabs … it has scenarios, it has
 * its data, and it has a full match playing area with a match radar."
 *
 *  - Scenarios: the gallery's five-a-side chance pictures (shared, in
 *    lib/star/fiveASide/scenarios.ts), each playable three ways, one at a time.
 *  - Full match: the five-a-side match from kick-off to full time, with a radar.
 *  - Data: what 500 simulated matches add up to (lib/star/fiveASide/simData.json,
 *    made by scripts/fiveaside-data/run.mts with the real five-a-side code).
 *
 * Every chance is played by FiveASide.tsx, the same screen the trial uses. This
 * page only passes it test-area switches (autoStart, stopAfterChance) and reads
 * what happened (onChance, onFrame). Nothing is saved anywhere except which tab
 * this device was last on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import FiveASide, { type FiveChanceReport, type FiveFrameReport } from "@/components/star/FiveASide";
import type { FiveASideSummary } from "@/lib/star/fiveASide/score";
import {
  FIVE_CHANCE_SEEDS, FIVE_SCENARIO_KINDS, scenarioState, scenarioName, scenarioRollSeed, type FiveScenarioKind,
} from "@/lib/star/fiveASide/scenarios";
import type { FiveSimSummary } from "@/lib/star/fiveASide/simSummary";
import SIM from "@/lib/star/fiveASide/simData.json";
import FiveRadar, { bandName, US, THEM } from "./FiveRadar";
import "./fiveaside.css";

const DATA = SIM as unknown as FiveSimSummary;
const MATE = "#199e70";

type Tab = "scenarios" | "match" | "data";
const TABS: { key: Tab; label: string }[] = [
  { key: "scenarios", label: "Scenarios" },
  { key: "match", label: "Full match" },
  { key: "data", label: "Data" },
];
const TAB_KEY = "star-fiveaside-dev-tab";

const LEVELS = [
  { label: "Easy", difficulty: 0.2 },
  { label: "Even", difficulty: 0.5 },
  { label: "Hard", difficulty: 0.8 },
];
const SKILLS = [40, 70, 100];

const KIND_NAME: Record<string, string> = {
  one_on_one: "One-on-one", tight_angle: "Tight angle", buildup: "Build-up pass", midfield_pass: "Midfield pass",
  through_ball: "Through ball", cutback: "Cutback", long_range: "Long shot",
};
const kindName = (k: string) => KIND_NAME[k] ?? k.replace(/_/g, " ");

/** An outcome, in words, from the side that had the chance. */
function outcomeWords(outcome: string, who: FiveChanceReport["who"]): string {
  const ours = who !== "them";
  if (outcome === "goal" || outcome === "rebound") return ours ? "Goal" : "They score";
  if (outcome === "saved" || outcome === "caught" || outcome === "tipped") return ours ? "Saved" : "Your keeper saves";
  if (outcome === "blocked" || outcome === "tackled") return ours ? "Blocked" : "Blocked by your side";
  if (outcome === "post") return "Off the post";
  if (outcome === "wide" || outcome === "over" || outcome === "out") return ours ? "Off target" : "They miss";
  if (outcome === "delivered") return ours ? "Reached a team-mate" : "They keep it";
  if (outcome === "short") return "Ran out of steam";
  return outcome;
}
const isGoal = (o: string) => o === "goal" || o === "rebound";

/** Development only: the latest frame on `window.__fiveFrame`, so a test bot
 *  (scripts in the scratchpad, Playwright) can find the ball and the camera. */
function devFrame(f: FiveFrameReport) {
  if (process.env.NODE_ENV !== "production") (window as unknown as { __fiveFrame?: FiveFrameReport }).__fiveFrame = f;
}
const pct = (v: number, of = 1) => `${Math.round((v / Math.max(1e-9, of)) * 100)}%`;

export default function FiveASideTestPage() {
  const [tab, setTab] = useState<Tab>("scenarios");
  useEffect(() => {
    try { const v = localStorage.getItem(TAB_KEY); if (v === "scenarios" || v === "match" || v === "data") setTab(v); } catch { /* private window */ }
  }, []);
  const pickTab = (t: Tab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* private window */ } };

  const [level, setLevel] = useState(1);
  const [skill, setSkill] = useState(70);
  const difficulty = LEVELS[level].difficulty;

  // A scenario picked from the Data tab opens here.
  const [kind, setKind] = useState<FiveScenarioKind>("yours");
  const [pic, setPic] = useState(0);
  const openScenario = (k: FiveScenarioKind, i: number) => { setKind(k); setPic(i); pickTab("scenarios"); };

  // Secondary: they restart what is playing, so they sit beside the pitch
  // (under it on a phone), never between you and it.
  const dials = (
    <Panel title="Settings" note="changing one starts again">
      <div className="fv-dials">
        <div className="fv-row"><Label>Opposition</Label>
          {LEVELS.map((l, i) => <Pill key={l.label} on={level === i} onClick={() => setLevel(i)}>{l.label}</Pill>)}
        </div>
        <div className="fv-row"><Label>Your skill</Label>
          {SKILLS.map((v) => <Pill key={v} on={skill === v} onClick={() => setSkill(v)}>{v}</Pill>)}
        </div>
      </div>
    </Panel>
  );

  return (
    <BroadcastPage title="Five-a-side" sub="Its chances, a full match with a radar, and what 500 matches add up to.">
      <div className="fv-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className="fv-tab" data-fv-tab={t.key} onClick={() => pickTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "scenarios" && (
        <ScenariosTab kind={kind} setKind={setKind} pic={pic} setPic={setPic} difficulty={difficulty} skill={skill} dials={dials} />
      )}
      {tab === "match" && <MatchTab difficulty={difficulty} skill={skill} dials={dials} />}
      {tab === "data" && <DataTab open={openScenario} />}
      <PageGuide page="/star-fiveaside-dev" />
    </BroadcastPage>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

function ScenariosTab({ kind, setKind, pic, setPic, difficulty, skill, dials }: {
  kind: FiveScenarioKind; setKind: (k: FiveScenarioKind) => void;
  pic: number; setPic: (i: number) => void; difficulty: number; skill: number; dials: React.ReactNode;
}) {
  const [roll, setRoll] = useState(0);
  const [result, setResult] = useState<FiveChanceReport | null>(null);
  const [tally, setTally] = useState<Record<string, { tries: number; goals: number }>>({});
  const seed = FIVE_CHANCE_SEEDS[pic];
  const key = `${kind}-${seed}`;
  const go = (i: number) => { setPic((i + FIVE_CHANCE_SEEDS.length) % FIVE_CHANCE_SEEDS.length); setRoll(0); setResult(null); };
  const pickKind = (k: FiveScenarioKind) => { setKind(k); setRoll(0); setResult(null); };
  const again = () => { setRoll((r) => r + 1); setResult(null); };
  // A new picture or kind starts again from roll 1.
  useEffect(() => { setResult(null); }, [kind, pic]);

  const start = useMemo(() => scenarioState(kind, seed), [kind, seed]);
  const onChance = useCallback((c: FiveChanceReport) => {
    setResult(c);
    setTally((t) => {
      const was = t[key] ?? { tries: 0, goals: 0 };
      return { ...t, [key]: { tries: was.tries + 1, goals: was.goals + (isGoal(c.outcome) ? 1 : 0) } };
    });
  }, [key]);

  const bot = DATA.scenarios.find((s) => s.kind === kind && s.seed === seed);
  const mine = tally[key];
  const line = FIVE_SCENARIO_KINDS.find((k) => k.key === kind)?.line;

  return (
    <div className="fv-play">
      <div className="fv-pitch">
        <div className="fv-dock" data-fv-dock>
          <div className="fv-row" style={{ flexWrap: "nowrap" }}>
            {FIVE_SCENARIO_KINDS.map((k) => (
              <Pill key={k.key} on={kind === k.key} onClick={() => pickKind(k.key)} title={k.label}>{k.short}</Pill>
            ))}
          </div>
          <div className="fv-row" style={{ flexWrap: "nowrap" }}>
            <Btn onClick={() => go(pic - 1)} title="The picture before">◀<span className="fv-wide"> Prev</span></Btn>
            <div className="fv-name" data-fv-name>
              {scenarioName(kind, seed)}
              <small>Roll {roll + 1}{result ? ` · ${outcomeWords(result.outcome, result.who)}` : ""}</small>
            </div>
            <Btn main={!!result} onClick={again} title="The same picture, the next roll">↻<span className="fv-wide"> Again</span></Btn>
            <Btn onClick={() => go(pic + 1)} title="The next picture"><span className="fv-wide">Next </span>▶</Btn>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <FiveASide
            key={`${key}-${roll}-${difficulty}-${skill}`}
            embedded autoStart stopAfterChance
            difficulty={difficulty}
            skills={{ power: skill, technique: skill }}
            seed={scenarioRollSeed(seed, roll)}
            resumeFrom={start}
            onComplete={() => { /* a scenario stops after its one chance */ }}
            onChance={onChance}
            onFrame={devFrame}
          />
        </div>
      </div>
      <div className="fv-side">
        <Panel title="This chance" note={`picture ${pic + 1} of ${FIVE_CHANCE_SEEDS.length}`}>
          <div className="fv-muted">{line}</div>
          {result ? (
            <>
              <div className="fv-result" data-fv-result style={{ color: isGoal(result.outcome) ? (kind === "them" ? "#ff8a95" : "#6ff0a8") : "#fff" }}>
                {outcomeWords(result.outcome, result.who)}
              </div>
              <div className="fv-muted">{kindName(result.kind)}. {result.who === "you" && result.assist ? "A team-mate finished your pass." : ""}</div>
            </>
          ) : (
            <div className="fv-muted" data-fv-waiting>
              {kind === "yours" ? "Your ball. Play it." : kind === "mate" ? "Watching your team-mate…" : "They are about to shoot. One tap."}
            </div>
          )}
          {mine && <div className="fv-muted">You here: {mine.goals} {kind === "them" ? "conceded" : "scored"} in {mine.tries} {mine.tries === 1 ? "try" : "tries"}.</div>}
        </Panel>
        {bot && (
          <Panel title="The bot, 200 tries" note="at Even, skill 70">
            <div className="fv-big">{pct(bot.goals, bot.plays)}</div>
            <div className="fv-muted">
              {bot.goals} {kind === "them" ? "goals against you" : "goals"} in {bot.plays}.
              {kind === "yours" ? " The bot shoots for a corner." : kind === "them" ? " No tap: your keeper on his own." : " The game aims his shot, as on screen."}
            </div>
            <OutcomeBar outcomes={bot.outcomes} who={kind === "them" ? "them" : kind === "mate" ? "mate" : "you"} />
            <Note>Again moves to the next roll of the dice. The bot&apos;s tries use the same rolls (roll 1 = try 1), but your screen&apos;s timing can still make a roll end differently.</Note>
          </Panel>
        )}
        {dials}
      </div>
    </div>
  );
}

/** Outcomes as one split bar with words under it. */
function OutcomeBar({ outcomes, who }: { outcomes: Record<string, number>; who: FiveChanceReport["who"] }) {
  const groups = new Map<string, number>();
  for (const [o, n] of Object.entries(outcomes)) groups.set(outcomeWords(o, who), (groups.get(outcomeWords(o, who)) ?? 0) + n);
  const total = Array.from(groups.values()).reduce((a, b) => a + b, 0);
  const rows = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="fv-tablewrap">
      <table className="fv-table">
        <tbody>
          {rows.map(([w, n]) => (
            <tr key={w}>
              <td>{w}</td>
              <td style={{ width: "50%" }}>
                <div title={`${w}: ${n} of ${total}`} style={{ height: 8, borderRadius: 2, background: "#5fa8ff", width: `${(n / Math.max(1, total)) * 100}%`, marginLeft: "auto" }} />
              </td>
              <td>{pct(n, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  FULL MATCH
// ─────────────────────────────────────────────────────────────────────────

function MatchTab({ difficulty, skill, dials }: { difficulty: number; skill: number; dials: React.ReactNode }) {
  const [seed, setSeed] = useState(20261019);
  const [over, setOver] = useState<FiveASideSummary | null>(null);
  const [chances, setChances] = useState<FiveChanceReport[]>([]);
  const [frame, setFrame] = useState<FiveFrameReport | null>(null);
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const latest = useRef<FiveFrameReport | null>(null);
  const onScreen = useRef({ you: 0, them: 0 });
  const [share, setShare] = useState({ you: 0, them: 0 });

  const restart = (s: number) => {
    setSeed(s); setOver(null); setChances([]); setFrame(null); setTrail([]);
    latest.current = null; onScreen.current = { you: 0, them: 0 }; setShare({ you: 0, them: 0 });
  };
  useEffect(() => { restart(seed); /* a new level or skill is a new match */ }, [difficulty, skill]); // eslint-disable-line react-hooks/exhaustive-deps

  // The screen tells us every frame; the radar redraws ten times a second.
  const onFrame = useCallback((f: FiveFrameReport) => {
    latest.current = f;
    devFrame(f);
    if (f.phase !== "done") onScreen.current[f.possession] += 1;
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = latest.current;
      if (!f) return;
      setFrame(f);
      setShare({ ...onScreen.current });
      setTrail((t) => {
        const last = t[t.length - 1];
        if (last && Math.hypot(last.x - f.ball.x, last.y - f.ball.y) < 0.3) return t;
        return [...t.slice(-6), { x: f.ball.x, y: f.ball.y }];
      });
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  const onChance = useCallback((c: FiveChanceReport) => setChances((cs) => [...cs, c]), []);

  const tally = (who: FiveChanceReport["who"]) => {
    const cs = chances.filter((c) => c.who === who);
    return { n: cs.length, goals: cs.filter((c) => isGoal(c.outcome)).length };
  };
  const yours = tally("you"), mates = tally("mate"), theirs = tally("them");
  const score = frame?.score ?? [0, 0];
  const total = share.you + share.them;

  return (
    <div className="fv-play">
      <div className="fv-pitch">
        <div className="fv-row" style={{ marginBottom: 10 }}>
          <Btn main onClick={() => restart(seed + 1 + Math.floor(Math.random() * 9000))}>↻ New match</Btn>
          <span className="fv-muted">Match {seed}</span>
        </div>
        <FiveASide
          key={`match-${seed}-${difficulty}-${skill}`}
          embedded
          difficulty={difficulty}
          skills={{ power: skill, technique: skill }}
          seed={seed}
          onComplete={(s) => setOver(s)}
          onChance={onChance}
          onFrame={onFrame}
        />
      </div>
      <div className="fv-side">
        {over && (
          <Panel title="Full time" note={over.result === "win" ? "You win" : over.result === "loss" ? "You lose" : "A draw"}>
            <div className="fv-big" data-fv-fulltime>{over.scoreline[0]}–{over.scoreline[1]}</div>
            <div className="fv-muted">You scored {over.goals}, set up {over.assists}, in {over.touches} touches. Trial score {Math.round(over.score)} / 100.</div>
            <div><Btn main onClick={() => restart(seed + 1 + Math.floor(Math.random() * 9000))}>↻ Play another</Btn></div>
          </Panel>
        )}
        <div className="fv-pair">
        <Panel title="Match radar" note={frame ? `${Math.floor(frame.minute)}' · ${score[0]}–${score[1]}` : "kick off to start"}>
          <div data-fv-radar><FiveRadar frame={frame} trail={trail} /></div>
          <div className="fv-legend">
            <span style={{ ["--c" as string]: US }}>Your side</span>
            <span style={{ ["--c" as string]: THEM }}>Them</span>
            <span style={{ ["--c" as string]: "#ffe066" }}>You (ringed)</span>
            <span style={{ ["--c" as string]: "#ffffff" }}>Ball</span>
          </div>
          {frame && (
            <div className="fv-muted">
              {frame.possession === "them" ? "They have it" : "Your side have it"}, in {bandName(frame.ball.y)}.
            </div>
          )}
        </Panel>
        <Panel title="This match" note="chances played through the engine">
          <div className="fv-tablewrap">
            <table className="fv-table">
              <thead><tr><th>Who</th><th>Chances</th><th>Goals</th></tr></thead>
              <tbody>
                <tr><td><Dot c={US} />You</td><td>{yours.n}</td><td>{yours.goals}</td></tr>
                <tr><td><Dot c={MATE} />Team-mates</td><td>{mates.n}</td><td>{mates.goals}</td></tr>
                <tr><td><Dot c={THEM} />Them</td><td>{theirs.n}</td><td>{theirs.goals}</td></tr>
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <>
              <Label>Time on the ball (screen time)</Label>
              <div className="fv-split" title={`Yours ${pct(share.you, total)}, theirs ${pct(share.them, total)}`}>
                <div style={{ width: `${(share.you / total) * 100}%`, background: US }} />
                <div style={{ flex: 1, background: THEM }} />
              </div>
              <div className="fv-muted">Yours {pct(share.you, total)} · theirs {pct(share.them, total)}. Team-mates&apos; goals the match rolls between chances show on the score only.</div>
            </>
          )}
          <div className="fv-feed" data-fv-feed>
            {[...chances].reverse().map((c, i) => (
              <div key={chances.length - i}>
                <b>{Math.floor(c.minute)}&apos;</b>
                <span><Dot c={c.who === "them" ? THEM : c.who === "mate" ? MATE : US} />{c.who === "you" ? "You" : c.who === "mate" ? "Team-mate" : "Them"} · {kindName(c.kind)}</span>
                <span style={{ fontWeight: 800 }}>{outcomeWords(c.outcome, c.who)}</span>
              </div>
            ))}
          </div>
        </Panel>
        </div>
        {dials}
      </div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span aria-hidden style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: c, marginRight: 6, verticalAlign: -1 }} />;
}

// ─────────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────────

function DataTab({ open }: { open: (k: FiveScenarioKind, i: number) => void }) {
  const d = DATA;
  const N = d.settings.matches;
  const bad = d.health.filter((h) => !h.ok);
  const g = d.goalsBy;
  const scorers = [
    { label: "You (your own shot)", n: g.you, c: US },
    { label: "Team-mate, off your pass", n: g.assist, c: MATE },
    { label: "Team-mate, watched", n: g.mateWatched, c: MATE },
    { label: "Team-mate, rolled by the match", n: g.mateRolled, c: MATE },
    { label: "Them, watched", n: g.themWatched, c: THEM },
  ];
  const maxScorer = Math.max(1, ...scorers.map((s) => s.n));
  const shotsUs = d.shotsPerMatch.you + d.shotsPerMatch.mate + d.shotsPerMatch.rolledMate;
  const shotsThem = d.shotsPerMatch.them + d.shotsPerMatch.rolledThem;
  const deadPictures = FIVE_CHANCE_SEEDS
    .map((seed, i) => ({ i: i + 1, r: d.scenarios.find((s) => s.kind === "yours" && s.seed === seed) }))
    .filter((x) => x.r && x.r.goals === 0).map((x) => x.i);

  return (
    <>
      <Note>
        {`${N} whole five-a-side matches, played by the real five-a-side code with a bot for your thumb, at Even and skill ${d.settings.skill} `
          + `(your keeper ${d.settings.yourKeeper}, theirs ${d.settings.theirKeeper}). Made ${d.made}. Same seeds every time, so the numbers only move when the game does.`}
      </Note>
      <Panel title="What looks broken" note={bad.length ? `${bad.length} of ${d.health.length} checks fail` : "every check passes"}>
        <ul className="fv-health" data-fv-health>
          {bad.map((h) => <HealthRow key={h.label} h={h} />)}
        </ul>
        {bad.some((h) => h.label.startsWith("A pass")) && (
          <Note>Why the pass check fails: a five-a-side chance never names a receiver for the engine, so a team-mate who gets your pass in the last third keeps it instead of shooting. You can never get an assist, though the five-a-side&apos;s own notes say he shoots. Not changed here: it is a gameplay call.</Note>
        )}
        <details>
          <summary className="fv-muted" style={{ cursor: "pointer" }}>{d.health.length - bad.length} checks pass</summary>
          <ul className="fv-health" style={{ marginTop: 8 }}>
            {d.health.filter((h) => h.ok).map((h) => <HealthRow key={h.label} h={h} />)}
          </ul>
        </details>
      </Panel>

      <div className="fv-tiles" data-fv-tiles>
        <div className="fv-tile"><b>{d.goalsPerMatch.us.toFixed(2)}–{d.goalsPerMatch.them.toFixed(2)}</b><span>goals a match, yours–theirs</span></div>
        <div className="fv-tile"><b>{pct(d.results.win, N)}</b><span>won · {pct(d.results.draw, N)} drawn · {pct(d.results.loss, N)} lost</span></div>
        <div className="fv-tile"><b>{shotsUs.toFixed(1)}–{shotsThem.toFixed(1)}</b><span>shots a match, yours–theirs</span></div>
        <div className="fv-tile"><b>{pct(d.possessionYou)}</b><span>of the ball is your side&apos;s</span></div>
        <div className="fv-tile"><b>{d.touchesPerMatch.toFixed(1)}</b><span>touches of yours a match ({d.passesPerMatch.toFixed(1)} passes, {pct(d.passCompletion)} reach a man)</span></div>
      </div>

      <PanelGrid min={340}>
        <Panel title="Goals in a match" note="both sides, matches">
          <Histogram counts={d.goalsHistogram} />
          <div className="fv-muted">Commonest scores: {d.scorelines.slice(0, 5).map((s) => `${s.score} (${s.n})`).join(", ")}.</div>
        </Panel>
        <Panel title="Who scores" note={`all ${N} matches`}>
          <div className="fv-tablewrap">
            <table className="fv-table" data-fv-scorers>
              <tbody>
                {scorers.map((s) => (
                  <tr key={s.label}>
                    <td><Dot c={s.c} />{s.label}</td>
                    <td style={{ width: "40%" }}>
                      <div title={`${s.label}: ${s.n} goals, ${(s.n / N).toFixed(2)} a match`} style={{ height: 10, borderRadius: 2, background: s.c, width: `${(s.n / maxScorer) * 100}%`, minWidth: s.n ? 3 : 0 }} />
                    </td>
                    <td>{s.n}</td>
                    <td>{(s.n / N).toFixed(2)}/m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fv-muted">&quot;Watched&quot; = played through the engine on screen. &quot;Rolled&quot; = a goal the match decides between chances, shown as a caption.</div>
        </Panel>
      </PanelGrid>

      <PanelGrid min={340}>
        <Panel title="Chance kinds" note="engine chances, how many went in">
          <div className="fv-tablewrap">
            <table className="fv-table">
              <thead><tr><th>Kind</th><th>You</th><th><span className="fv-wide">Team-mates</span><span className="fv-narrow">Mates</span></th><th>Them</th></tr></thead>
              <tbody>
                {d.kinds.map((k) => (
                  <tr key={k.kind}>
                    <td>{kindName(k.kind)}</td>
                    {(["you", "mate", "them"] as const).map((w) => (
                      <td key={w}>{k[w].n ? `${k[w].n} · ${pct(k[w].goals, k[w].n)}` : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fv-muted">Your build-up and midfield passes are passes, so they never score by themselves.</div>
        </Panel>
        <Panel title="How chances end" note="share of each side's engine chances">
          <OutcomeTable outcomes={d.outcomes} />
        </Panel>
      </PanelGrid>

      <Panel title="Each scenario, 200 tries" note="tap one to play it">
        <div className="fv-tablewrap">
          <table className="fv-table" data-fv-scenarios>
            <thead><tr><th>Picture</th>{FIVE_SCENARIO_KINDS.map((k) => <th key={k.key} style={{ textAlign: "center" }}><span className="fv-wide">{k.label}</span><span className="fv-narrow">{k.short}</span></th>)}</tr></thead>
            <tbody>
              {FIVE_CHANCE_SEEDS.map((seed, i) => (
                <tr key={seed}>
                  <td>{i + 1}</td>
                  {FIVE_SCENARIO_KINDS.map((k) => {
                    const r = d.scenarios.find((s) => s.kind === k.key && s.seed === seed);
                    const share = r ? r.goals / Math.max(1, r.plays) : 0;
                    return (
                      <td key={k.key} style={{ padding: 3 }}>
                        <button className="fv-cell" onClick={() => open(k.key, i)} title={r ? `${r.name}: ${r.goals} goals in ${r.plays}` : ""}
                          style={{ background: `rgba(57, 135, 229, ${0.08 + share * 0.85})` }}>
                          {r ? pct(r.goals, r.plays) : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fv-muted">
          Goals per 200 tries. Their attack is the team-mate&apos;s picture turned round, so the two columns share a shot; theirs mostly goes in less because your keeper ({d.settings.yourKeeper}) is better than theirs ({d.settings.theirKeeper}).
          {deadPictures.length > 0 && ` Picture${deadPictures.length > 1 ? "s" : ""} ${deadPictures.join(" and ")} never went in for the bot: most shots are blocked.`}
        </div>
      </Panel>

      <PanelGrid min={340}>
        <Panel title="The ball" note="whole matches">
          <div className="fv-split" title={`Yours ${pct(d.possessionYou)}, theirs ${pct(1 - d.possessionYou)}`}>
            <div style={{ width: `${d.possessionYou * 100}%`, background: US }} />
            <div style={{ flex: 1, background: THEM }} />
          </div>
          <div className="fv-legend"><span style={{ ["--c" as string]: US }}>Your side {pct(d.possessionYou)}</span><span style={{ ["--c" as string]: THEM }}>Them {pct(1 - d.possessionYou)}</span></div>
          <div className="fv-tablewrap">
            <table className="fv-table">
              <thead><tr><th>Longest spell</th><th>Typical</th><th>1 in 10</th><th>Longest</th></tr></thead>
              <tbody>
                <tr><td><Dot c={US} />Your side</td><td>{d.longestSpell.you.median} min</td><td>{d.longestSpell.you.p90} min</td><td>{d.longestSpell.you.max} min</td></tr>
                <tr><td><Dot c={THEM} />Them</td><td>{d.longestSpell.them.median} min</td><td>{d.longestSpell.them.p90} min</td><td>{d.longestSpell.them.max} min</td></tr>
              </tbody>
            </table>
          </div>
          <div className="fv-muted">A match is 45 minutes. A spell ends when the ball changes sides.</div>
        </Panel>
        <Panel title="Harder opposition" note="same bot, other levels">
          <div className="fv-tablewrap">
            <table className="fv-table">
              <thead><tr><th>Opposition</th><th>Matches</th><th>Goals</th><th>Won</th></tr></thead>
              <tbody>
                {d.byDifficulty.map((r) => (
                  <tr key={r.label}><td>{r.label}</td><td>{r.matches}</td><td>{r.us.toFixed(2)}–{r.them.toFixed(2)}</td><td>{pct(r.winShare)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="fv-muted">
            <summary style={{ cursor: "pointer" }}>How the bot plays</summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.settings.bot.map((b) => <li key={b}>{b}</li>)}</ul>
          </details>
        </Panel>
      </PanelGrid>
    </>
  );
}

function HealthRow({ h }: { h: FiveSimSummary["health"][number] }) {
  return (
    <li>
      <i data-ok={h.ok ? "true" : "false"} aria-label={h.ok ? "passes" : "fails"}>{h.ok ? "✓" : "✗"}</i>
      <span>{h.label}<small>{h.detail}</small></span>
    </li>
  );
}

/** Matches by total goals, one bar each. */
function Histogram({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const W = 340, H = 150, padB = 20, padT = 16, gap = 4;
  const bw = (W - gap * (counts.length - 1)) / counts.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 220, display: "block" }} role="img" aria-label="Matches by total goals" data-fv-histogram>
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.25)" />
      {counts.map((n, i) => {
        const h = ((H - padB - padT) * n) / max;
        const x = i * (bw + gap);
        const label = i === counts.length - 1 ? `${i}+` : String(i);
        return (
          <g key={i}>
            <title>{`${label} goals: ${n} matches`}</title>
            <rect x={x} y={H - padB - h} width={bw} height={Math.max(0, h)} rx={4} fill={US} />
            <rect x={x} y={H - padB - Math.min(h, 4)} width={bw} height={Math.min(h, 4)} fill={US} />
            {n > 0 && <text x={x + bw / 2} y={H - padB - h - 4} textAnchor="middle" fontSize={10} fill="#cfe0ff">{n}</text>}
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill="#a9bde2" fontWeight={800}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function OutcomeTable({ outcomes }: { outcomes: FiveSimSummary["outcomes"] }) {
  const who = ["you", "mate", "them"] as const;
  const words = new Map<string, Record<(typeof who)[number], number>>();
  const totals = { you: 0, mate: 0, them: 0 };
  for (const w of who) {
    for (const [o, n] of Object.entries(outcomes[w])) {
      // One wording for every side here: what happened to the ball.
      const label = outcomeWords(o, "you");
      const row = words.get(label) ?? { you: 0, mate: 0, them: 0 };
      row[w] += n;
      words.set(label, row);
      totals[w] += n;
    }
  }
  const rows = Array.from(words.entries()).sort((a, b) => (b[1].you + b[1].mate + b[1].them) - (a[1].you + a[1].mate + a[1].them));
  return (
    <div className="fv-tablewrap">
      <table className="fv-table">
        <thead><tr><th>Ends</th><th>You</th><th><span className="fv-wide">Team-mates</span><span className="fv-narrow">Mates</span></th><th>Them</th></tr></thead>
        <tbody>
          {rows.map(([label, r]) => (
            <tr key={label}><td>{label}</td>{who.map((w) => <td key={w}>{pct(r[w], totals[w])}</td>)}</tr>
          ))}
          <tr><td>Chances</td>{who.map((w) => <td key={w}>{totals[w]}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
