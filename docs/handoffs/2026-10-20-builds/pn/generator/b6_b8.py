from lib import *

# =========================== B6 SCENE STUDIO ===========================
def b6():
    p = Page('b6')
    f = p.fig
    add = section('add', 'ADDED', [
        item('Edit the 3D Shop, Garden and House live', [tag('seen')], [
            ('Problem', 'Only the 3D Signing and the Manager&rsquo;s Office could be edited live (the 19 Oct notes, step 3a).'),
            ('Why', 'You answered 3D-5: do step 3b first, which is the shop, the garden and the house.'),
            ('Fix', 'The Shop, Garden and House now edit live, like Signing and the Office. Each has a <b>Walking view</b> and card or room views. You can set <b>Turn, Rise, Distance and Lens</b>, the key light (angle, colour) and the exposure. You can drag the preview and drag the sun. <b>If you make no edit, the scene plays exactly as before.</b>')],
            p.figs([f('04-editor-shop-1440.jpg', '<b>Look at:</b> the 3D Shop in the editor. Tabs for the six places on top. The six views are under the picture (Walking about, the boots, the car&hellip;).', 'wd'),
                    f('05-editor-shop-car-view-1440.jpg', '<b>Look at:</b> view 3, &ldquo;Card: the car&rdquo;. It says EDITED (Turn &minus;40&deg;, Distance &times;0.85, Lens 28 mm).', 'wd')], wide=True) +
            details('More pictures (3): the garden, the house and a phone', p.figs([
                f('07-editor-garden-1440.jpg', '<b>The garden:</b> day, sunset and night, and six places to stand.', 'wd'),
                f('08-editor-house-1440.jpg', '<b>The house:</b> six homes and four rooms. This is the trophy room.', 'wd')], wide=True) +
                p.figs([f('09-editor-garden-390.jpg', '<b>The garden editor on a phone.</b>')]))),
        item('Approve an edit, then choose where and when the game uses it', [tag('seen'), tag('meas')], [
            ('Problem', 'Edits saved on a device and in the team database. The game never read them (the 19 Oct notes).'),
            ('Why', 'You answered 3D-4: an Approve button. Approved edits are used in the game, you can still edit them, and you choose when and where.'),
            ('Fix', 'Every place has a <b>Use in the game</b> panel. Press <b>&#10003; Approve</b> (or Withdraw approval). <b>Where:</b> in a career, on the test page, or both. <b>When:</b> always, or one moment only (signing: the first contract or a move; the shop: entry; the garden: day, sunset or night; the house: which home; the Director: which event). <b>The game reads only approved edits.</b>')],
            bars(bar('Office test camera, before and after an approved edit (degrees)', 44, 19.4, 50, '44&deg;', '19.4&deg; (a 70 mm lens)'),
                 note='Measured: an approved office edit moved the office test camera. It was reverted after the test.') +
            p.figs([f('06-approve-where-when-commit-1440.jpg', '<b>Look at:</b> the green APPROVED line, the Where ticks, the When menu and the COMMIT TO GAME button.', 'wd')], wide=True) +
            details('More pictures (1): the same panel on a phone', p.figs([f('17-approve-where-when-390.jpg', '<b>The Use in the game panel on a phone.</b>')]))),
        item('Commit to game', [tag('seen', 'no-token message seen'), tag('no', 'real commit not seen')], [
            ('Problem', 'You said: &ldquo;I would love it to commit straight into the game&rdquo; (3D-3). Saving to a database alone does not change the game&rsquo;s files.'),
            ('Why', 'The game keeps its own copy of the approved edits as a file in its code. Something must write to that file.'),
            ('Fix', 'A <b>Commit to game</b> button writes the approved edits into that file on main. It needs an admin sign-in and a GITHUB_TOKEN. With no token it says so in red and commits nothing. <b>Each commit starts a Vercel rebuild of the live site.</b> The game reads the committed file and the shared approved rows, and the newer one wins.')],
            p.figs([f('16-commit-to-game-no-token-1440.jpg', '<b>Look at:</b> the red line under the Where ticks: &ldquo;Committing to the repo is switched off &mdash; the GITHUB_TOKEN variable isn&rsquo;t set on this deployment&hellip; Nothing was committed.&rdquo; This is the test machine, not the live site.', 'wd')], wide=True)),
        item('Scene generator: make a cut scene from a game event', [tag('seen')], [
            ('Problem', 'You asked how generated cut scenes work and wanted a studio for them (GEN-1). The generator shared a page with the scene editor.'),
            ('Why', 'You asked for it as its own admin page, in the Studio tab (GEN-1).'),
            ('Fix', 'A new page, <b>Studio &rarr; Scene generator</b>. Pick an <b>event</b> (18), a <b>feeling</b> (12), how big the moment is, how intense, and a seed. Press <b>Generate</b> or <b>Re-roll</b>. It shows the scene, and beside it the <b>recipe</b>: place, mood, length, people, the film-rules score, the beats and the shots. Mark it <b>Good</b> or <b>Bad</b>. <b>Keep as a hand-made scene</b> opens it in the editor.')],
            p.figs([f('01-scene-generator-1440.jpg', '<b>Look at:</b> Scored + Joy, seed 3, playing in the Cut-scene Director. The Good, Bad and Keep buttons are under the picture.', 'wd'),
                    f('02-recipe-and-when-1440.jpg', '<b>Look at:</b> the recipe on the left (Signed, an office scene, 5 beats, 100% on the film rules).', 'wd')], wide=True) +
            details('More pictures (1): on a phone', p.figs([f('03-scene-generator-390.jpg', '<b>The generator on a phone.</b> Marks and kept scenes save on this device and for everyone.')])) +
            details('How generated scenes work (the 19 Oct explainer)', '<p>The explainer, with four generated stills, is on the <b>Scene Editor 3a</b> page of the 19 Oct tab.</p>')),
        item('&ldquo;When does this play?&rdquo;: a table of 18 rows', [tag('seen')], [
            ('Problem', 'You said: &ldquo;I just don&rsquo;t know when they play and why, but we need to fix that&rdquo; (answer 31).'),
            ('Why', 'Generated scenes only play on test pages today. Nothing said so on screen.'),
            ('Fix', 'The generator page now has a table of 18 events. Each row says which game moment <b>would</b> play it, what plays there <b>today</b>, and a status. <b>All 18 say &ldquo;Not wired&rdquo;.</b> A test fails if a career screen starts calling the generator while every row still says Not wired.')],
            p.figs([f('02-recipe-and-when-1440.jpg', '<b>Look at:</b> the right-hand table. Every STATUS cell says NOT WIRED. The note above it says a generated scene does not play in the real game.', 'wd')], wide=True)),
    ])
    chg = section('chg', 'CHANGED', [
        item('The last 6 admin pages are on the Broadcast frame', [tag('seen')], [
            ('Problem', 'Six pages kept the old full screen: 3D Signing, Manager&rsquo;s Office, 3D Shop, 3D Garden, 3D House and the Style test. You said to do them with the scene editor work (A-8).'),
            ('Why', 'You said to do them with the scene editor work, so they waited for this build (A-8).'),
            ('Fix', 'All six now sit on the Broadcast frame (one back arrow, the page title, the side menu). The report counts <b>37 of 43 &rarr; 43 of 43</b>. Add <b>?bare=1</b> to the address to get the old full screen back.')],
            p.figs([f('10-framed-shop-1440.jpg', '<b>Look at:</b> the 3D Shop in the frame. The page title and buttons sit above a full-size 3D view.', 'wd'),
                    f('12-framed-house-1440.jpg', '<b>The 3D House</b> in the frame.', 'wd')], wide=True) +
            details('More pictures (4)', p.figs([f('13-framed-office-1440.jpg', '<b>The Manager&rsquo;s Office</b> in the frame.', 'wd'),
                                                  f('15-framed-style-test-1440.jpg', '<b>The Style test</b> in the frame.', 'wd')], wide=True) +
                    p.figs([f('11-framed-garden-390.jpg', '<b>The 3D Garden on a phone.</b>'),
                            f('14-framed-signing-390.jpg', '<b>The 3D Signing on a phone.</b>')]))),
    ])
    fix = section('fix', 'FIXED', [
        item('A thrown-away build could stop the shared 3D renderer', [tag('meas')], [
            ('Problem', 'On the framed shop page the game time stayed at 0.'),
            ('Why', 'The shop, garden and house scenes could stop the shared 3D renderer when a build was thrown away in the middle of starting.'),
            ('Fix', 'Only the renderer&rsquo;s owner can set or stop it now. Game time moves on the framed shop page.')]),
    ])
    nxt = section('nxt', 'NEXT', [
        item('Pick the game moments where generated scenes should play', [tag('reas', 'waiting on you')], [
            ('Problem', 'All 18 rows say &ldquo;Not wired&rdquo;.'),
            ('Why', 'You said (GEN-3) they can go in the game if they are good, for the moments that suit them. The table is the proposal. Nothing is wired until you say so.'),
            ('Status', 'Waiting for your pick (below).')]),
    ])
    numbers = (
        '<p><b>Office test camera after an approved edit.</b> 44&deg; &rarr; 19.4&deg; with a 70 mm lens. Reverted after the test.</p>' +
        bars(bar('Office test camera', 44, 19.4, 50, '44&deg;', '19.4&deg;')) +
        '<p><b>Admin pages on the Broadcast frame.</b> The report says 37 &rarr; 43 of 43.</p>' +
        bars(bar('Pages on the frame', 37, 43, 43, '37', '43', 'blue')) +
        '<p><b>Scene generator.</b> 18 events, 12 feelings. 18 rows in &ldquo;When does this play?&rdquo;, all &ldquo;Not wired&rdquo;. No new database file.</p>')
    return p, dict(
        key='b6', ver='0.70', title='B6 Scene Studio', pill='B6 · SCENE STUDIO',
        headline='You can now edit the 3D shop, garden and house live, approve an edit for the game, and make cut scenes from a game event.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Scene editor: Shop, Garden, House', 'Open the 3D Scene editor (the 3D Shop page has an &ldquo;Edit in the scene editor&rdquo; button). Pick a place. Move Turn, Rise, Distance and Lens, or drag the preview.'),
            ('Use in the game', 'Under the preview, press &#10003; Approve. Pick Where and When. Press Withdraw approval to undo it.'),
            ('Commit to game', 'Press it with no token. A red line says nothing was committed.'),
            ('Scene generator', 'Studio tab &rarr; Scene generator. Pick Scored and Joy. Press Generate, then Re-roll. Mark it Good or Bad.'),
            ('When does this play?', 'Under the generator: 18 rows, all &ldquo;Not wired&rdquo;.'),
            ('The 6 framed pages', 'Open the 3D Shop, Garden, House, Signing, Office and Style test. Each has the frame and one back arrow. Add ?bare=1 for the old full screen.')],
        sections=[add, chg, fix, nxt], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>The editor is judged by stills. Say if you want one, for example the preview drag or the sun drag.</p>',
        seen=dict(
            seen=['The editor on the Shop, Garden and House (computer, and the garden on a phone)', 'The Use in the game panel, approved, with Where and When', 'The &ldquo;no token&rdquo; message on Commit to game', 'The Scene generator on a computer and a phone, with its recipe', 'The &ldquo;When does this play?&rdquo; table', 'All 6 pages on the Broadcast frame'],
            meas=['An approved office edit moved the office test camera from 44&deg; to 19.4&deg; (70 mm lens), then it was reverted', 'Framed pages: 37 &rarr; 43 of 43', 'The framed shop page&rsquo;s game time now moves'],
            reas=['Career paths with a real admin save: the report says they are reasoned, not seen'],
            no=['A real commit into the repo (the test machine has no token)', 'An approved edit playing in a real career', 'Any generated scene playing in the career (none is wired)']),
        ok=[
            dict(who='Your call', q='Which generated scenes should play in the career first?', opts=[('pick rows', 'p-amb'), ('none yet', 'p-blu')],
                 d='The 18-row table proposes a game moment for each event. All say Not wired. You said they can go in if they are good, for the moments that suit them (GEN-3).'),
            dict(who='For the live site', q='Is GITHUB_TOKEN set on the live site, with Contents: read and write?', opts=[('check it', 'p-amb')],
                 d='Commit to game needs it. The test machine had none, so no real commit was seen. Each commit rebuilds the live site.')]
    )

