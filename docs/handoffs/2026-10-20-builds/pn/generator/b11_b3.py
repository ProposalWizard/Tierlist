from lib import *

# =========================== B11 TEAM ROOM ===========================
def b11():
    p = Page('b11')
    f = p.fig
    add = section('add', 'ADDED', [
        item('Seen faces under each message', [tag('seen')], [
            ('Fix', 'Small H, M and L faces sit under every message. They show who has seen it. A dim face looks like “not seen yet” (read from the pictures; the report only says “seen faces”). Until the database file runs, seen faces stay on the device. The screen says so.')],
            p.figs([f('1-chat-receipts-reply-phone.jpg', '<b>Look at:</b> the round faces under each message, and the “Waiting on me” list at the top.')]) +
            details('More pictures (1): before the database file runs', p.figs([f('9-before-migration-phone.jpg', '<b>Look at:</b> the amber note at the top of the chat: “Seen faces and Got it are saved on this device only until team_room_v2.sql runs.”')]))),
        item('Reply with a quote, and tap to jump back', [tag('seen')], [
            ('Fix', 'A message can show Reply and Pin. A reply shows the quote above your words. A tap on the quote jumps to the original message.')],
            p.figs([f('1b-reply-jump-phone.jpg', '<b>Look at:</b> Reply and Pin beside two messages. The blue frame on Mikey’s message looks like the jump-to highlight (reasoned from the file name; the report does not show it).'),
                    f('3-reply-sent-phone.jpg', '<b>Look at:</b> a sent reply: Mikey’s message is quoted, then “on it @Mikey”, then a page card.')])),
        item('@ names and a “Waiting on me” list', [tag('seen')], [
            ('Fix', 'Type @ and a list of names shows. An @ to you shows in gold. A “Waiting on me” list sits at the top of the chat.')],
            p.figs([f('2-at-suggestions-phone.jpg', '<b>Look at:</b> typing “thanks @” opens a Mention list: Mikey and Leo.')]) +
            details('More pictures (1): on a computer', p.figs([f('4-chat-desktop-cards-waiting.jpg', '<b>Look at:</b> the gold @ you messages, and “Waiting on me” on the left.', 'wd')], wide=True))),
        item('Link a page with # or the link button', [tag('seen')], [
            ('Fix', 'The link button attaches this page. Typing # shows page suggestions. A page goes into the chat as a card.')],
            p.figs([f('2b-hash-page-suggestions-phone.jpg', '<b>Look at:</b> typing “look at #gal” opens Link a page: Scenario gallery.'),
                    f('2c-page-attached-phone.jpg', '<b>Look at:</b> the page is attached above the message box, with a ✕ to remove it.')])),
        item('Point at the screen (Shift+X, or the 👉 Point button)', [tag('seen')], [
            ('Fix', 'Drag a box over the part you mean. Write a note. Pick who it is for. The other person opens the link: the page scrolls to the box, outlines it and shows your note. The note stays until they press <b>Got it</b>.')],
            p.figs([f('5-shiftx-drawing-desktop.jpg', '<b>Look at:</b> step 1. A bar says “Drag a box over the part you mean”. The dashed box is on Harry’s card.', 'wd'),
                    f('5b-shiftx-note-desktop.jpg', '<b>Look at:</b> step 2. Write a note. Pick @Mikey and @Leo. Press Send.', 'wd')], wide=True) +
            p.figs([f('6-point-seen-phone.jpg', '<b>Look at:</b> step 3, on a phone. Harry’s card is outlined. “Mikey pointed here” shows the note and a Got it button.')]) +
            details('More pictures (6): the point in the chat, the phone version, and a point passed between devices', p.figs([
                f('5d-point-card-in-chat-desktop.jpg', '<b>The point as a card in the chat.</b> “Not yet” under each name means nobody has pressed Got it.', 'wd'),
                f('5c-shiftx-sent-desktop.jpg', '<b>Sent:</b> a green “Sent to Mikey and Leo” on a computer.', 'wd'),
                f('6b-point-seen-desktop.jpg', '<b>Opened on a computer:</b> the card is outlined and the note says Mikey pointed here.', 'wd')], wide=True) + p.figs([
                f('10b-point-mode-phone.jpg', '<b>Phone point mode:</b> a dashed box over three tiles, a note, and who it is for.'),
                f('6c-desktop-point-opened-on-phone.jpg', '<b>A point made on a computer, opened on a phone.</b>'),
                f('10-bubble-popup-phone.jpg', '<b>The chat bubble on any page:</b> Chat and To-do tabs, a Point button and Open ↗.')]))),
        item('Patch notes: “Read by” faces and a “Read and understood” button', [tag('seen')], [
            ('Fix', 'Each patch-notes version shows who has read it. A Read and understood button marks it. Each version has its own notes thread. The Team board shows “N patch notes to read” under each person.')],
            p.figs([f('7-patch-notes-read-faces-desktop.jpg', '<b>Look at:</b> v0.59: “Read by” H read, M wrote it, L not yet. A Notes · 1 thread sits under it. The list on the left shows faces for every version.', 'wd'),
                    f('8-team-board-patch-to-read.jpg', '<b>Look at:</b> the Team board: “1 patch note to read” under Harry, Mikey and Leo.', 'wd')], wide=True) +
            details('More pictures (1): the patch-notes page on a phone', p.figs([f('7b-patch-notes-read-faces-phone.jpg', 'The Page tab says “Forbidden — patch notes need an admin sign-in”. The report does not mention this.')]))),
    ], note='The report gives no Problem or Why for these six. Each card shows the Fix.')
    bugs = section('bug', 'KNOWN ISSUES', [
        item('Not tried with real people or the real database', [tag('no')], [
            ('Problem', 'It was seen in the local test room at phone and computer size. It was not tried against the real database, a real iPhone, or two people at once.'),
            ('Why', 'The database file (team_room_v2.sql) has not run.'),
            ('Status', 'Replies, @ and points work without it. Seen faces and Got it stay on the device until it runs.')]),
        item('Three lines in the pictures that the report does not cover', [tag('seen')], [
            ('Problem', '<ul><li>The Team board pictures show six amber lines: “GitHub refused the site’s key … Check GITHUB_TOKEN in Vercel”.</li><li>The patch-notes Page tab says “Forbidden — patch notes need an admin sign-in”.</li></ul>'),
            ('Why', 'They are in the pictures. The report does not name them.'),
            ('Status', 'Not checked. They are not part of the B11 changes.')]),
    ])
    return p, dict(
        key='b11', ver='0.74', title='B11 Team Room', pill='B11 · TEAM ROOM',
        headline='Team chat now shows who has seen a message, quotes replies, tags people and pages, and points at the screen.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Seen faces and Reply', 'Team room → Chat. Small H / M / L faces sit under each message. A message can show Reply and Pin.'),
            ('@ and “Waiting on me”', 'Type @ in the message box. An @ to you shows gold. The Waiting on me list sits at the top.'),
            ('Link a page', 'Press the link button, or type # and a page name. It goes in as a card.'),
            ('Point at the screen', 'Press Shift+X, or the 👉 Point button in the chat bubble. Drag a box, write a note, pick who. The other person opens the link and presses Got it.'),
            ('Patch notes read-by', 'Patch notes: a Read by row, a Read and understood button, and a Notes thread. The Team board shows “N patch notes to read”.')],
        sections=[add, bugs], numbers='',
        videos_coming=False,
        videos='<b>No clip is planned for this build.</b><p>Stills show each step. Say if you want one, for example the Point drag.</p>',
        seen=dict(
            seen=['Every feature above, in the local test room at phone and computer size', 'The amber note that says seen faces and Got it stay on the device until team_room_v2.sql runs'],
            no=['The real database', 'A real iPhone', 'Two people at once', 'The jump-to highlight on a tapped quote: only a blue frame in one still']),
        ok=[
            dict(who='For Mikey', q='Run team_room_v2.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, replies, @ and points work. Seen faces and Got it stay on the device.'),
            dict(q='Try the team room with two people on real phones once the file has run?', opts=[('yes', 'p-grn'), ('later', 'p-blu')],
                 d='The report says it was not tried with two people at once.')]
    )

