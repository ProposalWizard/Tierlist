from lib import *

G = os.path.join(SRC, '1gVo', 'img')
H = os.path.join(SRC, 'H9wz', 'img')
C = os.path.join(SRC, 'CcMz', 'img')
T = os.path.join(SRC, 'team')
B4 = os.path.join(BASE, 'b4')

MAIN = 'Merged to main on 20 Oct (PR #744). It goes live with the main deploy. Not checked on the live site from here.'
FOOT19 = '19 Oct 2026. Facts come from the 19 Oct patch notes, the notes and answers files in the repo, and the build log. Pictures are stills taken while checking the work. Harry&rsquo;s answers are marked as decided.'

# =========================== ADMIN SPLIT + LOOKS ===========================
def admin19():
    p = Page('a19admin', [G, H, C, B4])
    f = p.fig
    add = section('add', 'ADDED', [
        item('The admin is split by game', [tag('seen')], [
            ('Problem', 'Website games (tierlists, draft, tic-tac-toe) and Road to Ballon d&rsquo;Or sat in one long admin list.'),
            ('Why', 'The admin was built when there was one game. You said: &ldquo;we may be a production company that makes a lot of games&rdquo;.'),
            ('Fix', 'One tab per game at the top of every admin page: <b>Road to Ballon d&rsquo;Or</b> (44 pages), <b>Website games</b> (10) and <b>Studio</b> (5: team board, patch notes, videos, testers). A new game adds a new tab. The side menu shows only the current game&rsquo;s groups.')],
            p.figs([f('split-star.jpg', '<b>Look at:</b> three game tabs on top. Down the side: only that game&rsquo;s groups.', 'wd'),
                    f('split-web.jpg', '<b>The Website games tab on a phone:</b> its own four groups.')], wide=True)),
        item('Side tabs are back on the Broadcast look', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'A group page has its other groups as tabs along the top (Career screens, Chances, Match tests&hellip;).')],
            p.figs([f('sidetabs.jpg', '<b>Look at:</b> the Chances group: three picture cards, and the other groups as tabs above them.', 'wd')], wide=True)),
        item('The admin home is one page of group cards', [tag('seen')], [
            ('Problem', 'The admin list was one long wall of pages.'),
            ('Why', 'You had to scroll and guess. 59 pages were in the list.'),
            ('Fix', 'The home shows groups only. <b>Grid</b> shows picture cards. <b>List</b> shows rows. The device remembers your pick.')],
            p.figs([f('bg-home-grid-pc.jpg', '<b>Look at:</b> the group cards and the Grid | List switch at top right.', 'wd')], wide=True) +
            details('More pictures (2): List on a computer, Grid on a phone', p.figs([f('bg-home-list-pc.jpg', '<b>List view on a computer.</b>', 'wd')], wide=True) + p.figs([f('bg-home-grid-phone.jpg', '<b>Grid on a phone.</b>')]))),
        item('Each group has a page of picture cards: Admin tools and Test pages', [tag('seen')], [
            ('Problem', 'A group was a list of names, so you could not see what a page was. Pages for new ideas sat next to pages for features we keep.'),
            ('Why', 'You open pages by what they look like. You said: &ldquo;we need to differentiate&rdquo;.'),
            ('Fix', 'Each group page has two boxes: <b>Admin tools</b> (things already in the game that we tune) and <b>Test pages</b> (new things being tried). 28 pages were marked as tests, a first guess. Every card has its owner and an Open button.')],
            p.figs([f('a1-now.jpg', '<b>Look at:</b> Real data on a phone: &ldquo;Admin tools 4&rdquo;, then &ldquo;Test pages 5&rdquo;. This is the layout you kept.'),
                    f('a1-mixed.jpg', '<b>The other choice, not used:</b> one list of all 9 pages, A to Z.')]) +
            details('More pictures (1): the Real data group before the split', p.figs([f('bg-group-data-pc.jpg', '<b>Look at:</b> nine picture cards. This still is from before the Admin tools | Test pages split.', 'wd')], wide=True))),
        item('Looks: Broadcast and Bento, and now Clean light is the default', [tag('seen')], [
            ('Problem', 'Only two admin looks existed. You picked D and F from eight mock-ups.'),
            ('Why', 'Both show every group at once, so you do not click into each one.'),
            ('Fix', '<b>Broadcast</b> (midnight blue, slanted bars) and <b>Bento</b> (a soft colour per group) joined <b>Ops room</b> and <b>Clean light</b> on the Look switch, now a 2&times;2 grid. On 20 Oct you set the default: <b>Clean light</b> opens for anyone who never picked a look (&ldquo;he preferred that&rdquo;). Anyone who picked a look keeps it. All four looks also share one layout now (see the B4 page).')],
            p.figs([f('broadcast-pc.jpg', '<b>Broadcast</b> on a computer. All 12 groups fit one 900 px screen.', 'wd'),
                    f('bento-pc.jpg', '<b>Bento:</b> every group and every page on one computer screen.', 'wd'),
                    f('home-computer-light.jpg', '<b>Clean light</b>, the default look now.', 'wd')], wide=True) +
            details('More pictures (1): Broadcast on a phone', p.figs([f('broadcast-phone.jpg', '<b>Broadcast on a phone.</b>')]))),
        item('New admin pages keep the look by themselves', [tag('reas', 'read from the code')], [
            ('Problem', 'A new page would arrive in the old look.'),
            ('Why', 'You asked: &ldquo;how do we keep up the look&rdquo; on a new page.'),
            ('Fix', 'One shared Broadcast frame. A build check stops the deploy if a new admin page does not use it. A short &ldquo;not yet&rdquo; list of older pages can only get shorter.')]),
    ])
    chg = section('chg', 'CHANGED', [
        item('36 Road to Ballon d&rsquo;Or admin pages are on the Broadcast frame', [tag('seen')], [
            ('Problem', 'The Road to Ballon d&rsquo;Or admin pages were not on the new look. The site menu and footer sat on top of the admin frame.'),
            ('Why', 'You picked a layout for each page from mock-ups. Each page was built from the option you picked.'),
            ('Fix', '<b>36 pages</b> are on the frame in the layout you picked, <b>with every button kept</b>. The &ldquo;New-look admin pages&rdquo; notes show 30 of them one by one. Eleven were left alone on purpose. Five of those stay as they are (Club data, Career XP book, Team sheets, Leo&rsquo;s Oct 13 update, Goal videos). The 3D pages followed in the B6 build.')],
            details('More pictures (8): five pages, before and after', p.figs([
                f('real-moments-before-pc-900.jpg', '<b>Real moments, before.</b>', 'wd'), f('real-moments-after-pc-900.jpg', '<b>After:</b> one big Play button, a search box.', 'wd'),
                f('training-levels-before-pc-900.jpg', '<b>Training levels, before.</b>', 'wd'), f('training-levels-after-pc-900.jpg', '<b>After:</b> tabs, a grid of 30 levels, a panel.', 'wd'),
                f('star-pass-before-pc-900.jpg', '<b>Star Pass, before.</b>', 'wd'), f('star-pass-after-pc-900.jpg', '<b>After:</b> five tier cards.', 'wd'),
                f('balance-numbers-before-pc-900.jpg', '<b>Balance numbers, before.</b>', 'wd'), f('balance-numbers-after-pc-900.jpg', '<b>After:</b> a slider on each number.', 'wd')], wide=True))),
        item('Admin on a phone: less room for bars, more for pages', [tag('meas'), tag('seen')], [
            ('Problem', '&ldquo;Too much space on mobile is taken up by UI and text.&rdquo; The tabs, search, filters and team card filled about 460 px before the first group box.'),
            ('Why', NR),
            ('Fix', 'A slimmer top bar and tabs. The search is one slim line. The filters and the team&rsquo;s three faces share one line that scrolls sideways. &ldquo;Saves real data&rdquo; reads &ldquo;Real data&rdquo;. Group boxes are three to a row. Group pages show two cards to a row. Filters stay 30 px tall so a finger still hits them.')],
            bars(bar('Where the first group box starts on a phone (px)', 430, 223, 460, '430', '223'),
                 note='All 8 Road to Ballon d&rsquo;Or groups now fit one phone screen.') +
            p.figs([f('ph-before.jpg', '<b>Before:</b> the first box starts about 430 px down.'),
                    f('ph-after.jpg', '<b>After:</b> the first box starts at 223 px.'),
                    f('ph-group.jpg', '<b>After:</b> a group page.')])),
    ])
    fix = section('fix', 'FIXED', [
        item('Fixes found while moving the pages', [tag('seen')], [
            ('Problem', 'Small bugs showed up while the pages moved. The list is in the Fix row.'),
            ('Why', NR),
            ('Fix', '<ul><li>Team sheets: opening a club no longer saves. Only an edit saves.</li>'
                    '<li>International world: the card pictures follow the picked nation.</li>'
                    '<li>Full match: event lines show the club name, not &ldquo;{club}&rdquo;.</li>'
                    '<li>Real Goals: the big card draws its own goal mouth.</li>'
                    '<li>Site games: phone fixes for Ten-A-Ball, tic-tac-toe, tierlists and draft.</li></ul>')],
            details('More pictures (3): three screens from the live part', p.figs([
                f('retire.jpg', '<b>Retirement screens</b> (option 2).'), f('starpass.jpg', '<b>Star Pass</b> (tiers).'), f('intl.jpg', '<b>International world</b>.')]))),
    ])
    numbers = (
        '<p><b>Phone admin, where the first box starts.</b> Grey is before. Colour is after.</p>' +
        bars(bar('First group box (px from the top)', 430, 223, 460, '430', '223')) +
        '<p><b>Pages.</b> Road to Ballon d&rsquo;Or 44, Website games 10, Studio 5 (counts on 19 Oct). 59 pages in the old list. 28 marked as test pages. 12 group cards. 36 pages on the Broadcast frame; 11 left alone on purpose.</p>')
    return p, dict(
        key='a19admin', ver='0.65', title='Admin Split + Looks', pill='19 OCT · ADMIN',
        headline='The admin is split by game, group pages show picture cards, there are four looks on one layout, and the phone admin wastes less room.',
        sub='19 Oct 2026, with two 20 Oct changes (the looks share one layout; Clean light is the default).',
        status=MAIN + ' Clean light as the default is newer, from 20 Oct. It is on the Harry branch only.',
        footer=FOOT19,
        checks=[
            ('Game tabs', 'Open the admin. Three tabs at the top: Road to Ballon d&rsquo;Or, Website games, Studio. The side menu shows one game&rsquo;s groups.'),
            ('A group page', 'Open any group (for example Real data). Its pages sit in two boxes: Admin tools and Test pages.'),
            ('The Look switch', 'Admin menu, bottom: Broadcast, Bento, Ops room, Clean light. The layout stays the same. A new browser opens in Clean light.'),
            ('Admin on a phone', 'A slim search, the filters on one line, three group boxes in a row.'),
            ('A page on the frame', 'Open Real moments or Training levels. The page has the frame and every button it had.')],
        sections=[add, chg, fix], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned.</b><p>Looks are judged by stills. Say if you want one.</p>',
        seen=dict(
            seen=['Broadcast and Bento at 1440&times;900 and 390&times;844, 0 page errors', 'The admin home (Grid and List), group pages, the game tabs, the side tabs', 'Every one of the 30 pages was checked by its builder in a browser at computer and phone size, with clicks'],
            meas=['The first group box on a phone: 430 px &rarr; 223 px', 'Admin pages: 44 + 10 + 5'],
            reas=['The build check that stops a deploy: read from the code, not seen failing a bad page'],
            no=['Any page on a real phone', 'Any save reaching the real database: every save was faked in the tests', 'The first &ldquo;Admin tools | Test pages&rdquo; split was not on a screen in the first notes; the A-1 pictures show it now']),
        ok=[
            dict(who='No answer on record', q='Relationship games: move the games&rsquo; rules (fixed numbers in code) into the settings file so they can be tuned?', opts=[('yes', 'p-grn'), ('no', 'p-red')],
                 d='Today only the test player&rsquo;s dials change. It is a small build. From the New-look admin pages notes; your 20 Oct answers do not mention it.'),
            dict(who='No answer on record', q='Goal videos: move it to the new look only if it can really edit highlights. Is that the plan?', opts=[('yes', 'p-grn'), ('no', 'p-red')],
                 d='It is one of the pages left alone on purpose. Your 20 Oct answers do not mention it.'),
            dict(q='A-1: two headings (Admin tools, Test pages), or one list A to Z?', by='Harry, 20 Oct', done='Keep the two headings.'),
            dict(q='A-2: the Bento cards are hard to read. Redo them or drop Bento?', by='Harry, 19 Oct', done='Redo all the looks so they share one layout: &ldquo;They can&rsquo;t just click Clean light and suddenly I&rsquo;m on a different admin page with a different layout.&rdquo; Built in B4.'),
            dict(q='A-3: the chat bubble sometimes covers buttons. Fix it bottom left, or keep it moving?', by='Harry, 19 Oct', done='Fixed bottom left, &ldquo;as long as, if it is covering something, I can still press it&rdquo;. Built in B4.'),
            dict(q='A-4: where should the back arrow go?', by='Harry, 19 Oct', done='&ldquo;Always top left &hellip; always the same&rdquo;, on every admin and test page. Built in B4. The 3D garden, house, shop and 3D training keep their own back button.'),
            dict(q='A-5: Training levels take two taps. Keep it?', by='Harry, 19 Oct', done='Keep. New ask: edit the training drills like the scenario gallery. Built in B7.'),
            dict(q='A-8: the last 6 admin pages, now or with the scene editor?', by='Harry, 19 Oct', done='With the scene editor work. Built in B6.'),
            dict(q='A-9: three group boxes in a row on a phone, or two?', by='Harry, 19 Oct', done='Three stays. &ldquo;Looks a lot better with the key button staying on screen.&rdquo;')]
    )

