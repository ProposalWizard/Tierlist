from lib import *

# =========================== B1 TOUCH FIXES ===========================
def b1():
    p = Page('b1')
    f = p.fig
    tiles = ''.join([
        tile('Negotiation: − and + buttons',
             'One tap moves your offer one step. In the test, one tap went from ★1.9m to ★2.15m. Hold the button and slide off it: the repeat stops.',
             p.figs([f('01-negotiation-plus-minus.jpg', '<b>Look at:</b> the big round − and +. The line under them says ± ★250,000 per press. (The 1.9m → 2.15m test is in the report. This still shows the buttons only.)')])),
        tile('Energy buttons show their names',
             'The three energy buttons now say LOW, MEDIUM and HIGH.',
             p.figs([f('02-energy-captions.jpg', '<b>Look at:</b> LOW, MEDIUM and HIGH under the three bolts at the bottom of the match screen.')])),
        tile('Achievements: tap one to see what it is',
             'A tap on an achievement shows its description.',
             p.figs([f('08-achievement-tap.jpg', '<b>Look at:</b> “Score a Goal” is open. It says “Score your first career goal”.')])),
        tile('Profile: the delete ✕ shows on touch',
             'The ✕ is 32 px. A tap opens the confirm box. It does not open the tierlist.',
             p.figs([f('04-profile-delete-x-touch.jpg', '<b>Look at:</b> a red ✕ on both tierlists (My Tierlists).'),
                     f('04b-profile-delete-asks-first.jpg', '<b>Look at:</b> after a tap on ✕: “Delete this tierlist?” with Delete and Cancel.')])),
        tile('Admin images: a grip to drag',
             'Each image has a ⠿ grip. On a phone: hold an image, then drag.',
             p.figs([f('05-admin-drag-grip.jpg', '<b>Look at:</b> the ⠿ grip at the bottom left of each image.')])),
        tile('Zoom: − and + buttons, and pinch',
             'Two taps on + give 150%. A pinch took the zoom from 100% to 300%.',
             p.figs([f('07-zoom-buttons.jpg', '<b>Look at:</b> − 150% + at the bottom. The hint line says: Pinch, scroll or use − / + to zoom.')])),
    ])
    reasoned = details('Fixes nobody has seen yet (reasoned from the code)',
        '<ul><li>Bigger touch areas: page arrows, grab bar, help button, close and sound buttons, colour inputs, minimap markers, sliders, gallery dots, chips.</li>'
        '<li>Tap to show names on trophies and on last-5 opponents.</li>'
        '<li>Click-outside now fires on touch down.</li>'
        '<li>Create-tierlist ✕ and ✂ show on touch.</li>'
        '<li>The crop hint says “pinch or use the slider”.</li></ul>')
    fixed = section('fix', 'FIXED', [
        item('Touch fixes: all 27 are built', [tag('seen', '6 seen'), tag('reas', 'rest reasoned')], [
            ('Problem / Why', 'Controls made for a mouse are hard to use by touch. <span class="nr">This is reasoned from the fix list. The report gives no cause for each fix.</span>'),
            ('Fix', '26 were built overnight. The 27th (G5, the in-match buttons) was done on 20 Oct after your OK. Six were seen on a touch phone screen (below). The rest are reasoned from the code.')],
            tiles + reasoned),
        item('In-match buttons are finger-sized (G5)', [tag('reas', 'size only, no still')], [
            ('Problem', 'The in-match mute, TOUCH and Power buttons were 26–30 px. That is small for a thumb.'),
            ('Why', 'They live in the match file (sensitive), which is on the &ldquo;may drift&rdquo; list. The red warning asks before any edit there, so it waited for your OK.'),
            ('Fix', 'Done on 20 Oct after your OK. The mute button is now at least 40 px wide. TOUCH and Power are at least 36 px tall. Only the size styling changed. No game logic.')]),
        item('Player of the Month cards: drawn heads', [tag('seen')], [
            ('Problem', 'A photo link needed a SoFIFA sign-in to show.'),
            ('Why', 'The cards loaded the photo from SoFIFA. <span class="nr">(Reasoned from the report’s words.)</span>'),
            ('Fix', 'The cards now draw the head. Seen: <b>11 drawn heads, 0 broken images</b>.')],
            p.figs([f('06-potm-drawn-heads.jpg', '<b>Look at:</b> the shortlist of 8 heads and the Haaland card. All are drawn heads.')]) +
            details('More pictures (1)', p.figs([f('03-potm-win-popup.jpg', '<b>Look at:</b> your own “You won it” pop-up. A drawn head too.')]))),
        item('4 old failing tests now pass', [tag('meas')], [
            ('Problem', 'Four checks failed: chanceJudge, keeperPro, keeperBrain and the Wembley test.'),
            ('Why', 'The first three broke when the chance drawings were redrawn or deleted on 14–15 Oct. The code did not break them. With the 14 Oct drawings, all three passed with the old numbers.'),
            ('Fix', 'The stored fingerprint of the drawings was re-recorded. The samples are bigger (keeperPro 80 → 240 seeds, keeperBrain 200 → 600). <b>The limits were not loosened.</b> The Wembley test is a real game change (below).')],
            bars(bar('Keeper errors (limit: under 1.5%)', 1.6, 0.8, 2, '1.6%', '0.8%'),
                 bar('Rebound goals (limit: under 7%)', 7.2, 5.5, 8, '7.2%', '5.5%'))),
    ])
    chg = section('chg', 'CHANGED', [
        item('Wembley minigame: the stronger striker no longer hits the bar', [tag('meas'), '<span class="tag t-no">real game change</span>'], [
            ('Problem', 'The stronger striker’s rising shot crossed at 2.2–2.3 m and hit the bar <b>17 times in 124 shots</b>. This test never passed in the visible history.'),
            ('Why', 'The shot was still rising too high when it reached the bar. <span class="nr">(Reasoned from the report’s numbers.)</span>'),
            ('Fix', 'Shots are aimed lower. Keeper 36 → 70. Valve drop 6 → 10 (the report gives no units). The 80-rated striker now wins 40% of the time. A fair share is 25%.')],
            bars(bar('80-rated striker’s win share (fair share: 25%)', 23, 40, 50, '23%', '40%'))),
    ])
    bugs = section('bug', 'KNOWN ISSUES', [
        item('3 other test files still fail', [tag('meas')], [
            ('Problem', 'The full suite: 365 passed, 3 failed (chanceMaker, longRangeRules, match2dCam).'),
            ('Why', 'All 3 fail the same way on the base before B1. B1 did not cause them.'),
            ('Status', 'Untouched.')]),
    ])
    numbers = (
        '<p><b>Old tests (limits were not loosened).</b> Grey is before. Colour is after.</p>' +
        bars(bar('keeperPro errors (limit: under 1.5%)', 1.6, 0.8, 2, '1.6%', '0.8%'),
             bar('keeperPro rebound goals (limit: under 7%)', 7.2, 5.5, 8, '7.2%', '5.5%'),
             bar('keeperBrain “moves early” (floor: over 55%)', 54.6, 59.5, 70, '54.6%', '59.5%')) +
        '<p><b>Wembley, over 124 shots.</b></p>' +
        bars(bar('Win share of the 80-rated striker (fair: 25%)', 23, 40, 50, '23%', '40%'),
             bar('Shots in', 53, 38, 60, '53%', '38%'),
             bar('Session length', 89, 146, 160, '89 s', '146 s'),
             note='Also: keeper 36 → 70, valve drop 6 → 10. The report gives no units. Bar hits before the fix: 17 in 124 shots.') +
        '<p><b>Full test suite:</b> 365 passed, 3 failed (the same 3 fail on the base).</p>')
    return p, dict(
        key='b1', ver='0.66', title='B1 Touch Fixes', pill='B1 · TOUCH FIXES',
        headline='Phones get all 27 touch fixes. The 4 old failing tests pass. Wembley is fairer.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Negotiation: tap − and +', 'Sign a player and open the talks. One tap should move your offer one step.'),
            ('Match: LOW, MEDIUM, HIGH', 'In a match, the three energy buttons at the bottom show their names.'),
            ('Match: mute, TOUCH and Power buttons', 'In a match, these three are easy to hit with a thumb (mute at least 40 px wide, the other two at least 36 px tall).'),
            ('Achievements: tap one', 'Career overview → Achievements. A tap shows the description.'),
            ('Profile: the ✕ on your tierlists', 'Profile → My Tierlists on a touch phone. The red ✕ shows. A tap asks before it deletes.'),
            ('Zoom: − and + and pinch', 'Open the image zoom view. Use − and +, or pinch.')],
        sections=[fixed, chg, bugs], numbers=numbers,
        videos_coming=True,
        videos='<b>Videos coming.</b><p>Clips are filmed after the push and added to this page.</p><ul><li>Wembley minigame: a round of shots.</li><li>Negotiation − and +: a tap, a hold, and a slide off the button.</li></ul>',
        seen=dict(
            seen=['The six touch fixes above, on a touch phone screen', 'Player of the Month cards: 11 drawn heads, 0 broken images'],
            meas=['The 4 old tests: keeper errors, rebound goals and “moves early” (see The numbers)', 'Wembley: 17 bar hits in 124 shots before; win share 23% → 40%', 'Full suite: 365 passed, 3 failed (the same 3 fail on the base)'],
            reas=['Bigger touch areas, tap-to-show names, click-outside, create-tierlist ✕ and ✂, the crop hint (list above)', 'In-match mute, TOUCH and Power sizes (G5): a class-only change, done 20 Oct, no still'],
            no=['Whether anyone played the new Wembley by hand: not in the report']),
        ok=[
            dict(q='Edit the match file (sensitive) to resize the in-match buttons (mute, TOUCH, Power)?', by='Harry, 20 Oct',
                 done='Yes. Done: size only, no game logic. The mute button is at least 40 px wide. TOUCH and Power are at least 36 px tall.'),
            dict(q='Keep the Wembley change?', by='Harry, 20 Oct',
                 done='Keep it. A real game change: the striker’s win share went from 23% to 40% (fair share: 25%). Harry also asked the next build (B16) to measure the keepers in the 3D minigames. It will check against this keeper change (36 → 70). His target: about 1 shot in 3 saved.')],
        footer='20 Oct 2026. Built overnight on the Harry branch. Nothing here is live. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work. Harry&rsquo;s answers from the morning of 20 Oct are marked as decided.'
    )