# =========================== B8 FIVE-A-SIDE ===========================
def b8():
    p = Page('b8')
    f = p.fig
    results = bars(
        bar('Matches won (500 matches, Even, skill 70)', None, 56, 100, '', '56%', 'blue'),
        bar('Matches drawn', None, 19, 100, '', '19%', 'blue'),
        bar('Matches lost', None, 24, 100, '', '24%', 'blue'),
        note='Goals per match: 1.83 yours, 1.09 theirs. Shots 6.1 to 5.8. You have 53% of the ball.')
    levels = bars(
        bar('Easy: share of matches won', None, 82, 100, '', '82%', ''),
        bar('Hard: share of matches won', None, 28, 100, '', '28%', 'warn'),
        note='Easy ends 2.58 to 0.56 in goals. Hard ends 1.15 to 1.55.')
    add = section('add', 'ADDED', [
        item('Five-a-side is back as a test area with three tabs', [tag('seen')], [
            ('Problem', 'The old five-a-side game was not used anywhere (19 Oct notes, A-7).'),
            ('Why', 'You said to bring it back as its own test area, with tabs: &ldquo;Give things tabs. I think tabs are the way to go.&rdquo;'),
            ('Fix', 'A new page, <b>/star-fiveaside-dev</b>, with <b>Scenarios</b>, <b>Full match</b> and <b>Data</b>. <b>Scenarios</b> has the gallery&rsquo;s 10 five-a-side pictures. Play each one as <b>Yours</b>, <b>Team-mate&rsquo;s</b> or <b>Theirs</b>. Prev, Again and Next stay pinned on top. <b>Full match</b> plays from kick-off to full time. <b>Data</b> comes from 500 simulated matches.')],
            p.figs([f('01-phone-scenarios-their-attack-brace.jpg', '<b>Look at:</b> the three tabs, then Yours / Team-mate&rsquo;s / Theirs, then Prev, Again, Next pinned above the pitch. This is Their attack 5.'),
                    f('02-phone-scenarios-result.jpg', '<b>Look at:</b> after the roll: &ldquo;Your keeper!&rdquo; on the pitch and &ldquo;Roll 1 &middot; Your keeper saves&rdquo; under the name.')]) +
            details('More pictures (1): Scenarios on a computer', p.figs([f('09-pc-scenarios.jpg', '<b>Look at:</b> the pitch on the left. On the right, &ldquo;The bot, 200 tries&rdquo; says 0% for Your chance 1: 66% blocked.', 'wd')], wide=True))),
        item('A match radar made for five-a-side', [tag('seen')], [
            ('Problem', 'The old Match radar draws zones only, with no players. It cannot show five-a-side.'),
            ('Why', 'It draws zones only, with no players. <span class="nr">(The report gives no deeper cause.)</span>'),
            ('Fix', 'A new SVG radar in the same look. It shows <b>all 10 players and the ball</b>. It reads from a read-only callback, so <b>no engine file and no drift file changed</b>.')],
            p.figs([f('03-phone-full-match.jpg', '<b>Look at:</b> the Full match tab on a phone: pitch, then &ldquo;Tap a team-mate to pass &middot; drag back from the ball to shoot&rdquo;.'),
                    f('04-phone-full-match-radar.jpg', '<b>Look at:</b> the Match radar under the pitch. Blue is your side, orange is theirs, the white dot is the ball.')]) +
            p.video('10-pc-full-match-radar.mp4', '07-pc-full-match-radar.jpg', 'the dots on the radar moving with the men on the pitch. The clip is 8 seconds long, on a computer.',
                    'A full match with the radar (computer, 8 s). Press play. It has no sound.') +
            details('More pictures (1): the radar on a computer', p.figs([f('07-pc-full-match-radar.jpg', '<b>Look at:</b> radar, &ldquo;This match&rdquo; table and the Opposition and Your skill buttons.', 'wd')], wide=True))),
        item('A Data tab from 500 simulated matches', [tag('meas'), tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'The <b>Data</b> tab plays 500 whole matches with a bot for your thumb (Even opposition, skill 70, same seeds every time). It lists <b>what looks broken</b> (2 of 8 checks fail, below), then goals, who wins, who scores and how chances end.')],
            results + levels +
            p.figs([f('08-pc-data.jpg', '<b>Look at:</b> the red &ldquo;What looks broken&rdquo; box at the top, then the five big numbers and the goals chart.', 'wd')], wide=True) +
            details('More pictures (2): Data on a phone', p.figs([f('05-phone-data.jpg', '<b>Data on a phone.</b>'), f('06-phone-data-scenarios.jpg', '<b>Scenarios data on a phone.</b>')]))),
    ])
    chg = section('chg', 'CHANGED', [
        item('The 10 chance pictures live in one file', [tag('reas', 'no still')], [
            ('Problem / Why', NR),
            ('Fix', 'The pictures moved into one shared file. The gallery and the new page read the same one. Nothing is copied.')]),
    ])
    fix = section('fix', 'FIXED', [
        item('Full time right after their chance drew the scene the wrong way round', [tag('reas', 'no still')], [
            ('Problem', 'At full time, straight after their chance, the scene showed the wrong way round with the kits swapped. It also reached the trial&rsquo;s five-a-side.'),
            ('Why', '<span class="nr">Not in the report.</span>'),
            ('Fix', 'Fixed. The report gives no still of the fix.')]),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('A pass to a team-mate never becomes his shot', [tag('meas'), '<span class="pill p-red">gameplay call for Harry</span>'], [
            ('Problem', '<b>0 shots from 1,000 passes.</b> 723 reached him and 277 were cut out. You can never get an assist.'),
            ('Why', 'A five-a-side chance never names a receiver for the engine. So a team-mate who gets your pass in the last third keeps the ball. The five-a-side&rsquo;s own notes say he shoots.'),
            ('Status', 'Not changed. It is a gameplay call.')],
            bars(bar('Shots by a team-mate off your pass, out of 1,000 passes', None, 0, 1000, '', '0 of 1,000', 'bad'))),
        item('Chance pictures 1 and 6 never score for the bot', [tag('meas'), '<span class="pill p-red">gameplay call for Harry</span>'], [
            ('Problem', '<b>0 goals in 200 tries</b> on each. Picture 1: 66% of shots are blocked. Picture 6: 99.5% are blocked.'),
            ('Why', 'The men stand so that nearly every shot is blocked. <span class="nr">(Reasoned from the blocked share. The report gives no cause.)</span>'),
            ('Status', 'Not changed. It is a gameplay call.')],
            bars(bar('Picture 1: shots blocked', None, 66, 100, '', '66%', 'bad'),
                 bar('Picture 6: shots blocked', None, 99.5, 100, '', '99.5%', 'bad'))),
    ])
    numbers = (
        '<p><b>500 matches.</b> Even opposition, your skill 70, your keeper 60, theirs 40. Same seeds every time.</p>' + results +
        '<p><b>By level.</b></p>' + levels +
        '<p><b>Goals per match.</b> Yours 1.83, theirs 1.09. <b>Shots.</b> 6.1 yours, 5.8 theirs. <b>The ball.</b> 53% of it is yours.</p>'
        '<p><b>What looks broken.</b> 2 of 8 checks fail: 0 of 1,000 passes become a shot; chance pictures 1 and 6 have 0 goals in 200 tries.</p>')
    return p, dict(
        key='b8', ver='0.72', title='B8 Five-a-side', pill='B8 · FIVE-A-SIDE',
        headline='Five-a-side is back as a test area with three tabs and a live radar. Two things in it are broken.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Open /star-fiveaside-dev', 'Three tabs: Scenarios, Full match, Data.'),
            ('Scenarios', 'Pick Yours, Team-mate&rsquo;s or Theirs. Prev, Again and Next stay pinned on top while you scroll.'),
            ('Full match', 'Press New match. Play to full time. The radar under the pitch shows all 10 players and the ball.'),
            ('Data', 'The red &ldquo;What looks broken&rdquo; box shows 2 of 8 checks fail.'),
            ('Full time after their chance', 'The scene should no longer draw the wrong way round with the kits swapped.')],
        sections=[add, chg, fix, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>A full match with the radar, on a computer, 8 seconds. It is under &ldquo;A match radar made for five-a-side&rdquo; above.</p>',
        seen=dict(
            seen=['All three tabs on a phone and on a computer (Chromium)', 'Two full matches played to full time, with the radar matching the pitch', 'The 8-second clip of a full match with the radar'],
            meas=['500 simulated matches: 1.83 &ndash; 1.09 goals, 56% won, 19% drawn, 24% lost, shots 6.1 &ndash; 5.8, 53% of the ball', 'By level: Easy 2.58 &ndash; 0.56 (82% won); Hard 1.15 &ndash; 1.55 (28% won)', 'Team-mate shots off your pass: 0 of 1,000. Pictures 1 and 6: 0 of 200 goals each'],
            reas=['The full-time wrong-way-round fix (no still)', 'Why pictures 1 and 6 never score (the report gives only the blocked share)'],
            no=['A real phone', 'A person playing a full match: the bot played the 500', 'Any change to a gameplay rule: none was made']),
        ok=[
            dict(who='Gameplay call', q='Should a pass to a team-mate in the last third become his shot?', opts=[('fix it', 'p-amb'), ('leave it', 'p-blu')],
                 d='Today it is 0 of 1,000, so you can never get an assist. The five-a-side&rsquo;s own notes say he shoots. Fixing it changes the five-a-side rules.'),
            dict(who='Gameplay call', q='Should chance pictures 1 and 6 be redrawn so they can score?', opts=[('redraw', 'p-amb'), ('leave', 'p-blu')],
                 d='0 goals in 200 tries on each. 66% and 99.5% of the bot&rsquo;s shots are blocked.')]
    )
