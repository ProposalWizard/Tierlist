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
 *
 * Broadcast look, option 2 (Harry, 19 Oct 2026: "3D training opt 2 cool"):
 * the title bar with the drill and the last result at the top, the training
 * screen untouched in the middle, and a drill switcher of picture cards under
 * it. Pictures: public/admin/3d-training/<drill>.webp (real stills of each
 * drill). Only the menu around the 3D view changed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn } from "@/components/admin/broadcast/BroadcastPage";
import "./training3d.css";
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

  if (gate === "loading") return <BroadcastPage title="3D training" back={null}><div className="bc-note">Loading…</div></BroadcastPage>;
  if (gate === "denied") {
    return (
      <BroadcastPage title="Testers only" sub="This is a test page." back={null}>
        <div className="bc-note">Sign in as a tester or an admin to use it.</div>
      </BroadcastPage>
    );
  }
  return <Body />;
}

const OPEN: { id: DrillId | "picker"; label: string }[] = [
  { id: "picker", label: "Picker" }, { id: "crossbar", label: "Crossbar" }, { id: "two-touch", label: "Two Touch" }, { id: "free-roam", label: "Free Roam" },
  { id: "headers-volleys", label: "Head/Volley" }, { id: "wembley", label: "Wembley" }, { id: "pace", label: "Pace" },
];

function Body() {
  const [key, setKey] = useState(0);
  const [last, setLast] = useState<TrainingGateResult | null>(null);
  // ?drill=two-touch|free-roam|crossbar|headers-volleys|wembley|pace opens a drill straight away (no picker);
  // &mode=doubles picks Wembley Doubles (its pre-screen still asks how many)
  const [drill, setDrill] = useState<DrillId | "picker">("picker");
  const [mode, setMode] = useState<string | undefined>(undefined);
  // &pace=85: your pace for this test career (Pace Sprint: feel the top speed change)
  const [pace, setPace] = useState<number | null>(null);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("drill");
    if (q && OPEN.some((o) => o.id === q)) setDrill(q as DrillId);
    setMode(qs.get("mode") ?? undefined);
    const pc = Number(qs.get("pace"));
    if (qs.get("pace") && Number.isFinite(pc)) setPace(Math.max(0, Math.min(100, pc)));
  }, []);
  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7 + key);
    // a new team-mate (and his shots) every Restart
    c.week = 1 + key;
    if (pace !== null) c.skills = { ...c.skills, pace };
    return c;
  }, [key, pace]);

  const strip = useRef<HTMLDivElement>(null);
  const slide = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: "smooth" });
  const nowIdx = OPEN.findIndex((o) => o.id === drill);
  const now = OPEN[nowIdx];

  return (
    <div className="t3">
      <BroadcastPage
        title="3D training"
        sub={<span className="t3-sub">{String(nowIdx + 1).padStart(2, "0")}: {now.id === "picker" ? "The drill picker" : now.label}</span>}
        back={null}
        width={1440}
        actions={
          <>
            <div className="t3-score" data-last-result>
              <span>Last</span>
              <b>{last ? `${last.you !== undefined ? `${last.you}-${last.him} · ` : ""}${last.won ? "Won" : "Lost"} · Team ${last.gain >= 0 ? "+" : ""}${last.gain}` : "None yet"}</b>
              {last && <i>{last.drill ?? "crossbar"}</i>}
            </div>
            <Btn onClick={() => setKey((k) => k + 1)} title="Start again with a different team-mate">↻ Restart</Btn>
          </>
        }
      >
        <div className="t3-stage">
          <Training3D
            key={`${drill}-${mode}-${key}`}
            career={career}
            startDrill={drill === "picker" ? undefined : drill}
            startMode={mode}
            onExit={() => { window.location.href = "/star-3d-area-dev"; }}
            onFinish={(r) => { setLast(r); setKey((k) => k + 1); }}
          />
        </div>

        <section className="t3-switch">
          <div className="t3-switch-h"><h2>Drill switcher</h2><span>Tap one to open it</span></div>
          <div className="t3-switch-row">
            <button className="t3-arrow" onClick={() => slide(-1)} aria-label="Scroll left">‹</button>
            <div className="t3-cards" ref={strip} data-dev-drills>
              {OPEN.map((o, i) => (
                <button
                  key={o.id}
                  onClick={() => { setDrill(o.id); setKey((k) => k + 1); }}
                  aria-pressed={drill === o.id}
                  className="t3-card"
                  title={o.id === "picker" ? "Open the drill picker" : `Open ${o.label}`}
                >
                  <span className="t3-pic" style={{ backgroundImage: `url(/admin/3d-training/${o.id}.webp)` }} role="img" aria-label={`${o.label}: a still from this page`} />
                  <span className="t3-name">{String(i + 1).padStart(2, "0")}: {o.label}</span>
                </button>
              ))}
            </div>
            <button className="t3-arrow" onClick={() => slide(1)} aria-label="Scroll right">›</button>
          </div>
        </section>
      </BroadcastPage>
      <PageGuide page="/star-training3d-dev" corner="bottom-left" />
    </div>
  );
}
