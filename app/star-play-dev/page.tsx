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
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import InfiniteMatch from "@/components/star/InfiniteMatch";
import PageGuide from "@/components/admin/PageGuide";
import {
  loadPlaySettings, savePlaySettings,
  PLAY_RANGES, PLAY_POSITIONS, PLAY_DIVISIONS, DEFAULT_PLAY_SETTINGS,
  type PlaySettings,
} from "@/lib/star/playArea";

const BG = "#05070d";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";
const CARD = "rgba(255,255,255,0.04)";

type Screen = "home" | "match";

export default function PlayAreaPage() {
  const [screen, setScreen] = useState<Screen>("home");
  // Read once on mount rather than at first render: localStorage does not
  // exist on the server, and reading it during render is what makes a page
  // hydrate to something different from what it rendered.
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_PLAY_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSettings(loadPlaySettings()); setReady(true); }, []);

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

  const shell = (body: React.ReactNode) => (
    <div style={{ minHeight: "100dvh", background: BG, color: INK }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>{body}</div>
      <PageGuide page="/star-play-dev" />
    </div>
  );

  const header = (title: string, back?: () => void) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 10px",
      position: "sticky", top: 0, background: BG, zIndex: 5,
    }}>
      {back && (
        <button onClick={back} aria-label="Back" style={{
          width: 34, height: 34, borderRadius: 999, flex: "none", cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
          color: INK, fontSize: 17, fontWeight: 800, lineHeight: 1,
        }}>&#8249;</button>
      )}
      <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: "-0.01em" }}>{title}</h1>
    </div>
  );

  if (!ready) return shell(header("Play Area"));

  if (screen === "match") {
    return shell(
      <>
        {header("Infinite Match", () => setScreen("home"))}
        <InfiniteMatch settings={settings} onBack={() => setScreen("home")} />
      </>,
    );
  }

  return shell(
    <>
      {header("Play Area")}
      <div style={{ padding: "0 14px 40px", display: "grid", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED, lineHeight: 1.55 }}>
          Two ways of looking at the game, and the dials both of them run on.
          Change a number here and it applies to whichever you open next.
        </p>

        <Link
          href="/star-highlights-dev"
          style={{ ...tile, textDecoration: "none", display: "block", color: INK }}
        >
          <div style={tileTitle}>Infinite Highlights &#8594;</div>
          <div style={tileSub}>
            Every chance the generator can make, one after another, as fast as you
            can press Next. Flag a bad one, drag a defender, save the fix, or record
            a correction with Tune.
          </div>
        </Link>

        <button onClick={() => setScreen("match")} style={{ ...tile, cursor: "pointer", textAlign: "left" }}>
          <div style={tileTitle}>Infinite Match &#8594;</div>
          <div style={tileSub}>
            A real match that runs for {settings.matchMinutes.toLocaleString()} minutes, with a
            running count of what it actually served you. This is the one that answers
            &ldquo;why am I never getting one-on-ones&rdquo; — the generator and the match
            are different questions.
          </div>
        </button>

        {/* ── THE DIALS ── */}
        <section style={{ ...tile, cursor: "default" }}>
          <div style={tileTitle}>Tuning</div>
          <div style={{ ...tileSub, marginBottom: 12 }}>
            You, your boots and who you are playing. Saved on this device, shared by
            both modes above.
          </div>

          <Slider label="Power" hint="How hard the same drag hits."
            value={settings.power} range={PLAY_RANGES.power} onChange={(v) => set("power", v)} />
          <Slider label="Technique" hint="Placement, and how much you can bend it at all."
            value={settings.technique} range={PLAY_RANGES.technique} onChange={(v) => set("technique", v)} />
          <Slider label="Opposition" hint="How good the side you are playing is."
            value={settings.oppStrength} range={PLAY_RANGES.oppStrength} onChange={(v) => set("oppStrength", v)} />
          <Slider label="Keeper" hint="The one number his reach scales off."
            value={settings.keeperStrength} range={PLAY_RANGES.keeperStrength} onChange={(v) => set("keeperStrength", v)} />
          <Slider label="Match length" hint="Minutes an Infinite Match runs for." step={10}
            value={settings.matchMinutes} range={PLAY_RANGES.matchMinutes} onChange={(v) => set("matchMinutes", v)} />

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

          <button
            onClick={() => setSettings(savePlaySettings({ ...DEFAULT_PLAY_SETTINGS }))}
            style={{
              marginTop: 12, width: "100%", height: 38, borderRadius: 11, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
              color: MUTED, fontSize: 12.5, fontWeight: 700,
            }}
          >
            Back to the defaults
          </button>
        </section>

        <Link href="/star-gallery-dev" style={{ ...tile, textDecoration: "none", display: "block", color: INK }}>
          <div style={tileTitle}>Scenario Gallery &#8594;</div>
          <div style={tileSub}>
            Where the drawings live, and Tuning &amp; Commit with the rule set, the
            proposals and the last check before anything goes into the code.
          </div>
        </Link>
      </div>
    </>,
  );
}

/* ── Bits ─────────────────────────────────────────────────────────────── */

function Slider({ label, hint, value, range, step = 1, onChange }: {
  label: string; hint: string; value: number;
  range: readonly [number, number]; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#7dd3fc", fontFamily: "ui-monospace, monospace" }}>
          {value.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, marginBottom: 5 }}>{hint}</div>
      <input
        type="range"
        min={range[0]} max={range[1]} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#38bdf8" }}
      />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{label}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{hint}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 12px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
        border: `1px solid ${on ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.09)"}`,
        background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.045)",
        color: on ? "#e0f2fe" : MUTED, fontSize: 12.5, fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

const tile: React.CSSProperties = {
  width: "100%", padding: "14px 15px", borderRadius: 16,
  background: CARD, border: "1px solid rgba(255,255,255,0.08)",
};

const tileTitle: React.CSSProperties = {
  fontSize: 15.5, fontWeight: 900, color: INK, letterSpacing: "-0.01em",
};

const tileSub: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: MUTED, lineHeight: 1.55, marginTop: 4,
};
