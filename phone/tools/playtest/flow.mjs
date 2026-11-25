/**
 * Scripted flows for the live bench (round 3). Used through `pt.mjs run`:
 *   pt.mjs run '{"name":"k","js":"return (await import(\"file:///…/flow.mjs\")).entryScore(H, \"k\", \"<save.json>\")"}'
 * entryScore: opens KIB Next on a save, presses CONTINUE / PLAY / PLAY ANYWAY / KICK OFF and reads the board.
 */
export async function pressThrough(H, name, app) {
  const t = async (re, w = 1500) => { try { await H.click({ name, re, wait: w }); return true; } catch { return false; } };
  if (app === "next") { await t("CONTINUE", 2500); }
  else { await t("No thanks", 500); await H.tap({ name, x: 367, y: 875, wait: 2500 }); }
  if (app === "next") await t("^PLAY$|PLAY", 2500);
  await t("PLAY ANYWAY", 2000);
  await t("KICK OFF", 2500);
}
export async function entryScore(H, name, save) {
  await H.open({ app: "next", name, saveFile: save, video: false });
  await H.wait({ name, ms: 3000 });
  await pressThrough(H, name, "next");
  const r = await H.text({ name });
  return String(r.text || "").split("\n").slice(0, 14).join(" ");
}
