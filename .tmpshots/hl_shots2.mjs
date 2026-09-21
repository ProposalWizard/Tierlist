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
const next = async () => { await p.getByRole('button', { name: /^Next/ }).click(); await p.waitForTimeout(70); };
const flag = async () => { await p.getByRole('button', { name: 'Flag this one' }).click(); await p.waitForTimeout(120); };

for (let i = 0; i < 3; i++) { await flag(); for (let j = 0; j < 5; j++) await next(); }
let found = null;
for (let i = 0; i < 300 && !found; i++) {
  const r = await read();
  if (Number(r.hlFaults) > 0) found = r; else await next();
}
if (found) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/shots/hl-fault.png' });
  console.log('FAULT', found.hlKind, found.hlSeed, 'h', await H());
  await flag();
} else console.log('no fault in 300');
await next(); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-highlight.png' });
console.log('run h', await H());

await p.getByRole('button', { name: 'Choose highlights' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-kinds-all.png' });
console.log('kinds h', await H());
for (const k of ['penalty','corner','free kick','buildup','midfield pass']) {
  await p.getByRole('button', { name: k, exact: true }).click().catch(()=>console.log('miss',k));
  await p.waitForTimeout(90);
}
await p.screenshot({ path: '/tmp/claude-0/shots/hl-kinds-some-off.png' });
await p.getByRole('button', { name: 'Watch these' }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-after-toggle.png' });
console.log('after-toggle kind', (await read()).hlKind);

await p.getByRole('button', { name: 'Flagged list' }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-flagged.png' });
console.log('flags h', await H());
console.log(errs.length ? 'ERRORS ' + errs.slice(0,5).join(' | ') : 'clean');
await b.close();
