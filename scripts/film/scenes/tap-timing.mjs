/**
 * TAP → PLAYING, measured inside the page (no test-tool delay in the number).
 *
 *   import { tapToPlaying, stopwatch } from "./tap-timing.mjs";
 *   const { ms, how } = await tapToPlaying(page, wrapperLocator); // tap the post's play, time until the goal moves
 *   await stopwatch(page, `tap → playing: ${(ms / 1000).toFixed(1)} s`); // burnt into the next frames
 *
 * "Playing" = the live player's first frame is on screen
 * ([data-goal-video-live="playing"]) or the file's <video> has moved past 0.05 s.
 */
export async function tapToPlaying(page, wrapper, timeoutMs = 60000) {
  const el = await wrapper.elementHandle();
  return page.evaluate(async ({ el, timeoutMs }) => {
    const btn = el.querySelector("[data-goal-video-press-play], [data-goal-video-play]")
      || el.querySelector("video") || el;
    const t0 = performance.now();
    btn.click();
    const playing = () => {
      if (el.querySelector('[data-goal-video-live="playing"]')) return "live";
      const v = el.querySelector("video");
      if (v && !v.paused && v.currentTime > 0.05) return "file";
      return null;
    };
    while (performance.now() - t0 < timeoutMs) {
      const how = playing();
      if (how) return { ms: Math.round(performance.now() - t0), how };
      await new Promise(r => requestAnimationFrame(() => r()));
    }
    return { ms: null, how: "timeout" };
  }, { el, timeoutMs });
}

/** A small caption on the phone for the next `holdMs`, so a clip carries its number. */
export async function stopwatch(page, text, holdMs = 4000) {
  await page.evaluate(({ text, holdMs }) => {
    const d = document.createElement("div");
    d.textContent = text;
    d.setAttribute("data-film-stopwatch", "");
    d.style.cssText = "position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:2147483646;background:rgba(0,0,0,.78);color:#fff;font:800 14px/1.2 system-ui,sans-serif;padding:6px 12px;border-radius:999px;border:1.5px solid #34d399;pointer-events:none;white-space:nowrap";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), holdMs);
  }, { text, holdMs });
}
