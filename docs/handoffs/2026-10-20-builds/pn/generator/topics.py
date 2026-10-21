# The three topic pages (20 Oct 2026): Team Board & Team Updates (v0.82), Admin Pages & Skins (v0.83), Everything Else (v0.84).
# Each is a full write-up of its topic across 19-20 Oct. Where an overnight build covered part of a topic, a short section
# carries its key still and numbers and links to that build's own page.
# Stills come from the kept pages under patch-notes/pages/<version>/img (so nothing here needs the old scratch folders).
from lib import *

REPO = os.path.normpath(os.path.join(BASE, '..', '..', '..'))
PG = os.path.join(REPO, 'patch-notes', 'pages')
# Stills cut from a kept still (so a tall page still shows only its top). fhr-switch.jpg = the top 930 px of 0.63's fhr-page.jpg.
TOPIC_STILLS = os.path.join(BASE, 'pn', 'topic-stills')

# Every earlier page, by key (read off the live index, 20 Oct).
URLS = {
    'b1': 'https://claude.ai/artifact/3iCBAwMeNQVssqW5THU8R8', 'b3': 'https://claude.ai/artifact/Pa3a8mKnzEKYbuC8My83cm',
    'b4': 'https://claude.ai/artifact/Uaf9V9vfYrErZNkYqXAYTW', 'b5': 'https://claude.ai/artifact/3VjJkbYFvSE2XrgLtueCz5',
    'b6': 'https://claude.ai/artifact/XTxMVD52AJN4T4F2EXLu5B', 'b7': 'https://claude.ai/artifact/VuKweZcyS76Jap9zW1E6NR',
    'b8': 'https://claude.ai/artifact/ALyk269G1eEncrBGVBgkCW', 'b9': 'https://claude.ai/artifact/J1dND9UWP7nAW8fZDGShp8',
    'b11': 'https://claude.ai/artifact/ThR8RjKdNvUbexGWVXKxZt', 'b12': 'https://claude.ai/artifact/MewEumQW9Wr9dt84kGaPuF',
    'b7b': 'https://claude.ai/artifact/8WTKPhi3pNJ8RBd6FvYsrr', 'b13': 'https://claude.ai/artifact/9SPUygrStL9T6qF9LjcwzW',
    'b15': 'https://claude.ai/artifact/Kti6Jor9jnUAGwbuZ6gnVx', 'b9b': 'https://claude.ai/artifact/Rdj6FwzNKmu78NTgb9rS1w',
    'b16': 'https://claude.ai/artifact/NCvXEnE1cihMHCNnV1o1SD',
    'a19admin': 'https://claude.ai/artifact/K7pD7AMtL1iTF9BT2BRhAA', 'a19team': 'https://claude.ai/artifact/QKNPrRrgPkBr4b1Azgqh8c',
    'a19drift': 'https://claude.ai/artifact/2WnB5jiriAoRw4pSv1gAiT', 'a19fhr': 'https://claude.ai/artifact/GSD3ehL48xjdeJkxVticSz',
    'a19data': 'https://claude.ai/artifact/EBHc5nzaDwyqKYWgjmduLh', 'a19scene': 'https://claude.ai/artifact/XNFSvtGTgM37Dmi28rZHhn',
    'last2': 'https://claude.ai/artifact/Jjqh5F2Qjym1GMBwhA2dSN',
}
OLD19 = {
    'round': 'https://claude.ai/artifact/1gVoLFwG57QCn7xiU8Tudk',      # Everything in this round (the big 19 Oct page)
    'adminhome': 'https://claude.ai/artifact/H9wzT9zXjACDLM1uCtzQwd',  # Admin home and Team board
    'newlook': 'https://claude.ai/artifact/CcMzZbGf3G4fYVervtMV48',    # New-look admin pages (30 pages)
    'audit3d': 'https://claude.ai/artifact/Gx6YJ9jdDbs7j9cfEfjS5S',    # 3D audit and plan
    'fm1': 'https://claude.ai/artifact/Ry521jLp2vKoSLnkJfZrgS', 'fm2': 'https://claude.ai/artifact/QwdSLTFeLTHdE6V7LHXKEM',
    'fm3': 'https://claude.ai/artifact/MUyMrYBtjerjP4dXkJaMGZ',
    'mikey17': 'https://claude.ai/artifact/1A6Wc8XFM2pu2ftCZcymQU',    # Mikey's v0.17 (transfer window, world ageing)
}
VER = {'b1': '0.66', 'b3': '0.67', 'b4': '0.68', 'b5': '0.69', 'b6': '0.70', 'b7': '0.71', 'b8': '0.72', 'b9': '0.73', 'b11': '0.74',
       'b12': '0.76', 'b7b': '0.77', 'b13': '0.78', 'b15': '0.79', 'b9b': '0.80', 'b16': '0.81'}
NAME = {'b1': 'B1 Touch Fixes', 'b3': 'B3 Real Data', 'b4': 'B4 Admin Skins', 'b5': 'B5 3D Looks', 'b6': 'B6 Scene Studio', 'b11': 'B11 Team Room',
        'b13': 'B13 Fixtures + Admin Fixes'}


def lnk(key, text=None):
    u = URLS.get(key) or OLD19[key]
    return '<a href="%s" target="_blank" rel="noopener">%s</a>' % (u, text or ('%s page (v%s)' % (NAME[key], VER[key])))


def build_pill(key):
    return '<span class="pill p-blu">%s &middot; v%s</span>' % (NAME[key].split(' ')[0], VER[key])


def more(key, what):
    """One line under an item that came from an overnight build: where the full write-up is."""
    return '<p class="bnote">Full detail, with every picture: the %s. %s</p>' % (lnk(key), what)


class TPage(Page):
    """A Page whose stills come from the kept pages (patch-notes/pages/<ver>/img)."""
    def __init__(self, key):
        super().__init__(key, dirs=[])
        self._by_name = {}

    def fv(self, ver, name, cap, kind='ph', base=None):
        src = os.path.join(base or os.path.join(PG, ver, 'img'), name)
        if not os.path.exists(src):
            raise FileNotFoundError(src)
        if name in self._by_name and self._by_name[name] != src:
            raise ValueError('two different files called ' + name)
        self._by_name[name] = src
        w, h = Image.open(src).size
        if all(name != u[0] for u in self.used):
            self.used.append((name, src))
        plain = ' '.join(cap.replace('<b>', '').replace('</b>', '').split())
        return ('<figure class="%s"><img src="img/%s" alt="%s" width="%d" height="%d" loading="lazy">'
                '<figcaption>%s</figcaption></figure>') % ('ph' if kind == 'ph' else 'wd', name, esc(plain), w, h, cap)


NOTE_LIVE = '<span class="nr">(Not in the report.)</span>'
FOOT = ('20 Oct 2026. Every fact comes from the earlier patch notes, the builders&rsquo; reports, the git log and Harry&rsquo;s answers file. '
        'Pictures are stills taken while checking the work, copied from the earlier pages. Nothing from 20 Oct is live yet.')


