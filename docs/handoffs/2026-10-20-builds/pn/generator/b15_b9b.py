from lib import *

# Pages added on 20 Oct 2026 after B13: B15 3D Headshots (v0.79) and B9b Cup Screens (v0.80).
# Facts: docs/handoffs/2026-10-20-builds/REPORTS.md (the builders' reports) and Harry's words in docs/plans/2026-10-19/harry-answers-round.md.


# =========================== B15 3D HEADSHOTS ===========================
def b15():
    p = Page('b15')
    f = p.fig
    changed = section('chg', 'CHANGED', [
        item('Award cards show a 3D head-and-shoulders picture', [tag('seen')], [
            ('Problem', 'Harry, 20 Oct: the heads on Player of the Month and similar cards <b>&ldquo;look unprofessional&rdquo;</b>. He wanted headshots shot from our 3D model. '
                        'Player of the Month drew flat heads. Season awards and the Ballon d&rsquo;Or used made-up photo faces, even though photo faces are off.'),
            ('Why', NR),
            ('Fix', 'Player of the Month (the shortlist, the winner card and the &ldquo;You won it&rdquo; pop-up), the season awards (each award and Team of the Season) and the Ballon d&rsquo;Or (result page, top ten, countdown, winner, runner-up) now show a head-and-shoulders picture from our 3D Style A model, <b>in the player&rsquo;s club kit</b>.')],
            p.figs([f('01-potm-before-drawn-heads.jpg', '<b>Before:</b> the August shortlist and two winner cards. Flat drawn heads.'),
                    f('02-potm-after-3d-headshots.jpg', '<b>After:</b> the same cards. Each head is a 3D picture in the club kit. Look at: Haaland in sky blue, and your own card (Vass) at the bottom.')], pair=True)),
        item('The Ballon d&rsquo;Or and the season awards too', [tag('seen')], [
            ('Problem', 'The season awards and the Ballon d&rsquo;Or showed the made-up photo faces.'),
            ('Why', NR),
            ('Fix', 'Same 3D pictures. A player has the same seeded look as the 3D match men (keyed to his squad id). <b>You</b> get your own look from Settings → Your look.')],
            p.figs([f('07-ballon-dor-after-3d-headshots.jpg', '<b>Look at:</b> the Ballon d&rsquo;Or result. The winner (Cole Palmer, Chelsea) and the final top ten. Each row has a 3D head in a round frame.')]) +
            details('More pictures (5): season awards and the Ballon d&rsquo;Or, before and after',
                    p.figs([f('04-season-awards-before-photo-faces.jpg', '<b>Before:</b> season awards with made-up photo faces.'),
                            f('05-season-awards-after-3d-headshots.jpg', '<b>After:</b> season awards with 3D headshots.'),
                            f('06-ballon-dor-before-photo-faces.jpg', '<b>Before:</b> the Ballon d&rsquo;Or with made-up photo faces.'),
                            f('03-potm-winner-cards-after.jpg', '<b>After:</b> the Player of the Month winner cards.'),
                            f('08-ballon-dor-winner-card-after.jpg', '<b>After:</b> the Ballon d&rsquo;Or winner card.')], pair=True))),
        item('Made once, kept on the device', [tag('meas')], [
            ('Problem / Why', NR),
            ('Fix', 'One hidden renderer, one fixed lens, pose and studio light. Heads are <b>never resized</b>. A picture is made only when its card comes near the screen, one at a time. It is kept on the device (about 10 KB each, the newest 400). On the second visit <b>0 new pictures</b> are made.')],
            bars(bar('13 faces, first visit (from scratch)', None, 6, 6, '', '~6 s', 'warn'),
                 bar('13 faces, second visit', None, 0.5, 6, '', '0.5 s'),
                 note='Timed on a machine with no graphics chip. Start-up takes 1.3 to 3.3 s once per visit. Each picture takes about 0.2 s (the first 0.6 to 1.0 s). Not measured on a phone.') +
            p.figs([f('09-headshot-sheet-13-players.jpg', '<b>Look at:</b> 13 players made by the same studio. Hair, beard and skin all differ. The kit shows each club. The blond heads on darker skin (row 3) look odd. See Known issues.', 'wd')], wide=True)),
        item('If 3D is missing, the card shows the drawn head', [tag('seen')], [
            ('Problem', 'A 3D picture is not there until it is made, and it cannot be made where WebGL is missing. A card could show a blank circle.'),
            ('Why', 'The picture needs WebGL.'),
            ('Fix', 'A card shows the drawn head until the picture is ready, and keeps it if the picture cannot be made. Seen: with WebGL missing, 10 pictures failed and 10 cards showed drawn heads. No blank circles.')]),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('Blond hair colour also goes on the eyebrows and beard', [tag('seen'), '<span class="pill p-amb">not fixed</span>'], [
            ('Problem', 'The blond hair colour also colours the eyebrows and the beard. On dark skin, close up, it reads oddly (the blond heads in the sheet above).'),
            ('Why', 'It is the shared 3D look, the one the match men use.'),
            ('Status', 'Not changed. See Needs your OK.')]),
        item('Team sheets and other screens still show the old heads', [tag('reas', 'not changed')], [
            ('Problem', 'Team sheets still show the drawn head. The scout report, the transfers panel, and the league and matchday screens still use the photo-face paths.'),
            ('Why', 'This build changed award cards only.'),
            ('Status', 'Team sheets are a one-line swap, if you want them. See Needs your OK.')]),
        item('Not seen in a real career or on a phone', [tag('no')], [
            ('Problem', 'The pictures were seen on test pages at 390 × 844.'),
            ('Why', 'The report says they were not tried in a real career or on a phone.'),
            ('Status', 'Check the cards in a real career.')]),
    ])
    numbers = (
        '<p><b>Time to make the pictures (a machine with no graphics chip).</b> Start-up 1.3 to 3.3 s, once per visit. Each picture about 0.2 s (the first one 0.6 to 1.0 s). 13 faces from scratch about 6 s. Second visit: 0 new pictures, all 13 faces in 0.5 s.</p>' +
        bars(bar('13 faces, first visit', None, 6, 6, '', '~6 s', 'warn'), bar('13 faces, second visit', None, 0.5, 6, '', '0.5 s')) +
        '<p><b>Storage.</b> About 10 KB a picture on the device. The newest 400 are kept.</p>'
        '<p><b>No WebGL.</b> 10 pictures failed, and 10 drawn heads showed.</p>')
    return p, dict(
        key='b15', ver='0.79', title='B15 3D Headshots', pill='B15 · 3D HEADSHOTS',
        headline='Award cards now show a 3D head-and-shoulders picture of the player, in his club kit.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Player of the Month', 'The shortlist, the winner card and the &ldquo;You won it&rdquo; pop-up show 3D headshots in club kits.'),
            ('Season awards', 'Each award and Team of the Season show 3D headshots.'),
            ('Ballon d&rsquo;Or', 'The result page, top ten, countdown, winner and runner-up show 3D headshots.'),
            ('Your own face', 'Settings → Your look changes your own headshot.'),
            ('Second visit', 'Open the same cards again. The pictures should be there at once.')],
        sections=[changed, bugs], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>A headshot is a still. Nothing here moves.</p>',
        seen=dict(
            seen=['Player of the Month, the season awards and the Ballon d&rsquo;Or, before and after, at 390 × 844 on test pages', 'The fallback with WebGL missing: 10 failed, 10 drawn heads, no blank circles', 'A sheet of 13 headshots (the blond-hair problem is on it)'],
            meas=['Start-up 1.3 to 3.3 s, each picture about 0.2 s, 13 faces from scratch about 6 s', 'Second visit: 0 new pictures, 13 faces in 0.5 s'],
            reas=[],
            no=['A real career: not tried', 'A phone: not tried']),
        ok=[
            dict(q='Show the 3D headshot on the team sheets too? (A one-line swap.)', who='Your call', opts=[('swap them', 'p-grn'), ('leave drawn', 'p-blu')],
                 d='Team sheets still show the drawn head. The scout report, transfers panel, and league and matchday screens use older photo-face paths and would take more work.'),
            dict(q='Fix the blond hair colour that also goes on eyebrows and beard?', who='Your call', opts=[('fix it', 'p-amb'), ('leave it', 'p-blu')],
                 d='On dark skin, close up, it reads oddly (the sheet above). It is the shared 3D look, so a fix also changes the match men.'),
            dict(q='Headshots from our 3D model, not the old drawn heads', by='Harry, 20 Oct',
                 done='&ldquo;Looks unprofessional.&rdquo; Done for the award cards here.')]
    )


