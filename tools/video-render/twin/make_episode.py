"""Stat Twins: make a whole episode for any player-season (Mikey, 8 Nov 2026: "we should be able to replicate this
with any player now"). The format is the Salah episode (v02, cut 5): Poster style, Hugo's voice, the player's own
seasons shown first and removed, countdown from the bottom (a repeated player's places shown together), a famous
player who is NOT in the list, "guess the twin" at #2, the twin, "first in x% of 2,000 tests", why / not the same,
this season's top 5, end card in club colours, "Follow for more."

usage (from the repo root):
  TWIN_DATA=<folder with table.json> python3 tools/video-render/twin/make_episode.py episode.json OUT_DIR
then:  python3 tools/video-render/twin/tts.py OUT_DIR -  &&  python3 tools/video-render/twin/timeline.py OUT_DIR
       node tools/video-render/twin/render.cjs OUT_DIR stills 2,20  (look!)  &&  node .../render.cjs OUT_DIR

episode.json: {"player": "Erling Haaland", "season": "2022/23", "short": "Haaland", "series": "STAT TWINS · EP 3",
  "surprise": ["Harry Kane", ...],            # famous names to try for "You'd think X would be up here?" (best one outside the list is used)
  "stories": {"Callum Wilson": "Newcastle's number nine"},   # optional one-liners, true facts only
  "spoken": {"Núñez": "Noon-yez"}}           # optional pronunciations for Hugo
Every number on screen and in the voice comes from the data (model/model.py + model/v2data.py rules).
"""
import json, os, sys, re, random, collections, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "model"))
from model import *  # noqa: E402,F401  (t, pool, feats, dist, W_SALAH, ...)

EP = json.load(open(sys.argv[1])); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
IMG = os.path.join(os.environ.get("TWIN_DATA", "fm"), "..", "img"); IMG = os.path.abspath(EP.get("imgDir", IMG)); os.makedirs(IMG, exist_ok=True)
CUR = EP.get("current", "2026/27"); SEASONS = ['2016/17', '2017/18', '2018/19', '2019/20', '2020/21', '2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27']
FIVE = SEASONS[SEASONS.index(CUR) - 4: SEASONS.index(CUR) + 1]
W = W_SALAH  # the attacker weights (goals and xG x3, shots/assists/chances/big chances x2 ...)

