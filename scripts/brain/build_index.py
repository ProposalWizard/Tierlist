#!/usr/bin/env python3
"""Auto-tag every brain note from keyword rules in brain/_tags.md, then build brain/_index.md.
Usage: python3 scripts/brain/build_index.py [--check]   (--check: no writes, exit 1 if drift)"""
import re, sys, pathlib
B = pathlib.Path(__file__).resolve().parents[2] / "brain"
MAX_LINES = 200

def load_tags():
    rules = {}
    for ln in (B / "_tags.md").read_text().splitlines():
        p = [x.strip() for x in ln.split("|")]
        if len(p) == 3 and p[0] != "default" and re.fullmatch(r"[a-z][a-z-]*", p[0]):
            rules[p[0]] = [k.strip().lower() for k in p[2].split(",") if k.strip()]
    return rules

def load_defaults():
    d = {}
    for ln in (B / "_tags.md").read_text().splitlines():
        p = [x.strip() for x in ln.split("|")]
        if len(p) == 3 and p[0] == "default":
            d[p[1]] = p[2]
    return d

STOP = set("never always about their there which would should these those with from that this have been only than then when what into over under your like also does not and the for are but".split())
ROOT = B.parent

def source_check(src, summary):
    """Key words from the summary must appear in the cited file lines (+-1 line)."""
    m = re.match(r"(.+?):(\d+)(?:-(\d+))?$", src)
    if not m:
        return f"bad source format: {src}"
    f = ROOT / m.group(1)
    if not f.exists():
        return f"source file missing: {m.group(1)}"
    a = int(m.group(2)); b = int(m.group(3) or a)
    lines = f.read_text().splitlines()
    if b > len(lines):
        return f"line {b} beyond end of file"
    text = " ".join(lines[max(0, a - 2):b + 1]).lower().replace("*", "")
    toks = {t for t in re.findall(r"[a-z0-9£%#+']{4,}|\d[\d,.%+]*", summary.lower()) if t not in STOP}
    if not toks:
        return None
    hit = [t for t in toks if t.strip("'") in text or t.rstrip("s") in text]
    if len(hit) / len(toks) < 0.4:
        return f"only {len(hit)}/{len(toks)} key words found at {src}"
    return None

def split(text):
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    return m.group(1), m.group(2)

def field(fm, k):
    m = re.search(rf"^{k}:\s*(.*)$", fm, re.M)
    return m.group(1).strip() if m else ""

def auto_tags(rules, text):
    t = text.lower()
    return [tag for tag, kws in rules.items()
            if any(re.search(r"(?<![a-z0-9])" + re.escape(k), t) for k in kws)]

def main():
    check = "--check" in sys.argv
    rules = load_tags()
    defaults = load_defaults()
    rows, drift, warn, errs = [], False, [], []
    status_of = {}
    for f in sorted(B.glob("*/*.md")):
        text = f.read_text()
        fm, body = split(text)
        tags = auto_tags(rules, field(fm, "summary"))
        dflt = defaults.get(field(fm, "type") + ":" + field(fm, "client"))
        if dflt and dflt not in tags:
            tags.append(dflt)
        if len(tags) == 0 or len(tags) > 4:
            warn.append(f"{f.stem}: {len(tags)} tags")
        if field(fm, "status") not in ("live", "superseded", "draft"):
            errs.append(f"{f.stem}: bad status")
        status_of[f.stem] = (field(fm, "status"), field(fm, "supersedes"))
        e = source_check(field(fm, "source").strip('"'), field(fm, "summary"))
        if e:
            errs.append(f"{f.stem}: {e}")
        new = re.sub(r"^tags:.*$", "tags: [" + ", ".join(tags) + "]", fm, flags=re.M)
        if new != fm:
            drift = True
            if not check:
                f.write_text("---\n" + new + "\n---\n" + body)
        if field(fm, "id") != f.stem:
            sys.exit(f"id/filename mismatch: {f}")
        if not field(fm, "source"):
            sys.exit(f"missing source: {f}")
        rows.append((f.stem, field(fm, "status"), field(fm, "summary"), tags, field(fm, "client")))
    for k, (st, sup) in status_of.items():
        if sup:
            if sup not in status_of:
                errs.append(f"{k}: supersedes unknown {sup}")
            elif status_of[sup][0] != "superseded":
                errs.append(f"{k}: supersedes {sup} but that note is not status: superseded")
    for w in warn:
        print("WARN", w)
    for e in errs:
        print("ERROR", e)
    def line(r):
        i, st, sm, tg, cl = r
        return f"{i} | {'[SUPERSEDED] ' if st == 'superseded' else ''}{sm} | {','.join(tg)}"
    if len(rows) + 2 > 150:
        by = {}
        for r in rows:
            by.setdefault(r[4], []).append(r)
        top = ["# Brain index: one file per client, open the one you need", "file | notes"]
        for cl, rs in by.items():
            fn = f"_index-{cl}.md"
            top.append(f"{fn} | {len(rs)}")
            if not check:
                (B / fn).write_text("\n".join(["# Brain index " + cl, "ID | summary | tags"] + [line(r) for r in rs]) + "\n")
        if not check:
            (B / "_index.md").write_text("\n".join(top) + "\n")
        print(f"{len(rows)} notes, split by client, drift={drift}, errors={len(errs)}")
        sys.exit(1 if (errs or (check and drift)) else 0)
    lines = ["# Brain index (built by scripts/brain/build_index.py, do not hand-edit)",
             "ID | summary | tags"]
    for r in rows:
        lines.append(line(r))
    if len(lines) > MAX_LINES:
        sys.exit(f"index has {len(lines)} lines, over {MAX_LINES}: split by client")
    if not check:
        (B / "_index.md").write_text("\n".join(lines) + "\n")
    print(f"{len(rows)} notes, {len(lines)} index lines, drift={drift}, errors={len(errs)}")
    sys.exit(1 if (errs or (check and drift)) else 0)

main()
