"""A player's face FROM THE SEASON SHOWN (Mikey, 11 Nov 2026: "if I'm doing a video on Neymar from 2018 ... Neymar looks quite
different since then"). FotMob only has today's photo, so for any past season:
  1. find the player's EA / SoFIFA id for that season in our own sofifa_players table (every league, every FIFA edition;
     FIFA 18 = 2017/18), pulled once into <data>/../sofifa_top5.json by `pull()` below, matched by name + league + club;
  2. download that edition's photo from FUTBIN (a plain image link, one per edition: content/fifa18/img/players/<id>.png),
     else FUTWIZ; nothing that needs a login or a faked header (SoFIFA's own image server refuses plain requests: not used).
  3. no match or no photo -> None, and the caller keeps today's FotMob photo.
Saved as <img>/p<fotmobid>y<yy>.png (key "p<id>y<yy>")."""
import json, os, re, unicodedata, urllib.request, urllib.parse, difflib
LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]
KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "sb_publishable_UhF3CXpsFGOfolaOHkqOdA_Vzyjlkw7"   # publishable (public) key: read-only, public tables
URL = "https://cagkgfketucousksgtbk.supabase.co/rest/v1/sofifa_players"
def norm(s): return re.sub(r"[^a-z ]", "", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower().replace("-", " ")).split()
def pull(path, first=2016, last=2027):
    rows = []
    for y in range(first, last + 1):
        for lg in LEAGUES:
            off = 0
            while True:
                q = urllib.parse.urlencode({'select': 'sofifa_id,fifa_year,name,club,league,age', 'fifa_year': f'eq.{y}', 'league': f'eq.{lg}', 'limit': '1000', 'offset': str(off)})
                d = json.loads(urllib.request.urlopen(urllib.request.Request(URL + '?' + q, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY}), timeout=60).read())
                rows += d; off += 1000
                if len(d) < 1000: break
    json.dump(rows, open(path, 'w'), ensure_ascii=False); return rows
class SeasonFaces:
    def __init__(self, data_dir, img_dir, teams=None):
        self.img = img_dir; p = os.path.join(data_dir, '..', 'sofifa_top5.json')
        rows = json.load(open(p)) if os.path.exists(p) else pull(p)
        self.by = {}
        for r in rows: self.by.setdefault((r['fifa_year'], r['league']), []).append(r)
        tp = os.path.join(data_dir, 'twin_teams.json'); self.teams = teams or ({k: v.get('name') for k, v in json.load(open(tp)).items()} if os.path.exists(tp) else {})
        cp = os.path.join(data_dir, '..', 'season_faces.json'); self.cache_path = cp; self.cache = json.load(open(cp)) if os.path.exists(cp) else {}
    def match(self, name, season, league, team_id=None):
        fy = int(season[:4]) + 1; cands = self.by.get((fy, league), [])
        full = norm(name); club = norm(self.teams.get(str(team_id), '') or '')
        best = None
        for r in cands:
            sn = norm(r['name'])
            words = [w for w in sn if len(w) > 1]; inits = [w for w in sn if len(w) == 1]
            if not words: continue
            if not all(w in full for w in words): continue                                    # "M. Salah" -> "salah" must be in "mohamed salah"
            if inits and not any(f.startswith(inits[0]) for f in full[:len(full) - len(words)] or full): continue
            sc = len(words) * 2 + (2 if not inits and len(words) == len(full) else 0)
            if club: sc += 2 * difflib.SequenceMatcher(None, ' '.join(club), ' '.join(norm(r['club']))).ratio()
            if best is None or sc > best[0]: best = (sc, r)
        return best[1] if best else None
    def face(self, fotmob_id, name, season, league, team_id=None):
        """-> image key for that season's face, or None"""
        ck = f"{fotmob_id}|{season}"
        if ck in self.cache:
            k = self.cache[ck]
            if k is None: return None                                                   # looked before: no photo for that season
            if os.path.exists(os.path.join(self.img, k + '.png')): return k             # a cached hit in another picture folder is fetched again
        r = self.match(name, season, league, team_id); k = None
        if r:
            yy = str(int(season[:4]) + 1)[2:]
            for u in (f"https://cdn.futbin.com/content/fifa{yy}/img/players/{r['sofifa_id']}.png", f"https://cdn.futwiz.com/assets/img/fifa{yy}/faces/{r['sofifa_id']}.png"):
                try:
                    b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
                    if b[:8] == b'\x89PNG\r\n\x1a\n' and len(b) > 3000:
                        k = f"p{fotmob_id}y{yy}"; open(os.path.join(self.img, k + '.png'), 'wb').write(b); break
                except Exception: pass
        self.cache[ck] = k; json.dump(self.cache, open(self.cache_path, 'w'))
        return k