# ---------- numbers in words (for Hugo) ----------
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def words(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n == 100: return "a hundred"
    return str(n)
ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth", "twelve": "twelfth"}
def ordinal(n):
    n = int(n)
    if n >= 100: return f"{n}{osuf(n)}"   # Hugo reads "101st" correctly; the old code said "101th"
    w = words(n); last = re.split(r"[- ]", w)[-1]
    o = ORD.get(last, last[:-1] + "ieth" if last.endswith("y") else last + "th")
    return w[: len(w) - len(last)] + o
def osuf(n): return "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
def pct(x):   # half up, the same as the screen's Math.round (10 Nov 2026: 80.5 was said "eighty" under a big 81%)
    x = int(x + 0.5); return f"{words(x)} percent", f"{x}%|{words(x).replace(' ', '-')}-percent"
CAP = lambda s: s.upper()

# ---------- the data ----------
TOP5 = True   # every episode uses the Twin Finder data and method v2 (model/finder_model.py); 'leagues' defaults to the Premier League
EP.setdefault('leagues', ['Premier League'])
if TOP5:
    from finder_model import Data, W as FW, GROUP_NAME
    FD = Data(EP.get('data') or os.path.join(os.environ.get('TWIN_DATA', 'fm'), 'twin_data.json'))
    LGS = {int(k) for k, v in FD.D['leagues'].items() if v in EP['leagues']}
    trows = FD.find(EP['player'], EP['season'])
    order, winsO, _tp, _tf, GRP, cands = FD.rank(trows, FIVE, LGS)
    W = FW[GRP]; tg = sorted(trows, key=lambda o: o['s'])[-1]; tg['f'] = _tf
    base = order; top8 = order[:8]
    nbase, nwins, *_ = FD.rank(trows, [CUR], LGS, include_own=False); now5 = nbase[:5]
    idx = {}
    def season_pool(s, v=None): return FD.pool(v['league'], v['s'], GRP)[0]
    POOLNAME = lambda v: f"{v['leagueName']} {GROUP_NAME[GRP]}s"
    LEAGUE_WORDS = 'Premier League' if EP['leagues'] == ['Premier League'] else 'top 5 league'
else:
    P9, b9 = pool(900); P4, b4 = pool(450)
    def season_pool(s, v=None): return b4[s] if s == CUR else b9[s]
    POOLNAME = lambda v: 'PL attackers'
    def rank_in(f, L): return {k: 100 * (sum(1 for y in L if y['f'][k] < f[k]) + 0.5 * sum(1 for y in L if y['f'][k] == f[k])) / len(L) for k in W}
    def solve(tf, own, cands, n=2000, seed=7):
        T = rank_in(tf, own); base = sorted(((dist(T, v['pct'], W), v) for v in cands), key=lambda x: x[0])
        rnd = random.Random(seed); wins = collections.Counter()
        for _ in range(n):
            Wr = {k: w * rnd.uniform(.5, 1.5) for k, w in W.items()}
            b = min(cands, key=lambda v: dist(T, v['pct'], Wr)); wins[(b['name'], b['season'])] += 1
        return base, wins
    idx = {(v['season'], v['name']): k.split('|')[1] for k, v in t.items()}
    tg = [v for v in P9 if v['name'] == EP['player'] and v['season'] == EP['season']][0]
    cands = [v for s in FIVE for v in season_pool(s) if v is not tg]
    base, _ = solve(tg['f'], b9[EP['season']], cands, n=1)
    _, winsO = solve(tg['f'], b9[EP['season']], [v for v in cands if v['name'] != EP['player']])
    top8 = base[:8]
    now_c = [v for v in season_pool(CUR) if v['name'] != EP['player']]
    nbase, nwins = solve(tg['f'], b9[EP['season']], now_c)
    now5 = nbase[:5]
NAME, SHORT = EP['player'], EP.get('short', EP['player'].split()[-1])

# ---------- pictures: headshots, badges (that season's club), flags ----------
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
META = json.load(open(os.path.join(IMG, "meta.json"))) if os.path.exists(os.path.join(IMG, "meta.json")) else {}
def pics(v):
    pid = v.get('id') or idx[(v['season'], v['name'])]
    if pid not in META or not META[pid].get('cc'):
        h = get(f'https://www.fotmob.com/players/{pid}/x').decode()
        s = json.dumps(json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S).group(1))['props']['pageProps'])
        m = re.search(r'"countryCode":\s*"([A-Z]{3})"', s); META[pid] = {'name': v['name'], 'cc': m.group(1) if m else None}
    cc = META[pid]['cc']
    for url, fn in [(f'https://images.fotmob.com/image_resources/playerimages/{pid}.png', f'p{pid}.png'),
                    (f'https://images.fotmob.com/image_resources/logo/teamlogo/{v["teamId"]}.png', f't{v["teamId"]}.png')] + \
                   ([(f'https://images.fotmob.com/image_resources/logo/teamlogo/{cc.lower()}.png', f'c{cc}.png')] if cc else []):
        if not os.path.exists(os.path.join(IMG, fn)): open(os.path.join(IMG, fn), 'wb').write(get(url))
    return {'name': v['name'], 'season': v['season'], 'face': 'p' + pid, 'club': 't' + str(v['teamId']), 'flag': 'c' + (cc or 'ENG')}
