"""Builds the lib/patchNotesData.ts entries for the 16 pages (19-20 Oct 2026) from the built pages."""
import re, json, html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from index19 import PAGES, ORDER_NIGHT, ORDER_19, ok_blocks

R = (os.environ.get('PN_OUT') or os.path.dirname(os.path.abspath(__file__))) + '/'
urls = json.load(open(R + 'urls.json'))

# key -> (version, publishedAt)
ORDER = [  # oldest first
 ('a19team', '2026-10-19T04:00:00Z'), ('a19scene', '2026-10-19T16:00:00Z'), ('a19drift', '2026-10-19T18:00:00Z'),
 ('a19fhr', '2026-10-19T19:00:00Z'), ('a19data', '2026-10-19T20:00:00Z'), ('a19admin', '2026-10-19T21:30:00Z'),
 ('b1', '2026-10-20T04:00:00Z'), ('b3', '2026-10-20T04:05:00Z'), ('b4', '2026-10-20T04:10:00Z'), ('b5', '2026-10-20T04:15:00Z'),
 ('b6', '2026-10-20T04:20:00Z'), ('b7', '2026-10-20T04:25:00Z'), ('b8', '2026-10-20T04:30:00Z'), ('b9', '2026-10-20T04:35:00Z'),
 ('b11', '2026-10-20T04:40:00Z'), ('last2', '2026-10-20T12:00:00Z'),
 ('b12', '2026-10-20T12:05:00Z'), ('b7b', '2026-10-20T12:10:00Z'), ('b13', '2026-10-20T12:15:00Z'), ('b15', '2026-10-20T12:20:00Z'), ('b9b', '2026-10-20T12:25:00Z'), ('b16', '2026-10-20T12:30:00Z'),
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
 'b12': "B12 Pick the Pass (20 Oct). Vision training is rebuilt: each try is a real moment from a tracked match (263 real passes plus the team's drawn chances), you pick who gets the pass, and from level 10 you kick it yourself, starting inside 1.8 s down to 0.3 s. After each try a one-line reason (RIGHT MAN, OFFSIDE, CUT OUT, MARKED, TOO SLOW). A modelled good player passes it first time 99% at level 1 down to 21% at level 30. One clip.",
 'b7b': "B7b Training Editor (20 Oct). Drag the ball, cones and men on the level's picture like the gallery (Undo, Undo all, Play uses the dragged picture). No 'your skills' slider: a level plays with the skills you would have after the levels before it. Pace now has a knock-on: one man comes for the ball, flick past him when his ring turns green. Known: the Training levels page freezes on the second tab switch. One clip.",
 'b13': "B13 Fixtures + Admin Fixes (20 Oct). A checker played 5 seasons in every division and found 170 fixture clashes; now 0. XP Rewards loads on a test build with a read-only note, the chat bubble no longer covers 'Next line', and the Team board counts real pushes (Harry 166, Mikey 34, Leo 21). Limit left: a Championship club in Europe winning everything needs 38 midweeks, a season has 34.",
 'b15': "B15 3D Headshots (20 Oct). Player of the Month, the season awards and the Ballon d'Or show a head-and-shoulders picture from our 3D model in the player's club kit, instead of drawn heads and made-up photo faces. Made once and kept on the device. Known: blond hair also colours eyebrows and beard on dark skin; team sheets still drawn.",
 'b9b': "B9b Cup Screens (20 Oct). The Lower League Trophy tab fits one screen (it was a 56-row list), with the cup's own screen for your road, the bracket and every round. The FA Cup and League Cup work the same way. Open: a Premier League career still sees the Trophy tab as Not in it; the cup shows a trophy emoji for now.",
 'b16': "B16 Fairer 3D Keepers (20 Oct). The keepers in Free Roam, Headers & Volleys and Wembley now save about 1 shot in 3 for a decent player (it was 52 to 70%). His cover had a hard edge; it is now a slope. Wembley's keeper 70 to 66, sessions 146 s to 83 s, Headers & Volleys win bar 6 to 8. Known: high-skill players blaze over in 3D (about 78% from 12 to 20 m). One clip.",
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
 'b12': [('263', 'real passes in Vision pictures'), ('99% to 21%', 'first-try pass rate, level 1 to 30 (modelled)'), ('0.3 s', 'time to start the kick from level 28'), ('45', 'different pictures in 90 tries (was 32)')],
 'b7b': [('4', 'drills with drag and drop (not Vision)'), ('0', 'skills sliders (a level works its own out)'), ('0.30 to 0.05 s', 'Pace ring window, weak man to best'), ('56% to 29%', 'hasty bot clears, levels 11 to 20')],
 'b13': [('170 to 0', 'fixture clashes over 45 seasons'), ('9', 'division setups checked'), ('132 px', 'bubble moves up in the Manager office'), ('166 / 34 / 21', 'pushes this week: Harry, Mikey, Leo')],
 'b15': [('3', 'award screens with 3D headshots'), ('13', 'faces in 0.5 s on the second visit (~6 s first)'), ('~10 KB', 'per picture, kept on the device'), ('0', 'blank circles when 3D is missing')],
 'b16': [('70% to 33%', 'Free Roam: decent player saved (600 shots)'), ('69% to 33%', 'Wembley: decent player saved'), ('146 s to 83 s', 'Wembley session length'), ('78%', 'of firm 3D shots from 12 to 20 m go over (not fixed)')],
 'b9b': [('56 rows to 1', 'screens for the Trophy tab'), ('3', 'domestic cups on one screen'), ('7', 'rounds on the road'), ('1-1, 4-3 pens', 'Round 1 played in the real game')],
}

def clean(t, n=None):
    t = re.sub(r'</?(?:li|ul|ol|p)(?:\s[^>]*)?>', ' ', t)   # list items and paragraphs stay apart (added 20 Oct)
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
        stats = [(str(len(ORDER_19 + ORDER_NIGHT)), 'pages of patch notes'), ('8', 'questions still open'), ('11', 'answers already decided'), ('v0.60h to v0.81', 'the pages, one version each (v0.75 is this index)')]
        stats[1] = (str(n_open), 'questions still open'); stats[2] = (str(n_done), 'answers already decided')
        sections = [
            ('added', 'Check these', [('Open the three tabs', 'Overnight 20 Oct (%d pages), 19 Oct (%d pages), Still building.' % (len(ORDER_NIGHT), len(ORDER_19))), ('Read how these patch notes work', 'One page per build: Check these, Problem, Why, Fix, the seen / measured / reasoned tag, Needs your OK.'), ('Press Read and understood on each version', 'Admin, Patch notes, pick v0.60h to v0.81 (not v0.75, the index), press the button. The Team board counts what is left.')]),
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
    only = sys.argv[1:]
    for key, pub in reversed(ORDER):  # newest first
        if only and key not in only: continue
        ver = PAGES[key][1] if key != 'last2' else '0.75'
        blocks.append(entry(key, pub, ver))
    open(R + 'patchdata.ts.txt', 'w', encoding='utf-8').write('\n'.join(blocks) + '\n')
    print(len(blocks), 'entries;', sum(len(b) for b in blocks), 'chars')
