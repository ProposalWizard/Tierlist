#!/usr/bin/env python3
"""v0.21 UI & Home page. python3 build21.py -> page/index.html (+ img/, clips/)"""
import os, shutil, json, html
from PIL import Image
S = "/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/"
D = S + "uihome/page/"
FILM = S + "v021/film/"
KF = "/home/user/Tierlist/playtest-notes/uihome-1001/keyframes/"
MT = S + "mikeytab/page/"
# reuse v0.20 generator pieces (HEAD, CSS, helpers)
src = open(MT + "build.py").read()
src = src[: src.index("AREAS = json.load")]
src = src.replace('D = os.path.dirname(os.path.abspath(__file__)) + "/"', f'D = "{D}"').replace('MT = os.path.dirname(D.rstrip("/")) + "/"', f'MT = "{S}mikeytab/"').replace('KF = "/home/user', 'KF0 = "/home/user')
ns = {"__file__": D + "build.py"}; exec(src, ns)
HEAD = ns["HEAD"].replace("Mikey v0.20 · Harry's review", "v0.21 · UI &amp; Home")
EXTRA_CSS, CSS, det, h2, img, pane = ns["EXTRA_CSS"], ns["CSS"], ns["det"], ns["h2"], ns["img"], ns["pane"]
ns["FILM"] = FILM  # pane()/clip()/still() read FILM from their globals
for d in ("img", "clips"):
    shutil.rmtree(D + d, ignore_errors=True); os.makedirs(D + d)

CSS2 = """<style>
.dq .df{display:block;margin-top:5px;color:var(--ink);font-weight:700;font-size:14px}
.dq .df i{font-style:normal;color:var(--green);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;margin-right:6px}
.dq .nn{color:var(--ink3);margin-right:6px;font-variant-numeric:tabular-nums}
.pt{margin:8px 0 0;font-size:14px;color:var(--ink2);border-left:3px solid var(--blue);padding:3px 0 3px 10px}
.pt b{color:var(--blue);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-right:5px}
.mc{border-top:1px solid var(--line);padding:16px 0 4px}
.mc .look{font-size:15px;color:var(--ink);background:var(--card2);border-radius:10px;padding:9px 12px}.mc .look b{color:var(--green);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-right:6px}
.mc h4{margin:0 0 4px;font-size:17px}
.mc .w{margin:0 0 6px;color:var(--ink2);font-size:15px}
.mc .spd{margin-top:8px}
.mc video{display:block;width:100%;max-height:80vh;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:#05070d}
.res{display:inline-block;font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:4px 7px;border-radius:999px;margin-left:6px;vertical-align:2px}
.res.ok{background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)}
.res.open{background:color-mix(in srgb,var(--amber) 18%,transparent);color:var(--amber)}
.nss{background:var(--card2);border-radius:12px;padding:12px 14px;margin:12px 0}
ul.rv{margin:6px 0 0;padding:0;list-style:none}
ul.rv li{padding:9px 0;border-bottom:1px solid var(--line)} ul.rv li:last-child{border-bottom:0}
ul.rv b.t{display:block;color:var(--ink)} ul.rv .w{display:block;color:var(--ink2);font-size:14.5px;margin-top:2px}
ul.pts2{list-style:none;margin:6px 0 0;padding:0;font-size:14px;color:var(--ink2)}
ul.pts2 li{padding:4px 0;border-bottom:1px solid var(--line)} ul.pts2 li:last-child{border-bottom:0}
ul.pts2 .ts{font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:6px}
ul.pts2 .tg{font:800 10px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-right:5px}
.strip{grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:640px){.strip{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>"""

def jload(a, f): return json.load(open(FILM + a + "/" + f + ".json"))

