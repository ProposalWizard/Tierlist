"use client";

/**
 * THE 3D PHONE — the test page (Stage 3; Harry, 19-20 Nov 2026, RUL-UI-008).
 *
 *   Home → tap Phone → an eye-blink opens on your hand holding the phone (the
 *   GTA side-on angle: Fable's hand, tools/phone3d/hand_phone_gta.py). Behind
 *   it is your REAL 3D house (components/star/Home3D.tsx), seen from your own
 *   eyes, blurred: one still frame, no loop while the phone is up.
 *   On the glass is the REAL phone (components/star/PhoneHome.tsx) on a sample
 *   career: apps open and work inside the glass.
 *     HOME (the phone's own, on its home screen) → back to the Home screen;
 *     BACK (the phone's own, on its home screen) → "put phone away": the phone
 *       lowers and the room sharpens, still in your eyes; then the camera pulls
 *       back from your eyes to the house's normal camera, and the house is live.
 *   In the house, "Phone" takes it out again (the camera goes back into your eyes).
 *
 * Harry, 20 Nov: "the back has to be from POV and then zoom out, not go from
 * phone to top down" and "I want to see the phone being used".
 *
 * The screen is a normal page element bent onto the glass with a CSS matrix3d
 * (the screen's corners printed by the Blender script), so taps on it are
 * normal taps. Nothing moves at rest; the moves play only on the tap that
 * asks for them.
 *
 * ?film=1 shows the phone-sized stage alone, on a film clock: nothing moves
 * until window.__phone3dStep(ms) moves it (CSS moves and the 3D camera both),
 * so videos are made frame by frame (software 3D is too slow to record live).
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import Home3D from "@/components/star/Home3D";
import PhoneHome from "@/components/star/PhoneHome";
import RelationsPage from "@/components/star/RelationsPage";
import type { HomeController } from "@/lib/star/home3d/scene";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { generateSquad } from "@/lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { LIFESTYLE_LEVELS, BOOT_LEVELS, baseIdOf } from "@/lib/star/shopDefaults";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import "./phone3d.css";

if (typeof window !== "undefined") setToonYou({ name: "Player" });

/** The stage is a 390x844 phone. Screen corners from fable/final2.json (780x1688 render, halved). */
const STAGE = { w: 390, h: 844 };
const QUAD: [number, number][] = [[96.9, 146.3], [293.95, 176.0], [265.5, 607.3], [43.25, 587.05]]; // tl, tr, br, bl
/** The phone's screen, in CSS px (the box bent onto the glass). */
const SCREEN = { w: 368, h: 666, radius: 46 };
/** How long each move takes (ms). */
const T = { blink: 900, home: 320, lower: 650, pull: 1400, pullIn: 900, raise: 600 };

type Scene = "home" | "opening" | "phone" | "closing-home" | "putting-away" | "pulling-back" | "house" | "taking-out" | "raising";

