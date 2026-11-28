"use client";

/**
 * GARDEN LEVELS — the test page (28 Nov 2026). The real 3D garden (components/star/Garden3D.tsx) on a made-up
 * career, at any garden level: 1 (the garden as it is), 2 (gate, lane, stable, paddock, ride your horse),
 * 3 (the riding field and its jump course), 4 (the race track), 5 (fast-travel signposts). Your own horse or the
 * stable's. Nothing on the career is saved; "In my garden" switches the levels on in Home → Garden on this device
 * (lib/star/garden3d/levelsFlag.ts, off by default). ?level=1..5, ?bare=1 full screen.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import Garden3D from "@/components/star/Garden3D";
import "../star-3d-area-dev/stage3d.css";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { GARDEN_LEVELS, STABLE_HORSE_NAME, gardenChip, xpAtLevel } from "@/lib/star/gardenLevels";
import { gardenLevelsOn, setGardenLevelsOn } from "@/lib/star/garden3d/levelsFlag";
import type { RideReport } from "@/lib/star/garden3d/levelZones";
import { lapClock } from "@/lib/star/garden3d/riding";
import type { CareerState, StarPlayer } from "@/lib/star/types";

export default function GardenLevelsTestPage() {
  return <Suspense><GardenLevelsTest /></Suspense>;
}

function GardenLevelsTest() {
  const router = useRouter();
  const params = useSearchParams();
  const l0 = Number(params.get("level"));
  const [level, setLevel] = useState(l0 >= 1 && l0 <= 5 ? l0 : 3);
  const [own, setOwn] = useState(true);
  const [key, setKey] = useState(0);
  const [inGame, setInGame] = useState(() => gardenLevelsOn());
  const [rides, setRides] = useState<RideReport[]>([]);

  const career = useMemo(() => {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7);
    c.horse = own ? { name: "Thunder Bolt", breed: "Thoroughbred", speed: 82, stamina: 74, energy: 90, racesRun: 12, racesWon: 5, earnings: 40000 } : null;
    return c;
  }, [own]);
  // a little into the level, so the chip shows progress
  const xp = xpAtLevel(level) + (level < 5 ? Math.round((GARDEN_LEVELS[level]?.need ?? 0) * 0.4) : 0);
  const levels = useMemo(() => ({
    xp,
    horse: own ? { name: "Thunder Bolt", energy: 90, mine: true } : { name: STABLE_HORSE_NAME, energy: 100, mine: false },
    bestCourse: rides.flatMap((r) => r.laps).filter((l) => l.kind === "course").reduce<number | undefined>((b, l) => (b === undefined || l.ms < b ? l.ms : b), undefined),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [xp, own, key]);

  const bare = params.get("bare") === "1" || params.get("film") === "1";
  const garden = (
    <Garden3D key={`${key}-${level}-${own}`} career={career} arrive="gate" where="test" embedded={!bare} levels={levels}
      onRide={(r) => setRides((rs) => [...rs, r])}
      onBack={() => router.push("/admin/star/g/places3d")} onShop={() => router.push("/star-shop3d-dev?door=1")} onHouse={() => router.push("/star-home3d-dev")} />
  );
  const last = rides[rides.length - 1];
  if (bare) return (<>{garden}<PageGuide page="/star-garden-levels-dev" corner="bottom-left" /></>);
  return (
    <>
      <BroadcastPage title="Garden levels" sub={`${gardenChip(xp)} · walk out of the west gate (end of the side path) to the new areas; walk up to the horse to ride.`} width={1440}>
        <div className="s3-bar" data-garden-levels-dev>
          {[1, 2, 3, 4, 5].map((n) => <Pill key={n} on={level === n} onClick={() => setLevel(n)}>Level {n}</Pill>)}
          <Btn onClick={() => setOwn((o) => !o)} title="Ride your own casino horse, or the stable's horse (no horse bought)">{own ? "Your horse" : "Stable horse"}</Btn>
          <Btn onClick={() => setKey((k) => k + 1)}>↻ Restart</Btn>
          <Btn onClick={() => { setGardenLevelsOn(!inGame); setInGame(!inGame); }} title="Garden levels in Home → Garden on this device">In my garden: {inGame ? "On" : "Off"}</Btn>
          {last && <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Last ride: energy {Math.round(last.energy)} · {last.laps.length ? last.laps.map((l) => `${l.kind} ${lapClock(l.ms / 1000)}`).join(", ") : "no laps"}</span>}
        </div>
        <div className="s3-stage">{garden}</div>
      </BroadcastPage>
      <PageGuide page="/star-garden-levels-dev" corner="bottom-left" />
    </>
  );
}
