import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000/star-gallery-dev', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-before-gallery-home.png' });
// open 11-a-side
const tiles = await p.$$('button, [role=button], div[style*="cursor: pointer"]');
console.log('tiles', tiles.length);
await p.getByText('11-a-side', { exact: false }).first().click().catch(e=>console.log('click1', e.message));
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-before-gallery-kinds.png' });
console.log(await p.evaluate(() => document.body.innerText.slice(0, 600)));
console.log('errs', errs.slice(0,3));
await b.close();
