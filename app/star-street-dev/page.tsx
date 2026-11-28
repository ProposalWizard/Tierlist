"use client";

/**
 * THE SHOPPING STREET — the test page (phase 1, 28 Nov 2026). The same screen a career opens out of
 * the garden's gate (components/star/Street3D.tsx), on a made-up career: walk the high street, see
 * the four shop fronts, the people and the parked cars. The doors only say where they would go here
 * (a note at the top); in a career they open the 3D shop, the Cars and Drip aisles, the barber's card.
 * ?bare=1 full screen (the loading still is shot this way), ?arrive=gate|shop|cars|drip|barber,
 * ?outfit=hoodie|tee|shirt|tracksuit|coat (walk it in that casual set), ?q=low|medium|high,
 * ?walkers=0..6 (how many people walk), ?film=1 (fixed steps, for filming). Nothing is saved.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import Street3D from "@/components/star/Street3D";
import "../star-3d-area-dev/stage3d.css";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LIFESTYLE_LEVELS, baseIdOf } from "@/lib/star/shopDefaults";
import type { StreetArrive } from "@/lib/star/street3d/plan";
import type { CareerState, StarPlayer } from "@/lib/star/types";

if (typeof window !== "undefined") setToonYou({ name: "Player" });

const ARRIVALS: StreetArrive[] = ["gate", "shop", "cars", "drip", "barber"];

export default function StreetTestPage() {
  return <Suspense><StreetTest /></Suspense>;
}

function StreetTest() {
  const router = useRouter();
  const params = useSearchParams();
  const a0 = params.get("arrive") as StreetArrive | null;
  const [arrive, setArrive] = useState<StreetArrive>(a0 && ARRIVALS.includes(a0) ? a0 : "gate");
  const [rich, setRich] = useState(false);
  const [key, setKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: params.get("skin") ?? "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7);
    const own = (base: string, level: number) => {
      const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level) ?? LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base);
      return it ? [{ ...it }] : [];
    };
    // "Rich career": owns the first cars and the cap, so the windows show what comes next
    c.ownedItems = rich ? [...own("car-1", 2), ...own("car-2", 1), ...own("suv", 1), ...own("cap", 2), ...own("shades", 1)] : [];
    c.money = rich ? 250000 : 5000;
    const fit = params.get("outfit");
    if (fit) c.outfit = { wear: "casual", casual: fit, kit: "home" };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rich]);

  const bare = params.get("bare") === "1" || params.get("film") === "1";
  const say = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 2600); };
  const street = (
    <Street3D key={`${key}-${arrive}-${rich}`} career={career} arrive={arrive} embedded={!bare}
      onBack={() => router.push("/admin/star/g/places3d")}
      onLeave={() => say("Down the lane: in a career, back to your garden's gate")}
      onDoor={(id) => {
        if (id === "shop") router.push("/star-shop3d-dev?door=1");
        else { say(id === "cars" ? "KIB MOTORS: in a career, the shop's Cars aisle" : "THE DRIP: in a career, the shop's Drip aisle"); setArrive(id); setKey((k) => k + 1); }
      }}
    />
  );
  const noteEl = note && (
    <div style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 95, background: "rgba(8,10,16,.9)", color: "#fff", padding: "8px 14px", borderRadius: 12, fontWeight: 800, fontSize: 13 }} data-street-note>{note}</div>
  );
  if (bare) return (<>{street}{noteEl}<PageGuide page="/star-street-dev" corner="bottom-right" /></>);
  return (
    <>
      <BroadcastPage title="Shopping street" sub="Walk the high street: the 3D shop, the car showroom, the boutique and the barber." width={1440}>
        <div className="s3-bar" data-street-dev>
          {ARRIVALS.map((a) => <Pill key={a} on={arrive === a} onClick={() => { setArrive(a); setKey((k) => k + 1); }}>{a === "gate" ? "From the garden" : `At ${a}`}</Pill>)}
          <Btn onClick={() => setRich((r) => !r)} title="A career that owns the first cars and the cap (the windows move on), or a new one">{rich ? "Rich career" : "New career"}</Btn>
          <Btn onClick={() => setKey((k) => k + 1)}>↻ Restart</Btn>
        </div>
        <div className="s3-stage">{street}</div>
      </BroadcastPage>
      {noteEl}
      <PageGuide page="/star-street-dev" corner="bottom-right" />
    </>
  );
}
