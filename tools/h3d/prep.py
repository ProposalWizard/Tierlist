"""Make the H (Console Realism) assets: small HDR env maps, sky pictures,
grass detail maps, the crowd sheet and the LED board strip."""
# usage: python3 tools/h3d/prep.py <raw assets dir> <unzipped Grass004 dir> public/star/h3d/
#   raw assets: the four Poly Haven 2k .hdr files, stand-neutral-cheer.png, led-boards.png
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hdr import read_hdr, write_hdr, down
from PIL import Image, ImageFilter
import numpy as np

SRC = os.path.join(sys.argv[1], '')
GR = os.path.join(sys.argv[2], '')
OUT = os.path.join(sys.argv[3], '')
os.makedirs(OUT, exist_ok=True)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


meta = {}
for tod, name, clamp in [('day', 'kloppenheim_06_puresky', 6.0), ('golden', 'belfast_sunset_puresky', 8.0), ('night', 'dikhololo_night', 2.0)]:
    im = read_hdr(SRC + name + '_2k.hdr')
    # env: 256 x 128, the sun hot spot clamped (the scene's own sun light does that job)
    env = down(im, 8)
    env = np.minimum(env, clamp)
    write_hdr(OUT + f'env-{tod}.hdr', env.astype(np.float32))
    # sky: the top 62.5 % (zenith to 22.5 deg below the horizon), 2048 x 640, display-ready linear * k
    sky = im[:640]
    k = 1.0 / max(1e-4, float(np.percentile(sky, 99.5)))
    meta[tod] = {'skyScale': 1.0 / k}
    rgb = (srgb(sky * k) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(rgb).save(OUT + f'sky-{tod}.webp', quality=78, method=6)
    print(tod, 'k', k)

# grass detail: colour as brightness detail (hue comes from the pitch palette), 1024
col = Image.open(GR + 'Grass004_2K-JPG_Color.jpg').convert('RGB').resize((512, 512), Image.LANCZOS)
a = np.asarray(col).astype(np.float32) / 255
# keep a little hue variation (dry blades), normalise brightness round 0.5
lum = a.mean(axis=2, keepdims=True)
a = a / max(1e-3, float(lum.mean())) * 0.5
Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(OUT + 'grass-col.webp', quality=80, method=6)
nrm = Image.open(GR + 'Grass004_2K-JPG_NormalGL.jpg').convert('RGB').resize((512, 512), Image.LANCZOS)
nrm.save(OUT + 'grass-nrm.webp', quality=82, method=6)
# R = ambient occlusion, G = roughness, B = height
ao = Image.open(GR + 'Grass004_2K-JPG_AmbientOcclusion.jpg').convert('L').resize((512, 512), Image.LANCZOS)
ro = Image.open(GR + 'Grass004_2K-JPG_Roughness.jpg').convert('L').resize((512, 512), Image.LANCZOS)
hi = Image.open(GR + 'Grass004_2K-JPG_Displacement.jpg').convert('L').resize((512, 512), Image.LANCZOS)
Image.merge('RGB', (ao, ro, hi)).save(OUT + 'grass-orh.webp', quality=82, method=6)

# crowd: the grey/white cheering crowd, ready to tint per club (1344 x 752 -> 1536 x 860, tiled side by side)
cr = Image.open(SRC + 'stand-neutral-cheer.png').convert('RGB')
cr = cr.resize((1536, 860), Image.LANCZOS)
cr.save(OUT + 'crowd.webp', quality=74, method=6)

# LED boards: the strip only
led = Image.open(SRC + 'led-boards.png').convert('RGB')
strip = led.crop((0, 163, 1344, 309)).resize((2048, 222), Image.LANCZOS)
strip.save(OUT + 'led.webp', quality=82, method=6)

json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1)
for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(OUT + f))
