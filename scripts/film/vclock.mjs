/**
 * FRAME-STEPPED FILMING OF THE REAL GAME — no repeated or dropped frames, sound in sync.
 * (Leo, 25 Oct 2026: our clips "look bad" and "the ball moves weird".)
 *
 * WHY. This machine has no graphics card. A screen recording (Playwright recordVideo,
 * CDP screencast) captures whatever the page has drawn when the recorder looks, in
 * real time; the page cannot keep up, so about 1 frame in 4 is the same picture twice
 * and the next one jumps: the ball stutters.
 *
 * HOW. The page's clock is taken over. Nothing in the page moves unless this script
 * says "one more frame":
 *   - performance.now(), Date.now(), requestAnimationFrame, setTimeout/setInterval
 *     all run on a VIRTUAL clock that moves exactly 1/fps s per step;
 *   - CSS animations and transitions (banners, pops) are paused and set to the same clock;
 *   - each step runs the timers due and the frame callbacks (the match draws its canvas),
 *     lets React finish, then the screen is captured. Slow to make, perfect to watch:
 *     every captured frame is exactly 1/fps s of game time after the one before.
 * SOUND. The game's Web Audio context is swapped for an OfflineAudioContext whose
 * currentTime is the virtual clock, so every sound the game starts is placed at its exact
 * virtual time; at the end it is rendered to a WAV that lines up sample-for-frame.
 * Before vStart everything runs as normal (real time), so menus and loading work as usual;
 * sounds made before vStart are not kept.
 *
 *   import { installVClock, vStart, vCapture, vDiscard, vStep, vUntil, vStopAudio, encode } from "../vclock.mjs";
 *   await installVClock(context, { fps: 60 });            // before the page loads
 *   ... open the page, go to the screen in real time ...
 *   await vStart(page);                                   // the clock is ours from here
 *   await vStep(page, 120);                               // 2 s of game, not filmed (fast)
 *   const mark = await vCapture(page, "/abs/frames");     // filming (and the sound clock) starts
 *   await vUntil(page, () => window.__starMatch?.phase?.() === "aim", 600);
 *   await page.mouse.move(...)                            // input between steps is fine
 *   await vCapture(page, null);                           // filming stops
 *   // a take you don't want: await vDiscard(page, mark) cuts its sound and rewinds
 *   await vStopAudio(page, "/abs/clip.wav");
 *   encode("/abs/frames", "/abs/clip.wav", "/abs/clip.mp4", { fps: 60, outFps: 30, audioAtS: mark + 1 / 60 });
 *
 * Only for filming: nothing here is in the game. Tested in scripts/film/vclock-proof.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export async function installVClock(context, { fps = 60, audioMaxS = 240 } = {}) {
  await context.addInitScript(([FPS, AUDIO_MAX]) => {
    if (window.__vclock) return;
    const real = {
      now: performance.now.bind(performance), dnow: Date.now,
      raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
      st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window),
      si: window.setInterval.bind(window), ci: window.clearInterval.bind(window),
    };
    // aud: the sound clock (s). It moves only while a take is being filmed (V.rec), so the
    // offline timeline holds only what is filmed; a thrown-away take is cut and rewound.
    const V = { on: false, t: 0, dateOff: 0, frame: 0, fps: FPS, rafs: new Map(), rafId: 1e9, timers: new Map(), timerId: 2e9, anims: new WeakMap(), real, audio: null, aud: 0, rec: false, started: [] };
    window.__vclock = V;
    performance.now = () => (V.on ? V.t : real.now());
    Date.now = () => (V.on ? Math.round(V.t + V.dateOff) : real.dnow());
    window.requestAnimationFrame = (cb) => { if (!V.on) return real.raf(cb); const id = ++V.rafId; V.rafs.set(id, cb); return id; };
    window.cancelAnimationFrame = (id) => { if (V.rafs.has(id)) V.rafs.delete(id); else real.caf(id); };
    const addTimer = (cb, ms, args, every) => { const id = ++V.timerId; V.timers.set(id, { cb, at: V.t + Math.max(0, +ms || 0), every: every ? Math.max(1, +ms || 0) : 0, args }); return id; };
    window.setTimeout = (cb, ms, ...args) => (V.on && typeof cb === "function" ? addTimer(cb, ms, args, false) : real.st(cb, ms, ...args));
    window.setInterval = (cb, ms, ...args) => (V.on && typeof cb === "function" ? addTimer(cb, ms, args, true) : real.si(cb, ms, ...args));
    window.clearTimeout = (id) => { if (V.timers.has(id)) V.timers.delete(id); else real.ct(id); };
    window.clearInterval = (id) => { if (V.timers.has(id)) V.timers.delete(id); else real.ci(id); };

    // ── SOUND: an offline context on the virtual clock ──
    const RealAC = window.AudioContext || window.webkitAudioContext;
    const SR = 48000;
    let shared = null;
    function offline() {
      if (shared) return shared;
      const c = new OfflineAudioContext(2, SR * AUDIO_MAX, SR);
      Object.defineProperty(c, "currentTime", { get: () => V.aud });
      Object.defineProperty(c, "state", { get: () => "running" });
      c.resume = () => Promise.resolve();
      c.suspend = () => Promise.resolve();
      c.close = () => Promise.resolve();
      c.createMediaStreamDestination = undefined;
      shared = c;
      V.audio = c;
      return c;
    }
    if (RealAC) {
      const Fake = function () { return offline(); };
      Fake.prototype = RealAC.prototype;
      window.AudioContext = Fake;
      window.webkitAudioContext = Fake;
      // A sound started "now" (no time, or a time already past) starts at the virtual now;
      // a sound started before the clock is ours is not kept.
      const P = AudioScheduledSourceNode.prototype, start0 = P.start, stop0 = P.stop;
      P.start = function (when, ...rest) {
        if (this.context === shared) {
          if (!V.on || !V.rec) return;                        // not filming: not in any clip
          when = Math.max(+when || 0, V.aud);
          V.started.push({ node: this, at: when });
        }
        return start0.call(this, when, ...rest);
      };
      P.stop = function (when, ...rest) {
        if (this.context === shared) { if (!V.on) return; when = Math.max(+when || 0, V.aud); }
        try { return stop0.call(this, when, ...rest); } catch { /* stop before start */ }
      };
    }
    // <audio>/<video> elements are not on the clock: kept silent while filming.
    const play0 = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (V.on) { this.muted = true; } return play0.call(this); };

    // ── ONE STEP ──
    V.syncAnims = () => {
      for (const a of document.getAnimations()) {
        let r = V.anims.get(a);
        if (!r) { r = { t0: V.t, c0: +(a.currentTime ?? 0) || 0 }; V.anims.set(a, r); try { a.pause(); } catch { /* */ } }
        try { a.currentTime = r.c0 + (V.t - r.t0) * (a.playbackRate || 1); } catch { /* */ }
      }
    };
    V.step = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        V.t += 1000 / V.fps;
        V.frame++;
        if (V.rec) V.aud += 1 / V.fps;
        // timers due, in time order (a timer may add timers)
        for (let guard = 0; guard < 500; guard++) {
          let next = null;
          for (const [id, tm] of V.timers) if (tm.at <= V.t && (!next || tm.at < next[1].at)) next = [id, tm];
          if (!next) break;
          const [id, tm] = next;
          if (tm.every) tm.at += tm.every; else V.timers.delete(id);
          try { tm.cb(...tm.args); } catch (e) { console.error(e); }
        }
        const cbs = [...V.rafs.values()];
        V.rafs.clear();
        for (const cb of cbs) { try { cb(V.t); } catch (e) { console.error(e); } }
        V.syncAnims();
        // let React and promises settle (real macrotasks, a few of them)
        for (let k = 0; k < 3; k++) await new Promise((r) => real.st(r, 0));
      }
      // a real paint after the last step, so the capture shows this frame and not the one before
      if (V.paint) await new Promise((r) => real.raf(() => real.raf(r)));
      return V.frame;
    };
    V.start = () => {
      if (V.on) return;
      V.t = real.now();
      V.dateOff = real.dnow() - V.t;
      V.on = true;
      offline(); // the game's next sound lands on the clock even if its context was not made yet
    };
    // a take starts / ends: the sound clock runs only inside takes
    V.take = (on) => { V.rec = on; return V.aud; };
    // a take thrown away: its sounds are cut and the sound clock goes back to where it began
    V.rewind = (mark) => {
      for (const s of V.started) if (s.at >= mark - 1e-6) { try { s.node.disconnect(); } catch { /* */ } }
      V.started = V.started.filter((s) => s.at < mark - 1e-6);
      V.aud = mark;
    };
    V.renderAudio = async () => {
      const c = V.audio;
      if (!c) return null;
      const buf = await c.startRendering();
      const n = Math.min(buf.length, Math.ceil(V.aud * buf.sampleRate));
      const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      const pcm = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
      // base64 in chunks
      const u8 = new Uint8Array(pcm.buffer);
      let s = "";
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return { b64: btoa(s), sr: buf.sampleRate, frames: n };
    };
  }, [fps, audioMaxS]);
}