def club_colours():
    from PIL import Image
    cols = {}
    for fn in os.listdir(IMG):
        if not (fn.startswith('t') and fn.endswith('.png')): continue
        im = Image.open(os.path.join(IMG, fn)).convert('RGBA').resize((24, 24)); bins = {}
        for r, g, b, a in im.getdata():
            if a < 200: continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mx < 60 or (mx - mn) / mx < 0.35: continue
            e = bins.setdefault((r >> 5, g >> 5, b >> 5), [0, 0, 0, 0]); e[0] += 1; e[1] += r; e[2] += g; e[3] += b
        if bins: n, r, g, b = max(bins.values()); cols[fn[:-4]] = f'rgb({r // n},{g // n},{b // n})'
    cols.update({k: v for k, v in CLUB_COLOUR.items()})  # badges whose main colour isn't the club colour
    return cols
CLUB_COLOUR = {'t8634': 'rgb(165,0,68)', 't9823': 'rgb(220,5,45)'}  # Barcelona, Bayern
CLUBNAME = {}
_TS = open(os.path.join(HERE, "..", "..", "..", "lib", "star", "clubs.ts")).read()
SHORTNAMES = {'Bayern München': 'Bayern Munich', 'Paris Saint-Germain': 'PSG', 'Inter': 'Inter', 'Borussia Dortmund': 'Dortmund'}
SHORTNAMES.update(re.findall(r'"([^"]+)":\s*"([^"]+)"', _TS[_TS.index("CLUB_SHORT_NAMES"):_TS.index("};", _TS.index("CLUB_SHORT_NAMES"))]))
def club_name(tid):
    """The club's spoken name: the project's CLUB_SHORT_NAMES (CLAUDE.md gotcha 7) first, else FotMob's short name."""
    if tid not in CLUBNAME:
        try:
            h = get(f'https://www.fotmob.com/teams/{tid}/overview/x').decode()
            full = re.search(r'<title[^>]*>([^<]+?) - ', h).group(1).strip()
            short = re.search(r'"shortName":\s*"([^"]+)"', h)
            CLUBNAME[tid] = SHORTNAMES.get(full) or SHORTNAMES.get(short.group(1) if short else '') or (short.group(1) if short else full)
        except Exception: CLUBNAME[tid] = ''
    return CLUBNAME[tid]

# ---------- pop-up fact: that player's best rank among that season's attackers ----------
LAB = {'npG': 'goals per 90 (no pens)', 'A': 'assists per 90', 'chances': 'chances created per 90', 'bigCC': 'big chances made per 90', 'shots': 'shots per 90',
       'SoT': 'shots on target per 90', 'drib': 'dribbles per 90', 'npxG': 'xG per 90 (no pens)'}
def fact(v):
    L = season_pool(v['season'], v); best = None
    for k in LAB:
        if v['f'].get(k) is None: continue
        r = sorted([y for y in L if y['f'].get(k) is not None], key=lambda y: -y['f'][k]); hit = [i + 1 for i, y in enumerate(r) if y['name'] == v['name']]
        if hit and (best is None or hit[0] < best[0]): best = (hit[0], k, len(r))
    rk, k, n = best; return {'big': f"{v['f'][k]:.2f}", 'label': LAB[k], 'rank': f"{rk}{osuf(rk)} of {n} {POOLNAME(v)}"}

# ---------- the list: own seasons first, then from the bottom; a repeated player's places together ----------
rows8 = []
if EP.get('top'):  # e.g. "top": 5 -> the list holds that many other players (his own seasons above them still shown, then removed)
    top8, n_ = [], 0
    for d, v in base:
        if n_ >= EP['top']: break
        top8.append((d, v)); n_ += v['name'] != NAME
for d, v in top8:
    r = pics(v); r['match'] = round(Data.match(d, GRP), 1); r['excluded'] = v['name'] == NAME; r['_v'] = v; rows8.append(r)
