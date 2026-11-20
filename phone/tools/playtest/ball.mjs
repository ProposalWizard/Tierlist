/** Where the ball is on screen: a small round light-grey blob (the matches move it anywhere). Not in the bottom 8%: the caption's white letters are ball-sized blobs. */
export async function findBall(p, loose = false) {
  const b64 = (await p.screenshot()).toString("base64");
  const r = await p.evaluate(async ([b64, loose]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const light = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 140 && mx - mn < 40; };
    const seen = new Uint8Array(W * H); const out = [];
    for (let y = Math.floor(H * 0.12); y < H * 0.92; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x; if (seen[k] || !light(k * 4)) continue;
      const st = [k]; seen[k] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
      while (st.length) {
        const q = st.pop(); n++; const qx = q % W, qy = (q / W) | 0;
        x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nk = ny * W + nx; if (!seen[nk] && light(nk * 4)) { seen[nk] = 1; st.push(nk); }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w >= (loose ? 5 : 6) && h >= (loose ? 5 : 6) && w <= 20 && h <= 20 && Math.abs(w - h) <= (loose ? 3 : 2) && n >= (loose ? 0.25 : 0.35) * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, n });
    }
    if (out.length || !loose) return out.sort((a, b) => b.n - a.n)[0] ?? null;
    // A ball lying on a painted line joins the line's blob. Grey-white pixels whose
    // whole 3×3 is grey-white: thin lines melt away, the ball's middle stays.
    const grey = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 90 && mx - mn < 40; };
    const core = new Uint8Array(W * H);
    for (let y = Math.floor(H * 0.12); y < H * 0.92; y++) for (let x = 1; x < W - 1; x++) {
      let ok = 1;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!grey(((y + dy) * W + x + dx) * 4)) ok = 0;
      core[y * W + x] = ok;
    }
    const seen2 = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) {
      if (!core[k] || seen2[k]) continue;
      const st = [k]; seen2[k] = 1; let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
      while (st.length) {
        const q = st.pop(); n++; const qx = q % W, qy = (q / W) | 0;
        x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = (qy + dy) * W + qx + dx; if (nk >= 0 && nk < W * H && core[nk] && !seen2[nk]) { seen2[nk] = 1; st.push(nk); }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w >= 2 && h >= 2 && w <= 12 && h <= 12 && Math.abs(w - h) <= 3 && n >= 0.4 * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, n });
    }
    return out.sort((a, b) => b.n - a.n)[0] ?? null;
  }, [b64, loose]);
  return r;
}
