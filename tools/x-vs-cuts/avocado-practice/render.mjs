import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright'); import fs from 'fs';
const [from, to] = process.argv.slice(2).map(Number); fs.mkdirSync('frames', { recursive: true });
const plan = JSON.parse(fs.readFileSync('plan.json'));
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
async function page() { const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8766/avo.html'); await p.waitForFunction(() => window.ready); await p.evaluate(() => document.fonts.ready); await p.evaluate(pl => window.setPlan(pl), plan); return p; }
let p = await page(); let done = 0;
for (let f = from; f < to; f++) {
  if (done > 0 && done % 200 === 0) { await p.close(); p = await page(); }
  const out = `frames/f${String(f).padStart(5, '0')}.jpg`;
  if (!fs.existsSync(out)) { await p.evaluate(t => window.frame(t), f / 30); await p.screenshot({ path: out, quality: 92 }); done++; }
  if (f % 30 === 0) console.log(f, '/', to);
}
console.log('DONE', from, to); await b.close();
