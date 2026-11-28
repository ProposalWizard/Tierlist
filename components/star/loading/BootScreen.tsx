/**
 * THE FIRST LOAD (Harry, 27 Nov 2026): the game's opening while its code
 * downloads. Measured before: 3.4 s of a blank page on a fresh visit, then
 * "Loading career…". This is drawn on the server, so it is on the phone with
 * the first bytes; it needs no JavaScript to show or to move (CSS only).
 *
 * Three openings for the whole game (lib/star/loading/pick.ts "first-load"):
 * the floodlights coming on over the stadium, the golden ball, keepie-uppies
 * at sunset. A tiny script in the page picks one before it is drawn, never
 * the one shown last time. app/star-dev/page.tsx lifts it the moment the
 * game's first real screen is ready.
 */
import type { CSSProperties } from "react";
import { pitchFont } from "@/components/star/ui/pitchFont";
import { LOAD_MEMORY_KEY, LOAD_VARIANTS } from "@/lib/star/loading/pick";
import "./curtain.css";

const IDS = LOAD_VARIANTS["first-load"].map((v) => v.id);

// Runs as the page is read, before it is drawn: picks this visit's opening
// (never last time's), remembers it, and shows it by a style rule.
const PICK = `(function(){try{var k=${JSON.stringify(LOAD_MEMORY_KEY)},ids=${JSON.stringify(IDS)},m={};try{m=JSON.parse(localStorage.getItem(k)||"{}")||{}}catch(e){}
var last=m["first-load"],pool=ids.filter(function(i){return i!==last});var id=pool[Math.floor(Math.random()*pool.length)]||ids[0];
m["first-load"]=id;try{localStorage.setItem(k,JSON.stringify(m))}catch(e){}
var s=document.createElement("style");s.id="kib-boot-pick";s.textContent='.lc-boot-v{display:none!important}.lc-boot-v[data-v="'+id+'"]{display:block!important}';document.head.appendChild(s);}catch(e){}})();`;

const FLOODS: [number, number][] = [[14, 0], [38, .35], [62, .7], [86, 1.05]];

function Word() {
  return (
    <div className="lc-bt-word">
      <div className="lc-caps">Knowitball</div>
      <h1 className="lc-display">Road to the<span>Golden Ball</span></h1>
    </div>
  );
}

export default function BootScreen({ leaving, show }: { leaving?: boolean; /** The test page: only this opening, no pick. */ show?: string }) {
  const keep = (id: string) => !show || show === id;
  const on = (id: string): CSSProperties | undefined => (show === id ? { display: "block" } : undefined);
  return (
    <div className={`lc-root ${pitchFont.variable} ${leaving ? "lc-out" : ""}`} data-kib-curtain="first-load" data-loading-section="first-load" role="status" aria-busy={!leaving} suppressHydrationWarning>
      {!show && <script dangerouslySetInnerHTML={{ __html: PICK }} />}
      {keep("boot-floodlights") && <div className="lc-boot-v" data-v="boot-floodlights" style={on("boot-floodlights")}>
        <div className="lc-bt-bg" style={{ backgroundImage: "url(/home/tall-night.webp)" }} />
        <div className="lc-bt-shade" />
        {FLOODS.map(([x, d]) => <div key={x} className="lc-bt-fl" style={{ left: `${x}%`, "--d": `${d}s` } as CSSProperties} />)}
        <Word />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="lc-bt-ball"><img src="/star/loading/ball.webp" alt="" /></div>
      </div>}
      {keep("boot-golden") && <div className="lc-boot-v" data-v="boot-golden" style={on("boot-golden")}>
        <div className="lc-ga-room" />
        <div className="lc-ga-spot l" />
        <div className="lc-ga-spot r" />
        <div className="lc-ga-ball" style={{ top: "56%" }}>
          <div className="glow" />
          <div className="plinth" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/star/loading/ball-gold.webp" alt="" />
          <div className="shine" />
          <div className="rim" />
        </div>
        <Word />
      </div>}
      {keep("boot-sunset") && <div className="lc-boot-v" data-v="boot-sunset" style={on("boot-sunset")}>
        <div className="lc-kp-bg" style={{ backgroundImage: "url(/home/tall-sunset.webp)" }} />
        <div className="lc-kp-shade" />
        <Word />
        <div className="lc-kp-x">
          <div className="lc-kp-sh" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lc-kp-boot" src="/star/loading/boot.webp" alt="" />
          <div className="lc-kp-ring" />
          <div className="lc-kp-y">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="lc-kp-ball"><img src="/star/loading/ball.webp" alt="" /></div>
          </div>
        </div>
      </div>}
      <div className="lc-where"><span>Getting the game ready</span><span className="lc-dots" aria-hidden><i style={{ "--d": "0s" } as CSSProperties} /><i style={{ "--d": ".2s" } as CSSProperties} /><i style={{ "--d": ".4s" } as CSSProperties} /></span></div>
      <div className="lc-bt-slow">Taking a while? <a href="">Reload</a></div>
    </div>
  );
}