# =========================== TEAM ROOM V1 ===========================
def team19():
    p = Page('a19team', [T, H, os.path.join(BASE, 'b11')])
    f = p.fig
    add = section('add', 'ADDED', [
        item('A chat bubble on every admin page', [tag('seen')], [
            ('Problem / Why', 'Your ask (19 Oct): a team room in the admin, with &ldquo;live chat you can open from any admin page as a pop-up box&rdquo;. Chat lives only in the admin room.'),
            ('Fix', 'A round button, bottom left, on every admin and test page. It opens a small box with <b>Chat</b> and <b>To-do</b>. It steps clear of the side menu and of buttons. (The next round, B11, made it smaller and see-through to taps.)')],
            p.figs([f('bubble-phone.jpg', '<b>Look at:</b> the box open on a phone: Chat and To-do tabs, then the messages. Sample messages in a local test room.')])),
        item('Four views of the team room: Board, Ideas, Chat, To-do', [tag('seen')], [
            ('Problem / Why', 'Your ask (19 Oct): an idea board and hand-typed tasks next to the live bars on the team board.'),
            ('Fix', 'One switch on the team board: <b>Board | Ideas | Chat | To-do</b>. The same four sit in the side menu, with red and amber counts. The board and the bubble take the colours of the look you pick.')],
            p.figs([f('broadcast-team-pc.jpg', '<b>Look at:</b> the team board in the Broadcast look: a card each for Harry, Mikey and Leo.', 'wd')], wide=True)),
        item('Ideas: a board with three stages', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'Ideas sit in <b>Idea &rarr; Doing &rarr; Done</b>, shown <b>by stage</b> or <b>by person</b>. Each has three vote dots and notes. You can move an idea between stages.')],
            p.figs([f('ideas-pc.jpg', '<b>Look at:</b> three columns. Each card shows who wrote it, a note count and three vote dots. Sample ideas in a local test room.', 'wd')], wide=True)),
        item('Team chat', [tag('seen')], [
            ('Problem / Why', 'The full chat page is the bigger version of the bubble. Same ask.'),
            ('Fix', 'A live chat page: who is here now, pinned messages, pictures. It asks once which of Harry, Mikey or Leo you are.')],
            p.figs([f('chat-pc.jpg', '<b>Look at:</b> Here now (left), the messages, and Pinned (right). The little faces under a message and the Reply, @ and page cards came in round two (see the B11 page).', 'wd')], wide=True)),
        item('To-do: your own jobs and jobs for each other', [tag('seen')], [
            ('Problem / Why', 'Your ask: hand-typed tasks next to the live bars.'),
            ('Fix', 'A list for <b>jobs given to you</b>, <b>your own</b> jobs and <b>jobs you gave</b>. A ticked job fades after a day, then leaves.')],
            p.figs([f('todo-pc.jpg', '<b>Look at:</b> Given to me, Mine, Jobs I gave, and Done today (ticked, faded).', 'wd')], wide=True)),
        item('Notes on pushes', [tag('reas', 'no still')], [
            ('Problem / Why', NR),
            ('Fix', 'The push sheet (a push to the repo, on the team board) has notes. Anyone can add one.')]),
        item('The room is a portable kit', [tag('reas', 'no still')], [
            ('Problem / Why', 'You said (19 Oct): &ldquo;build the full team room/board as a portable kit for later&rdquo;.'),
            ('Fix', 'One folder, one settings file for the people, colours and repo, and its own database file. The old team board moved into the kit too.')]),
        item('KIB Admin as a home-screen app, and recordings in a folder per person', [tag('reas', 'live, not shown here')], [
            ('Problem / Why', NR),
            ('Fix', 'The admin installs on a phone&rsquo;s home screen as <b>KIB Admin</b> (icon C). The screen recorder saves each person&rsquo;s recordings in their own folder. Both are live on main since 19 Oct.')]),
    ], note='Stills here were taken for this page from a local test room with sample rows, as the room looks today (including round two). The stills of the first build were not kept.')
    chg = section('chg', 'CHANGED', [
        item('The admin side menu folds on a computer', [tag('reas', 'no still')], [
            ('Problem', 'You said: &ldquo;We need to be able to close the side tab.&rdquo; You also did not like the thick dark scrollbar.'),
            ('Why', NR),
            ('Fix', 'The &laquo; button at the top of the menu folds it to a 64 px strip of icons. &raquo; opens it. Your choice is remembered per browser. The thick scrollbar is gone.')]),
    ])
    numbers = '<p><b>Counts.</b> Four views (Board, Ideas, Chat, To-do). Idea stages: 3. Vote dots per idea: 3. A ticked job leaves after 24 hours. The room loads the last 300 messages and the database keeps 5,000.</p>'
    return p, dict(
        key='a19team', ver='0.60h', title='Team Room v1', pill='19 OCT · TEAM ROOM',
        headline='The team has a room in the admin: a chat bubble on every page, an Ideas board, Team chat and a To-do list.',
        sub='19 Oct 2026. The second round (seen faces, replies, @, pointing) is on the B11 page.',
        status='On main since 19 Oct. The database file (team_room.sql) was run by Mikey on 19 Oct, as the 19 Oct notes say.',
        footer=FOOT19,
        checks=[
            ('The chat bubble', 'On any admin page, bottom left. It opens Chat and To-do.'),
            ('The four views', 'Admin menu &rarr; Team board. Switch Board, Ideas, Chat, To-do. The same four are in the side menu with counts.'),
            ('Ideas', 'Add an idea. Move it between Idea, Doing, Done. Flip By stage and By person.'),
            ('To-do', 'Add a job for yourself and one for someone else. Tick one. It fades.'),
            ('Who are you', 'The first time, it asks which of Harry, Mikey or Leo you are.')],
        sections=[add, chg], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned.</b><p>Stills show each view. Say if you want one.</p>',
        seen=dict(
            seen=['The Ideas, Chat and To-do views on a computer and the bubble on a phone (taken for this page, sample rows)', 'The team board in Broadcast (the 19 Oct admin notes)'],
            meas=[],
            reas=['The first build&rsquo;s own checks: type check and a test file (tests/star/teamRoom.mts); no live look was kept', 'Notes on pushes, the portable kit, the folding side menu, KIB Admin and the recorder folders (no still)'],
            no=['Two people using it at once on real phones', 'The real database: the 19 Oct notes say Mikey switched it on; it was not seen here']),
        ok=[
            dict(q='Build the whole team room as a portable kit?', by='Harry, 19 Oct', done='Yes: &ldquo;build the full team room/board as a portable kit for later&rdquo;.'),
            dict(q='Where does chat live?', by='Harry, 19 Oct', done='Only in the admin room, reachable from every admin page as a pop-up box.'),
            dict(q='Team room before the big CLAUDE.md trim?', by='Harry, 19 Oct', done='Yes, the team room comes first.')]
    )

