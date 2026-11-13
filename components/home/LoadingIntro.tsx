"use client";

import { useEffect, useRef, useState } from "react";
import { Ball } from "./TileArt";

/**
 * The home's short loading picture (Harry, 12 Nov 2026: "some sort of notable
 * loading screen where we do like an animation"). A ball drops in and the
 * name appears: about 1.1 s, then it fades by itself (CSS only, so it never
 * waits for the page's code). Tap or press a key to skip. Shown once per
 * browser session; not shown at all when the device asks for less motion.
 */
const KEY = "kib-home-intro";

export default function LoadingIntro() {
  const [gone, setGone] = useState(false);

  const checked = useRef(false);

  useEffect(() => {
    if (!checked.current) {
      checked.current = true;
      try {
        if (sessionStorage.getItem(KEY)) setGone(true);
        else sessionStorage.setItem(KEY, "1");
      } catch {}
    }
    const skip = () => setGone(true);
    window.addEventListener("keydown", skip, { once: true });
    const t = window.setTimeout(skip, 1500);
    return () => { window.removeEventListener("keydown", skip); window.clearTimeout(t); };
  }, []);

  if (gone) return null;
  return (
    <>
      <div id="kh-intro" className="kh-intro" onClick={() => setGone(true)} role="presentation" suppressHydrationWarning>
        <div className="kh-intro-stage">
          <div className="kh-intro-ball"><Ball size={64} /></div>
          <div className="kh-intro-shadow" />
        </div>
        <div className="kh-intro-name">KNOWITBALL</div>
        <div className="kh-intro-skip">Tap to skip</div>
      </div>
      {/* Seen already this session: hide it before the first paint. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("${KEY}")){document.getElementById("kh-intro").hidden=true}}catch(e){}`,
        }}
      />
    </>
  );
}
