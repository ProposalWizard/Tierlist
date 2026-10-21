# The index (v0.75) with four tabs: Overnight work, Team board & team updates, Admin pages & skins, Everything else.
# The combined Needs your OK / Already decided lists are grouped by tab. Each question appears once.
from lib import *
from index19 import PAGES, ORDER_NIGHT, card, soon, okline, donel
from topics import URLS, OLD19, lnk

TOPIC = {
    't82': ('Team Board & Team Updates', '0.82', 'The team room shows who has seen each message, quotes replies, tags people and pages, points at the screen and tracks who read each patch note. Plus the bubble, the push counts and the patch-notes list.'),
    't83': ('Admin Pages & Skins', '0.83', 'The admin split by game, picture-card group pages, four looks on one layout (Clean light first), one back arrow, 45 of 45 pages on the frame, the phone admin and the eye guides.'),
    't84': ('Everything Else', '0.84', 'Every football screen at the real match&rsquo;s size, the red engine warning, the highlights rebuild phases 0 to 2, the free data, the scene editor and the 3D audit.'),
}

def tcard(key, nopen):
    name, ver, line = TOPIC[key]
    link = URLS.get(key, '#')
    ok = ('<span class="pill p-blu">%d need your OK</span>' % nopen) if nopen else '<span class="pill p-grn">nothing waiting</span>'
    return ('<a class="bcard" href="%s" target="_blank" rel="noopener"><div class="n"><b>%s</b><span class="pill p-amb">Harry branch &middot; not live</span>%s</div>'
            '<p>%s</p><div class="vtag">v%s in Admin &rarr; Patch notes &middot; a full write-up of the topic</div><span class="go">Open the notes &rarr;</span></a>') % (link, name, ok, line, ver)


def earlier(label, ver, line, url):
    return ('<li><b>%s</b> &middot; %s &middot; <a href="%s" target="_blank" rel="noopener">earlier page</a><br>%s</li>' % (label, ('v' + ver) if ver else '19 Oct', url, line))


def qlist(items):
    return '<div class="qlist"><ul>%s</ul></div>' % ''.join(items)


def also(key, line):
    return '<li>%s <span class="vtag">v%s</span>. %s</li>' % (lnk(key, '<b>%s</b>' % PAGES[key][0]), PAGES[key][1], line)


def overnight_open(urls):
    return [
        okline('Five-a-side: a pass to a team-mate in the last third never becomes his shot. Fix it?', [('fix it', 'p-amb'), ('leave it', 'p-blu')],
               '0 of 1,000 passes became a shot, so you can never get an assist.', URLS, [('b8', 'B8 page')], who='Gameplay call'),
        okline('Five-a-side: chance pictures 1 and 6 never score for the bot. Redraw them?', [('redraw', 'p-amb'), ('leave', 'p-blu')],
               '0 goals in 200 tries on each. 66% and 99.5% of shots are blocked.', URLS, [('b8', 'B8 page')], who='Gameplay call'),
        okline('Vision level 30: about right? (A good player passes it 21% first try.)', [('keep', 'p-grn'), ('easier', 'p-blu'), ('harder', 'p-amb')],
               'Vision was rebuilt as Pick the Pass. A modelled good player picks and kicks the right man first time 21% of the time at level 30.', URLS, [('b12', 'B12 page')], who='Your call'),
        okline('Only 5 real offside pictures for 13 offside levels. Add drawn ones?', [('add drawn ones', 'p-amb'), ('leave it', 'p-blu')],
               'One real offside picture comes back on 6 levels.', URLS, [('b12', 'B12 page')], who='Your call'),
        okline('Power levels are always eased in a career. OK as it is?', [('fine', 'p-grn'), ('play as drawn', 'p-amb')],
               'At 2 stars a level a career player is always behind on Power levels. Level 20 draws 26 m and plays at 22 m. It is only visible now.', URLS, [('b7b', 'B7b page')], who='Your call'),
        okline('A Championship club in Europe that wins everything needs 38 midweeks. A season has 34. Leave it?', [('leave it', 'p-grn'), ('fix it', 'p-amb')],
               '56 clashes became 20, all from deep runs, none before 1 January. Not counted in the 0.', URLS, [('b13', 'B13 page')], who='Your call'),
        okline('Show the 3D headshot on the team sheets too? (A one-line swap.)', [('swap them', 'p-grn'), ('leave drawn', 'p-blu')],
               'Team sheets still show the drawn head. The scout report, transfers panel, and league and matchday screens would take more work.', URLS, [('b15', 'B15 page')], who='Your call'),
        okline('Fix the blond hair colour that also goes on eyebrows and beard?', [('fix it', 'p-amb'), ('leave it', 'p-blu')],
               'On dark skin, close up, it reads oddly. It is the shared 3D look, so a fix also changes the match men.', URLS, [('b15', 'B15 page')], who='Your call'),
        okline('Hide the Trophy tab for a Premier League career?', [('hide it', 'p-grn'), ('keep it', 'p-blu')],
               'A Premier League career is never in the Trophy, so the tab only says Not in it.', URLS, [('b9b', 'B9b page')], who='Your call'),
        okline('A Trophy picture instead of the emoji?', [('make one', 'p-amb'), ('emoji for now', 'p-blu')],
               'The cups show a trophy emoji until a real picture is made.', URLS, [('b9b', 'B9b page')], who='Your call'),
        okline('Headers &amp; Volleys: move the win bar from 6 to 8 points?', [('keep 8', 'p-grn'), ('keep 6', 'p-blu')],
               'At 6 the average bot would win 82% of its sessions. At 8 it wins 53%, the same as before.', URLS, [('b16', 'B16 page')], who='Your call'),
        okline('High-skill players blaze over in 3D: fix it?', [('fix it', 'p-amb'), ('leave it', 'p-blu')],
               'A 3D swipe always strikes the middle of the ball, so an 80-power firm shot from 12 to 20 m goes over about 78% of the time.', URLS, [('b16', 'B16 page')], who='Your call'),
        okline('Run the fixture checker again after Mikey&rsquo;s ten-round FA Cup merges?', [('yes', 'p-grn'), ('skip', 'p-blu')],
               'His change touches the same calendar. The 0 clashes is for today&rsquo;s calendar.', URLS, [('b13', 'B13 page')], who='For Mikey'),
        okline('Run star_training_levels.sql', [('database file', 'p-amb')],
               'Until it runs, a saved training-level edit stays on that device only and the page says so. Commit still works (needs GITHUB_TOKEN).', URLS, [('b7', 'B7 page')], who='For Mikey'),
    ]


