from lib import *

# Pages added on 20 Oct 2026 (after the first 15): B12 Pick the Pass (v0.76), B7b Training Editor (v0.77), B13 Fixtures + Admin Fixes (v0.78).
# Every fact is from docs/handoffs/2026-10-20-builds/REPORTS.md (the builders' reports) and Harry's words in docs/plans/2026-10-19/harry-answers-round.md.

# ---------- a drawn picture: the four ways a man can be the wrong pass ----------
VERDICT_SVG = """<svg viewBox="0 0 340 250" role="img" aria-label="A drawing of a pitch from above. The ball is at the bottom. Four team-mates: one is the right man (green), one is beyond the last defender so offside, one has a defender on the pass line so the lane is cut, one has a defender right beside him so he is marked.">
<rect x="6" y="6" width="328" height="238" rx="10" style="fill:var(--card2);stroke:var(--line);stroke-width:1.5"/>
<rect x="140" y="6" width="60" height="10" style="fill:none;stroke:var(--ink3);stroke-width:1.5"/>
<line x1="14" y1="70" x2="326" y2="70" style="stroke:var(--amber);stroke-width:1.5;stroke-dasharray:6 4"/>
<text x="20" y="64" style="font:700 9px -apple-system,Segoe UI,Roboto,sans-serif;fill:var(--amber)">LAST DEFENDER</text>
<circle cx="170" cy="28" r="5" style="fill:var(--amber)"/>
<circle cx="150" cy="70" r="5" style="fill:var(--red)"/><circle cx="214" cy="78" r="5" style="fill:var(--red)"/>
<circle cx="112" cy="182" r="5" style="fill:var(--red)"/>
<circle cx="278" cy="166" r="5" style="fill:var(--red)"/>
<line x1="170" y1="218" x2="232" y2="120" style="stroke:var(--green);stroke-width:2"/>
<line x1="170" y1="218" x2="60" y2="150" style="stroke:var(--red);stroke-width:2;stroke-dasharray:4 4"/>
<line x1="170" y1="218" x2="290" y2="176" style="stroke:var(--amber);stroke-width:2;stroke-dasharray:4 4"/>
<circle cx="232" cy="120" r="12" style="fill:none;stroke:var(--green);stroke-width:2.5"/><circle cx="232" cy="120" r="5.5" style="fill:var(--blue)"/>
<circle cx="66" cy="44" r="12" style="fill:none;stroke:var(--red);stroke-width:2.5"/><circle cx="66" cy="44" r="5.5" style="fill:var(--blue)"/>
<circle cx="60" cy="150" r="12" style="fill:none;stroke:var(--red);stroke-width:2.5"/><circle cx="60" cy="150" r="5.5" style="fill:var(--blue)"/>
<circle cx="290" cy="176" r="12" style="fill:none;stroke:var(--amber);stroke-width:2.5"/><circle cx="290" cy="176" r="5.5" style="fill:var(--blue)"/>
<circle cx="170" cy="218" r="6.5" style="fill:var(--blue);stroke:var(--ink);stroke-width:1.5"/><circle cx="180" cy="224" r="3" style="fill:var(--ink)"/>
<g style="font:800 10px -apple-system,Segoe UI,Roboto,sans-serif">
<text x="232" y="100" text-anchor="middle" style="fill:var(--green)">RIGHT MAN</text>
<text x="66" y="28" text-anchor="middle" style="fill:var(--red)">OFFSIDE</text>
<text x="60" y="132" text-anchor="middle" style="fill:var(--red)">CUT OUT</text>
<text x="292" y="202" text-anchor="middle" style="fill:var(--amber)">MARKED</text>
<text x="170" y="240" text-anchor="middle" style="fill:var(--ink3)">THE BALL</text>
</g></svg>"""

SVG_STYLE = '<style>.vsvg{display:block;width:100%;max-width:340px;height:auto;margin:6px auto 2px}</style>'
def vsvg():
    return SVG_STYLE + VERDICT_SVG.replace('<svg ', '<svg class="vsvg" ', 1)


