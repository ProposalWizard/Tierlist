"use client";

/**
 * 3D HOME — the test page (Harry, 9 Oct 2026: "imagine you actually had your
 * current house with all your stuff and that's where you change clothes").
 *
 * The same screen a career opens from the garden's house door or Home's
 * "Your house" (components/star/Home3D.tsx), on a made-up career: switch the
 * home (?tier=starter|flat|penthouse|house|villa|estate), an empty or a full
 * trophy cabinet, and the look (?look=h|old). The wardrobe's choice stays on
 * this page; nothing is saved.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import Home3D from "@/components/star/Home3D";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";

// the test player's name on the back of his Style A shirt (a career sets it from the save)
if (typeof window !== "undefined") setToonYou({ name: "Player" });
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LIFESTYLE_LEVELS, BOOT_LEVELS, baseIdOf } from "@/lib/star/shopDefaults";
import { HOME_TIERS, parseHomeTier, type HomeTier } from "@/lib/star/home3d/homes";
import type { OutfitChoice } from "@/lib/star/home3d/outfits";
import type { CareerState, StarPlayer } from "@/lib/star/types";

const TROPHIES = [
  { competition: "Premier League", n: 2 }, { competition: "Champions League", n: 1 }, { competition: "FA Cup", n: 3 },
  { competition: "League Cup", n: 1 }, { competition: "Europa League", n: 1 }, { competition: "Community Shield", n: 2 },
];
const AWARDS = [{ kind: "Golden Boot", n: 2 }, { kind: "Player of the Season", n: 1 }, { kind: "Player of the Month", n: 4 }];

export default function Home3DTestPage() {
  return <Suspense><Home3DTest /></Suspense>;
}

function Home3DTest() {
  const router = useRouter();
  const params = useSearchParams();
  const [tier, setTier] = useState<HomeTier>(parseHomeTier(params.get("tier")) ?? "house");
  const [full, setFull] = useState(params.get("trophies") !== "0");
  const [outfit, setOutfit] = useState<OutfitChoice | undefined>(undefined);
  const look = params.get("look");
  const lookH = look === "h" ? true : look === "old" ? false : undefined;

  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7);
    const own = (base: string, level: number) => {
      const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level);
      return it ? [{ ...it }] : [];
    };
    c.ownedItems = full ? [...own("car-3", 5), ...own("suv", 3), ...own("classic", 3), ...own("car-1", 2)] : [];
    const boot = BOOT_LEVELS.find((b) => baseIdOf(b) === "elite" && (b.level ?? 1) === 3);
    if (boot) c.currentBoot = { ...boot };
    c.trophies = full ? TROPHIES.flatMap((t) => Array.from({ length: t.n }, (_, i) => ({ season: i + 1, competition: t.competition, club: "Arsenal" }))) : [];
    c.awards = full ? AWARDS.flatMap((a) => Array.from({ length: a.n }, (_, i) => ({ season: i + 1, kind: a.kind, week: a.kind === "Player of the Month" ? 4 + i : undefined, detail: "" }))) : [];
    c.ballonDorWins = full ? 1 : 0;
    if (outfit) c.outfit = outfit;
    return c;
    // the wardrobe's choice is read once per home (the screen keeps it after that)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, tier]);

  const btn: React.CSSProperties = { height: 28, padding: "0 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.6)", color: "#fff", fontWeight: 800, fontSize: 11.5, cursor: "pointer" };
  return (
    <>
      <Home3D
        key={`${tier}-${full}`}
        career={career}
        tier={tier}
        lookH={lookH}
        backLabel="3D area"
        onBack={() => router.push("/star-3d-area-dev")}
        onDoor={() => router.push("/star-garden3d-dev?arrive=house")}
        onOutfit={setOutfit}
      />
      <div style={{ position: "fixed", top: 56, left: 12, right: 12, zIndex: 90, display: "flex", gap: 5, flexWrap: "wrap" }} data-home3d-dev>
        {HOME_TIERS.map((t) => (
          <button key={t} onClick={() => setTier(t)} style={{ ...btn, background: tier === t ? "#facc15" : btn.background, color: tier === t ? "#111" : "#fff" }}>{t}</button>
        ))}
        <button onClick={() => setFull((f) => !f)} style={btn}>{full ? "Full cabinet" : "Empty cabinet"}</button>
      </div>
      <PageGuide page="/star-home3d-dev" corner="bottom-left" />
    </>
  );
}