# ---------- pointing lines (from playtest-notes/uihome-1001/pointing.md) ----------
POINT = {
 ("home", 1): "At 03:54 he circled the three panels under the player card (Next Match, KIB cans, Energy) and said together with the card they must fit with no scroll.",
 ("home", 2): "At 02:46 he swept the mouse to the left of the card (“put to the left”) and at 10:33 pointed to the top right for reputation and fame. That is why you are on the left and the four boxes on the right.",
 ("home", 3): "His mouse sat on the star-rating progress bar for 11 seconds (02:14–02:25) and at 03:13 he said “energy bar at the bottom here”, so the energy bar goes directly under the rating bar.",
 ("home", 4): "At 03:42 he swept along the Last 5 row and said “just D, D, W, not this whole thing”.",
 ("home", 5): "At 04:48 he pointed at the big YOUR MONEY panel on Shop, and at 04:52 at the top-right corner for the always-visible chip.",
 ("home", 6): "At 05:01 his hand pointer rested on the 3D/2D chip: “that’s taking up valuable space”.",
 ("screens", 1): "At 08:22 he pointed at the THIS WEEK / Energy / Rest block (“get rid”), at 08:41 at the Lifestyle block (“this is not relationships”) and at 08:48 at the manager card (“a bit too bubbly”).",
 ("screens", 2): "At 04:38 he was on the Phone screen asking “how do I get out of this?” and left by tapping Relations.",
 ("screens", 3): "At 14:12 his cursor was on the red dot of the bottom-bar Phone button. That settles which notification he meant.",
 ("screens", 5): "At 14:53 he pointed at the top right of the team sheet for a Kick Off button (not added, see your calls).",
 ("screens", 7): "At 07:40 he clicked the Premier League block on Stats and landed on the League table: the whole block is the button.",
 ("screens", 8): "At 05:22 his cursor was on the YOUR SHOP ITEMS box: delete it.",
 ("unlock", 5): "At 04:22 his hand pointer went across Training, Play and Relations: those are what start locked. At 05:47 he pointed at the figure, then the star pill, for the tutorial.",
 ("unlock", 6): "At 06:03 he swept the Pace / Power / Technique drill cards: “choose any of these”.",
 ("unlock", 7): "At 07:58 his hand pointer sat on the League button: Achievements takes that slot in the bottom bar.",
 ("unlock", 8): "At 12:00 he pointed at the Phone button: it stays locked and says “find out more in the future”.",
 ("unlock", 9): "At 12:54 he pointed at the Phone row marked OWNED L1, and at 13:01 at Back: buying it should land you on the Phone.",
 ("unlock", 10): "At 13:16 he walked along the phone apps: League, Shop, Store, Casino.",
}

def card(area, i, c, f):
    short = c.get("s") or c["w"]
    h = f'<article class="cx" id="{area}-{i}"><div class="cxh"><span class="n">{i}</span><h4>{c["t"]}</h4></div><p class="w">{short}</p>'
    look = c.get("look") or (f or {}).get("look")
    if look: h += f'<p class="look"><b>Look for</b>{look}</p>'
    if f:
        b, a = f.get("before"), f.get("after")
        if b and a: h += '<div class="seg"><button data-s="before">Before</button><button data-s="after" class="on">After</button></div>'
        h += '<div class="panes">' + pane(area, "before", b) + pane(area, "after", a) + "</div>"
    pt = POINT.get((area, i))
    if pt: h += f'<p class="pt"><b>He pointed</b>{pt}</p>'
    ev = f' <span class="evs">({c["ev"]})</span>' if c.get("ev") else ""
    pts = f' <span class="evs">Answers his points {c["pts"]}.</span>' if c.get("pts", "").startswith("P") else ""
    h += det("The detail", f'<p class="w2">{c["w"]}{ev}{pts}</p>')
    return h + "</article>"

def section(area, sid, title, lead, relabel=None):
    ch, mf = jload(area, "changes"), jload(area, "manifest")
    h = h2(sid, "c-g", title, lead)
    for i, c in enumerate(ch):
        f = mf[i]
        if relabel:
            f = json.loads(json.dumps(f))
        h += card(area, i + 1, c, f)
    return h

