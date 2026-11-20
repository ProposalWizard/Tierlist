"""Helper for step stories: write steps with at="word" (first match in the line, case-insensitive) instead of
word indices. python3 stories/_steps.py <src.py-ish json in> is not needed: import and call build()."""
import json, re
def idx(text, word, after=0):
    toks = [re.sub(r"[^\w'-]", "", w).lower() for w in text.split()]
    w = word.lower()
    for i, x in enumerate(toks):
        if i >= after and x.startswith(w): return i
    raise SystemExit(f"word {word!r} not in: {text}")
def line(text, steps, **scene):
    out, last = [], 0
    for s in steps:
        s = dict(s); at = s.pop("at", None)
        s["w"] = idx(text, at, last) if at else 0; last = s["w"]; out.append(s)
    return {"text": text, "scene": {**scene, "type": out[0]["type"], "steps": out}}
