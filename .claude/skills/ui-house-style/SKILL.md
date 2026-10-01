---
name: ui-house-style
description: The house UI rules for Knowitball, kept as a living record of what Harry and Mikey have actually said about screens. Load BEFORE building or changing any screen, panel, card, gallery or dev tool — and after they give visual feedback, WRITE THE RULING INTO THIS FILE so it never has to be said twice. Triggers on any work touching components/star/**, app/star-*/**, app/admin/**, or any request phrased as "make it nicer", "too much text", "that looks wrong", "Appleified", "simplify the page".
---

# House UI style

Neither Harry nor Mikey writes code. Every screen is judged **by looking at it on a
phone**. This file is the accumulated record of what they have ruled, so the same
correction is never needed twice.

## How this file updates itself

**This is the point of the skill.** Whenever they give feedback on a screen:

1. Make the change they asked for.
2. **Immediately add a line to "The rulings" below**, in their own words where
   possible, with the date and — if there is one — the number that proves it.
3. If the new ruling contradicts an older one, do not delete the old line.
   Strike it and say what replaced it. The history is why a rule exists.
4. If a ruling was inferred rather than stated outright, mark it `(inferred)` so
   a future session knows it is weaker than a direct quote.

A ruling with no number is still a ruling. A ruling with a number is stronger.

## Before you build

- **Screenshot the current state first**, at 390x844, and get the full-page pixel
  height. That number is the before. You will need it.
- **Show work in progress, not just the finished thing.** Stated directly,
  21 Sep 2026: *"Show me screenshots also while you're going, of changes. Don't
  just give me the final output with screenshots, because I'm not going to be
  able to do anything about it then."* Send a screenshot at the halfway point,
  even when it is ugly.
- The dev server is usually already running on :3000. Check before starting one.
  Do not kill it — another agent may be using it.

## The rulings

Newest first. Each is something that was actually said.

### 1 Oct 2026 — football screens, the title, the league page (v0.23 W7)
- **"When it's in the training or drills or match, we definitely use the pitch
  kind of UI."** (P92) Training, the drills and the match chrome are green with
  chalk lines in BOTH looks: wrap them in `ui/PitchScope.tsx`, never a second
  stylesheet. The canvas is not touched.
- **Title screen: "this whole pitch with the football, the name of it, the
  background's like a net. Our guy should be standing … on the left."** (P82)
  Net behind, pitch under, a ball at his feet, the menu flush to the right
  edge, no store badges. "I don't want you to just look at NSS and do exactly
  what it is": our own Anton wordmark and club-colour light, slanted buttons.
- **"We could do this fixture page with the league, and you have a bell, like
  maybe in the middle somewhere … straight in, no yap at all."** (P90) The
  League screen is one page (`MatchWeek.tsx`): edge arrows flip Results ·
  Fixtures · Table · Scout · Awards · Squad; bottom bar Back · 🔔 · Play. The
  bell is the middle of the bar and opens the live-score clubs.
- **Play as ▾ sits on the line-up animation** (it opens the position choices
  and stops the auto-kick-off while open). Inferred from P91/P93 (the line-up
  replaced the match-day page, which used to hold the picker).

### 1 Oct 2026 — tutorials are pointers, not cards (v0.23, "HUGE UPDATES" review)
- **A tutorial is small pop-ups with a hand pointing at the real thing, in order**
  (P7, P67, P68): "Home", "your player", "star rating", "energy", then "Go to
  training", which you must press. Never a "This is Home" card. Use
  `components/star/PointerTour.tsx` and put steps in `lib/star/tours.ts`; mark a
  target with `data-tour="name"`. A "?" in the header replays a screen's pointers (P42).
- **No hidden numbers, no explaining sentences** (P4, P5, P12, P13, P15, P51):
  no "+N Star Points", "1 to 100", "never goes down", "A session: 30 energy ·
  3 tries". The star points breakdown lives in the Star Pass, shut until the
  tutorial is done.
- **After a match the order is:** star bar rises, match rating, relationships,
  pay, achievements one at a time; Continue is shut until all are seen (P27).
- **News is a headline and one line** (P28) — but on its own full-screen page, TV-style (Harry, 1 Oct 2026, v0.23): an animated BREAKING NEWS band on top, a scrolling ticker band along the bottom, the picture (face + crest), tap to continue. "Some stuff clean, some stuff a bit not clean": crisp type and layout, crooked bands, a torn headline strip, scan-lines. Not a small pop-up over Home.

- **1 Oct 2026 (HUGE UPDATES review, v0.23): the game must feel like an app, not a
  website.** Four rulings, all built as shared pieces in `components/star/ui/`, so
  use them rather than drawing your own:
  - **One heavy font everywhere** (P105: *"this font is so much better … use this
    font across everything"*). Anton, set once in `ui/flat.css` on `.star-root`
    for headings, buttons and every `font-black`/`font-extrabold` label, in both
    looks. Plain `font-bold` sentences stay in the page font so a paragraph is
    readable.
  - **No floating pills** (P73, P87: *"I don't like the floating pill effect of
    everything … that's so AI"*). A panel is flat: full width, square edges,
    fading into the page. Use `FlatPanel` (`ui/Flat.tsx`), not a rounded card on
    grey. The Pitch look's card is see-through grass with no drop shadow (P106).
  - **Square bars** (P85, P107: *"squares with very clear, maybe even animated,
    progress"*). `StatBar` and `SquareBar` are square, outlined and ticked.
  - **A top HUD** (P80, P81, P86: *"the pills at the top change based on what
    screen you're in … but your energy never leaves"*). `TopHud` (`ui/TopHud.tsx`)
    in the shell; which cells show per screen is `HUD_SPEC`. Energy is in every
    one, with its can: USE when you hold one, BUY (opens the cans shop) when not.

### 1 Oct 2026 — screens review (Harry, "HUGE UPDATES", P39-P97)
- **Never stack tab rows.** Stats had three (Stats·Home·Shop, Season·All·Records,
  Stats·Contract·Status): "that is bloated". Now one row: a League arrow at the
  left edge, a Home arrow at the right edge, "‹ Season ›" between them. Edge
  arrows ("an image, the little word") are `ui/Nav.tsx`. The Premier League
  mini-table left Stats (Home has it, League has the full table).
- **A page that is a list has no title and no Back button on it.** "The style
  doesn't need to be there and back doesn't need to be there." Back / the page's
  own switch / Home are a fixed bottom bar (NSS: Back / Lifestyle / Buy), and the
  top HUD carries money and energy. Style's first item moved from 302px to 173px
  down a 390x844 phone. "My stuff" went (a 3D home replaces it later).
- **Relations cards carry no text** — a face, one word, a square animated bar
  with the number on it, a play button, a "?" that says one line ("a good
  relationship with the team means you'll get more chances during a match").
  An empty slot is blacked out, not hidden (NSS's girlfriend and sponsors).
- **The phone is a phone.** Closing it is the home bar (tap or swipe up), not a
  "✕ CLOSE PHONE" pill. The red dot shows only while something is unread and
  clears once read. Apps you do not have are blacked out; an empty page is
  blacked-out slots, not a blank.
- **Pre-match is an animation, not a page.** Play → the line-up draws in and
  kicks off by itself → the match; a prompt only if energy is low when you press
  Play. The black "KICK OFF" panel is a pitch. Energy-mode icons run green,
  yellow, red (red the most intense).
- **Energy never leaves**: the top HUD is on the shop pages, Store, Casino and
  Settings too. Run-up options live under "Play style", not in Settings' middle.

### 1 Oct 2026 — "findable" means the first screen
- **A thing made easier to find has to be on the first screen without
  scrolling** (from "fix the new problems": the Sponsors strip sat under the
  cans, below the first screen of a 390x844 phone). Measured before choosing
  a spot: under the next-match card it ended at 778px against the Play
  button's top at 772px — 6px short, so it would have been cramped. It went
  into the hero as a pill opposite 3D / 2D (294–326px). Measure, don't guess.

### 30 Sep 2026 — sponsors, fame and Home
- **Never show the exact amount needed to unlock something — show a bar.**
  Harry, on "Needs Icon (80 fame)": *"I don't like the idea that we tell them
  exact amounts that are needed. To me that kind of just kills the game…
  I'd rather a progress bar than 'you need 80'. That makes them kind of want
  to work towards it."* Name the level ("Needs Icon"), draw how far you are,
  leave the number out.
- **A feature people can't find is a broken feature.** "How do I even get
  there? … That feels quite hidden away." If a screen matters, it gets a way
  in from Home, not only from a menu two taps deep.
- **A card cut in half by the bottom bar is "jarring".** Said of the KIB cans
  on Home. Keep a card short enough that it reads as whole, not a title with
  its contents chopped off (cans + energy went from 303px to about 130px).

### 30 Sep 2026 — the shop (review of Mikey v0.7)
- **The four shops come first.** "Probably should do these four first instead
  of those two … this makes them seem like small things." KIB Cans, Boots,
  Style, Sponsors are big picture tiles at the top of the Shop page; Store and
  Casino sit under them. Each tile carries a live line (cans owned, boot
  matches left, fame from stuff, deals signed).
- **A level is a thing, not "L1".** "What is a level one sports car? …
  broken down motorbike, normal car, Tesla, sports car, Lamborghini … actual
  images of each one … instead of L1, L2, L3." Every level of every Style
  item has its own name and its own drawing (lib/star/lifestyleLevels.ts,
  components/star/StylePicture.tsx). Generic names, never real brands.
- **"You should always be able to see how much fame stuff is giving you."**
  Fame is on every card and in a strip at the top of Style, and it is the
  real share of your fame — not the item's raw status number.
- **"Way too long."** A list of rows with five price buttons each became a
  3-wide grid of picture cards; the detail is in a sheet you tap open.
  Measured at 390 wide: the longest Style tab 1,663 px → 686 px.
- **"A little place where you can see all your stuff."** My stuff: boots,
  cans and everything owned, each with its fame and seasons left.
- **Boots: "like a gallery, like I'm in a shop … hover over a shoe and buy
  it."** A swipeable lit shelf of drawn boots; tap one for all five levels.
  The walk-around 3D shop he described is NOT built — a much bigger job.
- **Holiday is its own group** (p7): jet, villa, island. Level 5 should
  "unlock something crazy" — the slot is shown as "to be decided" until a
  real reward is designed; never invent one quietly.

### 30 Sep 2026 — the signing, training sessions, the 3D/2D pill (Harry, Mikey v0.7 review)
- **A form to read is not a moment.** On the paper contract: "The contract
  showing the real terms is really cool… this isn't that interesting… have them
  sat down together and then you show him actually signing the contract… tap and
  you would sign." Keep the real numbers, but stage them: your player and the
  manager at a desk, the terms big on the contract (club, seasons, wage), tap →
  the pen writes → handshake → Continue. About 2.6 s, Skip always there
  (`components/star/SigningScene.tsx`).
- **A screen that only repeats what the next one says goes.** The FA Youth Cup
  newspaper after the offer: "that's useless, that page." Removed from the
  signing flow; the component stays.
- **Limits are shown, not counted out in words.** Training sessions: "it should
  be only seen through energy… as you click on a training, it should say you
  have no more sessions this week. It shouldn't just say '1 out of 2 sessions
  remaining.'" Sessions are charge cells (⚡); at zero the cards still answer a
  tap with one final pop-up, "No more sessions this week".
- **A switch must change what is right next to it.** "16, the 2D flick doesn't
  work here" — the 3D/2D pill on the Home hero flipped every match figure but
  not the hero beside it. Now it flips the hero too. (inferred: "flick" = the
  flip pill; there is no drag-to-spin on Home.)
- **A stand-in that says it is a stand-in reads as broken.** The spin page's
  back view: "on the back does not work." The back is now the same drawn man
  from behind (name + number, back of the head), not a separate flat drawing.

### 25 Sep 2026 — training levels
- **Level 1 of every training game opens on a how-it-works card.** "A very
  short, small tutorial or pop-up… doesn't have to be many words, just
  something that tells you how it works." A small drawing, three one-line
  steps, the star rule (1st ★★★ · 2nd ★★ · 3rd ★), one "Let's go" button
  (`components/star/TrainingIntro.tsx`).
- **Vision counts you in: 3, 2, 1, GO — picture hidden until GO,** with
  "Pick the free pass" under the number. Before every try, not only the first.
  Judge both at `/star-dev/media-lab?training=vision&level=1`.

### 24 Sep 2026 — energy-mode icons
- **Low / Medium / High are icons, not words.** From Mikey's three concept
  images: a split ring with a lightning bolt breaking through it — red Low,
  amber Medium, green High. "Instead of saying what it is, it should just use
  these icons… design new icons based upon these concept images." Drawn as
  vector (`components/star/EnergyModeIcon.tsx`); 2 · 4 · 6 sparks show the
  level without colour. The chosen one glows; the others dim.
- First pass at 34px was too small and the thin bolt read as a black line —
  46px and a chunky two-tone bolt fixed it. A thin shape under a thick
  outline disappears at phone size.

### 23 Sep 2026 — the social feed posts
- **Posts look like real social media, not cards.** Verbatim: the posts "are
  all boxed with curved things… what I want is how it is in the concept image
  where it actually looks like social media, where they just integrate nicely."
  No box: posts run edge to edge with a hairline between them, picture in a
  left column, name + tick + handle + time on ONE line, a full action row
  (replies, reposts, likes, views, share). Measured on 7 sample posts: 1,413 px
  → 1,239 px at 390 wide.
- **No category labels on posts.** "Some of them currently are labeled as back
  page or stats or club, which is unnecessary." Who posted it is enough.
- **A stat box or award card is an attached picture.** "If you want wording,
  then it will be at the top. And then below, it will be kind of like that same
  type of image thing." Words first, the graphic under them like a photo.
- Judge posts at `/star-dev/media-lab?feed` — the real post component with
  fixed sample posts.

### 23 Sep 2026 — the page guide (the eye)
- **"There should be an information panel on every single page in the admin
  sections: just a little eye on how to use whatever's currently on the page…
  the same UI across everything."** Every admin/dev page carries the same eye
  button (bottom-right unless it would cover a control) opening one panel:
  what the page is, every button by its on-screen label, where saving goes,
  whether it commits to the repo, where it shows up in the game. One look,
  one data file — see the `admin-page-guide` skill. This is where explanation
  lives on a dev tool, so the tool itself can stay picture-first.

### 21 Sep 2026 — Infinite Highlights, second pass
- **"The actual infinite highlights page should also have the editor tools in
  there."** Seeing a broken chance and being able to fix it are one job, not
  two screens. If a review tool can show you a fault it should let you correct
  it on the spot — flagging and then hunting for the same chance in another
  tool is the gap. Drag, + Team-mate, + Opponent, Remove and Save are now on
  the highlights screen, the SAME code the gallery runs
  (`components/star/EditableFrame.tsx`, `lib/star/scenarioEdit.ts`).
- **One editor, not two.** Same ruling as "one generator, one renderer",
  extended to editing. The drag/hit-test/add/remove/save code was lifted out
  of the gallery page rather than copied into the second one — a second copy
  drifts, and this build has been burned by exactly that before. Proved by
  rendering the pre-refactor gallery beside the new one: the version screen
  and a real add+drag came out **byte-identical** (same PNG sha256, same
  localStorage record).
- **A control only appears when there is something to do with it.** Save and
  Discard show up the moment a picture is edited and not before; "revert to
  the generated chance" only on one that has been saved.

### 21 Sep 2026 — Infinite Highlights
- **"A test that measures the wrong path passes; a person flicking through a
  hundred real chances catches it in a minute."** Said after a camera change
  shipped broken, signed off on a measurement of the wrong code path and only
  caught when he played it. The ruling this sets for any review tool: optimise
  for how fast someone can SEE a hundred of the thing, not for features. One
  big Next, arrow keys, swipe, one tap to flag.
- **A review screen must run the real generator, not a copy of it.** Extended
  from "render the real thing, never a mock-up" (20 Sep) to cover how the
  thing is MADE, not only how it is drawn. Infinite Highlights and the
  gallery's Simulate both go through `nextHighlight`/`nextSim`
  (lib/star/gallerySim.ts) and both draw through `paintMarked`
  (lib/star/scenarioFrame.ts) — one generator, one renderer, or the tool can
  agree with itself while disagreeing with the game.
- **A ring goes on the body the fault names.** Measured: 4 of the fault
  strings ("defender standing on you", "defender piled on the ball", "you are
  off screen", "the pass target is off screen") were falling through to a ring
  on the BALL, which points at the wrong thing on screen. Each rings its own
  culprit now.

### 21 Sep 2026 — the admin nav panel
- **"Have that somewhere on the screen on PC, more so than mobile."** The one
  stated exception to phone-first below. Admin/dev tooling is judged on a
  desktop, so the edge tab is desktop-only and absent on a phone rather than
  shrunk — a floating element on a phone collides with the games' own corner
  buttons. This does NOT loosen phone-first for anything players see.
- **"If I'm on the scenario page, I can easily get back to the homepage, and if
  I'm on the homepage, then I can easily get back to the scenario page."** Every
  admin/dev destination in one list, reachable from every page including the
  immersive ones that hide the normal nav. Getting out has to be as easy as
  getting in.

### 21 Sep 2026 — the gallery, second pass
- **"Across formations… is kind of irrelevant."** Verbatim: *"it should be a
  toggle to even show it right now because it's taking up 60% of the screen
  and it doesn't actually even work. You can only see 3 formations. It doesn't
  change anything… for now it would make more sense to have that space be the
  simulate random option or just nothing there."* Measured: on a 1280-wide
  screen the strip owned the whole right column — 60% of the width — by
  default. It is now behind a toggle, OFF, and the space is the Simulate
  button. NOT deleted: he wants it back later.
- **"I should be able to add more than 10."** A fixed grid size is a cage. Any
  grid of seeded versions gets a "+ Add version" tile and remembers the count.
- **A dev tool that only lets you MOVE things is half a tool.** Verbatim:
  *"you can't add teammates, you can't remove opposition, add opposition.
  There are a few bits of the editing tool missing."* If a screen lets you drag
  a thing, it should also let you add one and take one away.
- **"I just need an output."** On Simulate, verbatim: *"all the simulate should
  do is simulate one screenshot or one scenario, as if a player was playing the
  game… Right now, unless that is what you're saying, which doesn't sound like
  it is, I don't need a bunch of data. I just need an output."* A run counter,
  a fault tally, a hit rate — none of it goes on screen. Measurements belong in
  the hand-back report. The screen shows the picture.

### 21 Sep 2026 — the gallery rebuild
- **"It's literally just a scenario gallery."** The front page is three things and
  nothing else: 11-a-side, 5-a-side, Scenario Builder. No preamble, no
  explanation, no note about what the page is for.
- **Text is the enemy.** The page measured **25,836 px at 390 px wide** — about
  31 phone screens, most of it prose. Before/after pixel height is the metric
  for "is this simpler", and it must go in the report.
- **"Appleified."** The reference is the App Store *Today* tab: one full-bleed
  picture per card, one short title on the card, the content IS the card rather
  than a caption about it.
- **Drag-to-edit stays.** Asked whether it was part of the clutter: *"No, I think
  the drag-to-edit is not the problem on that page."* It is a feature, keep it.
- **A fault is a ring on the thing that is wrong**, not a paragraph under the
  picture. At most one line of red text.

### 20 Sep 2026 — judging shapes
- **Render the real thing, never a mock-up.** A card showing a scenario must run
  the same drawing code the game runs. A second, approximate renderer will
  quietly disagree with the game and the disagreement will be invisible.
- **Seed everything.** A picture must be identical on every refresh. Never
  `Math.random()` in anything a person is asked to judge, or they cannot point
  at what they saw.

### Standing, from CLAUDE.md — do not re-derive these
- **Show, do not describe, anything with a size or a shape in it.** Goal width,
  figure proportions, prices, framing, difficulty. Render the options at real
  phone size and let them point. Use the `show-options` agent.
- **Phone first.** Desktop is the afterthought, not the other way round.
- **Name things the way they appear on screen.** File paths go in brackets
  afterwards, once, only if someone needs to find it.
- **No fluff.** *"There's sometimes too much fluff in how you speak… I'm having
  to skim through too much yap."* No preamble, no restating the request, no
  praise for the idea, no tour of the code.

## Before you hand back

- Screenshot at **390x844** and report the full-page pixel height of every screen,
  before and after.
- Zero console and page errors. Say so explicitly, or say what they are.
- Say plainly what you could NOT do and why. A gap stated is fine; a gap hidden
  is the thing that gets caught later.
- **Then update "The rulings" above** with anything new they said.