# =========================== DRIFT + PLAY SCREENS ===========================
def drift19():
    p = Page('a19drift', [G])
    f = p.fig
    rows = [('Full match, your chance', 340, 366), ('Training drills', 346, 366), ('Trial: Take him on', 362, 366),
            ('Real moments', 318, 366), ('Goal videos', 332, 366), ('Visual effects lab', 340, 366),
            ('Real shots', 344, 366), ('Real goals', 360, 366), ('Dribble on a stick', 362, 366)]
    phone_bars = bars(*[bar(n, a, b, 400, str(a), str(b)) for n, a, b in rows],
                      note='Pitch width in px on a 390 px phone. Grey is before. Colour is after. The real match is 366 px wide.')
    pc_rows = [('Training drills', 364, 384), ('Trial: Take him on', 380, 384), ('Real moments', 340, 384)]
    pc_bars = bars(*[bar(n, a, b, 420, str(a), str(b)) for n, a, b in pc_rows],
                   note='Pitch width in px on a computer. The real match is 384 px. The other screens were already 384.')
    fixed = section('fix', 'FIXED', [
        item('Every football screen now draws the pitch at the real match&rsquo;s size', [tag('meas')], [
            ('Problem', 'You said: &ldquo;The game has definitely drifted when I press Play.&rdquo; <b>8 screens drew the pitch narrower than the real match</b> (366 px on a phone, 384 px on a computer).'),
            ('Why', 'Each page&rsquo;s padding squeezed the play box. <b>The kick strength was never off:</b> every screen already read your drag against the real match. The pitch and the players were just drawn smaller.'),
            ('Fix', 'The shared play box now steps into the page&rsquo;s side margins by exactly the missing amount, without sideways scrolling. Also: the training card lost its 10 px padding, the Real goals card no longer clips the match&rsquo;s edges, and the trial&rsquo;s pitch frame border is a ring now (it ate 4 px).')],
            phone_bars + details('The computer sizes (3 screens changed)', pc_bars)),
        item('Play buttons stay on screen', [tag('seen')], [
            ('Problem', 'On Infinite Highlights and Full match, NEXT and the chance name sat below the fold.'),
            ('Why', 'The page was taller than a phone screen.'),
            ('Fix', 'They are pinned on screen at 390&times;844 and at 1440&times;900. This is now a house rule: <b>play controls never sit below the fold</b>.')],
            p.figs([f('fit-hl.jpg', '<b>Look at:</b> Infinite Highlights on a phone. NEXT and the chance name are on screen.'),
                    f('fit-fm.jpg', '<b>Look at:</b> Full match, your chance.'),
                    f('fit-trial.jpg', '<b>Look at:</b> the Trial.')])),
    ])
    add = section('add', 'ADDED', [
        item('The engine warning is red and asks every time', [tag('reas', 'a drawing, not a screen shot')], [
            ('Problem', 'You said: &ldquo;a lot of times I&rsquo;m just clicking Allow, allow, allow, and that&rsquo;s how these things happen.&rdquo;'),
            ('Why', 'The old notice only covered the match engine file, and it was easy to click past. The play screens drifted through other files, not the engine.'),
            ('Fix', 'When a Claude session is about to edit the match engine, or any file that decides what a play screen hands the engine, the Allow box now shows a <b>red notice</b> and asks every time. It never blocks: you can press No.' +
                    '<div class="mock"><b>&#128997;&#128997; THIS IS A MATCH ENGINE CHANGE &#128997;&#128997;</b><p>It changes the physics every match runs on.</p><p>Only press Allow if someone asked for this in words. Otherwise press No.</p><div class="mb"><span class="go">Allow</span><span>No</span></div></div>'
                    '<p class="bnote">A drawing of the Allow box. The words are the real ones. The other notice reads &ldquo;SOMETHING MAY DRIFT FROM THE REAL MATCH&rdquo;.</p>')],
            details('Which files ask', '<ul><li><b>The engine itself:</b> canvasEngine.</li><li><b>Drift files:</b> CanvasMatch, EnginePlay, ScenarioPlay, InfiniteMatch, hiddenMatch, engineProfile, playArea, scenePicture, matchView.</li><li>On 20 Oct a Python script that edited the engine slipped past once. The check now also catches quoted file paths in scripts.</li></ul>')),
        item('A drift audit of every football screen', [tag('meas')], [
            ('Problem', 'You said: &ldquo;work to fix any drifts across the game&rdquo;. A drift is anything the engine is given that differs from the real career match.'),
            ('Why', NR),
            ('Fix', 'Every screen was measured at 390 and 1440 px, with scripts that read the real match&rsquo;s settings off each canvas. The result: <b>no drift in keeper strength, squads, weather, fatigue or camera framing</b>, beyond a few named test dials. The full table is in the repo (docs/handoffs/2026-10-19-ui-lookover/drift-audit.md).')],
            details('Left as designed, not drift', '<ul><li>Highlights and Gallery Play are 493 px wide on a computer on purpose. The drag is set so a kick is the same.</li><li>Goal videos force the keeper to 25 and clear weather so goals get scored and recorded.</li><li>Real goals force the keeper to 80 and give the real goal&rsquo;s own framing.</li></ul>')),
        item('A touch check of every screen', [tag('reas', 'read from the code, not played')], [
            ('Problem', 'You asked that anything using a mouse on a computer work instantly with a finger.'),
            ('Why', NR),
            ('Fix', '27 things found: <b>0 stop a finger in the real game</b>. 2 stop a finger on the website. The fixes are built in <b>B1</b> (see its page).')],
            bars(bar('Real game: small or wrong', None, 10, 12, '', '10 found', 'blue'),
                 bar('Test pages: small', None, 9, 12, '', '9 found', 'blue'),
                 bar('Website: 2 stop a finger, 3 small', None, 5, 12, '', '5 found', 'warn'),
                 bar('Admin: small', None, 3, 12, '', '3 found', 'blue'),
                 note='The one wrong one in the game: the &minus; and + offer buttons in contract talks. One tap could move the offer twice.')),
    ])
    nxt = section('nxt', 'NEXT', [
        item('Not driven end to end in the audit', [tag('no')], [
            ('Problem', 'The other Full match layout (&ldquo;TV broadcast&rdquo;), the 3D and radar views of the 90-minute test, the gallery&rsquo;s 5-a-side and Tuning tabs, and the &ldquo;Ours vs real&rdquo; tab.'),
            ('Why', 'They mount the same play box or no match, so no new drift was expected.'),
            ('Status', 'Not measured. Also not measured: a real iPhone (sizes are layout numbers, not feel).')]),
    ])
    return p, dict(
        key='a19drift', ver='0.62h', title='Drift + Play Screens', pill='19 OCT · PLAY SCREENS',
        headline='Every football screen draws the pitch at the real match&rsquo;s size, play buttons stay on screen, and the engine warning is red.',
        sub='19 Oct 2026.',
        status=MAIN + ' The match engine file was not changed (two comments only).',
        footer=FOOT19,
        checks=[
            ('Full match on a phone', 'Your chance: the pitch is 366 px wide (it was 340).'),
            ('Training drills on a phone', 'The pitch is 366 px wide (it was 346).'),
            ('Infinite Highlights on a phone', 'NEXT and the chance name stay on screen without scrolling.'),
            ('Real moments, Goal videos, Visual effects lab, Real shots', 'Each pitch is 366 px on a phone. None scrolls sideways.'),
            ('The red warning', 'When Claude is about to edit a drift file, the Allow box shows the red notice.')],
        sections=[fixed, add, nxt],
        videos_coming=False,
        videos='<b>No clip is planned.</b><p>This is sizes and a warning. Stills and numbers show it.</p>',
        seen=dict(
            seen=['Pitch widths on 15 screens at 390 and 1440 px (layout measurements in Chromium)', 'The buttons staying on screen on three screens'],
            meas=['Widths before and after for 8 screens (see the bars)', 'tsc clean; the one-engine guard clean; the finishing, aiming, outcomes and oneEngine tests pass'],
            reas=['The touch check: read from the code, not played', 'The red warning is shown as a drawing: it appears in the Allow box inside a Claude session'],
            no=['A real iPhone (this machine has no graphics chip)', 'How a kick feels after the size fix']),
        ok=[
            dict(q='Make the engine and drift warning impossible to miss?', by='Harry, 19 Oct', done='Yes, answer 9. Done on 19 Oct.'),
            dict(q='When the touch check comes back, fix everything it finds without asking item by item?', by='Harry, 19 Oct', done='Yes: fix all, and show stills. Built in B1.'),
            dict(q='B2 (highlights phase 3) and B10 (headers and volleys) will edit match files. Engine OK?', by='Harry, 20 Oct',
                 done='Yes. Run one at a time; B14 after. They have no report yet. The red warning still asks on every edit. Press Allow only when the build needs it.')]
    )

