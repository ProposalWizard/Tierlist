import json, csv, re, collections, os, sys
q = json.load(open("qids.json"))
SURNAME_FIRST = {"China PR", "Chinese Taipei", "Hong Kong", "Macau", "Korea Republic", "Korea DPR", "Vietnam", "Cambodia"}
MODERN_FROM = 1975   # birth year
MODERN_MIN = 150     # modern players needed to use only them
EAST_ASIAN = {"China PR", "Chinese Taipei", "Hong Kong", "Macau", "Korea Republic", "Korea DPR"}
HISPANIC = {"Spain", "Argentina", "Uruguay", "Colombia", "Mexico", "Chile", "Peru", "Paraguay", "Ecuador", "Costa Rica", "Bolivia", "Venezuela",
            "Honduras", "Guatemala", "El Salvador", "Nicaragua", "Panama", "Cuba", "Dominican Republic", "Puerto Rico", "Equatorial Guinea"}
PARTICLES = {"de", "da", "do", "dos", "das", "van", "von", "der", "den", "ter", "te", "la", "le", "du", "del", "della", "di", "el", "al", "ben", "bin", "abu", "mac", "st", "st.", "ould", "ag"}
DROP = {"jr", "jr.", "júnior", "junior", "ii", "iii", "iv", "sr", "sr.", "filho"}
# Second first names that end up last when a label is "José María" or "Juan Antonio".
NOT_SURNAMES = {"María", "Maria", "José", "Jose", "Manuel", "Antonio", "Luis", "Juan", "Carlos", "Francisco", "Javier", "Miguel", "Ángel", "Angel", "Jesús", "Jesus", "Alberto", "Andrés", "Eduardo", "Ignacio", "Ramón", "Pablo", "Fernando", "Alejandro"}
BAD = re.compile(r"[0-9()\[\],/\"]")
def split(label, nation, common_first=frozenset()):
    l = re.sub(r"\s*\(.*?\)\s*", " ", label).strip()
    if BAD.search(l): return None
    t = l.split()
    while len(t) > 2 and t[-1].lower() in DROP: t = t[:-1]
    if len(t) < 2: return None
    if any(x.endswith(".") and len(x) <= 3 for x in t[:1]): return None
    if nation in SURNAME_FIRST:
        # Usually "Son Heung-min"; sometimes written "Heung-min Son". A
        # hyphenated part is the given name, never the surname.
        if ("-" in t[0] and "-" not in t[-1]) or (nation in {"Hong Kong", "Macau"} and t[0] in WESTERN_FIRST): given, sur = " ".join(t[:-1]), t[-1]
        else: given, sur = " ".join(t[1:]), t[0]
        if "-" in sur: return None
        # Chinese and Korean surnames are short and plain ("Kim", "Zhang", "Ouyang").
        if nation in EAST_ASIAN and not re.fullmatch(r"[A-Z][a-z']{0,5}", sur): return None
        return given, sur
    first, rest = t[0], t[1:]
    # "José Manuel García": Manuel is a second first name, not a surname.
    while len(rest) > 1 and rest[0] in common_first and rest[0].lower() not in PARTICLES: rest = rest[1:]
    if len(rest) == 1: last = rest[0]
    elif rest[0].lower() in PARTICLES: last = " ".join(rest[:3])
    elif nation in HISPANIC: last = rest[0]
    elif len(rest) >= 2 and rest[-2].lower() in PARTICLES: last = " ".join(rest[-2:])
    else: last = rest[-1]
    if len(first) < 2 or len(last) < 2 or first.lower() in PARTICLES: return None
    if last.lower() in DROP or last in NOT_SURNAMES: return None
    return first, last
# First names common outside East Asia ("Jack", "Andy"): a Hong Kong player
# listed as "Jack Wong" is in Western order.
_wf = collections.Counter()
for n, qid in q.items():
    if n in SURNAME_FIRST: continue
    f = f"raw2/{qid}.csv" if os.path.exists(f"raw2/{qid}.csv") else f"raw/{qid}.csv"
    if not os.path.exists(f): continue
    for r in list(csv.reader(open(f, encoding="utf-8")))[1:]:
        if len(r) > 1 and r[1].split(): _wf[r[1].split()[0]] += 1
