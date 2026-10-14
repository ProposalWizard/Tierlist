"use client";

/**
 * OCT 13 UPDATE TEST AREA — the whole gameplay update behind one Old | New
 * switch (lib/star/oct13Update.ts), each part on its own row, and the Match
 * feel pictures. Per phone: New here also plays in your real career matches.
 */
import { useEffect } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import FeelPreview from "@/components/star/FeelPreview";
import { LOOK_ROWS, setLookRow, useLook, type LookRowId } from "@/lib/star/lookRows";
import { GAMEPLAY_SWITCHES, type GameplaySwitch } from "@/lib/star/gameplayVersion";
import { OCT13_PARTS, OCT13_WITH, oct13State, setOct13 } from "@/lib/star/oct13Update";

const BG = "#05070d", INK = "#f2f5f9", MUTED = "#8a97aa", CARD = "rgba(255,255,255,0.05)";

const MATCH_FEEL_NOTE = { newText: "Every hit is felt: wind-up, a short freeze at contact, flash, streak, deeper kick sound and a buzz, bigger the harder you hit. Thuds, net bulge, post clang, keeper hops.", oldText: "As before." };

function noteFor(id: LookRowId, v: string): string {
  const s = id === "matchFeel" ? MATCH_FEEL_NOTE : GAMEPLAY_SWITCHES[id as GameplaySwitch];
  if (!s) return "";
  return v === "new" ? s.newText : s.oldText;
}

export default function UpdateTestPage() {
  const look = useLook();
  const state = oct13State(look);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  const pill = (on: boolean): React.CSSProperties => ({
    height: 30, padding: "0 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)",
    background: on ? "#facc15" : "rgba(255,255,255,0.06)", color: on ? "#111" : INK, fontWeight: 800, fontSize: 12, cursor: "pointer",
  });
  const card: React.CSSProperties = { background: CARD, borderRadius: 14, padding: 12, border: "1px solid rgba(255,255,255,0.08)" };
  const big = (on: boolean): React.CSSProperties => ({
    flex: 1, height: 52, borderRadius: 12, border: "2px solid " + (on ? "#facc15" : "rgba(255,255,255,0.25)"),
    background: on ? "#facc15" : "transparent", color: on ? "#111" : INK, fontWeight: 900, fontSize: 18, cursor: "pointer",
  });

  const row = (id: LookRowId) => (
    <div key={id} data-update-row={id} style={{ display: "grid", gap: 3, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{LOOK_ROWS[id].label}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <button style={pill(look[id] === "new")} onClick={() => setLookRow(id, "new")}>New</button>
          <button style={pill(look[id] === "old")} onClick={() => setLookRow(id, "old")}>Old</button>
        </span>
      </div>
      <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{noteFor(id, look[id])}</span>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "14px 14px 90px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/star-play-dev" style={{ color: MUTED, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>‹ Play Area</Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Oct 13 update</h1>
        </div>

        <div style={{ ...card, display: "grid", gap: 10 }} data-update-switch={state}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>The whole update</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Shot power, the contact field, keepers, team-mates and match feel. On this phone only.
            New here also plays in your real career matches. Starts on Old.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={big(state === "new")} onClick={() => setOct13("new")} data-update-all="new">New</button>
            <button style={big(state === "old")} onClick={() => setOct13("old")} data-update-all="old">Old</button>
          </div>
          {state === "mixed" && <div style={{ fontSize: 11, color: "#facc15", fontWeight: 800 }}>Mixed: you changed some parts below by hand.</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link href="/star-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Play your career →</Link>
            <Link href="/star-play-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Play Area →</Link>
          </div>
        </div>

        <div style={{ ...card, display: "grid" }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>Each part</div>
          {OCT13_PARTS.map(row)}
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 800, margin: "10px 0 2px" }}>These v0.15 parts were measured with it, so they flip too:</div>
          {OCT13_WITH.map(row)}
        </div>

        <FeelPreview pill={pill} card={card} />
      </div>
      <PageGuide page="/star-update-dev" corner="bottom-left" />
    </main>
  );
}
