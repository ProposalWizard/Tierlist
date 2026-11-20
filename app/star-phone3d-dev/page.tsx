"use client";

/**
 * THE 3D PHONE — the test page (Stage 3, step 1; Harry, 19-20 Nov 2026,
 * RUL-UI-008). A still-picture proof of the flow before any live 3D:
 *
 *   Home → tap Phone → an eye-blink opens on your hand holding the phone (the
 *   GTA side-on angle: Fable's hand, tools/phone3d/hand_phone_gta.py) with your
 *   house blurred behind → the phone's own screen on the glass:
 *     HOME  → back to the Home screen;
 *     BACK  → "put phone away": the phone lowers and the room comes into focus,
 *             you are standing in your house.
 *   In the house, tap anywhere to take the phone out again.
 *
 * The screen is a normal page element bent onto the glass with a CSS matrix3d
 * (the screen's corners printed by the Blender script), so taps on it are
 * normal taps (the 3D audit, section e). Nothing moves at rest; the moves play
 * only on the tap that asks for them.
 *
 * ?film=1 shows the phone-sized stage alone (for videos). Pictures in
 * public/star/phone3d/ (made from the renders and captures; see the dev note
 * in lib/adminGuides.ts).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import "./phone3d.css";

/** The stage is a 390x844 phone. Screen corners from fable/final2.json (780x1688 render, halved). */
const STAGE = { w: 390, h: 844 };
const QUAD: [number, number][] = [[96.9, 146.3], [293.95, 176.0], [265.5, 607.3], [43.25, 587.05]]; // tl, tr, br, bl
/** The phone screen picture, in CSS px (public/star/phone3d/screen.webp is 3x). */
const SCREEN = { w: 368, h: 666, radius: 46 };
/** Where HOME and BACK sit on that screen (CSS px of the screen). */
const HOME_HIT = { x: 20, y: 610, w: 110, h: 52 };
const BACK_HIT = { x: 255, y: 610, w: 100, h: 52 };

type Scene = "home" | "opening" | "phone" | "closing-home" | "putting-away" | "house";

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

export default function Phone3dDevPage() {
  return <Suspense><Phone3dTest /></Suspense>;
}

function Phone3dTest() {
  const params = useSearchParams();
  const film = params.get("film") === "1";
  const [scene, setScene] = useState<Scene>("home");
  const timer = useRef<number | null>(null);
  const matrix = useMemo(() => quadMatrix(SCREEN.w, SCREEN.h, QUAD), []);
  const go = (to: Scene, then?: Scene, ms = 0) => {
    if (timer.current) window.clearTimeout(timer.current);
    setScene(to);
    if (then) timer.current = window.setTimeout(() => setScene(then), ms);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const inPhone = scene === "opening" || scene === "phone" || scene === "closing-home" || scene === "putting-away";

  const stage = (
    <div className={`p3-stage p3-${scene}`} data-phone3d={scene} style={{ width: STAGE.w, height: STAGE.h }}>
      {/* Home (the menu) */}
      {(scene === "home" || scene === "closing-home") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="p3-full p3-home" src="/star/phone3d/home.webp" alt="" draggable={false} />
      )}
      {scene === "home" && (
        <button type="button" className="p3-hit" data-phone-tab aria-label="Phone" style={{ left: 232, top: 784, width: 76, height: 60 }} onClick={() => go("opening", "phone", 900)} />
      )}

      {/* Your room: blurred behind the phone, sharp once it is put away */}
      {(inPhone || scene === "house") && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p3-full p3-room" src="/star/phone3d/room.webp" alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p3-full p3-room-blur" src="/star/phone3d/room-blur.webp" alt="" draggable={false} />
        </>
      )}

      {/* The hand and the phone, with the phone's own screen bent onto the glass */}
      {inPhone && (
        <div className="p3-held">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="p3-full" src="/star/phone3d/hand.webp" alt="" draggable={false} />
          <div className="p3-screen" style={{ width: SCREEN.w, height: SCREEN.h, borderRadius: SCREEN.radius, transform: matrix }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/star/phone3d/screen.webp" alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
            {scene === "phone" && (
              <>
                <button type="button" className="p3-hit" data-phone-home aria-label="Home" style={{ left: HOME_HIT.x, top: HOME_HIT.y, width: HOME_HIT.w, height: HOME_HIT.h }} onClick={() => go("closing-home", "home", 320)} />
                <button type="button" className="p3-hit" data-phone-back aria-label="Put phone away" style={{ left: BACK_HIT.x, top: BACK_HIT.y, width: BACK_HIT.w, height: BACK_HIT.h }} onClick={() => go("putting-away", "house", 750)} />
              </>
            )}
          </div>
        </div>
      )}

      {/* The eye-blink that opens on the phone */}
      {scene === "opening" && (
        <>
          <div className="p3-lid p3-lid-top" />
          <div className="p3-lid p3-lid-bottom" />
        </>
      )}

      {/* In the house: tap anywhere to take the phone out again */}
      {scene === "house" && (
        <button type="button" className="p3-hit p3-full" data-pick-up aria-label="Take the phone out" onClick={() => go("opening", "phone", 900)} />
      )}
    </div>
  );

  if (film) return <FilmFit>{stage}</FilmFit>;
  return (
    <BroadcastPage title="3D phone" sub="Tap Phone: an eye-blink opens on your hand holding the phone. HOME goes to Home; BACK puts the phone away into your house. Pictures only, no live 3D yet.">
      <div className="p3-wrap">{stage}</div>
      <PageGuide page="/star-phone3d-dev" />
    </BroadcastPage>
  );
}

/** ?film=1: the phone-sized stage scaled to fill the window (for crisp videos). */
function FilmFit({ children }: { children: React.ReactNode }) {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const fit = () => setZ(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return <div className="p3-film"><div style={{ zoom: z }}>{children}</div></div>;
}