# =========================== HIGHLIGHTS REBUILD 0-2 ===========================
def fhr19():
    p = Page('a19fhr', [G])
    f = p.fig
    add = section('add', 'ADDED', [
        item('Phase 0: the switch and today&rsquo;s numbers (the ruler)', [tag('seen')], [
            ('Problem / Why', 'The notes give no problem. The ruler&rsquo;s job: it records today&rsquo;s numbers (chances, goals, reactions), so every later phase must keep them, or say why they changed.'),
            ('Fix', 'A new Settings row: <b>Full highlights rebuild: Off | On (test)</b>. <b>Off is today&rsquo;s game exactly.</b> On also turns on &ldquo;Chances: New&rdquo;. The ruler is the test page /star-fhr-dev.')],
            p.figs([f('fhr-page.jpg', '<b>Look at:</b> the test page: the switch and the ruler, which lists today&rsquo;s numbers.', 'wd')], wide=True)),
        item('Phase 2: a new build-up before every open-play chance', [tag('meas'), tag('seen')], [
            ('Problem / Why', 'The notes give no problem. You asked (answer 13) that Infinite Highlights and Infinite Match play build-ups, &ldquo;automatic and natural, with some adjusting&rdquo;.'),
            ('Fix', 'With the switch On, each open-play chance starts with a <b>4 to 8 second build-up</b>. It is different every time and ends exactly on the drawn chance. The moves come from real attacking patterns in the free match data. Better passers play the long balls. Better dribblers make the runs.')],
            bars(bar('Build-ups that took a different route (of 2,527)', None, 2197, 2527, '', '2,197', 'blue'),
                 bar('Build-ups that failed the checks (of 448 checked)', None, 0, 448, '', '0 of 448'),
                 note='Chances and goals per match did not change over 500 matches (5.81 and 2.31).') +
            p.figs([f('fhr-sheet.jpg', '<b>Look at:</b> 8 of the 48 build-ups checked by eye. Each row: the start, the middle, and the moment your chance begins.', 'wd')], wide=True) +
            details('More pictures (3): a build-up playing in the real match', p.figs([
                f('fhr-a.jpg', '<b>The start</b> of a build-up, live in the real match.', 'wd'),
                f('fhr-b.jpg', '<b>The middle.</b>', 'wd'),
                f('fhr-c.jpg', '<b>Your chance</b> begins.', 'wd')], wide=True))),
    ])
    chg = section('chg', 'CHANGED', [
        item('Phase 1: the picture before Play uses the match camera', [tag('meas'), tag('seen')], [
            ('Problem', 'The still before Play used a different camera from the real match, so pressing Play jumped.'),
            ('Why', 'The still was framed by its own camera, not the match&rsquo;s.'),
            ('Fix', 'With the switch On, the still is drawn with the match camera at exactly the match box&rsquo;s size. <b>0 mismatches in 100.</b>')],
            p.figs([f('fhr-still.jpg', '<b>Look at:</b> the still, before Play (switch On).'),
                    f('fhr-play.jpg', '<b>Look at:</b> after Play: the same frame.')])),
    ])
    path = steps([
        ('done', '<b>Phase 0:</b> the switch and the ruler.'),
        ('done', '<b>Phase 1:</b> the still uses the match camera.'),
        ('done', '<b>Phase 2:</b> generated build-ups before open-play chances.'),
        ('next', '<b>Phase 3:</b> players already moving when your chance starts. Harry said <b>go</b>. It changes the match engine behind the switch. It is build B2.'),
        ('', '<b>Phases 4 to 7:</b> the full 22-player match model. Harry: decide later, after phase 3.')])
    nxt = section('nxt', 'NEXT', [item('Where the rebuild is', [], [('Status', 'Three phases are done. The red engine warning will ask when phase 3 starts.')], path)])
    numbers = (
        '<p><b>Over 500 matches</b> with the switch On, chances and goals per match are the same as with it Off: 5.81 chances and 2.31 goals.</p>'
        '<p><b>Build-ups.</b> 2,527 made. 2,197 took different routes. Median length 6.4 s. Top speed 8.7 m/s. 0 of 448 failed the checks. 48 were checked by eye.</p>'
        '<p><b>The still.</b> 0 mismatches in 100.</p>')
    return p, dict(
        key='a19fhr', ver='0.63h', title='Highlights Rebuild 0-2', pill='19 OCT · HIGHLIGHTS',
        headline='A new switch rebuilds highlights. Three phases are done: the switch, the match-camera still, and generated build-ups.',
        sub='19 Oct 2026. Behind a switch that is Off by default.',
        status=MAIN + ' The match engine was not changed in these phases.',
        footer=FOOT19,
        checks=[
            ('The switch', 'Settings &rarr; Harry changes: &ldquo;Full highlights rebuild: Off | On (test)&rdquo;. It is Off by default.'),
            ('The ruler', 'Open /star-fhr-dev. It lists today&rsquo;s numbers.'),
            ('Infinite Highlights, switch On', 'The still looks like the match. Press Play: the frame does not jump.'),
            ('Generate another', 'On /star-fhr-dev press &ldquo;Generate another&rdquo; a few times. Each build-up should look like real football.')],
        sections=[add, chg, nxt], numbers=numbers,
        videos_coming=True,
        videos='<b>Videos coming.</b><p>Clips are filmed after the push and added to this page.</p><ul><li>A build-up playing into a chance in the real match.</li></ul>',
        seen=dict(
            seen=['The switch and the ruler on /star-fhr-dev', 'The still and the frame after Play', '8 build-ups from the sheet; a build-up live in the real match'],
            meas=['0 mismatches in 100 (the still)', '500 matches: chances and goals unchanged (5.81 and 2.31)', '2,197 of 2,527 build-ups took different routes; median 6.4 s; 0 of 448 failed the checks'],
            reas=[],
            no=['A generated build-up inside a real career match (test page only)', 'Extra defenders running in during a build-up (not built yet)']),
        ok=[
            dict(q='Engine OK for phase 3 (B2)?', by='Harry, 20 Oct', done='Yes. The edit is behind the switch. Run B2 and B10 one at a time. The red warning still asks on every edit.'),
            dict(q='FHR-1: go on phase 3?', by='Harry, 19 Oct', done='Go. Players already moving; an engine change behind the switch; the red guard will ask.'),
            dict(q='FHR-2: carry on into the 22-player model?', by='Harry, 19 Oct', done='Decide later. Ask again after phase 3.'),
            dict(q='FHR-3: extra defenders running in?', by='Harry, 19 Oct', done='Yes, if it makes sense for one to come in from off screen.'),
            dict(q='FHR-4: every open-play chance gets a build-up?', by='Harry, 19 Oct', done='Yes. Some set pieces and penalties can show the foul that won them.'),
            dict(q='P-2 and the switch: who sees it, and where?', by='Harry, 19 Oct', done='No own admin page and no ruler card. Just a toggle, in Settings and in the settings before a match, with a small &ldquo;?&rdquo; that explains it. Show it to everyone for now.'),
            dict(q='Build-ups in the test areas, and the gallery?', by='Harry, 19 Oct', done='Infinite Highlights and Infinite Match must play build-ups. Generated build-ups must <b>never</b> write over Mikey&rsquo;s hand-checked scenarios: generated is a separate layer. In a final, a longer build-up in the 90th minute; a 90th-minute winner goes to a celebration and the trophy lift.')]
    )

