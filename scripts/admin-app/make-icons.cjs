/**
 * scripts/admin-app/make-icons.cjs — draws the admin app's home-screen icon
 * (Harry picked option C, 19 Oct 2026: the game's ball + a green cog) into
 * public/admin/app-icon-*.png. Run: node scripts/admin-app/make-icons.cjs
 * Needs Playwright's Chromium (preinstalled in the cloud sessions).
 */
const path = require("path");
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const root = path.join(__dirname, "..", "..");
const ball = "data:image/png;base64," + require("fs").readFileSync(path.join(root, "public/star/app-icon-512.png")).toString("base64");
// The game icon's ball: centre 256,256, radius ~150 px of 512.
const page = (scale) => `<html><body style="margin:0"><div style="width:512px;height:512px;position:relative;background:#070b09;overflow:hidden">
<div style="position:absolute;left:50%;top:50%;width:${512 * scale}px;height:${512 * scale}px;transform:translate(-50%,-50%)">
 <div style="position:absolute;left:50%;top:50%;width:${360 * scale * 1.0}px;height:${360 * scale}px;transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;box-shadow:0 0 0 ${10 * scale}px #34e08b33">
  <img src="${ball}" style="position:absolute;left:50%;top:50%;width:${614 * scale}px;transform:translate(-50%,-50%)">
 </div>
 <svg style="position:absolute;right:${20 * scale}px;bottom:${20 * scale}px" width="${200 * scale}" height="${200 * scale}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="#34e08b" stroke="#070b09" stroke-width="7"/>
  <path d="M50 22l5 9 10-2 2 10 9 5-5 9 5 9-9 5-2 10-10-2-5 9-5-9-10 2-2-10-9-5 5-9-5-9 9-5 2-10 10 2z" fill="#070b09"/>
  <circle cx="50" cy="50" r="10" fill="#34e08b"/></svg>
</div></div></body></html>`;
(async () => {
  const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => pw.chromium.launch());
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  const out = (n) => path.join(root, "public/admin", n);
  for (const [file, scale, size] of [["app-icon-512.png", 1, 512], ["app-icon-192.png", 1, 192], ["app-icon-180.png", 1, 180], ["app-icon-maskable-512.png", 0.72, 512]]) {
    await p.setContent(page(scale)); await p.waitForLoadState("load"); await p.waitForTimeout(150);
    const buf = await p.screenshot();
    if (size === 512) require("fs").writeFileSync(out(file), buf);
    else { const q = await b.newPage({ viewport: { width: size, height: size } });
      await q.setContent(`<body style="margin:0"><img src="data:image/png;base64,${buf.toString("base64")}" style="width:${size}px;height:${size}px">`);
      require("fs").writeFileSync(out(file), await q.screenshot()); await q.close(); }
    console.log("wrote public/admin/" + file);
  }
  await b.close();
})();
