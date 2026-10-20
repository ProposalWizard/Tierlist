"use client";
/**
 * THE BENCH'S HEADSHOT SHEET (B15, 20 Oct 2026) — twelve made-up players and
 * you, each as the Player of the Month winner's portrait tile: the 3D headshot
 * (components/star/Headshot3D.tsx, lib/star/headshot3d) beside the drawn head
 * it replaces. Shows how long each picture took on this device. "Make again"
 * forgets this device's kept pictures so every face is made fresh.
 *
 *   ?only=3d|drawn   one column only (stills)
 */
import { useEffect, useState } from "react";
import { BroadcastPage, Panel, Note, Btn } from "@/components/admin/broadcast/BroadcastPage";
import Headshot3D from "@/components/star/Headshot3D";
import DrawnHeadChip from "@/components/star/DrawnHeadChip";
import { kitsOf } from "@/lib/star/kits";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { SKIN_TONES, HAIR_COLOURS } from "@/lib/star/playerIdentity";

/** Twelve men across the clubs (stripes, white kits, dark kits), seeded ids like a squad's. */
const SHEET: { id: string; name: string; club: string; position: string }[] = [
  { id: "sheet-01", name: "Okafor", club: "Arsenal", position: "ST" },
  { id: "sheet-02", name: "Lindqvist", club: "Liverpool", position: "CB" },
  { id: "sheet-03", name: "Moreno", club: "Manchester City", position: "CAM" },
  { id: "sheet-04", name: "Hart", club: "Chelsea", position: "CM" },
  { id: "sheet-05", name: "Diallo", club: "Newcastle United", position: "LW" },
  { id: "sheet-06", name: "Kowalski", club: "Tottenham Hotspur", position: "CDM" },
  { id: "sheet-07", name: "Asante", club: "Aston Villa", position: "RB" },
  { id: "sheet-08", name: "Byrne", club: "Brentford", position: "GK" },
  { id: "sheet-09", name: "Silva", club: "Wolverhampton Wanderers", position: "RW" },
  { id: "sheet-10", name: "Nakamura", club: "Brighton & Hove Albion", position: "CM" },
  { id: "sheet-11", name: "Mensah", club: "Crystal Palace", position: "ST" },
  { id: "sheet-12", name: "Petrov", club: "Leeds United", position: "CB" },
];

interface Stats { setupMs: number[]; sitterMs: number[]; shotMs: number[]; kept: number; failed: number }
const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

export default function HeadshotSheet() {
  const [only, setOnly] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    setOnly(new URLSearchParams(window.location.search).get("only"));
    setToonYou({ head: "h2", body: "c2", skin: SKIN_TONES[2].hex, hair: HAIR_COLOURS[1].hex });
    const t = setInterval(() => {
      const s = (window as unknown as { __headshots?: Stats }).__headshots;
      if (s) setStats({ ...s, setupMs: [...s.setupMs], sitterMs: [...s.sitterMs], shotMs: [...s.shotMs] });
    }, 500);
    return () => clearInterval(t);
  }, []);
  const again = async () => {
    const { clearHeadshots } = await import("@/lib/star/headshot3d/store");
    await clearHeadshots();
    setRound((r) => r + 1);
  };
  const people = [{ id: "you", name: "You", club: "Arsenal", position: "ST" }, ...SHEET];
  return (
    <BroadcastPage title="Headshots" sub="Each player's card picture, shot from the 3D model (right) beside the drawn head it replaces (left).">
      <Panel title="Time per picture, this device" note="made once per device, then kept">
        <Note>
          {stats
            ? `Renderer + clips: ${median(stats.setupMs) ?? "–"} ms · each new head file: ${median(stats.sitterMs) ?? "–"} ms (${stats.sitterMs.length} loaded) · each picture: ${median(stats.shotMs) ?? "–"} ms (${stats.shotMs.length} made) · already kept: ${stats.kept} · failed: ${stats.failed}`
            : "Waiting for the first picture…"}
        </Note>
        <div style={{ marginTop: 8 }}><Btn onClick={again}>Make again</Btn></div>
      </Panel>
      <div key={round} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }} data-headshot-sheet>
        {people.map((p) => {
          const kit = kitsOf(p.club).home;
          return (
            <div key={p.id} style={{ background: "#0b1220", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
              <div style={{ display: "flex" }}>
                {only !== "3d" && <Tile kit={kit} label="drawn"><DrawnHeadChip id={p.id} shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={84} /></Tile>}
                {only !== "drawn" && <Tile kit={kit} label="3D"><Headshot3D id={p.id} you={p.id === "you"} position={p.position} kit={kit} size={84} /></Tile>}
              </div>
              <div style={{ padding: "4px 8px", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                {p.name} <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 600 }}>· {p.club} · {p.position}</span>
              </div>
            </div>
          );
        })}
      </div>
    </BroadcastPage>
  );
}

/** The PotM winner's tile: the kit colour with the trim as a sash, the head stood on the bottom edge. */
function Tile({ kit, label, children }: { kit: { shirt: string; trim: string }; label: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", flex: 1, height: 84, overflow: "hidden", background: kit.shirt }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 6, width: 22, background: kit.trim, transform: "skewX(-14deg)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center" }}>{children}</div>
      <span style={{ position: "absolute", right: 3, top: 2, fontSize: 8, fontWeight: 900, color: "#fff", textShadow: "0 1px 2px #000" }}>{label}</span>
    </div>
  );
}
