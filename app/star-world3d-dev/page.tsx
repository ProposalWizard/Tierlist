"use client";

/**
 * 3D WORLD KIT — the test page (phase 1 of the shared world kit, Harry,
 * 20 Nov 2026: every 3D area needs "characters interact with the world. Are
 * they walking around?"). The house lounge and a garden, alive: sit on the
 * sofa, watch the TV, take a can from the fridge; in the garden team-mates
 * sit on the bench, chat, stand and stretch, one drops round at the gate and
 * leaves again; tap one to talk. Built on lib/star/world3d (smart objects,
 * routines, people, the card, the budget). Not in the real game yet
 * (RUL-UI-002): the game's house and garden are unchanged.
 *
 * ?place=house|garden, ?demo=sofa|fridge|visitor|talk (a scripted run, for
 * filming with scripts/film/frames3d.mjs), ?bare=1 / ?film=1 full screen,
 * ?q=low|medium|high the quality tier. Nothing is saved.
 */
import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import World3D from "@/components/star/World3D";
import "../star-3d-area-dev/stage3d.css";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import { chat as lifeChat } from "@/lib/star/life/social";
import { parseQuality3d } from "@/lib/star/three3d/quality";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import type { WorldOptions, WorldPlace } from "@/lib/star/world3d/testScene";

if (typeof window !== "undefined") setToonYou({ name: "Player" });

export default function World3DTestPage() {
  return <Suspense><World3DTest /></Suspense>;
}

function World3DTest() {
  const params = useSearchParams();
  const demo = params.get("demo");
  const [place, setPlace] = useState<WorldPlace>(params.get("place") === "house" || demo === "sofa" || demo === "fridge" ? "house" : "garden");
  const [run, setRun] = useState(0);
  const quality = parseQuality3d(params.get("q")) ?? undefined;
  // a made-up career: the squad gives the team-mates their names, numbers and the living world's chat
  const career = useRef<CareerState | null>(null);
  if (!career.current) {
    const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
    const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
    c.squad = generateSquad(7);
    career.current = c;
  }
  const options = useMemo<WorldOptions>(() => {
    const c = career.current!;
    const kit = kitsOf("Arsenal").home;
    const mates = (c.squad ?? []).filter((p) => p.position !== "GK").slice(0, 3).map((p, i) => ({ id: p.id, name: p.shortName || p.name, number: [8, 14, 21][i] }));
    return {
      place, demo, quality, number: 9, mates, club: "Arsenal",
      kit: { shirt: kit.shirt, trim: kit.trim },
      // the living world's chat (lib/star/life/social.ts): pure, on this page's made-up career only
      chat: (slot: string) => {
        const idx = Number(slot.replace("mate-", ""));
        const m = mates[idx];
        if (!m || !career.current) return null;
        let seed = 7 + idx;
        const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const r = lifeChat(career.current, m.id, rng);
        if (!r) return null;
        career.current = r.career;
        const ch = r.changes.find((x) => x.kind === "person");
        return { line: r.line, change: ch?.delta ? `${ch.label} ${ch.delta > 0 ? "+" : ""}${ch.delta}` : undefined };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, demo, quality, run]);

  const bare = params.get("bare") === "1" || params.get("film") === "1";
  const stage = <World3D key={`${place}-${run}`} options={options} clean={params.get("clean") === "1"} />;
  if (bare) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0 }}>{stage}</div>
        {params.get("clean") !== "1" && <PageGuide page="/star-world3d-dev" corner="bottom-left" />}
      </>
    );
  }
  return (
    <>
      <BroadcastPage title="3D world kit" sub="People who use things: sit, watch TV, take a can, drop round, chat. Tap to walk; tap a thing or a person." width={1440}>
        <div className="s3-bar" data-world3d-dev>
          <Pill on={place === "house"} onClick={() => setPlace("house")}>House</Pill>
          <Pill on={place === "garden"} onClick={() => setPlace("garden")}>Garden</Pill>
          <Btn onClick={() => setRun((k) => k + 1)}>↻ Restart</Btn>
        </div>
        <div className="s3-stage">{stage}</div>
      </BroadcastPage>
      <PageGuide page="/star-world3d-dev" corner="bottom-left" />
    </>
  );
}
