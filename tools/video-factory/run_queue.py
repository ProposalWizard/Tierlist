"""Make every storyboard in stories/ into a video, one at a time, priority first.
Stops when a file named STOP exists. Out: $OUT (default ./out)."""
import os, subprocess, time, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.environ.get("OUT", os.path.join(HERE, "out"))
FIRST = ["rob-koeman-1988", "rob-milito-2010", "rob-messi-2021"]
ONLY = [x for x in os.environ.get("ONLY", "").split(",") if x]  # a helper session makes only these, then stops
tried = set()
while not os.path.exists(os.path.join(HERE, "STOP")):
    ids = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "stories")) if f.endswith(".json"))
    todo = [i for i in ids if i not in tried and not os.path.exists(os.path.join(OUT, i + ".mp4"))]
    if ONLY: todo = [i for i in todo if i in ONLY]
    else: todo = [i for i in todo if not os.path.exists(os.path.join(HERE, "claimed", i))]
    todo.sort(key=lambda i: (0, FIRST.index(i)) if i in FIRST else (1, i))
    if not todo:
        if ONLY: break
        time.sleep(30); continue
    vid = todo[0]; tried.add(vid); t0 = time.time()
    try: json.load(open(os.path.join(HERE, "stories", vid + ".json")))
    except Exception as e: print("bad json", vid, e, flush=True); continue
    r = subprocess.run([sys.executable, os.path.join(HERE, "make.py"), os.path.join(HERE, "stories", vid + ".json"), "--out", OUT])
    print(("OK " if r.returncode == 0 else "FAIL ") + vid, f"{(time.time() - t0) / 60:.1f} min", flush=True)
