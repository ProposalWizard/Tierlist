import json, sys, statistics as st
for f in sys.argv[1:]:
    print("==", f)
    for l in open(f):
        if not l.startswith("{"):
            continue
        d = json.loads(l)
        if d.get("failed") or d.get("err"):
            print("FAILED", d); continue
        s = d.get("steady", {})
        line = f"{d['scene']:7s} {d.get('exp') or 'base':14s} dpr{d.get('dpr')} {'cpu-only ' if d.get('nofinish') else ''}entry {d.get('entryMs')} first {d.get('firstFrameMs')} ms/frame {s.get('msPerFrame')} cpuMed {s.get('cpuMed')} calls {d.get('calls')} extra {d.get('extra')}"
        print(line)
        t = d.get("tagged") or []
        if t:
            A = [c for tag, c, _ in t if tag == "A"]; B = [c for tag, c, _ in t if tag == "B"]
            cA = [k for tag, _, k in t if tag == "A"]; cB = [k for tag, _, k in t if tag == "B"]
            if A and B:
                ma, mb = st.median(A), st.median(B)
                print(f"     A/B same page: A median {ma:.0f} ms (n={len(A)}, calls {st.median(cA):.0f})  B median {mb:.0f} ms (n={len(B)}, calls {st.median(cB):.0f})  B vs A {100*(mb-ma)/ma:+.0f}%")