keep = [r for r in rows8 if not r['excluded']]
for i, r in enumerate(keep): r['rank'] = i + 1
keep[0]['twin'] = True; TW = keep[0]
groups = []; done = set()
for r in reversed(keep):   # the twin's places are kept for the last reveal, even when one of them is lower down
    if r['rank'] in done or r['name'] == TW['name']: continue
    g = [x['rank'] for x in keep if x['name'] == r['name'] and x['rank'] not in done]; groups.append(sorted(g, reverse=True)); done |= set(g)
groups.append(sorted(x['rank'] for x in keep if x['name'] == TW['name']))  # the twin's group
sure = round(100 * winsO[(TW['name'], TW['season'])] / 2000)
# surprise: the best-placed famous name that is outside the list
sur = None
others = [(i + 1, d, v) for i, (d, v) in enumerate([(d, v) for d, v in base if v['name'] != NAME])]
for nm in EP.get('surprise', []):   # the first famous name (in the order given) that is clearly outside the list
    h = [(rk, d, v) for rk, d, v in others if v['name'] == nm]
    if h and h[0][0] > (len(keep) if EP.get('surpriseAnyPlace') else max(len(keep) + 4, 12)): sur = h[0]; break
nowrows = []
for d, v in now5:
    r = pics(v); r['match'] = round(Data.match(d, GRP), 1); r['_v'] = v; nowrows.append(r)
tgp = pics(tg); tgp['season'] = EP['season']
SP = lambda s: EP.get('spoken', {}).get(s, s)
def spoken(name): return " ".join(SP(w) for w in name.split())
def sname(name): return EP.get('shorts', {}).get(name) or (name if len(name) <= 11 else name.split()[-1])  # 'João Pedro' stays whole, 'Callum Wilson' -> 'Wilson'

# ---------- lines + scenes ----------
L, S = [], {}
def line(id, say, cap=None, **kw): L.append(dict(id=id, say=say, cap=cap or CAP(say), **kw))
pt_say, pt_cap = f"Who is prime {spoken(NAME)}'s statistical twin? From the last five seasons.", f"WHO IS PRIME {NAME.upper()}'S STATISTICAL TWIN? FROM THE LAST FIVE SEASONS."
line('intro', pt_say, pt_cap, sfx=[["hit", 0.05, 0.6]], voiceSettings={"speed": 1.1}, tempo=1.05, gapDb=-33, maxGap=0.06)
S['intro'] = {'type': 'intro', 'face': tgp['face'], 'club': tgp['club'], 'flag': tgp['flag'], 'name': SHORT.upper(), 'season': EP['season'],
              'facts': [['5', f'seasons · {FIVE[0][2:]} to {FIVE[-1][2:]}'], [str(len(cands)), LEAGUE_WORDS + ' ' + GROUP_NAME[GRP] + ' seasons'], ['23', 'stats, all per 90 minutes']],
              'at': [0.3, 0.9, 1.5], 'mystery': [{'face': TW['face'], 'label': 'LAST 5 YEARS'}, {'face': nowrows[0]['face'], 'label': 'CURRENT'}]}
ex = [i + 1 for i, r in enumerate(rows8) if r['excluded']]
if ex:
    n = len(ex)
    line('own', f"First, {SHORT} himself. {words(n).capitalize()} of his own seasons made the top eight. They don't count. So that leaves {words(len(keep))}.",
         hold=0.9, sfx=[["pop", SHORT.upper(), 0.5], ["whoosh", "LEAVES", 0.5]])
    S['own'] = {'type': 'cd2', 'list': 'top8', 'show': ex, 'before': [], 'prevShow': [], 'at': SHORT.upper().split()[0], 'collapse': {'at': 'LEAVES'}}
