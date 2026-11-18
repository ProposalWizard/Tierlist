"""
tools/preview-film/post.py — clean one rendered shot and lay the sharp game screen on the phone.

    python post.py <shot dir with f_0001.exr.. + corners.json> <footage dir with s_0001.png..> <out dir>
        [--oidn /path/to/oidnDenoise] [--fade-from 48 --fade-to 60]

Per frame: take the grain off (Intel Open Image Denoise, free), turn the linear
picture into a normal one, enlarge to 1080x1920, then warp the game's own frame
onto the four corners of the phone screen that scene.py wrote down. The game on
the phone is therefore as sharp as the game itself, whatever the render size.
--fade-from/--fade-to: frames over which the laid-on screen fades away (the
last shot pulls focus off the phone, so the blurred rendered screen takes over).
"""
import os, sys, json, subprocess, tempfile
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2, numpy as np, OpenEXR  # pip install opencv-python-headless OpenEXR

a = sys.argv[1:]
def val(flag, d): return a[a.index(flag) + 1] if flag in a else d
SHOT, FOOT, OUT = a[0], a[1], a[2]
OIDN = val("--oidn", os.environ.get("OIDN", "oidnDenoise"))
FADE = (int(val("--fade-from", 0)), int(val("--fade-to", 0)))
OW, OH = 1080, 1920
os.makedirs(OUT, exist_ok=True)
corners = json.load(open(os.path.join(SHOT, "corners.json")))
foot = sorted(f for f in os.listdir(FOOT) if f.endswith((".png", ".jpg")))

def write_pfm(path, img):  # img: float32 RGB, top row first
    with open(path, "wb") as f:
        f.write(b"PF\n%d %d\n-1.0\n" % (img.shape[1], img.shape[0])); f.write(np.flipud(img).astype("<f4").tobytes())
def read_pfm(path):
    with open(path, "rb") as f:
        assert f.readline().strip() == b"PF"; w, h = map(int, f.readline().split()); f.readline()
        return np.flipud(np.frombuffer(f.read(), "<f4").reshape(h, w, 3))
def srgb(x):
    x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def rounded_mask(w, h, r):
    m = np.zeros((h, w), np.float32); cv2.rectangle(m, (r, 0), (w - r, h), 1, -1); cv2.rectangle(m, (0, r), (w, h - r), 1, -1)
    for cx, cy in ((r, r), (w - r, r), (r, h - r), (w - r, h - r)): cv2.circle(m, (cx, cy), r, 1, -1, cv2.LINE_AA)
    return m

tmp = tempfile.mkdtemp()
env = dict(os.environ); env["LD_LIBRARY_PATH"] = os.path.join(os.path.dirname(os.path.dirname(OIDN)), "lib") + ":" + env.get("LD_LIBRARY_PATH", "")
frames = sorted(f for f in os.listdir(SHOT) if f.startswith("f_") and f.endswith(".exr"))
for name in frames:
    n = int(name[2:6]); dst = os.path.join(OUT, f"c_{n:04d}.png")
    if os.path.exists(dst): continue
    try:
        with OpenEXR.File(os.path.join(SHOT, name)) as ef:
            ch = ef.channels()
            rgb = (ch["RGBA"].pixels if "RGBA" in ch else ch["RGB"].pixels)[:, :, :3].astype(np.float32)
    except Exception:
        continue  # still being written
    write_pfm(f"{tmp}/in.pfm", rgb)
    subprocess.run([OIDN, "--hdr", f"{tmp}/in.pfm", "-o", f"{tmp}/out.pfm"], env=env, check=True, stdout=subprocess.DEVNULL)
    img = srgb(read_pfm(f"{tmp}/out.pfm")).astype(np.float32)
    img = cv2.resize(img, (OW, OH), interpolation=cv2.INTER_LANCZOS4)
    img = np.clip(img, 0, 1)
    # the game's own frame, on the phone
    k = 1.0
    if FADE[1] > FADE[0]: k = float(np.clip(1 - (n - FADE[0]) / (FADE[1] - FADE[0]), 0, 1))
    if k > 0 and foot:
        src = cv2.imread(os.path.join(FOOT, foot[min(n - 1, len(foot) - 1)])).astype(np.float32) / 255
        src = cv2.cvtColor(src, cv2.COLOR_BGR2RGB)
        c = corners[str(n)]
        quad = np.float32([[c["01"][0] * OW, c["01"][1] * OH], [c["11"][0] * OW, c["11"][1] * OH],
                           [c["10"][0] * OW, c["10"][1] * OH], [c["00"][0] * OW, c["00"][1] * OH]])  # TL TR BR BL
        qw = max(np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[3]))
        sw = int(min(src.shape[1], max(64, qw * 1.5))); sh = int(sw * src.shape[0] / src.shape[1])
        src = cv2.resize(src, (sw, sh), interpolation=cv2.INTER_AREA)
        mask = rounded_mask(sw, sh, int(sw * 0.105))
        M = cv2.getPerspectiveTransform(np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]]), quad)
        wsrc = cv2.warpPerspective(src, M, (OW, OH), flags=cv2.INTER_LINEAR)
        wm = cv2.warpPerspective(mask, M, (OW, OH), flags=cv2.INTER_LINEAR)[..., None] * k
        # keep a little of the rendered glass on top (its reflections), so it sits in the room
        img = img * (1 - wm) + (wsrc * 0.93 + img * 0.07) * wm
    cv2.imwrite(dst, cv2.cvtColor((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), cv2.COLOR_RGB2BGR))
    print("clean", n, flush=True)
