"use client";
/**
 * Live chances, as a player sets them (lib/star/liveChance.ts): the switch
 * (off by default), the kick screen, and the sliders. Saved on this phone.
 * Shown in Settings → Match (admins) and Settings → Updates (Leo's card).
 * The test page /star-live-chances-dev has its own copies, never saved.
 */
import { useEffect, useState } from "react";
import { LIVE_DEFAULTS, LIVE_DIAL_INFO, LIVE_EVENT, LIVE_LIMITS, liveChancesOn, liveDials, liveStrikeScreenOn, resetLiveDials, setLiveChances, setLiveDial, setLiveStrikeScreen } from "@/lib/star/liveChance";
import { SetToggle } from "./settingsKit";

export default function LiveChancesSettings({ last = true }: { last?: boolean }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const r = () => bump((n) => n + 1);
    window.addEventListener(LIVE_EVENT, r);
    window.addEventListener("storage", r);
    return () => { window.removeEventListener(LIVE_EVENT, r); window.removeEventListener("storage", r); };
  }, []);
  const on = liveChancesOn();
  return (
    <div data-live-chances>
      <SetToggle label={on ? "Live chances: On (test)" : "Live chances: Off"} on={on} onClick={() => setLiveChances(!on)} last={last && !on} />
      <p className="-mt-1 mb-1 pl-1 text-[10.5px] font-semibold leading-snug text-white/70">Its own switch, off by default. On: the last pass keeps coming to you; time your strike as it arrives (early stabs it, late gets under it, miss it and the chance is gone). Set pieces, headers and volleys stay as they are.</p>
      {on && (
        <div data-live-settings>
          <SetToggle label={liveStrikeScreenOn() ? "Kick screen: On (then tap where on the ball)" : "Kick screen: Off (letting go = the kick)"} on={liveStrikeScreenOn()} onClick={() => setLiveStrikeScreen(!liveStrikeScreenOn())} />
          <p className="-mt-1 mb-2 pl-1 text-[10.5px] font-semibold leading-snug text-white/70">On: letting go is the moment you meet it (that sets early, clean or late), then the normal kick screen opens: tap where on the ball, sides curl, bottom chips, top drives. Off: letting go is the kick.</p>
          {LIVE_DIAL_INFO.map((d) => {
            const v = liveDials()[d.k];
            return (
              <div key={d.k} className="mb-2 px-1" data-live-dial={d.k}>
                <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-white">
                  <span>{d.name}</span>
                  <span className="shrink-0 tabular-nums">{v.toFixed(2)} {d.unit}{v === LIVE_DEFAULTS[d.k] ? " (default)" : ""}</span>
                </div>
                <input type="range" className="w-full" min={LIVE_LIMITS[d.k][0]} max={LIVE_LIMITS[d.k][1]} step={d.step} value={v}
                  onChange={(e) => setLiveDial(d.k, Number(e.target.value))} aria-label={d.name} />
                <p className="text-[10px] font-semibold leading-snug text-white/60">{d.help}</p>
              </div>
            );
          })}
          <button type="button" onClick={resetLiveDials} className="mb-1 ml-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">Reset the sliders</button>
        </div>
      )}
    </div>
  );
}