# ---------- merge clips ----------
def vclip(name, poster):
    shutil.copyfile(FILM + "merge/" + name, D + "clips/merge-" + name)
    p = img(FILM + "merge/" + poster, 780)
    return (f'<video src="clips/merge-{name}" poster="{p}" controls playsinline muted preload="none"></video>'
            '<div class="spd">Speed <button class="on" data-r="1">1×</button><button data-r="0.5">½×</button><button data-r="0.25">¼×</button>'
            f'<a href="{p}" target="_blank">Picture full size</a></div>')

def pics(files, caps):
    out = ""
    for f, c in zip(files, caps):
        p = img(FILM + "merge/" + f, 780)
        out += f'<figure style="margin:0"><a href="{p}" target="_blank"><img src="{p}" loading="lazy" alt=""></a><figcaption class="bcap">{c}</figcaption></figure>'
    return det(f"Pictures from this clip ({len(files)})", f'<div class="pics">{out}</div>')

MERGE = [
 ("A new career: Home and the tutorial", "A brand-new player lands on Home. The tutorial explains the player and star rating; only Home and Training are open, everything else is locked.", "Locked buttons in the bottom bar, and the tutorial card on top of Home.", "new-a-home.mp4", "chain-new-a1-home.jpg",
  [("chain-new-a1-home.jpg","Home, new career"),("chain-new-a2-tutorial.jpg","Tutorial"),("chain-new-a3-tutorial-last.jpg","Last tutorial card"),("chain-new-a4-training.jpg","Training, the one open door"),("chain-new-a5-locked-hint.jpg","A locked button says what opens it")]),
 ("Two drills open League and Play", "Do two training drills; the star rating moves and League and Play unlock.", "The “star rating improved” line after the second drill.", "new-b-drills.mp4", "chain-new-b1-after-drills.jpg",
  [("chain-new-b1-after-drills.jpg","After the two drills")]),
 ("League explained, first achievement", "The League is explained once, then the first achievement pops up and the Achievements slot appears on Home.", "The pop-up, then a new Achievements slot in the bottom bar.", "new-c-league.mp4", "chain-new-c1-league.jpg",
  [("chain-new-c1-league.jpg","League"),("chain-new-c2-achievement-pop.jpg","Achievement pop-up"),("chain-new-c3-home-achievements-slot.jpg","Achievements slot on Home"),("chain-new-c4-achievements.jpg","Achievements screen")]),
 ("Boss meeting opens Relations", "“Have a meeting with your boss” is the next achievement. Win it and Relations unlocks, at the new calmer values.", "Win gives +1 or +2, not +18; Relations then appears.", "new-d-boss.mp4", "chain-new-d1-boss-win.jpg",
  [("chain-new-d1-boss-win.jpg","Boss meeting won"),("chain-new-d2-relations.jpg","Relations, now open")]),
 ("Shop, Style, buying the phone", "The Shop is explained; Style is locked except the phone. Buying the phone sends you to the Phone.", "After the buy you land on the Phone, not back in Style.", "new-e-style-phone.mp4", "chain-new-e3-phone-sheet.jpg",
  [("chain-new-e1-shop.jpg","Shop"),("chain-new-e2-gadgets.jpg","Style, gadgets"),("chain-new-e3-phone-sheet.jpg","Buying the phone"),("chain-new-e4-after-buy.jpg","After the buy")]),
 ("The Phone and the App Store", "The Phone starts with League and Settings plus an App Store. Get the Casino there and it appears.", "Casino missing, then there after the GET.", "new-f-phone.mp4", "chain-new-f1-phone.jpg",
  [("chain-new-f1-phone.jpg","Phone"),("chain-new-f2-appstore.jpg","App Store"),("chain-new-f3-got-casino.jpg","Got the Casino"),("chain-new-f4-phone-with-casino.jpg","Phone with the Casino")]),
 ("An old save: everything open", "An existing career with everything already unlocked: no tutorial, nothing locked, every screen still there.", "No locks anywhere; Home still fits one screen.", "old-save.mp4", "old-1-home.jpg",
  [("old-1-home.jpg","Home"),("old-2-league.jpg","League"),("old-3-training.jpg","Training"),("old-4-relations.jpg","Relations"),("old-5-phone.jpg","Phone"),("old-6-shop.jpg","Shop"),("old-7-prematch.jpg","Pre-match")]),
]
def merge_html():
    h = h2("together", "c-v", "Everything together", "All the pieces merged into one build. Seven clips: a new career going through the whole unlock chain, then an old save with everything open. One clip is a few seconds to a minute; ½× helps.")
    h += '<p class="sub-h">A new career, step by step</p>'
    for i, (t, w, look, mp4, post, pic) in enumerate(MERGE):
        if i == 6: h += '<p class="sub-h">An old save</p>'
        h += (f'<article class="mc"><h4>{t}</h4><p class="w">{w}</p><p class="look" style="margin:0 0 10px"><b>Look for</b>{look}</p>' + vclip(mp4, post)
              + pics([p[0] for p in pic], [p[1] for p in pic]) + "</article>")
    return h

