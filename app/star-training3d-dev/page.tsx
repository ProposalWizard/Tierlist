"use client";

/**
 * 3D TRAINING — the test page (Harry, 8 Oct 2026: "let's try and build the
 * training pitch and see what you can produce … starting game can be crossbar
 * challenge — you vs one teammate").
 *
 * The same screen a career will open from the garden's training-pitch gate
 * (components/star/Training3D.tsx), here on a made-up career. Nothing is
 * saved: the result shows on screen and goes nowhere.
 * Testers and admins only.
 */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import Training3D, { type TrainingGateResult } from "@/components/star/Training3D";
import type { DrillId } from "@/lib/star/play3d/drills";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import type { CareerState, StarPlayer } from "@/lib/star/types";

export default function StarTraining3DDevPage() {
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");
  useEffect(() => {
    if (offlineDevPlayEnabled()) { setGate("ok"); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setGate("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : {};
        setGate(d.isAdmin || d.isTester ? "ok" : "denied");
      } catch { setGate("denied"); }
    });
  }, []);

  if (gate === "loading") return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  if (gate === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div><div className="text-lg font-black mb-1">Testers only</div><div className="text-sm text-gray-400">This is a development sandbox.</div></div>
      </div>
    );
  }
  return <Body />;
}

const OPEN: { id: DrillId | "picker"; label: string }[] = [
  { id: "picker", label: "Picker" }, { id: "crossbar", label: "Crossbar" }, { id: "two-touch", label: "Two Touch" }, { id: "free-roam", label: "Free Roam" },
  { id: "headers-volleys", label: "Head/Volley" }, { id: "wembley", label: "Wembley" },
];

function Body() {
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<TrainingGateResult | null>(null);
  // ?drill=two-touch|free-roam|crossbar|headers-volleys|wembley opens a drill straight away (no picker);
  // &mode=doubles picks Wembley Doubles (its pre-screen still asks how many)
  const [drill, setDrill] = useState<DrillId | "picker">("picker");
  const [mode, setMode] = useState<string | undefined>(undefined);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("drill");
    if (q && OPEN.some((o) => o.id === q)) setDrill(q as DrillId);
    setMode(qs.get("mode") ?? undefined);
  }, []);
  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7 + key);
    // a new team-mate (and his shots) every Restart
    c.week = 1 + key;
    return c;
  }, [key]);

  return (
    <>
      <Training3D
        key={`${drill}-${mode}-${key}`}
        career={career}
        startDrill={drill === "picker" ? undefined : drill}
        startMode={mode}
        onExit={() => { window.location.href = "/star-3d-area-dev"; }}
        onFinish={(r) => { setLast(r); setKey((k) => k + 1); }}
      />
      <div className="fixed left-1/2 top-1 z-[90] flex -translate-x-1/2 gap-1" data-dev-drills>
        {OPEN.map((o) => (
          <button key={o.id} onClick={() => { setDrill(o.id); setKey((k) => k + 1); }} className={`h-[26px] rounded-full border px-2 text-[11px] font-extrabold ${drill === o.id ? "border-sky-300 bg-sky-500 text-white" : "border-white/20 bg-black/60 text-white"}`}>{o.label}</button>
        ))}
      </div>
      <div className="fixed bottom-3 right-3 z-[90] flex gap-1.5">
        <button onClick={() => setKey((k) => k + 1)} className="h-[30px] rounded-full border border-white/20 bg-black/60 px-2.5 text-[12px] font-extrabold text-white">Restart</button>
        {last && <div className="h-[30px] rounded-full bg-black/60 px-2.5 text-[12px] font-extrabold leading-[30px] text-white">Last: {last.you !== undefined ? `${last.you}-${last.him} ` : ""}({last.drill ?? "crossbar"}, {last.won ? "won" : "lost"}, Team {last.gain >= 0 ? "+" : ""}{last.gain})</div>}
      </div>
      <PageGuide page="/star-training3d-dev" corner="bottom-left" />
    </>
  );
}
