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
import Training3D, { type Training3DResult } from "@/components/star/Training3D";
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

function Body() {
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<Training3DResult | null>(null);
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
        key={key}
        career={career}
        onExit={() => { window.location.href = "/star-3d-area-dev"; }}
        onFinish={(r) => { setLast(r); setKey((k) => k + 1); }}
      />
      <div className="fixed bottom-3 right-3 z-[90] flex gap-1.5">
        <button onClick={() => setKey((k) => k + 1)} className="h-[30px] rounded-full border border-white/20 bg-black/60 px-2.5 text-[12px] font-extrabold text-white">Restart</button>
        {last && <div className="h-[30px] rounded-full bg-black/60 px-2.5 text-[12px] font-extrabold leading-[30px] text-white">Last: {last.you}-{last.him} ({last.won ? "won" : "lost"}, Team {last.gain >= 0 ? "+" : ""}{last.gain})</div>}
      </div>
      <PageGuide page="/star-training3d-dev" corner="bottom-left" />
    </>
  );
}
