"""Builds the lib/patchNotesData.ts entries for the 16 pages (19-20 Oct 2026) from the built pages."""
import re, json, html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from index19 import PAGES, ORDER_NIGHT, ORDER_19, ok_blocks

R = os.path.dirname(os.path.abspath(__file__)) + '/'
urls = json.load(open(R + 'urls.json'))

# key -> (version, publishedAt)
ORDER = [  # oldest first
 ('a19team', '2026-10-19T04:00:00Z'), ('a19scene', '2026-10-19T16:00:00Z'), ('a19drift', '2026-10-19T18:00:00Z'),
 ('a19fhr', '2026-10-19T19:00:00Z'), ('a19data', '2026-10-19T20:00:00Z'), ('a19admin', '2026-10-19T21:30:00Z'),
 ('b1', '2026-10-20T04:00:00Z'), ('b3', '2026-10-20T04:05:00Z'), ('b4', '2026-10-20T04:10:00Z'), ('b5', '2026-10-20T04:15:00Z'),
 ('b6', '2026-10-20T04:20:00Z'), ('b7', '2026-10-20T04:25:00Z'), ('b8', '2026-10-20T04:30:00Z'), ('b9', '2026-10-20T04:35:00Z'),
 ('b11', '2026-10-20T04:40:00Z'), ('last2', '2026-10-20T12:00:00Z'),
]

