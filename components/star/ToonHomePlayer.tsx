"use client";
/**
 * YOUR STYLE A PLAYER ON HOME AND THE TITLE SCREEN (Harry, 9 Oct 2026: "home +
 * title … needs to be translated to the new style of player once done").
 *
 * Drawn inside HomePlayerFigure's box (boots on the bottom edge), only under
 * Settings → Look → "Player style: New". Your head, build, skin and hair
 * (Settings → Your look), your club kit and number, the relaxed idle with the
 * fixed hands. Home: drag to turn him. Light on purpose: ONE head file (not the
 * squad's set), one small canvas, 30 frames a second at most, paused when the
 * tab is hidden. Until he has loaded: the picture of him from the last visit
 * (kept on this device) or a plain grey shape, never the old figure (speed
 * job B, 9 Oct 2026: a slow load showed the old drawn player first). Only if
 * 3D can't start does the old figure stay, so the box is never empty.
 *
 * KEPT BETWEEN VISITS (tap speed, 19 Nov 2026). Every return to Home used to
 * build him from nothing (new 3D context, shaders compiled again: the biggest
 * cost of the tap, measured) and every exit threw him away. Now the built
 * player is kept (`kept`, one at a time): leaving Home only stops his frames
 * and takes his canvas off the page; coming back puts it straight back. He is
 * freed for real after KEEP_MS away, or when what he looks like changes. He
 * also draws nothing while his box is off screen.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";
import { afterLoss, newHealState, HEAL_DELAY_MS } from "@/lib/star/three3d/autoHeal";

export default function ToonHomePlayer({ career, width, height, where, kitShirt, kitTrim, fallback }: {
  career: CareerState; width: number; height: number; where: "home" | "title"; kitShirt: string; kitTrim: string; fallback: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped to build him again after the phone took his 3D away (three3d/autoHeal.ts). */
  const [gen, setGen] = useState(0);
  const turn = useRef({ yaw: where === "title" ? -0.35 : 0, drag: null as null | number, from: 0 });
  const you = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const num = career.squadNumber ?? 9;
  // the boots you bought, on his feet (lib/star/wearables.ts; Harry, 28 Nov 2026): the pair and its level
  const bootKey = career.currentBoot?.id ? `${career.currentBoot.id}:${career.currentBoot.level ?? ""}` : "plain";
  // what he looks like now: the kept picture is shown only while it still matches
  const sig = [where, width, height, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair, bootKey].join("|");
  const [snap, setSnap] = useState<string | null>(null);
  useEffect(() => { setSnap(readSnap(where, sig)); }, [where, sig]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // The phone took his 3D away (Android/iOS, short of graphics memory; Harry, 27 Nov 2026: "it just
    // shows like a frozen screen"): the kept canvas would stay frozen, or Chrome's grey sad-face box,
    // on every return to Home. He is thrown away and built again on a fresh context, silently
    // (his kept picture shows meanwhile); after AUTO_REBUILDS in a minute, the old figure.
    const onLost = () => {
      setReady(false);
      if (afterLoss(heal, Date.now()) === "rebuild") setTimeout(() => setGen((n) => n + 1), HEAL_DELAY_MS);
      else setFailed(true);
    };
    // Back to Home with him already built: put him straight back (unless his 3D was taken meanwhile).
    if (kept && kept.sig === sig && !kept.alive()) { console.warn("Style A home player: his 3D was lost while away, building him again"); freeKept(); }
    if (kept && kept.sig === sig) {
      const k = kept;
      turn.current = k.turn;
      k.attach(el, onLost);
      setReady(true);
      return () => k.detach();
    }
    freeKept();
    let dead = false, raf = 0, last = 0;
    let dispose = () => {};
    let entry: Kept | null = null;
    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
        const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
        const { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d, poseClips, relaxToonArms, turnBoneInBody } = await import("@/lib/star/people3d");
        const { loadAnims3d, addClips, clipInfo } = await import("@/lib/star/three3d/footballAnims");
        const { addToonFace, toonFaceFor, blinkAt, wanderGaze } = await import("@/lib/star/style3d/toon/face");
        const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
        const { homeIdleAt, homeSway, HOME_IDLE_BEATS, HOME_IDLE_ROUND } = await import("@/lib/star/homeIdle");
        const jb = HOME_IDLE_BEATS.find((b) => b.clip === "juggle");
        const JUGGLE_BEAT = { from: jb?.from ?? 6, dur: jb?.dur ?? 6, round: HOME_IDLE_ROUND };
        const { makeHomeSet, homeBallAt } = await import("@/lib/star/homeSet3d");
        const { numberTexture } = await import("@/lib/star/style3d/gameplay");
        const { bootLookOf, bootWorn } = await import("@/lib/star/wearables");
        if (dead) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        let notify: (() => void) | null = null;
        let lostOnce = false;
        const lost = () => {
          if (lostOnce) return;
          lostOnce = true;
          console.warn("Style A home player: the phone took the 3D away, building him again");
          const n = notify;
          if (kept === entry) kept = null;
          entry?.free();
          n?.();
        };
        renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost(); });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        // B5 (20 Oct 2026): light with shape, not flat: the sun more from his side, a cool sky fill, and a
        // soft rim from the floodlights behind him (drawn in his own shader, toon/shader.ts TOON_RIM: no new light)
        scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.1));
        const sun = new THREE.DirectionalLight("#ffe0b0", 2.5);
        sun.position.set(3.4, 4, 2.2);
        scene.add(sun);
        setToonRim(THREE, { color: "#fff1dd", strength: 0.75, from: [-0.35, 0.55, -1] });
        const loader = await withMeshopt(new GLTFLoader());
        const [g, anims, fb] = await Promise.all([
          loadToonHead(loader, you.head), loadPeople3d(loader, "anims", "new"),
          loadAnims3d(loader as never, "football").catch(() => null),
        ]);
        if (dead) { renderer.dispose(); renderer.forceContextLoss(); return; }
        const SK = (SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils;
        const p = makePerson3d(THREE, SK as never, g, anims, { outline: 0.006, you: true });
        dressPerson3d(THREE, p, { skin: you.skin, hair: you.hair, kit: { shirt: kitShirt, trim: kitTrim }, number: numberTexture(THREE, num), accessories: [bootWorn(bootLookOf(career.currentBoot))] });
        if (fb) addClips(THREE, p, fb);
        scene.add(p.root);
        // his face moves: blinks, eyes that look round, lips when he talks (toon/face.ts)
        const face = addToonFace(THREE, p);
        const homeSet = makeHomeSet(THREE, scene);
        const jInfo = clipInfo(fb, "juggle");
        // frame him: boots on the bottom edge, head near the top; the camera a little under his eyes (a hero's angle)
        const tall = 1.83 * (p.root.children[0]?.scale.y ?? 1);
        const cam = new THREE.PerspectiveCamera(18, width / height, 0.1, 40);
        const fit = (tall * 1.08) / 2 / Math.tan((18 * Math.PI) / 360);
        const fitW = (0.95 / (width / height)) / 2 / Math.tan((18 * Math.PI) / 360);
        cam.position.set(0, tall * 0.47, Math.max(fit, fitW));
        cam.lookAt(0, tall * 0.535, 0);
        renderer.domElement.style.width = `${width}px`;
        renderer.domElement.style.height = `${height}px`;
        const tr0 = turn.current;
        const has = (c: string) => !!p.actions[c];
        const len = (c: string) => p.actions[c]?.getClip().duration ?? 1;
        const t0 = performance.now();
        let snapped = false;
        // he stands a quarter turned (three quarters to the camera), the way a player poses, not square on
        const restYaw = where === "home" ? 0.32 : -0.35;
        const drawAt = (t: number) => {
          const st = homeIdleAt(t, has, len);
          poseClips(p, st.clips);
          // the stance on the standing idle: feet a little apart, arms loose off the hips, his weight shifting
          if (st.idle > 0.01) {
            turnBoneInBody(THREE, p, "LeftUpLeg", [0, 0, 1], 3.2 * st.idle);
            turnBoneInBody(THREE, p, "RightUpLeg", [0, 0, 1], -3.2 * st.idle);
            relaxToonArms(THREE, p, 5 * st.idle, 9 * st.idle);
            const hips = p.bones.Hips;
            if (hips) { hips.position.x += (homeSway(t) / (p.unit || 0.01)) * st.idle; hips.updateMatrixWorld(true); }
          }
          const tr = tr0;
          if (tr.drag === null && where === "home") tr.yaw += (restYaw - tr.yaw) * 0.04; // drifts back to his pose
          p.root.rotation.y = tr.yaw;
          p.root.updateMatrixWorld(true);
          // the face: the beat's look, the eyes wandering (down to his ball in the keepy-uppies), blinks, the lips
          const gz = wanderGaze(t, 11);
          face?.set({ face: toonFaceFor(st.face), blink: blinkAt(t, 5), talk: st.talk, gaze: st.juggle > 0.5 ? [gz[0] * 0.3, -0.75] : gz });
          // the ball moves like a ball: flicked up, kept up, dropped with a bounce (homeBallAt)
          { const bp = homeBallAt(jInfo, t, JUGGLE_BEAT); homeSet.place(p, tr.yaw, 1, bp, t, bp[1] > 0.115 ? 1 : 0); }
          renderer.render(scene, cam);
          // keep this first picture for the next visit's wait (read straight after the draw),
          // only when the kept one is missing or out of date: encoding it cost 1.6 s on every
          // return to Home (Mikey's playtest, 21 Oct 2026: "going back … you see how it took a second")
          if (!snapped) { snapped = true; if (readSnap(where, sig) === null) keepSnap(where, sig, renderer.domElement); }
        };
        // off screen (scrolled away, or a page laid over Home): no frames
        let onScreen = true;
        const seen = typeof IntersectionObserver === "function"
          ? new IntersectionObserver((es) => { onScreen = es.some((x) => x.isIntersecting); }) : null;
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (document.hidden || !onScreen || now - last < 33) return;
          if (renderer.getContext().isContextLost()) { lost(); return; } // the event can be missed (a hidden tab)
          last = now;
          // stills and films (the bench): window.__homeT holds one moment
          const held = (window as unknown as { __homeT?: number }).__homeT;
          drawAt(typeof held === "number" ? held : (now - t0) / 1000);
        };
        const rim = () => setToonRim(THREE, { color: "#fff1dd", strength: 0.75, from: [-0.35, 0.55, -1] });
        let timer: ReturnType<typeof setTimeout> | null = null;
        const stop = () => { cancelAnimationFrame(raf); raf = 0; seen?.disconnect(); setToonRim(THREE, { color: "#ffffff", strength: 0 }); };
        entry = {
          sig, turn: tr0,
          alive: () => !lostOnce && !renderer.getContext().isContextLost(),
          attach: (host, onLost) => {
            notify = onLost ?? null;
            if (timer) { clearTimeout(timer); timer = null; }
            host.appendChild(renderer.domElement);
            rim();
            onScreen = true; seen?.observe(host);
            (window as unknown as { __homePlayer?: unknown }).__homePlayer = { draw: drawAt };
            if (!raf) raf = requestAnimationFrame(frame);
          },
          detach: () => {
            notify = null;
            stop();
            renderer.domElement.remove();
            timer = setTimeout(() => { if (kept === entry) freeKept(); }, KEEP_MS);
          },
          free: () => {
            lostOnce = true; // our own forceContextLoss below is not "the phone took it"
            if (timer) clearTimeout(timer);
            stop();
            face?.dispose();
            homeSet.dispose();
            // his own meshes and pictures too (the old dispose left them), then the 3D context itself
            p.root.traverse((o) => {
              const m = o as { geometry?: { dispose?: () => void }; material?: unknown };
              m.geometry?.dispose?.();
              for (const mat of ([] as unknown[]).concat(m.material ?? [])) {
                const mm = mat as Record<string, unknown> & { dispose?: () => void };
                for (const v of Object.values(mm)) (v as { isTexture?: boolean; dispose?: () => void } | null)?.isTexture && (v as { dispose: () => void }).dispose();
                mm.dispose?.();
              }
            });
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
          },
        };
        // taken while he was still loading: build again (onLost), never a dead canvas on Home
        if (lostOnce || renderer.getContext().isContextLost()) { lostOnce = true; entry.free(); if (!dead) onLost(); return; }
        kept = entry;
        entry.attach(el, onLost);
        setReady(true);
        dispose = () => entry?.detach();
      } catch (e) {
        console.error("Style A home player", e);
        if (!dead) onLost(); // a failed build: tried again silently, then the old figure
      }
    })();
    return () => { dead = true; if (!entry) cancelAnimationFrame(raf); dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, where, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair, bootKey, gen]);

  const onDown = (e: React.PointerEvent) => { if (where !== "home") return; turn.current.drag = e.clientX; turn.current.from = turn.current.yaw; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const t = turn.current; if (t.drag !== null) t.yaw = t.from + (e.clientX - t.drag) * 0.02; };
  const onUp = () => { turn.current.drag = null; };

  return (
    <div className="relative" style={{ width, height, touchAction: "pan-y" }} data-toon-home={where}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {!ready && failed && <div className="absolute inset-0">{fallback}</div>}
      {!ready && !failed && (snap
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={snap} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" data-toon-snap />
        : <WaitShape />)}
      <div ref={wrap} className="absolute inset-0" />
    </div>
  );
}

