// Bundles the harness pages into scripts/perf3d/www/ with esbuild (fetched by
// npx on first use — not a project dependency). Usage: node scripts/perf3d/build.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const www = here + "www/";
fs.mkdirSync(www, { recursive: true });
const html = (js) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}#stage{position:fixed;inset:0}</style></head><body><div id="stage"></div><script src="${js}"></script></body></html>\n`;
for (const [src, out, page] of [["entry.ts", "bundle.js", "index.html"], ["mini-page.ts", "mini.js", "mini.html"], ["mini-worker.ts", "mini-worker.js", null], ["hop-page.ts", "hop.js", "hop.html"]]) {
  execFileSync("npx", ["--yes", "esbuild@0.23", here + src, "--bundle", "--format=iife", "--target=es2020", "--minify",
    `--outfile=${www}${out}`, "--define:process.env.NODE_ENV=\"production\"", "--log-level=warning"], { stdio: "inherit" });
  if (page) fs.writeFileSync(www + page, html(out));
  console.log(`www/${out}`);
}
