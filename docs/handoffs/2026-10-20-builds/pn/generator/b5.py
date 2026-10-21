from lib import *

# =========================== B5 3D LOOKS ===========================
def b5():
    p = Page('b5')
    f = p.fig
    yellow = bars(
        bar('Signing: skin that is yellow', 94, 0, 100, '94%', '0%'),
        bar('Press: skin that is yellow', 94, 0.2, 100, '94%', '0.2%'),
        bar('Walk-out: skin that is yellow', 61, 0, 100, '61%', '0%'),
        bar('Made-up trophy scene: skin that is yellow', 90, 0.2, 100, '90%', '0.2%'),
        note='&ldquo;Yellow&rdquo; means skin whose colour is past 36 degrees. Real player skin tones sit at 23 to 31 degrees. Grey is before (19 Oct). Colour is after.')
    shots = bars(
        bar('The 3D audit&rsquo;s 23 moments: bad at phone size', 11, 0, 23, '11', '0'),
        bar('Every camera shot, mid-shot: bad at phone size', 27, 0, 65, '27 of 65', '0'),
        bar('3 moments per shot: bad at phone size', 82, 0, 195, '82 of 195', '0'),
        note='The numbers count shots that failed the phone-size framing check. The report gives the counts, not the rules.')
    fixed = section('fix', 'FIXED', [
        item('Skin was yellow in the 3D cut scenes. It is now natural.', [tag('meas'), tag('seen')], [
            ('Problem', 'The 19 Oct 3D audit said: <b>skin turns yellow in cut scenes</b>. 94% of the skin in the signing and press scenes was past the yellow line.'),
            ('Why', 'The film-style tone mapping runs out of red first. Then the warm colour grade added yellow on top.'),
            ('Fix', 'No new light and no extra drawing. <b>Skin keeps half of each light&rsquo;s colour.</b> Skin is tone-mapped by its brightness only, and 80% of the colour grade skips it. The Home scene also gets a soft rim light.')],
            yellow +
            p.figs([f('bench-signing-before.jpg', '<b>Before (19 Oct):</b> the signing scene. Yellow skin.'),
                    f('bench-signing-after.jpg', '<b>After:</b> the same shot. Natural brown skin.'),
                    f('bench-press-before.jpg', '<b>Before:</b> the press conference.'),
                    f('bench-press-after.jpg', '<b>After:</b> the same shot.'),
                    f('bench-walkout-before.jpg', '<b>Before:</b> the walk-out.'),
                    f('bench-walkout-after.jpg', '<b>After:</b> the same shot.')], pair=True) +
            details('More pictures (6): the trophy lift, the office and a made-up goal', p.figs([
                f('bench-trophy-before.jpg', '<b>Trophy lift, before.</b>'), f('bench-trophy-after.jpg', '<b>After.</b>'),
                f('bench-office-before.jpg', '<b>Manager&rsquo;s Office, before.</b>'), f('bench-office-after.jpg', '<b>After.</b>'),
                f('bench-gen-goal-before.jpg', '<b>A made-up goal scene, before.</b>'), f('bench-gen-goal-after.jpg', '<b>After.</b>')], pair=True)) +
            details('The skin numbers', '<ul><li>Signing 42.7&deg; &rarr; 27.1&deg;. Press 45.2&deg; &rarr; 28.1&deg;. Walk-out 38.2&deg; &rarr; 27.1&deg;. Made-up trophy 40.0&deg; &rarr; 28.4&deg;.</li><li>Trophy lift 20.5&deg; (colour strength 0.99) &rarr; 24.2&deg; (0.68). Office 32.6&deg; &rarr; 25.0&deg;. Home 27.2&deg; &rarr; 26.4&deg;.</li></ul>')),
        item('A face filled the phone screen, and shots were too tight', [tag('meas'), tag('seen')], [
            ('Problem', 'The 19 Oct audit: <b>14 of 23 shots were too tight on a phone</b>, framed for a wide screen. A 6-second clip showed the mentor&rsquo;s face filling the whole screen 0.4 seconds into a shot.'),
            ('Why', 'The cameras were framed for a wide screen. A still camera was not checked after the start of its shot, so a head could walk into the lens. <span class="nr">(Reasoned from the report: it now checks every moment.)</span>'),
            ('Fix', 'Each person shot has a <b>minimum width</b> on a tall screen, with the head in the top part. Prop inserts show the whole prop. A still camera is <b>checked at every moment of its shot</b>. If a head comes within 1.3 m of the lens, the camera swings round to clear it.')],
            shots +
            p.figs([f('cutscene-mentor-7_5s-blocked.jpg', '<b>Before:</b> 7.5 seconds into the scene, a cheek fills the whole screen. The head blocks the lens.'),
                    f('cutscene-mentor-7_5s-fixed.jpg', '<b>After:</b> the same moment. The camera has swung round. You see the whole person.')], pair=True) +
            p.video('cutscene-mentor-talking.mp4', 'cutscene-mentor-7_5s-fixed.jpg', 'the man in black (the mentor) talking to the player, and the camera staying clear of his head. No cheek or face fills the screen. The clip is 6 seconds long.',
                    'The mentor scene on a phone-size screen (6 s, no sound). The caption says: Talent gets you here. Hunger keeps you here.')),
    ])
    add = section('add', 'ADDED', [
        item('Faces move: blinks, glances, expressions and lips', [tag('seen')], [
            ('Problem', 'The 19 Oct audit: <b>faces never move</b>. One made-up injury scene had a smiling face.'),
            ('Why', 'The heads had no face animation. <span class="nr">(From the audit; the B5 report gives no deeper cause.)</span>'),
            ('Fix', 'Every drawn (Style A) head, in cut scenes and on Home, now <b>blinks, glances, moves its irises</b> and shows an <b>expression from the feeling of each beat</b>. The lips move, with teeth, when someone speaks. <b>No photo faces.</b>')],
            p.figs([f('face-talking.jpg', '<b>Look at:</b> &ldquo;Talking&rdquo;. The mouth is open with teeth showing.'),
                    f('face-smile.jpg', '<b>A big smile.</b>')], pair=True) +
            details('More pictures (2)', p.figs([f('face-frown.jpg', '<b>A frown.</b>'), f('face-mid-blink.jpg', '<b>Calm, mid-blink.</b>')]))),
        item('The Home player is alive', [tag('seen')], [
            ('Problem', 'The 19 Oct audit: <b>the home player stands stiffly</b>, with no shadow. You asked for natural, energetic poses, eyes that blink and look around, and lips that move when he talks.'),
            ('Why', NR),
            ('Fix', 'A <b>33-second loop</b> built from clips we already have: idle, keepy-uppies with his own ball, idle, a few words, idle, a quad stretch. Feet apart, weight shifting. The camera sits a quarter-turn round. A soft shadow, a side sun and a rim light.')],
            p.figs([f('home-idle-8_6.jpg', '<b>Look at:</b> 8.6 seconds in. He is doing keepy-uppies with his own ball.'),
                    f('home-idle-3.jpg', '<b>Look at:</b> 3 seconds in. Idle, feet apart.')], pair=True) +
            p.video('home-idling.mp4', 'home-idle-3.jpg', 'him juggling the ball with his knee and his feet, and his weight shifting. The clip is 6 seconds long. The whole loop is 33 seconds.',
                    'The Home player on a phone-size screen (6 s, no sound).') +
            details('More pictures (4): before and after, and later in the loop', p.figs([
                f('bench-home-before.jpg', '<b>Home, before (19 Oct):</b> a stiff pose.'), f('bench-home-after.jpg', '<b>After.</b>'),
                f('home-idle-20.jpg', '<b>20 seconds in.</b>'), f('home-idle-29_5.jpg', '<b>29.5 seconds in.</b>')], pair=True))),
        item('A bench page: the same 10 shots at phone size', [tag('seen')], [
            ('Problem / Why', 'Phase 1 of the 3D plan you liked on 19 Oct: a bench page with the same ten shots.'),
            ('Fix', 'A new test page, <b>/star-3d-bench-dev</b>. It shows the same 10 shots at phone size (Home, signing, office, press, trophy lift, walk-out, garden, a Free Roam drill and 2 made-up scenes), with a frame number on each and a <b>Now / Before (19 Oct)</b> switch. It also has a skin probe. Sub-pages: /home, /face and /faces.')],
            p.figs([f('bench-garden-before.jpg', '<b>Garden, before.</b>'), f('bench-garden-after.jpg', '<b>Garden, after.</b>')], pair=True) +
            details('More pictures (2): a made-up trophy scene', p.figs([f('bench-gen-trophy-before.jpg', '<b>Before.</b>'), f('bench-gen-trophy-after.jpg', '<b>After.</b>')], pair=True))),
    ])
    path = steps([
        ('done', '<b>Phase 1:</b> the bench page.'),
        ('done', '<b>Phase 2:</b> skin and light.'),
        ('done', '<b>Phase 3:</b> cut-scene cameras for a tall phone.'),
        ('done', '<b>Phase 4:</b> moving faces.'),
        ('done', '<b>Phase 5:</b> the Home player alive.'),
        ('next', '<b>Left from this build:</b> the 90th-minute winner that goes to a celebration and then the trophy lift; props held in hands; one stadium for cut scenes.')])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('Away players still pass about 1 m from the lens in the walk-out wide shot', [tag('seen')], [
            ('Problem', 'In the walk-out wide shot, away players pass about 1 m from the lens. It is the same as before B5.'),
            ('Why', 'The camera clearing only covers a head within 1.3 m of a still camera. This wide shot is not fixed by it. <span class="nr">(Reasoned from the report&rsquo;s words.)</span>'),
            ('Status', 'Not changed. The report says: Harry to judge on his phone.')]),
        item('Not seen: Low quality, phone speed, shop and casino skin', [tag('no')], [
            ('Problem', 'The Low quality tier, phone frame rates, the shop and casino skin, and any screen other than 390&times;844 were not looked at.'),
            ('Why', NR),
            ('Status', 'Reasoned, not seen.')]),
    ])
    nxt = section('nxt', 'NEXT', [item('Where the 3D plan is', [], [('Status', 'Phases 1 to 5 are built. Phases 6 to 10 (hands and props, a stadium and real rooms, training rebuilt, one flow through the career, sharper 2D moves) are not started.')], path)])
    numbers = (
        '<p><b>Skin colour (median hue).</b> Real player skin sits at 23 to 31 degrees. Signing 42.7 &rarr; 27.1. Press 45.2 &rarr; 28.1. Walk-out 38.2 &rarr; 27.1. Made-up trophy 40.0 &rarr; 28.4. Office 32.6 &rarr; 25.0. Home 27.2 &rarr; 26.4. Trophy lift 20.5 &rarr; 24.2, and its colour strength 0.99 &rarr; 0.68.</p>' + yellow +
        '<p><b>Bad shots at phone size.</b> The audit&rsquo;s 23 moments 11 &rarr; 0. Every camera shot, mid-shot, 27 of 65 &rarr; 0. Three moments per shot 82 of 195 &rarr; 0.</p>' + shots +
        '<p><b>Switches on the test pages.</b> ?skinfix=0, ?framing=old and ?face=old bring back the old looks on the test pages. They are not game settings.</p>')
    return p, dict(
        key='b5', ver='0.69', title='B5 3D Looks', pill='B5 · 3D LOOKS',
        headline='3D skin looks natural, cut-scene cameras fit a phone, faces move, and the Home player is alive.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('The bench page', 'Open /star-3d-bench-dev. Ten shots at phone size. Flip Now and Before (19 Oct).'),
            ('Skin', 'Signing, press, walk-out and the trophy lift: skin is brown, not yellow.'),
            ('Cameras on a phone', 'In every shot the head sits in the top part. No face or cheek fills the screen.'),
            ('Faces', 'Open /star-3d-bench-dev/face. Blinks, glances, a smile, a frown, lips moving when talking.'),
            ('Home', 'Open the Home player. He idles, does keepy-uppies, says a few words and stretches. A 33-second loop.')],
        sections=[fixed, add, bugs, nxt], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>Two clips are on this page.</b><p>The mentor talking (under the phone cameras) and the Home player (under &ldquo;The Home player is alive&rdquo;). Both are 6 seconds, on a phone-size screen, with no sound.</p>',
        seen=dict(
            seen=['Every bench before and after still', 'The face loop and the Home loop', 'The mentor clip, before and after (the report&rsquo;s words)'],
            meas=['Skin colour in 7 scenes (hue and the share of yellow skin)', 'Bad shots at phone size: the audit&rsquo;s 23 moments 11 &rarr; 0; every camera shot, mid-shot, 27 of 65 &rarr; 0; 3 moments per shot 82 of 195 &rarr; 0'],
            reas=['The Low quality tier', 'Phone frame rates', 'Shop and casino skin', 'Any screen other than 390&times;844'],
            no=['A real phone', 'The 90th-minute winner, props held in hands and the cut-scene stadium (not built)']),
        ok=[
            dict(who='Your call', q='Is the walk-out wide shot fine on your phone?', opts=[('fine', 'p-grn'), ('fix it', 'p-amb')],
                 d='Away players still pass about 1 m from the lens in it. It is the same as before B5. The report says to judge it on your phone.'),
            dict(q='3D plan: go on phases 1 to 5?', by='Harry, 19 Oct', done='Yes. &ldquo;Fixing skin and light is very big.&rdquo; All five phases are built here.'),
            dict(q='What should the Home player do?', by='Harry, 19 Oct', done='Natural, energetic poses; eyes that blink and look around; lips that move when he talks; holds things properly. The first three are built. Holding props is not built yet.')]
    )
