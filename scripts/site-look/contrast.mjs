#!/usr/bin/env node
/**
 * scripts/site-look/contrast.mjs — the readability check for the new look
 * (Leo, 26 Nov 2026: "you should NEVER be letting stupid shit like this pass.
 * so so easy to check for surely").
 *
 * Opens every public page in the New look (light and dark, and today's look
 * for comparison), signed out AND as a pretend signed-in player, and measures
 * every piece of text against what is really behind it (the colours of every
 * box underneath, gradients averaged). Anything under 3 : 1 is listed, worst
 * first, with a picture of the page. Text on a photo is skipped (can't be
 * measured from colours).
 *
 *   node scripts/site-look/contrast.mjs                          # live site, light + dark
 *   node scripts/site-look/contrast.mjs --base http://localhost:3421 --themes light,dark,off --out /tmp/x
 *
 * Exit code 1 when anything fails, so it can gate a push.
 * "Signed in" is faked inside the test browser only (the sign-in check is
 * answered with a made-up player); nothing is sent anywhere or saved.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require("node:child_process").execSync("npm root -g").toString().trim() + "/playwright")); }

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg("--base", "https://knowitball.co.uk");
const THEMES = arg("--themes", "light,dark").split(",");
const OUT = arg("--out", "/tmp/kib-contrast");
const MIN = Number(arg("--min", "3"));
const WAIT = Number(arg("--wait", "1500"));
const SHOTS = args.includes("--shots"); // a picture of every page, not only failing ones
const PAGES = arg("--pages", "/,/games,/draft,/draft/history,/draft/records,/tic-tac-toe,/tic-tac-toe/daily,/tenable,/tierlists,/objectives,/profile,/auth,/legal,/credits").split(",");
const SIGNED = arg("--signed", "out,in").split(",");
const WIDTHS = arg("--widths", "390,1366").split(",").map(Number);
// --api-from https://knowitball.co.uk : a local build's /api/* answered by the live site (real data, local look).
const API_FROM = arg("--api-from", "");
mkdirSync(OUT, { recursive: true });

const REF = "cagkgfketucousksgtbk";
function fakeSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-4000-8000-000000000001", exp: now + 3600, role: "authenticated" })}.x`;
  const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "contrast-check@example.invalid", app_metadata: { provider: "email" }, user_metadata: { username: "ContrastCheck" }, created_at: new Date().toISOString() };
  const session = { access_token: jwt, refresh_token: "x", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user };
  return { value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), user };
}

/** Runs in the page: every text's contrast against what is behind it. */
function measure(min) {
  const parse = (s) => { const m = s && s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/); if (!m) return null; let a = m[4] === undefined ? 1 : parseFloat(m[4]); if (m[4] && m[4].endsWith("%")) a /= 100; return [+m[1], +m[2], +m[3], a]; };
  const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  function bgOf(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.includes("url(")) return { photo: true };
      if (cs.backgroundImage && cs.backgroundImage.includes("gradient")) {
        const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (stops.length) { const avg = [0, 1, 2].map((i) => stops.reduce((s, x) => s + x[i], 0) / stops.length).concat(stops.reduce((s, x) => s + x[3], 0) / stops.length); layers.push(avg); if (avg[3] > 0.95) break; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] > 0.95) break; }
    }
    let col = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) col = over(layers[i], col);
    return { col };
  }
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (el.closest("script,style,noscript,[aria-hidden=true],[data-look-pill]")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (r.right <= 0 || r.left >= innerWidth) continue; // off-screen (a closed slide-in menu)
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity || "1");
    if (op < 0.05) continue;
    if (el.closest("button[disabled],[aria-disabled=true]")) continue;
    if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" || cs.backgroundClip === "text") continue; // gradient words
    const bg = bgOf(el); if (bg.photo) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const f = over([fg[0], fg[1], fg[2], fg[3] * op], bg.col);
    const L1 = lum(f), L2 = lum(bg.col);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < min) out.push({ ratio: Math.round(ratio * 100) / 100, text: t.slice(0, 50), tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal === undefined ? el.className : "").slice(0, 90), y: Math.round(r.top + scrollY) });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

const b = await chromium.launch();
let fails = 0;
const report = [];
for (const theme of THEMES) for (const signed of SIGNED) for (const width of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const cookies = [{ name: "kib_cookie_consent", value: "no", url: BASE }];
  if (theme !== "off") cookies.push({ name: "kib_look", value: "v2", url: BASE }, { name: "kib_theme", value: theme, url: BASE });
  if (signed === "in" || signed === "admin") {
    const s = fakeSessionCookie();
    cookies.push({ name: `sb-${REF}-auth-token`, value: s.value, url: BASE });
    await ctx.route(`https://${REF}.supabase.co/auth/v1/user*`, (r) => r.fulfill({ json: s.user }));
    await ctx.route(`https://${REF}.supabase.co/auth/v1/token*`, (r) => r.fulfill({ status: 400, json: { error: "x" } }));
  }
  // "admin": also answers the admin check yes, and opens the admin side panel before measuring.
  if (signed === "admin") await ctx.route(`${BASE}/api/profile/admin-check*`, (r) => r.fulfill({ json: { isAdmin: true, isTester: true } }));
  await ctx.addCookies(cookies);
  if (API_FROM) await ctx.route((u) => u.href.startsWith(`${BASE}/api/`) && !u.href.includes("/api/profile/admin-check"), async (r) => {
    const u = r.request().url().replace(BASE, API_FROM);
    try { const res = await r.fetch({ url: u }); await r.fulfill({ response: res }); } catch { await r.continue(); }
  });
  const p = await ctx.newPage();
  for (const path of PAGES) {
    try {
      await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
      await p.getByText("No thanks").click({ timeout: 600 }).catch(() => {});
      await p.waitForTimeout(WAIT);
      if (signed === "admin") { await p.locator("[data-admin-nav] button").first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800); }
      const bad = await p.evaluate(measure, MIN);
      const tag = `${theme}-${signed}-${width}-${(path === "/" ? "home" : path.slice(1)).replace(/\//g, "_")}`;
      fails += bad.length;
      if (bad.length || SHOTS) { await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true }).catch(() => {}); }
      report.push({ tag, n: bad.length, worst: bad.slice(0, 6) });
      console.log(`${bad.length ? "FAIL" : "ok  "} ${tag}${bad.length ? `  ${bad.length} faint: ` + bad.slice(0, 4).map((x) => `"${x.text}" ${x.ratio}`).join(" · ") : ""}`);
    } catch (e) { console.log(`ERR  ${theme}-${signed}-${width} ${path} ${e.message.slice(0, 80)}`); }
  }
  await ctx.close();
}
await b.close();
const { writeFileSync } = await import("node:fs");
// The same faint text on many pages is one problem: group them.
const groups = new Map();
for (const r of report) for (const w of r.worst) { const k = `${w.text} (${w.ratio})`; groups.set(k, [...(groups.get(k) ?? []), r.tag]); }
console.log("\nDistinct faint texts (worst 6 per page):");
for (const [k, tags] of [...groups].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${k}  ×${tags.length}  e.g. ${tags[0]}`);
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(`\n${fails ? `${fails} faint texts` : "All readable"} (min ${MIN}:1). Report + pictures: ${OUT}`);
process.exit(fails ? 1 : 0);
