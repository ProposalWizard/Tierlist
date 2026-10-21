from lib import *

# B17 PC Match + Radar (v0.85). Facts: docs/handoffs/2026-10-20-builds/REPORTS.md (B17) and Harry's words in docs/plans/2026-10-19/harry-answers-round.md.
# Pages carry no questions and no how-it-works block (Harry, 20 Oct). The radar question was answered the same day ("fix the match radar"): it is a FIXED item.


def b17():
    p = Page('b17')
    f = p.fig
    added = section('add', 'ADDED', [
        item('A test page: the real match on the left, a live radar of the whole pitch on the right', [tag('seen')], [
            ('Problem', 'Harry, 20 Oct: you wanted a PC match layout like the five-a-side test area, with the pitch and a live radar side by side. &ldquo;The way the ball&rsquo;s moving across the pitch is very cool.&rdquo; You asked for a test area first, in 3D if possible.'),
            ('Why', 'The real match shows only a small piece of the pitch. On a computer there is room beside it for the whole pitch.'),
            ('Fix', 'A new test page, <b>PC match + radar</b> (Test pages &rarr; Match tests). On a computer the real 90-minute match sits on the left at its real size (384 px). A live radar sits on the right, pinned to the top. At 1440 &times; 900 the whole pitch and the radar fit on screen. '
                    'Under the radar: a momentum bar, one line of status, and a &ldquo;This match&rdquo; list (goals, shots, corners, your chances and how each ended). The bar above has <b>New match</b>, <b>View 2D | 3D</b> and a link to the Play Area for the club and dials. It always plays 90 minutes.')],
            p.figs([f('01-computer-mid-chance.jpg', '<b>Look at:</b> a live chance. The dashed box on the radar is what the match screen on the left shows. You are ringed in yellow. Blue is your side, orange is theirs.', 'wd'),
                    f('02-computer-between-chances.jpg', '<b>Look at:</b> between chances. One dot with a trail, and the area it is in is lit.', 'wd')], wide=True) +
            p.video('04-computer-radar-follows-a-chance.mp4', '01-computer-mid-chance.jpg', 'the radar following the match. The men and the ball on the radar move with the men on the pitch. The clip is 8 seconds long, on a computer.',
                    'The radar follows a chance (8 s, no sound).')),
        item('Between chances, the radar shows the match you do not see, minute by minute', [tag('seen'), tag('meas')], [
            ('Problem', 'On a computer there was no big picture of the match between your chances.'),
            ('Why', 'The match already tracks the ball area by area, in its own small commentary radar. Nothing drew that big.'),
            ('Fix', 'The ball is a dot that glides from area to area and leaves a trail. The area it is in is lit in that side&rsquo;s colour. GOAL!, SHOT, CORNER and YOUR CHANCE flash. '
                    'The data comes from the match&rsquo;s own small radar, read only. The real match is not changed, and no real match shows any of this.')],
            bars(bar('Minutes the dot sat inside the area the match named (5 matches)', None, 455, 455, '', '455 of 455'),
                 note='Measured over 5 matches, 455 minutes in all.')),
        item('During a chance, every man is on the radar', [tag('seen')], [
            ('Problem', 'When you take a chance, the match screen shows only the men near the ball.'),
            ('Why', 'The match screen is zoomed in on the chance.'),
            ('Fix', 'The radar draws every man, both keepers and the ball where the match screen just drew them. A dashed box shows the part of the pitch the match screen can see. In a dribble the radar holds the last minute and says so.')]),
        item('A 3D view of the match, on this page only', [tag('seen')], [
            ('Problem', 'You asked for it in 3D if possible.'),
            ('Why', 'The career already has a 3D match picture (Match view 3D).'),
            ('Fix', 'The <b>View 2D | 3D</b> switch above the match uses that picture. It changes this page only. It took about 12 s to load on the test machine, which has no graphics chip.')],
            p.figs([f('05-computer-3d-view.jpg', '<b>Look at:</b> the 3D match on the left. The radar on the right is the same.', 'wd')], wide=True)),
        item('On a phone the radar sits under the match', [tag('seen')], [
            ('Problem', 'A phone has no room beside the match.'),
            ('Why', 'A phone screen is 390 px wide.'),
            ('Fix', 'The radar folds under the match. The pitch is 366 px wide, the same as the real match.')],
            p.figs([f('03-phone-layout-390.jpg', '<b>Look at:</b> a phone, 390 px wide. The match on top, the radar and the &ldquo;This match&rdquo; list below.')])),
    ])
    fixed = section('fix', 'FIXED', [
        item('The career&rsquo;s own in-match radar drew its dot outside its lit area', [tag('meas'), '<span class="pill p-grn">found and fixed the same day</span>'], [
            ('Problem', 'In a real career match, with Settings &rarr; Match radar set to New, the ball dot was <b>outside the area the radar lights</b> in 220 of 455 minutes. In 50 of those it was off the pitch.'),
            ('Why', 'The radar&rsquo;s position shuffle could go below zero.'),
            ('Fix', 'This page found it. Harry, 20 Oct: &ldquo;fix the match radar&rdquo;. It was fixed the same day with a one-line change, so the shuffle can no longer go below zero. The dot is now outside its lit area 0 of 910 minutes checked.')],
            bars(bar('Career radar: dot outside its lit area', 220 / 455 * 100, 0, 100, '220 of 455 min', '0 of 910 min'),
                 bar('Career radar: dot off the pitch', 50 / 455 * 100, 0, 100, '50 of 455 min', '0'),
                 note='Minutes with the dot outside its lit area, before &rarr; after the fix.')),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('Not seen: the full-time panel and a penalty against you', [tag('no')], [
            ('Problem', 'Two things were not looked at on the page: what the radar and list show at full time, and a penalty against you.'),
            ('Why', 'The check ran about 6 minutes over several matches.'),
            ('Status', 'Play one match to the end and look.')]),
        item('Seen only on a test machine, not on a phone', [tag('no')], [
            ('Problem', 'The page was seen at 1440 &times; 900 and 390 &times; 844 in a test browser. Not on a real phone.'),
            ('Why', 'The test machine has no graphics chip. The 3D view took about 12 s there.'),
            ('Status', 'Open the page on your phone and your computer, and say if it feels smooth.')]),
    ])
    numbers = (
        '<p><b>How well the dot matches the named area.</b> The PC match page: inside the area 455 of 455 minutes over 5 matches. The career radar (Settings &rarr; Match radar: New) before the fix: outside its lit area 220 of 455 minutes, 50 of them off the pitch. After the fix: 0 of 910 minutes checked.</p>' +
        bars(bar('PC match page: dot inside the named area', None, 455, 455, '', '455 of 455'),
             bar('Career radar, before the fix: dot outside its lit area', None, 220, 455, '', '220 of 455', 'bad'),
             bar('Career radar, before the fix: dot off the pitch', None, 50, 455, '', '50 of 455', 'bad'),
             bar('Career radar, after the fix: dot outside its lit area', None, 0.4, 910, '', '0 of 910')) +
        '<p><b>Sizes.</b> The real match on the left: 384 px wide on a computer, 366 px on a phone. At 1440 &times; 900 the whole pitch and radar fit.</p>'
        '<p><b>What was checked.</b> About 6 minutes over several matches at both sizes. 3 chances checked by eye. The 3D view. The dribble hold. No file the red warning guards was edited.</p>')
    return p, dict(
        key='b17', ver='0.85', title='B17 PC Match + Radar', pill='B17 · PC MATCH + RADAR',
        headline='A new test page shows the real match beside a live radar of the whole pitch.',
        sub='Overnight round, 20 Oct 2026. A test page: nothing in the real game changed.',
        checks=[
            ('Open the page', 'Admin → Test pages → Match tests → PC match + radar. On a computer: the match on the left, the radar on the right.'),
            ('Between chances', 'The ball dot glides from area to area. The area is lit. GOAL!, SHOT, CORNER and YOUR CHANCE flash.'),
            ('During a chance', 'Every man, both keepers and the ball are on the radar. A dashed box shows what the match screen shows.'),
            ('View 2D | 3D', 'The switch above the match. The 3D view needs a few seconds to load.'),
            ('On a phone', 'The radar sits under the match. The pitch is 366 px wide.'),
            ('New match', 'The button starts a new 90-minute match.'),
            ('A dribble', 'The radar holds the last minute and says so.')],
        sections=[added, fixed, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>The radar following a chance. 8 seconds, on a computer. It is under &ldquo;A test page&rdquo; above.</p>',
        seen=dict(
            seen=['About 6 minutes over several matches, at 1440 &times; 900 and 390 &times; 844', '3 chances checked by eye', 'The 3D view', 'The dribble hold'],
            meas=['The dot sat inside the named area 455 of 455 minutes over 5 matches', 'The career radar: outside its lit area 220 of 455 minutes before the fix (50 off the pitch), 0 of 910 after'],
            reas=[],
            no=['The full-time panel', 'A penalty against you', 'A real phone']),
        ok=[],
    )
