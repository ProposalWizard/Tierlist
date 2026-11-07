import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright'); import fs from 'fs';
const ts = process.argv.slice(2); const plan = JSON.parse(fs.readFileSync('plan.json'));
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 540, height: 960 } }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8766/avo.html'); await p.waitForFunction(() => window.ready); await p.evaluate(() => document.fonts.ready);
await p.evaluate(pl => window.setPlan(pl), plan);
for (const t of ts) { const r = await p.evaluate(t => window.frame(+t), t); await p.screenshot({ path: `s_${t}.jpg`, quality: 85 }); console.log(t, JSON.stringify(r)); }
await b.close();
