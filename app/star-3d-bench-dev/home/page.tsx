"use client";
/**
 * THE BENCH'S HOME SHOT — your Style A player exactly as Home draws him
 * (components/star/HomePlayer.tsx: the glow, the pool of light, the figure),
 * on Home's stadium picture, at Home's box size on a 390 × 844 phone. No
 * career is needed: a made-up one with a fixed look.
 *
 *   ?head=h1..h6  ?body=c1..c3  ?skin=porcelain|fair|light|tan|olive|brown|deep|dark  ?sky=day|sunset|night
 */
import { useEffect, useState } from "react";
import HomePlayer from "@/components/star/HomePlayer";
import type { CareerState } from "@/lib/star/types";
import { setToonYou, type ToonBody, type ToonHead } from "@/lib/star/style3d/toon/bodies";
import { SKIN_TONES, HAIR_COLOURS } from "@/lib/star/playerIdentity";

export default function BenchHomeShot() {
  const [ready, setReady] = useState(false);
  const [sky, setSky] = useState("sunset");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const skin = SKIN_TONES.find((s) => s.id === q.get("skin")) ?? SKIN_TONES[3];
    setToonYou({
      head: (q.get("head") ?? "h4") as ToonHead, body: (q.get("body") ?? "c2") as ToonBody,
      skin: skin.hex, hair: HAIR_COLOURS[1].hex, name: "Bench",
    });
    const s = q.get("sky"); if (s === "day" || s === "night" || s === "sunset") setSky(s);
    setReady(true);
  }, []);
  const career = { squadNumber: 10, season: 1, player: { firstName: "Bench", lastName: "Player" } } as unknown as CareerState;
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0b1220" }} data-bench-home>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(/home/tall-${sky}.webp)`, backgroundSize: "cover", backgroundPosition: "center 58%" }} />
      {ready && (
        <div style={{ position: "absolute", left: "50%", bottom: 150, transform: "translateX(-50%)" }}>
          <HomePlayer career={career} width={287} height={340} where="home" look={"A1" as never} kitShirt="#d61f26" kitTrim="#ffffff" glow="#d61f26" />
        </div>
      )}
    </div>
  );
}
