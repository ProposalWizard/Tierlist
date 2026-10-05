// Static server for the harness: scripts/perf3d/www/ at /, and the game's own
// public/star/ at /star/ (the real GLBs). Port 3502. node scripts/perf3d/serve.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const here = new URL(".", import.meta.url).pathname;
const www = path.join(here, "www");
const pub = path.join(here, "../../public");
const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ktx2": "image/ktx2" };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = p.startsWith("/star/") || p.startsWith("/shop/") ? path.join(pub, p) : path.join(www, p === "/" ? "index.html" : p);
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "content-length": st.size, "cache-control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
}).listen(3502, () => console.log("perf3d harness on http://localhost:3502"));