SUM = {
 'a19team': "Team Room v1 (19 Oct). The team's room in the admin: a chat bubble on every admin page, an Ideas board (Idea, Doing, Done, three vote dots), Team chat and a To-do list, plus notes on pushes, a portable kit, a folding side menu, the KIB Admin home-screen app and recordings in a folder per person. Database file run by Mikey on 19 Oct. Round two is the B11 page.",
 'a19scene': "Scene Editor 3a (19 Oct). The 3D Signing and the Manager's Office play live in the scene editor (camera, lens, light, exposure). The edits stayed on the device and in the team database; the game did not read them until B6. Also: how generated cut scenes work (two kinds, a 5-step flow, four made-up scenes) and the 3D audit with its 10-phase plan.",
 'a19drift': "Drift + Play Screens (19 Oct). Eight football screens drew the pitch narrower than the real match (kick strength was never off); they now draw it at 366 px on a phone and 384 on a computer. Play buttons stay on screen. The engine and drift warning is now red and asks on every edit. A drift audit of every football screen, and a touch check (27 found, 0 stop a finger in the game).",
 'a19fhr': "Highlights Rebuild phases 0 to 2 (19 Oct), behind a switch that is Off by default: the switch and the ruler, the match-camera still (0 mismatches in 100), and generated 4 to 8 second build-ups before open-play chances (0 of 448 failed the checks). Phase 3 is next; Harry said go and gave the engine OK on 20 Oct.",
 'a19data': "Free Data v1 (19 Oct). 2,104 real matches under free licences (Wyscout 1,941, Afriskaut 136, SkillCorner 20, IDSSE / DFL 7). Real moments (702), Real shots (2,875) and Real Goals (232 levels) rebuilt on them. StatsBomb deleted, because its licence does not allow a paid game.",
 'a19admin': "Admin Split + Looks (19 Oct, with two 20 Oct changes). The admin is split by game (three tabs), group pages show picture cards in Admin tools and Test pages, Broadcast and Bento join Ops room and Clean light on one layout, 36 admin pages sit on the Broadcast frame, and the phone admin is tidier (first box 430 to 223 px). Clean light is the default look. Harry's answers A-1 to A-9 are marked.",
 'b1': "B1 Touch Fixes (overnight 20 Oct). All 27 touch fixes built (G5, the in-match button sizes, done after Harry's OK). The 4 old failing tests pass with the limits not loosened. Wembley's stronger striker no longer hits the bar. Player of the Month cards draw heads, 0 broken images.",
 'b3': "B3 Real Data (overnight 20 Oct). Afriskaut removed; SoccerTrack v2 and SkillCorner added (matches 2,104 to 1,983; fully real moments 702 to 926). Data credits in Settings. A Real moment highlights switch serves real moments in 1 in 4 open-play chances. A Real moments page to choose which moments the game may use. Database file waiting for Mikey.",
 'b4': "B4 Admin Skins (overnight 20 Oct). All four admin looks share one layout, one back arrow top left, a 40 px chat bubble that lets taps through, an ink guard for unreadable words in light looks, and a Research area. Clean light is the default look.",
 'b5': "B5 3D Looks (overnight 20 Oct). Skin in the 3D cut scenes is natural (yellow skin 94% to 0% in the signing scene). Cut-scene cameras fit a phone (bad shots to 0). Faces blink, glance and speak. The Home player is alive in a 33-second loop. A bench page compares the same 10 shots. Two clips.",
 'b6': "B6 Scene Studio (overnight 20 Oct). The 3D Shop, Garden and House edit live in the scene editor. Approve an edit and choose where and when the game uses it. Commit to game writes approved edits to the repo (needs a GitHub token). A Scene generator makes cut scenes from a game event, with a 'When does this play?' table (all 18 Not wired). The last 6 admin pages are on the Broadcast frame.",
 'b7': "B7 Training Levels (overnight 20 Oct). All 150 training levels are data and editable on a page (Play, Save, Commit, Undo). Vision level 30 is much harder (11 team-mates, 13 defenders, first-try pass rate 67% to 41%) and Pace climbs (28% flat to 43, 22, 14%). Harry's answer on the skills slider is queued as B7b.",
 'b8': "B8 Five-a-side (overnight 20 Oct). A test area at /star-fiveaside-dev with Scenarios, Full match (with a new live radar of all 10 players and the ball) and Data from 500 simulated matches. A full-time scene drawn the wrong way round is fixed. Two things are broken and need gameplay calls: a pass never becomes a team-mate's shot (0 of 1,000), and chance pictures 1 and 6 never score. One clip.",
 'b9': "B9 Lower League Trophy (overnight 20 Oct). A new cup for 120 lower-league clubs (128-slot draw, 8 byes, 7 midweek rounds, 119 matches; tested over 200 seasons). Prize: trophy, 30,000 XP, fame +2, a small transfer-interest boost, and a cash prize Harry kept. Hold anywhere after a match for 4x; double-tap to skip.",
 'b11': "B11 Team Room round two (overnight 20 Oct). Seen faces under messages, quoted replies, @ and # suggestions, page cards, Shift+X pointing at part of a screen, and patch-note read receipts (Read by faces, Read and understood, a notes thread, 'N patch notes to read' on the Team board). Database file waiting for Mikey.",
 'last2': "Last 2 Days Patch Notes (index, 19 to 20 Oct). One page per build in three tabs (Overnight, 19 Oct, Still building), how these patch notes work, every open question in one list and Harry's decided answers. Press Read and understood on each page.",
}

