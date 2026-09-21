import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type()==='error' && !/CERT|404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.goto('http://localhost:3000/star-highlights-dev', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2000);

const read = () => p.evaluate(() => {
  const m = document.querySelector('main');
  return {
    kind: m.dataset.hlKind, seed: m.dataset.hlSeed, plan: m.dataset.hlPlan,
    pic: m.dataset.hlPicture, faults: m.dataset.hlFaults, count: m.dataset.hlCount,
  };
});

const rows = [read0()]; async function read0(){}
const seen = [];
seen.push(await read());
for (let i = 1; i < 100; i++) {
  await p.getByRole('button', { name: /^Next/ }).click();
  await p.waitForTimeout(60);
  seen.push(await read());
}
const kinds = {}; let immediate = 0, faulty = 0;
const pics = new Set(), specs = new Set();
seen.forEach((s, i) => {
  kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  pics.add(s.pic); specs.add(s.kind + '|' + s.seed + '|' + s.plan);
  if (i > 0 && s.pic === seen[i-1].pic) immediate++;
  if (Number(s.faults) > 0) faulty++;
});
console.log(JSON.stringify({
  presses: seen.length,
  distinctPictures: pics.size,
  distinctSpecs: specs.size,
  immediateRepeats: immediate,
  withFaults: faulty,
  kinds: Object.fromEntries(Object.entries(kinds).sort((a,b)=>b[1]-a[1])),
  errors: errs.slice(0,5),
}, null, 1));
await b.close();
