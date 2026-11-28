"use client";

/**
 * THE 3D PHONE, IN THE GAME (Harry, 19-21 Nov 2026; RUL-UI-008).
 *
 * Your house (Home3D) and the phone in your hand, as one screen, so the
 * house never reloads between them:
 *   - `up` (the page's phase "media", the Phone tab): an eye-opening (B, 0.9 s)
 *     onto your hand holding the phone, your house behind it from your own
 *     eyes, blurred and still. The REAL phone (PhoneHome) is on the glass:
 *     a normal page box bent with a CSS matrix3d, so the browser sends each
 *     tap to the button under the finger. Every app works inside the glass
 *     (PhoneHome `apps`, components/star/PhoneApps.tsx; Harry 27 Nov 2026).
 *       HOME (the phone's own, on its home screen) → `onHome` (the Home screen);
 *       BACK (the phone's own, on its home screen) → `onPutAway`: the page goes
 *       to the house (phase "home-3d"), `up` turns false here, the hand
 *       lowers and the camera eases out of your eyes to camera D.
 *   - not `up` (phase "home-3d"): the house as always, plus a "📱 Phone" pill
 *     (`onPhone`): the camera goes into your eyes and the phone comes up (0.6 s).
 * A tap during any move skips to its end. The phone is usable at once on the
 * tap that opens it: nothing waits for the 3D. The house loads behind the
 * phone once it has been up 2.5 s, in idle time (a blurred picture of a room
 * until then), or at once on BACK.
 *
 * Kickabout (the real match on a canvas, which reads taps by its box) brings
 * the phone flat to your face while it is open.
 *
 * The page uses this only where `phone3dCan()` (WebGL, not the Low 3D tier,
 * no reduced motion); everywhere else the flat phone opens, as before.
 * Test page for the look: /star-phone3d-dev.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { HomeController } from "@/lib/star/home3d/scene";
import type { Home3DProps } from "./Home3D";
import { lazyScreen } from "@/lib/star/lazyScreen";
import { quality3dTier, quality3dSetting } from "@/lib/star/three3d/quality";
import { HOME3D_IN_CAREER } from "@/lib/star/home3d/flag";
import { STAGE, SCREEN, GLASS_MATRIX } from "@/lib/star/phone3dGlass";
import "./housePhone.css";

const Home3D = lazyScreen(() => import("./Home3D"));

const HAND = "/star/phone3d/hand.webp";
const ROOM = "/star/phone3d/room-blur.webp";
/** How long each move takes (ms). Opening 0.9 s (Harry, 27 Nov 2026: "an in-between. The slower blink was good";
 *  was 0.6 s; the test page's B is 1.2 s). A tap skips it. */
const T = { open: 900, lower: 300, pull: 700, pullIn: 300, raise: 300 };
/** The phone up this long (ms) before the house behind it starts loading. */
const HOUSE_AFTER = 2500;
/** Kickabout: the glass flat, in the middle of the picture. */
const FLAT = `translate(${(STAGE.w - SCREEN.w) / 2}px, ${(STAGE.h - SCREEN.h) / 2}px)`;

let webgl: boolean | undefined;
let handDecoded = false;
/** When the phone was last up and left for another screen (Sponsors, Settings…): coming back puts it straight in your hand. */
let leftUpAt = 0;

/** The last answer, kept while the house-and-phone screen is open: the house reading the GPU's name can move Auto to Low
 *  mid-visit (three3d/quality.ts noteGpu3d), and the phone must not jump from 3D to flat under your finger. */
let lastAnswer: boolean | null = null;
let holding = false;

/** Can this phone show the 3D phone? WebGL, not the Low 3D tier, no reduced motion. Else the flat phone. */
export function phone3dCan(): boolean {
  if (holding && lastAnswer !== null) return lastAnswer;
  return (lastAnswer = phone3dNow());
}

/** Auto's answer is read once per visit to the game (27 Nov 2026: a scene reading the GPU's name could move
 *  Auto to Low between two Phone taps, so the 3D phone "toggled off" by itself). Only the player's own
 *  Settings → 3D quality: Low turns it off mid-visit. */
let autoLowOnce: boolean | undefined;
function phone3dNow(): boolean {
  if (typeof window === "undefined" || !HOME3D_IN_CAREER) return false;
  try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false; } catch { /* old browser */ }
  const set = quality3dSetting();
  if (set === "low") return false;
  if (set === "auto") {
    if (autoLowOnce === undefined) autoLowOnce = quality3dTier() === "low";
    if (autoLowOnce) return false;
  }
  if (webgl === undefined) {
    try {
      const g = document.createElement("canvas").getContext("webgl2");
      webgl = !!g;
      g?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { webgl = false; }
  }
  return webgl;
}