STATS = {
 'a19team': [('4', 'views: Board, Ideas, Chat, To-do'), ('3', 'idea stages, with 3 vote dots each'), ('40 px', 'later chat bubble size (B4)'), ('24 h', 'a ticked job stays, then leaves')],
 'a19scene': [('2', '3D places edited live (Signing, Office)'), ('4', 'made-up scenes shown (film-rules score 100, 100, 100, 91%)'), ('14 of 23', 'audit shots too tight on a phone'), ('52', 'stills in the 3D audit')],
 'a19drift': [('8', 'screens drew the pitch too small, now fixed'), ('318 → 366 px', 'Real moments pitch on a phone'), ('27', 'touch problems found (0 stop a finger in the game)'), ('15', 'screens measured at 390 and 1440 px')],
 'a19fhr': [('3', 'phases done (0 to 2)'), ('0 of 448', 'build-ups that failed the checks'), ('2,197 of 2,527', 'build-ups on different routes'), ('5.81 / 2.31', 'chances and goals per match, unchanged')],
 'a19data': [('2,104', 'real matches under free licences'), ('702', 'fully real moments'), ('2,875', 'real shots'), ('232', 'Real Goals levels')],
 'a19admin': [('3', 'game tabs in the admin'), ('430 → 223 px', 'first group box on a phone'), ('36', 'admin pages on the Broadcast frame'), ('4', 'looks on one layout')],
 'b1': [('27 of 27', 'touch fixes built'), ('4', 'old failing tests now pass'), ('23% → 40%', 'Wembley: 80-rated striker win share'), ('11', 'drawn heads, 0 broken images')],
 'b3': [('2,104 → 1,983', 'matches'), ('702 → 926', 'fully real moments'), ('67 → 93', 'real goals'), ('24.5%', 'open-play chances served as real moments')],
 'b4': [('4', 'looks, one layout'), ('50 → 40 px', 'chat bubble'), ('320 → 0–3', 'unreadable words per page, light looks'), ('1', 'back arrow, top left')],
 'b5': [('94% → 0%', 'yellow skin in the signing scene'), ('27 of 65 → 0', 'bad mid-shot cameras on a phone'), ('33 s', 'Home player loop'), ('2', 'clips')],
 'b6': [('3', 'more places edit live (shop, garden, house)'), ('18', 'events in the Scene generator'), ('18 of 18', '"When does this play?" rows say Not wired'), ('37 → 43 of 43', 'admin pages on the Broadcast frame')],
 'b7': [('150', 'training levels now editable'), ('67% → 41%', 'Vision level 30 first-try pass rate'), ('28% → 14%', 'Pace level 30 runs cleared'), ('11 and 13', 'team-mates and defenders at Vision level 30')],
 'b8': [('3', 'tabs: Scenarios, Full match, Data'), ('56%', 'matches won in 500 simulated'), ('0 of 1,000', 'passes that become a team-mate shot'), ('2 of 8', 'checks fail on the Data tab')],
 'b9': [('120', 'clubs in the Lower League Trophy'), ('119', 'matches in 7 rounds'), ('200 of 200', 'seasons tested with a winner'), ('3.4 s → 1.1 s', 'star bar when held (4x)')],
 'b11': [('3', 'faces under each message (H, M, L)'), ('4', 'new ways to talk: reply, @, #, point'), ('Shift+X', 'points at part of a screen'), ('1', 'database file waiting (team_room_v2.sql)')],
}

def clean(t, n=None):
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    t = re.sub(r'\s+', ' ', t).strip()
    if n and len(t) > n:
        cut = t[:n]
        i = max(cut.rfind('. '), cut.rfind('; '))
        t = (cut[:i + 1] if i > n * 0.5 else cut.rsplit(' ', 1)[0] + '…')
    return t

KIND = {'FIXED': 'fixed', 'ADDED': 'added', 'CHANGED': 'changed', 'KNOWN ISSUES': 'known', 'NEXT': 'next'}
LABEL = {'fixed': 'Fixed', 'added': 'Added', 'changed': 'Changed', 'known': 'Known issues', 'next': 'Next'}