# =========================== B12 PICK THE PASS ===========================
def b12():
    p = Page('b12')
    f = p.fig
    changed = section('chg', 'CHANGED', [
        item('Vision is now &ldquo;Pick the Pass&rdquo;: real pictures, real passes', [tag('seen')], [
            ('Problem', 'Harry, 20 Oct: <b>&ldquo;the vision skill is horrendous. It&rsquo;s cluttered, and the skill gap doesn&rsquo;t increase. I don&rsquo;t like the line on the pitch.&rdquo;</b>'),
            ('Why', NR),
            ('Fix', 'Vision is rebuilt from the start. Each try is a real moment from a tracked match. <b>263 real passes</b> (DFL, SkillCorner and SoccerTrack), plus the team&rsquo;s own drawn chances on levels 1, 2 and 10. '
                    'It is drawn in the real match&rsquo;s new view. <b>No guide line.</b> Only the men who matter are drawn. The two deepest defenders always stay, so the offside line is exact.')],
            p.figs([f('1-tap-level1-play.jpg', '<b>Look at:</b> level 1. No line on the pitch. Five men and the ball. The hint says: tap the team-mate you&rsquo;d pass to. Not offside, not marked, nobody in the way.'),
                    f('4-level30-aim.jpg', '<b>Look at:</b> level 30. A real moment, with its credit under the pitch. The arrow is your drag. The hint says: start inside 0.3 s.')])),
        item('The question: who gets the pass?', [tag('meas')], [
            ('Problem', 'Harry, 20 Oct: <b>&ldquo;Who should I pass to in this scenario? Have someone offside.&rdquo;</b>'),
            ('Why', NR),
            ('Fix', 'Three traps: a man who is <b>offside</b>, a lane that is <b>cut</b>, a man who is <b>marked</b>. The right man is worked out with the engine&rsquo;s own rules. '
                    'Every pass in every picture was played <b>24 times</b> on the engine: the right man was reached at least 80% of the time, a cut lane under 40%.')],
            vsvg() + '<p class="bnote">A drawing, not a still. It shows the four kinds of man. The green one is the only right answer.</p>'
            '<p class="bnote">Checked on the engine: 30 of 30 passes to an offside man ended OFFSIDE. 240 of 240 good passes found the right man. 119 of 120 passes into a cut lane were lost.</p>'),
        item('Levels 1 to 9: tap the man. From level 10: kick the pass.', [tag('seen'), tag('meas')], [
            ('Problem', 'Harry, 20 Oct: <b>&ldquo;Why are we just tapping? &hellip; early on you tap, then you actually have to kick the ball inside 0.3 seconds.&rdquo;</b>'),
            ('Why', NR),
            ('Fix', 'Levels 1 to 9 are a tap, and the time gets shorter. From level 10 you <b>kick the pass</b>: the real drag and strike, and you must start the kick in time. The engine judges the kick.')],
            bars(bar('Level 1: time to tap', None, 4.0, 4.5, '', '4.0 s', 'blue'),
                 bar('Level 9: time to tap', None, 1.3, 4.5, '', '1.3 s', 'blue'),
                 bar('Level 10: time to start the kick', None, 1.8, 4.5, '', '1.8 s'),
                 bar('Level 28 and up: time to start the kick', None, 0.3, 4.5, '', '0.3 s', 'warn'),
                 note='Less time at every step. From level 28 it is 0.3 s, the number Harry asked for.') +
            p.figs([f('2-kick-level25-aim.jpg', '<b>Look at:</b> level 25. A real moment from SkillCorner (credit under the pitch). The orange arrow is the drag. The hint says: start inside 0.4 s.')]) +
            p.video('6-kick-level12.mp4', '6-kick-level12.jpg', 'the kick at level 12. A drag back from the ball, the strike, then RIGHT MAN with confetti. The clip is 9 seconds long, on a phone-size screen.',
                    'Level 12, a real moment from Fortuna Düsseldorf 1-0 FC St. Pauli (78&prime;). One kick, one right man (9 s, no sound).', phone=True)),
        item('After each try you are told why', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'One word, then one line. <b>RIGHT MAN</b>, <b>OFFSIDE</b>, <b>CUT OUT</b>, <b>MARKED</b>, <b>NOT THE BALL</b>, <b>MISPLACED</b> or <b>TOO SLOW</b>. The right man gets a green ✓ ring. Your pick gets a red ✗. A real picture names its match and minute.')],
            p.figs([f('3-offside-level4-result-tapoffside.jpg', '<b>Look at:</b> OFFSIDE on level 4. Under the pitch: &ldquo;Gnabry was beyond the last man. Coman was the ball.&rdquo; The green ✓ is the right man. The red ✗ is the man tapped. The credit names the match: FC Köln 1-2 FC Bayern München, 8&prime;.'),
                    f('5-too-slow-level30-play.jpg', '<b>Look at:</b> TOO SLOW on level 30. The right man is ringed green. The line says: No. 11 was the ball.')]) +
            details('More pictures (1): RIGHT MAN', p.figs([f('6-kick-level12.jpg', '<b>Look at:</b> RIGHT MAN on level 12. The line says: Iyoha: onside, free and the lane open.')]))),
        item('Fewer repeats across the 30 levels', [tag('meas')], [
            ('Problem / Why', NR),
            ('Fix', 'Going through levels 1 to 30 now shows more different pictures. An ordinary picture comes back on at most 3 levels.')],
            bars(bar('Different pictures in 90 tries', 32, 45, 90, '32', '45'),
                 bar('Levels an ordinary picture comes back on (at most)', 7, 3, 8, '7', '3', 'blue'),
                 note='Measured over levels 1 to 30, 90 tries.')),
        item('How hard it gets', [tag('meas')], [
            ('Problem', 'Harry, 20 Oct: <b>&ldquo;the skill gap doesn&rsquo;t increase&rdquo;</b>.'),
            ('Why', NR),
            ('Fix', 'The pass rate now falls the whole way. The steepest step is level 14 (87%) to level 16 (51%). Every level&rsquo;s numbers can be softened in the training editor.')],
            bars(bar('Level 1', None, 99, 100, '', '99%'), bar('Level 10', None, 93, 100, '', '93%'),
                 bar('Level 20', None, 36, 100, '', '36%', 'warn'), bar('Level 25', None, 28, 100, '', '28%', 'warn'),
                 bar('Level 30', None, 21, 100, '', '21%', 'bad'),
                 note='How often a modelled good player picks and kicks the right man on the first try. Kicks were played on the engine. Not a person.')),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('Only 5 real offside pictures for 13 offside levels', [tag('meas'), '<span class="pill p-amb">half fixed</span>'], [
            ('Problem', 'The 13 offside levels draw on just 5 real offside moments. One of them comes back on 6 levels.'),
            ('Why', NR),
            ('Status', 'Open. See Needs your OK: add drawn offside pictures?')]),
        item('Not tried on a real phone at 0.3 s', [tag('no')], [
            ('Problem', 'The 0.3 s kick start was only seen on a test browser at 390 × 844.'),
            ('Why', 'It was seen only in a test browser.'),
            ('Status', 'Harry to try on his phone. Every level&rsquo;s numbers can be softened in the editor.')]),
    ])
    numbers = (
        '<p><b>First-try pass rate, a modelled good player, kicks played on the engine.</b></p>' +
        bars(bar('Level 1', None, 99, 100, '', '99%'), bar('Level 10', None, 93, 100, '', '93%'), bar('Level 14', None, 87, 100, '', '87%'),
             bar('Level 16', None, 51, 100, '', '51%'), bar('Level 20', None, 36, 100, '', '36%'), bar('Level 25', None, 28, 100, '', '28%'),
             bar('Level 30', None, 21, 100, '', '21%', 'bad'),
             note='The steepest step is level 14 to level 16.') +
        '<p><b>Time to answer.</b> Tap levels 1 to 9: 4.0 s down to 1.3 s. Kick levels: 1.8 s at level 10, 0.3 s from level 28.</p>'
        '<p><b>Pictures.</b> 263 real passes (DFL, SkillCorner, SoccerTrack v2) plus the team&rsquo;s drawn chances on levels 1, 2 and 10. Levels 1 to 30 show 45 different pictures in 90 tries (32 before). An ordinary picture comes back on 3 levels at most (7 before).</p>'
        '<p><b>Checked on the engine.</b> 30 of 30 passes to an offside man ended OFFSIDE. 240 of 240 good passes found the right man. 119 of 120 passes into a cut lane were lost. Every pass in every picture was played 24 times (right man reached at least 80%, cut lane under 40%).</p>'
        '<p><b>Not changed.</b> No engine or drift file. Credits for the real data are shown under each real picture.</p>')
    return p, dict(
        key='b12', ver='0.76', title='B12 Pick the Pass', pill='B12 · PICK THE PASS',
        headline='Vision training is now &ldquo;Pick the Pass&rdquo;: look at a real moment, work out who gets the ball, and from level 10 kick the pass yourself.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Level 1: tap the man', 'Training → Vision → level 1. No line on the pitch. Tap the team-mate you would pass to.'),
            ('Level 4: an offside man', 'Tap the offside man. OFFSIDE shows, with one line saying why. The right man gets a green ✓.'),
            ('Level 10 and up: kick the pass', 'Drag back from the ball to aim at him, then strike. You must start inside the time on the hint.'),
            ('Level 30: TOO SLOW', 'Wait too long. TOO SLOW shows, and the right man is ringed green.'),
            ('A real picture names its match', 'Under the pitch: the match, the minute and the data credit.'),
            ('Pictures do not repeat much', 'Go through levels 1 to 30. An ordinary picture should come back on 3 levels at most.')],
        sections=[changed, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>Level 12: a drag, a strike and RIGHT MAN. 9 seconds, on a phone-size screen. It is under &ldquo;Levels 1 to 9: tap the man. From level 10: kick the pass.&rdquo; above.</p>',
        seen=dict(
            seen=['Level 1 (tap), level 4 (OFFSIDE with the reason), level 12 (RIGHT MAN), level 25 and level 30 (the aim arrow), and TOO SLOW on level 30, at 390 × 844', 'A 9-second clip of a kick on level 12'],
            meas=['First-try pass rate by level, for a modelled good player (99% at level 1 down to 21% at level 30)', 'On the engine: 30 of 30 offside passes ended OFFSIDE; 240 of 240 good passes found the right man; 119 of 120 cut-lane passes were lost', 'Different pictures in 90 tries: 32 → 45'],
            reas=[],
            no=['A real phone at 0.3 s: not tried', 'A person playing the whole curve: not in the report']),
        ok=[
            dict(q='Vision level 30: about right? (A good player passes it 21% first try.)', who='Your call', opts=[('keep', 'p-grn'), ('easier', 'p-blu'), ('harder', 'p-amb')],
                 d='A modelled good player picks and kicks the right man on the first try 21% of the time at level 30. Every level can be softened in the training editor.'),
            dict(q='Only 5 real offside pictures for 13 offside levels. Add drawn ones?', who='Your call', opts=[('add drawn ones', 'p-amb'), ('leave it', 'p-blu')],
                 d='One real offside picture comes back on 6 levels. Drawn ones would give each level a fresh picture, but they are not real moments.'),
            dict(q='What Vision should be', by='Harry, 20 Oct',
                 done='Real scenarios: who should I pass to, someone offside, less time, and a real kick inside 0.3 s from the harder levels. Built here.'),
            dict(q='Every training drill moves to the new match look', by='Harry, 20 Oct',
                 done='Later, not in this build. Vision is drawn in the new look now. The other drills keep the old 2D look for now.')]
    )


