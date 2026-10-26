"use client";
/**
 * Settings → Updates → "Leo's 26 Oct update" (admins only; the 24 Oct update plus the 25-26 Oct fixes and weather). One switch for
 * the whole update, then one per part (lib/star/leoUpdate.ts). Off = the game
 * exactly as before. Per device.
 */
import { useEffect, useState } from "react";
import { LEO_FEATURES, leoUpdateOn, setLeoFeature, setLeoUpdate, type LeoFeature } from "@/lib/star/leoUpdate";
import { SetCard, SetHead, SetNote, SetToggle } from "./settingsKit";

const TEST_PAGES: [string, string][] = [
  ["/star-real-goals-dev", "Real Goals (paths, bangers, daily goal)"],
  ["/star-shootout-dev", "Shootout keeper that reads you"],
  ["/star-weather-dev", "Weather and pitch"],
  ["/star-season-reel-dev", "Season video"],
  ["/star-awards-night-dev", "Awards night"],
  ["/star-goals-gallery-dev", "Goals list"],
];

export default function LeoUpdateCard({ glow }: { glow: string }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const r = () => bump((n) => n + 1);
    window.addEventListener("kib-leo-update", r);
    return () => window.removeEventListener("kib-leo-update", r);
  }, []);
  const on = leoUpdateOn();
  const partOn = (f: LeoFeature) => leoUpdateOn(f);
  return (
    <SetCard tone={glow} data-leo-update>
      <SetHead>Leo&apos;s 26 Oct update</SetHead>
      <SetNote>Admins only, this phone only. Off = the game exactly as before. Turn it on to try everything; each part has its own switch. Includes the 24 Oct parts plus 26 Oct: weather, smooth feed, no banner, celebration and end-of-season fixes.</SetNote>
      <div className="mt-2">
        <SetToggle label={on ? "On: the update is in your game" : "Off: the game as before"} on={on} onClick={() => setLeoUpdate(!on)} last={!on} />
        {on && LEO_FEATURES.map((f, i) => (
          <div key={f.id} data-leo-feature={f.id}>
            <SetToggle label={f.label} on={partOn(f.id)} onClick={() => setLeoFeature(f.id, !partOn(f.id))} last={i === LEO_FEATURES.length - 1} />
            <p className="-mt-1 mb-1 pl-1 text-[10.5px] font-semibold leading-snug text-white/70">{f.line}</p>
          </div>
        ))}
      </div>
      <SetNote dim className="mt-2 text-[11px]">Test pages (no switch needed; they never touch your career):</SetNote>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {TEST_PAGES.map(([href, label]) => (
          <a key={href} href={href} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">{label} →</a>
        ))}
      </div>
    </SetCard>
  );
}
