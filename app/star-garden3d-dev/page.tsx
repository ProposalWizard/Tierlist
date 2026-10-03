"use client";

/**
 * 3D GARDEN — the test page (Mikey, 3 Oct 2026). The same screen a career
 * opens from Home's Garden (components/star/Garden3D.tsx), here on a made-up
 * career so every part can be seen without playing to it: switch the time of
 * day, trophies, the horse, cars and how grand the home is. Nothing is saved.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import Garden3D from "@/components/star/Garden3D";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LIFESTYLE_LEVELS, baseIdOf } from "@/lib/star/shopDefaults";
import type { CareerState, StarPlayer } from "@/lib/star/types";

type Sky = "day" | "sunset" | "night";
const TROPHIES = [
  { competition: "Premier League", n: 2 }, { competition: "Champions League", n: 1 }, { competition: "FA Cup", n: 3 },
  { competition: "League Cup", n: 1 }, { competition: "Golden Boot", n: 2 }, { competition: "Player of the Month", n: 4 },
];

export default function Garden3DTestPage() {
  return <Suspense><Garden3DTest /></Suspense>;
}

function Garden3DTest() {
  const router = useRouter();
  const arrive = useSearchParams().get("arrive") === "shop" ? "shop" : "gate";
  const [sky, setSky] = useState<Sky>("day");
  const [full, setFull] = useState(true);
  const [key, setKey] = useState(0);

  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7);
    if (full) {
      c.trophies = TROPHIES.flatMap((t) => Array.from({ length: t.n }, (_, i) => ({ season: i + 1, competition: t.competition, club: "Arsenal" })));
      c.ballonDorWins = 1;
      c.horse = { name: "Thunder Bolt", breed: "Thoroughbred", speed: 82, stamina: 74, energy: 90, racesRun: 12, racesWon: 5, earnings: 40000 };
      // the shop's own items, so they read exactly as a real purchase does
      const own = (base: string, level: number) => {
        const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level) ?? LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base);
        return it ? [{ ...it }] : [];
      };
      c.ownedItems = [...own("house-2", 3), ...own("stable", 4), ...own("car-3", 5), ...own("suv", 3), ...own("classic", 3)];
    } else {
      c.trophies = [];
      c.horse = null;
      c.ownedItems = [];
    }
    return c;
  }, [full]);

  const btn: React.CSSProperties = { height: 30, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.6)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" };
  return (
    <>
      <Garden3D key={`${key}-${sky}-${full}`} career={career} sky={sky} arrive={arrive} onBack={() => router.push("/star-3d-area-dev")} onShop={() => router.push("/star-shop3d-dev?door=1")} />
      <div style={{ position: "fixed", top: 58, left: 12, zIndex: 90, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["day", "sunset", "night"] as Sky[]).map((s) => (
          <button key={s} onClick={() => setSky(s)} style={{ ...btn, background: sky === s ? "#facc15" : btn.background, color: sky === s ? "#111" : "#fff" }}>{s}</button>
        ))}
        <button onClick={() => setFull((f) => !f)} style={btn}>{full ? "Full career" : "New career"}</button>
        <button onClick={() => setKey((k) => k + 1)} style={btn}>Restart</button>
      </div>
      <PageGuide page="/star-garden3d-dev" corner="bottom-left" />
    </>
  );
}