# =========================== B7b TRAINING EDITOR ===========================
def b7b():
    p = Page('b7b')
    f = p.fig
    skills = bars(bar('Level 20, if you got 1 star on every earlier level', None, 53, 80, '', 'Power 53', 'blue'),
                  bar('Level 20, 2 stars on every earlier level (what it uses)', None, 65, 80, '', 'Power 65'),
                  bar('Level 20, 3 stars on every earlier level', None, 78, 80, '', 'Power 78', 'blue'),
                  note='The rule is the career&rsquo;s own: 40 + stars × 60 ÷ 90, with 2 of 3 stars taken on each earlier level.')
    add = section('add', 'ADDED', [
        item('Drag and drop in the training editor', [tag('seen')], [
            ('Problem', 'Harry, 20 Oct: the editor used sliders and number boxes. He wanted it <b>like the gallery</b>: move the ball, the cones and the men, then Save.'),
            ('Why', NR),
            ('Fix', 'The level&rsquo;s picture from above sits beside the sliders. Drag on it. <ul>'
                    '<li><b>Power:</b> the ball and each man.</li><li><b>Technique:</b> the ball, either cone, or the gate&rsquo;s middle.</li>'
                    '<li><b>Free kick:</b> the ball and each wall man.</li><li><b>Pace:</b> each man along his wave&rsquo;s line.</li></ul>'
                    '↶ <b>Undo</b> takes back one step. <b>Undo all</b> takes back everything. The dots are unchanged. <b>▶ Play</b> uses the dragged picture.')],
            p.figs([f('b7b-01-editor-before-drag-390.jpg', '<b>Look at:</b> Level 20 (Power). The picture on top, the sliders under it. The hint says: drag the ball, the cones or the men.'),
                    f('b7b-02-editor-dragging-ball-390.jpg', '<b>Look at:</b> the ball is being dragged (yellow ring). Distance and Off centre show an amber dot and &ldquo;was 26.4m&rdquo;.')]) +
            p.figs([f('b7b-05-pace-man-dragged-390.jpg', '<b>Look at:</b> Pace. One man is dragged across his line.'),
                    f('b7b-06-technique-cone-dragged-390.jpg', '<b>Look at:</b> Technique. The left cone is being moved. Gate distance, width and offset change, and show what they were.')]) +
            details('More pictures (2): ▶ Play and the computer layout', p.figs([f('b7b-03-dragged-level-playing-390.jpg', '<b>Look at:</b> level 20 playing from the dragged picture.'),
                f('b7b-04-editor-1440.jpg', '<b>Look at:</b> on a computer: the 30 levels on the left, the editor on the right.', 'wd')], wide=True))),
        item('No &ldquo;your skills&rdquo; slider: a level plays with the skills you would have', [tag('seen'), tag('meas')], [
            ('Problem', 'Harry, 20 Oct: <b>&ldquo;surely it should just be auto: playing a level 20 skill would mean you have the 19 levels completed before it.&rdquo;</b>'),
            ('Why', 'Harry&rsquo;s reasoning: the game already knows which levels you have finished, so it can work the skills out itself.'),
            ('Fix', 'No slider. A level plays with the skills you would have after the levels before it, by the career&rsquo;s own rule. It takes 2 of 3 stars on each earlier level. One line says so, and shows the range.')],
            skills +
            p.figs([f('b7b-10-plays-with-line-390.jpg', '<b>Look at:</b> the level box on the list: &ldquo;Plays with: Power 65 · Technique 65 · Free kick 65 &mdash; what you&rsquo;d have after levels 1&ndash;19&rdquo;.'),
                    f('b7b-11-eye-guide-390.jpg', '<b>Look at:</b> the eye guide on the page explains the Plays with line.')], pair=False)),
        item('Pace: one man comes for the ball. Flick past him when his ring turns green.', [tag('seen'), tag('meas')], [
            ('Problem', 'Harry, 20 Oct: Pace needs a real skill element. <b>Before, waiting for the right moment made no difference.</b>'),
            ('Why', 'The report&rsquo;s own measurement: waiting for the right moment changed nothing.'),
            ('Fix', 'One man per wave comes for the ball and wears a ring. The ring is <b>amber</b>, then <b>green</b> for a short window. Flick the other way <b>when it is green</b>. Too early, and he goes with you. '
                    'The window is 0.30 s against a weak man, 0.05 s against the best. This is the Training drill only. The real match and the trial are unchanged (tested).'),
            ],
            steps([('', '<b>The man comes.</b> His ring is amber. Wait.'),
                   ('next', '<b>The ring turns green.</b> Flick the other way now.'),
                   ('done', '<b>&ldquo;Knocked it past him!&rdquo;</b> You are through.'),
                   ('', '<b>Too early:</b> he goes with you, and the wave is lost.')]) +
            bars(bar('Good player, levels 11 to 20: runs cleared', 64, 75, 100, '64%', '75%'),
                 bar('Hasty player, levels 11 to 20: runs cleared', 56, 29, 100, '56%', '29%', 'warn'),
                 bar('Good player, levels 21 to 30: runs cleared', 61, 37, 100, '61%', '37%'),
                 note='Bots on the real run. A good bot waits for the ring. A hasty bot does not. Before, the wait made no difference. Now it does.') +
            p.figs([f('b7b-07-pace-ring-amber-wait-390.jpg', '<b>Look at:</b> level 8. The man has an amber ring. The hint says: wait for his shoulder, then flick the other way as his ring turns green.'),
                    f('b7b-08-pace-ring-green-go-390.jpg', '<b>Look at:</b> the ring is green and the man has put his arm out. This is the moment to flick.')]) +
            p.video('b7b-pace-knockon-390.mp4', 'b7b-09-pace-knocked-past-him-390.jpg', 'the ring (amber, then green), the flick the other way, then &ldquo;Knocked it past him!&rdquo;. The clip is 7 seconds long, on a phone-size screen.',
                    'Pace level 8: the knock-on (7 s, no sound).', phone=True)),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('The Training levels page freezes on the second tab switch', [tag('meas', 'found, not fixed'), '<span class="pill p-red">still broken</span>'], [
            ('Problem', 'After you pick a level, the page freezes on the <b>second tab switch</b>, then crashes. It happens in the test browser. The old page does the same.'),
            ('Why', NR),
            ('Status', 'Found, not fixed. Not checked on a phone.')]),
        item('Vision cannot be dragged yet', [tag('reas', 'not built')], [
            ('Problem', 'Vision pictures have no drag in the editor.'),
            ('Why', 'Vision pictures are not in the editor&rsquo;s layout list yet. The report says one entry needs adding.'),
            ('Status', 'One entry to add in the layout file. Not done.')]),
    ])
    numbers = (
        '<p><b>Pace, share of runs cleared before and after the knock-on (bots on the real run).</b> Levels 1 to 10 / 11 to 20 / 21 to 30.</p>' +
        bars(bar('Good bot, levels 1 to 10', 75, 85, 100, '75%', '85%'), bar('Good bot, levels 11 to 20', 64, 75, 100, '64%', '75%'), bar('Good bot, levels 21 to 30', 61, 37, 100, '61%', '37%'),
             bar('Decent bot, levels 1 to 10', 68, 65, 100, '68%', '65%'), bar('Decent bot, levels 11 to 20', 60, 52, 100, '60%', '52%'), bar('Decent bot, levels 21 to 30', 52, 22, 100, '52%', '22%'),
             bar('Hasty bot, levels 1 to 10', 45, 20, 100, '45%', '20%'), bar('Hasty bot, levels 11 to 20', 56, 29, 100, '56%', '29%'), bar('Hasty bot, levels 21 to 30', 27, 8, 100, '27%', '8%'),
             bar('Careless bot, levels 1 to 10', 16, 8, 100, '16%', '8%'), bar('Careless bot, levels 11 to 20', 17, 15, 100, '17%', '15%'), bar('Careless bot, levels 21 to 30', 5, 3, 100, '5%', '3%')) +
        '<p><b>Plays with, level 20.</b> Power and Technique 53 with 1 star on each earlier level, 65 with 2, 78 with 3. The rule: 40 + stars × 60 ÷ 90.</p>'
        '<p><b>Ring window.</b> 0.30 s against a weak man, 0.05 s against the best.</p>'
        '<p><b>Power eased in a career.</b> Level 20 draws 26 m. A career player with 2 stars on each earlier level has Power 65, which is behind that level, so it plays at 22 m with 2 men in the way.</p>')
    return p, dict(
        key='b7b', ver='0.77', title='B7b Training Editor', pill='B7b · TRAINING EDITOR',
        headline='Drag and drop in the training editor, no &ldquo;your skills&rdquo; slider, and Pace now needs the right moment.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Drag on the picture', 'Training levels → pick a drill → Edit level. Drag the ball, a cone or a man on the picture. The numbers follow, with a dot and &ldquo;was …&rdquo;.'),
            ('Undo', '↶ Undo takes back one step. Undo all takes back everything.'),
            ('▶ Play', 'It plays the dragged picture, even before you Save.'),
            ('Plays with', 'The level box says what skills it plays with, for example Power 65 · Technique 65 — what you&rsquo;d have after levels 1–19. There is no slider.'),
            ('Pace: the ring', 'Pace level 8. A man comes for the ball with an amber ring. Flick the other way when it turns green. Too early, and he goes with you.'),
            ('The freeze', 'Switch the drill tab twice after picking a level. This freezes in the test browser. See Known issues.')],
        sections=[add, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>Pace level 8: the knock-on ring and the flick. 7 seconds, on a phone-size screen. It is under &ldquo;Pace: one man comes for the ball&rdquo; above.</p>',
        seen=dict(
            seen=['Drags with a mouse and with a finger, at 390 × 844 and at 1440', 'Undo, ▶ Play, Save (says &ldquo;this device only&rdquo;), and a reload kept the edit', 'The Pace rings (amber, then green) and &ldquo;Knocked it past him!&rdquo;', 'A 7-second clip of the knock-on'],
            meas=['Cleared runs before → after for four bots (see The numbers). Before, waiting made no difference.', 'The real match and the trial are unchanged (tested)'],
            reas=[],
            no=['The page freeze on a phone: not checked', 'Vision in the editor: not built']),
        ok=[
            dict(q='Power levels are always eased in a career. OK as it is?', who='Your call', opts=[('fine', 'p-grn'), ('play as drawn', 'p-amb')],
                 d='At 2 stars a level, a career player is always behind on Power levels, so they always get eased. Level 20 draws 26 m and plays at 22 m. That is how the career already works. It is only visible now, in the &ldquo;Plays with&rdquo; line.'),
            dict(who='For Mikey', q='Run star_training_levels.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, Save stays on this device only. The screen says so.'),
            dict(q='The &ldquo;your skills&rdquo; slider in the training editor?', by='Harry, 20 Oct, 09:45',
                 done='No slider. A level plays with the skills you would have after finishing the levels before it. Built here.'),
            dict(q='The editor works like the gallery?', by='Harry, 20 Oct',
                 done='Yes: drag the ball, cones and men, then Save. Built here (not Vision yet).')]
    )


