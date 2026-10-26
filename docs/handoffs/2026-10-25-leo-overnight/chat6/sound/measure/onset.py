import subprocess, numpy as np, sys
for f in sys.argv[1:]:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    pk = np.abs(x).max()
    env = np.array([np.sqrt(np.mean(x[i:i + 480] ** 2)) for i in range(0, len(x) - 480, 240)])
    first = np.argmax(np.abs(x) > 0.01 * pk) / 48
    mx = env.max()
    t10 = np.argmax(env > 0.1 * mx) * 5; t50 = np.argmax(env > 0.5 * mx) * 5; tmax = np.argmax(env) * 5
    print(f"{f.split('/')[-1]}: peak {pk:.2f} first {first:.0f}ms env10% {t10}ms env50% {t50}ms envmax {tmax}ms len {len(x)/48:.0f}ms")
