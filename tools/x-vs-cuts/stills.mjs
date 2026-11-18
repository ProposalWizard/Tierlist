import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const [n, ...ts] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CON', m.text()) });
await p.goto('http://localhost:8765/scene.html'); await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
await p.evaluate(() => document.fonts.ready);
const info = await p.evaluate(n => window.setRound(+n), n); console.log(JSON.stringify(info));
for (const t of ts) { const t0 = Date.now(); const r = await p.evaluate(t => window.frame(+t), t); await p.screenshot({ path: `still_${n}_${t}.jpg`, quality: 85 }); console.log(t, JSON.stringify(r), (Date.now() - t0) + 'ms'); }
await b.close();
