"use client";

/**
 * OCT 13 UPDATE TEST AREA — the whole gameplay update behind one Old | New
 * switch (lib/star/oct13Update.ts), each part on its own row, and the Match
 * feel pictures. Per phone: New here also plays in your real career matches.
 */
import { useEffect } from "react";
import Link from "next/link";
import { BroadcastPage, Panel } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import FeelPreview from "@/components/star/FeelPreview";
import { LOOK_ROWS, setLookRow, useLook, type LookRowId } from "@/lib/star/lookRows";
import { GAMEPLAY_SWITCHES, type GameplaySwitch } from "@/lib/star/gameplayVersion";
import { OCT13_PARTS, OCT13_WITH, oct13State, setOct13 } from "@/lib/star/oct13Update";

const MUTED = "var(--bc-ink2)", AMBER = "var(--bc-amber)";

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
    height: 30, padding: "0 11px", borderRadius: 3, border: "1px solid " + (on ? "transparent" : "var(--bc-line)"),
    background: on ? "var(--bc-accent)" : "rgba(255,255,255,0.04)", color: on ? "#fff" : MUTED, fontWeight: 800, fontSize: 12, cursor: "pointer",
  });
  const card: React.CSSProperties = { background: "linear-gradient(180deg, rgba(14,40,98,0.78), rgba(6,20,54,0.82))", borderRadius: 4, padding: 12,
    border: "1px solid var(--bc-line)", borderTop: "2px solid rgba(90,160,255,0.55)", boxShadow: "0 12px 34px rgba(0,4,20,0.5)" };
  const big = (on: boolean): React.CSSProperties => ({
    flex: 1, height: 52, border: 0, clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
    background: on ? AMBER : "#1d4fae", color: on ? "#1a1300" : "#fff", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: 18, cursor: "pointer",
  });

  const row = (id: LookRowId) => (
    <div key={id} data-update-row={id} style={{ display: "grid", gap: 3, padding: "8px 0", borderTop: "1px solid var(--bc-line)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{LOOK_ROWS[id].label}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <button style={pill(look[id] === "new")} onClick={() => setLookRow(id, "new")}>New</button>
          <button style={pill(look[id] === "old")} onClick={() => setLookRow(id, "old")}>Old</button>
        </span>
      </div>
      <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{noteFor(id, look[id])}</span>
    </div>
  );

  return (
    <BroadcastPage title="Leo's Oct 13 update" sub="The whole update behind one Old | New switch." back="/star-play-dev" width={640}>
      <div style={{ display: "grid", gap: 12 }}>
        <Panel title="The whole update">
          <div style={{ display: "grid", gap: 10 }} data-update-switch={state}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>
              Shot power, the contact field, keepers, team-mates and match feel. On this phone only.
              New here also plays in your real career matches. Starts on Old.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={big(state === "new")} onClick={() => setOct13("new")} data-update-all="new">New</button>
              <button style={big(state === "old")} onClick={() => setOct13("old")} data-update-all="old">Old</button>
            </div>
            {state === "mixed" && <div style={{ fontSize: 12, color: AMBER, fontWeight: 800 }}>Mixed: you changed some parts below by hand.</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Link href="/star-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Play your career →</Link>
              <Link href="/star-play-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Play Area →</Link>
            </div>
          </div>
        </Panel>

        <Panel title="Each part">
          <div style={{ display: "grid" }}>
            {OCT13_PARTS.map(row)}
            <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, margin: "10px 0 2px" }}>These v0.15 parts were measured with it, so they flip too:</div>
            {OCT13_WITH.map(row)}
          </div>
        </Panel>

        <FeelPreview pill={pill} card={card} />
      </div>
      <PageGuide page="/star-update-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
