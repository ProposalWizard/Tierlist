/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D CASINO'S GAMES, PLAYED ON THE REAL TABLES (Harry, 8 Oct 2026: "the
 * next part of the 3D casino is having the games actually run in 3D").
 *
 * The moving parts the room's scene (./scene.ts) hands its tables over to:
 *   - the roulette wheel: 37 numbered pockets that turn, and a ball that
 *     runs round the track, slows, hops across the frets and drops into the
 *     pocket the roll picked (./motion.ts ballAt)
 *   - the slot machine you sit at: three reel drums that spin and stop on
 *     the rolled symbols (./motion.ts reelAt), a lever, win lights
 *   - the blackjack felt: cards dealt from the shoe, yours face up, the
 *     dealer's second face down until you stand
 *   - the big screen: a small 3D race track drawn into a texture while a
 *     race is on (only then), the horses crossing in the rolled order
 *
 * NOTHING HERE DECIDES A RESULT. components/star/Casino3DTable.tsx rolls
 * with the flat casino's own functions (lib/star/casinoRounds.ts) and then
 * calls these to SHOW it. Every promise resolves once the thing has come
 * to rest on that result.
 */
import type { Card } from "../casinoRules";
import { SLOTS_SYMBOLS } from "../casinoRules";
import type { Quality3d } from "../three3d/quality";
import { WHEEL } from "./plan";
import { planBall, ballAt, planReel, reelAt, raceDurations, horseAt, cardSpot, type BallPlan, type ReelPlan } from "./motion";
import { rouletteWheelCanvas, reelStripCanvas, cardFaceCanvas, cardBackCanvas } from "./gameTextures";

export interface GamesCtx {
  THREE: any;
  renderer: any;
  /** The roulette table's group (origin at the table's centre, on the floor). */
  roulTable: any;
  /** The blackjack table's group (origin at its centre, dealer's side −z). */
  bjTable: any;
  /** The slot machine you play (its group: front is local +z). */
  slotMachine: any;
  /** The big screen's material and its usual painted picture. */
  screenMat: any;
  screenIdle: any;
  tier: Quality3d;
  goldM: any;
  darkWoodM: any;
}

export interface Games3D {
  /** Things that move: keep them out of the static merge. */
  keep: any[];
  update: (dt: number) => void;
  /** Something is moving: draw every frame. */
  busy: () => boolean;
  /** The croupier's hand sends the wheel round faster. */
  wheelKick: (amount: number) => void;
  roulette: (winner: number) => Promise<void>;
  /** Pull the lever (down and back up over `dur` seconds). */
  lever: (dur?: number) => void;
  /** Spin the three reels to these SLOTS_SYMBOLS indexes. */
  slots: (symbols: number[]) => Promise<void>;
  /** The machine's lights: flash for a win (big = faster, longer). */
  slotsWin: (big: boolean) => void;
  bjDeal: (who: "player" | "dealer", card: Card | null) => Promise<void>;
  /** Turn the dealer's face-down card over. */
  bjReveal: (card: Card) => Promise<void>;
  bjClear: () => Promise<void>;
  /** Run a race on the big screen; resolves as the last horse crosses. */
  race: (scores: number[], silks: string[], mine: number) => Promise<void>;
  /** Back to the screen's usual picture. */
  raceEnd: () => void;
  dispose: () => void;
}