# ---------- Your calls ----------
IMPORTANT = [
 ("A new player sits on the bench at about half the clubs (9 of 20 in the Premier League, 12 of 24 in the Championship), because the manager now starts at 50.", "Keep 50, as you asked.", "Start him at 58, or lower the bar to start."),
 ("Existing careers: everything unlocked, no tutorial?", "Yes, only brand-new careers walk the chain.", "Make everyone do it."),
 ("Make Pitch the default look?", "No, Classic stays default until you have played Pitch.", "Pitch for everyone."),
 ("Should Play stay locked until the two drills?", "Yes, locked together with League.", "Leave Play always open."),
 ("Sponsors has no way in from Home now (the pill is gone, the Shop tile stays). Want one?", "No.", "A small red dot on the Shop tab when an offer waits, or the pill back on the Phone/Relations side."),
]
MORE = [
 ("Dressing-room card: you on the left, Reputation, Fame, Goals and Assists this season on the right. Right?", "Built that way.", "You in the middle with the numbers in the corners, or you centred with the numbers under you."),
 ("3D / 2D: Settings only, no switch on Home?", "Yes. It was already in Settings as Player look; default stays 3D.", "A small icon in the top bar."),
 ("Only the Basic can on Home; Premium and Elite stay in Shop, KIB Cans?", "Yes.", "A second tiny can button for each ability can you own."),
 ("With 0 Basic cans the button next to the energy bar says Buy and the price. Keep?", "Yes, one tap to buy.", "Always show Use greyed out, buy in Shop."),
 ("Tall phone (390×844) has 197 px spare under the card. Leave it empty?", "Empty (stretching the card left dead sky above you).", "A small league table there, or a bigger player."),
 ("Money chip in the top bar on every page except the Phone, and cash dropped from the Age strip. OK?", "Yes.", "Chip somewhere else."),
 ("Next-match line drops the crests and the cup name to fit 360 px phones. Want them back?", "Text only, club names in green, date, days, then the form letters.", "Crest on the opponent only."),
 ("Lifestyle unlock levels 4, 6, 8, 10, 15, 30: are those star-rating levels?", "Yes, star rating (1–100).", "Fame value, player level or item level."),
 ("Should the Achievements button replace League on old saves too?", "New careers only.", "Everyone."),
 ("Losing “Take a Break” or “Meet the Fans” also costs 8. Right for all five games?", "Same scale for all five.", "Boss meeting only."),
 ("Premium +30 and Elite +40 energy (Basic is 65). Right amounts?", "30 / 40.", "Give me numbers."),
 ("Should App Store apps cost money?", "Free GET for now.", "Priced."),
 ("Relations unlocks after any boss meeting, even a lost one?", "Yes, “have a meeting”.", "Only after a win."),
 ("Daily energy (5–6 a day): does it replace “energy only returns from Rest / Skip to Match Day”?", "Not built. The Rest-only rule stays.", "Replace the rule. This needs a yes or no from you."),
 ("Rest and the week bar left Relations. Rest still lives on Training > Life. Enough?", "Yes.", "Put a Rest button back."),
 ("Garden and horse were reached from the Lifestyle block. New home?", "None added; Garden is on the phone, horses in the Casino.", "A button somewhere."),
 ("Relationship effects not built yet: manager picks penalties/free kicks, team-mates pass you more, fans boo, happiness changes energy. They read “coming” on the page.", "Leave as “coming”.", "Tell me which to build first."),
 ("Sponsors line now says brands pay a weekly fee (the old “pays more every match” was not true). Posts and press events marked “coming”.", "As built.", "Build posts/press events."),
 ("Close phone goes Home, under the dock on the phone home screen.", "Home.", "Back to where you came from."),
 ("The red dot on the Phone button is gone, so a sponsor offer or new post no longer shows there (badges inside the phone stay).", "Removed.", "Keep a dot for offers only."),
 ("At 100% energy the pre-match screen also hides the “boots 3 left” pill. Warnings still show.", "As built.", "Show it."),
 ("A second Kick Off button top right?", "No, the pinned bottom button is always on screen.", "Add one top right too."),
 ("First seconds of a match: a “teams are out” card (both names in kit colours) instead of the empty black panel.", "That card.", "Something else."),
 ("Stats: Premier League block stays last and the whole card is the button.", "As built.", "Move it up."),
 ("Shop: the “My stuff” strip is gone; My stuff is a button on the Style page.", "As built.", "Bring a strip back."),
 ("Pitch: stripe strength.", "Subtle two-green stripes.", "Stronger, NSS-bright."),
 ("Pitch: display font everywhere or headings only?", "Capitals labels, headings, big numbers, nav.", "Headings only."),
 ("Pitch: the player card keeps its night-stadium art.", "Kept (a floodlit stadium is footbally).", "Swap to a daytime pitch."),
 ("Pitch: purple item colours (Elite can, Fake Faces button, fame bar, Store tile).", "Kept, they are the items’ own colours.", "Recolour to kit/green in Pitch."),
 ("Pitch: the site nav above the game (Sign in, Ro pill) is purple.", "Left alone, it is the whole site’s nav.", "Green it while on /star-dev."),
 ("Send the friend’s two phone screenshots (the “same on every phone” fix).", "Send them.", "Skip."),
]
def dqs(items, start=1):
    out = ""
    for k, (q, d, o) in enumerate(items, start):
        out += f'<div class="dq"><b><span class="nn">{k}</span>{q}</b><span class="df"><i>Default</i>{d}</span><span>Other: {o}</span></div>'
    return out
