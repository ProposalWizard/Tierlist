/**
 * THE GAME'S SOUND, SAMPLE-ACCURATE (chat 1, 24 Oct 2026) — on top of audio-tap.mjs.
 *
 * audio-tap.mjs gathers everything the game plays into one mix. Recording that mix with
 * MediaRecorder lost the silent stretches here (a 40 s take came back ~32 s long), so the
 * sound drifted seconds off the picture. This records the mix's raw samples instead, on
 * the audio clock (a ScriptProcessor on the tap's own context): silence stays silence and
 * every sample keeps its time, so the line-up is the audio clock's, not the recorder's.
 *
 *   await installAudioTap(context);                  // audio-tap.mjs, before the page loads
 *   const at = await startPcm(page, () => clipT);    // returns clip time the sound starts at
 *   await stopPcm(page, "x.wav");                    // 16-bit mono WAV, 48 kHz
 * Then: cut.py ... --audio x.wav --audio-at <at>.
 */
import { writeFileSync } from "node:fs";

export async function startPcm(page, nowClip) {
  const before = nowClip();
  const r = await page.evaluate(() => {
    const tap = window.__audioTap;
    if (!tap.master) { tap.master = new AudioContext(); tap.out = tap.master.createMediaStreamDestination(); }
    const m = tap.master;
    if (m.state === "suspended") m.resume().catch(() => {});
    const src = m.createMediaStreamSource(tap.out.stream);
    const proc = m.createScriptProcessor(4096, 2, 1);
    const mute = m.createGain(); mute.gain.value = 0;
    tap.pcm = { bufs: [], sr: m.sampleRate, proc, src, mute, first: null };
    proc.onaudioprocess = (e) => {
      const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : a;
      const mono = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) mono[i] = (a[i] + b[i]) * 0.5;
      if (tap.pcm.first === null) tap.pcm.first = e.playbackTime;
      tap.pcm.bufs.push([e.playbackTime, mono, performance.now()]);
    };
    // AudioNode.connect is patched by the tap; the master context is never tapped, so these are plain connects.
    src.connect(proc); proc.connect(mute); mute.connect(m.destination);
    return { ctxNow: m.currentTime, perfNow: performance.now() };
  });
  return { before, ...r };
}

/** Writes the WAV; returns the clip time (s) of its first sample. */
export async function stopPcm(page, wavFile, start) {
  const r = await page.evaluate(async () => {
    const p = window.__audioTap.pcm;
    await new Promise((res) => setTimeout(res, 300));
    p.proc.onaudioprocess = null;
    try { p.src.disconnect(); p.proc.disconnect(); } catch { /* gone */ }
    if (!p.bufs.length) return null;
    // Headless Chrome's audio clock runs a little slow against real time (a 67 s take came
    // back 66.3 s long). Fit real time to the audio clock over every buffer's callback
    // (perf ms = a + b * playbackTime) and lay each buffer down at its real time.
    const sr = p.sr, B = p.bufs, N = B.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    // a buffer is handed over once its last sample is in: its first sample was played one buffer earlier
    const bufMs = (B[0][1].length / sr) * 1000;
    for (const [t, , w0_] of B) { const w = w0_ - bufMs; sx += t; sy += w; sxx += t * t; sxy += t * w; }
    const b = N > 1 ? (N * sxy - sx * sy) / (N * sxx - sx * sx) : 1000, a = (sy - b * sx) / N;
    const wall = (t) => a + b * t;                               // perf ms
    const first = B[0][0], w0 = wall(first);
    const last = B[N - 1];
    const n = Math.round(((wall(last[0]) - w0) / 1000) * sr) + last[1].length;
    const out = new Int16Array(n);
    for (const [t, d] of B) {
      const at = Math.round(((wall(t) - w0) / 1000) * sr);
      for (let i = 0; i < d.length && at + i < n; i++) out[at + i] = Math.max(-32767, Math.min(32767, Math.round(d[i] * 32767)));
    }
    const u8 = new Uint8Array(out.buffer);
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), sr, w0, rate: b / 1000 };
  });
  if (!r) throw new Error("no audio captured");
  const pcm = Buffer.from(r.b64, "base64");
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(r.sr, 24);
  h.writeUInt32LE(r.sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(wavFile, Buffer.concat([h, pcm]));
  // the first sample's clip time: when we asked, plus how much later (real time) it was played
  return start.before + (r.w0 - start.perfNow) / 1000;
}
