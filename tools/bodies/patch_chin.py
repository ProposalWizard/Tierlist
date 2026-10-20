"""patch_chin.py <today.glb> <new.glb> — the build reads the chin as max(neck + 2 cm, 2*eye - top), which
on a re-shaped head lands on the neck clamp, not on the head. A re-shaped head is today's head scaled about
its joint, so its chin is today's chin carried the same way: Head - (Head - chin)_today * k, k the head's scale.
Rewrites extras.face.chinY in place (the JSON chunk only)."""
import json, struct, sys

ref, f = sys.argv[1:3]


def read(p):
    b = open(p, 'rb').read(); l = struct.unpack('<I', b[12:16])[0]
    return b, json.loads(b[20:20 + l]), l


_, jr, _ = read(ref)
b, j, l = read(f)
mr, m = jr['scenes'][0]['extras'], j['scenes'][0]['extras']
Jr, J = mr['joints'], m['joints']
k = (J['head_end'][1] - J['Head'][1]) / (Jr['head_end'][1] - Jr['Head'][1])
old = m['face']['chinY']
m['face']['chinY'] = round(J['Head'][1] - (Jr['Head'][1] - mr['face']['chinY']) * k, 4)
# today's Style A head, neck and hand dials are BAKED into the re-shaped mesh (reshape.py head x1.1, RS_NECK 1.25,
# RS_HANDS x0.88), so the file keeps its own (bodyGuide.mts: a judged file never takes the dials twice)
m['look'] = {'head': 1, 'neck': 1, 'hands': 1}
s = json.dumps(j, separators=(',', ':')).encode()
s += b' ' * ((4 - len(s) % 4) % 4)
rest = b[20 + l:]
out = b[:12] + struct.pack('<I', len(s)) + b'JSON' + s + rest
out = out[:8] + struct.pack('<I', len(out)) + out[12:]
open(f, 'wb').write(out)
print('chin', old, '->', m['face']['chinY'], 'head k', round(k, 3))