def calls_html():
    h = h2("calls", "c-d", "Your calls", f"{len(IMPORTANT)+len(MORE)} questions from the four builds, each already built on its default. Answer by number, one word is enough (“1 keep, 2 yes, 3 no”). The first five matter most.")
    h += dqs(IMPORTANT) + det(f"The other {len(MORE)} calls", dqs(MORE, len(IMPORTANT) + 1))
    return h

# ---------- review ----------
def kf(n, cap):
    p = img(KF + n, 780)
    return f'<figure class="solo"><a href="{p}" target="_blank"><img src="{p}" loading="lazy" alt=""></a><figcaption class="bcap">{cap}</figcaption></figure>'
def res(t, ok=True): return f'<span class="res {"ok" if ok else "open"}">{t}</span>'
CHECKED = [
 ("Boss meeting paid too much, and paid on a loss", res("Fixed"), "Lose was +4 always, win +12 to +18. Now lose −8, win +1 or +2.", kf("24-boss-meeting-memory-minigame-ran-out-of-tries.jpg", "Before: run out of tries and still “+4 boost for trying”.")),
 ("Starting relationship values were not 50", res("Fixed"), "Boss 60, team-mates 60, fans 40, sponsors 0. Now 50 / 50 / 50 / 45, reputation 0, fame 1.", kf("07-relations-screen-top.jpg", "Before: Relations top (a save that has played games).")),
 ("Achievements existed but had no screen", res("Built"), "A real list was tracked with no slot and no pop-up. There is now a pop-up and an Achievements slot.", kf("12-stats-records-tab.jpg", "Before: Records tab, nothing called Achievements.")),
 ("The Phone had no way out", res("Fixed"), "No back button on the Phone screen. There is now a Close phone button.", kf("08-phone-home-screen-apps.jpg", "Before: phone screen, no back or close.")),
]
CLASH = [
 ("3D / 2D button", res("Resolved"), "Wanted off Home. It is now Settings only (Player look)."),
 ("Sponsors pill adds another chip to Home", res("Resolved"), "Pill is off Home; the Shop tile stays. Still one call: do you want a way in? (your call 5)"),
 ("“Your shop items” replaced, not deleted", res("Resolved"), "The strip is gone; My stuff is a button on the Style page."),
 ("Energy: the 31 Aug Rest-only rule vs “5–6 a day”", res("Still open", False), "Not built. Needs your yes or no (your call 30 in the list, “Daily energy”)."),
 ("Stats: Premier League block to the bottom", res("No clash"), "Matched what he asked; the whole card is now the button to League."),
]
WS = [
 ("Home on one screen", "Cans and energy needed a scroll. Built in the Home section.", [("01:25","CHANGE","Cans and energy need a scroll. “Don’t love it.”"),("01:51","CHANGE","Energy bar moves up onto the top part of Home. Pointing put it under the star-rating bar."),("02:29","CHANGE","Remove the “h b” name under the player."),("02:59","CHANGE","Player card: age, star rating with bar, energy bar under it."),("03:14","CHANGE","A small can with a Use button next to the energy bar."),("03:26","CHANGE","Next match: one thin line, form as “D D W”."),("03:49","CHANGE","Everything fits without scrolling."),("04:43","CHANGE","Money as a small chip, always visible. Replaces YOUR MONEY on Shop."),("04:58","CHANGE","3D/2D off Home."),("04:02","IDEA","Celebration animations on Home (later)."),("01:43","IDEA","Premium and Elite cans give energy too (built in the unlock build).")]),
 ("Same screen on every phone", "A friend could not see the settings bar. Needs his two screenshots.", [("00:48","BUG","Friend: could not see the settings bar; game looked different."),("--","NOTE","Home now tested at 360×640, 375×667, 390×844. 430×932 and an old save not separately measured.")]),
 ("Team sheet and Kick Off", "Kick Off was under the pitch and needed a scroll.", [("14:17","CHANGE","At 100% energy hide the KIB cans on pre-match."),("14:33","CHANGE","The flow “doesn’t feel great”. He does not say why."),("14:40","BUG","Kick Off needs a scroll: keep it always visible."),("14:59","BUG","Empty black KICK OFF panel for about 2 seconds.")]),
 ("Relations", "Too much going on and too bubbly.", [("08:19","CHANGE","Remove This Week and Energy/Rest. Start at about 50/50/50, you 45, reputation 0, fame 1."),("08:40","CHANGE","Remove the Lifestyle / Garden / horse block."),("08:46","CHANGE","Less bubbly, clearer."),("11:20","BUG","Failing the boss meeting gave +4. Should be about −8; wins +1, max +2."),("09:01","IDEA","What each relationship does: manager picks you, team-mates pass, fans boo, sponsors pay, happiness helps energy. Not decided.")]),
 ("Unlock chain, tutorial, achievements", "Start almost everything locked and open it step by step.", [("05:35","IDEA","Tutorial on Home; everything locked except training."),("05:52","IDEA","Two forced drills, then “your star rating has improved”."),("06:30","IDEA","League unlocks after training."),("06:51","IDEA","Shop unlocks next, each item explained."),("07:44","IDEA","Achievements slot in the bottom bar and a pop-up."),("11:03","IDEA","First Relations achievement: have a meeting with your boss."),("12:26","CHANGE","Lifestyle locked except the phone; others at levels 4, 6, 8, 10, 15, 30."),("12:45","IDEA","Buying a phone sends you Home and unlocks the Phone.")]),
 ("Phone", "Starts nearly empty, gains apps from an App Store, no longer a dead end.", [("04:21","BUG","No back or close button."),("13:09","CHANGE","Starts with League and Settings plus an App Store."),("13:09","CHANGE","Messages needs a big revamp (not done)."),("14:11","CHANGE","“This notification thing has got to go”: the red dot on the Phone button (pointing).")]),
 ("Smaller ideas", "Parked.", [("00:27","CHANGE","Spin system on the title-screen player (pointing, likely)."),("02:59","LIKE","He likes the Home UI, the Stats sub-tabs and Settings.")]),
]
UNCLEAR = [
 ("Where “energy bar somewhere here” lands (01:59).", "Settled by pointing: under the rating bar."),
 ("Where reputation and fame go (10:30).", "Settled by pointing: top right of the card."),
 ("Which notification has “got to go” (14:11).", "Settled by pointing: the red dot on the Phone button."),
 ("Whether Achievements replaces the League slot.", "Settled by pointing (07:58): it does."),
 ("Where the spin goes: title screen or trial (00:35).", "Likely the title-screen player. Not built."),
 ("Which can the small Use button is for (03:14).", "Pointing says the Basic can."),
 ("Which “level” the Lifestyle numbers are.", "See \u201cLifestyle unlock levels\u201d in your calls."),
 ("“One-shot button” (12:20), probably “one shop button” merging Store into Shop.", "Not built, still unclear."),
 ("Garbled line at 05:02 about Chelsea v Coventry form.", "Not resolved."),
 ("No gameplay points; he says so at 15:07. The friend’s two screenshots are not in the video.", "Still missing."),
]
def review_html():
    h = h2("review", "c-v", "His review, condensed", "From his recording “Full ui:home flow review” (15:16, 30 Sep): 43 points. What the builds settled is marked.")
    h += '<p class="sub-h">Checked in the game</p><ul class="rv">'
    for t, r, w, pic in CHECKED: h += f'<li><b class="t">{t}{r}</b><span class="w">{w}</span>{pic}</li>'
    h += "</ul>"
    h += '<p class="sub-h">Clashes with the v0.20 test copies</p><ul class="rv">'
    for t, r, w in CLASH: h += f'<li><b class="t">{t}{r}</b><span class="w">{w}</span></li>'
    h += "</ul>"
    h += '<p class="sub-h">His points, by workstream</p>'
    for t, line, pts in WS:
        body = '<ul class="pts2">' + "".join(f'<li><span class="ts">{a}</span><span class="tg">{b}</span>{c}</li>' for a, b, c in pts) + "</ul>"
        h += det(f"{t} ({len(pts)})", f'<p class="w2" style="margin:6px 0 0;color:var(--ink2)">{line}</p>' + body)
    h += '<p class="sub-h" id="unclear">Not clear from the recording</p>' + det(f"Ten things not to guess ({len(UNCLEAR)})", '<ul class="rv">' + "".join(f'<li><b class="t" style="font-weight:600">{a}</b><span class="w">{b}</span></li>' for a, b in UNCLEAR) + "</ul>")
    return h