# =========================== B3 REAL DATA ===========================
def b3():
    p = Page('b3')
    f = p.fig
    chg = section('chg', 'CHANGED', [
        item('Afriskaut is out. Two new free sources are in.', [tag('meas')], [
            ('Problem / Why', 'You asked for Afriskaut to be removed. <span class="nr">The report gives no other reason.</span>'),
            ('Fix', 'Afriskaut is gone. Matches went from 2,104 to 1,983 (lost 136, added 15 from SoccerTrack v2 and SkillCorner 2019/20). Tracked matches went from 27 to 42. Fully real moments went from 702 to <b>926</b> (750 shots, 176 corners). Real goals went from 67 to 93.')],
            bars(bar('Fully real moments', 702, 926, 1000, '702', '926'),
                 bar('Real goals', 67, 93, 100, '67', '93'))),
    ])
    add = section('add', 'ADDED', [
        item('Two new data sources', [tag('seen')], [
            ('Fix', '<ul><li><b>SoccerTrack v2</b> (CC BY 4.0): 6 of 10 matches loaded. Google Drive refused the other 4. Re-run later.</li>'
                    '<li><b>SkillCorner first release</b> (MIT): 9 matches. Pattern data only.</li></ul>')],
            details('Checked and NOT used, and not allowed',
                '<p><b>Not used (licence unclear):</b> European Soccer Database, Global Football Data Lake, PFF World Cup 2022, Metrica, Last Row, SoccerTrack v1, SoccerNet.</p>'
                '<p><b>Not allowed:</b> a women’s set (non-commercial), SoccerMon (98 GB, one team).</p>') +
            p.figs([f('b3-06-new-data-a-soccertrack-moment-390.jpg', '<b>Look at:</b> a SoccerTrack v2 moment from a Tsukuba University game: the goal, the keeper, YOU, team-mates (SUP) and defenders (D1–D10) where they really stood.')])),
        item('Data credits in Settings', [tag('seen')], [
            ('Fix', 'Settings → More → Data credits. Eight lines say where the real football data comes from.')],
            p.figs([f('b3-01-settings-data-credits-390.jpg', '<b>Look at:</b> two groups of four credits: “How real football plays” and “Real moments”.')])),
        item('Real moment highlights (a new switch)', [tag('seen'), tag('meas')], [
            ('Fix', 'Settings → Full highlights rebuild → <b>Real moment highlights: Off | On</b>. It shows only while the rebuild is On. With it on, <b>1 in 4</b> open-play one-on-ones, tight angles and long-range chances becomes a real moment of the same kind, with the real 4 s build-up. 652 moments are allowed in the game.'
                    '<ul><li>Tested over 120 matches: 24.5% served, right kind 100%.</li><li>A moment marked “Don’t use” was served 0 times in 400.</li></ul>')],
            p.figs([f('b3-02-settings-two-switches-390.jpg', '<b>Look at:</b> Real moment highlights, Off | On, under Full highlights rebuild.'),
                    f('b3-03-real-moment-in-the-match-390.jpg', '<b>Look at:</b> Infinite Match, a Long range chance at 32′. The report says a real moment was served here. Nothing on this still marks it as real.')]) +
            p.video('real-moment-switches-and-match.mp4', 'b3-switches-both-on.jpg', 'both switches going On in Settings (Full highlights rebuild, then Real moment highlights), then Infinite Match serving a Tight Angle chance at 4′ where the men start moving in the real build-up. The clip is 9 seconds long, on a phone-size screen. The testing flag that makes every chance a real one was used so one shows at once.',
                    'Settings, then Infinite Match (9 s, no sound). Nothing on screen labels the chance as real, so the clip uses the testing flag ?realmoments=every.', phone=True)),
        item('A Real moments page: choose which moments the game may use', [tag('seen')], [
            ('Fix', 'For each moment: Use in game, Don’t use or Automatic. There is a filter, a count, and a “Commit marks to the game” button. A README explains how to add, remove and edit moments.')],
            p.figs([f('b3-04-real-moments-dont-use-390.jpg', '<b>Look at:</b> a long-range moment marked “Don’t use” (blue). The amber note says: saved on this device only; marking for everyone needs an admin sign-in.'),
                    f('b3-05-real-moments-in-the-game-390.jpg', '<b>Look at:</b> the In the game panel: 653 real moments (One-on-one 256, Tight angle 137, Long range 260), and “1 mark not in the code yet”. The report says 652. This still says 653.')])),
    ], note='The report gives no Problem or Why for these four. Each card shows the Fix.')
    bugs = section('bug', 'KNOWN ISSUES', [
        item('4 of the 10 SoccerTrack v2 matches are missing', [tag('meas')], [
            ('Problem', 'Only 6 of 10 matches loaded.'),
            ('Why', 'Google Drive refused the other 4.'),
            ('Status', 'Re-run later.')]),
        item('Marks are saved on this device only', [tag('seen')], [
            ('Problem', 'Marks you make on the Real moments page stay on the device. The screen says so.'),
            ('Why', 'The database file star_real_moments_picks.sql has not run.'),
            ('Status', 'Waiting on Mikey. Use “Commit marks to the game” to put marks in the code.')]),
        item('Not seen inside a career match', [tag('no')], [
            ('Problem', 'A real moment was seen in Infinite Match. It was not seen inside a career match.'),
            ('Why', NR), ('Status', 'Not seen.')]),
    ])
    numbers = (
        '<p><b>Real football data.</b> Grey is before. Colour is after.</p>' +
        bars(bar('Matches', 2104, 1983, 2200, '2,104', '1,983'),
             bar('Tracked matches', 27, 42, 50, '27', '42'),
             bar('Fully real moments', 702, 926, 1000, '702', '926'),
             bar('Real goals', 67, 93, 100, '67', '93'),
             note='Matches: lost 136 with Afriskaut, added SoccerTrack v2 and SkillCorner 2019/20. Fully real moments: 750 shots and 176 corners.') +
        '<p><b>Real moment highlights, 120 matches tested:</b> 24.5% served. Right kind 100%. “Don’t use” served 0 of 400. 652 moments are allowed in the game.</p>')
    return p, dict(
        key='b3', ver='0.67', title='B3 Real Data', pill='B3 · REAL DATA',
        headline='Afriskaut is out, two free sources are in, data credits are in Settings, and real moments can appear in your matches.',
        sub='Overnight round, 20 Oct 2026.',
        checks=[
            ('Data credits', 'Settings → More → Data credits. Eight lines.'),
            ('The new switch', 'Settings → Full highlights rebuild → Real moment highlights: Off | On. It shows only while the rebuild is On.'),
            ('The Real moments page', 'For each moment: Use in game, Don’t use, Automatic. Try the filter. The count shows at the top.'),
            ('A SoccerTrack moment', 'On the Real moments page, search “Tsukuba”. Open No. 40 (9′).'),
            ('A real moment in Infinite Match', 'With Real moment highlights On, about 1 in 4 one-on-ones, tight angles and long-range chances is a real one.')],
        sections=[chg, add, bugs], numbers=numbers,
        videos_coming=False, videos_here=True,
        videos='<b>One clip is on this page.</b><p>The two switches going On, then Infinite Match serving a real moment. 9 seconds, on a phone-size screen. It is under &ldquo;Real moment highlights (a new switch)&rdquo; above.</p>',
        seen=dict(
            seen=['Settings credits and the two switches', 'The Real moments page marks, filter and count', 'A SoccerTrack moment', 'A real moment served in Infinite Match', 'A 9-second clip of the two switches and Infinite Match (filmed 20 Oct on the built Harry branch, with the testing flag)'],
            meas=['Matches 2,104 → 1,983. Tracked 27 → 42. Fully real moments 702 → 926. Real goals 67 → 93', '120 matches: 24.5% served, right kind 100%, “Don’t use” served 0 of 400'],
            no=['Inside a career match', 'A count that does not match: the report says 652 moments are allowed; the still says 653, with “1 mark not in the code yet”']),
        ok=[
            dict(who='For Mikey', q='Run star_real_moments_picks.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, marks are saved on the device only. The screen says so.'),
            dict(who='Rule check', q='Real moment highlights is an Off | On row. Keep it inside the Full highlights rebuild switch?', by='Harry, 19 Oct',
                 done='Keep it. Harry asked for exactly this on 19 Oct (DATA-2): &ldquo;inside the highlights toggle, another toggle Real moment highlights&rdquo;.'),
            dict(q='Delete the raw downloaded data after use?', by='Harry, 20 Oct',
                 done='Done for the 1.2 GB downloaded for this build. The rule is written in data/opendata/README.md.')],
        footer='20 Oct 2026. Built overnight on the Harry branch. Nothing here is live. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work. Harry&rsquo;s answers are marked as decided.'
    )