# ========================================================================================================
# 1. TEAM BOARD & TEAM UPDATES  (v0.82)
# ========================================================================================================
def team_page():
    p = TPage('t82')
    f = p.fv

    # ---------- round one (19 Oct) ----------
    r1 = section('add', 'ADDED &middot; ROUND ONE (19 OCT, ON MAIN)', [
        item('A chat bubble on every admin page', [tag('seen')], [
            ('Problem / Why', 'Your ask (19 Oct): a team room in the admin, with &ldquo;live chat you can open from any admin page as a pop-up box&rdquo;. Chat lives only in the admin room.'),
            ('Fix', 'A round button, bottom left, on every admin and test page. It opens a small box with <b>Chat</b> and <b>To-do</b>. It steps clear of the side menu, titles, text and pictures. On a 3D page with no free spot it tucks half behind the right edge, and the box stays on screen. (From the commit titles.) The next round made it smaller and see-through to taps: see Changed.')],
            p.figs([f('0.60h', 'bubble-phone.jpg', '<b>Look at:</b> the box open on a phone: Chat and To-do tabs, then the messages. Sample messages in a local test room.')])),
        item('Four views of the team room: Board, Ideas, Chat, To-do', [tag('seen')], [
            ('Problem / Why', 'Your ask (19 Oct): an idea board and hand-typed tasks next to the live bars on the team board.'),
            ('Fix', 'One switch on the team board: <b>Board | Ideas | Chat | To-do</b>. The same four sit in the side menu, with red and amber counts. The board and the bubble take the colours of the look you pick.')],
            p.figs([f('0.60h', 'broadcast-team-pc.jpg', '<b>Look at:</b> the team board in the Broadcast look: a card each for Harry, Mikey and Leo.', 'wd')], wide=True)),
        item('Ideas: a board with three stages', [tag('seen')], [
            ('Problem / Why', NR),
            ('Fix', 'Ideas sit in <b>Idea &rarr; Doing &rarr; Done</b>, shown <b>by stage</b> or <b>by person</b>. Each has three vote dots and notes. You can move an idea between stages.')],
            p.figs([f('0.60h', 'ideas-pc.jpg', '<b>Look at:</b> three columns. Each card shows who wrote it, a note count and three vote dots. Sample ideas in a local test room.', 'wd')], wide=True)),
        item('Team chat', [tag('seen')], [
            ('Problem / Why', 'The full chat page is the bigger version of the bubble. Same ask.'),
            ('Fix', 'A live chat page: who is here now, pinned messages, pictures. It asks once which of Harry, Mikey or Leo you are.')],
            p.figs([f('0.60h', 'chat-pc.jpg', '<b>Look at:</b> Here now (left), the messages, and Pinned (right). The little faces under a message, Reply, @ and page cards came in round two (below).', 'wd')], wide=True)),
        item('To-do: your own jobs and jobs for each other', [tag('seen')], [
            ('Problem / Why', 'Your ask: hand-typed tasks next to the live bars.'),
            ('Fix', 'A list for <b>jobs given to you</b>, <b>your own</b> jobs and <b>jobs you gave</b>. A ticked job fades after a day, then leaves.')],
            p.figs([f('0.60h', 'todo-pc.jpg', '<b>Look at:</b> Given to me, Mine, Jobs I gave, and Done today (ticked, faded).', 'wd')], wide=True)),
        item('Notes on pushes, and the room as a portable kit', [tag('reas', 'no still')], [
            ('Problem / Why', 'You said (19 Oct): &ldquo;build the full team room/board as a portable kit for later&rdquo;.'),
            ('Fix', 'The push sheet (a push to the repo, on the team board) has notes. Anyone can add one. The whole room is one folder with one settings file for the people, colours and repo, and its own database file. The old team board moved into the kit too.')]),
        item('KIB Admin as a home-screen app, and recordings in a folder per person', [tag('reas', 'live, not shown here')], [
            ('Problem / Why', NR),
            ('Fix', 'The admin installs on a phone&rsquo;s home screen as <b>KIB Admin</b> (icon C). The screen recorder saves each person&rsquo;s recordings in their own folder. Both are live on main since 19 Oct.')]),
    ], note='The stills for round one were taken for the earlier Team Room v1 page, from a local test room with sample rows, as the room looks today. The stills of the first build were not kept.')

    # ---------- round two (B11, 20 Oct) ----------
    pointing = steps([
        ('', '<b>Press Shift+X</b> (or the 👉 Point button in the chat bubble). A bar says &ldquo;Drag a box over the part you mean&rdquo;.'),
        ('', '<b>Drag a box, write a note, pick who it is for</b> (for example @Mikey and @Leo). Press Send.'),
        ('', '<b>They open the link.</b> The page scrolls to your box, outlines it and shows your note.'),
        ('', '<b>The note stays</b> until they press <b>Got it</b>. The chat shows &ldquo;Not yet&rdquo; under each name until then.')])
    r2 = section('add', 'ADDED &middot; ROUND TWO (20 OCT, HARRY BRANCH)', [
        item('Seen faces under each message', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;read receipts in chat&rdquo;.'),
            ('Fix', 'Small H, M and L faces sit under every message. They show who has seen it. Until the database file runs, seen faces stay on the device, and the screen says so in an amber note.')],
            p.figs([f('0.74', '1-chat-receipts-reply-phone.jpg', '<b>Look at:</b> the round faces under each message, and the &ldquo;Waiting on me&rdquo; list at the top.')]) +
            details('More pictures (1): before the database file runs', p.figs([f('0.74', '9-before-migration-phone.jpg', '<b>Look at:</b> the amber note at the top of the chat: &ldquo;Seen faces and Got it are saved on this device only until team_room_v2.sql runs.&rdquo;')]))),
        item('Reply with a quote, and tap to jump back', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;reply to current chats&rdquo;.'),
            ('Fix', 'A message can show Reply and Pin. A reply shows the quote above your words. A tap on the quote jumps to the original message.')],
            p.figs([f('0.74', '3-reply-sent-phone.jpg', '<b>Look at:</b> a sent reply: Mikey&rsquo;s message is quoted, then &ldquo;on it @Mikey&rdquo;, then a page card.')])),
        item('@ names, gold highlight, and a &ldquo;Waiting on me&rdquo; list', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;working @ing&rdquo;. On 19 Oct you also said yes to a &ldquo;Waiting on me&rdquo; inbox.'),
            ('Fix', 'Type @ and a list of names shows. An @ to you shows in gold. A &ldquo;Waiting on me&rdquo; list sits at the top of the chat.')],
            p.figs([f('0.74', '2-at-suggestions-phone.jpg', '<b>Look at:</b> typing &ldquo;thanks @&rdquo; opens a Mention list: Mikey and Leo.')]) +
            details('More pictures (1): on a computer', p.figs([f('0.74', '4-chat-desktop-cards-waiting.jpg', '<b>Look at:</b> the gold @ you messages, and &ldquo;Waiting on me&rdquo; on the left.', 'wd')], wide=True))),
        item('Link a page into the chat with # or the link button', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;linking other pages directly into chat&rdquo;.'),
            ('Fix', 'The link button attaches this page. Typing # shows page suggestions. A page goes into the chat as a card.')],
            p.figs([f('0.74', '2b-hash-page-suggestions-phone.jpg', '<b>Look at:</b> typing &ldquo;look at #gal&rdquo; opens Link a page: Scenario gallery.'),
                    f('0.74', '2c-page-attached-phone.jpg', '<b>Look at:</b> the page is attached above the message box, with a &#10005; to remove it.')])),
        item('Point at the screen (Shift+X)', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;point someone towards something on a page through a shortcut (like say shift + x &hellip;) and they see my note&rdquo;.'),
            ('Fix', 'Four steps:' + pointing)],
            p.figs([f('0.74', '5-shiftx-drawing-desktop.jpg', '<b>Look at:</b> step 1. A bar says &ldquo;Drag a box over the part you mean&rdquo;. The dashed box is on Harry&rsquo;s card.', 'wd'),
                    f('0.74', '5b-shiftx-note-desktop.jpg', '<b>Look at:</b> step 2. Write a note. Pick @Mikey and @Leo. Press Send.', 'wd')], wide=True) +
            p.figs([f('0.74', '6-point-seen-phone.jpg', '<b>Look at:</b> step 3, on a phone. Harry&rsquo;s card is outlined. &ldquo;Mikey pointed here&rdquo; shows the note and a Got it button.')]) +
            details('More pictures (4): the point in the chat, and across devices', p.figs([
                f('0.74', '5d-point-card-in-chat-desktop.jpg', '<b>The point as a card in the chat.</b> &ldquo;Not yet&rdquo; under each name means nobody has pressed Got it.', 'wd'),
                f('0.74', '5c-shiftx-sent-desktop.jpg', '<b>Sent:</b> a green &ldquo;Sent to Mikey and Leo&rdquo;.', 'wd')], wide=True) + p.figs([
                f('0.74', '10b-point-mode-phone.jpg', '<b>Phone point mode:</b> a dashed box over three tiles, a note, and who it is for.'),
                f('0.74', '6c-desktop-point-opened-on-phone.jpg', '<b>A point made on a computer, opened on a phone.</b>')]))),
        item('Patch notes: &ldquo;Read by&rdquo; faces and a &ldquo;Read and understood&rdquo; button', [build_pill('b11'), tag('seen')], [
            ('Problem / Why', 'Your ask (20 Oct): &ldquo;the patch notes system could have like a read receipts and notes so we know when everyone has read and understood patch notes&rdquo;.'),
            ('Fix', 'Each patch-notes version shows who has read it. A <b>Read and understood</b> button marks it. Each version has its own <b>Notes</b> thread. The Team board shows <b>&ldquo;N patch notes to read&rdquo;</b> under each person. The author counts as having read their own notes.')],
            p.figs([f('0.74', '7-patch-notes-read-faces-desktop.jpg', '<b>Look at:</b> v0.59: &ldquo;Read by&rdquo; H read, M wrote it, L not yet. A Notes &middot; 1 thread sits under it. The list on the left shows faces for every version.', 'wd'),
                    f('0.74', '8-team-board-patch-to-read.jpg', '<b>Look at:</b> the Team board: &ldquo;1 patch note to read&rdquo; under Harry, Mikey and Leo. (The six amber &ldquo;GitHub refused the site&rsquo;s key&rdquo; lines in this still are fixed: see Fixed.)', 'wd')], wide=True) +
            more('b11', 'It has 20 stills, a phone and a computer version of each step.')),
    ], note='Round two is the B11 build. You gave the asks in your own words on 20 Oct; the report gives no cause for any of them, so each card shows your ask and the Fix.')

    # ---------- changed ----------
    chg = section('chg', 'CHANGED', [
        item('The chat bubble is smaller and lets taps through', [build_pill('b4'), tag('seen'), tag('meas')], [
            ('Problem', 'The bubble was 50 px wide. You said it was fine bottom left &ldquo;as long as, if it is covering something, I can still press it&rdquo; (19 Oct).'),
            ('Why', NR),
            ('Fix', '40 px, fixed at the bottom left. Only the round button takes taps. It fades to 40% while you scroll and lets taps through. Measured on a phone: nothing sits under it on Admin home, Infinite Highlights, Full match, the gallery and Play Area. On Training levels it covers the left 11 px of &ldquo;Let&rsquo;s go&rdquo;, which still takes the tap. You said that is fine (20 Oct).')],
            bars(bar('Bubble size', 50, 40, 60, '50 px', '40 px')) +
            p.figs([f('0.68', 'bubble-faded-while-scrolling-phone.jpg', '<b>Look at:</b> the bubble, bottom left, faded while the page is scrolled.'),
                    f('0.68', 'bubble-over-letsgo-training-phone.jpg', '<b>Look at:</b> Training levels. The bubble covers the left 11 px of &ldquo;Let&rsquo;s go&rdquo;. The button still takes the tap.')]) +
            more('b4', 'It also covers the admin looks, the back arrow and Research.')),
        item('The bubble sits above a page&rsquo;s own buttons', [build_pill('b13'), tag('seen'), tag('meas')], [
            ('Problem', 'In the Manager&rsquo;s office the round chat bubble sat on top of the &ldquo;Next line &rsaquo;&rdquo; button.'),
            ('Why', 'Both live at the bottom left. The bubble did not know a page had its own buttons there.'),
            ('Fix', 'A page marks its own bottom-left controls. The bubble sits above them. In the Manager&rsquo;s office it moves up <b>132 px</b>.')],
            bars(bar('Bubble moved up in the Manager&rsquo;s office', None, 132, 150, '', '132 px', 'blue')) +
            p.figs([f('0.78', '3a-office-bubble-before-phone.jpg', '<b>Before:</b> the green bubble sits on &ldquo;Next line &rsaquo;&rdquo;.'),
                    f('0.78', '3b-office-bubble-after-phone.jpg', '<b>After:</b> the bubble is higher. &ldquo;Next line &rsaquo;&rdquo; is clear.')], pair=True)),
        item('The admin side menu folds on a computer', [tag('reas', 'no still')], [
            ('Problem', 'You said: &ldquo;We need to be able to close the side tab.&rdquo; You also did not like the thick dark scrollbar.'),
            ('Why', NR),
            ('Fix', 'The &laquo; button at the top of the menu folds it to a 64 px strip of icons. &raquo; opens it. Your choice is remembered per browser. The thick scrollbar is gone.')]),
        item('The patch-notes list names every page', [tag('seen'), tag('reas', 'from the commit')], [
            ('Problem', 'The list on the left of Admin &rarr; Patch notes said only &ldquo;v0.xx&rdquo;. With this many versions in two days, you could not tell which page was which.'),
            ('Why', 'The list showed the version number and the date, not the page&rsquo;s name.'),
            ('Fix', 'The page&rsquo;s name now shows under each version. The last two days have one entry per page, v0.60h to v0.84 (v0.75 is the index). Each entry opens its kept page, with its pictures, exactly as published. Every title starts with &ldquo;Harry&rsquo;s patch notes&rdquo;, so each has an owner and the author counts as having read it.')],
            p.figs([f(None, 'patch-notes-archive-pc.png', '<b>Look at:</b> the page name under each version on the left, and the Read by faces. The counts in the middle (15 pages, 8 open) are from the first 15-page version of the index. Today it lists more.', 'wd', base=os.path.join(BASE, 'pn'))], wide=True)),
    ])

    # ---------- fixed ----------
    fx = section('fix', 'FIXED', [
        item('Team board push counts are real now', [build_pill('b13'), tag('seen'), tag('meas')], [
            ('Problem', 'The Team board counts looked wrong. Harry&rsquo;s count was capped, and work merged in from main was counted as his.'),
            ('Why', 'It counted only the newest 20 commits on a branch.'),
            ('Fix', 'It now counts real pushes from GitHub&rsquo;s push log: any branch, the last 7 days, own work only. The eye guide on the page says so.')],
            bars(bar('Harry, pushes this week', 20, 166, 170, '20 at most', '166'),
                 bar('Mikey, pushes this week', None, 34, 170, '', '34', 'blue'),
                 bar('Leo, pushes this week', None, 21, 170, '', '21', 'blue'),
                 note='Harry&rsquo;s old count could not pass 20. The old figures for Mikey and Leo are not in the report.') +
            p.figs([f('0.78', '4a-team-board-push-counts-computer.jpg', '<b>Look at:</b> the three people at the top: Harry 166 pushes this week, Mikey 34, Leo 21. Each has &ldquo;1 patch note to read&rdquo;.', 'wd')], wide=True) +
            details('More pictures (1): the eye guide', p.figs([f('0.78', '4b-team-board-guide-push-count-computer.jpg', '<b>Look at:</b> the eye guide on the Team board explains what the push count is (last 7 days, any branch, own work only).', 'wd')], wide=True)) +
            more('b13', 'It also covers every fixture date.')),
        item('The &ldquo;GitHub refused the site&rsquo;s key&rdquo; lines are gone', [build_pill('b13'), tag('seen', 'seen: gone'), tag('reas', 'cause reasoned')], [
            ('Problem', 'The Team board showed six amber lines: &ldquo;GitHub refused the site&rsquo;s key &hellip; Check GITHUB_TOKEN in Vercel&rdquo;.'),
            ('Why', 'The refused key was the local test computer&rsquo;s own key, not Vercel&rsquo;s.'),
            ('Fix', 'A refused key is tried once. Then the board reads without it. One line says whose key it was.')]),
    ])

    # ---------- known issues ----------
    bug = section('bug', 'KNOWN ISSUES', [
        item('Not tried with real people or the real database', [tag('no')], [
            ('Problem', 'Round two was seen in a local test room at phone and computer size. It was not tried against the real database, a real iPhone, or two people at once.'),
            ('Why', 'The database file <b>team_room_v2.sql</b> has not run. Round one&rsquo;s file (team_room.sql) ran on 19 Oct, as the 19 Oct notes say.'),
            ('Status', 'Replies, @ and points work without it. Seen faces and Got it stay on the device until it runs. See Needs your OK.')]),
        item('A line in one picture the reports do not cover', [tag('seen')], [
            ('Problem', 'On a phone, the patch-notes Page tab says &ldquo;Forbidden &mdash; patch notes need an admin sign-in&rdquo;.'),
            ('Why', 'It is in the B11 picture. The report does not name it. It may be the local test sign-in.'),
            ('Status', 'Not checked. It is not part of the B11 changes.')]),
    ])

    nxt = section('nxt', 'NEXT', [
        item('Phone alerts for chat, and chat search', [tag('no', 'not in a report')], [
            ('Problem', 'You said yes on 19 Oct to phone alerts for chat, and to chat search and threads. Round two built replies, @ and the &ldquo;Waiting on me&rdquo; list.'),
            ('Why', 'No build report covers phone alerts or search. Phone alerts need a service worker and keys (the 19 Oct handoff says so).'),
            ('Status', 'No report says it was built. Say if you want it next.')]),
    ])

    numbers = (
        '<p><b>Counts.</b> Four views (Board, Ideas, Chat, To-do). Idea stages: 3. Vote dots per idea: 3. A ticked job leaves after 24 hours. The room loads the last 300 messages and the database keeps 5,000.</p>'
        '<p><b>Bubble.</b> 50 px &rarr; 40 px. Fades to 40% while scrolling. Up 132 px in the Manager&rsquo;s office. Covers the left 11 px of &ldquo;Let&rsquo;s go&rdquo; on Training levels.</p>'
        '<p><b>Pushes in the last 7 days (20 Oct).</b> Harry 166, Mikey 34, Leo 21. Before, the count stopped at the newest 20 commits.</p>'
        '<p><b>Patch notes in the list.</b> 25 versions for 19&ndash;20 Oct (v0.60h to v0.84).</p>')

    return p, dict(
        key='t82', ver='0.82', title='Team Board &amp; Team Updates', pill='TEAM BOARD &middot; TEAM UPDATES',
        headline='The team room now shows who has seen each message, quotes replies, tags people and pages, points at the screen, and tracks who has read each patch note.',
        sub='19&ndash;20 Oct 2026. Team Room v1 (19 Oct) and round two (20 Oct), with the B4 and B13 changes to the bubble and the Team board.',
        status='Round one is on main since 19 Oct (PR #744). Round two and the 20 Oct fixes are on the Harry branch, not live.',
        footer=FOOT, videos_label='(none planned)',
        checks=[
            ('The chat bubble', 'On any admin page, bottom left, 40 px. Tap it: Chat and To-do. Scroll the page: it fades and lets taps through.'),
            ('The four views', 'Admin menu &rarr; Team board. Switch Board, Ideas, Chat, To-do. The same four are in the side menu with counts.'),
            ('Seen faces and Reply', 'Team chat. Small H / M / L faces sit under each message. A reply shows the quote. A tap on the quote jumps back.'),
            ('@ names and Waiting on me', 'Type @ in the message box. An @ to you shows gold. The Waiting on me list sits at the top.'),
            ('Link a page', 'Press the link button, or type # and a page name. It goes in as a card.'),
            ('Point at the screen', 'Press Shift+X, or the Point button in the bubble. Drag a box, write a note, pick who. The other person opens the link and presses Got it.'),
            ('Patch notes: Read by', 'Admin &rarr; Patch notes. A Read by row, a Read and understood button, a Notes thread. The list on the left names each page.'),
            ('Team board counts', 'Under each person: &ldquo;N patch notes to read&rdquo;, and pushes this week (Harry 166, Mikey 34, Leo 21 on 20 Oct).'),
            ('No amber key lines', 'The Team board shows no &ldquo;GitHub refused the site&rsquo;s key&rdquo; lines.'),
            ('The bubble above page buttons', 'Manager&rsquo;s office on a phone: the bubble sits above &ldquo;Next line &rsaquo;&rdquo;.')],
        sections=[r1, r2, chg, fx, bug, nxt], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this page.</b><p>Stills show each step. Say if you want one, for example the Point drag.</p>',
        seen=dict(
            seen=['Round one&rsquo;s five views, from a local test room with sample rows (taken for the earlier page)', 'Every round-two feature in the local test room, at phone and computer size',
                  'The bubble faded while scrolling, and before and after in the Manager&rsquo;s office, on a phone', 'The Team board counts and its eye guide on a computer', 'The patch-notes list with page names on a computer'],
            meas=['Bubble 50 &rarr; 40 px; up 132 px in the Manager&rsquo;s office', 'Pushes in the last 7 days: Harry 166, Mikey 34, Leo 21'],
            reas=['The first build&rsquo;s own checks only (type check and a test file); no live look was kept for round one', 'Notes on pushes, the portable kit, the folding side menu, KIB Admin and the recorder folders (no still)', 'The cause of the &ldquo;GitHub refused the site&rsquo;s key&rdquo; line: the local test computer&rsquo;s key'],
            no=['Two people using it at once on real phones', 'The real database: team_room_v2.sql has not run', 'A real iPhone', 'The live site: nothing from 20 Oct is live yet']),
        ok=[
            dict(who='For Mikey', q='Run team_room_v2.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, replies, @ and points work. Seen faces and Got it stay on the device, and the screen says so. Idempotent. It is the file after team_room.sql.'),
            dict(q='Try the team room with two people on real phones once the file has run?', opts=[('yes', 'p-grn'), ('later', 'p-blu')],
                 d='The B11 report says it was not tried with two people at once.'),
            dict(q='Build the whole team room as a portable kit?', by='Harry, 19 Oct', done='Yes: &ldquo;build the full team room/board as a portable kit for later&rdquo;.'),
            dict(q='Where does chat live?', by='Harry, 19 Oct', done='Only in the admin room, reachable from every admin page as a pop-up box.'),
            dict(q='Team room before the big CLAUDE.md trim?', by='Harry, 19 Oct', done='Yes, the team room comes first.'),
            dict(q='A &ldquo;Waiting on me&rdquo; inbox, phone alerts for chat, chat search and threads?', by='Harry, 19 Oct', done='Yes to all three (&ldquo;waiting on you is cool&rdquo;). Waiting on me is built (round two). No report says alerts or search were built: see Next. (As the 19 Oct handoff records your answer.)'),
            dict(q='Read receipts, replies, @, page links, Shift+X pointing, patch-note receipts?', by='Harry, 20 Oct', done='Asked for in your words. Built in round two (B11).'),
            dict(q='The Team board push count, the XP Rewards error, the chat bubble over &ldquo;Next line &rsaquo;&rdquo; and the GitHub key line', by='Harry, 20 Oct', done='Asked for in your feedback on the overnight pages. Done in B13.'),
            dict(q='The bubble covering 11 px of &ldquo;Let&rsquo;s go&rdquo; on Training levels (admin and test pages)', by='Harry, 20 Oct', done='Fine as it is. The button still takes the tap.')]
    )