def parse(key):
    s = open(R + key + '/index.html', encoding='utf-8').read()
    # check these
    checks = re.findall(r'<span class="q">(.*?)</span><span class="a">(.*?)</span>', s, flags=re.S)
    # sections
    parts = re.split(r'(<h2 class="(?:fix|add|chg|bug|nxt)"[^>]*><i></i>[^<]*</h2>)', s)
    secs = []
    for i in range(1, len(parts), 2):
        head = re.search(r'</i>([^<]*)</h2>', parts[i]).group(1).strip()
        name = head.split(' · ')[0]
        if name not in KIND: continue
        body = parts[i + 1]
        items = []
        for m in re.finditer(r'<div class="item"><div class="ih"><b>(.*?)</b>(.*?)</div>(.*?)(?=<div class="item">|$)', body, flags=re.S):
            title = clean(m.group(1))
            rest = m.group(3)
            rows = re.findall(r'<div class="row"><div class="rl [a-z]">([^<]*)</div>(.*?)</div>(?=<div class="row">|<div class="bars">|<div class="figs|<details|<figure|<div class="tile">|<p class="bnote">|<div class="mock|$)', rest, flags=re.S)
            rowd = {k.strip(): v for k, v in rows}
            src = rowd.get('Fix') or rowd.get('Status') or rowd.get('Problem / Why') or rowd.get('Problem') or ''
            items.append({'title': title, 'detail': clean(src, 230)})
        if items: secs.append((KIND[name], items))
    return checks, secs

def esc(s): return json.dumps(s, ensure_ascii=False)

def entry(key, pub, ver):
    if key == 'last2':
        _, n_open, n_done = ok_blocks(urls, 'all')
        stats = [('15', 'pages of patch notes'), ('8', 'questions still open'), ('11', 'answers already decided'), ('v0.60 to v0.74', 'the pages, one version each')]
        stats[1] = (str(n_open), 'questions still open'); stats[2] = (str(n_done), 'answers already decided')
        sections = [
            ('added', 'Check these', [('Open the three tabs', 'Overnight 20 Oct (9 pages), 19 Oct (6 pages), Still building.'), ('Read how these patch notes work', 'One page per build: Check these, Problem, Why, Fix, the seen / measured / reasoned tag, Needs your OK.'), ('Press Read and understood on each version', 'Admin, Patch notes, pick v0.60 to v0.74, press the button. The Team board counts what is left.')]),
            ('added', 'The pages', [(PAGES[k][0] + ' (v' + PAGES[k][1] + ')', clean(PAGES[k][2])) for k in ORDER_19 + ORDER_NIGHT]),
        ]
        sec_out = sections
    else:
        checks, secs = parse(key)
        stats = STATS[key]
        sec_out = [('added', 'Check these', [(clean(q), clean(a, 200)) for q, a in checks])]
        for kind, items in secs:
            sec_out.append((kind, LABEL[kind], [(it['title'], it['detail']) for it in items]))
    name = PAGES[key][0] if key != 'last2' else 'Last 2 Days Patch Notes'
    out = []
    out.append('    {')
    out.append('      "version": %s,' % esc(ver))
    out.append('      "title": %s,' % esc("Harry's patch notes: " + name))
    out.append('      "publishedAt": %s,' % esc(pub))
    out.append('      "updatedAt": null,')
    out.append('      "artifactUrl": %s,' % esc(urls[key]))
    out.append('      "summary": %s,' % esc(SUM[key]))
    out.append('      "stats": [')
    out.append(',\n'.join('        { "value": %s, "label": %s }' % (esc(v), esc(l)) for v, l in stats))
    out.append('      ],')
    out.append('      "sections": [')
    secs_txt = []
    for kind, title, items in sec_out:
        it = ',\n'.join('          { "title": %s%s }' % (esc(t), (', "detail": ' + esc(d)) if d else '') for t, d in items)
        secs_txt.append('        { "kind": %s, "title": %s, "items": [\n%s\n        ]}' % (esc(kind), esc(title), it))
    out.append(',\n'.join(secs_txt))
    out.append('      ]')
    out.append('    },')
    return '\n'.join(out)

if __name__ == '__main__':
    blocks = []
    for key, pub in reversed(ORDER):  # newest first
        ver = PAGES[key][1] if key != 'last2' else '0.75'
        blocks.append(entry(key, pub, ver))
    open(R + 'patchdata.ts.txt', 'w', encoding='utf-8').write('\n'.join(blocks) + '\n')
    print(len(blocks), 'entries;', sum(len(b) for b in blocks), 'chars')