# =========================== B4 ADMIN SKINS ===========================
def b4():
    p = Page('b4')
    f = p.fig
    looks = p.figs([
        f('home-computer-broadcast.jpg', '<b>Broadcast.</b> Look at: the same sidebar and tiles in all four looks.', 'wd'),
        f('home-computer-bento.jpg', '<b>Bento.</b> Dark words on a pale tint. White count pill.', 'wd'),
        f('home-computer-ops.jpg', '<b>Ops room.</b> Same layout. Dark green surfaces.', 'wd'),
        f('home-computer-light.jpg', '<b>Clean light.</b> Same layout. White surfaces.', 'wd')], wide=True)
    phones = details('More pictures (4): the Chances group on a phone in each look', p.figs([
        f('group-chances-phone-broadcast.jpg', '<b>Broadcast</b> on a phone.'),
        f('group-chances-phone-bento.jpg', '<b>Bento</b> on a phone.'),
        f('group-chances-phone-ops.jpg', '<b>Ops room</b> on a phone.'),
        f('group-chances-phone-light.jpg', '<b>Clean light</b> on a phone.')]))
    chg = section('chg', 'CHANGED', [
        item('One layout, four looks', [tag('seen')], [
            ('Fix', 'Broadcast, Bento, Ops room and Clean light all use Broadcast’s layout. Only colours, fonts and surfaces change. Bento cards now show dark words on a pale tint, with a white count pill. <b>Clean light is now the default look</b> (20 Oct): a browser that never picked a look opens in it. Anyone who picked a look keeps it.')],
            looks + phones),
        item('One back arrow, in the same place', [tag('seen'), tag('meas')], [
            ('Fix', 'One arrow, top left, on every framed page. A page goes back to its group. A group page goes back to its game’s home. Measured: the arrow sits at the same corner on every framed page on a phone.')],
            p.figs([f('back-arrow-3-pages-phone.jpg', '<b>Look at:</b> the arrow, top left, on all three pages (Site XP Rewards, Manager’s Office, Full match). Two things here are not in the report: a red “Failed to fetch” box on the XP page, and the chat bubble over “Next line ›” in the Manager’s Office.')], wide=True)),
        item('Smaller chat bubble that stays out of the way', [tag('seen'), tag('meas')], [
            ('Problem', 'The bubble was 50 px wide. <span class="nr">The report does not say what it covered.</span>'),
            ('Fix', '40 px, fixed at the bottom left. Only the round button takes taps. It fades to 40% while you scroll and lets taps through. Measured on a phone: nothing sits under it on Admin home, Infinite Highlights, Full match, the gallery and Play Area.')],
            bars(bar('Bubble size', 50, 40, 60, '50 px', '40 px')) +
            p.figs([f('bubble-faded-while-scrolling-phone.jpg', '<b>Look at:</b> the bubble, bottom left, faded while the page is scrolled.'),
                    f('bubble-over-letsgo-training-phone.jpg', '<b>Look at:</b> Training levels. The bubble covers the left 11 px of “Let’s go”. The button still takes the tap.')])),
    ], note='The report gives no Problem or Why for the layout and the back arrow. Each card shows the Fix.')
    fix = section('fix', 'FIXED', [
        item('Words you could not read in the light looks', [tag('meas'), tag('seen')], [
            ('Problem', 'About <b>320 unreadable words on 12 pages</b> in the light looks.'),
            ('Why', NR),
            ('Fix', 'An “ink guard” on about 40 test pages fixes the words. Now <b>0–3 per page</b>.')],
            p.figs([f('bc-page-tournaments-computer-light.jpg', '<b>Look at:</b> the Tournaments test page in Clean light. Every word can be read.', 'wd'),
                    f('bc-page-tournaments-computer-ops.jpg', 'The same page in Ops room.', 'wd')], wide=True)),
    ])
    add = section('add', 'ADDED', [
        item('Research area', [tag('seen')], [
            ('Fix', 'A Research page on the Studio tab: 4 write-ups as cards. Tap Read to open one. To add a write-up, add one line to a list (lib/research.ts).')],
            p.figs([f('research-computer-broadcast.jpg', '<b>Look at:</b> four cards: Learning from FM, Highlights, Full highlights rebuild plan, 3D audit and plan.', 'wd'),
                    f('research-phone-bento.jpg', 'The same page on a phone in Bento.')])),
    ], note='The report gives no Problem or Why for these two. Each card shows the Fix.')
    bugs = section('bug', 'KNOWN ISSUES', [
        item('3D places keep their own back button', [tag('no', 'not done')], [
            ('Problem', 'The 3D garden, house, shop and training keep their own in-game back.'),
            ('Why', NR), ('Status', 'Decided (Harry, 20 Oct): these keep their own back button. Everything else uses the one arrow.')]),
        item('Two things in the pictures that the report does not cover', [tag('seen')], [
            ('Problem', '<ul><li>In the Manager’s Office, the chat bubble sits on the left end of “Next line ›”.</li><li>The Site XP Rewards page shows a red “Failed to fetch” box.</li></ul>'),
            ('Why', 'The report measured other pages. It does not name these two.'),
            ('Status', 'Queued for the next build, B13 Fixes (Harry, 20 Oct): the XP Rewards “Failed to fetch” and the bubble over “Next line ›”. Not checked yet: does “Next line ›” still take the tap?')]),
    ])
    numbers = (
        bars(bar('Chat bubble size', 50, 40, 60, '50 px', '40 px')) +
        '<p><b>Light looks, test pages:</b> about 320 unreadable words on 12 pages before. 0–3 per page after. The ink guard covers about 40 pages.</p>'
        '<p><b>Chat bubble:</b> measured on a phone. Nothing under it on Admin home, Infinite Highlights, Full match, the gallery and Play Area. On Training levels it covers the left 11 px of “Let’s go”, which still takes the tap.</p>'
        '<p><b>Back arrow:</b> measured at the same corner on every framed page on a phone.</p>')
    return p, dict(
        key='b4', ver='0.68', title='B4 Admin Skins', pill='B4 · ADMIN SKINS',
        headline='The admin has one layout in four looks, one back arrow, a smaller chat bubble and a Research area.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Switch the look', 'Admin menu, bottom: Look. Pick Broadcast, Bento, Ops room or Clean light. The layout stays the same. A browser that never picked a look opens in Clean light.'),
            ('Back arrow', 'On a phone, open any admin page. The arrow is top left. A page goes back to its group. A group goes back to its game’s home.'),
            ('Chat bubble', 'Bottom left, 40 px. Scroll the page: it fades. Taps pass through to the page.'),
            ('A test page in a light look', 'Open Tournaments in Clean light. Every word can be read.'),
            ('Research', 'Studio tab → Research. Four write-ups as cards.')],
        sections=[chg, fix, add, bugs], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>Looks are judged by stills. Say if you want one, for example the bubble fading while you scroll.</p>',
        seen=dict(
            seen=['The four looks on Admin home (computer) and on the Chances group (phone)', 'The back arrow on three phone pages', 'The chat bubble on a phone: faded while scrolling, and next to “Let’s go”', 'Research on a computer and on a phone', 'The Tournaments test page in Clean light and in Ops room'],
            meas=['About 320 unreadable words on 12 pages before, 0–3 per page after', 'Back arrow at the same corner on every framed page on a phone', 'Chat bubble: nothing under it on five pages; 11 px of “Let’s go” on Training levels'],
            no=['3D garden, house, shop and training keep their own back (not done)', 'Words on the rest of the ~40 light-look test pages: the report measured 12 pages', 'Chat bubble over “Next line ›” in the Manager’s Office: in a picture, not measured']),
        ok=[
            dict(q='3D garden, house, shop and 3D training keep their own in-game back button. Leave it, or join them to the one arrow?', by='Harry, 20 Oct',
                 done='Leave it. Those four keep their own back button. Every other page uses the one arrow.'),
            dict(q='On Training levels the chat bubble covers the left 11 px of “Let’s go”. Fine to leave?', by='Harry, 20 Oct',
                 done='Fine. It is on an admin or test page only, and the button still takes the tap.'),
            dict(q='Which look do you open in by default?', by='Harry, 20 Oct',
                 done='Clean light (&ldquo;he [Mikey] preferred that&rdquo;). Done. Anyone who already picked a look keeps it.')],
        footer='20 Oct 2026. Built overnight on the Harry branch. Nothing here is live. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work. Harry&rsquo;s answers from the morning of 20 Oct are marked as decided.'
    )
