// A tiny static file server for the look check (127.0.0.1 only).
//   serve(dir, port) → { url, close() }
// "/foo" also tries "/foo.html" and "/foo/index.html" (the packed app's Next export);
// any other path with no file extension gets the root index.html (KIB Next's single page).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
  ".mp4": "video/mp4", ".webm": "video/webm", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".txt": "text/plain",
  ".ktx2": "image/ktx2", ".hdr": "application/octet-stream",
};

export function serve(dir, port = 0) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const tries = [p, p + ".html", path.posix.join(p, "index.html")];
    if (!path.extname(p)) tries.push("/index.html");
    for (const t of tries) {
      const f = path.join(root, t);
      if (!f.startsWith(root)) break;
      try {
        if (fs.statSync(f).isFile()) {
          res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
          fs.createReadStream(f).pipe(res);
          return;
        }
      } catch { /* try the next */ }
    }
    res.writeHead(404); res.end("not found");
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve(process.argv[2], Number(process.argv[3] || 0));
  console.log(s.url);
}
