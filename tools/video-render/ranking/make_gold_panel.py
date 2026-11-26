"""The gold Ballon d'Or panel for the ranking video (Mikey, 26 Nov 2026): a polished golden football seen close up, real
football seams (a truncated icosahedron: 12 pentagons, 20 hexagons), lit from the top left, fading to dark grey at the bottom,
like the TikTok's. One still 1080x1920 picture; the video clips it to the curved edge and never moves it.
  python3 make_gold_panel.py OUT.png [variant 0-5]"""
import sys, math, numpy as np, cv2
W, H = 1080, 1920
phi = (1 + 5 ** .5) / 2
def verts():
    base = [(0, 1, 3 * phi), (1, 2 + phi, 2 * phi), (phi, 2, 2 * phi + 1)]; s = set()
    for b in base:
        for sx in (1, -1):
            for sy in (1, -1):
                for sz in (1, -1):
                    x, y, z = b[0] * sx, b[1] * sy, b[2] * sz
                    for p in ((x, y, z), (y, z, x), (z, x, y)): s.add(tuple(round(c, 6) for c in p))
    v = np.array(sorted(s)); return v / np.linalg.norm(v, axis=1)[:, None]
def edges(v):
    d = np.linalg.norm(v[:, None] - v[None], axis=2); m = d[d > 1e-6].min(); return [(i, j) for i in range(len(v)) for j in range(i + 1, len(v)) if abs(d[i, j] - m) < 0.02 * m]
def rot(ax, ay, az):
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]); return Rz @ Ry @ Rx
VARIANTS = [(0.25, 0.35, 0.1), (0.9, 0.2, 0.4), (0.5, -0.4, 0.8), (1.2, 0.6, 0.0), (-0.3, 0.9, 0.3), (0.7, 1.5, 0.2)]
def make(variant=0, R=1180, cx=430, cy=980):
    v = verts(); E = edges(v); A = rot(*VARIANTS[variant]); vr = v @ A.T
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); nx = (xx - cx) / R; ny = -(yy - cy) / R; r2 = nx * nx + ny * ny; nz = np.sqrt(np.clip(1 - r2, 0, 1))
    L = np.array([-0.5, 0.62, 0.6]); L /= np.linalg.norm(L); diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    h = (L + np.array([0, 0, 1])); h /= np.linalg.norm(h); spec = np.clip(nx * h[0] + ny * h[1] + nz * h[2], 0, 1) ** 38
    dark, mid, light = np.array([70, 46, 8.]), np.array([205, 158, 52.]), np.array([250, 226, 140.])
    t = np.clip(0.14 + 0.78 * diff, 0, 1)[..., None]; col = np.where(t < .55, dark + (mid - dark) * (t / .55), mid + (light - mid) * ((t - .55) / .45))
    col = col * (0.62 + 0.38 * nz[..., None]) + np.array([255, 246, 205.]) * (0.22 * spec)[..., None]
    # the seams: great-circle arcs between each pair of joined corners, drawn as a groove with a bright lip on the lit side
    seam = np.zeros((H, W), np.float32)
    for i, j in E:
        a, b = vr[i], vr[j]; om = math.acos(np.clip(a @ b, -1, 1)); pts = []
        for k in np.linspace(0, 1, 40):
            p = (math.sin((1 - k) * om) * a + math.sin(k * om) * b) / math.sin(om)
            if p[2] > 0.02: pts.append((cx + R * p[0], cy - R * p[1]))
        if len(pts) > 1: cv2.polylines(seam, [np.array(pts, np.int32).reshape(-1, 1, 2)], False, 1.0, 9, cv2.LINE_AA)
    groove = cv2.GaussianBlur(seam, (0, 0), 4.2); lip = np.clip(np.roll(np.roll(groove, -4, 1), -4, 0) - groove, 0, 1); shade = np.clip(groove - np.roll(np.roll(groove, -4, 1), -4, 0), 0, 1)
    col = col * (1 - 0.42 * groove[..., None]) * (1 - 0.18 * shade[..., None]) + np.array([255, 238, 170.]) * (0.45 * lip)[..., None]
    col = np.where((r2 < 1)[..., None], col, dark * 0.5)
    # fade to dark grey at the bottom (their panel does), a little shade at the very top
    fy = np.clip((yy - 1480) / 440, 0, 1)[..., None]; col = col * (1 - 0.9 * fy) + np.array([66, 66, 70.]) * (0.9 * fy)
    col = col * (1 - 0.18 * np.clip((140 - yy) / 140, 0, 1)[..., None])
    return np.clip(col, 0, 255).astype(np.uint8)[..., ::-1]
if __name__ == "__main__":
    out = sys.argv[1]; var = int(sys.argv[2]) if len(sys.argv) > 2 else 0; cv2.imwrite(out, make(var), [cv2.IMWRITE_PNG_COMPRESSION, 6]); print("wrote", out)