def overnight_done():
    return [
        donel('Lower League Trophy: pay a cash prize of 2 weeks&rsquo; wage?', 'Harry, 20 Oct', 'Keep it (&ldquo;pretty cool&rdquo;).'),
        donel('Wembley change: keep?', 'Harry, 20 Oct', 'Keep. B16 checked it: Wembley&rsquo;s keeper moved from 70 to 66, like the other two games (v0.81).'),
        donel('FA Cup Round of 64 date', 'Harry, 20 Oct', 'Fix it, and more: check every fixture date. Done in B13 (v0.78): 170 clashes became 0.'),
        donel('Training &ldquo;your skills&rdquo; sliders?', 'Harry, 20 Oct', 'No slider. A level plays with the skill you would have after finishing the levels before it. Done in B7b (v0.77).'),
        donel('Player of the Month and similar cards: 3D headshots', 'Harry, 20 Oct', 'Headshots from our 3D model, not the old drawn heads. Done in B15 (v0.79).'),
        donel('Lower League Trophy: its own screen?', 'Harry, 20 Oct', 'Yes, like the FA Cup and international ones. Done in B9b (v0.80), with the FA Cup and League Cup on the same screen.'),
        donel('Vision training: how should it work?', 'Harry, 20 Oct', 'Real scenarios: who should I pass to, someone offside, less time, a real kick inside 0.3 s. Done in B12 (v0.76).'),
        donel('How strong should keepers be in the 3D minigames?', 'Harry, 20 Oct', 'Fair is about 1 shot in 3 saved. Done in B16 (v0.81).'),
    ]


def n_page_open(spec):
    return sum(1 for o in spec['ok'] if not o.get('done'))


def spec_items(spec, seen):
    """Open and decided items from a topic page's own list. A question already listed under an earlier tab is not repeated."""
    opens, dones = [], []
    for o in spec['ok']:
        if o['q'] in seen:
            continue
        seen.add(o['q'])
        if o.get('done'):
            dones.append(donel(o['q'], o.get('by', 'Decided'), o['done']))
        else:
            opens.append(okline(o['q'], o['opts'], o['d'], who=o.get('who')))
    return opens, dones


