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
import { setToonYou } from "@/lib/star/style3d/toon/bodies";

// the test player's name on the back of his Style A shirt (a career sets it from the save)
if (typeof window !== "undefined") setToonYou({ name: "Player" });
import Casino3D from "@/components/star/Casino3D";
import Casino from "@/components/star/Casino";
import TrainingPitchScreen from "@/components/star/TrainingPitchScreen";
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
  const params = useSearchParams();
  const a0 = params.get("arrive");
  const [arrive, setArrive] = useState<"shop" | "gate" | "casino" | "training" | "house">(a0 === "shop" || a0 === "casino" || a0 === "training" || a0 === "house" ? a0 : "gate");
  // the 3D casino and the training pitch open here too (?place=casino)
  const [place, setPlace] = useState<"garden" | "casino" | "training">(params.get("place") === "casino" ? "casino" : "garden");
  const [money, setMoney] = useState(250000);
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
    c.money = money;
    // ?outfit=hoodie|tee|shirt|tracksuit|coat: walk the garden in that casual set (as picked at your house's wardrobe)
    const fit = params.get("outfit");
    if (fit) c.outfit = { wear: "casual", casual: fit, kit: "home" };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, money]);

  const btn: React.CSSProperties = { height: 30, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.6)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" };
  if (place === "casino") {
    return (
      <>
        <Casino3D
          career={career}
          onBack={() => router.push("/star-3d-area-dev")}
          onDoor={() => { setArrive("casino"); setPlace("garden"); }}
          onBank={(bank) => setMoney(Math.max(0, Math.round(bank)))}
          renderGame={(game, done) => (
            <Casino bankStart={career.money} career={career} startGame={game}
              onExit={(bank) => { setMoney(Math.max(0, Math.round(bank))); if (game) done(); else router.push("/star-3d-area-dev"); }}
              onHorseRace={() => {}} onBuyHorse={() => {}} onRenameHorse={() => {}} onPlaceBet={() => {}} />
          )}
        />
        <PageGuide page="/star-garden3d-dev" corner="bottom-left" />
      </>
    );
  }
  if (place === "training") return <TrainingPitchScreen onBack={() => { setArrive("training"); setPlace("garden"); }} />;

  return (
    <>
      <Garden3D key={`${key}-${sky}-${full}-${arrive}`} career={career} sky={sky} arrive={arrive} onBack={() => router.push("/star-3d-area-dev")} onShop={() => router.push("/star-shop3d-dev?door=1")} onCasino={() => setPlace("casino")} onTraining={() => setPlace("training")} onHouse={() => router.push("/star-home3d-dev")} />
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