const state = new WeakMap();

/** The clock is ours from here. `capture`: a folder for the frames (none = not filming yet). */
export async function vStart(page, { capture = null } = {}) {
  // (capture here is a plain folder; the sound clock starts with the first vCapture)
  await page.evaluate(() => window.__vclock.start());
  const cdp = await page.context().newCDPSession(page);
  state.set(page, { cdp, dir: capture, n: 0 });
  if (capture) fs.mkdirSync(capture, { recursive: true });
}

/** Start or stop capturing frames (the clock keeps stepping either way). */
export async function vCapture(page, dir, { probe = null } = {}) {
  const s = state.get(page);
  s.dir = dir;
  s.n = 0;
  s.probe = probe;
  s.log = [];
  if (dir) fs.mkdirSync(dir, { recursive: true });
  // the sound clock runs while filming; returns where this take starts on it (s)
  s.audioMark = await page.evaluate((on) => window.__vclock.take(on), !!dir);
  return s.audioMark;
}

/** Throw the take away: its sounds are cut and the sound clock goes back to where it began. */
export async function vDiscard(page, mark) {
  await page.evaluate((m) => window.__vclock.rewind(m), mark);
}

/** What `probe` returned at each captured frame (vCapture's option). */
export const vLog = (page) => state.get(page)?.log ?? [];

