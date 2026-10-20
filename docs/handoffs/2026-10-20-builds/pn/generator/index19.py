from lib import *

# page registry: key -> (name, admin version, one line, group)
PAGES = {
 'b1':  ('B1 Touch Fixes', '0.66', 'All 27 touch fixes are built. The 4 old failing tests pass. Wembley is fairer.', 'night'),
 'b3':  ('B3 Real Data', '0.67', 'Afriskaut is out, two free sources are in, data credits are in Settings, and real moments can appear in your matches.', 'night'),
 'b4':  ('B4 Admin Skins', '0.68', 'The admin has one layout in four looks, one back arrow, a smaller chat bubble and a Research area. Clean light is the default.', 'night'),
 'b5':  ('B5 3D Looks', '0.69', 'Natural skin in the 3D cut scenes, phone cameras that fit, faces that move, and a Home player that is alive. Has two clips.', 'night'),
 'b6':  ('B6 Scene Studio', '0.70', 'Edit the 3D shop, garden and house live. Approve and commit edits. Make cut scenes from a game event.', 'night'),
 'b7':  ('B7 Training Levels', '0.71', 'All 150 training levels are editable. Vision level 30 and Pace are harder.', 'night'),
 'b8':  ('B8 Five-a-side', '0.72', 'A test area with Scenarios, a Full match with a live radar, and Data. Two things in it are broken. Has a clip.', 'night'),
 'b9':  ('B9 Lower League Trophy', '0.73', 'A new cup for 120 lower-league clubs. Hold to speed up and double-tap to skip after a match.', 'night'),
 'b11': ('B11 Team Room', '0.74', 'Seen faces, quoted replies, @ and # tags, Shift+X pointing and patch-note read receipts.', 'night'),
 'a19admin': ('Admin Split + Looks', '0.65', 'The admin is split by game, group pages show picture cards, four looks share one layout, the phone admin is tidier.', 'd19'),
 'a19team':  ('Team Room v1', '0.60', 'A chat bubble on every admin page, an Ideas board, Team chat and a To-do list.', 'd19'),
 'a19drift': ('Drift + Play Screens', '0.62', 'Eight screens now draw the pitch at the real match&rsquo;s size, play buttons stay on screen, and the engine warning is red.', 'd19'),
 'a19fhr':   ('Highlights Rebuild 0-2', '0.63', 'The switch, the match-camera still, and generated build-ups before open-play chances.', 'd19'),
 'a19data':  ('Free Data v1', '0.64', '2,104 real matches under free licences. Real moments, Real shots and Real Goals rebuilt. StatsBomb deleted.', 'd19'),
 'a19scene': ('Scene Editor 3a', '0.61', 'The 3D Signing and Office edit live in the scene editor. Also: how generated cut scenes work, and the 3D audit.', 'd19'),
}
ORDER_NIGHT = ['b1', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b11']
ORDER_19 = ['a19admin', 'a19team', 'a19drift', 'a19fhr', 'a19data', 'a19scene']

def card(key, urls, nopen):
    name, ver, line, grp = PAGES[key]
    link = urls.get(key, '#')
    branch = ('Harry branch · not live', 'p-amb') if grp == 'night' else ('on main · 20 Oct', 'p-grn')
    ok = ('<span class="pill p-blu">%d need your OK</span>' % nopen[key]) if nopen.get(key) else '<span class="pill p-grn">nothing waiting</span>'
    return ('<a class="bcard" href="%s" target="_blank" rel="noopener"><div class="n"><b>%s</b><span class="pill %s">%s</span>%s</div>'
            '<p>%s</p><div class="vtag">v%s in Admin &rarr; Patch notes</div><span class="go">Open the notes &rarr;</span></a>') % (link, name, branch[1], branch[0], ok, line, ver)

def soon(name, line, tag_='coming', cls='p-red'):
    return '<div class="bcard soon"><div class="n"><b>%s</b><span class="pill %s">%s</span></div><p>%s</p></div>' % (name, cls, tag_, line)

def okline(q, opts, d, urls=None, links=(), who=None):
    o = ''.join('<span class="pill %s">%s</span>' % (c, t) for t, c in opts)
    w = '<span class="who">%s</span>' % who if who else ''
    ls = ' '.join('<a href="%s" target="_blank" rel="noopener">%s</a>' % ((urls or {}).get(k, '#'), n) for k, n in links)
    return '<li><div class="q">%s%s</div><div class="opts">%s</div><div class="d">%s%s</div></li>' % (w, q, o, d, (' <b>' + ls + '</b>') if ls else '')

def donel(q, by, d):
    return '<li><div class="q">%s</div><div class="d"><span class="by">%s</span>%s</div></li>' % (q, by, d)

def ok_blocks(urls, scope):
    """scope: 'all' or 'night'."""
    open_items = [
        okline('Run 3 database files', [('database files', 'p-amb')],
               'Until they run, saves stay on the device and the screen says so. B11: team_room_v2.sql. B7: star_training_levels.sql. B3: star_real_moments_picks.sql.',
               urls, [('b11', 'B11'), ('b7', 'B7'), ('b3', 'B3')], who='For Mikey'),
        okline('Judge the walk-out wide shot on your phone.', [('fine', 'p-grn'), ('fix it', 'p-amb')],
               'Away players still pass about 1 m from the lens in the walk-out wide shot. It is the same as before B5. Harry to judge on his phone.', urls, [('b5', 'B5 page')], who='Your call'),
        okline('Five-a-side: a pass to a team-mate in the last third never becomes his shot. Fix it?', [('fix it', 'p-amb'), ('leave it', 'p-blu')],
               '0 of 1,000 passes became a shot, so you can never get an assist.', urls, [('b8', 'B8 page')], who='Gameplay call'),
        okline('Five-a-side: chance pictures 1 and 6 never score for the bot. Redraw them?', [('redraw', 'p-amb'), ('leave', 'p-blu')],
               '0 goals in 200 tries on each. 66% and 99.5% of shots are blocked.', urls, [('b8', 'B8 page')], who='Gameplay call'),
        okline('Is Vision level 30 about right?', [('keep', 'p-grn'), ('easier', 'p-blu'), ('harder', 'p-amb')],
               'A modelled player passes it first time 41% of the time. It was 67%.', urls, [('b7', 'B7 page')], who='Your call'),
        okline('Which generated cut scenes should play in the career first, and is GITHUB_TOKEN set on the live site?', [('pick rows', 'p-amb')],
               'All 18 rows say Not wired. Commit to game needs the token. Each commit rebuilds the live site.', urls, [('b6', 'B6 page')], who='Your call'),
        okline('Try the team room with two people on real phones once team_room_v2.sql has run.', [('yes', 'p-grn'), ('later', 'p-blu')],
               'The report says it was not tried with two people at once.', urls, [('b11', 'B11 page')]),
    ]
    if scope == 'all':
        open_items += [
            okline('Two older admin questions have no answer on record.', [('answer', 'p-amb')],
                   'Move the relationship games&rsquo; rules into the settings file? Move Goal videos to the new look only if it can really edit highlights?', urls, [('a19admin', 'Admin Split + Looks')], who='From 19 Oct'),
        ]
    done_items = [
        donel('Lower League Trophy: pay a cash prize of 2 weeks&rsquo; wage?', 'Harry, 20 Oct', 'Keep it (&ldquo;pretty cool&rdquo;).'),
        donel('In-match mute, TOUCH and Power buttons: resize in the match file?', 'Harry, 20 Oct', 'Yes. Done: size only, no game logic.'),
        donel('Wembley change: keep?', 'Harry, 20 Oct', 'Keep. B16 will measure keepers in the 3D minigames with it in mind.'),
        donel('3D garden, house, shop and 3D training: own back button?', 'Harry, 20 Oct', 'They keep their own. Everything else uses the one arrow.'),
        donel('Which admin look opens by default?', 'Harry, 20 Oct', 'Clean light (&ldquo;he preferred that&rdquo;). Done.'),
        donel('FA Cup Round of 64 date', 'Harry, 20 Oct', 'Fix it, and more: B13 will check every fixture date.'),
        donel('Engine OK for B2 (highlights phase 3) and B10 (headers and volleys)?', 'Harry, 20 Oct', 'Yes. Run one at a time; B14 after. The red warning still asks on every edit.'),
        donel('Training &ldquo;your skills&rdquo; sliders?', 'Harry, 20 Oct', 'No slider. A level plays with the skill you would have after finishing the levels before it (B7b).'),
        donel('How strong should keepers be in the 3D minigames?', 'Harry, 20 Oct', 'Fair is about 1 shot in 3 saved (B16).'),
        donel('Real moment highlights toggle inside the rebuild switch?', 'Harry, 19 Oct', 'Keep. He asked for it (DATA-2).'),
        donel('Delete raw downloaded data after use?', 'Harry, 20 Oct', 'Done for B3&rsquo;s 1.2 GB. The rule is in data/opendata/README.md.'),
    ]
    return (
        '<h2 class="bug" id="ok"><i></i>NEEDS YOUR OK</h2><p class="snote">Open items from every page, in one list. Each page has its own list too.</p>'
        '<div class="okbox"><ol>%s</ol></div>'
        '<h2 class="fix"><i></i>ALREADY DECIDED</h2><p class="snote">Harry&rsquo;s answers. These are closed.</p>'
        '<div class="donebox"><ul>%s</ul></div>') % (''.join(open_items), ''.join(done_items)), len(open_items), len(done_items)

def build_index(urls, nopen):
    oks, n_open, n_done = ok_blocks(urls, 'all')
    night = ''.join(card(k, urls, nopen) for k in ORDER_NIGHT)
    d19 = ''.join(card(k, urls, nopen) for k in ORDER_19)
    also = ('<h3 class="grp">Also from 19 Oct (no new page)</h3><div class="qlist"><ul>'
            '<li><b>3D audit and plan.</b> <a href="https://claude.ai/artifact/Gx6YJ9jdDbs7j9cfEfjS5S" target="_blank" rel="noopener">Open it</a>. Its summary is on the Scene Editor 3a page.</li>'
            '<li><b>FM research.</b> <a href="https://claude.ai/artifact/Ry521jLp2vKoSLnkJfZrgS" target="_blank" rel="noopener">Learning from FM: top 10</a>, <a href="https://claude.ai/artifact/QwdSLTFeLTHdE6V7LHXKEM" target="_blank" rel="noopener">Highlights: learning from FM</a>, <a href="https://claude.ai/artifact/MUyMrYBtjerjP4dXkJaMGZ" target="_blank" rel="noopener">Full highlights rebuild: the plan</a>. The Research area in the admin (B4) holds the write-ups.</li>'
            '<li><b>Mikey&rsquo;s asks</b> (Lower League Trophy, hold to speed up): built overnight in B9. Headers and volleys back: not built yet (B10).</li></ul></div>'
            '<h3 class="grp">The original 19 Oct pages, kept as they were</h3><div class="qlist"><ul>'
            '<li><a href="https://claude.ai/artifact/1gVoLFwG57QCn7xiU8Tudk" target="_blank" rel="noopener">Everything in this round</a> (the big page with every question).</li>'
            '<li><a href="https://claude.ai/artifact/H9wzT9zXjACDLM1uCtzQwd" target="_blank" rel="noopener">Admin home and Team board</a>.</li>'
            '<li><a href="https://claude.ai/artifact/CcMzZbGf3G4fYVervtMV48" target="_blank" rel="noopener">New-look admin pages</a> (30 pages, before and after).</li></ul></div>')
    still = (soon('B12 Vision training', 'Rebuilt as real pass decisions: &ldquo;Who should I pass to?&rdquo;, someone offside, less time, and a real kick inside 0.3 seconds.', 'still building') +
             soon('B2 Highlights phase 3', 'Players already moving when your chance starts, behind the switch. Engine OK given (20 Oct). No report yet.', 'next', 'p-amb') +
             soon('B10 Headers and volleys', 'Back on, with the ball in the air and a shadow signal. Engine OK given (20 Oct). No report yet. Run one at a time.', 'next', 'p-amb'))
    queued = ('<h3 class="grp">Queued from your 20 Oct feedback</h3><div class="qlist"><ul>'
              '<li><b>B13 Fixes.</b> A pass over all fixture dates; XP Rewards &ldquo;Failed to fetch&rdquo;; the chat bubble over &ldquo;Next line &rsaquo;&rdquo;; the Team board push count; the &ldquo;GitHub refused the site&rsquo;s key&rdquo; line.</li>'
              '<li><b>B7b Training editor.</b> Drag and drop like the gallery. No &ldquo;your skills&rdquo; slider: a level plays with the skill you would have after the levels before it. Pace needs a real skill element.</li>'
              '<li><b>B9b.</b> The Lower League Trophy gets its own screen.</li>'
              '<li><b>B14 Running after a chance</b> (after B2 and B10). WASD and Shift on a PC, a stamina bar, auto run, and team-mates passing back to you.</li>'
              '<li><b>B15 Player of the Month cards.</b> Headshots from our 3D model, not the old drawn heads.</li>'
              '<li><b>B16 3D minigame keepers.</b> Measure and rebalance (Wembley, 3D training). Fair is about 1 shot in 3 saved.</li>'
              '<li><b>B17 A PC match layout</b> like the five-a-side test area: pitch and a live radar side by side, first as a test area.</li></ul></div>')
    body = f"""<title>Last 2 Days Patch Notes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{CSS}</style>
<div class="wrap">
<header>
  <span class="ver">LAST 2 DAYS · 19&ndash;20 OCT 2026</span>
  <h1>15 pages of patch notes. Read each one, then press Read and understood.</h1>
  <p class="status"><i></i>The 19 Oct pages are on main. The overnight pages are on the Harry branch, not live.</p>
  <p class="sub">One page per build, in three tabs. Each page is its own version in Admin &rarr; Patch notes: v0.60 to v0.74. This index is v0.75.</p>
  <div class="chips"><a class="chip hot" href="#ok">{n_open} open &darr;</a><a class="chip" href="#ok">{n_done} decided</a><a class="chip" href="#how">How this works</a></div>
</header>

{how_block(None)}

{oks}

<h2 class="nxt"><i></i>THE PAGES</h2>
<div class="tabs" role="tablist" aria-label="Patch notes">
  <button class="tab" role="tab" data-p="p-night" aria-selected="true">Overnight 20 Oct <small>9</small></button>
  <button class="tab" role="tab" data-p="p-19" aria-selected="false">19 Oct <small>6</small></button>
  <button class="tab" role="tab" data-p="p-still" aria-selected="false">Still building <small>3</small></button>
</div>
<section class="panel" id="p-night" role="tabpanel"><p class="snote">Built overnight on the Harry branch. Not live.</p><div class="cards">{night}</div></section>
<section class="panel" id="p-19" role="tabpanel"><p class="snote">The 19 Oct round. On main since 20 Oct (PR #744), except where a page says otherwise.</p><div class="cards">{d19}</div>{also}</section>
<section class="panel" id="p-still" role="tabpanel"><p class="snote">No page yet. Each appears here when its build is done.</p><div class="cards">{still}</div>{queued}</section>

<footer>20 Oct 2026. Every fact comes from the builders&rsquo; reports, the 19 Oct patch notes, and Harry&rsquo;s answers file. Pictures are stills taken while checking the work.</footer>
</div>
<script>
(function(){{
  var tabs=document.querySelectorAll('.tab'), panels=document.querySelectorAll('.panel');
  function show(id){{
    for(var i=0;i<tabs.length;i++) tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-p')===id ? 'true' : 'false');
    for(var j=0;j<panels.length;j++) panels[j].hidden = panels[j].id!==id;
    try{{ localStorage.setItem('kib-last2days-tab', id); }}catch(e){{}}
  }}
  for(var i=0;i<tabs.length;i++) (function(t){{ t.addEventListener('click', function(){{ show(t.getAttribute('data-p')); }}); }})(tabs[i]);
  var start='p-night'; try{{ start=localStorage.getItem('kib-last2days-tab')||start; }}catch(e){{}}
  if(!document.getElementById(start)) start='p-night';
  show(start);
}})();
</script>
"""
    return body

def build_old_index(urls, nopen, index_url):
    oks, n_open, n_done = ok_blocks(urls, 'night')
    night = ''.join(card(k, urls, nopen) for k in ORDER_NIGHT)
    still = soon('B12 Vision training', 'Still building. The page appears when the build is done.', 'still building')
    body = f"""<title>Overnight Patch Notes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{CSS}</style>
<div class="wrap">
<header>
  <a class="back" href="{index_url}" target="_blank" rel="noopener">&rarr; The last 2 days, all tabs (includes the 19 Oct pages)</a><br>
  <span class="ver">OVERNIGHT · 20 OCT 2026</span>
  <h1>9 builds are done. 1 is still building. Nothing is live.</h1>
  <p class="status"><i></i>Everything is on the Harry branch, not live yet.</p>
  <p class="sub">One page per build. Pick one to see its stills, its checks and its questions. Each is its own version in Admin &rarr; Patch notes (v0.66 to v0.74).</p>
  <div class="chips"><a class="chip hot" href="#ok">{n_open} open &darr;</a><a class="chip" href="#ok">{n_done} decided</a><a class="chip" href="#how">How this works</a></div>
</header>

{how_block(None)}

{oks}

<h2 class="fix"><i></i>DONE · 9 BUILDS</h2>
<div class="cards">{night}</div>

<h2 class="nxt"><i></i>STILL BUILDING</h2>
<div class="cards">{still}</div>

<h2 class="nxt"><i></i>VIDEOS</h2>
<div class="vid"><b>Two pages have clips.</b><p>B5 has two (the mentor scene and the Home player). B8 has one (a full match with the radar). Still to come: B1 (Wembley, negotiation), B9 (hold to speed up), B7 (an edited level playing) and B3 (a real moment playing).</p></div>

<footer>20 Oct 2026. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work. Harry&rsquo;s answers are marked as decided.</footer>
</div>
"""
    return body
