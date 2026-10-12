import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const WT = process.cwd(); // run from the repo root
const HERE = path.dirname(new URL(import.meta.url).pathname) + "/";
const map = [["/three/", WT + "/node_modules/three/"], ["/star/", WT + "/public/star/"], ["/shop/", WT + "/public/shop/"], ["/", HERE]];
const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ktx2": "image/ktx2" };
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  for (const [p, d] of map) if (u.startsWith(p)) {
    const f = d + u.slice(p.length);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); return; }
  }
  r.writeHead(404); r.end();
}).listen(+process.env.PORT || 8765, () => console.log("up"));
