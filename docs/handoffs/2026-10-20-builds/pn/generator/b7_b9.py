from lib import *

# =========================== B7 TRAINING LEVELS ===========================
def b7():
    p = Page('b7')
    f = p.fig
    add = section('add', 'ADDED', [
        item('Edit any of the 150 training levels on a page', [tag('seen')], [
            ('Problem', 'The 150 levels (5 drills × 30) could not be edited on a page. <span class="nr">(Reasoned: the report says they are data now.)</span>'),
            ('Why', NR),
            ('Fix', 'All 150 levels are data now. The Training levels page has an Edit panel for each level, like the gallery. It has sliders and number boxes, <b>▶ Play</b> (plays at once), <b>Save</b>, <b>Commit</b>, <b>Undo changes</b> and <b>Back to committed</b>.' 
                    '<ul><li>Save writes to a shared table and to your device. Commit writes to the repo.</li>'
                    '<li>Dots: amber = unsaved. Green = saved for everyone. Orange = on this device only.</li></ul>')],
            p.figs([f('b7-01-edit-panel-390.jpg', '<b>Look at:</b> Edit Level 30 (Read the run): seven number boxes, Level’s own / Shuffle, and the buttons. The note at the top says saved levels stay on this device until star_training_levels.sql is run.'),
                    f('b7-03-edited-level-playing-390.jpg', '<b>Look at:</b> Technique level 30 playing from an unsaved edit. The corner label says 33 M · 5.0 M gate.')]) +
            details('More pictures (1): the same page on a computer', p.figs([f('b7-02-edit-panel-1440.jpg', '<b>Look at:</b> the 30 Vision levels on the left and the Edit panel on the right.', 'wd')], wide=True))),
    ])
    chg = section('chg', 'CHANGED', [
        item('Vision: a new picture each try, and level 30 is much harder', [tag('meas'), tag('seen')], [
            ('Problem', 'Before, try 2 was “just the answer” (the report’s words).'),
            ('Why', NR),
            ('Fix', 'Each try gets a new picture. Level 30 now has 11 team-mates (was 8) and 13 defenders (was 6). You get 0.85 s to pick (was 0.95). The tap area is 2.2 m (was 3.2).')],
            bars(bar('Level 30: share who pass on the first try (modelled player)', 67, 41, 100, '67%', '41%'),
                 note='Worked out with a modelled player, not a person. Level 20 is 93%, level 25 is 70%, level 28 is 54%.') +
            p.figs([f('b7-04-vision30-before-390.jpg', '<b>Before:</b> 8 team-mates, 6 defenders. The header says “Unsaved edit”. So this looks like the old numbers typed into the editor. The report does not say how it was made.'),
                    f('b7-05-vision30-after-390.jpg', '<b>After:</b> 11 team-mates, 13 defenders. Look at: many more men around the yellow line.')])),
        item('Pace: no longer flat at the top', [tag('meas')], [
            ('Problem', 'From level 24 to level 30, 28% of runs were cleared. The same at every level.'),
            ('Why', NR),
            ('Fix', 'Now it climbs: level 20 clears 43%, level 25 clears 22%, level 30 clears 14%. Measured with a bot on the real run.')],
            bars(bar('Level 30: runs cleared', 28, 14, 50, '28%', '14%'),
                 bar('Level 25: runs cleared', 28, 22, 50, '28%', '22%'))),
        item('Power, Free kick and Technique: top levels a bit harder', [tag('reas', 'reasoned, not measured')], [
            ('Problem / Why', NR),
            ('Fix', 'The top levels are a bit harder and need placed shots.')]),
    ])
    nxt7 = section('nxt', 'NEXT', [
        item('B7b: drag and drop in the training editor', [tag('reas', 'queued')], [
            ('Problem', 'The editor uses sliders and number boxes. Harry wants it like the gallery: move the ball, the cones and the men, then Save. (Harry, 20 Oct.)'),
            ('Why', 'He also found the “your skills” sliders unclear, and Pace has no real skill element.'),
            ('Status', 'Queued as B7b. Harry answered (20 Oct, 09:45): no slider. A level plays with the skill you would have after finishing the levels before it. Pace gets a real skill element.')]),
    ])
    numbers = (
        '<p><b>Vision level 30, first-try pass rate (modelled player).</b> Grey is before. Colour is after.</p>' +
        bars(bar('Level 20', None, 93, 100, '', '93%'), bar('Level 25', None, 70, 100, '', '70%'),
             bar('Level 28', None, 54, 100, '', '54%'), bar('Level 30', 67, 41, 100, '67%', '41%')) +
        '<p><b>Vision level 30, the settings.</b> Team-mates 8 → 11. Defenders 6 → 13. Seconds to pick 0.95 → 0.85. Tap area 3.2 → 2.2 m.</p>'
        '<p><b>Pace, share of runs cleared (a bot on the real run).</b> Before: a flat 28% from level 24 to 30. The report gives no “before” for level 20.</p>' +
        bars(bar('Level 20', None, 43, 50, '', '43%'), bar('Level 25', 28, 22, 50, '28%', '22%'), bar('Level 30', 28, 14, 50, '28%', '14%')))
    return p, dict(
        key='b7', ver='0.71', title='B7 Training Levels', pill='B7 · TRAINING LEVELS',
        headline='All 150 training levels are now editable, and the top Vision and Pace levels are harder.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Open an Edit panel', 'Training levels page → pick a drill → tap a level. Sliders and number boxes show.'),
            ('Press ▶ Play on an unsaved edit', 'Does it play your numbers? The panel says “Playing uses the saved numbers”. The play screen says “Unsaved edit”.'),
            ('Press Save, then reload', 'The screen says “on this device only”. The reload should keep your edit.'),
            ('Vision level 30', 'Many more men on the pitch. A new picture on each try.'),
            ('Pace levels 24 to 30', 'The levels should climb in difficulty. They were flat before.')],
        sections=[add, chg, nxt7], numbers=numbers,
        videos_coming=True,
        videos='<b>Videos coming.</b><p>Clips are filmed after the push and added to this page.</p><ul><li>An edited level playing (Technique level 30, 5 m gate).</li></ul>',
        seen=dict(
            seen=['The editor on a phone and on a computer', '▶ Play of an edited Technique level 30 (5 m gate)', 'Save says “on this device only”, and a reload kept the edit', 'Vision level 30 before and after (stills)'],
            meas=['Vision level 30: first-try pass rate 67% → 41% (a modelled player)', 'Pace: 28% flat → 43% / 22% / 14% (a bot on the real run)'],
            reas=['Power, Free kick and Technique top levels: a bit harder, need placed shots'],
            no=['Saving “for everyone”: the shared table needs the database file first', 'A person playing the new Vision and Pace levels: not in the report', 'Checked after: ▶ Play uses the numbers on screen. Before you save, the panel says “▶ Play uses these numbers before you save” and the level shows “Unsaved edit”; after saving it says “Playing uses the saved numbers”. Both pictures were taken with unsaved numbers, so they say “Unsaved edit”.']),
        ok=[
            dict(q='The “your skills” sliders in the training editor?', by='Harry, 20 Oct, 09:45',
                 done='No slider. &ldquo;Surely it should just be auto: playing a level 20 skill would mean you have the 19 levels completed before it.&rdquo; Built in B7b.'),
            dict(who='For Mikey', q='Run star_training_levels.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, Save stays on this device only. The screen says so.'),
            dict(who='Your call', q='Is Vision level 30 about right?', opts=[('keep', 'p-grn'), ('easier', 'p-blu'), ('harder', 'p-amb')],
                 d='A modelled player passes it first time 41% of the time. It was 67%.')]
    )

