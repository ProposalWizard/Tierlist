/**
 * THE GAME'S SOUND IN A CLIP (chat 2's version, 24 Oct 2026).
 *
 * Headless Chrome has no speakers to record, so the sound is taken inside the
 * page: every Web Audio node that plays to the speakers is also sent to one
 * recording mix, and so is every <video> that plays (its file's own sound).
 * MediaRecorder records that mix; ffmpeg puts it under the clip as AAC.
 *
 *   await installAudioTap(context);              // before the page loads
 *   await startAudio(page);                      // with startRec
 *   const a = await stopAudio(page, "x.webm");   // with stopRec → { file, startedAt }
 *   muxAudio("clip.mp4", "x.webm", "out.mp4", offsetSec);
 *   loudness("out.mp4")                          // [{ t, db }] every 0.25 s
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export async function installAudioTap(context) {
  await context.addInitScript(() => {
    const W = window;
    if (W.__audioTap) return;
    const tap = { master: null, out: null, rec: null, chunks: [], ctxTaps: new WeakMap(), videos: new WeakSet(), startedAt: 0 };
    W.__audioTap = tap;
    const masterCtx = () => {
      if (!tap.master) {
        tap.master = new AudioContext();
        tap.out = tap.master.createMediaStreamDestination();
      }
      if (tap.master.state === "suspended") tap.master.resume().catch(() => {});
      return tap.master;
    };
    const ctxTap = (ctx) => {
      let t = tap.ctxTaps.get(ctx);
      if (!t) {
        t = ctx.createMediaStreamDestination();
        tap.ctxTaps.set(ctx, t);
        const m = masterCtx();
        m.createMediaStreamSource(t.stream).connect(tap.out);
      }
      return t;
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      const r = connect.call(this, dest, ...rest);
      try {
        if (dest instanceof AudioDestinationNode && !(this.context instanceof OfflineAudioContext) && this.context !== tap.master) {
          connect.call(this, ctxTap(this.context));
        }
      } catch { /* not tapped */ }
      return r;
    };
    // A video's own sound: route it through the mix (and on to the speakers).
    document.addEventListener("play", (e) => {
      const v = e.target;
      if (!(v instanceof HTMLMediaElement) || tap.videos.has(v)) return;
      tap.videos.add(v);
      try {
        const m = masterCtx();
        const src = m.createMediaElementSource(v);
        src.connect(tap.out);
        connect.call(src, m.destination);
      } catch { /* not tapped */ }
    }, true);
    tap.start = () => {
      masterCtx();
      tap.chunks = [];
      tap.rec = new MediaRecorder(tap.out.stream, { mimeType: "audio/webm;codecs=opus" });
      tap.rec.ondataavailable = (e) => { if (e.data.size) tap.chunks.push(e.data); };
      tap.rec.start(250);
      tap.startedAt = performance.timeOrigin + performance.now();
    };
    tap.stop = () => new Promise((res) => {
      tap.rec.onstop = async () => {
        const b = new Blob(tap.chunks, { type: "audio/webm" });
        const buf = new Uint8Array(await b.arrayBuffer());
        let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        res({ b64: btoa(s), startedAt: tap.startedAt });
      };
      tap.rec.stop();
    });
  });
}

export async function startAudio(page) {
  return page.evaluate(() => { window.__audioTap.start(); return window.__audioTap.startedAt; });
}

export async function stopAudio(page, outFile) {
  const r = await page.evaluate(() => window.__audioTap.stop());
  writeFileSync(outFile, Buffer.from(r.b64, "base64"));
  return { file: outFile, startedAt: r.startedAt / 1000 };
}

/** Put the sound under the clip. offsetSec > 0: the sound started that long after the clip. */
export function muxAudio(videoMp4, audioFile, outMp4, offsetSec = 0) {
  const delay = Math.max(0, Math.round(offsetSec * 1000));
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", videoMp4, "-i", audioFile,
    "-filter_complex", `[1:a]adelay=${delay}|${delay},apad[a]`, "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", outMp4]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  return outMp4;
}

/** Loudness every 0.25 s (dB, RMS), for the proof. */
export function loudness(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-vn", "-af", "asetnsamples=12000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"], { encoding: "utf8" });
  const out = [];
  let t = null;
  for (const line of (r.stderr || "").split("\n")) {
    const mt = /pts_time:([\d.]+)/.exec(line); if (mt) t = Number(mt[1]);
    const mv = /RMS_level=(-?[\d.inf]+)/.exec(line); if (mv && t !== null) out.push({ t, db: mv[1] === "-inf" ? -120 : Number(mv[1]) });
  }
  return out;
}
