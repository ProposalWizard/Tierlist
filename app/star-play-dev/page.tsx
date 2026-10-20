"use client";

/**
 * THE PLAY AREA — every way of looking at the game, behind one door, with one
 * set of dials on top of all of it.
 *
 * Asked for directly: "I think we should have a play area hub, with infinite
 * highlights, infinite match and then tuning added on top (power, curve,
 * boots, opposition level etc.)".
 *
 * The two modes it opens were already built and already separate. What was
 * missing is the third thing in that sentence — the dials. Power, technique,
 * curving boots, extra-touch boots, how good the opposition is, which
 * position you play: all of those change what the game feels like, all of
 * them were fixed at whatever a dev page happened to hard-code, and none of
 * them could be changed without a code edit. They live in one place now
 * (lib/star/playArea.ts) and both modes read the same set, so a number set
 * here means the same thing in either.
 *
 * Infinite Highlights stays on its own route rather than being pulled in
 * here: it is a real screen with its own flag list, its own chance picker and
 * its own editor, and copying it in would mean two of it. The hub links to
 * it — one door, not one file.
 *
 * Look (Harry, 19 Oct 2026, UI lookover, option 1): the Broadcast frame. The
 * two doors are picture cards (real stills in public/admin/play-area/), the
 * dials sit in two columns on a computer. Infinite Match itself is untouched.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import InfiniteMatch from "@/components/star/InfiniteMatch";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./play-area.css";
import {
  loadPlaySettings, savePlaySettings,
  PLAY_RANGES, PLAY_POSITIONS, PLAY_DIVISIONS, DEFAULT_PLAY_SETTINGS,
  type PlaySettings,
} from "@/lib/star/playArea";
import { COMPARE_SWITCHES, switchOn, setSwitch, resetSwitches, type CompareSwitch } from "@/lib/star/compareSwitches";
import { BRAIN_DIAL_FLAG, type OpenPlayDial } from "@/lib/star/keeperBrain";
import { PRESSURE_DIALS } from "@/lib/star/pressure";
import { PENALTY_RUNUPS, FREE_KICK_RUNUPS } from "@/lib/star/runupStyles";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { setLookRow } from "@/lib/star/lookRows";

type Screen = "home" | "match";

export default function PlayAreaPage() {
  const [screen, setScreen] = useState<Screen>("home");
  const fhr = useFhrMode();
  // Read once on mount rather than at first render: localStorage does not
  // exist on the server, and reading it during render is what makes a page
  // hydrate to something different from what it rendered.
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_PLAY_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSettings(loadPlaySettings()); setReady(true); }, []);
  // v0.15's compare switches (lib/star/compareSwitches.ts): this device's
  // test screens only — never the real game.
  const [compare, setCompare] = useState<Record<CompareSwitch, boolean> | null>(null);
  useEffect(() => {
    setCompare(Object.fromEntries(COMPARE_SWITCHES.map((c) => [c.id, switchOn(c.id)])) as Record<CompareSwitch, boolean>);
  }, []);
  const flip = (id: CompareSwitch, on: boolean) => {
    setSwitch(id, on);
    setCompare((c) => (c ? { ...c, [id]: on } : c));
  };

  // A full-screen dev tool: the site's own nav and footer get out of the way,
  // exactly as /star-gallery-dev and /star-highlights-dev do it.
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  /** Every change saves immediately — there is no Save button, because there
   *  is nothing here you would want to set and then discard. */
  const set = <K extends keyof PlaySettings>(k: K, v: PlaySettings[K]) => {
    setSettings((s) => savePlaySettings({ ...s, [k]: v }));
  };

  if (!ready) return (
    <BroadcastPage title="Play Area">
      <PageGuide page="/star-play-dev" />
    </BroadcastPage>
  );

  // The match screen: the frame's bar on top, Infinite Match itself untouched
  // underneath. The bar is not pinned: Infinite Match's own Edit / Save /
  // Commit bar is the one that stays, and a second pinned bar would push the
  // goal end of the pitch under the bars on a phone.
  if (screen === "match") {
    return (
      <BroadcastPage title="Infinite Match" back={() => setScreen("home")} width={900}>
        <div className="pa-match">
          <InfiniteMatch settings={settings} onBack={() => setScreen("home")} />
        </div>
        <PageGuide page="/star-play-dev" />
      </BroadcastPage>
    );
  }

  return (
    <BroadcastPage
      title="Play Area"
      sub="Two ways of looking at the game, and the dials both run on. Change a number and it applies to whichever you open next."
      width={1180}
    >
      {/* The entrance (Harry: "the entrance to it was good"): the two doors, as picture cards. */}
      <div className="pa-doors">
        <Link href="/star-highlights-dev" className="pa-door">
          <div className="pa-pic" style={{ backgroundImage: "url(/admin/play-area/highlights.webp)" }}>
            <b>Infinite Highlights &#8594;</b>
          </div>
          <p>
            Every chance the generator can make, one after another, as fast as you
            can press Next. Flag a bad one, drag a defender, save the fix, or record
            a correction with Tune.
          </p>
        </Link>

        <button onClick={() => setScreen("match")} className="pa-door">
          <div className="pa-pic" style={{ backgroundImage: "url(/admin/play-area/match.webp)", backgroundPosition: "center 12%" }}>
            <b>Infinite Match &#8594;</b>
          </div>
          <p>
            A real match that runs for {settings.matchMinutes.toLocaleString()} minutes, with a
            running count of what it actually served you. This is the one that answers
            &ldquo;why am I never getting one-on-ones&rdquo; — the generator and the match
            are different questions.
          </p>
        </button>
      </div>

      {/* The link cards to other test pages went (Harry, ADM-Q56): the admin side menu has every page. */}

      {/* Full highlights rebuild (Harry, 20 Oct 2026): a Settings switch, not an admin card. With it
          On, both doors play the build-ups; its test area (Ruler / Build-ups) is reached from here. */}
      <Panel title="Full highlights rebuild" note="this phone · also in Settings">
        <Note>On: both doors above play a build-up before each chance, as a career match does. Each door has its own Moment / Length / Intensity dials.</Note>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Pill on={fhr === "off"} onClick={() => setLookRow("fhr", "off")}>Off</Pill>
          <Pill on={fhr === "on"} onClick={() => setLookRow("fhr", "on")}>On</Pill>
          <Btn href="/star-fhr-dev">Ruler and build-ups &#8594;</Btn>
        </div>
      </Panel>

      {/* ── THE DIALS ── */}
      <Panel title="Tuning" note="Saved on this device">
        <Note>
          You, your boots and who you are playing. Every dial starts on the real
          game, and a change here only reaches the test screens — Infinite
          Highlights, Infinite Match and the gallery&apos;s Play — never a career.
        </Note>
        <div className="pa-dials">
          <div className="pa-col">
            <Slider label="Power" hint="How hard the same drag hits."
              value={settings.power} range={PLAY_RANGES.power} onChange={(v) => set("power", v)} />
            <Slider label="Technique" hint="Placement, and how much you can bend it at all."
              value={settings.technique} range={PLAY_RANGES.technique} onChange={(v) => set("technique", v)} />
            <Slider label="Opposition" hint="How good the side you are playing is."
              value={settings.oppStrength} range={PLAY_RANGES.oppStrength} onChange={(v) => set("oppStrength", v)} />
            <Row label="Keeper" hint="Real: the opposition's own starting keeper, as in a career. Set: the slider below decides.">
              <Toggle on={settings.realKeeper} onClick={() => set("realKeeper", true)}>Real</Toggle>
              <Toggle on={!settings.realKeeper} onClick={() => set("realKeeper", false)}>Set</Toggle>
            </Row>
            {!settings.realKeeper && (
              <Slider label="Keeper rating" hint="The one number his reach scales off."
                value={settings.keeperStrength} range={PLAY_RANGES.keeperStrength} onChange={(v) => set("keeperStrength", v)} />
            )}
            <KeeperBrainRows />
            <Row label="Weather" hint="Real: the game's own weather, windy or wet about 4 matches in 10. Clear: still air, perfect pitch.">
              <Toggle on={settings.weather === "real"} onClick={() => set("weather", "real")}>Real</Toggle>
              <Toggle on={settings.weather === "clear"} onClick={() => set("weather", "clear")}>Clear</Toggle>
            </Row>
            <Slider label="Match length" hint="Minutes an Infinite Match runs for." step={10}
              value={settings.matchMinutes} range={PLAY_RANGES.matchMinutes} onChange={(v) => set("matchMinutes", v)} />
          </div>

          <div className="pa-col">
            <Row label="Boots" hint="Curving boots bend it; touch boots give you a second go from where it settles.">
              <Toggle on={settings.curve} onClick={() => set("curve", !settings.curve)}>Curve</Toggle>
              <Toggle on={settings.extraTouch} onClick={() => set("extraTouch", !settings.extraTouch)}>Extra touch</Toggle>
            </Row>

            <Row label="Position" hint="Tilts which chances you are likeliest to be the one taking.">
              {PLAY_POSITIONS.map((p) => (
                <Toggle key={p} on={settings.position === p} onClick={() => set("position", p)}>{p}</Toggle>
              ))}
            </Row>

            <Row label="Division" hint="The standard of club around you, and so how strong your own side is.">
              {PLAY_DIVISIONS.map((d) => (
                <Toggle key={d.id} on={settings.division === d.id} onClick={() => set("division", d.id)}>
                  {d.label}
                </Toggle>
              ))}
            </Row>

            <Row label="Pressure" hint="While you pull back, the nearest opponent closes you down; if he gets there you're tackled, or fouled about 1 time in 3 (2 in 3 if he comes from behind you — he goes round you, never through) — a free kick, or a penalty in the box. Real: Premier League full, Championship light, lower none.">
              {PRESSURE_DIALS.map((d) => (
                <Toggle key={d.id} on={settings.pressure === d.id} onClick={() => set("pressure", d.id)}>
                  {d.label}
                </Toggle>
              ))}
            </Row>

            <Row label="Penalty run-up" hint="How you run up to a penalty — every style, owned or not, to see each one on the real pitch. Looks only: the kick is the same. Test screens only; a career uses the one it has equipped in Settings.">
              {PENALTY_RUNUPS.map((r) => (
                <Toggle key={r.id} on={settings.penaltyRunup === r.id} onClick={() => set("penaltyRunup", r.id)}>
                  {r.name}
                </Toggle>
              ))}
            </Row>
            <Row label="Free-kick run-up" hint="How you run up to a direct free kick — a separate set, each modelled on an elite free-kick taker. Looks only: the kick is the same. Test screens only.">
              {FREE_KICK_RUNUPS.map((r) => (
                <Toggle key={r.id} on={settings.freeKickRunup === r.id} onClick={() => set("freeKickRunup", r.id)}>
                  {r.name}
                </Toggle>
              ))}
            </Row>
          </div>
        </div>

        <div className="pa-reset">
          <Btn
            onClick={() => {
              setSettings(savePlaySettings({ ...DEFAULT_PLAY_SETTINGS }));
              try { localStorage.removeItem(BRAIN_DIAL_FLAG); } catch { /* private mode */ }
              resetSwitches();
              setCompare(Object.fromEntries(COMPARE_SWITCHES.map((c) => [c.id, true])) as Record<CompareSwitch, boolean>);
              window.dispatchEvent(new Event("keeper-brain-reset"));
            }}
          >
            Back to the defaults
          </Btn>
        </div>
      </Panel>

      {/* ── COMPARE OLD AND NEW (v0.15) ── */}
      {compare && (
        <Panel title="Compare old and new" note="Each starts on New">
          <Note>
            This device&apos;s test screens only (the gallery, highlights, Infinite Match) — never a real career match or the trial.
          </Note>
          <div className="pa-dials">
            {COMPARE_SWITCHES.map((c) => (
              <Row key={c.id} label={c.label} hint={c.hint}>
                <Toggle on={compare[c.id]} onClick={() => flip(c.id, true)}>New</Toggle>
                <Toggle on={!compare[c.id]} onClick={() => flip(c.id, false)}>Old</Toggle>
              </Row>
            ))}
          </div>
        </Panel>
      )}

      <PageGuide page="/star-play-dev" />
    </BroadcastPage>
  );
}

