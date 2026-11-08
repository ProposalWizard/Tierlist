"""Render the avocado vs 1000 cuts video on a computer with a graphics card.

  python render_all.py --blender "<path to blender>"            full video
  python render_all.py --blender "<path to blender>" --test     round 1 only (about 5 s of video)

Needs: Blender 4.1 (not 4.2 or newer: its EEVEE changed), Python 3 with numpy
and Pillow, and ffmpeg. Output: out/avocado_full.mp4 (or out/avocado_round1.mp4).
Stops with a message if the sync check fails.
"""
import argparse, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out')
ap = argparse.ArgumentParser(); ap.add_argument('--blender', required=True); ap.add_argument('--test', action='store_true')
ap.add_argument('--workers', type=int, default=1); a = ap.parse_args()
os.makedirs(OUT, exist_ok=True)

def bl(*args, blend=None, log=None):
    cmd = [a.blender, '-b'] + ([os.path.join(OUT, blend)] if blend else ['--factory-startup']) + ['--python'] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=HERE)
    if log: open(os.path.join(OUT, log), 'w').write(r.stdout + r.stderr)
    return r.stdout + r.stderr

def must_pass(txt, what):
    lines = [l for l in txt.splitlines() if l.startswith(('CHECK', ' FAIL', 'down', 'side', 'dice', 'most', 'frames with', 'final'))]
    print('\n'.join('   ' + l for l in lines))
    if 'CHECK PASS' not in txt:
        print(f'STOP: the sync check failed for {what}. Nothing was rendered.'); print(txt[-3000:]); sys.exit(1)

t0 = time.time()
print('1/5 build + check round 1'); bl(os.path.join(HERE, 'cuts2.py'), '--', 'build', log='build_r1.log')
must_pass(bl(os.path.join(HERE, 'cuts2.py'), '--', 'check'), 'round 1')
rounds = [] if a.test else [1, 2, 3, 4, 5]
for i in rounds:
    print(f'2/5 build + check round {i+1}'); bl(os.path.join(HERE, 'cuts3.py'), '--', 'build', str(i), log=f'build_r{i+1}.log')
    must_pass(bl(os.path.join(HERE, 'cuts3.py'), '--', 'check', str(i)), f'round {i+1}')

print('3/5 render (this is the long part)')
jobs = [('cuts2_r1.blend', 'cuts2.py', ['render', '0', '167'])]
ranges = {1: (166, 499), 2: (499, 864), 3: (864, 1264), 4: (1264, 1692), 5: (1692, 2160)}
for i in rounds:
    s, e = ranges[i]; n = e - s
    for j in range(a.workers):
        jobs.append((f'cuts3_r{i+1}.blend', 'cuts3.py', ['render', str(i), str(s + n*j//a.workers), str(s + n*(j+1)//a.workers)]))
procs = []
for blend, script, args in jobs:
    cmd = [a.blender, '-b', os.path.join(OUT, blend), '--python', os.path.join(HERE, script), '--'] + args
    procs.append(subprocess.Popen(cmd, cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    while sum(p.poll() is None for p in procs) >= max(1, a.workers): time.sleep(2)
for p in procs: p.wait()
done = len(os.listdir(os.path.join(OUT, 'fr2'))) + (len(os.listdir(os.path.join(OUT, 'fr3'))) if os.path.isdir(os.path.join(OUT, 'fr3')) else 0)
print(f'   frames rendered: {done}')

print('4/5 counters + sound')
subprocess.run([sys.executable, os.path.join(HERE, 'finish.py'), 'sound', 'video'] + (['test'] if a.test else []), check=True, cwd=HERE)

print('5/5 video')
name = 'avocado_round1.mp4' if a.test else 'avocado_full.mp4'
frames = ['-frames:v', '166'] if a.test else []
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-i', os.path.join(OUT, 'final', 'f%05d.jpg'), '-i', os.path.join(OUT, 'audio_all.wav')]
               + frames + ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', os.path.join(OUT, name)], check=True)
print(f'DONE: {os.path.join(OUT, name)}  ({round((time.time()-t0)/60, 1)} min)')
