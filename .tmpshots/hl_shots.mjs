import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type()==='error' && !/CERT|404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
const H = async () => p.evaluate(() => document.documentElement.scrollHeight);
await p.goto('http://localhost:3000/star-highlights-dev', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(1800);
const read = () => p.evaluate(() => ({ ...document.querySelector('main').dataset }));

// ── flag three, at spaced-out points ──
for (let i = 0; i < 3; i++) {
  await p.getByRole('button', { name: 'Flag this one' }).click();
  await p.waitForTimeout(120);
  for (let j = 0; j < 4; j++) { await p.getByRole('button', { name: /^Next/ }).click(); await p.waitForTimeout(80); }
}
// ── hunt a faulty one ──
let found = null;
for (let i = 0; i < 400 && !found; i++) {
  const r = await read();
  if (Number(r.hlFaults) > 0) { found = r; break; }
  await p.getByRole('button', { name: /^Next/ }).click();
  await p.waitForTimeout(45);
}
if (found) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/shots/hl-fault.png' });
  console.log('FAULT SHOT', found.hlKind, found.hlSeed, 'height', await H());
  // flag the faulty one too so the list shows a red line
  await p.getByRole('button', { name: 'Flag this one' }).click();
  await p.waitForTimeout(150);
} else console.log('no fault found in 400');

// a clean highlight, flagged state visible
await p.getByRole('button', { name: /^Next/ }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-highlight.png' });
console.log('run height', await H());

// ── toggles ──
await p.locator('button').filter({ hasText: /^\d+\/13$/ }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-kinds-all.png' });
console.log('kinds height', await H());
// turn a few off
for (const k of ['Penalty','Corner','Free Kick','Buildup','Midfield Pass']) {
  await p.getByRole('button', { name: k, exact: true }).click().catch(e=>console.log('miss',k));
  await p.waitForTimeout(80);
}
await p.screenshot({ path: '/tmp/claude-0/shots/hl-kinds-some-off.png' });
await p.getByRole('button', { name: 'Watch these' }).click();
await p.waitForTimeout(600);

// ── flagged list ──
await p.locator('button').filter({ hasText: /⚑/ }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-flagged.png' });
console.log('flags height', await H());
console.log(errs.length ? 'ERRORS ' + errs.slice(0,5).join(' | ') : 'clean');
await b.close();