before = []; side = 1
for gi, g in enumerate(groups):
    r = next(x for x in keep if x['rank'] == min(g)); twin = r.get('twin'); id = f"c{max(g)}"
    nm = spoken(r['name']); first = r['name'].upper().split()[0]
    story = EP.get('stories', {}).get(r['name'])   # Mikey, 9 Nov: don't say the club after each name (the badge shows it); a custom story is still said
    ps, pc = pct(r['match'])
    if twin:
        also = [k for k in g if k != 1]; tw2 = (f" He's number {words(also[0])} too." if len(also) == 1 else f" He's number {', '.join(words(k) for k in also[:-1])} and {words(also[-1])} too.") if also else ""
        line(id, f"And number one... {nm}.{' ' + story + '.' if story else ''} {ps.capitalize()}.{tw2} That makes him {SHORT}'s statistical twin.",
             f"AND NUMBER ONE... {r['name'].upper()}.{' ' + story.upper() + '.' if story else ''} {pc}.{tw2.upper()} THAT MAKES HIM {SHORT.upper()}'S STATISTICAL TWIN.", hold=0.4, sfx=[["hit", first, 0.7], ["hit", "THAT", 0.5]])
    else:
        lead = ("Number " if gi == 0 else "") + " and ".join(words(k) for k in g)
        lead = lead[0].upper() + lead[1:]
        tail = {1: "", 2: " Twice.", 3: " Three times."}.get(len(g), f" {words(len(g)).capitalize()} times.")
        extra = " Guess the twin in the comments." if gi == len(groups) - 2 else ""  # just before the twin is revealed
        line(id, f"{lead}: {nm}.{' ' + story + '.' if story else ''}{tail} {ps.capitalize()}.{extra}",
             f"{lead.upper()}: {r['name'].upper()}.{' ' + story.upper() + '.' if story else ''}{tail.upper()} {pc}.{extra.upper()}", hold=0.9 if not extra else 0.6,
             sfx=[["pop", first, 0.5]] + ([["pop", "GUESS", 0.45]] if extra else []))
    sc = {'type': 'cd2', 'list': 'top', 'show': sorted(g), 'before': list(before), 'prevShow': before[-1:] if before else [], 'at': first, 'cont': True, 'from': side,
          'pop': {**fact(r['_v']), 'at': story.upper().split()[0] if story else first}}
    if twin: sc['twinAt'] = 'THAT'
    if len(L[-1]['say'].split("Guess")) > 1: sc['sticker'] = {'text': 'GUESS THE TWIN IN THE COMMENTS', 'at': 'GUESS'}
    S[id] = sc; side = -side; before += g
    if gi == 1 and sur:   # the surprise after the second place
        rk, d, v = sur; a = pics(v); a.update(rank=rk, match=round(Data.match(d, GRP), 1), text=f"Not even top {((rk - 1) // 5) * 5}")
        st = EP.get('stories', {}).get(v['name']); st = (st[0].lower() + st[1:] + ' ') if st else ''
        line('surprise', f"You'd think {st}{spoken(v['name'])} would be up here? He's {ordinal(rk)}.", f"YOU'D THINK {st.upper()}{v['name'].upper()} WOULD BE UP HERE? HE'S {rk}{osuf(rk).upper()}.", hold=0.9, sfx=[["hit", "HE'S", 0.5]])
        S['surprise'] = {'type': 'cd2', 'list': 'top', 'show': [], 'before': list(before), 'prevShow': before[-1:], 'at': v['name'].upper().split()[0], 'aside': a, 'cont': True, 'from': side,
                         'pop': {**fact(v), 'at': "HE'S"}}; side = -side
s_say = "every single one" if sure >= 100 else f"{words(sure)} percent of them"
line('tests', f"We changed how much each stat counts, two thousand times. {sname(TW['name'])} came first in {s_say}.",
     f"WE CHANGED HOW MUCH EACH STAT COUNTS, 2,000|two-thousand TIMES. {sname(TW['name']).upper()} CAME FIRST IN {'EVERY SINGLE ONE' if sure >= 100 else str(sure) + '%|x-percent OF THEM'}.", sfx=[["tick", sname(TW['name']).upper(), 0.4]])