WESTERN_FIRST = {x for x, c in _wf.items() if c >= 30}
out = {}; report = []; counters = {}
for n, qid in sorted(q.items()):
    f = f"raw2/{qid}.csv" if os.path.exists(f"raw2/{qid}.csv") else f"raw/{qid}.csv"
    if not os.path.exists(f): report.append((n, 0, 0, 0)); continue
    rows = list(csv.reader(open(f, encoding="utf-8")))[1:]
    # Modern players' names where there are enough of them (Wikidata goes
    # back to the 1880s: England's list was full of Keiths and Stans).
    modern = [r for r in rows if len(r) > 2 and r[2].isdigit() and int(r[2]) >= MODERN_FROM]
    if len(modern) >= MODERN_MIN: rows = modern
    seen = set(); F = collections.Counter(); L = collections.Counter(); people = 0
    firsts = collections.Counter(re.sub(r"\s*\(.*?\)\s*", " ", r[1]).split()[0] for r in rows if len(r) > 1 and r[1].split())
    common_first = {x for x, c in firsts.items() if c >= 4}
    for r in rows:
        if len(r) < 2 or r[0] in seen: continue
        seen.add(r[0]); s = split(r[1], n, common_first)
        if not s: continue
        people += 1; F[s[0]] += 1; L[s[1]] += 1
    counters[n] = (F, L, people)
    report.append((n, people, min(120, len(F)), min(200, len(L))))
# A name that is common somewhere else but turns up once or twice here is
# a naturalised or dual-national player's (Miettinen for Kenya, Dietmar and
# Mauricio for Korea): left out.
GF, GL = collections.Counter(), collections.Counter()
for F, L, _ in counters.values(): GF.update(F); GL.update(L)
def native(c, g):
    return collections.Counter({x: k for x, k in c.items() if not (k <= 2 and g[x] >= 8 and k / g[x] < 0.1)})
counters = {n: (native(F, GF), native(L, GL), p) for n, (F, L, p) in counters.items()}
# Nations with few players on record are topped up from their neighbours
# (their own names count three times as much, so they still lead).
NEIGHBOURS = {
  "Tahiti": ["New Caledonia", "Samoa"], "Cook Islands": ["Samoa", "Tonga"], "Guam": ["Philippines", "United States"],
  "Cayman Islands": ["Jamaica"], "Macau": ["Hong Kong"], "Montserrat": ["Antigua and Barbuda", "Saint Kitts and Nevis"],
  "Djibouti": ["Somalia", "Eritrea"], "São Tomé and Príncipe": ["Cape Verde", "Angola"],
  "Turks and Caicos Islands": ["Bahamas", "Jamaica"], "US Virgin Islands": ["Saint Kitts and Nevis", "Antigua and Barbuda"],
  "Tonga": ["Samoa", "Cook Islands"], "British Virgin Islands": ["Antigua and Barbuda", "Saint Kitts and Nevis"],
  "Dominica": ["Saint Lucia", "Grenada"], "Eswatini": ["South Africa", "Lesotho"],
}
for n, (F, L, people) in counters.items():
    f2, l2 = collections.Counter(), collections.Counter()
    for x, c in F.items(): f2[x] += 3 * c
    for x, c in L.items(): l2[x] += 3 * c
    for nb in NEIGHBOURS.get(n, []):
        for x, c in counters[nb][0].most_common(60): f2[x] += c
        for x, c in counters[nb][1].most_common(100): l2[x] += c
    out[n] = {"f": [x for x, _ in f2.most_common(100)], "l": [x for x, _ in l2.most_common(160)], "players": people,
              **({"from": NEIGHBOURS[n]} if n in NEIGHBOURS else {})}
json.dump(out, open("banks.json", "w"), ensure_ascii=False, separators=(",", ":"))
game = {n: {"f": v["f"], "l": v["l"]} for n, v in out.items()}
json.dump(game, open("nation-names.json", "w"), ensure_ascii=False, separators=(",", ":"))
report.sort(key=lambda r: r[1])
print("thin (<40 players):", [(r[0], r[1]) for r in report if r[1] < 40])
print("players total", sum(r[1] for r in report), "nations", len(report))
