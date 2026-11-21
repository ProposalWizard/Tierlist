// body run in drive.mjs: compares text leaves in both apps. returns report string. TOL defined before.
const grab = () => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const e = n.parentElement; if (!e) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const r = rg.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    let hid = false, a = e, clip = null;
    for (let k = 0; a && k < 30; k++, a = a.parentElement) { const s = getComputedStyle(a); if (+s.opacity < 0.05 || s.visibility === "hidden" || s.display === "none") { hid = true; break; }
      if (!clip && (s.overflow !== "visible" || s.overflowX !== "visible")) { const b = a.getBoundingClientRect(); if (r.right > b.right + 1.5 || r.left < b.left - 1.5 || r.bottom > b.bottom + 6 || r.top < b.top - 6) { if (!(s.overflowY === "auto" || s.overflowY === "scroll" || s.overflowX === "auto" || s.overflowX === "scroll")) clip = `clipped by box ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; } }
    }
    if (hid) continue;
    const lines = rg.getClientRects().length;
    const ell = (cs.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) ? "ELLIPSIS" : "";
    out.push({ t, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, col: cs.color, ff: cs.fontFamily.split(",")[0].replace(/"/g, "").slice(0, 14), lines, clip, ell, off: (r.right > vw + 1 || r.left < -1) ? "OFFSCREEN-X" : "", tt: cs.textTransform });
  }
  return out;
};
const [a, b] = await Promise.all([P.evaluate(grab), N.evaluate(grab)]);
const key = (o) => o.t.toLowerCase();
const rep = [];
const used = new Set();
const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
for (const p of a) {
  let best = -1, bd = 1e9;
  b.forEach((q, i) => { if (used.has(i) || key(q) !== key(p)) return; const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y); if (d < bd) { bd = d; best = i; } });
  if (best < 0) { rep.push(`ONLY PACKED  "${p.t.slice(0, 50)}" @${p.x},${p.y} ${p.w}x${p.h} fs${p.fs} ${p.ff} w${p.fw} ${p.col}${p.clip ? " (clipped)" : ""}`); continue; }
  used.add(best); const q = b[best];
  const d = [];
  if (Math.abs(q.x - p.x) > TOL || Math.abs(q.y - p.y) > TOL) d.push(`pos ${p.x},${p.y}→${q.x},${q.y}`);
  if (Math.abs(q.w - p.w) > Math.max(TOL, p.w * 0.04) ) d.push(`w ${p.w}→${q.w}`);
  if (Math.abs(q.fs - p.fs) > 0.6) d.push(`fs ${p.fs}→${q.fs}`);
  if (p.lines !== q.lines) d.push(`lines ${p.lines}→${q.lines}`);
  const c1 = rgb(p.col), c2 = rgb(q.col);
  if (Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]) > 30 || Math.abs((c1[3] ?? 1) - (c2[3] ?? 1)) > 0.15) d.push(`col ${p.col}→${q.col}`);
  if ((+p.fw >= 600) !== (+q.fw >= 600)) d.push(`weight ${p.fw}→${q.fw}`);
  if (/anton/i.test(p.ff) !== /anton/i.test(q.ff)) d.push(`font ${p.ff}→${q.ff}`);
  if (d.length) rep.push(`DIFF "${p.t.slice(0, 40)}": ${d.join("; ")}`);
}
b.forEach((q, i) => { if (!used.has(i)) rep.push(`ONLY NEXT    "${q.t.slice(0, 50)}" @${q.x},${q.y} ${q.w}x${q.h} fs${q.fs} w${q.fw} ${q.col}`); });
for (const q of b) { if (q.clip) rep.push(`NEXT CLIP "${q.t.slice(0, 40)}" @${q.x},${q.y} ${q.w}x${q.h}: ${q.clip}`); if (q.ell) rep.push(`NEXT ELLIPSIS "${q.t.slice(0, 40)}"`); if (q.off) rep.push(`NEXT OFFSCREEN "${q.t.slice(0, 40)}" ${q.x}..${q.x + q.w}`); }
return rep.join("\n") || "no differences";