/** In idle time on Home or in the house: the hand picture, the room picture and the WebGL check, so the first tap is instant. */
export function preloadPhone3d(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!phone3dCan()) return Promise.resolve();
  const decode = (src: string) => { const im = new Image(); im.src = src; return im.decode().catch(() => {}); };
  return Promise.all([decode(HAND).then(() => { handDecoded = true; }), decode(ROOM)]).then(() => {});
}

type Scene = "opening" | "phone" | "putting-away" | "away" | "taking-out" | "raising";

export interface PhoneGlass {
  fill: true;
  onClose: () => void;
  onPhoneHome: () => void;
  onApp: (id: string | null) => void;
}

export default function HousePhone({ career, up, phone, house, onHome, onPutAway, onPhone, notice }: {
  career: CareerState;
  /** The phone is in your hand (phase "media"); false: you are in the house (phase "home-3d"). */
  up: boolean;
  /** The real phone, with the glass's props spread on it. */
  phone: (glass: PhoneGlass) => ReactNode;
  /** The house's own props (back, the front door, the wardrobe, sleep). */
  house: Pick<Home3DProps, "onBack" | "backLabel" | "onDoor" | "onOutfit" | "onSleep" | "onTime" | "onMatch" | "onInvite" | "onUse">;
  /** The phone's HOME: the Home screen. */
  onHome: () => void;
  /** The phone's BACK: put it away, into the house. */
  onPutAway: () => void;
  /** In the house: take the phone out. Absent: no pill (the phone is not open yet). */
  onPhone?: () => void;
  /** A line to show over the phone (a locked app). */
  notice?: string | null;
}) {
  const [scene, setScene] = useState<Scene>(() => (!up ? "away" : handDecoded && Date.now() - leftUpAt > 60000 ? "opening" : "phone"));
  const [houseOn, setHouseOn] = useState(!up);
  const [houseReady, setHouseReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [fit, setFit] = useState(() => (typeof window === "undefined" ? 1 : Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h)));
  const ctrl = useRef<HomeController | null>(null);
  const timers = useRef<number[]>([]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const homed = useRef(false);
  /** The house is built (a ref: the put-away timer must see it even when it was ready after the tap). */
  const readyRef = useRef(false);

  const clear = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    const on = () => setFit(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h));
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("resize", on); clear(); };
  }, []);

  // left for another screen with the phone up: back in your hand when you return
  const upRef = useRef(up);
  upRef.current = up;
  // decided once as this screen opens (before the house reads the GPU), then kept while it is open
  useState(() => { if (!holding) lastAnswer = phone3dNow(); return 0; });
  holding = true;
  useEffect(() => () => { holding = false; }, []);
  // (a mount that lived under half a second is React's dev double-mount, not a visit)
  useEffect(() => { const t0 = Date.now(); return () => { if (upRef.current && !homed.current && Date.now() - t0 > 500) leftUpAt = Date.now(); }; }, []);

  // the eye-opening ends on the phone
  useEffect(() => {
    if (scene !== "opening") return;
    const t = window.setTimeout(() => setScene((s) => (s === "opening" ? "phone" : s)), T.open);
    return () => clearTimeout(t);
  }, [scene]);

  // The house behind the phone loads once the phone has been up a while (HOUSE_AFTER), in idle time:
  // a quick look at the phone and back Home never pays for building the house. BACK loads it at once.
  useEffect(() => {
    if (houseOn || scene !== "phone") return;
    let id = 0;
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const t = window.setTimeout(() => {
      if (w.requestIdleCallback) id = w.requestIdleCallback(() => setHouseOn(true), { timeout: 1500 });
      else setHouseOn(true);
    }, HOUSE_AFTER);
    return () => { clearTimeout(t); if (id) w.cancelIdleCallback?.(id); };
  }, [houseOn, scene]);

  // in the house: get the hand ready for the first Phone tap
  useEffect(() => {
    if (up) return;
    const w = window as unknown as { requestIdleCallback?: (f: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => { void preloadPhone3d(); });
    else window.setTimeout(() => { void preloadPhone3d(); }, 500);
  }, [up]);

  const onReady = useCallback((c: HomeController) => {
    ctrl.current = c;
    // Put down while the house was still loading (Harry, 27 Nov 2026: a frozen house at your eyes,
    // no you in it): it was built for the phone's view, so it comes out of your eyes and runs.
    const down = sceneRef.current === "away" || sceneRef.current === "putting-away";
    if (down) { c.setPov(null); c.hold(false); } else { c.setPov(1); c.hold(true); }
    readyRef.current = true;
    setHouseReady(true);
  }, []);

  /** BACK on the phone: the hand lowers, then the camera eases out of your eyes. */
  const lowerAndPull = useCallback(() => {
    clear();
    setFlat(false);
    setHouseOn(true);
    setScene("putting-away");
    after(T.lower, () => {
      const c = ctrl.current;
      if (!c || !readyRef.current) { setScene("away"); return; }
      c.easePov ? c.easePov(null, T.pull, () => setScene((s) => (s === "putting-away" ? "away" : s))) : (c.setPov(null), c.hold(false), setScene("away"));
      after(T.pull + 400, () => setScene((s) => (s === "putting-away" ? "away" : s)));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseReady]);

  /** The Phone pill in the house: into your eyes, then the phone comes up. */
  const intoEyes = useCallback(() => {
    clear();
    const c = ctrl.current;
    if (!c || !houseReady || !c.easePov) { c?.setPov(1); c?.hold(true); setScene("phone"); return; }
    setScene("taking-out");
    c.easePov(1, T.pullIn, () => { if (upRef.current) c.hold(true); });
    after(T.pullIn, () => setScene((s) => (s === "taking-out" ? "raising" : s)));
    after(T.pullIn + T.raise, () => setScene((s) => (s === "raising" ? "phone" : s)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseReady]);

  // the page flips `up`: play the move
  const prevUp = useRef(up);
  useEffect(() => {
    if (prevUp.current === up) return;
    prevUp.current = up;
    if (up) intoEyes(); else lowerAndPull();
  }, [up, intoEyes, lowerAndPull]);

  /** A tap during a move: straight to its end. */
  const skip = () => {
    clear();
    const c = ctrl.current;
    if (upRef.current) { if (c && houseReady) { c.setPov(1); c.hold(true); } setScene("phone"); }
    else { if (c && houseReady) { c.setPov(null); c.hold(false); } setScene("away"); }
  };

  const showPhone = scene === "opening" || scene === "phone" || scene === "putting-away" || scene === "raising";
  const moving = scene === "opening" || scene === "putting-away" || scene === "taking-out" || scene === "raising";
  const glass: PhoneGlass = {
    fill: true,
    onClose: onPutAway,
    onPhoneHome: () => { homed.current = true; onHome(); },
    onApp: (id) => setFlat(id === "kickabout"),
  };

  return (
    <div className={`hp hp-${scene}${flat ? " hp-flat" : ""}${houseReady ? " hp-ready" : ""}`} data-phone3d={scene}>
      {houseOn && <Home3D career={career} {...house} pov={up} chrome={scene === "away"} onReady={onReady} />}
      {showPhone && (
        <div className="hp-layer">
          <div className="hp-back" />
          <div className="hp-box" style={{ transform: `translateX(-50%) scale(${fit})` }}>
            <div className="hp-held">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hp-hand" src={HAND} alt="" draggable={false} />
              <div className="hp-screen" data-phone-glass
                style={{ width: SCREEN.w, height: SCREEN.h, borderRadius: flat ? 28 : SCREEN.radius, transform: flat ? FLAT : GLASS_MATRIX, pointerEvents: scene === "phone" ? "auto" : "none" }}>
                {phone(glass)}
              </div>
            </div>
          </div>
          {scene === "opening" && (<><div className="hp-glare" /><div className="hp-eyes" /></>)}
          {notice && scene === "phone" && <div className="hp-note">{notice}</div>}
        </div>
      )}
      {moving && <div className="hp-skip" data-phone3d-skip onPointerDown={skip} />}
      {/* the Phone pill: shown whenever you are in the house (loaded or not), every time you put the phone down */}
      {scene === "away" && onPhone && (
        <button type="button" className="hp-pickup" data-pick-up onClick={onPhone}>📱 Phone</button>
      )}
      {notice && scene === "away" && <div className="hp-note" data-phone-note style={{ position: "fixed", zIndex: 82, top: "calc(max(12px, env(safe-area-inset-top)) + 140px)" }}>{notice}</div>}
    </div>
  );
}
