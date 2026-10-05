"use client";

/**
 * THE MANAGER'S OFFICE — a 3D stage for "Talk to your manager" (Harry,
 * 5 Oct 2026: "Rebuild that office for the manager relationship
 * conversations"). Sample player and lines; the real chat mounts the same
 * stage (components/star/Office3D.tsx) from BossChat.tsx.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import PageGuide from "@/components/admin/PageGuide";
import { SKIN_TONES } from "@/lib/star/playerIdentity";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import { fitImage, getFittedHead, type FittedHead } from "@/lib/star/faceFit";
import { SAMPLE_TERMS } from "@/lib/star/signing3d";
import { kitsOf } from "@/lib/star/kits";
import type { SigningYou } from "@/lib/star/signing3dScene";
import { managerFor, type OfficeSpeaker } from "@/components/star/Office3D";

const Office3D = dynamic(() => import("@/components/star/Office3D"), { ssr: false });
const INK = "#f8fafc";

const LINES: { who: "boss" | "you"; text: string }[] = [
  { who: "boss", text: "Sit down. I want a word about your minutes." },
  { who: "you", text: "I'm ready to start, boss." },
  { who: "boss", text: "Then show me in training this week." },
  { who: "you", text: "You'll see it." },
];

export default function OfficePage() {
  const [line, setLine] = useState(0);
  const [speaker, setSpeaker] = useState<OfficeSpeaker>("boss");
  const [fitted, setFitted] = useState<FittedHead | null | undefined>(undefined);
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);
  useEffect(() => {
    const url = FAKE_FACES[0];
    const img = fitImage(url);
    const done = () => setFitted(getFittedHead(url));
    if (img.complete && img.naturalWidth) { done(); return; }
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", () => setFitted(null), { once: true });
  }, []);
  const kit = kitsOf(SAMPLE_TERMS.club).home;
  const you: SigningYou = useMemo(() => ({
    skin: SKIN_TONES.find((t) => t.id === "fair")!.hex, face: fitted ?? null, accessories: [], kit,
    number: SAMPLE_TERMS.number, hair: "#3d2616", hairStyle: "short",
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fitted]);
  const chip = (on: boolean): React.CSSProperties => ({
    padding: "8px 12px", fontSize: 12, fontWeight: 800, borderRadius: 999, border: "none",
    background: on ? INK : "rgba(255,255,255,.12)", color: on ? "#07090f" : INK,
  });
  const cur = LINES[line];
  return (
    <main style={{ position: "fixed", inset: 0, background: "#0b0d12", color: INK, fontFamily: "system-ui, sans-serif" }}>
      {fitted !== undefined && (
        <Office3D you={you} manager={managerFor(SAMPLE_TERMS.manager)} managerName={SAMPLE_TERMS.manager} club={SAMPLE_TERMS.club}
          speaker={speaker} style={{ position: "absolute", inset: 0 }} />
      )}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 6, alignItems: "center" }}>
        <Link href="/star-3d-area-dev" aria-label="Back" style={{ ...chip(false), textDecoration: "none" }}>‹</Link>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#fbbf24" }}>MANAGER&apos;S OFFICE</span>
        <span style={{ flex: 1 }} />
        <button data-boss onClick={() => setSpeaker("boss")} style={chip(speaker === "boss")}>He talks</button>
        <button data-you onClick={() => setSpeaker("you")} style={chip(speaker === "you")}>You talk</button>
      </div>
      <div style={{ position: "absolute", left: 10, right: 10, bottom: 18, padding: "10px 12px", borderRadius: 6, background: "rgba(8,10,16,.86)", borderLeft: "3px solid #fbbf24" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#fbbf24", textTransform: "uppercase" }}>{cur.who === "boss" ? `${SAMPLE_TERMS.manager} · Manager` : "You"}</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{cur.text}</div>
        <button data-next onClick={() => { const n = (line + 1) % LINES.length; setLine(n); setSpeaker(LINES[n].who); }} style={{ ...chip(false), marginTop: 8 }}>Next line ›</button>
      </div>
      <PageGuide page="/star-3d-area-dev/office" corner="bottom-left" />
    </main>
  );
}
