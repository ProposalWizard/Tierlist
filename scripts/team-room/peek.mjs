/**
 * scripts/team-room/peek.mjs — one picture of one Team room screen (sample rows, no sign-in).
 *   node scripts/team-room/peek.mjs <dark|light> "<query, e.g. &ch=ideas>" <out.png> [width] [height] [css selector to click first]
 */
import { chromium } from "playwright";

const [, , look = "dark", q = "", out = "peek.png", w = "390", h = "844", click = ""] = process.argv;
const BASE = process.env.TEAM_ROOM_URL || "http://localhost:3427";
const b = await chromium.launch();
const phone = +w < 800;
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
await ctx.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); localStorage.setItem("kib-tr-notify-asked", "1"); } catch { /* private */ } }, look);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to load|ERR_|supabase|favicon/i.test(m.text())) console.log("ERR", m.text().slice(0, 300)); });
await p.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" });
await p.waitForSelector(".trr", { timeout: 120000 });
await p.waitForTimeout(1200);
const c = p.locator("[data-cookie-reject]");
if (await c.count()) await c.first().click().catch(() => {});
if (click) { await p.locator(click).first().click(); }
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
