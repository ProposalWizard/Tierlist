/**
 * scripts/team-room/at-bots-stills.mjs — "bots you can @" and the AI bots, on
 * screen (Harry, 13 Nov 2026). Opens the Team room with sample rows (a dev
 * build with no database and no AI key: the same sums run in the browser and
 * the AI is a pretend one), asks each kind of bot, and saves a picture of each
 * step in BOTH looks at a phone's size.
 *
 *   npx next dev -p 3431
 *   node scripts/team-room/at-bots-stills.mjs [--url http://localhost:3431] [--out docs/stills/team-room-at-bots]
 *
 * Each step prints PASS or FAIL with what was seen. Exits 1 on a FAIL or a page error.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { audit } from "./contrast.mjs";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3431");
const OUT = arg("--out", "docs/stills/team-room-at-bots");
mkdirSync(OUT, { recursive: true });

const errors = []; const results = [];
let texts = 0; let lowest = 99;
const browser = await chromium.launch();
for (const look of ["dark", "light"]) {
  const tag = `${look}-390x844`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); localStorage.setItem("kib-tr-notify-asked", "1"); } catch { /* private */ } }, look);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|supabase|ERR_|127\.0\.0\.1:9/i.test(m.text())) errors.push(`${tag}: ${m.text().slice(0, 200)}`); });
  // Every picture is also measured: any text under 4.5:1 against what is behind it fails the run.
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
    const r = await page.evaluate(audit);
    texts += r.n; lowest = Math.min(lowest, r.min);
    for (const l of r.low) { results.push({ tag, what: `contrast ${name}`, pass: false }); console.log(`  FAIL ${tag} contrast on ${name}: ${l.ratio}:1 "${l.text}" .${l.cls} ${l.size}`); }
  };
  const open = async (q) => {
    await page.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".trr", { timeout: 180_000 });
    await page.waitForTimeout(900);
    const b = page.locator("[data-cookie-reject]"); if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(150); }
  };
  const check = (what, pass, saw) => { results.push({ tag, what, pass, saw }); console.log(`  ${pass ? "PASS" : "FAIL"} ${tag} ${what}${saw ? ` — ${saw}` : ""}`); };
  const text = async (sel) => ((await page.locator(sel).last().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  const say = async (words) => {
    await page.locator("#tr-compose").fill(words);
    await page.locator(".trr-main .tr-send").click();
    await page.waitForTimeout(1600);
  };
  const openThread = async () => { await page.locator(".trr-main .tr-threadline").last().click(); await page.waitForSelector(".trr-thread", { timeout: 5000 }); await page.waitForTimeout(400); };
  const closeThread = async () => { await page.locator(".trr-thread .trw-close").click().catch(() => {}); await page.waitForTimeout(200); };

  /* 1. Typing @ suggests the bots as well as people. */
  await open("");
  await page.locator("#tr-compose").click();
  await page.locator("#tr-compose").pressSequentially("@");
  await page.waitForTimeout(300);
  const sug = await text(".tr-suggest");
  check("@ suggests bots and people", ["Mikey", "Leo", "Patch bot", "Bug bot", "Health bot", "Today bot", "Jobs bot", "Claude", "Harry bot"].every((n) => sug.includes(n)), `${await page.locator(".tr-suggest button").count()} rows`);
  await shot("01-at-suggestions");
  await page.locator("#tr-compose").pressSequentially("pat");
  await page.waitForTimeout(250);
  check("@pat narrows to Patch bot", (await page.locator(".tr-suggest button").count()) === 1 && (await text(".tr-suggest")).includes("Patch bot"), await text(".tr-suggest button"));
  await shot("02-at-pat");
  await page.locator(".tr-suggest button").first().click();
  check("picking it writes @Patch bot", (await page.locator("#tr-compose").inputValue()) === "@Patch bot ", JSON.stringify(await page.locator("#tr-compose").inputValue()));

  /* 2. @Patch bot latest: answered in a thread. */
  await say("@Patch bot latest");
  check("the message shows 1 reply", (await text(".trr-main .tr-threadline")).includes("1 reply"), await text(".trr-main .tr-threadline"));
  await shot("03-patch-ask-in-channel");
  await openThread();
  const pa = await text(".trr-thread .tr-botmsg");
  check("Patch bot answered in the thread", pa.includes("Patch bot") && /v\d+\.\d+/.test(pa) && pa.includes("Open v"), pa.slice(0, 90));
  await shot("04-patch-thread-reply");
  await closeThread();

  /* 3. Words a bot does not understand: one line of what to ask. */
  await say("@Bug bot sing me a song");
  await openThread();
  const un = await text(".trr-thread .tr-botmsg");
  check("unknown ask gets a help line", un.includes("I didn't follow that") && un.includes("@Bug bot open"), un.slice(0, 110));
  await shot("05-unknown-ask");
  await closeThread();

  /* 4. Claude's page, off (no key). */
  await open("&bot=claude");
  const off = await text(".trb");
  check("Claude's page says it is not switched on", off.includes("Claude is not switched on yet: one Vercel setting") && (await page.locator("[data-ai-off]").count()) === 1, await text(".trb-status"));
  await shot("06-claude-page-off");
  await page.locator('[data-ask="sum up this thread"]').scrollIntoViewIfNeeded();
  await shot("07-claude-ask-me");

  /* 5. Claude's page, on, with the spend bar (a sample spend). */
  await open("&bot=claude&teamroom=claude");
  const on = await text("[data-ai-spend]");
  check("Claude's page shows the month's spend", on.includes("£3.10 of £20.00 this month") && (await page.locator(".trb-bar i").count()) === 1, on.slice(0, 60));
  await shot("08-claude-page-on-spend");

  /* 6. @Claude: a reply in a thread (a pretend AI). */
  await open("&teamroom=claude");
  await say("@Claude what is the rule on patch notes for Mikey?");
  await openThread();
  const cl = await text(".trr-thread .tr-botmsg");
  check("Claude answered and cites a Brain code", cl.includes("Claude") && /\b[A-Z]{2,5}-[A-Z0-9]{2,6}-\d{3}\b/.test(cl), cl.slice(0, 110));
  await shot("09-claude-thread-reply");
  await closeThread();

  /* 7. A person's bot: a quick answer, then a bigger ask becomes a card. */
  // One AI answer per person every 20 seconds: wait it out, as a person would.
  await page.waitForTimeout(21_000);
  await say("@Harry bot what shipped this week?");
  await openThread();
  check("Harry bot answered (tier 1)", (await text(".trr-thread .tr-botmsg")).includes("Harry bot") && !(await text(".trr-thread .tr-botmsg")).includes("One question every"), (await text(".trr-thread .tr-botmsg")).slice(0, 90));
  await shot("10-harry-bot-tier1-reply");
  await closeThread();
  await say("@Harry bot fix the keeper dive on corners");
  await openThread();
  const card = await text(".trr-thread .tr-propose");
  check("a bigger ask becomes a card (tier 2)", card.includes("This needs Harry's Claude. Send it?") && (await page.locator(".trr-thread .tr-propose button").count()) === 2, card.slice(0, 80));
  await shot("11-proposal-before-accept");
  await page.locator(".trr-thread .tr-propose button", { hasText: "Accept" }).click();
  await page.waitForTimeout(500);
  const after = await text(".trr-thread .tr-propose");
  check("after Accept the card says sent, waiting", after.includes("Sent to Harry's Claude · waiting") && (await page.locator(".trr-thread .tr-propose button", { hasText: "Accept" }).count()) === 0, after.slice(0, 110));
  await shot("12-proposal-after-accept");
  await closeThread();

  /* 8. A person's bot page: the owner's view (Harry is "me" in the sample rows) and another person's view. */
  await open("&bot=harry-bot&teamroom=claude");
  await shot("13-harry-bot-page-owner-top");
  await page.locator('[data-ai-settings="owner"]').scrollIntoViewIfNeeded();
  check("Harry can change Harry bot", (await page.locator('[data-ai-settings="owner"] textarea').isEditable()) && !(await page.locator('[data-ai-settings="owner"] .trb-switch').isDisabled()), "switch and box are live");
  await page.locator('[data-ai-settings="owner"] textarea').fill("Three lines at most. Football words, not coder words.");
  await page.locator('[data-ai-settings="owner"] .trb-fieldfoot .tr-btn').click();
  await page.waitForTimeout(400);
  check("Harry saves How I should answer", (await text('[data-ai-settings="owner"] .trb-saved')).includes("Saved"), await text('[data-ai-settings="owner"] .trb-saved'));
  await page.evaluate(() => document.querySelector('[data-ai-settings]')?.scrollIntoView({ block: "start" }));
  await shot("14-harry-bot-page-owner-settings");
  await open("&bot=leo-bot&teamroom=claude");
  await page.evaluate(() => document.querySelector('[data-ai-settings]')?.scrollIntoView({ block: "start" }));
  check("Harry cannot change Leo bot", (await page.locator('[data-ai-settings="other"]').count()) === 1 && (await page.locator('[data-ai-settings="other"] .trb-switch').isDisabled()) && !(await page.locator('[data-ai-settings="other"] textarea').isEditable()), await text('[data-ai-settings="other"] .tr-lbl'));
  await shot("15-leo-bot-page-other-person");

  /* 9. An "Ask me" example drops "@Bot …" into the message box. */
  await open("&bot=patch-notes");
  await page.locator('[data-ask="last 3"]').click();
  await page.waitForTimeout(600);
  check("Ask me drops the words into the message box", (await page.locator("#tr-compose").inputValue()) === "@Patch bot last 3", JSON.stringify(await page.locator("#tr-compose").inputValue().catch(() => "")));
  await shot("16-ask-me-dropped-in");
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed, ${errors.length} page error${errors.length === 1 ? "" : "s"}. Text contrast: ${texts} texts measured, lowest ${lowest}:1.`);
for (const e of errors) console.log(`  page error: ${e}`);
process.exit(bad.length || errors.length ? 1 : 0);