/** The one built player kept between visits (see the note at the top). */
interface Kept {
  sig: string;
  turn: { yaw: number; drag: null | number; from: number };
  /** His 3D context is still there (false: the phone took it; build him again). */
  alive: () => boolean;
  /** `onLost`: told when the phone takes his 3D away while he is on this screen. */
  attach: (host: HTMLElement, onLost?: () => void) => void;
  detach: () => void;
  free: () => void;
}
let kept: Kept | null = null;
/** His silent rebuilds after a lost 3D (three3d/autoHeal.ts): two a minute, then the old figure. */
const heal = newHealState();
/** How long he is kept after you leave Home: a quick look at League and back costs nothing. */
const KEEP_MS = 90_000;
function freeKept() {
  const k = kept;
  kept = null;
  k?.free();
}

/** The wait with no kept picture: a soft grey player shape where he will stand. */
function WaitShape() {
  return (
    <svg viewBox="0 0 100 200" preserveAspectRatio="xMidYMax meet" className="pointer-events-none absolute inset-0 h-full w-full animate-pulse" aria-hidden data-toon-wait>
      <g fill="rgba(255,255,255,0.13)">
        <circle cx="50" cy="26" r="11" />
        <path d="M33 44 Q50 38 67 44 L72 98 Q60 102 56 100 L54 188 L44 188 L44 100 Q40 102 28 98 Z" />
      </g>
    </svg>
  );
}

/** One kept picture per place (Home, title), with what he looked like when it was taken. */
const snapKey = (where: string) => "kib-toon-snap-" + where;
function readSnap(where: string, sig: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(snapKey(where)) ?? "null") as { sig?: string; url?: string } | null;
    return v && v.sig === sig && typeof v.url === "string" ? v.url : null;
  } catch { return null; }
}
function keepSnap(where: string, sig: string, canvas: HTMLCanvasElement) {
  try {
    const url = canvas.toDataURL("image/webp", 0.85);
    if (url.startsWith("data:image/") && url.length < 400_000) localStorage.setItem(snapKey(where), JSON.stringify({ sig, url }));
  } catch { /* no room or no storage: the grey shape next time */ }
}
