// Static server for the harness: scripts/perf3d/www/ at /, and the game's own
// public/star/ at /star/ (the real GLBs). Port 3502. node scripts/perf3d/serve.mjs
// --cache=vercel: answer /star files the way the live site does (Vercel's
// default for public files: max-age=0, must-revalidate + an ETag, so a second
// visit asks again and gets a 304), and a file asked for with ?v= the way
// next.config.mjs now serves it (a year, immutable). Default: no-store.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const here = new URL(".", import.meta.url).pathname;
const www = path.join(here, "www");
const pub = path.join(here, "../../public");
const port = +(process.argv.find((a) => a.startsWith("--port="))?.slice(7) ?? 3502);
const vercel = process.argv.includes("--cache=vercel");
const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ktx2": "image/ktx2", ".hdr": "application/octet-stream" };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname);
  const asset = p.startsWith("/star/") || p.startsWith("/shop/");
  const f = asset ? path.join(pub, p) : path.join(www, p === "/" ? "index.html" : p);
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    const h = { "content-type": types[path.extname(f)] || "application/octet-stream", "content-length": st.size, "cache-control": "no-store" };
    if (vercel && asset) {
      const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
      h["etag"] = etag;
      h["cache-control"] = u.searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate";
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, { etag, "cache-control": h["cache-control"] }); return res.end(); }
    }
    res.writeHead(200, h);
    fs.createReadStream(f).pipe(res);
  });
}).listen(port, () => console.log(`perf3d harness on http://localhost:${port}${vercel ? " (live-site cache headers)" : ""}`));
