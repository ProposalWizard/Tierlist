// node scripts/film/selftest.mjs — films a moving square for 2.5 s and
// checks the MP4 comes out 720 px wide. Run it once in a new container.
import { phone, startRec, stopRec, shot } from "./rec.mjs";
import os from "node:os";
const out = os.tmpdir() + "/film-selftest";
const { browser, page } = await phone();
await page.setContent(`<body style="margin:0;background:#123;color:#fff;font:20px sans-serif"><h1 id=h>0</h1><div id=b style="width:60px;height:60px;background:#e44;position:absolute;top:300px"></div><script>let t=0;setInterval(()=>{t++;h.textContent=t;b.style.left=(t*7%330)+'px'},33)</script></body>`);
const r = await startRec(page);
await page.touchscreen.tap(200, 500);
await page.waitForTimeout(2500);
console.log(await stopRec(r, out + ".mp4"), await shot(page, out + ".jpg"));
await browser.close();
