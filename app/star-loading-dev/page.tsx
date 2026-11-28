"use client";

/**
 * LOADING SCREENS — the test page (Harry, 27 Nov 2026: "loading screens must
 * MATCH THE SECTION YOU'RE GOING INTO, with several options per section").
 *
 * Every loading screen the game can show, by section, each one tappable to
 * see it full screen as a real wait of 1.5 s, 4 s or 10 s (it lifts by itself
 * at the end, exactly as it does when a place is ready). The match ones are
 * built from a real fixture of a made-up Arsenal career. Nothing is saved.
 *   ?bare=1&section=<s>&v=<id>  that screen full screen and held (stills, filming)
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn } from "@/components/admin/broadcast/BroadcastPage";
import LoadingCurtain, { WHERE } from "@/components/star/loading/LoadingCurtain";
import BootScreen from "@/components/star/loading/BootScreen";
import { LOAD_VARIANTS, type LoadSection } from "@/lib/star/loading/pick";
import { setLoadContext } from "@/lib/star/loading/context";
import { programmeFor } from "@/lib/star/loading/programme";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { nextFixtureFor } from "@/lib/star/competitions";
import { kitsOf } from "@/lib/star/kits";
import type { StarPlayer } from "@/lib/star/types";

const SECTIONS = Object.keys(LOAD_VARIANTS) as LoadSection[];
const DRILLS = ["Crossbar Challenge", "Two Touch", "Free Roam", "Headers & Volleys", "Wembley", "Pace Sprint"];

export default function LoadingDevPage() {
  return <Suspense><LoadingDev /></Suspense>;
}

function useSampleContext(drill: string) {
  return useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 19, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    const f = nextFixtureFor(c);
    const shirt = kitsOf("Arsenal").home.shirt;
    return {
      match: f ? { programme: programmeFor(c, f) } : {},
      training: { drill: { name: drill }, shirt },
      "ballon-dor": { gala: { title: "The Golden Ball", name: "Test Player", season: 3 } },
      awards: { gala: { title: "Season Awards", name: "Test Player", season: 3 } },
    } as Record<string, object>;
  }, [drill]);
}

function LoadingDev() {
  const q = useSearchParams();
  const bare = q.get("bare") === "1";
  const [drill, setDrill] = useState(DRILLS[0]);
  const ctx = useSampleContext(drill);
  useEffect(() => { for (const [s, c] of Object.entries(ctx)) setLoadContext(s as LoadSection, c); }, [ctx]);
  const [play, setPlay] = useState<{ section: LoadSection; v: string; key: number } | null>(null);
  const [secs, setSecs] = useState(4);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!play) return;
    setLive(true);
    const t = window.setTimeout(() => setLive(false), secs * 1000);
    const t2 = window.setTimeout(() => setPlay(null), secs * 1000 + 400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [play, secs]);

  if (bare) {
    const section = (q.get("section") ?? "garden") as LoadSection;
    const v = q.get("v") ?? LOAD_VARIANTS[section]?.[0]?.id;
    if (section === "first-load") return <BootOnly id={v} />;
    return <>
      <div style={{ position: "fixed", inset: 0, background: "#0b1220" }} />
      <LoadingCurtain section={section} variant={v} loading ctx={ctx[section]} />
    </>;
  }

  return (
    <>
      <BroadcastPage title="Loading screens" sub="Every loading screen the game shows, by the section you're going into. Tap one to see it as a real wait." width={1100}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Wait:</span>
          {[1.5, 4, 10].map((s) => <Btn key={s} onClick={() => setSecs(s)} title={`The screen lifts after ${s} s`}>{secs === s ? `● ${s} s` : `${s} s`}</Btn>)}
          <span style={{ fontWeight: 800, fontSize: 14, marginLeft: 12 }}>Drill:</span>
          <select value={drill} onChange={(e) => setDrill(e.target.value)} style={{ height: 32, borderRadius: 6, padding: "0 8px" }}>
            {DRILLS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        {SECTIONS.map((section) => (
          <div key={section} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{section === "first-load" ? "First load (the whole game)" : WHERE[section]}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LOAD_VARIANTS[section].map((v) => (
                <Btn key={v.id} onClick={() => section === "first-load" ? window.open(`/star-loading-dev?bare=1&section=first-load&v=${v.id}`, "_self") : setPlay({ section, v: v.id, key: Date.now() })} title="See it full screen">
                  {v.id.replace(/^(keepie|programme|board|gala|boot)-/, "")}
                </Btn>
              ))}
            </div>
          </div>
        ))}
      </BroadcastPage>
      {play && <LoadingCurtain key={play.key} section={play.section} variant={play.v} loading={live} ctx={ctx[play.section]} />}
      <PageGuide page="/star-loading-dev" corner="bottom-left" />
    </>
  );
}

/** The first load's opening, held on one look (?v). */
function BootOnly({ id }: { id?: string }) {
  return <BootScreen show={id} />;
}
