// Shared steps for the weather test page clips (chat 4, 22-23 Oct 2026).
// The page: /star-weather-dev. Dials are its own buttons; the match is EnginePlay.
// Needs a build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (window.__starMatch, dev only).
export const pill = (page, text) => page.locator(".bc-pill", { hasText: text }).first();

/** Set the day: weather pill, wind (dot index 0..7 clockwise from "towards goal", speed), a club or a quality, dry spell, worst. */
export async function setDay(page, { weather, windDot, windSpeed, club, pitch, dry, harsh } = {}) {
  if (weather) await pill(page, weather).click();
  if (windDot !== undefined) await page.locator('svg[aria-label^="Wind"] circle[r="6"]').nth(windDot).click();
  if (windSpeed !== undefined) await page.locator('input[aria-label="Wind speed"]').fill(String(windSpeed));
  if (club) {
    const v = await page.locator("select option", { hasText: club }).first().getAttribute("value");
    await page.locator("select").selectOption(v);
  }
  if (pitch !== undefined) await page.locator('input[aria-label="Pitch quality"]').fill(String(pitch));
  if (dry !== undefined) await pill(page, dry ? "Dry spell" : "Normal").click();
  if (harsh !== undefined) await pill(page, harsh ? "Harsh" : "Tame").click();
}

/** Press Play it and wait for a chance to aim at. */
export async function playIt(page) {
  await page.getByRole("button", { name: "▶ Play it" }).click();
  await page.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim", null, { timeout: 90000 });
  await page.locator("[data-playing]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
}

/** A real strike (drag back from the ball, tap the contact ball), then the ball is set to a FIXED strike
 *  so the clip is the same every time: from where it was struck, `speed` m/s at `angle`° up, heading `heading`
 *  (radians, 0 = straight at the goal line, + = to the right on screen when facing up). */
export async function strikeAndSet(page, { speed, angle, heading = 0, spin = 0, from = null }) {
  const fr = await page.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal() }));
  const { ball, goal } = fr;
  const dx = ball.x - goal.x, dy = ball.y - goal.y, L = Math.hypot(dx, dy) || 1;
  await page.mouse.move(ball.x, ball.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(ball.x + (dx / L) * 60 * i / 12, ball.y + (dy / L) * 60 * i / 12); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const b = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  const bb = await b.boundingBox().catch(() => null);
  if (bb) await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForFunction(() => window.__starMatch.phase() === "flight", null, { timeout: 8000 });
  const ok = await page.evaluate(({ speed, angle, heading, spin, from }) => {
    const m = window.__starMatch, st = m.ballState();
    const a = angle * Math.PI / 180, vh = speed * Math.cos(a);
    // `from` in pitch metres, or { fx, fy | y } as a share of the camera's view (fy) or a fixed distance from goal (y).
    const cam = m.frame().cam;
    const p = from && from.fx !== undefined
      ? { x: cam.x1 + from.fx * (cam.x2 - cam.x1), y: from.y ?? cam.y1 + from.fy * (cam.y2 - cam.y1), z: from.z }
      : from ?? { x: st.pos.x, y: st.pos.y, z: Math.max(0.11, st.z) };
    return m.setBall({ x: p.x, y: p.y, z: p.z ?? 0.11, vx: vh * Math.sin(heading), vy: -vh * Math.cos(heading), vz: speed * Math.sin(a), spin, shot: false });
  }, { speed, angle, heading, spin, from });
  if (!ok) throw new Error("the fixed strike did not take (the real strike ended first)");
  // Let the "MISCUED"/"MISTIMED" word of the real strike clear before filming starts.
  await page.waitForTimeout(50);
  return ok;
}

/** Hide the dev error badge if the sandbox shows one (it is the missing database, not the game). */
export async function hideDevBadges(page) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
}

/** Record one take into `out` (an MP4 at 720 wide via rec.mjs). */
export async function take(rec, page, out, act, holdMs) {
  // The strike screen (drag + tap) happens off camera; filming starts as the fixed strike leaves the boot.
  await act();
  const r = await rec.startRec(page);
  // Until the ball's run is over (plus a beat), never into the next chance; at most holdMs.
  const t0 = Date.now();
  await page.waitForFunction(() => window.__starMatch.phase() !== "flight", null, { timeout: holdMs }).catch(() => {});
  await page.waitForTimeout(Math.max(0, Math.min(1000, holdMs - (Date.now() - t0))));
  await rec.stopRec(r, out, { holdEnd: 0.4 });
  return out;
}
