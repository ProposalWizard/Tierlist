import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type()==='error' && !/CERT|404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.goto('http://localhost:3000/star-gallery-dev', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2000);
// tile 1 = 11-a-side
await p.locator('button').filter({ hasText: '11-a-side' }).first().click();
await p.waitForTimeout(1200);
// first thumbnail in the grid
await p.locator('button[style*="aspect-ratio"]').first().click().catch(async()=>{
  const bs = await p.$$('button'); await bs[4].click();
});
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-gallery-version.png' });
console.log('BTNS', await p.$$eval('button', bs => bs.map(b=>b.innerText.trim()).filter(Boolean).slice(0,20)));
await p.getByRole('button', { name: 'Simulate', exact: true }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/claude-0/shots/hl-gallery-sim-next.png' });
console.log('AFTER', await p.$$eval('button', bs => bs.map(b=>b.innerText.trim()).filter(Boolean).slice(0,20)));
// press arrow key 5 times
for (let i=0;i<5;i++){ await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); }
await p.screenshot({ path: '/tmp/claude-0/shots/hl-gallery-sim-after-keys.png' });
console.log(errs.length ? 'ERRORS ' + errs.slice(0,4).join(' | ') : 'clean');
await b.close();