/** Frames captured so far into the current folder. */
export const vFrames = (page) => state.get(page)?.n ?? 0;

async function grab(page) {
  const s = state.get(page);
  if (!s.dir) return;
  // what the game says is on screen at this frame (ground truth for smoothness checks)
  if (s.probe) s.log.push(await page.evaluate(s.probe).catch(() => null));
  const r = await s.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88, fromSurface: true });
  fs.writeFileSync(path.join(s.dir, `f${String(s.n++).padStart(5, "0")}.jpg`), Buffer.from(r.data, "base64"));
}

/** n frames of game time, each captured if capturing. */
export async function vStep(page, n = 1) {
  // not filming: all n frames in one go (the page still runs every one of them)
  if (!state.get(page)?.dir) { await page.evaluate((k) => { window.__vclock.paint = false; return window.__vclock.step(k); }, n); return; }
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => { window.__vclock.paint = true; return window.__vclock.step(1); });
    await grab(page);
  }
}

/** Step until `pred` (run in the page) is true, at most `max` frames. Returns true if it came true. */
export async function vUntil(page, pred, max = 600, arg) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(pred, arg)) return true;
    await vStep(page, 1);
  }
  return false;
}

/** Render the sound placed so far into a 16-bit stereo WAV (the clock's time 0 = vStart). */
export async function vStopAudio(page, wavPath) {
  const r = await page.evaluate(() => window.__vclock.renderAudio());
  if (!r) return null;
  const data = Buffer.from(r.b64, "base64");
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(r.sr, 24);
  h.writeUInt32LE(r.sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(wavPath, Buffer.concat([h, data]));
  return { wav: wavPath, seconds: r.frames / r.sr };
}

/**
 * Join captured frames into an MP4 at a steady rate, with the sound under it.
 * `audioAtS`: where the frames' first image sits on the sound's clock (what vCapture returned).
 * `from`/`to`: frame numbers to keep. `outFps` below `fps` keeps every (fps/outFps)th frame.
 */
export function encode(dir, wav, out, { fps = 60, outFps = 30, from = 0, to = Infinity, audioAtS = 0, width = 780, crf = 22 } = {}) {
  const all = fs.readdirSync(dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  const last = Math.min(all.length, to);
  const n = last - from;
  const first = Number(all[from].slice(1, 6));
  // An exact image sequence at the capture rate, thinned evenly to outFps by the fps filter
  // (60 → 30 keeps every 2nd frame). Per-image durations in a concat list round and repeat
  // frames: that was measured (16% "stalls" in a clean capture), so it is not used.
  const startS = audioAtS + from / fps;
  const durS = n / fps;
  const args = ["-y", "-loglevel", "error", "-framerate", String(fps), "-start_number", String(first), "-i", path.join(dir, "f%05d.jpg")];
  if (wav) args.push("-ss", String(Math.max(0, startS)), "-t", String(durS), "-i", wav);
  args.push("-frames:v", String(Math.round(durS * outFps)), "-vf", `fps=${outFps},scale=${width}:-2:flags=lanczos`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", String(crf), "-preset", "slow", "-movflags", "+faststart");
  if (wav) args.push("-c:a", "aac", "-b:a", "128k"); else args.push("-an");
  args.push(out);
  execFileSync("ffmpeg", args);
  return { frames: Math.round(durS * outFps), seconds: durS };
}