# =========================== FREE DATA V1 ===========================
def data19():
    p = Page('a19data', [G, C])
    f = p.fig
    sources = bars(
        bar('Wyscout public set (CC BY 4.0): every event', None, 1941, 1941, '', '1,941', 'blue'),
        bar('Afriskaut (Apache 2.0): events', None, 136, 1941, '', '136', 'blue'),
        bar('SkillCorner (MIT): positions, phases of play', None, 20, 1941, '', '20', 'blue'),
        bar('IDSSE / DFL (CC BY 4.0): positions 25 times a second', None, 7, 1941, '', '7', 'blue'),
        note='2,104 matches in all, every source free to use in a paid game. Afriskaut was removed on 20 Oct (see the B3 page).')
    add = section('add', 'ADDED', [
        item('2,104 real matches, all free to use in a paid game', [tag('meas')], [
            ('Problem', 'The real-football pages used licensed data, and its licence does not allow a paid game.'),
            ('Why', 'A paid game needs data whose licence allows it.'),
            ('Fix', 'Four free-licence sources were reduced to pattern files the game can read. Each needs a credit line shown in the game (done on 20 Oct, in Settings, see B3).')],
            sources),
        item('Real moments, rebuilt on free data', [tag('seen'), tag('meas')], [
            ('Problem', 'The page used licensed data.'),
            ('Why', 'Same licence problem.'),
            ('Fix', '<b>702 fully real moments</b> (581 shots and 121 corners), with all 22 players where they really stood. One Play button instead of one on every row (you kept it: A-6).')],
            p.figs([f('rm-play.jpg', '<b>Look at:</b> a real moment playing: the real strike with every player in their real place.'),
                    f('real-moments-after-phone-360.jpg', '<b>Look at:</b> the page on a phone: a moments list, a search box, one big Play.')])),
        item('Real shots, rebuilt on free data', [tag('seen'), tag('meas')], [
            ('Problem', 'The page used licensed data.'),
            ('Why', 'Same licence problem.'),
            ('Fix', '<b>2,875 real shots</b> (2018 World Cup and Euro 2016). The strike and the result are real. The defenders are placed by our own rules. Each picture says which kind it is.')],
            p.figs([f('rs-map.jpg', '<b>Look at:</b> the shot map. You called it &ldquo;pretty cool&rdquo;.', 'wd')], wide=True)),
        item('Real Goals, rebuilt on free data', [tag('seen'), tag('meas')], [
            ('Problem', 'The page used licensed data.'),
            ('Why', 'Same licence problem.'),
            ('Fix', '<b>232 levels.</b> Every file of the licensed data is deleted from the repo.')],
            p.figs([f('rg-levels.jpg', '<b>Look at:</b> the level map.'),
                    f('real-goals-after-phone-360.jpg', '<b>Look at:</b> the page on a phone.')])),
    ])
    nxt = section('nxt', 'NEXT', [
        item('What the next build did with this', [], [
            ('Status', 'On 20 Oct, B3 removed Afriskaut (&ldquo;no one&rsquo;s heard of them&rdquo;), added two sources (SoccerTrack v2 and SkillCorner), put the data credits in Settings and added a &ldquo;Real moment highlights&rdquo; switch. Matches went 2,104 &rarr; 1,983. See the B3 page.')])])
    numbers = (
        '<p><b>Matches by source.</b> Wyscout 1,941. Afriskaut 136. SkillCorner 20. IDSSE / DFL 7. Total 2,104.</p>'
        '<p><b>Real moments.</b> 702 (581 shots, 121 corners). <b>Real shots.</b> 2,875. <b>Real Goals.</b> 232 levels.</p>')
    return p, dict(
        key='a19data', ver='0.64', title='Free Data v1', pill='19 OCT · FREE DATA',
        headline='2,104 real matches, all free to use in a paid game. Real moments, Real shots and Real Goals now run on them. The licensed data is deleted.',
        sub='19 Oct 2026. The 20 Oct follow-up is on the B3 page.',
        status=MAIN,
        footer=FOOT19,
        checks=[
            ('Real moments', 'Tap a moment, then Play. One Play button is enough.'),
            ('Real shots', 'The shot map shows 2,875 shots. Each picture says whether it is a real strike with our own defenders.'),
            ('Real Goals', 'The level map shows 232 levels.'),
            ('Licensed data', 'No file of the licensed data is left in the repo.')],
        sections=[add, nxt], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned.</b><p>Stills show the pages. Say if you want one.</p>',
        seen=dict(
            seen=['Real moments, Real shots and Real Goals on the new data (stills from the build)'],
            meas=['2,104 matches by source; 702 real moments; 2,875 real shots; 232 Real Goals levels'],
            reas=[],
            no=['A real moment inside a career match (it was a test page then; B3 added a switch)']),
        ok=[
            dict(q='More than 2,104 matches, and remove Afriskaut?', by='Harry, 19 Oct', done='Yes: more tracking data (every player&rsquo;s position), and remove Afriskaut (&ldquo;no one&rsquo;s heard of them&rdquo;). Built in B3.'),
            dict(q='DATA-1: where do the credit lines go?', by='Harry, 19 Oct', done='Settings is fine. Built in B3 (Settings &rarr; More &rarr; Data credits).'),
            dict(q='DATA-2: should real moments feed the real game?', by='Harry, 19 Oct', done='Try it, inside the highlights switch as another toggle, &ldquo;Real moment highlights&rdquo;. Think through how it is tracked and edited later. Built in B3.'),
            dict(q='A-6: one Play button on Real moments?', by='Harry, 19 Oct', done='Keep. Real shots shot map: &ldquo;pretty cool&rdquo;.')]
    )