# ========================================================================================================
# 2. ADMIN PAGES & SKINS  (v0.83)
# ========================================================================================================
def admin_page():
    p = TPage('t83')
    f = p.fv

    mapsteps = steps([
        ('', '<b>A game tab</b> at the top of every admin page: Road to Ballon d&rsquo;Or, Website games, Studio. A new game adds a new tab.'),
        ('', '<b>A group</b> (for example Real data, Chances, Match tests). The side menu lists only the current game&rsquo;s groups.'),
        ('', '<b>A page.</b> Each group page has two boxes: <b>Admin tools</b> (things in the game that we tune) and <b>Test pages</b> (new things being tried).'),
        ('', '<b>The frame</b> around every page: one back arrow top left, the title, the side menu, the Look switch. The eye button at bottom right explains the page.')])

    add = section('add', 'ADDED', [
        item('The admin is split by game, in four levels', [tag('seen')], [
            ('Problem', 'Website games (tierlists, draft, tic-tac-toe) and Road to Ballon d&rsquo;Or sat in one long admin list. You said: &ldquo;we may be a production company that makes a lot of games&rdquo;.'),
            ('Why', 'The admin was built when there was one game. The list held 59 pages. Several games need several areas.'),
            ('Fix', 'Four levels, top to bottom:' + mapsteps + 'On 19 Oct the three tabs held <b>44, 10 and 5</b> pages (Studio: team board, patch notes, videos, testers). Today they hold <b>45, 10 and 7</b>.')],
            p.figs([f('0.78', '4a-team-board-push-counts-computer.jpg', '<b>Look at:</b> the three game tabs with their page counts (45, 10, 7), the side menu for one game, and the Look switch at the bottom of the menu. This is Clean light, on 20 Oct.', 'wd'),
                    f('0.65', 'split-web.jpg', '<b>The Website games tab on a phone (19 Oct):</b> its own four groups.')], wide=True) +
            details('More pictures (1): the first split, 19 Oct', p.figs([f('0.65', 'split-star.jpg', '<b>Look at:</b> three game tabs on top. Down the side: only that game&rsquo;s groups.', 'wd')], wide=True))),
        item('Side tabs are back on the Broadcast look', [tag('seen')], [
            ('Problem / Why', 'You said the Broadcast home needed its side tabs back (19 Oct).'),
            ('Fix', 'A group page has its other groups as tabs along the top (Career screens, Chances, Match tests&hellip;).')],
            p.figs([f('0.65', 'sidetabs.jpg', '<b>Look at:</b> the Chances group: three picture cards, and the other groups as tabs above them.', 'wd')], wide=True)),
        item('The admin home is one page of group cards', [tag('seen')], [
            ('Problem', 'The admin list was one long wall of pages.'),
            ('Why', 'You had to scroll and guess. 59 pages were in the list.'),
            ('Fix', 'The home shows groups only. <b>Grid</b> shows picture cards. <b>List</b> shows rows. The device remembers your pick.')],
            p.figs([f('0.65', 'bg-home-grid-pc.jpg', '<b>Look at:</b> the group cards and the Grid | List switch at top right.', 'wd')], wide=True) +
            details('More pictures (2): List on a computer, Grid on a phone', p.figs([f('0.65', 'bg-home-list-pc.jpg', '<b>List view on a computer.</b>', 'wd')], wide=True) + p.figs([f('0.65', 'bg-home-grid-phone.jpg', '<b>Grid on a phone.</b>')]))),
        item('Each group page has two boxes of picture cards: Admin tools and Test pages', [tag('seen')], [
            ('Problem', 'A group was a list of names, so you could not see what a page was. Pages for new ideas sat next to pages for features we keep.'),
            ('Why', 'You open pages by what they look like. You said: &ldquo;we need to differentiate&rdquo;.'),
            ('Fix', 'Two boxes: <b>Admin tools</b> and <b>Test pages</b>. 28 pages were marked as tests, a first guess. Every card has its owner and an Open button. <b>You kept the two headings</b> (20 Oct) over one list A to Z. The First-person dribble page left the admin list (you said so on 19 Oct).')],
            p.figs([f('0.65', 'a1-now.jpg', '<b>Look at:</b> Real data on a phone: &ldquo;Admin tools 4&rdquo;, then &ldquo;Test pages 5&rdquo;. This is the layout you kept.'),
                    f('0.65', 'a1-mixed.jpg', '<b>The other choice, not used:</b> one list of all 9 pages, A to Z.')])),
        item('New admin pages keep the look by themselves', [tag('meas')], [
            ('Problem', 'A new page would arrive in the old look. You asked: &ldquo;how do we keep up the look&rdquo; on a new page.'),
            ('Why', 'Nothing forced a page onto the frame.'),
            ('Fix', 'One shared Broadcast frame. A build check stops the deploy if a Road to Ballon d&rsquo;Or admin page does not use it. The &ldquo;not yet&rdquo; list of older pages is now empty. Run for these notes, it prints: <b>45 of 45 pages on the Broadcast frame, 0 still to move</b>.')]),
        item('A Research area', [build_pill('b4'), tag('seen')], [
            ('Problem / Why', 'You asked (19 Oct) for a Research area for the Learning from FM top 10 and the other research pages.'),
            ('Fix', 'A Research page on the Studio tab: 4 write-ups as cards. Tap Read to open one. To add a write-up, add one line to a list (lib/research.ts).')],
            p.figs([f('0.68', 'research-computer-broadcast.jpg', '<b>Look at:</b> four cards: Learning from FM, Highlights, Full highlights rebuild plan, 3D audit and plan.', 'wd'),
                    f('0.68', 'research-phone-bento.jpg', 'The same page on a phone in Bento.')], wide=True)),
        item('The eye (&#9432;) guide: seven new pages have one', [tag('meas')], [
            ('Problem', 'A page without a guide leaves people guessing what a button does and where a save goes.'),
            ('Why', 'The house rule says: change a button, change its guide in the same change. New pages need an entry too.'),
            ('Fix', 'Every admin and test page has an <b>eye button</b> (bottom right) that explains each button, where a save goes, and whether anything commits to the repo. Counted from the guides file: <b>58 guides on 18 Oct, 64 now</b>. New: Real shots, Research, the Highlights rebuild ruler, the Scene editor, the Scene generator, the 3D bench and Five-a-side. One went with the deleted StatsBomb page. The Team board&rsquo;s guide says what a push count is.')],
            p.figs([f('0.78', '4b-team-board-guide-push-count-computer.jpg', '<b>Look at:</b> the eye guide open on the Team board.', 'wd')], wide=True)),
    ])

    frame_steps = steps([
        ('done', '<b>19 Oct:</b> 36 pages move onto the Broadcast frame, every button kept. Five get the frame only, layout unchanged: Club data, Career XP book, Team sheets, Leo&rsquo;s Oct 13 update and Goal videos. The site top menu and footer are hidden on these pages, so they fill the screen.'),
        ('done', '<b>20 Oct, B6:</b> the last 6 (3D Signing, Manager&rsquo;s Office, 3D Shop, 3D Garden, 3D House, the Style test). <b>37 of 43 &rarr; 43 of 43.</b> Add <b>?bare=1</b> to the address for the old full screen.'),
        ('done', '<b>20 Oct, B5 and B8:</b> the 3D bench and the Five-a-side test area are new pages. They are on the frame too: the build check requires it.'),
        ('done', '<b>Today:</b> the build check prints <b>45 of 45</b>, 0 still to move.')])
    chg = section('chg', 'CHANGED', [
        item('Every admin page is on the Broadcast frame: 45 of 45', [build_pill('b6'), tag('seen'), tag('meas')], [
            ('Problem', 'The Road to Ballon d&rsquo;Or admin pages were not on the new look. The site menu and footer sat on top of the admin frame. Six 3D pages kept the old full screen.'),
            ('Why', 'You picked a layout for each page from mock-ups (two options each for 42 pages). Each page was built from the option you picked. The last six waited for the scene editor work (A-8).'),
            ('Fix', 'Four steps:' + frame_steps)],
            p.figs([f('0.70', '10-framed-shop-1440.jpg', '<b>Look at:</b> the 3D Shop in the frame. The page title and buttons sit above a full-size 3D view.', 'wd'),
                    f('0.70', '12-framed-house-1440.jpg', '<b>The 3D House</b> in the frame.', 'wd')], wide=True) +
            details('More pictures (8): five pages, before and after', p.figs([
                f('0.65', 'real-moments-before-pc-900.jpg', '<b>Real moments, before.</b>', 'wd'), f('0.65', 'real-moments-after-pc-900.jpg', '<b>After:</b> one big Play button, a search box.', 'wd'),
                f('0.65', 'training-levels-before-pc-900.jpg', '<b>Training levels, before.</b>', 'wd'), f('0.65', 'training-levels-after-pc-900.jpg', '<b>After:</b> tabs, a grid of 30 levels, a panel.', 'wd'),
                f('0.65', 'star-pass-before-pc-900.jpg', '<b>Star Pass, before.</b>', 'wd'), f('0.65', 'star-pass-after-pc-900.jpg', '<b>After:</b> five tier cards.', 'wd'),
                f('0.65', 'balance-numbers-before-pc-900.jpg', '<b>Balance numbers, before.</b>', 'wd'), f('0.65', 'balance-numbers-after-pc-900.jpg', '<b>After:</b> a slider on each number.', 'wd')], wide=True)) +
            more('b6', 'It also covers the scene editor.')),
        item('One layout, four looks. Clean light opens first.', [build_pill('b4'), tag('seen')], [
            ('Problem', 'You said: &ldquo;They can&rsquo;t just click Clean light and suddenly I&rsquo;m on a different admin page with a different layout.&rdquo; (19 Oct)'),
            ('Why', 'The four looks were laid out differently. You had picked two looks (Broadcast and Bento) from eight mock-ups, because both show every group at once. The Bento cards were hard to read (A-2).'),
            ('Fix', 'Broadcast, Bento, Ops room and Clean light all use <b>Broadcast&rsquo;s layout</b>. Only colours, fonts and surfaces change. Bento cards now show dark words on a pale tint, with a white count pill. <b>Clean light is the default</b> (20 Oct, &ldquo;he preferred that&rdquo;): a browser that never picked a look opens in it. Anyone who picked a look keeps it. The Look switch is a 2&times;2 grid at the bottom of the menu.')],
            p.figs([f('0.68', 'home-computer-broadcast.jpg', '<b>Broadcast.</b> Look at: the same sidebar and tiles in all four looks.', 'wd'),
                    f('0.68', 'home-computer-bento.jpg', '<b>Bento.</b> Dark words on a pale tint. White count pill.', 'wd'),
                    f('0.68', 'home-computer-ops.jpg', '<b>Ops room.</b> Same layout. Dark green surfaces.', 'wd'),
                    f('0.68', 'home-computer-light.jpg', '<b>Clean light.</b> Same layout. White surfaces. The default.', 'wd')], wide=True) +
            details('More pictures (1): the Chances group on a phone in Clean light', p.figs([f('0.68', 'group-chances-phone-light.jpg', '<b>Clean light</b> on a phone.')])) +
            more('b4', 'It has the phone view in all four looks.')),
        item('Words you could not read in the light looks', [build_pill('b4'), tag('meas'), tag('seen')], [
            ('Problem', 'About <b>320 unreadable words on 12 pages</b> in the light looks.'),
            ('Why', NR),
            ('Fix', 'An &ldquo;ink guard&rdquo; on about 40 test pages fixes the words. Now <b>0&ndash;3 per page</b>.')],
            bars(bar('Unreadable words on 12 pages (light looks)', 320, 3, 340, 'about 320', '0&ndash;3 a page')) +
            p.figs([f('0.68', 'bc-page-tournaments-computer-light.jpg', '<b>Look at:</b> the Tournaments test page in Clean light. Every word can be read.', 'wd')], wide=True)),
        item('One back arrow, top left, in the same place', [build_pill('b4'), tag('seen'), tag('meas')], [
            ('Problem', 'You said: &ldquo;Always top left &hellip; always the same&rdquo;, on every admin and test page (19 Oct).'),
            ('Why', NR),
            ('Fix', 'One arrow, top left, on every framed page. A page goes back to its group. A group page goes back to its game&rsquo;s home. Measured: the arrow sits at the same corner on every framed page on a phone. The 3D garden, house, shop and 3D training keep their own in-game back button (you said so on 20 Oct).')],
            p.figs([f('0.68', 'back-arrow-3-pages-phone.jpg', '<b>Look at:</b> the arrow, top left, on all three pages (Site XP Rewards, Manager&rsquo;s Office, Full match).', 'wd')], wide=True)),
        item('The chat bubble: smaller, see-through to taps, above page buttons', [build_pill('b4'), build_pill('b13'), tag('seen'), tag('meas')], [
            ('Problem', 'The bubble was 50 px and could sit on a button. In the Manager&rsquo;s office it sat on &ldquo;Next line &rsaquo;&rdquo;.'),
            ('Why', 'Both live at the bottom left. The bubble did not know a page had its own buttons there.'),
            ('Fix', '40 px. Only the round button takes taps. It fades while you scroll. A page marks its own bottom-left controls and the bubble sits above them (up 132 px in the Manager&rsquo;s office). The full story and the pictures are on the Team page, v0.82.')],
            bars(bar('Bubble size', 50, 40, 60, '50 px', '40 px'),
                 bar('Bubble moved up in the Manager&rsquo;s office', None, 132, 150, '', '132 px', 'blue'))),
        item('Admin on a phone: less room for bars, more for pages', [tag('meas'), tag('seen')], [
            ('Problem', '&ldquo;Too much space on mobile is taken up by UI and text.&rdquo; The tabs, search, filters and team card filled about 460 px before the first group box.'),
            ('Why', NR),
            ('Fix', 'A slimmer top bar and tabs. The search is one slim line. The filters and the team&rsquo;s three faces share one line that scrolls sideways. &ldquo;Saves real data&rdquo; reads &ldquo;Real data&rdquo;. Group boxes are three to a row (you kept three, 19 Oct: &ldquo;looks a lot better with the key button staying on screen&rdquo;). Group pages show two cards to a row. Filters stay 30 px tall so a finger still hits them.')],
            bars(bar('Where the first group box starts on a phone (px)', 430, 223, 460, '430', '223'),
                 note='All 8 Road to Ballon d&rsquo;Or groups now fit one phone screen.') +
            p.figs([f('0.65', 'ph-before.jpg', '<b>Before:</b> the first box starts about 430 px down.'),
                    f('0.65', 'ph-after.jpg', '<b>After:</b> the first box starts at 223 px.'),
                    f('0.65', 'ph-group.jpg', '<b>After:</b> a group page.')])),
    ])

    fix = section('fix', 'FIXED', [
        item('XP Rewards no longer says &ldquo;Failed to fetch&rdquo;', [build_pill('b13'), tag('seen')], [
            ('Problem', 'The admin page Site XP rewards showed a red &ldquo;Failed to fetch&rdquo; box on the test build.'),
            ('Why', 'The test build has no database key. The note on the page now says so.'),
            ('Fix', 'It now loads, read-only, with a note: saving needs the site&rsquo;s database key, which the live site has and the test build does not. Every failure is said in plain words.')],
            p.figs([f('0.78', '2-xp-rewards-after-phone.jpg', '<b>Look at:</b> the amber box under the tabs: &ldquo;Read-only here&hellip;&rdquo;. The reward cards load below it.')]) +
            more('b13', 'It also covers every fixture date.')),
        item('Admin images: a grip to drag, on a phone', [build_pill('b1'), tag('seen')], [
            ('Problem', 'Controls made for a mouse are hard to use by touch. You asked that anything a mouse does work at once with a finger.'),
            ('Why', NR),
            ('Fix', 'Each admin image has a &#10303; grip. On a phone: hold an image, then drag. A later fix moved the grip to the picture&rsquo;s corner, because it sat over the crop button. Other admin touch fixes (colour inputs, sliders, minimap markers, gallery dots, chips) were built too but are <b>reasoned from the code, not seen</b>. The report does not say which of them are admin pages.')],
            p.figs([f('0.66', '05-admin-drag-grip.jpg', '<b>Look at:</b> the &#10303; grip at the bottom left of each image.')]) +
            more('b1', 'All 27 touch fixes are there.')),
        item('Fixes found while moving the pages (19 Oct)', [tag('seen')], [
            ('Problem', 'Small bugs showed up on four admin test pages while they moved onto the frame.'),
            ('Why', NR),
            ('Fix', '<ul><li>Team sheets: opening a club no longer saves. Only an edit saves.</li>'
                    '<li>International world: the card pictures follow the picked nation.</li>'
                    '<li>Full match: event lines show the club name, not &ldquo;{club}&rdquo;.</li>'
                    '<li>Real Goals: the big card draws its own goal mouth, not a still from another match.</li></ul>'
                    'The phone fixes for the website games are on the Everything Else page, v0.84.')]),
    ])

    bug = section('bug', 'KNOWN ISSUES', [
        item('3D garden, house, shop and 3D training keep their own back button', [tag('no', 'decided')], [
            ('Problem', 'They do not use the one arrow.'),
            ('Why', 'They are full-screen 3D places with their own in-game back.'),
            ('Status', 'Decided (Harry, 20 Oct): they keep their own. Everything else uses the one arrow.')]),
        item('The Training levels page freezes on the second tab switch', [tag('seen'), tag('no', 'not fixed')], [
            ('Problem', 'After you pick a level, the Training levels page freezes on the second tab switch, then crashes, in the test browser.'),
            ('Why', 'Not known. The old page does the same.'),
            ('Status', 'Found while building B7b, not fixed. Not checked on a phone.')]),
        item('Five pages got the frame only', [tag('reas', 'by design')], [
            ('Problem', 'Club data, Career XP book, Team sheets, Leo&rsquo;s Oct 13 update and Goal videos still have their old layout inside the frame.'),
            ('Why', 'Your picks (19 Oct): keep Club data as now, leave the Career XP book, keep Team sheets, &ldquo;don&rsquo;t care&rdquo; for Leo&rsquo;s Oct 13 update. Goal videos moves only if it can really edit highlights.'),
            ('Status', 'On purpose. One question about Goal videos is open (below).')]),
        item('What was not seen', [tag('no')], [
            ('Problem', 'Any page on a real phone. Any save reaching the real database: every save was faked in the tests. The ink guard was measured on 12 pages of about 40.'),
            ('Why', 'This machine has no real phone and no live database key.'),
            ('Status', 'Check the pages on your phone. Nothing from 20 Oct is live yet.')]),
    ])

    numbers = (
        '<p><b>Phone admin, where the first box starts.</b> Grey is before. Colour is after.</p>' +
        bars(bar('First group box (px from the top)', 430, 223, 460, '430', '223')) +
        '<p><b>Pages.</b> Tabs today: Road to Ballon d&rsquo;Or 45, Website games 10, Studio 7 (from a 20 Oct still). On 19 Oct: 44, 10 and 5. 59 pages in the old list. 28 marked as test pages. 12 group cards. Frame: 36 on 19 Oct, 37 &rarr; 43 of 43 in B6, 45 of 45 today.</p>'
        '<p><b>Eye guides.</b> 58 on 18 Oct, 64 now (7 new, 1 removed with the StatsBomb page).</p>'
        '<p><b>Light looks.</b> About 320 unreadable words on 12 pages before, 0&ndash;3 per page after.</p>')

    return p, dict(
        key='t83', ver='0.83', title='Admin Pages &amp; Skins', pill='ADMIN PAGES &middot; SKINS',
        headline='The admin is split by game, every page sits on one frame, four looks share one layout, and the phone admin wastes less room.',
        sub='19&ndash;20 Oct 2026. The 19 Oct split and looks, then the 20 Oct build that made all four looks one layout and moved the last pages onto the frame.',
        status='The 19 Oct work is on main (PR #744). Everything from 20 Oct (one layout, Clean light as the default, the one arrow, the 40 px bubble, Research, the last pages on the frame, the XP Rewards fix) is on the Harry branch, not live.',
        footer=FOOT, videos_label='(none planned)',
        checks=[
            ('Game tabs', 'Open the admin. Three tabs at the top: Road to Ballon d&rsquo;Or, Website games, Studio. The side menu shows one game&rsquo;s groups.'),
            ('A group page', 'Open any group (for example Real data). Its pages sit in two boxes: Admin tools and Test pages.'),
            ('The Look switch', 'Admin menu, bottom: Broadcast, Bento, Ops room, Clean light. The layout stays the same. A browser that never picked a look opens in Clean light.'),
            ('Back arrow', 'On a phone, open any admin page. The arrow is top left. A page goes back to its group. A group goes back to its game&rsquo;s home.'),
            ('Chat bubble', 'Bottom left, 40 px. It fades while you scroll. In the Manager&rsquo;s office it sits above &ldquo;Next line &rsaquo;&rdquo;.'),
            ('Admin on a phone', 'A slim search, the filters on one line, three group boxes in a row. The first box starts at 223 px.'),
            ('A page on the frame', 'Open Real moments or Training levels. The page has the frame and every button it had.'),
            ('The last 6 pages', 'Open the 3D Shop, Garden, House, Signing, Office and Style test. Each has the frame and one back arrow. Add ?bare=1 for the old full screen.'),
            ('Research', 'Studio tab &rarr; Research. Four write-ups as cards.'),
            ('The eye', 'Press the eye (bottom right) on any admin page. It explains each button and where a save goes.'),
            ('XP Rewards', 'Admin &rarr; XP &amp; Rewards. It loads. On a test build a note says it is read-only.'),
            ('A light look', 'Open Tournaments in Clean light. Every word can be read.')],
        sections=[add, chg, fix, bug], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this page.</b><p>Looks are judged by stills. Say if you want one, for example the bubble fading while you scroll.</p>',
        seen=dict(
            seen=['Broadcast and Bento at 1440&times;900 and 390&times;844, 0 page errors (19 Oct)', 'The admin home (Grid and List), group pages, the game tabs and the side tabs',
                  'The four looks on Admin home (computer), and the Chances group on a phone', 'The back arrow on three phone pages; the bubble on a phone', 'All six 3D pages on the frame; XP Rewards loading on a phone; the eye guide on the Team board',
                  'Every one of the 30 pages from 19 Oct was checked by its builder in a browser at computer and phone size, with clicks'],
            meas=['The first group box on a phone: 430 px &rarr; 223 px', 'Pages on the frame: 45 of 45 (the build check, run for these notes); B6&rsquo;s report: 37 &rarr; 43 of 43', 'About 320 unreadable words on 12 pages &rarr; 0&ndash;3 per page', 'Bubble 50 &rarr; 40 px; up 132 px in the Manager&rsquo;s office', 'Eye guides: 58 &rarr; 64 (counted from the guides file)'],
            reas=['The build check that stops a deploy: read from the code, not seen failing a bad page', 'Admin touch fixes other than the image grip'],
            no=['Any page on a real phone', 'Any save reaching the real database', 'The ink guard on the rest of the ~40 light-look test pages', 'The live site: nothing from 20 Oct is live yet']),
        ok=[
            dict(who='No answer on record', q='Relationship games: move the games&rsquo; rules (fixed numbers in code) into the settings file so they can be tuned?', opts=[('yes', 'p-grn'), ('no', 'p-red')],
                 d='Today only the test player&rsquo;s dials change. It is a small build. From the New-look admin pages notes; your 20 Oct answers do not mention it.'),
            dict(who='No answer on record', q='Goal videos: move it to the new look only if it can really edit highlights. Is that the plan?', opts=[('yes', 'p-grn'), ('no', 'p-red')],
                 d='It is one of the pages that got the frame only. Your 20 Oct answers do not mention it.'),
            dict(q='A-1: two headings (Admin tools, Test pages), or one list A to Z?', by='Harry, 20 Oct', done='Keep the two headings.'),
            dict(q='A-2: the Bento cards are hard to read. Redo them or drop Bento?', by='Harry, 19 Oct', done='Redo all the looks so they share one layout. Built in B4.'),
            dict(q='A-3: the chat bubble sometimes covers buttons. Fix it bottom left, or keep it moving?', by='Harry, 19 Oct', done='Fixed bottom left, &ldquo;as long as, if it is covering something, I can still press it&rdquo;. Built in B4 and B13.'),
            dict(q='A-4: where should the back arrow go?', by='Harry, 19 Oct', done='&ldquo;Always top left &hellip; always the same&rdquo;, on every admin and test page. Built in B4.'),
            dict(q='A-5: Training levels take two taps. Keep it?', by='Harry, 19 Oct', done='Keep. New ask: edit the training drills like the scenario gallery. Built in B7 and B7b.'),
            dict(q='A-8: the last 6 admin pages, now or with the scene editor?', by='Harry, 19 Oct', done='With the scene editor work. Built in B6.'),
            dict(q='A-9: three group boxes in a row on a phone, or two?', by='Harry, 19 Oct', done='Three stays. &ldquo;Looks a lot better with the key button staying on screen.&rdquo;'),
            dict(q='3D garden, house, shop and 3D training: own back button?', by='Harry, 20 Oct', done='They keep their own. Everything else uses the one arrow.'),
            dict(q='Which admin look opens by default?', by='Harry, 20 Oct', done='Clean light (&ldquo;he preferred that&rdquo;). Done.'),
            dict(q='The bubble covering 11 px of &ldquo;Let&rsquo;s go&rdquo; on Training levels', by='Harry, 20 Oct', done='Fine as it is. The button still takes the tap.')]
    )