# =========================== B9b CUP SCREENS ===========================
def b9b():
    p = Page('b9b', dirs=[os.path.join(BASE, 'b9b'), os.path.join(BASE, 'b9')])
    f = p.fig
    changed = section('chg', 'CHANGED', [
        item('The Trophy tab fits one screen. It was a 56-row list.', [tag('seen')], [
            ('Problem', 'Where you browse cups (League → Table → a cup&rsquo;s tab), each cup was a long list. The Lower League Trophy&rsquo;s Round 1 was <b>56 rows</b>, about <b>two phone screens</b>.'),
            ('Why', 'B9 wired the new cup into the old list, which shows every tie of the round.'),
            ('Fix', 'The Trophy tab now shows the cup&rsquo;s colour, a headline (&ldquo;Round 1&rdquo;), your next tie (&ldquo;Wed 9 Sep · away at Walsall&rdquo;), a road with a segment for every round, and one button: <b>Open the Trophy</b>. It fits one 844 px screen.')],
            bars(bar('Phone screens the Round 1 list took', 2, 1, 2, 'about 2', '1', 'blue'),
                 note='56 rows before. None on the tab now.') +
            p.figs([f('01-lower-league-trophy-round1-draw.jpg', '<b>Before (B9):</b> the Trophy tab lists Round 1.'),
                    f('01-league-trophy-tab.jpg', '<b>After:</b> the tab is one card. Look at: the road (R1 next, then R64 to F) and Open the Trophy.')], pair=True)),
        item('The cup&rsquo;s own screen', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'Open the Trophy and you get its own screen. <ul>'
                    '<li><b>Headline:</b> Winners, Out, Not in it, Cup-tied, or bye.</li>'
                    '<li><b>Your road:</b> each round, the club, home or away, and the score.</li>'
                    '<li><b>The bracket</b> from the last 16 (Mikey&rsquo;s).</li>'
                    '<li><b>Every round&rsquo;s results</b>, with ‹ › arrows. Byes sit under Round 1.</li>'
                    '<li><b>Still in it:</b> the crests of the clubs left.</li>'
                    '<li><b>Bottom bar:</b> Back · The draw · Play.</li></ul>')],
            p.figs([f('02-trophy-screen-before-round1.jpg', '<b>Look at:</b> Round 1, before you play. Your road has one row. Every round lists the ties, yours highlighted. The bottom bar says Back, The draw, Play.'),
                    f('20b-trophy-bracket-before-r16.jpg', '<b>Look at:</b> before the Round of 16. Three wins (2–0 each) on your road. The bracket shows the clubs left, yours ringed.')], pair=True) +
            details('More pictures (3)', p.figs([f('02b-trophy-screen-full.jpg', '<b>Look at:</b> the whole cup screen in one tall picture.'),
                f('16-trophy-screen-after-r1-win.jpg', '<b>Look at:</b> after the Round 1 win.'),
                f('26-trophy-screen-before-qf.jpg', '<b>Look at:</b> before the quarter-finals.')], pair=True))),
        item('After a match: the results board and the draw', [tag('seen')], [
            ('Problem', 'The after-match round-up (results board, &ldquo;Road to the Final&rdquo; bracket, the cup draw) was Mikey&rsquo;s FA Cup screen. B9 had wired those to the Trophy.'),
            ('Why', NR),
            ('Fix', 'The Trophy uses the same round-up and draw as the FA Cup. Mikey&rsquo;s Board, Bracket and CupDrawReveal are reused, not copied.')],
            p.figs([f('11-roundup-board-after-r1.jpg', '<b>Look at:</b> the Round 1 results. Walsall 1–1 Huddersfield, penalties 3–4: a tick by Huddersfield. The hint at the bottom says: hold to speed up, double-tap to skip.'),
                    f('14b-draw-done.jpg', '<b>Look at:</b> the Round of 64 draw, finished. Every tie names two clubs with their crests.')], pair=True) +
            details('More pictures (3)', p.figs([f('03-draw-intro.jpg', '<b>Look at:</b> the draw starting.'), f('04-draw-running.jpg', '<b>Look at:</b> the draw running.'),
                f('22-roundup-bracket.jpg', '<b>Look at:</b> the bracket on the round-up screen.')], pair=True))),
        item('The FA Cup and League Cup work the same way', [tag('seen')], [
            ('Problem', 'The FA Cup tab listed every tie.'),
            ('Why', 'It was the same long list as the Trophy.'),
            ('Fix', 'One screen for all three domestic cups. The FA Cup and League Cup tabs work like the Trophy tab, each in its own colour. The list of every tie is one tap away.')],
            p.figs([f('05-fa-cup-tab.jpg', '<b>Look at:</b> the FA Cup tab in dark red. Round of 32 next. Open the FA Cup.'),
                    f('06-fa-cup-screen.jpg', '<b>Look at:</b> the FA Cup screen. Your road, then every round with a ‹ R64 arrow.')], pair=True)),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('A Premier League career still shows the Trophy tab as &ldquo;Not in it&rdquo;', [tag('reas', 'open'), '<span class="pill p-amb">your call</span>'], [
            ('Problem', 'A Premier League career is never in the Trophy. It still sees the tab, and the tab says &ldquo;Not in it&rdquo;.'),
            ('Why', 'The tab shows for every career.'),
            ('Status', 'Open. See Needs your OK: hide it?')]),
        item('No Trophy picture yet', [tag('reas', 'open')], [
            ('Problem', 'The cup shows a 🏆 emoji where a picture should be.'),
            ('Why', 'No picture was made.'),
            ('Status', 'The emoji stays for now. See Needs your OK.')]),
        item('A tie you only watched goes straight back to Home', [tag('meas', 'found, not fixed')], [
            ('Problem', 'If you only watch a tie, the game goes straight back to Home. No round-up shows.'),
            ('Why', 'The FA Cup does the same today.'),
            ('Status', 'Not fixed. Same as the FA Cup.')]),
        item('After a Round 1 bye no draw pops up', [tag('meas', 'found, not fixed')], [
            ('Problem', 'A club on a Round 1 bye gets no draw pop-up after it.'),
            ('Why', 'A bye is not a match, so no round-up opens.'),
            ('Status', 'You can see the draw with &ldquo;The draw&rdquo; on the cup screen.')]),
    ])
    numbers = (
        '<p><b>Before and after.</b> The Trophy&rsquo;s Round 1 was a list of <b>56 rows</b>, about 2 phone screens. The tab is now one card that fits one 844 px screen.</p>' +
        bars(bar('Phone screens for the Round 1 list', 2, 1, 2, 'about 2', '1', 'blue')) +
        '<p><b>Played in the real game</b> (a League One career at Huddersfield, matches played through the real Sim): Round 1 went 1–1, then 4–3 on penalties. Penalties come straight away, as the rules say.</p>'
        '<p><b>Reused, not copied.</b> Mikey&rsquo;s Board and Bracket, CupDrawReveal, cupBoard and cupBracket. The main game file was not touched.</p>')
    return p, dict(
        key='b9b', ver='0.80', title='B9b Cup Screens', pill='B9b · CUP SCREENS',
        headline='Each cup now has its own screen: a one-screen tab, then a full cup screen with your road, the bracket and every round.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('The Trophy tab', 'In a lower-league career: League → Table → Lower League Trophy. One card with the headline, your next tie and a road. It fits one screen.'),
            ('Open the Trophy', 'The cup screen: headline, your road, the bracket from the last 16, every round with ‹ › arrows, Still in it.'),
            ('The bottom bar', 'Back · The draw · Play. The draw shows the draw again.'),
            ('FA Cup and League Cup', 'Their tabs work the same way, each in its own colour.'),
            ('After a match', 'The results board and the draw look the same as the FA Cup&rsquo;s.')],
        sections=[changed, bugs], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>The screens are judged by stills.</p>',
        seen=dict(
            seen=['The Trophy tab and the cup screen at 390 × 844 in the real game (a League One career at Huddersfield)', 'Round 1 played through the real Sim: 1–1, then 4–3 on penalties', 'The round-up board, the draw, the bracket, and the FA Cup tab and screen'],
            meas=['The Round 1 list was 56 rows, about 2 phone screens; the tab is now 1 screen'],
            reas=['Hiding the Trophy tab for a Premier League career: not built, a question'],
            no=['A phone: not tried', 'A Premier League career: still shows the tab as Not in it']),
        ok=[
            dict(q='Hide the Trophy tab for a Premier League career?', who='Your call', opts=[('hide it', 'p-grn'), ('keep it', 'p-blu')],
                 d='A Premier League career is never in the Trophy, so the tab only says &ldquo;Not in it&rdquo;.'),
            dict(q='A Trophy picture instead of the 🏆 emoji?', who='Your call', opts=[('make one', 'p-amb'), ('emoji for now', 'p-blu')],
                 d='The emoji is a stand-in until a real picture is made.'),
            dict(q='The Lower League Trophy gets its own screen', by='Harry, 20 Oct',
                 done='Yes: its own screen, like Mikey&rsquo;s FA Cup and international ones. Built here, with the FA Cup and League Cup on the same screen.')]
    )
