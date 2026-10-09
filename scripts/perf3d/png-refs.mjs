// Which PNGs under public/ the code uses, and where (speed job B, 9 Oct 2026).
//   node scripts/perf3d/png-refs.mjs [minKB=100]
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const min = +(process.argv[2] ?? 100) * 1024;
const pngs = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.png$/i.test(e.name) && fs.statSync(f).size >= min) pngs.push(f); } };
walk(path.join(root, "public"));
const src = [];
const walkSrc = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".next", ".git", "public", "tools", "patch-notes", "playtest-notes"].includes(e.name)) continue; const f = path.join(d, e.name); if (e.isDirectory()) walkSrc(f); else if (/\.(tsx?|mjs|js|css|json|html)$/.test(e.name)) src.push([f, fs.readFileSync(f, "utf8")]); } };
walkSrc(root);
for (const p of pngs.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)) {
  const rel = "/" + path.relative(path.join(root, "public"), p).split(path.sep).join("/");
  const forms = [rel, rel.replace(/ /g, "%20"), encodeURI(rel), path.basename(rel), path.basename(rel).replace(/\.png$/i, "")];
  const hits = src.filter(([, t]) => forms.slice(0, 3).some((f) => t.includes(f)) || t.includes(path.basename(rel))).map(([f]) => path.relative(root, f));
  console.log(`${(fs.statSync(p).size / 1024) | 0} KB\t${rel}\t${hits.length ? hits.slice(0, 4).join(", ") + (hits.length > 4 ? ` +${hits.length - 4}` : "") : "UNUSED"}`);
}