S['tests'] = {'type': 'statement', 'face': TW['face'], 'lines': [[f"{TW['name'].upper()} · {TW['season'][2:]}", 48, '#141414'], [f'FIRST IN {sure}% OF TESTS', 72, '#c8102e'], ['each test counts the stats differently', 30, '#5b564d']], 'at': [0.1, sname(TW['name']).upper(), 'CHANGED']}
# why / not the same: the closest and the furthest of the main stats (real per-90 numbers)
NOUN = {'npG': 'goals', 'A': 'assists', 'chances': 'chances created', 'bigCC': 'big chances made', 'shots': 'shots', 'SoT': 'shots on target', 'npxG': 'expected goals', 'passes': 'passes', 'drib': 'dribbles'}
VERB = {'npG': 'scores more', 'A': 'assists more', 'chances': 'creates more', 'bigCC': 'makes more big chances', 'shots': 'shoots more', 'SoT': 'hits the target more', 'npxG': 'gets better chances', 'passes': 'passes more', 'drib': 'dribbles more'}
tf, wf = tg['f'], TW['_v']['f']
rel = lambda k: 9 if tf.get(k) is None or wf.get(k) is None else abs(tf[k] - wf[k]) / max(tf[k], wf[k], 1e-9)
close = sorted(['npG', 'npxG', 'shots', 'SoT', 'A', 'chances', 'bigCC'], key=rel)[:2]
far = sorted(['npG', 'A', 'chances', 'bigCC', 'passes', 'drib', 'shots', 'SoT'], key=lambda k: -rel(k))[:3]
row = lambda k, a, b: {'label': NOUN[k][0].upper() + NOUN[k][1:], 'a': round(a[k], 2), 'b': round(b[k], 2)}
tgx = {'name': NAME, 'season': EP['season'], 'face': tgp['face']}; twx = {'name': TW['name'], 'season': TW['season'], 'face': TW['face']}
line('why', f"Why? Almost the same {NOUN[close[0]]} and {NOUN[close[1]]}, every ninety minutes.", f"WHY? ALMOST THE SAME {NOUN[close[0]].upper()} AND {NOUN[close[1]].upper()}, EVERY 90|ninety MINUTES.", hold=0.2)
S['why'] = {'type': 'compare', 'kicker': f"Why {sname(TW['name'])}", 'title': 'Almost the same.', 'a': tgx, 'b': twx, 'rows': [row(k, tf, wf) for k in close], 'at': [NOUN[close[0]].upper().split()[0], NOUN[close[1]].upper().split()[0]]}
who = lambda k: SHORT if tf[k] > wf[k] else sname(TW['name'])
d1, d2 = far[0], next((k for k in far[1:] if who(k) != who(far[0])), far[1])
line('diff', f"The difference? {who(d1)} {VERB[d1]}. {who(d2)} {VERB[d2]}." if who(d1) != who(d2) else f"The difference? {who(d1)} {VERB[d1]}, and {VERB[d2]}.", hold=0.35)
S['diff'] = {'type': 'compare', 'kicker': 'But…', 'title': 'Not the same player.', 'a': tgx, 'b': twx, 'rows': [row(k, tf, wf) for k in [d1, d2]], 'at': [who(d1).upper(), who(d2).upper()]}
# this season
line('n0', "And this season only?", hold=0.3); S['n0'] = {'type': 'countdown', 'list': 'now', 'upto': 6, 'at': 0.0}
for k in range(len(nowrows), 1, -1):
    r = nowrows[k - 1]; fw = r['name'].upper().split()[0]
    line(f'n{k}', f"{words(k).capitalize()}: {spoken(r['name'])}.", hold=0.6, sfx=[["pop", fw, 0.5]])
    S[f'n{k}'] = {'type': 'countdown', 'list': 'now', 'upto': k, 'at': fw, 'cont': True}