# =========================== B13 FIXTURES + ADMIN FIXES ===========================
def b13():
    p = Page('b13')
    f = p.fig
    fixed = section('fix', 'FIXED', [
        item('Every fixture date was checked: 170 clashes are now 0', [tag('meas'), tag('seen')], [
            ('Problem', 'Harry, 20 Oct asked for a pass over <b>all</b> fixture dates, not only the FA Cup Round of 64. A new checker played 5 seasons through the real career code in every division. It found <b>170 clashes in 45 seasons</b>.'),
            ('Why', 'Seven causes made most of them. They are in the bars below. The biggest was play-off games after the season (48).'),
            ('Fix', '<ul><li>Championship-and-below Tuesday rounds moved.</li>'
                    '<li>A midweek game inside a FIFA window moves to the Wednesday after.</li>'
                    '<li>Premier League clubs in Europe play both domestic cups on their own fixed weekends.</li>'
                    '<li>The European final week moves from 38 to 36.</li>'
                    '<li>The play-offs are all in May.</li>'
                    '<li>The Community Shield is the Saturday a week before the league.</li>'
                    '<li>The squad is named 3 days before internationals. A club game up to 2 days after the last international is missed.</li></ul>')],
            bars(bar('Premier League (Leeds)', 5, 0, 31, '5', '0'),
                 bar('Premier League + Champions League', 31, 0, 31, '31', '0'),
                 bar('Premier League + Europa League', 31, 0, 31, '31', '0'),
                 bar('Championship', 23, 0, 31, '23', '0'),
                 bar('League One, League Two, National League, North and South (each)', 16, 0, 31, '16', '0'),
                 bar('All 45 seasons', 170, 0, 170, '170', '0'),
                 note='Clashes found by the checker. Grey is before. Green is after. Rules: no two games a day, none on days in a row, two clear days between games, rounds in order, the season over by 31 May, and the Premier League and Championship stop for FIFA windows.') +
            '<p class="bnote"><b>What caused them (before):</b></p>' +
            bars(bar('Play-off games after the season', None, 48, 48, '', '48', 'bad'),
                 bar('A game inside an international break', None, 42, 48, '', '42', 'bad'),
                 bar('FA Cup Round of 64 the day after a Tuesday league round', None, 30, 48, '', '30', 'bad'),
                 bar('A game 1 to 2 days from an international', None, 22, 48, '', '22', 'bad'),
                 bar('FA Cup quarter-final the day after a Premier League Tuesday', None, 10, 48, '', '10', 'bad'),
                 bar('The European final on Tue 1 June', None, 10, 48, '', '10', 'bad'),
                 bar('Community Shield the day after the Super Cup', None, 8, 48, '', '8', 'bad')) +
            p.figs([f('1-fixture-checker-before-after.jpg', '<b>Look at:</b> the checker&rsquo;s own result sheet. Red bars are before. Green zeros are after. The amber line at the bottom is the one limit that is left.', 'wd')], wide=True)),
        item('XP Rewards no longer says &ldquo;Failed to fetch&rdquo;', [tag('seen')], [
            ('Problem', 'The admin page Site XP rewards showed a red &ldquo;Failed to fetch&rdquo; box on the test build.'),
            ('Why', 'The test build has no database key. The note on the page now says so.'),
            ('Fix', 'It now loads, read-only, with a note: saving needs the site&rsquo;s database key, which the live site has and the test build does not. Every failure is said in plain words.')],
            p.figs([f('2-xp-rewards-after-phone.jpg', '<b>Look at:</b> the amber box under the tabs: &ldquo;Read-only here&hellip;&rdquo;. The reward cards load below it.')])),
        item('The chat bubble no longer covers &ldquo;Next line ›&rdquo;', [tag('seen'), tag('meas')], [
            ('Problem', 'In the Manager&rsquo;s office the round chat bubble sat on top of the &ldquo;Next line ›&rdquo; button.'),
            ('Why', 'Both live at the bottom left. The bubble did not know a page had its own buttons there.'),
            ('Fix', 'A page marks its own bottom-left controls. The bubble sits above them. In the Manager&rsquo;s office it moves up <b>132 px</b>.')],
            bars(bar('Bubble moved up in the Manager&rsquo;s office', None, 132, 150, '', '132 px', 'blue')) +
            p.figs([f('3a-office-bubble-before-phone.jpg', '<b>Before:</b> the green bubble sits on &ldquo;Next line ›&rdquo;.'),
                    f('3b-office-bubble-after-phone.jpg', '<b>After:</b> the bubble is higher. &ldquo;Next line ›&rdquo; is clear.')], pair=True) +
            details('More pictures (1): the 3D signing page', p.figs([f('3c-signing-bubble-after-phone.jpg', '<b>Look at:</b> the 3D signing page. The bubble sits above the controls here too.')]))),
        item('Team board push counts are real now', [tag('seen'), tag('meas')], [
            ('Problem', 'The Team board counts looked wrong. Harry&rsquo;s count was capped, and work merged in from main was counted as his.'),
            ('Why', 'It counted only the newest 20 commits on a branch.'),
            ('Fix', 'It now counts real pushes from GitHub&rsquo;s push log: any branch, the last 7 days, own work only.')],
            bars(bar('Harry, pushes this week', 20, 166, 170, '20 at most', '166'),
                 bar('Mikey, pushes this week', None, 34, 170, '', '34', 'blue'),
                 bar('Leo, pushes this week', None, 21, 170, '', '21', 'blue'),
                 note='Harry&rsquo;s old count could not pass 20 (it read only the newest 20 commits). The old figures for Mikey and Leo are not in the report.') +
            p.figs([f('4a-team-board-push-counts-computer.jpg', '<b>Look at:</b> the three people at the top: Harry 166 pushes this week, Mikey 34, Leo 21.', 'wd'),
                    f('4b-team-board-guide-push-count-computer.jpg', '<b>Look at:</b> the eye guide on the Team board explains what the push count is (last 7 days, any branch, own work only).', 'wd')], wide=True)),
        item('&ldquo;GitHub refused the site&rsquo;s key&rdquo; line', [tag('seen', 'seen: gone'), tag('reas', 'cause reasoned')], [
            ('Problem', 'The Team board showed six amber lines: &ldquo;GitHub refused the site&rsquo;s key &hellip; Check GITHUB_TOKEN in Vercel&rdquo;.'),
            ('Why', 'The refused key was the local test computer&rsquo;s own key, not Vercel&rsquo;s.'),
            ('Fix', 'A refused key is tried once. Then the board reads without it. One line says whose key it was.')]),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('A Championship club in Europe that wins everything still clashes', [tag('meas'), '<span class="pill p-amb">half fixed</span>'], [
            ('Problem', 'A Championship club in Europe that wins every cup and every tie needs about <b>38 midweeks</b>. A season has <b>34</b>.'),
            ('Why', 'There are not enough midweek dates for that many games.'),
            ('Status', 'Not counted in the 0. Clashes in that case went from 56 to 20, all from deep runs. None come before 1 January. See Needs your OK.')],
            bars(bar('Championship club in Europe winning everything', 56, 20, 56, '56', '20', 'warn'),
                 note='Clashes. All 20 are from deep runs (Europe semi-finals against the play-offs, cup quarter-finals and semi-finals against Europe).')),
        item('Mikey&rsquo;s ten-round FA Cup is not merged yet', [tag('reas', 'watch')], [
            ('Problem', 'It touches the same calendar. The 0 above is for the calendar as it is today.'),
            ('Why', 'A new set of FA Cup dates can bring clashes back.'),
            ('Status', 'Run the checker again after it merges. See Needs your OK.')]),
    ])
    numbers = (
        '<p><b>The checker.</b> It plays 5 seasons (2026/27 to 2030/31) through the real career code in every division. Every cup and Europe tie is won, play-offs are reached, and the player is called up every window. File: <code>tests/star/fixtureClashes.mts</code>.</p>' +
        bars(bar('Premier League (Leeds)', 5, 0, 31, '5', '0'), bar('Premier League + Champions League', 31, 0, 31, '31', '0'), bar('Premier League + Europa League', 31, 0, 31, '31', '0'),
             bar('Championship (Watford)', 23, 0, 31, '23', '0'), bar('League One', 16, 0, 31, '16', '0'), bar('League Two', 16, 0, 31, '16', '0'),
             bar('National League', 16, 0, 31, '16', '0'), bar('National League North', 16, 0, 31, '16', '0'), bar('National League South', 16, 0, 31, '16', '0'),
             bar('Total, 45 seasons', 170, 0, 170, '170', '0')) +
        '<p><b>Team board.</b> Harry 166, Mikey 34, Leo 21 pushes in the last 7 days. Before, the count stopped at the newest 20 commits, and main&rsquo;s merged work counted as his.</p>'
        '<p><b>Bubble.</b> Manager&rsquo;s office: up 132 px.</p>')
    return p, dict(
        key='b13', ver='0.78', title='B13 Fixtures + Admin Fixes', pill='B13 · FIXTURES + ADMIN FIXES',
        headline='Every fixture date was checked. 170 clashes are now 0. Four admin fixes came with it.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Play a season', 'No two games on the same day or on days in a row. No game inside an international break. The season ends by 31 May.'),
            ('Play-offs', 'They are all in May, after the league.'),
            ('Admin: XP Rewards', 'Admin → XP &amp; Rewards. It loads. On a test build a note says it is read-only.'),
            ('Admin: Manager&rsquo;s office on a phone', 'The chat bubble sits above &ldquo;Next line ›&rdquo;. It does not cover it.'),
            ('Admin: Team board', 'Harry 166, Mikey 34, Leo 21 pushes in the last 7 days. No amber &ldquo;GitHub refused the site&rsquo;s key&rdquo; lines.')],
        sections=[fixed, bugs], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>The fixture dates are a table of numbers. The result sheet is a still.</p>',
        seen=dict(
            seen=['The checker&rsquo;s result sheet: red before, green zeros after', 'XP Rewards loading with the read-only note, on a phone', 'The Manager&rsquo;s office before and after, on a phone, and the 3D signing page', 'The Team board counts and its eye guide, on a computer'],
            meas=['Clashes over 45 seasons: 170 → 0 (by division in the bars)', 'Championship club in Europe winning everything: 56 → 20 clashes (not counted)', 'Pushes this week: Harry 166, Mikey 34, Leo 21'],
            reas=['The cause of the &ldquo;GitHub refused the site&rsquo;s key&rdquo; line: the local test computer&rsquo;s key'],
            no=['A person playing a whole season on a phone to see the new dates: not in the report', 'The live site: nothing here is live yet']),
        ok=[
            dict(q='A Championship club in Europe that wins everything needs 38 midweeks. A season has 34. Leave it?', who='Your call', opts=[('leave it', 'p-grn'), ('fix it', 'p-amb')],
                 d='56 clashes became 20, all from deep runs. None come before 1 January. It is not counted in the 0.'),
            dict(q='Run the fixture checker again after Mikey&rsquo;s ten-round FA Cup merges?', who='For Mikey', opts=[('yes', 'p-grn'), ('skip', 'p-blu')],
                 d='His FA Cup change is not merged yet and touches the same calendar. The checker is one test file. The 0 is for today&rsquo;s calendar.'),
            dict(q='FA Cup Round of 64 date', by='Harry, 20 Oct',
                 done='Fix it, and more: check every fixture date. Done here.'),
            dict(q='The chat bubble covering 11 px of &ldquo;Let&rsquo;s go&rdquo; on Training levels (admin and test pages)', by='Harry, 20 Oct',
                 done='Fine as it is. (The bubble covering &ldquo;Next line ›&rdquo; in the Manager&rsquo;s office was fixed here.)'),
            dict(q='The Team board push count, the XP Rewards error and the GitHub key line', by='Harry, 20 Oct',
                 done='Asked for in his feedback on the overnight pages. Done here.')]
    )