export function buildGames(ctx: GamesCtx): Games3D {
  const { THREE, renderer } = ctx;
  const keep: any[] = [];
  const disposers: (() => void)[] = [];
  let t = 0;
  const waits: { at: number; fn: () => void }[] = [];
  const wait = (s: number) => new Promise<void>((res) => waits.push({ at: t + s, fn: res }));
  const tex = (cv: HTMLCanvasElement) => {
    const x = new THREE.CanvasTexture(cv);
    x.colorSpace = THREE.SRGBColorSpace;
    x.anisotropy = 4;
    disposers.push(() => x.dispose());
    return x;
  };
  const std = (o: any) => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, ...o });

  // ═══ ROULETTE ═══════════════════════════════════════════════════════════
  const wheelCentre = new THREE.Group();
  wheelCentre.position.set(WHEEL.dx, WHEEL.y, 0);
  ctx.roulTable.add(wheelCentre);
  keep.push(wheelCentre);
  const R = WHEEL.r;
  // the bowl: a wooden ring with a gold lip, the track the ball runs on
  {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.02, 0.16, 48), ctx.darkWoodM);
    bowl.position.y = -0.082;
    wheelCentre.add(bowl);
    const track = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R + 0.08, 48), std({ color: "#3a2010", roughness: 0.35 }));
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.012;
    wheelCentre.add(track);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.02, 8, 48), ctx.goldM);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.03;
    wheelCentre.add(lip);
  }
  const wheel = new THREE.Group();
  wheelCentre.add(wheel);
  const wheelR = R * 0.84;
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(wheelR, 64), new THREE.MeshStandardMaterial({ map: tex(rouletteWheelCanvas(ctx.tier === "low" ? 512 : 1024)), roughness: 0.4 }));
    disc.rotation.x = -Math.PI / 2;
    wheel.add(disc);
    // gold frets between the pockets: one merged ring of little walls
    const fretG = new THREE.BoxGeometry(wheelR * 0.2, 0.012, 0.004);
    const frets = new THREE.InstancedMesh(fretG, ctx.goldM, 37);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 37; i++) {
      const a = (i * Math.PI * 2) / 37, r = wheelR * 0.7;
      q.setFromAxisAngle(up, a);
      m4.compose(new THREE.Vector3(r * Math.cos(a), 0.006, -r * Math.sin(a)), q, sc);
      frets.setMatrixAt(i, m4);
    }
    wheel.add(frets);
    // the turret in the middle
    const cone = new THREE.Mesh(new THREE.ConeGeometry(wheelR * 0.22, 0.07, 24), ctx.goldM);
    cone.position.y = 0.035;
    wheel.add(cone);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, wheelR * 0.5, 8), ctx.goldM);
    bar.rotation.z = Math.PI / 2; bar.position.y = 0.075;
    wheel.add(bar);
    const bar2 = bar.clone(); bar2.rotation.set(Math.PI / 2, 0, 0);
    wheel.add(bar2);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15, emissive: "#ffffff", emissiveIntensity: 0.25 }));
  ball.visible = false;
  wheelCentre.add(ball);
  const POCKET_R = wheelR * 0.7, TRACK_R = R * 0.93;
  let wheelA = 0, wheelBoost = 0;
  let ballPlan: BallPlan | null = null, ballT = 0, ballDone: (() => void) | null = null;
  let ballRest: number | null = null; // the angle on the wheel it rests at
  const placeBall = (phi: number, r: number, y: number) => {
    const b = wheelA + phi;
    ball.position.set(r * Math.cos(b), y + 0.019, -r * Math.sin(b));
  };

  // ═══ SLOTS ══════════════════════════════════════════════════════════════
  const reels: any[] = [];
  const reelPlans: (ReelPlan | null)[] = [null, null, null];
  const reelA = [0.6, 2.1, 3.9].map((a) => a); // a few faces in, so they don't all match
  let reelT = 0, reelDone: (() => void) | null = null;
  const lever = new THREE.Group();
  const bulbA = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffd36a", emissiveIntensity: 0.6 });
  const bulbB = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ff5a7a", emissiveIntensity: 0.6 });
  let winFlash = 0, winBig = false, leverT = -1, leverDur = 0.9;
  {
    const m = ctx.slotMachine;
    // the window: a dark panel behind the drums, a bezel round them that
    // stands out from the machine's face (0.175), a red pay line in front
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.02), std({ color: "#0b0508" }));
    back.position.set(0, 1.45, 0.185);
    m.add(back);
    const bezelM = std({ color: "#2a1a10", metalness: 0.5, roughness: 0.35 });
    for (const [w, h, x, y] of [[0.86, 0.1, 0, 1.69], [0.86, 0.1, 0, 1.21], [0.05, 0.58, -0.405, 1.45], [0.05, 0.58, 0.405, 1.45]] as [number, number, number, number][]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), bezelM);
      b.position.set(x, y, 0.255);
      m.add(b);
    }
    const stripT = tex(reelStripCanvas());
    const side = std({ map: stripT, roughness: 0.35 });
    const cap = std({ color: "#b8902e", metalness: 0.8, roughness: 0.3 });
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 36, 1);
    [-0.25, 0, 0.25].forEach((x, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.45, 0.17);
      const drum = new THREE.Mesh(geo, [side, cap, cap]);
      drum.rotation.z = Math.PI / 2;
      pivot.add(drum);
      pivot.rotation.x = reelA[i];
      m.add(pivot);
      reels.push(pivot);
    });
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.008, 0.004), new THREE.MeshBasicMaterial({ color: "#ff2a3d", toneMapped: false, transparent: true, opacity: 0.85 }));
    line.position.set(0, 1.45, 0.33);
    m.add(line);
    // a ring of bulbs round the window (two sets, so they chase)
    const bulbG = new THREE.SphereGeometry(0.018, 8, 6);
    const spots: [number, number][] = [];
    for (let k = 0; k <= 8; k++) { spots.push([-0.4 + k * 0.1, 1.69]); spots.push([-0.4 + k * 0.1, 1.21]); }
    for (let k = 1; k < 5; k++) { spots.push([-0.405, 1.21 + k * 0.096]); spots.push([0.405, 1.21 + k * 0.096]); }
    spots.forEach(([x, y], i) => {
      const b = new THREE.Mesh(bulbG, i % 2 ? bulbA : bulbB);
      b.position.set(x, y, 0.35);
      m.add(b);
    });
    // the lever, on a pivot at its foot so it can be pulled
    lever.position.set(0.55, 1.08, 0.05);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), std({ color: "#c9c9c9", metalness: 0.9, roughness: 0.25 }));
    rod.position.y = 0.25;
    lever.add(rod);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), std({ color: "#d1121e", roughness: 0.3 }));
    knob.position.y = 0.5;
    lever.add(knob);
    m.add(lever);
    keep.push(...reels, lever, line);
  }

  // ═══ BLACKJACK ══════════════════════════════════════════════════════════
  const backT = tex(cardBackCanvas());
  const backM = std({ map: backT, roughness: 0.6 });
  const faceMs = new Map<string, any>();
  const faceM = (c: Card) => {
    const k = c.rank + c.suit;
    if (!faceMs.has(k)) faceMs.set(k, std({ map: tex(cardFaceCanvas(c)), roughness: 0.6 }));
    return faceMs.get(k);
  };
  const CW = 0.125, CH = 0.175;
  const cardG = new THREE.PlaneGeometry(CW, CH);
  const SHOE = new THREE.Vector3(0.7, 1.0, 0.25);
  const FELT_Y = 0.884;
  type Tw = { from: any; to: any; ryFrom: number; ryTo: number; flipFrom: number; flipTo: number; t0: number; dur: number; arc: number; done?: () => void };
  const hands: { player: any[]; dealer: any[] } = { player: [], dealer: [] };
  const tweens = new Map<any, Tw>();
  const cardRoot = new THREE.Group();
  ctx.bjTable.add(cardRoot);
  keep.push(cardRoot);
  const makeCard = (card: Card | null) => {
    const c = new THREE.Group();
    const front = new THREE.Mesh(cardG, card ? faceM(card) : backM);
    front.rotation.x = -Math.PI / 2;
    const back = new THREE.Mesh(cardG, backM);
    back.rotation.x = Math.PI / 2;
    back.position.y = -0.0008;
    c.add(front, back);
    c.userData.front = front;
    // a face-down card lies flipped over (its back up)
    const pivot = new THREE.Group();
    pivot.add(c);
    pivot.userData.card = c;
    return pivot;
  };
  const layout = (who: "player" | "dealer", dur = 0.35) => {
    const list = hands[who];
    list.forEach((p, i) => {
      const s = cardSpot(who, i, list.length);
      const tw = tweens.get(p);
      const flip = p.userData.card.rotation.z;
      if (tw) { tw.to = new THREE.Vector3(s.x, FELT_Y + 0.0005 * i, s.z); tw.ryTo = s.ry; return; }
      tweens.set(p, { from: p.position.clone(), to: new THREE.Vector3(s.x, FELT_Y + 0.0005 * i, s.z), ryFrom: p.rotation.y, ryTo: s.ry, flipFrom: flip, flipTo: flip, t0: t, dur, arc: 0 });
    });
  };
  const deal = (who: "player" | "dealer", card: Card | null) => new Promise<void>((res) => {
    const p = makeCard(card);
    const down = !card;
    p.userData.card.rotation.z = down ? Math.PI : 0;
    p.position.copy(SHOE);
    cardRoot.add(p);
    hands[who].push(p);
    const n = hands[who].length;
    // the cards already down shuffle along to make room
    layout(who);
    const s = cardSpot(who, n - 1, n);
    tweens.set(p, {
      from: SHOE.clone(), to: new THREE.Vector3(s.x, FELT_Y + 0.0005 * (n - 1), s.z), ryFrom: 0.6, ryTo: s.ry,
      flipFrom: down ? Math.PI : 0, flipTo: down ? Math.PI : 0, t0: t, dur: 0.42, arc: 0.1, done: res,
    });
  });

  // ═══ HORSE RACING: a small 3D track drawn into the screen ═══════════════
  let race: null | {
    scene: any; cam: any; rt: any; horses: { root: any; legs: any[]; x0: number; dur: number; wob: number }[];
    t: number; done: (() => void) | null; maxDur: number; lead: number;
  } = null;
  let raceKit: null | { scene: any; cam: any; rt: any; horses: any[] } = null;
  const LEN = 28;
  const buildRace = () => {
    if (raceKit) return raceKit;
    const s = new THREE.Scene();
    s.background = new THREE.Color("#8fc4ea");
    s.fog = new THREE.Fog("#a9d2ee", 30, 70);
    s.add(new THREE.HemisphereLight("#ffffff", "#3a6a2a", 1.6));
    const sun = new THREE.DirectionalLight("#fff3d6", 1.6);
    sun.position.set(-6, 10, 8);
    s.add(sun);
    const lam = (c: string) => new THREE.MeshLambertMaterial({ color: c });
    // turf, the running lanes and the rails
    const turf = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), lam("#3f8d36"));
    turf.rotation.x = -Math.PI / 2; turf.position.set(10, -0.01, -6);
    s.add(turf);
    const lanes = new THREE.Mesh(new THREE.PlaneGeometry(140, 8.4), lam("#b08a5a"));
    lanes.rotation.x = -Math.PI / 2; lanes.position.set(10, 0, 0);
    s.add(lanes);
    const railM = lam("#f5f5f5");
    for (const z of [-4.3, 4.3]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(140, 0.08, 0.08), railM);
      rail.position.set(10, 1, z);
      s.add(rail);
      for (let x = -60; x < 80; x += 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), railM);
        post.position.set(x, 0.5, z);
        s.add(post);
      }
    }
    // the stands far side, and the finishing post
    const stand = new THREE.Mesh(new THREE.BoxGeometry(140, 4, 3), lam("#7a2a36"));
    stand.position.set(10, 2, -12);
    s.add(stand);
    const crowd = new THREE.Mesh(new THREE.BoxGeometry(140, 1.6, 0.2), lam("#c9a96a"));
    crowd.position.set(10, 4.6, -10.6);
    s.add(crowd);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 0.16), lam("#ffffff"));
    post.position.set(LEN / 2, 1.6, 4.6);
    s.add(post);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), lam("#d1121e"));
    disc.position.set(LEN / 2, 3.2, 4.7);
    s.add(disc);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 8.4), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    line.rotation.x = -Math.PI / 2; line.position.set(LEN / 2, 0.01, 0);
    s.add(line);
    // six horses: boxes and legs, a jockey in silks
    const coatM = [lam("#5a3418"), lam("#3a2412"), lam("#7a4a22"), lam("#2a1a10"), lam("#8a5a2a"), lam("#4a2a14")];
    const body = new THREE.BoxGeometry(1.5, 0.6, 0.5);
    const neck = new THREE.BoxGeometry(0.35, 0.8, 0.3);
    const head = new THREE.BoxGeometry(0.6, 0.28, 0.26);
    const legG = new THREE.BoxGeometry(0.12, 0.85, 0.12);
    legG.translate(0, -0.42, 0);
    const torso = new THREE.BoxGeometry(0.36, 0.5, 0.36);
    const helm = new THREE.SphereGeometry(0.15, 10, 8);
    const horses: any[] = [];
    for (let i = 0; i < 6; i++) {
      const root = new THREE.Group();
      const cm = coatM[i];
      const b = new THREE.Mesh(body, cm); b.position.y = 1.25; root.add(b);
      const n = new THREE.Mesh(neck, cm); n.position.set(0.82, 1.62, 0); n.rotation.z = -0.6; root.add(n);
      const h = new THREE.Mesh(head, cm); h.position.set(1.12, 1.92, 0); h.rotation.z = -0.35; root.add(h);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), lam("#1a1008")); tail.position.set(-0.95, 1.35, 0); tail.rotation.z = 0.7; root.add(tail);
      const legs: any[] = [];
      for (const [lx, lz] of [[0.6, 0.15], [0.6, -0.15], [-0.6, 0.15], [-0.6, -0.15]] as [number, number][]) {
        const l = new THREE.Mesh(legG, cm); l.position.set(lx, 1.0, lz); root.add(l); legs.push(l);
      }
      const silk = lam("#ffffff");
      const j = new THREE.Mesh(torso, silk); j.position.set(0.1, 1.85, 0); j.rotation.z = -0.5; root.add(j);
      const hm = new THREE.Mesh(helm, silk); hm.position.set(0.32, 2.12, 0); root.add(hm);
      // the saddle cloth with the lane number
      const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
      const g = cv.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#111111"; g.font = "900 48px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(i + 1), 32, 34);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex(cv) }));
      cloth.position.set(-0.15, 1.25, 0.26);
      root.add(cloth);
      root.userData = { legs, silk };
      root.position.set(-LEN / 2, 0, -3.5 + i * 1.4);
      s.add(root);
      horses.push(root);
    }
    const cam = new THREE.PerspectiveCamera(42, 2, 0.5, 120);
    const size = ctx.tier === "low" ? [512, 256] : [1024, 512];
    const rt = new THREE.WebGLRenderTarget(size[0], size[1], { samples: ctx.tier === "high" ? 4 : 0 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    raceKit = { scene: s, cam, rt, horses };
    disposers.push(() => {
      rt.dispose();
      s.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); }); });
    });
    return raceKit;
  };
  const stepRace = (dt: number) => {
    if (!race) return;
    race.t += dt;
    let lead = -Infinity, last = Infinity;
    race.horses.forEach((h, i) => {
      const p = horseAt(race!.t, h.dur, h.wob);
      // past the post they ease up and pull away off the line
      const over = Math.max(0, race!.t - h.dur);
      const x = -LEN / 2 + p * LEN + 6 * (1 - Math.exp(-over / 1.2));
      const speed = over > 0 ? Math.exp(-over / 1.2) : 1;
      h.root.position.x = x;
      const ph = race!.t * 11 * (0.4 + 0.6 * speed) + i;
      h.root.position.y = Math.abs(Math.sin(ph)) * 0.12 * speed;
      h.legs.forEach((l: any, k: number) => { l.rotation.z = Math.sin(ph + (k < 2 ? 0 : Math.PI) + (k % 2) * 0.6) * 0.7 * speed; });
      lead = Math.max(lead, x); last = Math.min(last, x);
    });
    // the camera runs with the leaders, side on
    race.lead += (lead - 1.5 - race.lead) * Math.min(1, dt * 3);
    race.cam.position.set(race.lead, 4.2, 11.5);
    race.cam.lookAt(race.lead + 1.5, 0.8, 0);
    renderer.setRenderTarget(race.rt);
    renderer.render(race.scene, race.cam);
    renderer.setRenderTarget(null);
    if (race.done && race.t >= race.maxDur + 0.6) { const f = race.done; race.done = null; f(); }
  };

  // ═══ The frame ══════════════════════════════════════════════════════════
  const update = (dt: number) => {
    t += dt;
    for (let i = waits.length - 1; i >= 0; i--) if (t >= waits[i].at) { const w = waits.splice(i, 1)[0]; w.fn(); }
    // the wheel
    wheelA += dt * (0.9 + wheelBoost);
    wheelBoost = Math.max(0, wheelBoost - dt * (ballPlan ? 0.45 : 1.6));
    wheel.rotation.y = wheelA;
    if (ballPlan) {
      ballT += dt;
      const b = ballAt(ballPlan, ballT);
      placeBall(b.phi, b.r, b.y);
      if (ballT >= ballPlan.T) {
        ballRest = ballPlan.phiEnd;
        ballPlan = null;
        const f = ballDone; ballDone = null; f?.();
      }
    } else if (ballRest !== null) placeBall(ballRest, POCKET_R, 0);
    // the reels
    if (reelPlans[0]) {
      reelT += dt;
      reelPlans.forEach((p, i) => { if (p) reels[i].rotation.x = reelAt(p, reelT); });
      const lastStop = Math.max(...reelPlans.map((p) => p!.tStop));
      if (reelT >= lastStop + 0.25) {
        reelPlans.forEach((p, i) => { reelA[i] = p!.end; reels[i].rotation.x = p!.end; reelPlans[i] = null; });
        const f = reelDone; reelDone = null; f?.();
      }
    }
    if (leverT >= 0) {
      leverT += dt;
      const k = Math.min(1, leverT / leverDur);
      lever.rotation.x = Math.sin(Math.PI * k) * 1.05;
      if (k >= 1) { leverT = -1; lever.rotation.x = 0; }
    }
    // the bulbs chase gently, and flash for a win
    if (winFlash > 0) {
      winFlash -= dt;
      const on = Math.floor(t * (winBig ? 14 : 9)) % 2 === 0;
      bulbA.emissiveIntensity = on ? 3.2 : 0.2;
      bulbB.emissiveIntensity = on ? 0.2 : 3.2;
    } else {
      bulbA.emissiveIntensity = 0.5 + 0.35 * Math.sin(t * 3);
      bulbB.emissiveIntensity = 0.5 - 0.35 * Math.sin(t * 3);
    }
    // the cards
    tweens.forEach((tw, p) => {
      const k = Math.min(1, (t - tw.t0) / tw.dur);
      const e = 1 - Math.pow(1 - k, 3);
      p.position.lerpVectors(tw.from, tw.to, e);
      p.position.y += Math.sin(Math.PI * k) * tw.arc;
      p.rotation.y = tw.ryFrom + (tw.ryTo - tw.ryFrom) * e;
      p.userData.card.rotation.z = tw.flipFrom + (tw.flipTo - tw.flipFrom) * e;
      if (k >= 1) { tweens.delete(p); tw.done?.(); }
    });
    stepRace(dt);
  };

  const games: Games3D = {
    keep,
    update,
    busy: () => !!ballPlan || !!reelPlans[0] || leverT >= 0 || winFlash > 0 || tweens.size > 0 || !!race,
    wheelKick: (a) => { wheelBoost = Math.max(wheelBoost, a); },
    roulette: (winner) => new Promise<void>((res) => {
      // thrown from the croupier's side of the wheel (−z), against the turn
      const phi0 = Math.PI / 2 - wheelA;
      ballPlan = planBall(winner, phi0, { T: 5.2, revs: 7, trackR: TRACK_R, pocketR: POCKET_R });
      ballT = 0;
      ballDone = res;
      ball.visible = true;
      wheelBoost = Math.max(wheelBoost, 3.2);
    }),
    lever: (dur = 0.9) => { leverT = 0; leverDur = dur; },
    slots: (symbols) => new Promise<void>((res) => {
      reelT = 0;
      symbols.forEach((s, i) => { reelPlans[i] = planReel(s, reelA[i], 1.25 + i * 0.45); });
      reelDone = res;
    }),
    slotsWin: (big) => { winFlash = big ? 3 : 1.6; winBig = big; },
    bjDeal: (who, card) => deal(who, card),
    bjReveal: (card) => new Promise<void>((res) => {
      const p = hands.dealer.find((x) => x.userData.card.rotation.z > 1);
      if (!p) { res(); return; }
      p.userData.card.userData.front.material = faceM(card);
      const prev = tweens.get(p);
      tweens.set(p, { from: p.position.clone(), to: prev ? prev.to : p.position.clone(), ryFrom: p.rotation.y, ryTo: p.rotation.y, flipFrom: Math.PI, flipTo: 0, t0: t, dur: 0.45, arc: 0.07, done: res });
    }),
    bjClear: () => new Promise<void>((res) => {
      const all = [...hands.player, ...hands.dealer];
      hands.player = []; hands.dealer = [];
      if (!all.length) { res(); return; }
      let left = all.length;
      all.forEach((p, i) => {
        tweens.set(p, {
          from: p.position.clone(), to: new THREE.Vector3(-0.75, FELT_Y + 0.02, 0.2), ryFrom: p.rotation.y, ryTo: 0.4,
          flipFrom: p.userData.card.rotation.z, flipTo: Math.PI, t0: t + i * 0.04, dur: 0.4, arc: 0.04,
          done: () => { cardRoot.remove(p); if (--left === 0) res(); },
        });
      });
    }),
    race: (scores, silks, mine) => new Promise<void>((res) => {
      const kit = buildRace();
      const durs = raceDurations(scores);
      kit.horses.forEach((h: any, i: number) => {
        h.userData.silk.color.set(silks[i] ?? "#ffffff");
        h.position.set(-LEN / 2, 0, -3.5 + i * 1.4);
        h.scale.setScalar(i === mine ? 1.04 : 1);
      });
      race = {
        ...kit,
        horses: kit.horses.map((root: any, i: number) => ({ root, legs: root.userData.legs, x0: -LEN / 2, dur: durs[i], wob: Math.sin(i * 2.7 + scores[i]) })),
        t: 0, done: res, maxDur: Math.max(...durs), lead: -LEN / 2,
      };
      ctx.screenMat.map = kit.rt.texture;
      ctx.screenMat.needsUpdate = true;
    }),
    raceEnd: () => {
      if (race) { const f = race.done; race.done = null; f?.(); }
      race = null;
      ctx.screenMat.map = ctx.screenIdle;
      ctx.screenMat.needsUpdate = true;
    },
    dispose: () => { disposers.forEach((f) => f()); },
  };
  void SLOTS_SYMBOLS;
  return games;
}