NW = nowrows[0]; ps, pc = pct(NW['match'])
line('now1', f"And number one, after about ten games... {spoken(NW['name'])}. {ps.capitalize()}.", f"AND NUMBER ONE, AFTER ABOUT TEN GAMES... {NW['name'].upper()}. {pc}.", hold=0.3, sfx=[["hit", NW['name'].upper().split()[0], 0.7]])
S['now1'] = {'type': 'countdown', 'list': 'now', 'upto': 1, 'at': NW['name'].upper().split()[0], 'cont': True}
nf = NW['_v']['f']
# RUL-KIB-008 (Mikey, 9 Nov 2026): Stat Twins comparison cards keep the "player v his twin" framing and show the MOST IMPORTANT stats for the twin pick; never swap them for a generic "what matters for a striker" card. Fix the nowcmp/why lines in the next episode.
# Mikey, 9 Nov 2026: show what the twin is chosen on, not just the two closest stats: the stats that count most for the position (+ one for creating)
okk = lambda k: k in NOUN and tf.get(k) is not None and nf.get(k) is not None
main = [k for k, _ in sorted(W.items(), key=lambda kv: -kv[1]) if okk(k)]
nclose = main[:3] + [next((k for k in main if k in ('chances', 'A', 'bigCC') and k not in main[:3]), main[3])]
said = ", ".join(NOUN[k] for k in nclose[:-1]) + " and " + NOUN[nclose[-1]]
line('nowcmp', f"{sname(NW['name'])} against {SHORT}, on what matters most for a {GROUP_NAME[GRP]}: {said}.", f"{sname(NW['name']).upper()} AGAINST {SHORT.upper()}, ON WHAT MATTERS MOST FOR A {GROUP_NAME[GRP].upper()}: {said.upper()}.")
SUB = {'npG': 'per 90 minutes · no penalties', 'npxG': 'per 90 minutes · no penalties'}
S['nowcmp'] = {'type': 'compare', 'kicker': 'This season', 'title': f"{SHORT} vs {sname(NW['name'])}.", 'a': tgx, 'b': {'name': NW['name'], 'season': CUR, 'face': NW['face']},
               'rows': [{**row(k, tf, nf), 'sub': SUB.get(k, 'per 90 minutes')} for k in nclose], 'at': [NOUN[k].upper().split()[0] for k in nclose]}
ALSO = 'also ' if NW['name'] == TW['name'] else ''
line('end', f"So {SHORT}'s twin is {spoken(TW['name'])}. And right now, it's {ALSO}{spoken(NW['name'])}. Follow for more.", f"SO {SHORT.upper()}'S TWIN IS {TW['name'].upper()}. AND RIGHT NOW, IT'S {ALSO.upper()}{NW['name'].upper()}. FOLLOW FOR MORE.")
S['end'] = {'type': 'end2', 'captions': True, 'at': [TW['name'].upper().split()[0], 'RIGHT'],
            'pairs': [{'label': 'Last 5 seasons', 'a': tgp['face'], 'b': TW['face'], 'aName': f"{SHORT.upper()} {EP['season'][2:]}", 'bName': f"{sname(TW['name']).upper()} {TW['season'][2:]}", 'aClub': tgp['club'], 'bClub': TW['club']},
                      {'label': 'This season', 'a': tgp['face'], 'b': NW['face'], 'aName': f"{SHORT.upper()} {EP['season'][2:]}", 'bName': sname(NW['name']).upper(), 'aClub': tgp['club'], 'bClub': NW['club']}]}
