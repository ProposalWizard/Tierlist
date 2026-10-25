import { chromium } from "playwright";
const sets = { none: [], angle_swift: ["--use-gl=angle", "--use-angle=swiftshader"], unsafe: ["--enable-unsafe-swiftshader"], all: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"], egl: ["--use-gl=egl", "--ignore-gpu-blocklist"] };
for (const [n, a] of Object.entries(sets)) {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-dev-shm-usage", ...a] });
  const p = await b.newPage();
  const r = await p.evaluate(() => {
    const c = document.createElement("canvas"); const g = c.getContext("webgl2") || c.getContext("webgl");
    if (!g) return "no webgl";
    const e = g.getExtension("WEBGL_debug_renderer_info");
    const t0 = performance.now(); for (let i = 0; i < 200; i++) { g.clearColor(i % 2, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); } g.finish();
    return (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?") + " | 200 clears " + (performance.now() - t0).toFixed(0) + "ms";
  });
  console.log(n, "=>", r); await b.close();
}