/* ── The keeper brain's one dial ─────────────────────────────────────────
 * The keeper brain (lib/star/keeperBrain.ts) is on everywhere, at Middle.
 * This row picks Hard or Easier on this device's test screens only — the
 * brain reads it itself (openPlayDialHere), and never in the real game. */
function KeeperBrainRows() {
  const [dial, setDial] = useState<OpenPlayDial>("middle");
  useEffect(() => {
    const read = () => {
      try {
        const d = localStorage.getItem(BRAIN_DIAL_FLAG);
        setDial(d === "hard" || d === "easier" ? d : "middle");
      } catch { /* private mode */ }
    };
    read();
    window.addEventListener("keeper-brain-reset", read);
    return () => window.removeEventListener("keeper-brain-reset", read);
  }, []);
  const put = (v: OpenPlayDial) => {
    try {
      if (v === "middle") localStorage.removeItem(BRAIN_DIAL_FLAG);
      else localStorage.setItem(BRAIN_DIAL_FLAG, v);
    } catch { /* private mode */ }
  };
  return (
    <Row label="Keeper: long shots & through balls" hint="How well the keeper reads a shot from distance. Middle is the game (an 88 keeper lets in about 8% of long shots, a 45 about 24%). Hard: fewer go in. Easier: more. Test screens only.">
      {(["hard", "middle", "easier"] as OpenPlayDial[]).map((d) => (
        <Toggle key={d} on={dial === d} onClick={() => { setDial(d); put(d); }}>
          {d === "hard" ? "Hard" : d === "middle" ? "Middle" : "Easier"}
        </Toggle>
      ))}
    </Row>
  );
}

/* ── Bits ─────────────────────────────────────────────────────────────── */

function Slider({ label, hint, value, range, step = 1, onChange }: {
  label: string; hint: string; value: number;
  range: readonly [number, number]; step?: number; onChange: (v: number) => void;
}) {
  const pct = ((value - range[0]) / Math.max(1, range[1] - range[0])) * 100;
  return (
    <div className="pa-dial">
      <div className="pa-dh"><span>{label}</span><b>{value.toLocaleString()}</b></div>
      <div className="pa-hint">{hint}</div>
      <input
        type="range" className="pa-range" aria-label={label}
        min={range[0]} max={range[1]} step={step} value={value}
        style={{ ["--pa-fill" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="pa-dial">
      <div className="pa-dh"><span>{label}</span></div>
      <div className="pa-hint">{hint}</div>
      <div className="pa-pills">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Pill on={on} onClick={onClick}>{children}</Pill>;
}
