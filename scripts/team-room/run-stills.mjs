/**
 * scripts/team-room/run-stills.mjs — THE RUN, on screen (Harry, 12 Nov 2026:
 * "have you done a run of all bots, and all channels having their own
 * tabs/way of working?"). It opens the Team room with sample rows (a dev build
 * with no database: nothing is saved anywhere), does every channel's main
 * action once and presses Run now on every bot, in BOTH looks (Dark = Midnight
 * slate, Light = Light C) at a phone's size and a computer's, and saves a
 * picture of each channel tab and each bot page.
 *
 *   npx next dev -p 3427
 *   node scripts/team-room/run-stills.mjs [--url http://localhost:3427] [--out docs/stills/team-room-v2-run]
 *
 * Each action prints PASS or FAIL with what was seen on the page. Exits 1 on
 * a FAIL or a page error.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3427");
const OUT = arg("--out", "docs/stills/team-room-v2-run");
mkdirSync(OUT, { recursive: true });

const SIZES = [{ name: "390x844", width: 390, height: 844, phone: true }, { name: "1440x900", width: 1440, height: 900, phone: false }];
const LOOKS = ["dark", "light"];
const errors = []; const results = [];
const browser = await chromium.launch();

for (const look of LOOKS) {
  for (const size of SIZES) {
    const tag = `${look}-${size.name}`;
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: size.phone, isMobile: size.phone });
    await ctx.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); if (!sessionStorage.getItem("ask-shot")) localStorage.setItem("kib-tr-notify-asked", "1"); } catch { /* private */ } }, look);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag} ${page.url().split("tab=chat")[1] ?? ""}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|supabase|ERR_|127\.0\.0\.1:9/i.test(m.text())) errors.push(`${tag} ${page.url().split("tab=chat")[1] ?? ""}: ${m.text().slice(0, 200)}`); });
    const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}-${tag}.png` }); };
    const open = async (q) => {
      await page.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".trr", { timeout: 120_000 });
      await page.waitForTimeout(800);
      const b = page.locator("[data-cookie-reject]"); if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(150); }
    };
    const check = (what, pass, saw) => { results.push({ tag, what, pass, saw }); console.log(`  ${pass ? "PASS" : "FAIL"} ${tag} ${what}${saw ? ` — ${saw}` : ""}`); };
    const tabNames = async () => (await page.locator(".trr-tabs button").allInnerTexts()).map((t) => t.replace(/\s+\d+$/, "").trim()).join(" | ");
    const has = async (sel) => (await page.locator(sel).count()) > 0;
    const text = async (sel) => ((await page.locator(sel).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();

    /* 0. The look really is the one asked for. */
    await open("");
    const room = await page.locator(".trr-host").getAttribute("data-room");
    check("look", room === (look === "dark" ? "slate" : "lightc"), `data-room=${room}`);

    /* 1. #general: Messages | Pinned; send a message. */
    check("#general tabs", (await tabNames()) === "Messages | Pinned", await tabNames());
    await page.locator("#tr-compose").fill(`Run check ${tag}: hello from the run`);
    await page.locator(".trr-main .tr-send").click();
    await page.waitForTimeout(400);
    check("#general send a message", (await text(".trr-main .tr-msgs")).includes(`Run check ${tag}`), "my message is in the channel");
    await shot("01-general-messages");
    await page.locator('.trr-tabs [data-tab="pins"]').click();
    check("#general Pinned", (await page.locator(".tr-pin").count()) >= 1, `${await page.locator(".tr-pin").count()} pinned`);
    await shot("02-general-pinned");

    /* 2. #today: Today | This week | Messages; check in. */
    await open("&ch=today");
    check("#today tabs", (await tabNames()) === "Today | This week | Messages", await tabNames());
    const before = await text('[data-checkin="Harry"]');
    await page.locator("#trh-checkin").fill("building the Team room run");
    await page.locator("#trh-checkin").press("Enter");
    await page.waitForTimeout(400);
    const after = await text('[data-checkin="Harry"]');
    check("#today check in", before.includes("Not checked in") && after.includes("building the Team room run"), `card went from "not checked in" to my line`);
    await shot("03-today-today");
    await page.locator('.trr-tabs [data-tab="week"]').click();
    check("#today This week", (await page.locator(".trh-week tbody tr").count()) === 7 && (await text(".trh-week tr.today")).includes("building the Team room run"), "7 rows, today's row has my check-in");
    await shot("04-today-week");
    await page.locator('.trr-tabs [data-tab="messages"]').click();
    await page.locator("#tr-compose").fill("/today filming the run");
    await page.locator(".trr-main .tr-send").click();
    await page.waitForTimeout(500);
    check("/today writes to #today", (await text(".trr-main .tr-msgs")).includes("filming the run"), "the /today line is a message in #today");
    await shot("05-today-messages");

    /* 3. #ideas: Ideas board | Messages; post an idea, vote. */
    await open("&ch=ideas");
    check("#ideas tabs", (await tabNames()) === "Ideas board | Messages", await tabNames());
    await page.locator("#tr-idea-new").fill("A weekly check-in summary post");
    await page.locator("#tr-idea-new").press("Enter");
    await page.waitForTimeout(300);
    const mineCard = page.locator(".tr-card", { hasText: "A weekly check-in summary post" }).first();
    const v0 = await mineCard.locator(".trh-vote").innerText();
    await mineCard.locator(".trh-vote").click();
    await page.waitForTimeout(250);
    const v1 = await page.locator(".tr-card", { hasText: "A weekly check-in summary post" }).first().locator(".trh-vote").innerText();
    check("#ideas post an idea and vote", /0/.test(v0) && /1/.test(v1), `votes ${v0.trim()} → ${v1.trim()}`);
    await shot("06-ideas-board");

    /* 4. #todo: Tasks | Messages; add a task, accept the proposal, Everyone. */
    await open("&ch=todo");
    check("#todo tabs", (await tabNames()) === "Tasks | Messages", await tabNames());
    await page.locator("#tr-task-new").fill("Send Harry the run table");
    await page.locator("#tr-task-new").press("Enter");
    await page.waitForTimeout(250);
    const asks0 = await page.locator(".tr-ask").count();
    if (asks0) await page.locator(".tr-ask .tr-btn").first().click();
    await page.waitForTimeout(250);
    check("#todo add a task, accept a proposal", (await text(".trh-todo")).includes("Send Harry the run table") && asks0 === 1 && (await page.locator(".tr-ask").count()) === 0, "task added; the proposal became a job");
    await shot("07-todo-mine");
    await page.locator(".trh-seg button").nth(1).click();
    check("#todo Everyone", (await page.locator(".trh-everyone .trh-card").count()) === 3, "3 people side by side");
    await shot("08-todo-everyone");

    /* 5. #bugs: Open reports | Fixed | Messages; mark one fixed. */
    await open("&ch=bugs");
    check("#bugs tabs", (await tabNames()) === "Open reports | Fixed | Messages", await tabNames());
    const open0 = await page.locator(".trr-bug").count();
    await shot("09-bugs-open");
    await page.locator(".trr-bug .tr-btn.fix").first().click();
    await page.waitForTimeout(300);
    const open1 = await page.locator(".trr-bug").count();
    await page.locator('.trr-tabs [data-tab="fixed"]').click();
    await page.waitForTimeout(200);
    check("#bugs mark fixed", open1 === open0 - 1 && (await page.locator(".trr-bug.fixed").count()) === 1, `open ${open0} → ${open1}; 1 card in Fixed`);
    await shot("10-bugs-fixed");
    await page.locator('.trr-tabs [data-tab="messages"]').click();
    await shot("11-bugs-messages");

    /* 6. #health: Limits | Messages. */
    await open("&ch=health");
    check("#health tabs", (await tabNames()) === "Limits | Messages", await tabNames());
    check("#health four coloured lines + history", (await page.locator(".trh-health .trh-card").first().locator(".trh-hlines li").count()) === 4 && (await page.locator(".trh-hist > div").count()) >= 2, `${await page.locator(".trh-hist > div").count()} posts in history`);
    await shot("12-health-limits");
    await page.locator('.trr-tabs [data-tab="messages"]').click();
    check("#health post shows as Health bot", (await text(".tr-botmsg")).includes("Health bot") && (await page.locator(".tr-botmsg .trh-hlines li").count()) >= 4, "Health bot's post with its coloured lines");
    await shot("13-health-messages");

    /* 7. #patch-notes: Archive | Messages; Read. */
    await open("&ch=patch-notes");
    check("#patch-notes tabs", (await tabNames()) === "Archive | Messages", await tabNames());
    const rc = page.locator(".trw-rc").filter({ has: page.locator(".tr-btn:not(.ghost)", { hasText: "Read" }) }).first();
    const hadUnread = await rc.count();
    if (hadUnread) await rc.locator(".tr-btn", { hasText: "Read" }).first().click();
    await page.waitForTimeout(250);
    check("#patch-notes archive, mark one read", (await page.locator(".trw-rc").count()) > 3 && hadUnread === 1 && (await page.locator(".trw-rc .tr-btn.ghost", { hasText: "✓ Read" }).count()) >= 1, `${await page.locator(".trw-rc").count()} notes listed`);
    await shot("14-patch-notes-archive");

    /* 8. #marketing: Production board | Messages. */
    await open("&ch=marketing");
    check("#marketing tabs", (await tabNames()) === "Production board | Messages", await tabNames());
    check("#marketing summary card", (await page.locator(".trh-stage").count()) === 7, "7 steps counted");
    await shot("15-marketing-board");

    /* 9. #connectors (chat only) and its empty line. */
    await open("&ch=connectors");
    check("#connectors chat only, says what it is for", (await page.locator(".trr-tabs").count()) === 0 && (await text(".trr-main .tr-msgs")).includes("Nothing posts here by itself yet"), "no tab row; one line on what it is for");
    await shot("16-connectors-empty");

    /* 10. Team board tab: notes box. */
    await open("&view=board");
    await page.locator('input[aria-label="New board note"]').fill("Run note: board checked");
    await page.locator('input[aria-label="New board note"]').press("Enter");
    await page.waitForTimeout(300);
    check("Team board: bars and a note", (await page.locator(".trh-grid3 .trh-card").count()) === 3 && (await text(".trh-notes")).includes("Run note: board checked"), "3 people; my note saved");
    await shot("17-team-board");
    if (size.phone) { await page.locator(".trh-notes").scrollIntoViewIfNeeded(); await shot("17b-team-board-notes"); }

    /* 11. Me: one-tap status. */
    await open("&view=me");
    await page.locator(".trh-chips button", { hasText: "Filming" }).click();
    await page.waitForTimeout(300);
    check("Me: one-tap status", (await page.locator('.trh-chips button[aria-pressed="true"]').innerText()).includes("Filming") && (await text(".trh-hero")).includes("Filming"), "status set to Filming");
    await shot("18-me");

    /* 12. The bots: each page, Run now twice. */
    for (const bot of ["patch-notes", "bug", "health", "today", "jobs"]) {
      await open(`&bot=${bot}`);
      const runBtn = page.locator(`[data-run-bot="${bot}"]`);
      if (await runBtn.count()) {
        await runBtn.click(); await page.waitForTimeout(400);
        const r1 = await text(".trh-run .res");
        await runBtn.click(); await page.waitForTimeout(400);
        const r2 = await text(".trh-run .res");
        const once = bot === "health" ? r1.startsWith("Done") && r2.startsWith("Done") : r2.startsWith("Nothing to do") || r2.startsWith("Switched off");
        check(`${bot} bot: Run now, twice`, r1.length > 0 && once, `1st: ${r1.slice(0, 70)} · 2nd: ${r2.slice(0, 50)}`);
      } else check(`${bot} bot: no Run now, says why`, (await text(".trb")).includes("Nothing to run"), "says there is nothing to run");
      await shot(`20-bot-${bot}`);
    }
    // What the Bug bot's run made: a new card in #bugs.
    await open("&ch=bugs&bot=");
    await open("&ch=bugs");
    await ctx.close();

    /* 13. The first-visit notifications question (a fresh device). */
    const fresh = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: size.phone, isMobile: size.phone });
    await fresh.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); } catch { /* private */ } }, look);
    const p2 = await fresh.newPage();
    await p2.goto(`${BASE}/admin/team?tab=chat`, { waitUntil: "domcontentloaded" });
    await p2.waitForSelector(".trr", { timeout: 120_000 });
    await p2.waitForTimeout(900);
    const c2 = p2.locator("[data-cookie-reject]"); if (await c2.count()) await c2.first().click().catch(() => {});
    const asked = await p2.locator(".trh-ask").count();
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: `${OUT}/19-notifications-question-${tag}.png` });
    if (asked) await p2.locator(".trh-ask .tr-btn.ghost").click();
    await p2.waitForTimeout(200);
    await p2.reload({ waitUntil: "domcontentloaded" });
    await p2.waitForSelector(".trr", { timeout: 120_000 });
    await p2.waitForTimeout(700);
    const again = await p2.locator(".trh-ask").count();
    results.push({ tag, what: "first-visit notifications question", pass: asked === 1 && again === 0, saw: "asked once, not again after Not now" });
    console.log(`  ${asked === 1 && again === 0 ? "PASS" : "FAIL"} ${tag} first-visit notifications question — shown ${asked}, after reload ${again}`);
    await fresh.close();
  }
}
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed.`);
if (errors.length) { console.log(`${errors.length} page error(s):`); for (const e of [...new Set(errors)].slice(0, 12)) console.log("  " + e); } else console.log("No page errors.");
process.exit(bad.length || errors.length ? 1 : 0);