# =========================== B9 LOWER LEAGUE TROPHY ===========================
def b9():
    p = Page('b9')
    f = p.fig
    rounds = bars(
        bar('Round 1 (56 matches, 8 clubs on byes)', None, 56, 56, '', '56', 'blue'),
        bar('Round 2', None, 32, 56, '', '32', 'blue'),
        bar('Round 3', None, 16, 56, '', '16', 'blue'),
        bar('Round 4', None, 8, 56, '', '8', 'blue'),
        bar('Quarter-finals', None, 4, 56, '', '4', 'blue'),
        bar('Semi-finals', None, 2, 56, '', '2', 'blue'),
        bar('Final', None, 1, 56, '', '1', 'blue'),
        note='Matches per round. Worked out from the report’s numbers (120 clubs, 8 byes, 119 matches). The report does not list matches per round.')
    add = section('add', 'ADDED', [
        item('Lower League Trophy', [tag('seen'), tag('meas', 'tested 200 seasons')], [
            ('Problem / Why', NR),
            ('Fix', '<ul><li><b>120 clubs</b>: League One, League Two, National League, North and South (this season’s ladder).</li>'
                    '<li>A 128-slot draw. <b>8 byes</b> go to last season’s League One top 8.</li>'
                    '<li><b>7 rounds, 119 matches</b>, played on Wednesdays (weekends 4, 8, 16, 21, 25, 29, 34).</li>'
                    '<li>Before the quarter-finals: penalties straight after a draw. From the quarter-finals: extra time, then penalties.</li></ul>')],
            rounds +
            p.figs([f('01-lower-league-trophy-round1-draw.jpg', '<b>Look at:</b> the new Lower League Trophy tab beside League Two and FA Cup. Round 1 lists the draw.'),
                    f('02-lower-league-trophy-byes.jpg', '<b>Look at:</b> the bottom of the list: “Byes” names 8 clubs (Doncaster Rovers, Stockport County, Leyton Orient, AFC Wimbledon, Plymouth Argyle, Luton Town, Notts County, Sheffield Wednesday).')]) +
            '<p class="bnote">Tested over 200 seasons: 200 of 200 had a winner and exactly 119 matches. No date clashes with the league or the FA Cup.</p>'),
        item('Prize for winning', [tag('reas', 'built, no still')], [
            ('Problem / Why', NR),
            ('Fix', 'A trophy in the cabinet. <b>30,000 XP</b> (the League Cup pays 108,000). Fame +2. A small transfer-interest boost from those leagues: +0.05 for a semi-final, +0.1 for a win. A cash prize of 2 weeks’ wage too. Harry kept it on 20 Oct (&ldquo;pretty cool&rdquo;). No cup paid cash before.')],
            bars(bar('XP for a win: Lower League Trophy', None, 30000, 108000, '', '30,000'),
                 bar('XP for a win: League Cup', None, 108000, 108000, '', '108,000', 'blue'))),
        item('Hold to speed up. Double-tap to skip.', [tag('seen'), tag('meas')], [
            ('Problem / Why', NR),
            ('Fix', 'After a match, hold anywhere: the screen runs at 4×. Double-tap: it skips to the end of that screen. Crediting is unchanged. A hint shows the first 3 times.')],
            bars(bar('Star bar, normal', None, 3.4, 3.4, '', '~3.4 s'),
                 bar('Star bar, held (4×)', None, 1.1, 3.4, '', '~1.1 s'),
                 bar('Star bar, double-tap', None, 0.6, 3.4, '', '~0.6 s'),
                 note='How long the star bar takes. Measured.') +
            p.figs([f('04-postmatch-held-4x.jpg', '<b>Look at:</b> a ⏩ 4× chip, top right, while the finger is held. The score is counting up.'),
                    f('05-postmatch-after-double-tap.jpg', '<b>Look at:</b> after a double-tap the screen is at its end (3 goals, 2 assists, rating 10.0). The “Achievement 1 of 8” pop-up on top is not covered in the report.')]) +
            details('More pictures (1): the hint', p.figs([f('03-postmatch-hint.jpg', '<b>Look at:</b> the hint at the bottom: “Hold to speed up · double-tap to skip”.')]))),
    ], note='The report gives no Problem or Why for these three. Each card shows the Fix.')
    bugs = section('bug', 'KNOWN ISSUES', [
        item('FA Cup Round of 64 lands the day after a league game', [tag('meas', 'found, not fixed')], [
            ('Problem', 'Below the Championship, the FA Cup Round of 64 lands the day after a league game.'),
            ('Why', NR), ('Status', 'Found, not fixed. Queued for B13 Fixes, which will check every fixture date, not only this one (Harry, 20 Oct).')]),
    ])
    numbers = (
        '<p><b>Lower League Trophy.</b> 120 clubs + 8 byes = 128 slots. 7 rounds. 119 matches.</p>'
        '<p><b>200 seasons tested:</b> 200 of 200 had a winner and exactly 119 matches. No date clashes with the league or the FA Cup.</p>' +
        bars(bar('Lower League Trophy XP', None, 30000, 108000, '', '30,000'),
             bar('League Cup XP', None, 108000, 108000, '', '108,000', 'blue')) +
        '<p><b>Time the star bar takes after a match.</b> Normal ~3.4 s. Held ~1.1 s. Double-tap ~0.6 s.</p>')
    return p, dict(
        key='b9', ver='0.73', title='B9 Lower League Trophy', pill='B9 · LOWER LEAGUE TROPHY',
        headline='A new cup for 120 lower-league clubs, and a way to speed up or skip the screens after a match.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('The new tab', 'In a lower-league career, open Table. The Lower League Trophy tab sits beside League Two and FA Cup. Round 1 shows the draw. The byes show at the bottom.'),
            ('Hold after a match', 'On the full-time screen, hold anywhere. It runs at 4×. A ⏩ 4× chip shows top right.'),
            ('Double-tap', 'On the full-time screen, double-tap. It jumps to the end of that screen.'),
            ('The hint', '“Hold to speed up · double-tap to skip” shows for the first 3 times.'),
            ('Credits stay the same', 'Goals, assists and rating should match a match played without holding.')],
        sections=[add, bugs], numbers=numbers,
        videos_coming=True,
        videos='<b>Videos coming.</b><p>Clips are filmed after the push and added to this page.</p><ul><li>Hold to speed up, then double-tap to skip, on a post-match screen.</li></ul>',
        seen=dict(
            seen=['The Round 1 draw and the 8 byes', 'The hint, the ⏩ 4× chip, and the screen after a double-tap'],
            meas=['200 seasons: 200 of 200 with a winner and exactly 119 matches; no date clashes', 'Star bar: ~3.4 s normal, ~1.1 s held, ~0.6 s double-tap'],
            no=['The prize on a screen (cabinet trophy, XP, fame): the report gives no still', 'The later rounds of the cup on a screen', 'Whether the cash prize is switched on in the code now: you kept it, but the report does not say it is built']),
        ok=[
            dict(q='Pay a cash prize of 2 weeks’ wage for winning the Lower League Trophy?', by='Harry, 20 Oct',
                 done='Keep the cash prize (&ldquo;pretty cool&rdquo;). No cup has paid cash before.'),
            dict(q='Fix the FA Cup Round of 64 date next?', by='Harry, 20 Oct',
                 done='Yes, and more: B13 Fixes will pass over all fixture dates for clashes, not only this one.'),
            dict(q='Should the Lower League Trophy get its own screen?', by='Harry, 20 Oct',
                 done='Yes. Queued as B9b: its own screen, like Mikey&rsquo;s FA Cup and international ones.')],
        footer='20 Oct 2026. Built overnight on the Harry branch. Nothing here is live. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work. Harry&rsquo;s answers from the morning of 20 Oct are marked as decided.'
    )
