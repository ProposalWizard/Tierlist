from lib import *

# B16 Fairer 3D Keepers (v0.81). Facts: docs/handoffs/2026-10-20-builds/REPORTS.md (B16) and Harry's words in docs/plans/2026-10-19/harry-answers-round.md.


def b16():
    p = Page('b16')
    f = p.fig
    changed = section('chg', 'CHANGED', [
        item('A decent player is now saved about 1 shot in 3', [tag('meas'), tag('seen')], [
            ('Problem', 'Harry, 20 Oct: the keepers in the 3D minigames (Wembley, 3D training) feel overpowered. A decent player was saved <b>52 to 70%</b> of the time, depending on the game. Fair is about 1 shot in 3 saved.'),
            ('Why', 'His cover had a hard edge. He saved everything within about 2.6 m of his spot and missed everything beyond it.'),
            ('Fix', 'The edge is now a slope. <ul>'
                    '<li>Reaction 0.30 → 0.33 s.</li>'
                    '<li>Read error for a 66 keeper 0.39 → 0.77 m.</li>'
                    '<li>Body reach 1.36 → 1.17 m. Hands past the body 0.8 → 0.66 m.</li>'
                    '<li>The stretch varies ±30% from dive to dive. The close-range reflex is slower and shorter.</li></ul>'
                    'Dive speed, the grab and every size are <b>unchanged</b>. A better keeper still saves more: at 18 m, 35% against a 90 keeper, 44% against a 70, 49% against a 50.')],
            bars(bar('Free Roam, decent player', 70, 33, 100, '70%', '33%'),
                 bar('Headers &amp; Volleys, decent player', 52, 31, 100, '52%', '31%'),
                 bar('Wembley, decent player (you)', 69, 33, 100, '69%', '33%'),
                 note='How often the keeper saves a shot that was on target, before → after. The target is about 1 in 3 (33%). 600 shots per bot. A shot is on target when it goes in with the keeper removed.') +
            p.figs([f('free-roam-save.jpg', '<b>Look at:</b> Free Roam. The banner says SAVED. The keeper (in green) is in his goal.'),
                    f('free-roam-goal.jpg', '<b>Look at:</b> Free Roam. A goal.')], pair=True) +
            p.video('free-roam-3-shots.mp4', 'free-roam-save.jpg', 'three shots in Free Roam on a phone-size screen: SAVED, SAVED, then a GOAL (the score goes from 0 to 1). The clip is 6 seconds long.',
                    'Free Roam, three shots (6 s, no sound), after the change: two saves and a goal.', phone=True)),
        item('Wembley: keeper 70 → 66, and sessions are shorter', [tag('meas'), tag('seen')], [
            ('Problem', 'At keeper 70, a decent player was still saved 38% of the time. Wembley&rsquo;s keeper was stronger than the other two games&rsquo;. B1 had raised it from 36 to 70.'),
            ('Why', 'The other two games used 66. At 70 a decent player was still saved 38%.'),
            ('Fix', 'Wembley&rsquo;s keeper is 66, the same as the other two games. The test floor for the session length moved from 100 s to 75 s, and the test says why. The 80-rated striker still wins more than his fair quarter (30%, was 40%). Bar hits were checked for each shooter.')],
            bars(bar('Wembley session length', 146, 83, 160, '146 s', '83 s'),
                 bar('The 80-rated striker&rsquo;s win share (fair share: 25%)', 40, 30, 50, '40%', '30%', 'warn'),
                 bar('Wembley AI men in the 60s: saved', 45, 18, 100, '45%', '18%'),
                 bar('Wembley&rsquo;s 80-rated AI man: saved', 31, 11, 100, '31%', '11%')) +
            p.figs([f('wembley-goal.jpg', '<b>Look at:</b> Wembley, round 1. &ldquo;MORENO SAFE&rdquo;: Moreno scored and is through (the tick by his name).'),
                    f('wembley-save.jpg', '<b>Look at:</b> Wembley. A save.')], pair=True)),
        item('Headers and Volleys: the win bar moves from 6 to 8 points', [tag('meas')], [
            ('Problem', 'The keeper is weaker now, so goals come easier. A bar of 6 points is too low.'),
            ('Why', 'At 6, the average bot would win 82% of its sessions.'),
            ('Fix', 'The win bar is 8 points. At 8 the average bot wins 53% of its sessions, the same as before. Free Roam&rsquo;s win bar (10) is unchanged. It was never measured, and goals now come easier. See Needs your OK.')],
            bars(bar('Headers &amp; Volleys, average bot wins (bar at 6 points)', None, 82, 100, '', '82%', 'warn'),
                 bar('Headers &amp; Volleys, average bot wins (bar at 8 points)', None, 53, 100, '', '53%'),
                 note='Share of sessions the average bot wins. 53% is what it was before this build.') +
            p.figs([f('headers-volleys-goal.jpg', '<b>Look at:</b> Headers &amp; Volleys. HEADER! +2 points.'),
                    f('headers-volleys-save.jpg', '<b>Look at:</b> Headers &amp; Volleys. A save.')], pair=True)),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('High-skill players blaze over in 3D', [tag('meas', 'found, not fixed'), '<span class="pill p-red">still wrong</span>'], [
            ('Problem', 'An 80-power player who hits a firm shot from 12 to 20 m sends it <b>over the bar about 78% of the time</b>.'),
            ('Why', 'A 3D swipe always strikes the middle of the ball.'),
            ('Status', 'Found, not fixed. See Needs your OK.')],
            bars(bar('80-power firm shot from 12 to 20 m: goes over', None, 78, 100, '', '78%', 'bad'))),
        item('Wembley AI men all aim tight to the post', [tag('meas', 'found, not fixed')], [
            ('Problem', 'The AI men in Wembley are saved 18% of the time. A human is saved 33%.'),
            ('Why', 'Every AI man aims tight to the post.'),
            ('Status', 'Found, not fixed.')]),
        item('The dive picture is the same, but his reach is shorter', [tag('reas', 'not seen')], [
            ('Problem', 'Near a full stretch, a ball may pass just beyond the drawn glove.'),
            ('Why', 'The dive animation was not changed. His reach is shorter.'),
            ('Status', 'Reasoned from the code. Not seen.')]),
        item('Seen once per game, on a test screen', [tag('no')], [
            ('Problem', 'A save and a goal were each seen once per game, at 390 × 844, on a test screen. Not on a phone.'),
            ('Why', 'The numbers come from bots, not people.'),
            ('Status', 'Play a few shots in each game and see if it feels fair.')]),
    ])
    numbers = (
        '<p><b>Save rate of on-target shots, before → after (600 shots per bot).</b> A shot is on target when it goes in with the keeper removed.</p>' +
        bars(bar('Free Roam, decent', 70, 33, 100, '70%', '33%'), bar('Free Roam, good', 25, 14, 100, '25%', '14%'), bar('Free Roam, careless', 75, 56, 100, '75%', '56%'),
             bar('Headers &amp; Volleys, decent', 52, 31, 100, '52%', '31%'), bar('Headers &amp; Volleys, good', 37, 20, 100, '37%', '20%'), bar('Headers &amp; Volleys, careless', 75, 54, 100, '75%', '54%'),
             bar('Wembley (you), decent', 69, 33, 100, '69%', '33%'), bar('Wembley (you), good', 40, 15, 100, '40%', '15%'), bar('Wembley (you), careless', 76, 55, 100, '76%', '55%'),
             bar('Wembley AI men in the 60s', 45, 18, 100, '45%', '18%'), bar('Wembley&rsquo;s 80 AI man', 31, 11, 100, '31%', '11%')) +
        '<p><b>Keeper settings.</b> Reaction 0.30 → 0.33 s. Read error for a 66 keeper 0.39 → 0.77 m. Body reach 1.36 → 1.17 m. Hands past body 0.8 → 0.66 m. Stretch ±30% dive to dive. Dive speed, grab and all sizes unchanged.</p>'
        '<p><b>Against better keepers (18 m).</b> Saved 35% against a 90 keeper, 44% against a 70, 49% against a 50.</p>'
        '<p><b>Wembley.</b> Keeper 70 → 66. Sessions 146 s → 83 s. The 80 wins 30% (was 40%; fair is 25%). At keeper 70 a decent player was still saved 38%.</p>'
        '<p><b>Headers &amp; Volleys.</b> Win bar 6 → 8. At 6 the average bot would win 82%. At 8, 53%, the same as before.</p>')
    return p, dict(
        key='b16', ver='0.81', title='B16 Fairer 3D Keepers', pill='B16 · FAIRER 3D KEEPERS',
        headline='In the 3D games a decent player is now saved about 1 shot in 3. It was more than 1 in 2.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Free Roam', 'Take a few shots that are on target. About 1 in 3 should be saved, not most of them.'),
            ('Headers and Volleys', 'The same: about 1 in 3 saved. A win now needs 8 points.'),
            ('Wembley', 'Shots go in more often. A session is shorter, about 83 s.'),
            ('A better keeper', 'A better keeper still saves more than a weaker one.'),
            ('Sizes', 'The keeper, the goal and the men are the same size as before.')],
        sections=[changed, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>Free Roam, three shots: two saved, one goal. 6 seconds, on a phone-size screen. It is under &ldquo;3D keepers now save about 1 shot in 3&rdquo; above.</p>',
        seen=dict(
            seen=['A save and a goal in each of Free Roam, Headers &amp; Volleys and Wembley, at 390 × 844', 'A 6-second clip of three Free Roam shots'],
            meas=['Save rates before → after for three bots in each game, 600 shots per bot (see The numbers)', 'Wembley sessions 146 s → 83 s; the 80 wins 30% (was 40%)', 'Headers &amp; Volleys: at a win bar of 6 the average bot wins 82%; at 8, 53%'],
            reas=['Near full stretch, a ball may pass just beyond the drawn glove'],
            no=['A phone: not tried', 'Free Roam&rsquo;s win bar (10): never measured']),
        ok=[
            dict(q='Headers &amp; Volleys: move the win bar from 6 to 8 points?', who='Your call', opts=[('keep 8', 'p-grn'), ('keep 6', 'p-blu')],
                 d='At 6 the average bot would win 82% of its sessions. At 8 it wins 53%, the same as before.'),
            dict(q='High-skill players blaze over in 3D: fix it?', who='Your call', opts=[('fix it', 'p-amb'), ('leave it', 'p-blu')],
                 d='A 3D swipe always strikes the middle of the ball, so an 80-power firm shot from 12 to 20 m goes over about 78% of the time.'),
            dict(q='How strong should the keepers in the 3D minigames be?', by='Harry, 20 Oct',
                 done='Fair is about 1 shot in 3 saved. Done here: Free Roam, Headers &amp; Volleys and Wembley are all near 1 in 3 for a decent player.'),
            dict(q='Wembley change from B1: keep?', by='Harry, 20 Oct',
                 done='Keep it. B16 checked Wembley&rsquo;s keeper against it and moved him from 70 to 66, the same as the other two games.')]
    )
