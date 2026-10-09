import numpy as np


def read_hdr(path):
    data = open(path, 'rb').read()
    i = 0
    while True:
        j = data.index(b'\n', i)
        line = data[i:j]
        i = j + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            break
    parts = line.split()
    H = int(parts[1]); W = int(parts[3])
    out = np.zeros((H, W, 4), np.uint8)
    p = i
    buf = np.frombuffer(data, np.uint8)
    for y in range(H):
        if buf[p] == 2 and buf[p + 1] == 2:
            p += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = int(buf[p]); p += 1
                    if n > 128:
                        n -= 128
                        out[y, x:x + n, c] = buf[p]; p += 1
                    else:
                        out[y, x:x + n, c] = buf[p:p + n]; p += n
                    x += n
        else:
            out[y] = buf[p:p + W * 4].reshape(W, 4); p += W * 4
    e = out[..., 3].astype(np.int32)
    s = np.where(out[..., 3] > 0, np.ldexp(1.0, e - 136), 0.0)
    return out[..., :3].astype(np.float32) * s[..., None].astype(np.float32)


def write_hdr(path, img):
    H, W, _ = img.shape
    m = img.max(axis=2)
    mant, ex = np.frexp(m)
    sc = np.where(m > 1e-32, mant * 256.0 / np.maximum(m, 1e-32), 0)
    rgbe = np.zeros((H, W, 4), np.uint8)
    rgbe[..., :3] = np.clip(img * sc[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, ex + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (H, W))
        f.write(rgbe.tobytes())


def down(img, k):
    H, W, _ = img.shape
    return img[:H // k * k, :W // k * k].reshape(H // k, k, W // k, k, 3).mean(axis=(1, 3))


def tonemap(img):
    t = img / (1 + img)
    return (np.clip(t, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