def build_topic_index(urls, nopen, specs):
    seen = set()
    team_o, team_d = spec_items(specs['t82'], seen)
    admin_o, admin_d = spec_items(specs['t83'], seen)
    else_o, else_d = spec_items(specs['t84'], seen)
    night_o, night_d = overnight_open(urls), overnight_done()
    groups = [('Overnight work', night_o, night_d), ('Team board &amp; team updates', team_o, team_d),
              ('Admin pages &amp; skins', admin_o, admin_d), ('Everything else', else_o, else_d)]
    n_open = sum(len(g[1]) for g in groups)
    n_done = sum(len(g[2]) for g in groups)
    open_html = ''.join('<h3 class="grp">%s &middot; %d</h3><div class="okbox"><ol>%s</ol></div>' % (g[0], len(g[1]), ''.join(g[1])) for g in groups if g[1])
    done_html = ''.join('<h3 class="grp">%s &middot; %d</h3><div class="donebox"><ul>%s</ul></div>' % (g[0], len(g[2]), ''.join(g[2])) for g in groups if g[2])
    oks = ('<h2 class="bug" id="ok"><i></i>NEEDS YOUR OK</h2><p class="snote">Open items from every page, in one list, grouped by tab. Each page has its own list too.</p>' + open_html +
           '<h2 class="fix"><i></i>ALREADY DECIDED</h2><p class="snote">Harry&rsquo;s answers. These are closed.</p>' + details('%d answers already decided, by tab' % n_done, done_html))

    night = ''.join(card(k, urls, nopen) for k in ORDER_NIGHT)
    still = (soon('B2 Highlights phase 3', 'Players already moving when your chance starts, behind the switch. Engine OK given (20 Oct). No report yet.', 'next', 'p-amb') +
             soon('B10 Headers and volleys', 'Back on, with the ball in the air and a shadow signal. Engine OK given (20 Oct). No report yet. Run one at a time.', 'next', 'p-amb') +
             soon('B14 Running after a chance', 'WASD and Shift on a PC, a stamina bar, auto run, and team-mates passing back to you. Queued from your 20 Oct feedback, after B2 and B10.', 'queued', 'p-blu') +
             soon('B17 A PC match layout', 'Like the five-a-side test area: pitch and a live radar side by side, first as a test area. Queued from your 20 Oct feedback.', 'queued', 'p-blu'))

    team_tab = (tcard('t82', n_page_open(specs['t82'])) +
                '<h3 class="grp">Earlier pages, now part of this one</h3>' +
                qlist([earlier('Team Room v1', '0.60h', 'A chat bubble on every admin page, an Ideas board, Team chat and a To-do list.', URLS['a19team']),
                       earlier('Admin home and Team board', None, 'The 19 Oct page for the admin home and the team board.', OLD19['adminhome'])]) +
                '<h3 class="grp">Overnight pages that also cover this</h3>' +
                qlist([also('b11', 'Seen faces, quoted replies, @ and # tags, Shift+X pointing and patch-note read receipts (20 stills).'),
                       also('b13', 'The Team board push counts and the &ldquo;GitHub refused the key&rdquo; fix, with the fixture dates.'),
                       also('b4', 'The smaller chat bubble that lets taps through.')]))
    admin_tab = (tcard('t83', n_page_open(specs['t83'])) +
                 '<h3 class="grp">Earlier pages, now part of this one</h3>' +
                 qlist([earlier('Admin Split + Looks', '0.65', 'The 19 Oct split by game, picture cards, looks and phone tidy.', URLS['a19admin']),
                        earlier('New-look admin pages', None, '30 pages, before and after (the 19 Oct page).', OLD19['newlook']),
                        earlier('Admin home and Team board', None, 'The 19 Oct page for the admin home and the team board.', OLD19['adminhome'])]) +
                 '<h3 class="grp">Overnight pages that also cover this</h3>' +
                 qlist([also('b4', 'One layout in four looks, the back arrow, the bubble and Research.'),
                        also('b6', 'The last 6 admin pages on the frame, plus the scene editor.'),
                        also('b13', 'The XP Rewards fix and the bubble above page buttons.'),
                        also('b1', 'The admin image grip and the other touch fixes.')]))
    else_tab = (tcard('t84', n_page_open(specs['t84'])) +
                '<h3 class="grp">Earlier pages, now part of this one</h3>' +
                qlist([earlier('Drift + Play Screens', '0.62h', 'Eight screens at the real match&rsquo;s size, play buttons on screen, the red engine warning.', URLS['a19drift']),
                       earlier('Highlights Rebuild 0-2', '0.63h', 'The switch, the match-camera still and generated build-ups.', URLS['a19fhr']),
                       earlier('Free Data v1', '0.64', '2,104 real matches under free licences. Real moments, Real shots, Real Goals.', URLS['a19data']),
                       earlier('Scene Editor 3a', '0.61h', 'The 3D Signing and Office edit live, how generated cut scenes work, the 3D audit.', URLS['a19scene']),
                       earlier('Everything in this round', None, 'The big 19 Oct page with every question.', OLD19['round'])]) +
                '<h3 class="grp">Other 19 Oct pages, no new page</h3>' +
                qlist(['<li><b>3D audit and plan.</b> <a href="%s" target="_blank" rel="noopener">Open it</a>. Its summary is on the Scene Editor 3a page and on this topic page.</li>' % OLD19['audit3d'],
                       '<li><b>FM research.</b> <a href="%s" target="_blank" rel="noopener">Learning from FM: top 10</a>, <a href="%s" target="_blank" rel="noopener">Highlights: learning from FM</a>, <a href="%s" target="_blank" rel="noopener">Full highlights rebuild: the plan</a>. The Research area in the admin holds the write-ups.</li>' % (OLD19['fm1'], OLD19['fm2'], OLD19['fm3']),
                       '<li><b>Mikey&rsquo;s asks</b> (Lower League Trophy, hold to speed up): built overnight in B9. Headers and volleys back: not built yet (B10).</li>']) +
                '<h3 class="grp">Overnight pages that also cover this</h3>' +
                qlist([also('b3', 'Afriskaut out, two sources in, credits in Settings, Real moment highlights.'),
                       also('b5', 'Natural skin, phone cameras, moving faces, a Home player who is alive.'),
                       also('b6', 'Shop, Garden and House in the scene editor, Approve, Commit to game, the scene generator.'),
                       also('b1', 'The 27 touch fixes.')]))

    body = f"""<title>Last 2 Days Patch Notes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{CSS}
  h3.grp{{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin:18px 0 8px}}
</style>
<div class="wrap">
<header>
  <span class="ver">LAST 2 DAYS &middot; 19&ndash;20 OCT 2026</span>
  <h1>The last 2 days in four tabs: the overnight builds, the team board, the admin, and everything else.</h1>
  <p class="status"><i></i>The 19 Oct work is on main. The overnight work and the 20 Oct parts of the topic pages are on the Harry branch, not live.</p>
  <p class="sub">Start with a topic page: each is a full write-up and links to the build pages for detail. Each page is its own version in Admin &rarr; Patch notes: v0.60h to v0.74, v0.76 to v0.81, and the three topic pages v0.82 to v0.84. This index is v0.75.</p>
  <div class="chips"><a class="chip hot" href="#ok">{n_open} open &darr;</a><a class="chip" href="#ok">{n_done} decided</a><a class="chip" href="#pages">The pages &darr;</a><a class="chip" href="#how">How this works</a></div>
</header>

{how_block(None)}

{oks}

<h2 class="nxt" id="pages"><i></i>THE PAGES</h2>
<div class="tabs" role="tablist" aria-label="Patch notes">
  <button class="tab" role="tab" data-p="p-night" aria-selected="true">Overnight work <small>15</small></button>
  <button class="tab" role="tab" data-p="p-team" aria-selected="false">Team board &amp; team updates <small>2</small></button>
  <button class="tab" role="tab" data-p="p-admin" aria-selected="false">Admin pages &amp; skins <small>2</small></button>
  <button class="tab" role="tab" data-p="p-else" aria-selected="false">Everything else <small>5</small></button>
</div>
<section class="panel" id="p-night" role="tabpanel"><p class="snote">Built overnight on the Harry branch. Not live. One page per build.</p><div class="cards">{night}</div><h3 class="grp">Still building</h3><div class="cards">{still}</div></section>
<section class="panel" id="p-team" role="tabpanel"><p class="snote">Everything the team uses: the room, the bubble, the board, the patch-notes list. The first card is the full write-up.</p><div class="cards">{team_tab}</div></section>
<section class="panel" id="p-admin" role="tabpanel"><p class="snote">The admin: game tabs, group pages, the looks, the frame, the phone view. The first card is the full write-up.</p><div class="cards">{admin_tab}</div></section>
<section class="panel" id="p-else" role="tabpanel"><p class="snote">Play screens, the highlights rebuild, the free data, the scene editor, the 3D audit. The first card is the full write-up.</p><div class="cards">{else_tab}</div></section>

<footer>20 Oct 2026. Every fact comes from the builders&rsquo; reports, the 19 Oct patch notes, the git log and Harry&rsquo;s answers file. Pictures are stills taken while checking the work.</footer>
</div>
<script>
(function(){{
  var tabs=document.querySelectorAll('.tab'), panels=document.querySelectorAll('.panel');
  function show(id){{
    for(var i=0;i<tabs.length;i++) tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-p')===id ? 'true' : 'false');
    for(var j=0;j<panels.length;j++) panels[j].hidden = panels[j].id!==id;
    try{{ localStorage.setItem('kib-last2days-tab-v2', id); }}catch(e){{}}
  }}
  for(var i=0;i<tabs.length;i++) (function(t){{ t.addEventListener('click', function(){{ show(t.getAttribute('data-p')); }}); }})(tabs[i]);
  var start='p-night'; try{{ start=localStorage.getItem('kib-last2days-tab-v2')||start; }}catch(e){{}}
  if(!document.getElementById(start)) start='p-night';
  show(start);
}})();
</script>
"""
    return body, n_open, n_done
