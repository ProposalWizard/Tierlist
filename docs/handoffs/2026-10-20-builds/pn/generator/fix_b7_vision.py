"""B7 (v0.71) still showed the OLD Vision. Harry, 20 Oct: "Vision needs to be shown as rebuilt in B7."
This rewrites B7's Vision parts to the rebuilt Pick the Pass (B12): one plain item, two new stills, a link to the B12 page,
and every old Vision picture and number kept but marked "Before (old Vision, replaced by B12)".
Usage: python3 fix_b7_vision.py        (edits patch-notes/pages/0.71 in place; safe to run twice)"""
import os, sys, shutil, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import bar, bars, item, tag, details, esc
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
P = os.path.join(REPO, 'patch-notes', 'pages')
B7 = os.path.join(P, '0.71')
B12 = os.path.join(P, '0.76')
B12_URL = 'https://claude.ai/artifact/MewEumQW9Wr9dt84kGaPuF'

h = open(os.path.join(B7, 'index.html'), encoding='utf-8').read()
if 'Pick the Pass' in h:
    print('already done')
    sys.exit(0)


def fig(name, cap):
    w, hh = Image.open(os.path.join(B7, 'img', name)).size
    plain = ' '.join(re.sub(r'<[^>]+>', '', cap).split())
    return '<figure class="ph"><img src="img/%s" alt="%s" width="%d" height="%d" loading="lazy"><figcaption>%s</figcaption></figure>' % (name, esc(plain), w, hh, cap)


# the two new stills come from the B12 page's own pictures
for src, dst in (('1-tap-level1-play.jpg', 'vision-level1-tap-390.jpg'), ('4-level30-aim.jpg', 'vision-level30-aim-390.jpg')):
    shutil.copy2(os.path.join(B12, 'img', src), os.path.join(B7, 'img', dst))

new_item = item('Vision is rebuilt as Pick the Pass (B12)', [tag('meas'), tag('seen')], [
    ('Problem', 'Harry, 20 Oct: &ldquo;the vision skill is horrendous. It&rsquo;s cluttered, and the skill gap doesn&rsquo;t increase.&rdquo; B7 had made the old level 30 harder (11 team-mates, 13 defenders, 0.85 s). That Vision is gone.'),
    ('Why', 'Harry said the old drill was cluttered, the skill gap did not grow, and he did not like the line on the pitch.'),
    ('Fix', 'Vision is now <b>Pick the Pass</b>: real pictures of real passes, and the question is who gets the pass. Levels 1 to 9: tap the man. From level 10: kick the pass with the real drag and strike, and the engine judges the kick. '
            'The time to start the kick is 1.8 s at level 10 and 0.3 s from level 28. Full write-up: <a href="%s" target="_blank" rel="noopener">the B12 page</a>.' % B12_URL)],
    bars(bar('Level 30: first-try pass rate (modelled player)', 67, 21, 100, '67%', '21%'),
         note='It was 67% before B7. B7 made it 41%. The B12 rebuild made it 21%. After the rebuild: level 1 is 99%, level 10 93%, level 20 36%, level 25 28%. A modelled player, not a person.') +
    '<div class="figs">%s%s</div>' % (
        fig('vision-level1-tap-390.jpg', '<b>Look at:</b> the rebuilt Vision, level 1. No line on the pitch. Five men and the ball. The hint says: tap the team-mate you&rsquo;d pass to.'),
        fig('vision-level30-aim-390.jpg', '<b>Look at:</b> the rebuilt Vision, level 30. A real moment, with its credit under the pitch. The arrow is your drag. The hint says: start inside 0.3 s.')) +
    details('Before: the old Vision, replaced by B12 (2 pictures)',
            '<div class="figs">%s%s</div>' % (
                fig('b7-04-vision30-before-390.jpg', '<b>Before (old Vision, level 30, B7 start):</b> 8 team-mates, 6 defenders. The header says &ldquo;Unsaved edit&rdquo;. So this looks like the old numbers typed into the editor. The report does not say how it was made.'),
                fig('b7-05-vision30-after-390.jpg', '<b>Before (old Vision, level 30, after B7):</b> 11 team-mates, 13 defenders. Look at: many more men around the yellow line. This drill was replaced by B12.'))))

# 1. headline
a = 'All 150 training levels are now editable, and the top Vision and Pace levels are harder.'
assert a in h
h = h.replace(a, 'All 150 training levels are now editable. Pace is harder at the top. Vision was rebuilt as Pick the Pass (B12).', 1)
# 2. check list
a = '<span class="q">Vision level 30</span><span class="a">Many more men on the pitch. A new picture on each try.</span>'
assert a in h
h = h.replace(a, '<span class="q">Vision (rebuilt in B12)</span><span class="a">Training → Vision. Real pictures of real passes: who gets the pass? See the B12 page.</span>', 1)
# 3. the old Vision CHANGED item becomes the new item
i = h.index('<div class="item"><div class="ih"><b>Vision: a new picture each try')
j = h.index('<div class="item"><div class="ih"><b>Pace: no longer flat')
h = h[:i] + new_item + h[j:]
# 4. numbers toggle: new Vision numbers first, the old ones kept and labelled
i = h.index('<p><b>Vision level 30, first-try pass rate (modelled player).</b>')
j = h.index('<p><b>Pace, share of runs cleared')
old_numbers = h[i:j]
old_numbers = old_numbers.replace('<p><b>Vision level 30, first-try pass rate (modelled player).</b> Grey is before. Colour is after.</p>',
                                  '<p><b>Old Vision (replaced by B12), first-try pass rate (modelled player).</b> Grey is before. Colour is after.</p>', 1)
old_numbers = old_numbers.replace('<p><b>Vision level 30, the settings.</b>', '<p><b>Old Vision, level 30, the settings.</b>', 1)
new_numbers = ('<p><b>Rebuilt Vision (B12), first-try pass rate (modelled good player, kicks played on the engine).</b></p>' +
               bars(bar('Level 1', None, 99, 100, '', '99%'), bar('Level 10', None, 93, 100, '', '93%'), bar('Level 20', None, 36, 100, '', '36%'),
                    bar('Level 25', None, 28, 100, '', '28%'), bar('Level 30', None, 21, 100, '', '21%')))
h = h[:i] + new_numbers + old_numbers + h[j:]
# 5. seen list
a = '<li>Vision level 30 before and after (stills)</li>'
assert a in h
h = h.replace(a, '<li>The rebuilt Vision on a phone: level 1 and level 30 (stills from B12)</li><li>The old Vision level 30 before and after (stills, replaced by B12)</li>', 1)
a = '<li>Vision level 30: first-try pass rate 67% → 41% (a modelled player)</li>'
assert a in h
h = h.replace(a, '<li>Old Vision level 30: first-try pass rate 67% → 41% (a modelled player). The rebuilt Vision is 21% (B12).</li>', 1)
# 6. the Edit-panel stills still show the old Vision drill: say so
for old, new in (
    ('<b>Look at:</b> Edit Level 30 (Read the run): seven number boxes,', '<b>Look at:</b> Edit Level 30 (Read the run, the old Vision drill before B12): seven number boxes,'),
    ('<b>Look at:</b> the 30 Vision levels on the left and the Edit panel on the right.', '<b>Look at:</b> the 30 old Vision levels (before B12) on the left and the Edit panel on the right.'),
):
    assert old in h, old
    h = h.replace(old, new)
open(os.path.join(B7, 'index.html'), 'w', encoding='utf-8').write(h)
print('B7 Vision updated;', len(h))