# =========================== SCENE EDITOR 3A ===========================
def scene19():
    p = Page('a19scene', [G])
    f = p.fig
    flow = steps([
        ('', '<b>The event.</b> 18 kinds (signed, scored, won a trophy, injured, dropped, sacked, record broken, debut, walk-out, press conference, award, promoted, relegated, retired&hellip;), plus a feeling (12, such as joy or shock) and how big the moment is.'),
        ('', '<b>The story.</b> It picks a place, a mood and who is in it. Then it acts: setup, build, moment, reaction, aftermath, from 25 &ldquo;beats&rdquo; (sit and talk, sign the contract, strike, celebrate, lift the trophy, bad news, go down injured&hellip;).'),
        ('', '<b>The bodies.</b> Each beat adds moves for each person: clips from the animation library, plus poses worked out by code (reach for the pen, hold the trophy).'),
        ('', '<b>The camera.</b> Film rules pick the shots: open on the place, go closer as feelings rise, never cross the line, show the reaction after the moment, film a hero from low and a defeat from high. Then it scores itself.'),
        ('', '<b>The director.</b> It plays the script in 3D, in any art style, frame by frame.')])
    scores = bars(
        bar('Scored, joy (10.1 s, 7 shots)', None, 100, 100, '', '100%'),
        bar('Sacked, sadness (9.8 s, 5 shots)', None, 100, 100, '', '100%'),
        bar('Won a trophy, pride (7.5 s, 3 shots)', None, 100, 100, '', '100%'),
        bar('Injured, shock (6.5 s, 3 shots)', None, 91, 100, '', '91%', 'warn'),
        note='How well each made-up scene follows the film rules. Injured does not open on the place.')
    add = section('add', 'ADDED', [
        item('The 3D Signing and the Manager&rsquo;s Office play live in the scene editor', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'Steps 1 and 2 were already live: a free camera, a mini-map, the key light&rsquo;s angle and colour, and Save. <b>Step 3a:</b> the 3D Signing and the Manager&rsquo;s Office now play live in the editor. You pick a shot and set its camera position and lens, the key light and the exposure. Play, Save and the shots fit on screen.')],
            p.figs([f('se-signing.jpg', '<b>Look at:</b> Signing, with one shot edited.'),
                    f('se-office.jpg', '<b>Look at:</b> the Manager&rsquo;s Office, with one shot edited.')])),
    ])
    chg = section('chg', 'CHANGED', [
        item('Where the edits go', [tag('seen')], [
            ('Problem', '<b>The edits did not reach the game.</b> Save kept them on that device and in the team&rsquo;s database (Mikey ran the database file on 19 Oct). They did <b>not</b> go into the repo, and the game&rsquo;s real cut scenes did not read them.'),
            ('Why', 'The notes say only that the game&rsquo;s real cut scenes did not read the edits yet.'),
            ('Fix', 'You answered: an <b>Approve</b> button, and edits that commit straight into the game (3D-3, 3D-4). Built in <b>B6</b> the next night (see its page): Approve, Where and When, and Commit to game.')]),
    ])
    explain = section('nxt', 'EXPLAINER · HOW GENERATED CUT SCENES WORK', [
        item('Two kinds of cut scene', [tag('seen')], [
            ('Problem / Why', 'You asked how the &ldquo;made-up scenes&rdquo; work. This is the answer.'),
            ('Fix', '<b>Hand-made (6):</b> signing, goal, trophy, walk-out, press and The Icon. Every move and shot is written by hand. They are the benchmark. <b>Generated:</b> made by the game from a <b>game event</b>, with nothing pre-built. The same event and the same number (the &ldquo;seed&rdquo;) always give the same scene. A new seed gives a new scene. <b>The real game does not play generated scenes yet.</b> You have seen them only on the Cut-scene Director test page, the scene editor and the 3D audit.' +
                    flow)],
            scores +
            p.figs([f('gen-scored.jpg', '<b>Scored:</b> the keeper&rsquo;s view, the celebration, then a close-up far too tight for a phone.'),
                    f('gen-sacked.jpg', '<b>Sacked:</b> the office, &ldquo;You&rsquo;re not in the side on Saturday&rdquo;, alone with it.')]) +
            details('More pictures (2) and why bodies break', p.figs([f('gen-trophy.jpg', '<b>Won a trophy.</b>'), f('gen-injured.jpg', '<b>Injured:</b> he is smiling, because faces never move yet.')]) +
                    '<p><b>Why bodies break</b> (reasoned from the code and the audit stills, not measured):</p><ul><li>A beat joins clips from different sources end to end, and code-made poses bend joints on top. When the two disagree, a shoulder twists or a boot floats.</li><li>Walks move the body at a set speed that does not match the steps, so the feet slide.</li><li>The people in them are a stand-in layer. A proper people layer (faces, hands, planted feet) plugs in at one place when it is ready. That is 3D phases 4 and 6.</li></ul>')),
        item('3D audit and the 10-phase plan', [tag('seen')], [
            ('Problem', 'From 52 stills at phone size. Worst first: skin turns yellow in cut scenes. 14 of 23 shots are framed for a wide screen and are too tight on a phone. Faces never move. The home player stands stiffly. Props are held badly. The rooms are placeholders.'),
            ('Why', 'The models are mostly fine. The <b>light, the cameras and the poses</b> make it look cheap.'),
            ('Fix', 'A 10-phase plan: bench page, fix skin and light, phone cameras, moving faces, home player, hands and props, one stadium and real rooms, training rebuilt, one flow through the career, sharper 2D moves. You liked the plan: &ldquo;Fixing skin and light is very big.&rdquo; Phases 1 to 5 were built overnight in B5 (see its page). The full page is the &ldquo;3D audit and plan&rdquo; artifact: <a href="https://claude.ai/artifact/Gx6YJ9jdDbs7j9cfEfjS5S" target="_blank" rel="noopener">open it</a>.')],
            p.figs([f('a3-skin.jpg', '<b>Look at:</b> the trophy lift: yellow skin, the camera inside his arms.'),
                    f('a3-home.jpg', '<b>Look at:</b> the home player: a stiff pose and no shadow.')])),
    ])
    numbers = '<p><b>Made-up scenes (film-rules score).</b> Scored 100%, Sacked 100%, Won trophy 100%, Injured 91%. Length 6.5 to 10.1 s. 3 to 7 shots each.</p><p><b>3D audit.</b> 52 stills. 14 of 23 shots too tight on a phone.</p>'
    return p, dict(
        key='a19scene', ver='0.61h', title='Scene Editor 3a', pill='19 OCT · SCENE EDITOR',
        headline='The 3D Signing and Manager&rsquo;s Office edit live in the scene editor. This page also explains how generated cut scenes work.',
        sub='19 Oct 2026. The next night (B6) connected the editor to the game.',
        status=MAIN,
        footer=FOOT19,
        checks=[
            ('Scene editor: Signing', 'Open the 3D Scene editor and pick 3D Signing. Pick a shot. Move the camera, the lens, the light and the exposure.'),
            ('Scene editor: Manager&rsquo;s Office', 'Same, in the office.'),
            ('Play, Save and the shots fit on screen', 'On a phone, the shot buttons and Save stay on screen.')],
        sections=[add, chg, explain], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned.</b><p>The editor and the generated scenes are judged by stills.</p>',
        seen=dict(
            seen=['The editor on Signing and the office, with one shot edited each', 'Four generated scenes (scored, sacked, trophy, injured) on the test pages', '52 stills in the 3D audit'],
            meas=['Film-rules scores of four generated scenes: 100, 100, 100, 91', 'The audit: 14 of 23 shots too tight on a phone'],
            reas=['Why bodies break (from the code and the audit stills)'],
            no=['Any edit in the real game: the game did not read the editor&rsquo;s edits until B6']),
        ok=[
            dict(q='3D plan: go on phases 1 to 5?', by='Harry, 19 Oct', done='Liked. &ldquo;Fixing skin and light is very big.&rdquo; Go on phases 1 to 5 (built in B5). Home player: natural, energetic poses; eyes blink and look around; lips move when talking; holds things properly.'),
            dict(q='Blender on the cloud machine?', by='Harry, 19 Oct', done='Install it whenever it is needed.'),
            dict(q='3D-3, 3D-4, 3D-5: where do edits save, and what next?', by='Harry, 19 Oct', done='&ldquo;I would love it to commit straight into the game&rdquo; (the database now is fine if it can then be pushed into the repo). An Approve button: approved edits are used in the game and stay editable; you choose when and where. Step 3b (shop, garden, house) first. Built in B6.'),
            dict(q='3D-6: Higgsfield?', by='Harry, 19 Oct', done='On for now. Always say what is being made there, and delete the images and videos after use.'),
            dict(q='GEN-1 and GEN-3: the Scene generator?', by='Harry, 19 Oct', done='Build it as its own admin page in the Studio tab (built in B6). Generated scenes can go in the game if they are good, for the moments that suit them. &ldquo;I just don&rsquo;t know when they play and why, but we need to fix that&rdquo; (B6 added the table).')]
    )
