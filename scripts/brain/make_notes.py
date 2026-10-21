#!/usr/bin/env python3
"""Write brain notes from a spec file, finding each source line by an anchor text.
Usage: python3 scripts/brain/make_notes.py SPEC.py
SPEC.py defines NOTES = [dict(id, type, client, file, anchor, n, summary, body="", status="live",
supersedes="", superseded_by="")]. The anchor is text that starts (or is inside) the first source line;
n is how many lines the source covers. Existing notes with the same id are overwritten.
Run scripts/brain/build_index.py after it."""
import sys, pathlib, runpy
ROOT = pathlib.Path(__file__).resolve().parents[2]
TYPE_DIR = {"ruling": "ruling", "fact": "fact", "craft": "craft", "decision": "decision",
            "process": "process", "reference": "reference"}

def line_of(path, anchor):
    lines = (ROOT / path).read_text().splitlines()
    hits = [i + 1 for i, l in enumerate(lines) if anchor in l]
    if len(hits) != 1:
        sys.exit(f"anchor found {len(hits)} times in {path}: {anchor!r}")
    return hits[0]

def main():
    notes = runpy.run_path(sys.argv[1])["NOTES"]
    seen = set()
    for n in notes:
        if n["id"] in seen:
            sys.exit("duplicate id " + n["id"])
        seen.add(n["id"])
        a = line_of(n["file"], n["anchor"])
        span = n.get("n", 1)
        src = f'{n["file"]}:{a}' if span == 1 else f'{n["file"]}:{a}-{a + span - 1}'
        fm = [f'id: {n["id"]}', f'type: {n["type"]}', f'client: {n["client"]}', 'tags: []',
              f'status: {n.get("status", "live")}', 'date: 2026-10-21', f'source: "{src}"']
        if n.get("supersedes"):
            fm.append(f'supersedes: {n["supersedes"]}')
        if n.get("superseded_by"):
            fm.append(f'superseded_by: {n["superseded_by"]}')
        fm.append(f'summary: {n["summary"]}')
        d = ROOT / "brain" / TYPE_DIR[n["type"]]
        d.mkdir(parents=True, exist_ok=True)
        body = n.get("body", "").strip()
        (d / f'{n["id"]}.md').write_text("---\n" + "\n".join(fm) + "\n---\n" + (body + "\n" if body else ""))
    print(f"{len(notes)} notes written")

main()