NSS = ("<b>What makes New Star Soccer feel like football.</b> The menus sit on grass: mown stripes in two greens instead of a dark gradient, so the eye reads “football” before a word. Panels are flat and outlined with thin chalk-white lines, not glowing glass. Your club’s colours do the highlighting, not a house purple. Names, numbers and headings are in tall heavy capitals, like a matchday programme. Reasoned from store pages and reviews, not measured; the store screenshots could not be viewed here.")
NSS_MORE = ["Purple/navy page gradients become striped pitch green with a floodlight vignette.","Glass cards become deep-green panels with a chalk-white edge.","Accents stay club-kit colours (already how the game themes itself).","Headings, big numbers and nav labels use Anton, a condensed face the site already loads.","Layout, animations and sizes are untouched."]

# ---------- assemble ----------
P = []
P.append('<header><span class="ver">v0.21 · UI &amp; Home</span><span class="status">Harry’s review + every change built from it</span>'
 '<h1>Harry’s UI &amp; Home review, and the changes on video</h1>'
 '<p class="sub"><b>Home now fits one screen with no scrolling on three phone sizes; new careers unlock the game step by step; and there is a green “Pitch” look to try.</b> Every change below has a before and an after clip of the real game on a phone-sized screen. Nothing is live.</p></header>')
