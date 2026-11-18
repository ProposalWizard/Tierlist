import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const n = +process.argv[2]; const dir = `frames${n}`; fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
async function page() { const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/scene.html'); await p.waitForFunction(() => window.ready); await p.evaluate(() => document.fonts.ready);
  const info = await p.evaluate(n => window.setRound(n), n); return [p, info]; }
let [p, info] = await page(); const N = Math.ceil(info.T.end * 30);
fs.writeFileSync(`events${n}.json`, JSON.stringify(await p.evaluate(() => window.events())));
for (let f = 0; f < N; f++) {
  if (f > 0 && f % 250 === 0) { await p.close(); [p] = await page(); }
  const out = `${dir}/f${String(f).padStart(5, '0')}.jpg`;
  if (!fs.existsSync(out)) { await p.evaluate(t => window.frame(t), f / 30); await p.screenshot({ path: out, quality: 92 }); }
  if (f % 30 === 0) console.log(n, f, '/', N);
}
console.log('DONE', n, N); await b.close();