/** The CSS matrix3d that bends a w x h box onto four points (tl, tr, br, bl). */
function quadMatrix(w: number, h: number, q: [number, number][]): string {
  const src: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [], B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // Gaussian elimination
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const [a, b, c2, d, e, f, g, hh] = B.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c2},${f},0,1)`;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A made-up career (as /star-home3d-dev's): a house, cars, trophies, a squad. */
function sampleCareer(): CareerState {
  const player = { firstName: "Test", lastName: "Player", age: 24, skinTone: "medium", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
  c.squad = generateSquad(7);
  const own = (base: string, level: number) => {
    const it = LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level);
    return it ? [{ ...it }] : [];
  };
  c.ownedItems = [...own("car-3", 5), ...own("suv", 3), ...own("rolex", 1), ...own("tv", 1), ...own("console", 1), ...own("art", 1)];
  const boot = BOOT_LEVELS.find((b) => baseIdOf(b) === "elite" && (b.level ?? 1) === 3);
  if (boot) c.currentBoot = { ...boot };
  c.trophies = [{ season: 1, competition: "FA Cup", club: "Arsenal" }];
  return c;
}

/**
 * The page's clock. Live: real time, a frame loop only while something is
 * moving. Film (?film=1): time moves only when window.__phone3dStep(ms) is
 * called, and every CSS move on the stage is set to that time.
 */
function useClock(film: boolean) {
  const filmT = useRef(0);
  const jobs = useRef<{ at: number; fn: () => void }[]>([]);
  const tweens = useRef<{ t0: number; dur: number; f: (p: number) => void; done?: () => void }[]>([]);
  const raf = useRef<number | null>(null);
  const now = useCallback(() => (film ? filmT.current : performance.now()), [film]);
  const pump = useCallback(() => {
    const t = now();
    for (const j of jobs.current.filter((j) => j.at <= t)) { jobs.current = jobs.current.filter((x) => x !== j); j.fn(); }
    for (const w of tweens.current.slice()) {
      const p = Math.min(1, (t - w.t0) / w.dur);
      w.f(p);
      if (p >= 1) { tweens.current = tweens.current.filter((x) => x !== w); w.done?.(); }
    }
  }, [now]);
  const kick = useCallback(() => {
    if (film || raf.current !== null) return;
    const run = () => {
      pump();
      raf.current = jobs.current.length || tweens.current.length ? requestAnimationFrame(run) : null;
    };
    raf.current = requestAnimationFrame(run);
  }, [film, pump]);
  const after = useCallback((ms: number, fn: () => void) => { jobs.current.push({ at: now() + ms, fn }); kick(); }, [now, kick]);
  const tween = useCallback((dur: number, f: (p: number) => void, done?: () => void) => { tweens.current.push({ t0: now(), dur, f, done }); f(0); kick(); }, [now, kick]);
  const cancel = useCallback(() => { jobs.current = []; tweens.current = []; }, []);
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);
  return { filmT, pump, after, tween, cancel };
}

export default function Phone3dDevPage() {
  return <Suspense><Phone3dTest /></Suspense>;
}

function Phone3dTest() {
  const params = useSearchParams();
  const film = params.get("film") === "1";
  const [scene, setScene] = useState<Scene>("home");
  const [note, setNote] = useState<string | null>(null);
  const [houseReady, setHouseReady] = useState(false);
  const career = useMemo(sampleCareer, []);
  const matrix = useMemo(() => quadMatrix(SCREEN.w, SCREEN.h, QUAD), []);
  const ctrl = useRef<HomeController | null>(null);
  const clock = useClock(film);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const { after, tween, cancel } = clock;

  /** The 3D camera: k = 1 his eyes, 0 the normal camera. Film: drawn at once (the house loop is held). */
  const pov = useCallback((k: number | null) => {
    const c = ctrl.current;
    if (!c) return;
    c.setPov(k);
    if (film) c.renderOnce();
  }, [film]);

  const onReady = useCallback((c: HomeController) => {
    ctrl.current = c;
    c.setPov(1);
    c.hold(true); // one still frame behind the phone: nothing loops at rest
    setHouseReady(true);
  }, []);

  const go = (to: Scene, then?: Scene, ms = 0) => {
    cancel();
    setScene(to);
    if (then) after(ms, () => setScene(then));
  };

  const openPhone = () => { setNote(null); go("opening", "phone", T.blink); };
  const toHome = () => { setNote(null); go("closing-home", "home", T.home); };
  /** BACK: the phone lowers in your eyes, the room sharpens; then the camera pulls back to the normal one. */
  const putAway = () => {
    setNote(null);
    cancel();
    setScene("putting-away");
    after(T.lower, () => {
      setScene("pulling-back");
      if (!film) ctrl.current?.hold(false);
      tween(T.pull, (p) => pov(1 - ease(p)), () => { pov(null); setScene("house"); });
    });
  };
  /** In the house: back into your eyes, then the phone comes up. */
  const takeOut = () => {
    cancel();
    setScene("taking-out");
    tween(T.pullIn, (p) => pov(ease(p)), () => {
      ctrl.current?.hold(true);
      setScene("raising");
      after(T.raise, () => setScene("phone"));
    });
  };
  /** The house's own Back: Home (and the camera back in your eyes, held, for the next time). */
  const houseBack = () => {
    cancel();
    pov(1);
    ctrl.current?.hold(true);
    toHome();
  };

  // ?film=1: the film clock
  useEffect(() => {
    if (!film) return;
    const started = new WeakMap<Animation, number>();
    const w = window as unknown as { __phone3dStep?: (ms: number) => Promise<number>; __phone3dReady?: () => boolean };
    w.__phone3dReady = () => !!ctrl.current;
    w.__phone3dStep = async (ms: number) => {
      const before = clock.filmT.current;
      clock.filmT.current += ms;
      clock.pump();
      await new Promise((r) => setTimeout(r, 0)); // React commits the scene change
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      for (const a of document.getAnimations()) {
        if (!started.has(a)) started.set(a, before);
        a.pause();
        a.currentTime = clock.filmT.current - (started.get(a) ?? before);
      }
      // in the house the 3D moves on the film clock too (Home3D runs a 1/30 s step on ?film=1)
      if (sceneRef.current === "house") ctrl.current?.renderOnce();
      return clock.filmT.current;
    };
    return () => { delete w.__phone3dStep; delete w.__phone3dReady; };
  }, [film, clock]);

  const showPhone = scene === "opening" || scene === "phone" || scene === "closing-home" || scene === "putting-away" || scene === "raising";
  const leaveNote = (to: string) => setNote(`"${to}" leaves the phone in the game. Not on this test page.`);

  const stage = (
    <div className={`p3-stage p3-${scene}`} data-phone3d={scene} style={{ width: STAGE.w, height: STAGE.h }}>
      {/* Your house, live 3D, from your own eyes (held still while the phone is up) */}
      <div className="p3-house3d">
        <Home3D career={career} embedded where="test" tier="house" pov chrome={scene === "house"} onReady={onReady} onBack={houseBack} backLabel="Home" />
      </div>
      <div className="p3-dim" />

      {/* Home (the menu, a picture) */}
      {(scene === "home" || scene === "closing-home") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="p3-full p3-home" src="/star/phone3d/home.webp" alt="" draggable={false} />
      )}
      {scene === "home" && (
        <button type="button" className="p3-hit" data-phone-tab aria-label="Phone" disabled={!houseReady} style={{ left: 232, top: 784, width: 76, height: 60 }} onClick={openPhone} />
      )}

      {/* The hand and the phone, with the real phone on the glass */}
      {showPhone && (
        <div className="p3-held">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p3-full" src="/star/phone3d/hand.webp" alt="" draggable={false} />
          <div className="p3-screen" data-phone-glass style={{ width: SCREEN.w, height: SCREEN.h, borderRadius: SCREEN.radius, transform: matrix, pointerEvents: scene === "phone" ? "auto" : "none" }}>
            <PhoneHome
              career={career}
              fill
              onClose={putAway}
              onPhoneHome={toHome}
              onLeave={(ph) => leaveNote(String(ph))}
              relations={<RelationsPage career={career} onPlayRelationshipGame={(k) => leaveNote(`Play with ${k}`)} onOpen={(ph) => leaveNote(String(ph))} />}
            />
          </div>
        </div>
      )}
      {note && scene === "phone" && <div className="p3-note" data-phone3d-note onClick={() => setNote(null)}>{note}</div>}

      {/* The eye-blinks that open on the phone */}
      {scene === "opening" && (
        <>
          <div className="p3-lid p3-lid-top" />
          <div className="p3-lid p3-lid-bottom" />
        </>
      )}

      {/* In the house: take the phone out again */}
      {scene === "house" && (
        <button type="button" className="p3-pickup" data-pick-up onClick={takeOut}>📱 Phone</button>
      )}
    </div>
  );

  if (film) return <FilmFit>{stage}</FilmFit>;
  return (
    <BroadcastPage title="3D phone" sub="Tap Phone: an eye-blink opens on your hand holding the real phone, your 3D house behind it from your own eyes. The phone's HOME goes to Home; its BACK puts the phone away and the camera pulls back from your eyes into the house.">
      <div className="p3-wrap">{stage}</div>
      <PageGuide page="/star-phone3d-dev" />
    </BroadcastPage>
  );
}

/** ?film=1: the phone-sized stage scaled to fill the window (film at 390x844 with deviceScaleFactor 2 for crisp 3D). */
function FilmFit({ children }: { children: React.ReactNode }) {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const fit = () => setZ(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return <div className="p3-film"><div style={{ zoom: z }}>{children}</div></div>;
}