# ========================================================================================================
# 3. EVERYTHING ELSE  (v0.84)
# ========================================================================================================
def else_page():
    p = TPage('t84')
    f = p.fv
    T = lambda s: '<span class="pill p-blu">%s</span>' % s

    # ---- play screens: drift ----
    rows = [('Full match, your chance', 340, 366), ('Training drills', 346, 366), ('Trial: Take him on', 362, 366),
            ('Real moments', 318, 366), ('Goal videos', 332, 366), ('Visual effects lab', 340, 366),
            ('Real shots', 344, 366), ('Real goals', 360, 366), ('Dribble on a stick', 362, 366)]
    phone_bars = bars(*[bar(n, a, b, 400, str(a), str(b)) for n, a, b in rows],
                      note='Pitch width in px on a 390 px phone. Grey is before. Colour is after. The real match is 366 px wide.')
    pc_bars = bars(*[bar(n, a, b, 420, str(a), str(b)) for n, a, b in [('Training drills', 364, 384), ('Trial: Take him on', 380, 384), ('Real moments', 340, 384)]],
                   note='Pitch width in px on a computer. The real match is 384 px. The other screens were already 384.')

    fixed_items = [
        item('Every football screen now draws the pitch at the real match&rsquo;s size', [T('Play screens'), tag('meas')], [
            ('Problem', 'You said: &ldquo;The game has definitely drifted when I press Play.&rdquo; <b>8 screens drew the pitch narrower than the real match</b> (366 px on a phone, 384 px on a computer).'),
            ('Why', 'Each page&rsquo;s padding squeezed the play box. <b>The kick strength was never off:</b> every screen already read your drag against the real match. The pitch and the players were just drawn smaller.'),
            ('Fix', 'The shared play box now steps into the page&rsquo;s side margins by exactly the missing amount, without sideways scrolling. Also: the training card lost its 10 px padding, the Real goals card no longer clips the match&rsquo;s edges, and the trial&rsquo;s pitch frame border is a ring now (it ate 4 px).')],
            phone_bars + details('The computer sizes (3 screens changed)', pc_bars)),
        item('Play buttons stay on screen', [T('Play screens'), tag('seen')], [
            ('Problem', 'On Infinite Highlights and Full match, NEXT and the chance name sat below the fold.'),
            ('Why', 'The page was taller than a phone screen.'),
            ('Fix', 'They are pinned on screen at 390&times;844 and at 1440&times;900. This is now a house rule: <b>play controls never sit below the fold</b>.')],
            p.figs([f('0.62h', 'fit-hl.jpg', '<b>Look at:</b> Infinite Highlights on a phone. NEXT and the chance name are on screen.'),
                    f('0.62h', 'fit-fm.jpg', '<b>Look at:</b> Full match, your chance.'),
                    f('0.62h', 'fit-trial.jpg', '<b>Look at:</b> the Trial.')])),
        item('The engine warning no longer fires on a read-only search', [T('Play screens'), tag('reas', 'read from the code')], [
            ('Problem', 'A read-only search with &ldquo;2&gt;/dev/null&rdquo; in it made the red warning ask. That false alarm stalled a builder for 40 minutes (20 Oct).'),
            ('Why', 'Any &ldquo;&gt;&rdquo; in a command counted as a write to the engine file the command also named. A &ldquo;2&gt;/dev/null&rdquo; points at nothing.'),
            ('Fix', 'A &ldquo;&gt;&rdquo; now counts only when it points at an engine or drift file. Earlier on 20 Oct the check also learned to catch quoted file paths in scripts, after a Python script that edited the engine slipped past once. The warning still never blocks: you can press No.')]),
        item('Small fixes on the website and in the career', [tag('seen', 'from the commit titles'), tag('reas')], [
            ('Problem', 'The 19 Oct look-over of every screen found phone problems on the website games and in two screens of the career.'),
            ('Why', NR),
            ('Fix', '<ul><li>Ten-A-Ball shows its question and keeps the answer box on screen.</li>'
                    '<li>Tic-tac-toe: GUESS stays in its box, and long square rules no longer cover the count.</li>'
                    '<li>Tierlist: the tier sheet is on one row, with readable names.</li>'
                    '<li>The Objectives pop-up stays off the Sign in button on phones.</li>'
                    '<li>PL Draft: the season-end table drops the &ldquo;played&rdquo; column on phones, so club names fit.</li>'
                    '<li>A 3D signing that throws falls back to the drawn one, and the error page shows what broke.</li></ul>')]),
    ]

    # ---- touch (B1) short ----
    touch = item('A touch check of every screen, and the fixes (B1)', [build_pill('b1'), tag('reas', 'the check'), tag('seen', '6 fixes seen')], [
        ('Problem', 'You asked that anything a mouse does work at once with a finger. A check of every screen read the code and found <b>27 things</b>: 10 in the real game, 9 on test pages, 5 on the website, 3 in the admin. <b>0 stop a finger in the real game.</b> 2 stop a finger on the website.'),
        ('Why', 'Controls made for a mouse are small or wrong by touch. The one wrong one in the game: the &minus; and + offer buttons in contract talks, where one tap could move the offer twice.'),
        ('Fix', 'All 27 are built. Six were seen on a touch phone. The in-match mute, TOUCH and Power buttons are finger-sized (mute at least 40 px wide, the other two at least 36 px tall) after your OK, size only. The 4 old failing tests pass too, with the limits not loosened.')],
        bars(bar('Real game: small or wrong', None, 10, 12, '', '10 found', 'blue'),
             bar('Test pages: small', None, 9, 12, '', '9 found', 'blue'),
             bar('Website: 2 stop a finger, 3 small', None, 5, 12, '', '5 found', 'warn'),
             bar('Admin: small', None, 3, 12, '', '3 found', 'blue')) +
        p.figs([f('0.66', '01-negotiation-plus-minus.jpg', '<b>Look at:</b> the big round &minus; and +. One tap moves your offer one step (1.9m to 2.15m in the test).')]) +
        more('b1', 'It has the other five seen fixes, the four old tests and Wembley.'))

    # ---- highlights rebuild ----
    path = steps([
        ('done', '<b>Phase 0:</b> the switch and the ruler.'),
        ('done', '<b>Phase 1:</b> the still uses the match camera.'),
        ('done', '<b>Phase 2:</b> generated build-ups before open-play chances.'),
        ('next', '<b>Phase 3:</b> players already moving when your chance starts. You said <b>go</b>, and you said the engine edit is OK, one build at a time. It is build B2. <b>No report yet.</b>'),
        ('', '<b>Phases 4 to 7:</b> the full 22-player match model. You said: decide later, after phase 3.')])
    hl_add = [
        item('Phase 0: the switch and today&rsquo;s numbers (the ruler)', [T('Highlights rebuild'), tag('seen')], [
            ('Problem / Why', 'The ruler records today&rsquo;s numbers (chances, goals, reactions), so every later phase must keep them, or say why they changed.'),
            ('Fix', 'A new Settings row: <b>Full highlights rebuild: Off | On (test)</b>. <b>Off is today&rsquo;s game exactly.</b> On also turns on &ldquo;Chances: New&rdquo;. The ruler is the test page /star-fhr-dev. You said: no admin page of its own, just a toggle, with a small &ldquo;?&rdquo; that explains it, shown to everyone for now.')],
            p.figs([f(None, 'fhr-switch.jpg', '<b>Look at:</b> the top of /star-fhr-dev: the switch (Off | On (test)) and where it lives (Settings). The ruler is below it on the same page. This still is the top of the page, cropped.', base=TOPIC_STILLS)])),
        item('Phase 2: a new build-up before every open-play chance', [T('Highlights rebuild'), tag('meas'), tag('seen')], [
            ('Problem / Why', 'You asked (answer 13) that Infinite Highlights and Infinite Match play build-ups, &ldquo;automatic and natural, with some adjusting&rdquo;.'),
            ('Fix', 'With the switch On, each open-play chance starts with a <b>4 to 8 second build-up</b>. It is different every time and ends exactly on the drawn chance. The moves come from real attacking patterns in the free match data. Better passers play the long balls. Better dribblers make the runs. Your rule (answer 14): generated build-ups must never write over Mikey&rsquo;s hand-checked scenarios, so generated is a separate layer.')],
            bars(bar('Build-ups that took a different route (of 2,527)', None, 2197, 2527, '', '2,197', 'blue'),
                 bar('Build-ups that failed the checks (of 448 checked)', None, 0, 448, '', '0 of 448'),
                 note='Chances and goals per match did not change over 500 matches (5.81 and 2.31).') +
            p.figs([f('0.63h', 'fhr-sheet.jpg', '<b>Look at:</b> 8 of the 48 build-ups checked by eye. Each row: the start, the middle, and the moment your chance begins.', 'wd')], wide=True)),
    ]
    hl_chg = [
        item('Phase 1: the picture before Play uses the match camera', [T('Highlights rebuild'), tag('meas'), tag('seen')], [
            ('Problem', 'The still before Play used a different camera from the real match, so pressing Play jumped.'),
            ('Why', 'The still was framed by its own camera, not the match&rsquo;s.'),
            ('Fix', 'With the switch On, the still is drawn with the match camera at exactly the match box&rsquo;s size. <b>0 mismatches in 100.</b>')],
            p.figs([f('0.63h', 'fhr-still.jpg', '<b>Look at:</b> the still, before Play (switch On).'),
                    f('0.63h', 'fhr-play.jpg', '<b>Look at:</b> after Play: the same frame.')])),
    ]
    hl_add = [x for x in hl_add if x]

    # ---- data ----
    sources = bars(
        bar('Wyscout public set (CC BY 4.0): every event', None, 1941, 1941, '', '1,941', 'blue'),
        bar('Afriskaut (Apache 2.0): events', None, 136, 1941, '', '136, removed 20 Oct', 'warn'),
        bar('SkillCorner (MIT): positions, phases of play', None, 20, 1941, '', '20', 'blue'),
        bar('IDSSE / DFL (CC BY 4.0): positions 25 times a second', None, 7, 1941, '', '7', 'blue'),
        note='2,104 matches in all on 19 Oct, every source free to use in a paid game.')
    data_add = [
        item('2,104 real matches, all free to use in a paid game', [T('Free data'), tag('meas')], [
            ('Problem', 'The real-football pages used StatsBomb data, and its licence does not allow a paid game.'),
            ('Why', 'A paid game needs data whose licence allows it.'),
            ('Fix', 'Four free-licence sources were reduced to pattern files the game can read. Each needs a credit line shown in the game (done on 20 Oct, in Settings). <b>Every StatsBomb file is deleted from the repo.</b>')],
            sources),
        item('Real moments, Real shots and Real Goals, rebuilt on free data', [T('Free data'), tag('seen'), tag('meas')], [
            ('Problem / Why', 'The three pages used StatsBomb data. Same licence problem.'),
            ('Fix', '<ul><li><b>Real moments:</b> 702 fully real moments (581 shots, 121 corners), all 22 players where they really stood. One Play button instead of one on every row (you kept it: A-6).</li>'
                    '<li><b>Real shots:</b> 2,875 real shots (2018 World Cup and Euro 2016). The strike and the result are real. The defenders are placed by our own rules. You called the shot map &ldquo;pretty cool&rdquo;.</li>'
                    '<li><b>Real Goals:</b> 232 levels.</li></ul>')],
            p.figs([f('0.64', 'rm-play.jpg', '<b>Look at:</b> a real moment playing: the real strike with every player in their real place.', 'wd'),
                    f('0.64', 'rs-map.jpg', '<b>Look at:</b> the Real shots shot map.', 'wd'),
                    f('0.64', 'rg-levels.jpg', '<b>Look at:</b> the Real Goals level map.', 'wd')], wide=True) +
            details('More pictures (2): the two pages on a phone', p.figs([f('0.64', 'real-moments-after-phone-360.jpg', '<b>Real moments on a phone.</b>'), f('0.64', 'real-goals-after-phone-360.jpg', '<b>Real Goals on a phone.</b>')]))),
        item('Afriskaut out, two sources in, credits in Settings, and a Real moment highlights switch', [build_pill('b3'), T('Free data'), tag('seen'), tag('meas')], [
            ('Problem', 'You said (19 Oct): there must be more than 2,104 matches, and remove Afriskaut (&ldquo;no one&rsquo;s heard of them&rdquo;). Credits go in Settings. Real moments should feed the real game, inside the highlights switch.'),
            ('Why', 'A paid game needs credit lines and free licences. Real moments only ran on a test page.'),
            ('Fix', 'Afriskaut is gone. <b>SoccerTrack v2</b> (CC BY 4.0, 6 of 10 matches) and <b>SkillCorner first release</b> (MIT, 9 matches) are in. Settings &rarr; More &rarr; <b>Data credits</b> has 8 lines. Settings &rarr; Full highlights rebuild &rarr; <b>Real moment highlights: Off | On</b>: with it on, <b>1 in 4</b> open-play one-on-ones, tight angles and long-range chances becomes a real moment of the same kind, with the real 4 s build-up. A <b>Real moments page</b> marks each moment Use in game, Don&rsquo;t use or Automatic. Raw downloads are deleted after use (1.2 GB for this build).')],
            bars(bar('Matches', 2104, 1983, 2200, '2,104', '1,983'),
                 bar('Fully real moments', 702, 926, 1000, '702', '926'),
                 bar('Real goals', 67, 93, 100, '67', '93'),
                 note='Tested over 120 matches: 24.5% of chances served as a real moment, the right kind 100% of the time. A moment marked &ldquo;Don&rsquo;t use&rdquo; was served 0 times in 400.') +
            p.figs([f('0.67', 'b3-02-settings-two-switches-390.jpg', '<b>Look at:</b> Real moment highlights, Off | On, under Full highlights rebuild.')]) +
            more('b3', 'It has a clip and the Real moments page.')),
    ]

    # ---- scene editor + 3D ----
    flow = steps([
        ('', '<b>The event.</b> 18 kinds (signed, scored, won a trophy, injured, dropped, sacked, record broken, debut, walk-out, press conference, award, promoted, relegated, retired&hellip;), plus a feeling (12, such as joy or shock) and how big the moment is.'),
        ('', '<b>The story.</b> It picks a place, a mood and who is in it. Then it acts: setup, build, moment, reaction, aftermath, from 25 &ldquo;beats&rdquo;.'),
        ('', '<b>The bodies.</b> Each beat adds moves for each person: clips from the animation library, plus poses worked out by code.'),
        ('', '<b>The camera.</b> Film rules pick the shots: open on the place, go closer as feelings rise, never cross the line, show the reaction after the moment. Then it scores itself.'),
        ('', '<b>The director.</b> It plays the script in 3D, in any art style, frame by frame.')])
    scores = bars(
        bar('Scored, joy (10.1 s, 7 shots)', None, 100, 100, '', '100%'),
        bar('Sacked, sadness (9.8 s, 5 shots)', None, 100, 100, '', '100%'),
        bar('Won a trophy, pride (7.5 s, 3 shots)', None, 100, 100, '', '100%'),
        bar('Injured, shock (6.5 s, 3 shots)', None, 91, 100, '', '91%', 'warn'),
        note='How well each made-up scene follows the film rules. Injured does not open on the place.')
    scene_add = [
        item('The 3D Signing and the Manager&rsquo;s Office play live in the scene editor', [T('Scene editor'), tag('seen')], [
            ('Problem / Why', 'You wanted to edit the 3D scenes without a coder. Steps 1 and 2 were already live: a free camera, a mini-map, the key light&rsquo;s angle and colour, and Save.'),
            ('Fix', '<b>Step 3a:</b> the 3D Signing and the Manager&rsquo;s Office now play live in the editor. You pick a shot and set its camera position and lens, the key light and the exposure. Play, Save and the shots fit on screen.')],
            p.figs([f('0.61h', 'se-signing.jpg', '<b>Look at:</b> Signing, with one shot edited.', 'wd'),
                    f('0.61h', 'se-office.jpg', '<b>Look at:</b> the Manager&rsquo;s Office, with one shot edited.', 'wd')], wide=True)),
        item('Shop, Garden and House edit live; approve an edit; commit it to the game; make a scene from an event', [build_pill('b6'), T('Scene editor'), tag('seen'), tag('meas')], [
            ('Problem', 'The edits did not reach the game. Save kept them on that device and in the team&rsquo;s database. They did <b>not</b> go into the repo, and the game&rsquo;s real cut scenes did not read them. You said: &ldquo;I would love it to commit straight into the game&rdquo; (3D-3).'),
            ('Why', 'The game keeps its own copy of approved edits as a file in its code. Nothing wrote to that file.'),
            ('Fix', '<ul><li>The <b>Shop, Garden and House</b> edit live like Signing and the Office. No edit means the scene plays exactly as before.</li>'
                    '<li><b>&#10003; Approve</b>, then choose <b>Where</b> (career, test page or both) and <b>When</b> (always, or one moment). The game reads only approved edits.</li>'
                    '<li><b>Commit to game</b> writes approved edits into the repo file on main. It needs an admin sign-in and a GITHUB_TOKEN. Each commit rebuilds the live site.</li>'
                    '<li>A <b>Scene generator</b> page in the Studio tab: pick an event (18) and a feeling (12), press Generate, mark it Good or Bad, or keep it as a hand-made scene.</li>'
                    '<li>&ldquo;<b>When does this play?</b>&rdquo;: 18 rows. <b>All 18 say Not wired.</b> You said (answer 31): &ldquo;I just don&rsquo;t know when they play and why, but we need to fix that.&rdquo;</li></ul>')],
            bars(bar('Office test camera, before and after an approved edit (degrees)', 44, 19.4, 50, '44&deg;', '19.4&deg; (a 70 mm lens)'),
                 note='Measured: an approved office edit moved the office test camera. It was reverted after the test.') +
            p.figs([f('0.70', '06-approve-where-when-commit-1440.jpg', '<b>Look at:</b> the green APPROVED line, the Where ticks, the When menu and the COMMIT TO GAME button.', 'wd')], wide=True) +
            more('b6', 'It has the scene generator, the 18-row table and the six framed pages.')),
        item('The 3D audit, and what B5 fixed from it', [build_pill('b5'), T('3D'), tag('seen'), tag('meas')], [
            ('Problem', 'The 19 Oct audit, from 52 stills at phone size: skin turns yellow in cut scenes. 14 of 23 shots are framed for a wide screen and too tight on a phone. Faces never move. The home player stands stiffly. Props are held badly. The rooms are placeholders.'),
            ('Why', 'The models are mostly fine. The <b>light, the cameras and the poses</b> make it look cheap. Skin went yellow because the film-style tone mapping runs out of red first, and the warm colour grade added yellow on top.'),
            ('Fix', 'A 10-phase plan, and you said go on phases 1 to 5 (&ldquo;Fixing skin and light is very big&rdquo;). B5 built them overnight: a bench page, natural skin, phone cameras that clear people, faces that blink and talk, and a Home player who is alive. The full audit is the &ldquo;3D audit and plan&rdquo; page: ' + lnk('audit3d', 'open it') + '.')],
            bars(bar('Signing: skin that is yellow', 94, 0, 100, '94%', '0%'),
                 bar('Press: skin that is yellow', 94, 0.2, 100, '94%', '0.2%'),
                 bar('Walk-out: skin that is yellow', 61, 0, 100, '61%', '0%'),
                 note='&ldquo;Yellow&rdquo; means skin past 36 degrees. Real player skin sits at 23 to 31 degrees. Grey is before (19 Oct). Colour is after.') +
            p.figs([f('0.69', 'bench-signing-before.jpg', '<b>Before (19 Oct):</b> the signing scene. Yellow skin.'),
                    f('0.69', 'bench-signing-after.jpg', '<b>After:</b> the same shot. Natural brown skin.')], pair=True) +
            more('b5', 'It has two clips and every before and after.')),
    ]
    scene_chg = []
    explain = item('How generated cut scenes work', [T('Scene editor'), tag('seen')], [
        ('Problem / Why', 'You asked how the &ldquo;made-up scenes&rdquo; work. This is the answer.'),
        ('Fix', '<b>Hand-made (6):</b> signing, goal, trophy, walk-out, press and The Icon. Every move and shot is written by hand. They are the benchmark. <b>Generated:</b> made by the game from a <b>game event</b>, with nothing pre-built. The same event and the same number (the &ldquo;seed&rdquo;) always give the same scene. <b>The real game does not play generated scenes yet.</b> Five steps:' + flow)],
        scores +
        p.figs([f('0.61h', 'gen-scored.jpg', '<b>Scored:</b> the keeper&rsquo;s view, the celebration, then a close-up far too tight for a phone.'),
                f('0.61h', 'gen-sacked.jpg', '<b>Sacked:</b> the office, &ldquo;You&rsquo;re not in the side on Saturday&rdquo;, alone with it.')]) +
        details('More pictures (2) and why bodies break', p.figs([f('0.61h', 'gen-trophy.jpg', '<b>Won a trophy.</b>'), f('0.61h', 'gen-injured.jpg', '<b>Injured:</b> he is smiling, because faces never moved then (B5 fixed that).')]) +
                '<p><b>Why bodies break</b> (reasoned from the code and the audit stills, not measured):</p><ul><li>A beat joins clips from different sources end to end, and code-made poses bend joints on top. When the two disagree, a shoulder twists or a boot floats.</li><li>Walks move the body at a set speed that does not match the steps, so the feet slide.</li><li>The people in them are a stand-in layer. A proper people layer (faces, hands, planted feet) plugs in at one place when it is ready.</li></ul>'))


    fixed = section('fix', 'FIXED', fixed_items[:3] + [touch] + fixed_items[3:])
    add = section('add', 'ADDED', hl_add + data_add + scene_add + [explain])
    chg = section('chg', 'CHANGED', hl_chg)

    bug = section('bug', 'KNOWN ISSUES', [
        item('The drift audit did not drive every screen', [T('Play screens'), tag('no')], [
            ('Problem', 'Not driven end to end: the other Full match layout (&ldquo;TV broadcast&rdquo;), the 3D and radar views of the 90-minute test, the gallery&rsquo;s 5-a-side and Tuning tabs, and the &ldquo;Ours vs real&rdquo; tab.'),
            ('Why', 'They mount the same play box or no match, so no new drift was expected.'),
            ('Status', 'Not measured. A real iPhone was not used either: the sizes are layout numbers, not feel.')]),
        item('A generated build-up has not played in a real career match', [T('Highlights rebuild'), tag('no')], [
            ('Problem', 'Build-ups were seen on the test page and in the real match through the test page. Extra defenders running in during a build-up are not built yet.'),
            ('Why', 'Phase 2 sits behind the switch, which is Off by default.'),
            ('Status', 'Phase 3 (B2) is the next step.')]),
        item('4 of the 10 SoccerTrack v2 matches are missing', [build_pill('b3'), T('Free data'), tag('meas')], [
            ('Problem', 'Only 6 of the 10 matches loaded.'),
            ('Why', 'Google Drive refused the other 4.'),
            ('Status', 'Re-run later. Also: a Real moment was seen in Infinite Match, but not inside a career match.')]),
        item('No generated scene plays in the career, and no real commit was seen', [build_pill('b6'), T('Scene editor'), tag('no')], [
            ('Problem', 'All 18 &ldquo;When does this play?&rdquo; rows say Not wired. A real Commit to game was not seen. An approved edit playing in a real career was not seen.'),
            ('Why', 'You said generated scenes can go in the game for the moments that suit them. Nothing is wired until you pick. The test machine has no GITHUB_TOKEN.'),
            ('Status', 'Waiting on you (below).')]),
    ])

    nxt = section('nxt', 'NEXT', [
        item('Where the highlights rebuild is', [T('Highlights rebuild')], [
            ('Status', 'Three phases are done. Phase 3 is the next build (B2). The red engine warning will ask when it starts. B10 (headers and volleys), B14 (running after a chance) and B17 (a PC match layout) have no report yet: see the index&rsquo;s Still building list.')],
            path),
    ])

    rules = details('House rules added in these two days (from the git log)',
        '<ul><li><b>Play controls never sit below the fold.</b> (A house-style ruling, 19 Oct.)</li>'
        '<li><b>A new admin page must use the frame.</b> The build stops the deploy if it does not.</li>'
        '<li><b>The engine and drift warning is red and asks every time.</b> It never blocks.</li>'
        '<li><b>No forced new chat.</b> A nudge every 3 hours instead (20 Oct).</li>'
        '<li><b>Delete raw downloaded data after use.</b> The rule is in data/opendata/README.md.</li>'
        '<li><b>Check artifact pages at 390 px.</b> Grid children get min-width 0 (18 Oct).</li></ul>') + \
        details('Also shipped, covered on Mikey&rsquo;s own page',
        '<p>Mikey&rsquo;s transfer window fixes of 19 Oct are on ' + lnk('mikey17', 'his v0.17 page') + ' (v0.59): the transfer fee is priced by your league (a non-league striker no longer shows &#9733;406m), the window shows next season&rsquo;s leagues with promoted and relegated clubs marked, and talks are in weekly wages. Commit titles only; not seen here.</p>')

    numbers = (
        '<p><b>Pitch width on a phone</b> (grey before, colour after), 8 screens to the real match&rsquo;s 366 px.</p>' + phone_bars +
        '<p><b>Highlights rebuild.</b> Over 500 matches: 5.81 chances and 2.31 goals, the same On and Off. 2,527 build-ups made, 2,197 took different routes, median 6.4 s, top speed 8.7 m/s, 0 of 448 failed the checks, 48 checked by eye. The still: 0 mismatches in 100.</p>'
        '<p><b>Free data.</b> Matches by source: Wyscout 1,941, Afriskaut 136 (removed), SkillCorner 20, IDSSE / DFL 7. 702 real moments (581 shots, 121 corners), 2,875 real shots, 232 Real Goals levels. After B3: 1,983 matches, 926 fully real moments, 93 real goals.</p>'
        '<p><b>Scene editor.</b> Made-up scenes (film-rules score): Scored 100%, Sacked 100%, Won trophy 100%, Injured 91%. Length 6.5 to 10.1 s. 3 to 7 shots each. An approved office edit moved the test camera from 44&deg; to 19.4&deg;.</p>'
        '<p><b>3D audit.</b> 52 stills. 14 of 23 shots too tight on a phone. Skin that is yellow: signing 94% &rarr; 0%, press 94% &rarr; 0.2%, walk-out 61% &rarr; 0%.</p>'
        '<p><b>Touch check.</b> 27 found: 10 in the real game, 9 on test pages, 5 on the website, 3 in the admin.</p>')

    return p, dict(
        key='t84', ver='0.84', title='Everything Else', pill='EVERYTHING ELSE &middot; 19&ndash;20 OCT',
        headline='Every football screen now draws the pitch at the real match&rsquo;s size, the engine warning is red, and the highlights rebuild, the free data and the scene editor moved on.',
        sub='19&ndash;20 Oct 2026. What is not on the team page or the admin page, and not a build of its own: the play screens and the drift audit, the highlights rebuild phases 0 to 2, the free data, the scene editor and the 3D audit. Short sections point to the builds that carried each topic on.',
        status='The 19 Oct work is on main (PR #744). The parts from 20 Oct (the touch fixes, the data credits and Real moment highlights, the scene studio, the 3D looks, the engine-warning fix) are on the Harry branch, not live.',
        footer=FOOT, videos_label='(none planned)',
        checks=[
            ('Play screens: Full match on a phone', 'Your chance: the pitch is 366 px wide (it was 340).'),
            ('Play screens: Training drills on a phone', 'The pitch is 366 px wide (it was 346).'),
            ('Play screens: Infinite Highlights on a phone', 'NEXT and the chance name stay on screen without scrolling.'),
            ('Play screens: Real moments, Goal videos, Visual effects lab, Real shots', 'Each pitch is 366 px on a phone. None scrolls sideways.'),
            ('The red warning', 'When Claude is about to edit a drift file, the Allow box shows the red notice. A read-only search does not ask.'),
            ('Touch: negotiation', 'Sign a player and open the talks. One tap on &minus; or + moves your offer one step.'),
            ('Highlights rebuild: the switch', 'Settings &rarr; Harry changes: &ldquo;Full highlights rebuild: Off | On (test)&rdquo;. Off by default.'),
            ('Highlights rebuild: the still', 'Switch On, Infinite Highlights: the still looks like the match. Press Play: the frame does not jump.'),
            ('Highlights rebuild: a build-up', 'On /star-fhr-dev press &ldquo;Generate another&rdquo; a few times. Each build-up should look like real football.'),
            ('Free data: three pages', 'Real moments (tap a moment, then Play), Real shots (the shot map), Real Goals (232 levels).'),
            ('Free data: Settings', 'Settings &rarr; More &rarr; Data credits: 8 lines. Settings &rarr; Full highlights rebuild: Real moment highlights, Off | On.'),
            ('Scene editor', 'Open the 3D Scene editor. Pick Signing, Office, Shop, Garden or House. Move the camera, the lens, the light. Press Approve, pick Where and When.'),
            ('Scene generator', 'Studio tab &rarr; Scene generator. Pick Scored and Joy. Press Generate. 18 rows say Not wired.')],
        sections=[fixed, add, chg, bug, nxt, '<h2 class="nxt"><i></i>HOUSE RULES AND OTHER</h2>' + rules], numbers=numbers,
        videos_coming=False,
        videos='<b>No clip is planned for this page.</b><p>These are sizes, switches and stills. B3, B5 and B6 have their own clips and stills on their pages.</p><ul><li>' + lnk('b3', 'B3 Real Data') + ' has a clip of a real moment in Infinite Match.</li><li>' + lnk('b5', 'B5 3D Looks') + ' has two clips (the mentor scene and the Home player).</li></ul>',
        seen=dict(
            seen=['Pitch widths on 15 screens at 390 and 1440 px (layout measurements in Chromium)', 'The play buttons staying on screen on three screens', 'The switch and the ruler on /star-fhr-dev; the still and the frame after Play; 8 build-ups from the sheet',
                  'Real moments, Real shots and Real Goals on the new data (stills from the build)', 'Data credits, the two switches, the Real moments page (B3)', 'The editor on Signing and the office, and the Shop, Garden and House; the Approve panel; the &ldquo;no token&rdquo; message (B6)',
                  'Four generated scenes (scored, sacked, trophy, injured) on the test pages; before and after skin on the bench page (B5)', 'Six touch fixes on a touch phone (B1)'],
            meas=['Widths before and after for 8 screens (see the bars)', '0 mismatches in 100 (the still); 500 matches: chances and goals unchanged (5.81 and 2.31); 2,197 of 2,527 build-ups took different routes; 0 of 448 failed the checks',
                  '2,104 matches by source; 702 real moments; 2,875 real shots; 232 Real Goals levels; then 1,983 matches and 926 real moments (B3)', 'Film-rules scores of four generated scenes: 100, 100, 100, 91', 'The 3D audit: 14 of 23 shots too tight on a phone; skin that is yellow 94% &rarr; 0% (B5)', 'An approved office edit moved the test camera 44&deg; &rarr; 19.4&deg; (B6)'],
            reas=['The touch check: read from the code, not played', 'The red warning is shown by the code and the commit, not by a screen: it appears in the Allow box inside a Claude session', 'Why bodies break in generated scenes', 'The small website fixes and the signing fallback: from the commit titles'],
            no=['A real iPhone (this machine has no graphics chip)', 'How a kick feels after the size fix', 'A generated build-up inside a real career match (test page only)', 'A real Commit to game into the repo (no token on the test machine)', 'Any generated scene playing in the career (none is wired)', 'A real moment inside a career match']),
        ok=[
            dict(who='Your call', q='Which generated cut scenes should play in the career first, and is GITHUB_TOKEN set on the live site?', opts=[('pick rows', 'p-amb')],
                 d='All 18 rows say Not wired. Commit to game needs the token. Each commit rebuilds the live site. B6 page, Needs your OK.'),
            dict(who='Your call', q='Judge the walk-out wide shot on your phone.', opts=[('fine', 'p-grn'), ('fix it', 'p-amb')],
                 d='Away players still pass about 1 m from the lens in the walk-out wide shot. It is the same as before B5. B5 page, Needs your OK.'),
            dict(who='For Mikey', q='Run star_real_moments_picks.sql', opts=[('database file', 'p-amb')],
                 d='Until it runs, a Real moments mark stays on that device only and the page says so. Commit still works (needs GITHUB_TOKEN). B3 page.'),
            dict(q='Make the engine and drift warning impossible to miss?', by='Harry, 19 Oct', done='Yes, answer 9. Done on 19 Oct.'),
            dict(q='When the touch check comes back, fix everything it finds without asking item by item?', by='Harry, 19 Oct', done='Yes: fix all, and show stills. Built in B1.'),
            dict(q='B2 (highlights phase 3) and B10 (headers and volleys) edit match files. Engine OK?', by='Harry, 20 Oct', done='Yes. Run one at a time; B14 after. No report yet. The red warning still asks on every edit. Press Allow only when the build needs it.'),
            dict(q='FHR-1: go on phase 3?', by='Harry, 19 Oct', done='Go. Players already moving; an engine change behind the switch; the red guard will ask.'),
            dict(q='FHR-2: carry on into the 22-player model?', by='Harry, 19 Oct', done='Decide later. Ask again after phase 3.'),
            dict(q='FHR-3: extra defenders running in?', by='Harry, 19 Oct', done='Yes, if it makes sense for one to come in from off screen.'),
            dict(q='FHR-4: every open-play chance gets a build-up?', by='Harry, 19 Oct', done='Yes. Some set pieces and penalties can show the foul that won them.'),
            dict(q='The switch: who sees it, and where?', by='Harry, 19 Oct', done='No own admin page and no ruler card. Just a toggle, in Settings and in the settings before a match, with a small &ldquo;?&rdquo; that explains it. Show it to everyone for now.'),
            dict(q='Build-ups in the test areas, and the gallery?', by='Harry, 19 Oct', done='Infinite Highlights and Infinite Match must play build-ups. Generated build-ups must <b>never</b> write over Mikey&rsquo;s hand-checked scenarios. In a final, a longer build-up in the 90th minute; a 90th-minute winner goes to a celebration and the trophy lift.'),
            dict(q='More than 2,104 matches, and remove Afriskaut?', by='Harry, 19 Oct', done='Yes: more tracking data, and remove Afriskaut (&ldquo;no one&rsquo;s heard of them&rdquo;). Built in B3.'),
            dict(q='DATA-1: where do the credit lines go?', by='Harry, 19 Oct', done='Settings is fine. Built in B3 (Settings &rarr; More &rarr; Data credits).'),
            dict(q='DATA-2: should real moments feed the real game?', by='Harry, 19 Oct', done='Try it, inside the highlights switch as another toggle, &ldquo;Real moment highlights&rdquo;. Built in B3. Keep.'),
            dict(q='A-6: one Play button on Real moments?', by='Harry, 19 Oct', done='Keep. Real shots shot map: &ldquo;pretty cool&rdquo;.'),
            dict(q='Delete raw downloaded data after use?', by='Harry, 20 Oct', done='Done for B3&rsquo;s 1.2 GB. The rule is in data/opendata/README.md.'),
            dict(q='3D plan: go on phases 1 to 5?', by='Harry, 19 Oct', done='Liked. &ldquo;Fixing skin and light is very big.&rdquo; Go on phases 1 to 5 (built in B5). Home player: natural, energetic poses; eyes blink and look around; lips move when talking; holds things properly.'),
            dict(q='Blender on the cloud machine?', by='Harry, 19 Oct', done='Install it whenever it is needed.'),
            dict(q='3D-3, 3D-4, 3D-5: where do edits save, and what next?', by='Harry, 19 Oct', done='&ldquo;I would love it to commit straight into the game.&rdquo; An Approve button: approved edits are used in the game and stay editable; you choose when and where. Step 3b (shop, garden, house) first. Built in B6.'),
            dict(q='3D-6: Higgsfield?', by='Harry, 19 Oct', done='On for now. Always say what is being made there, and delete the images and videos after use.'),
            dict(q='GEN-1 and GEN-3: the Scene generator?', by='Harry, 19 Oct', done='Build it as its own admin page in the Studio tab (built in B6). Generated scenes can go in the game if they are good, for the moments that suit them.'),
            dict(q='In-match mute, TOUCH and Power buttons: resize in the match file?', by='Harry, 20 Oct', done='Yes. Done: size only, no game logic.')]
    )