P.append('<div class="strip">'
 '<div><b>105 → 0 px</b><span>Home scroll at 390×844 (197 px spare)</span></div>'
 '<div><b>282 → 0 px</b><span>Home scroll at 375×667 (20 px spare)</span></div>'
 '<div><b>309 → 0 px</b><span>Home scroll at 360×640 (8 px spare)</span></div>'
 '<div><b>138 → 0 px</b><span>Kick Off scroll on the team sheet</span></div>'
 '<div><b>+18 → +2</b><span>Boss meeting win, the most you can now get</span></div>'
 '<div><b>+4 → −8</b><span>Boss meeting loss</span></div></div>')
P.append('<nav class="toc"><a href="#calls">Your calls</a><a href="#together">Everything together</a><a href="#home">Home</a><a href="#screens">Screens</a><a href="#unlock">Unlock chain</a><a href="#pitch">Pitch look</a><a href="#review">His review</a></nav>')
P.append(calls_html())
P.append(merge_html())
P.append(section("home", "home", "Home on one screen", "Seven changes, same save, same taps. Switch Before / After under each clip; ½× and ¼× slow it down."))
P.append(section("screens", "screens", "Screens: Relations, phone, pre-match, Kick Off, stats, shop", "Eight changes from the rest of his walk-through."))
P.append(section("unlock", "unlock", "Unlock chain and relationship numbers", "A new career starts almost everything locked and opens it step by step. Before = the old game, After = the new one."))
P.append(section("pitch", "pitch", "Pitch look", "A second look for the whole game, switched in Settings. Before = Classic (today), After = Pitch, same save, same taps.")
         .replace('</p><article', f'</p><div class="nss"><p style="margin:0">{NSS}</p>' + det("The seven points", '<ul class="plain">' + "".join(f"<li>{x}</li>" for x in NSS_MORE) + "</ul>") + '</div><article', 1))
P.append(review_html())
P.append('<footer>v0.21 · UI &amp; Home · built 1 Oct 2026 in test copies (branches harry-test-v021-*), all on top of the v0.20 changes. Nothing on this page is live; each part goes in only once you say yes.</footer>')

page = HEAD + EXTRA_CSS + CSS + CSS2 + '<div class="wrap">' + "\n".join(P) + "</div>"
page += open(MT + "build.py").read().split('page += """')[1].split('"""')[0].join(["", ""]) if False else ""
js = open(MT + "build.py").read().split('page += """')[1].split('"""')[0]
page += js
open(D + "index.html", "w").write(page)
n = sum(len(f) for _, _, f in os.walk(D + "img")) + sum(len(f) for _, _, f in os.walk(D + "clips")) + 1
print("files", n, "img", len(os.listdir(D + "img")), "clips", len(os.listdir(D + "clips")))