# ---------- fast style (Mikey, 9 Nov 2026: no dead air): the default; "style": "long" keeps the old pacing ----------
if EP.get('style', 'fast') == 'fast':
    for l in L:
        if l['id'] == 'intro':
            PRE = EP.get('prefix', 'Prime'); l.update(say=f"{PRE} {spoken(NAME)}'s statistical twin is not who you think.", cap=f"{PRE.upper()} {NAME.upper()}'S STATISTICAL TWIN IS NOT WHO YOU THINK.", sfx=[["hit", 0.0, 0.7]])
        if l['id'] == 'own':
            l.update(say=f"His own seasons don't count. That leaves {words(len(keep))}.", cap=f"HIS OWN SEASONS DON'T COUNT. THAT LEAVES {words(len(keep)).upper()}.")
    L = [l for l in L if l['id'] != 'tests']; S.pop('tests', None)
    S['intro'].update(instant=True, kicker='HIS TWIN IS NOT WHO YOU THINK', kickerAt='NOT', facts=[], mystery=[{**m, 'delay': 0} for m in S['intro']['mystery']])
    if EP.get('award'):   # e.g. {"at": "BALLON", "label": "BALLON D'OR 25/26"}: a trophy pops onto him when the word is said
        S['intro']['award'] = EP['award']; next(l for l in L if l['id'] == 'intro')['sfx'].append(["pop", EP['award']['at'], 0.7])
    if 'own' in S: S['own']['at'] = 'HIS'
    prev = tgp['club']; prevn = tgp['club']
    for l in L:
        k = l['id']; sc = S.get(k, {})
        if k.startswith('c') and sc.get('type') == 'cd2':
            twin = 'twinAt' in sc
            l['hold'] = 0.5 if twin else (0.25 if sc.get('sticker') else 0.12)
            if not twin: sc['at'] = 0.0
            sc['fromClub'] = prev; prev = next(x for x in keep if x['rank'] == sc['show'][0])['club']
        elif k == 'surprise':
            l['hold'] = 0.15; sc['at'] = 0.0; sc['fromClub'] = prev; prev = sc['aside']['club']
        elif k == 'own': l['hold'] = 0.12
        elif k in ('why', 'diff', 'nowcmp', 'now1'): l['hold'] = 0.3
        elif k == 'n0': l['hold'] = 0.05
        elif k.startswith('n') and k[1:].isdigit():
            l['hold'] = 0.08; sc['at'] = 0.0; sc['fromClub'] = prevn; prevn = nowrows[int(k[1:]) - 1]['club']
        if k == 'now1': sc['fromClub'] = prevn
for r in rows8 + nowrows: r.pop('_v', None)
target = {'name': NAME, 'season': EP['season'], 'face': tgp['face'], 'club': tgp['club'], 'flag': tgp['flag']}
lists = {'top8': {'title': 'The top eight.', 'sub': '', 'target': target, 'rows': rows8},
         'top': {'title': f'The top {words(len(keep))}.', 'sub': '', 'target': target, 'rows': keep},
         'now': {'title': 'Right now.', 'sub': '', 'target': target, 'rows': nowrows}}
json.dump(META, open(os.path.join(IMG, "meta.json"), "w"), indent=1, ensure_ascii=False)
meta = {'targetShort': SHORT, 'targetClub': club_name(tg['teamId']), 'series': EP.get('series', 'STAT TWINS'), 'source': ('Data: Opta via FotMob · ' + ('Premier League' if EP['leagues'] == ['Premier League'] else 'top 5 leagues') + ', 900+ mins'), 'engine': 'video_full.html', 'layout': EP.get('layout', 'poster'), 'imgDir': IMG, 'clubColors': club_colours()}
json.dump(L, open(os.path.join(OUT, 'lines.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'meta': meta, 'lists': lists, 'scenes': S}, open(os.path.join(OUT, 'scenes.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'provider': 'elevenlabs', 'voiceId': 'WAppqUXeqDqXjNTaQxG9'}, open(os.path.join(OUT, 'voice.json'), 'w'))
print("twin", TW['name'], TW['season'], TW['match'], f"{sure}% of tests"); print("list", [(r.get('rank', '-'), r['name'], r['season'], r['match'], 'X' if r['excluded'] else '') for r in rows8])
print("groups", groups, "surprise", sur and (sur[2]['name'], sur[0])); print("now", [(r['name'], r['match']) for r in nowrows])
for l in L: print(f"  [{l['id']}] {l['say']}")
