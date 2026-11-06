# Four reference TikToks, broken down (Mikey, 6 Nov 2026)

All four were watched in full: pictures every 0.1 s plus the full voice
(`scripts/screen-video/`, ad mode). The 12-minute one was read through its
transcript and 12 of its 112 sheets, at the key moments. Numbers below are
what the videos SAY; none of them were checked.

| # | Link | Account | Length | Views / likes | What it is |
|---|---|---|---|---|---|
| R14 | https://vm.tiktok.com/ZN8f6pSeU/ | @mrbombastic_53 | 11:52 (landscape) | 217k / 14.5k | Full tutorial: how Claude learned the "Ricks Clips" style (2D characters in a 3D world) and made its own short |
| R15 | https://vm.tiktok.com/ZN8f63tWk/ | @aiwithtroy | 1:00 | 269k / 17.1k | "Claude made me rich and I'm scared": an online-store tool (really an ad for "Amboras") |
| R16 | https://vm.tiktok.com/ZN8f6qDt5/ | @jackroberts____ | 0:40 | 14k / 0.7k | "Your Claude edits are missing sound design": free sound library Openverse |
| R17 | https://vm.tiktok.com/ZN8f6QtUh/ | @mrbombastic_53 | 3:00 (landscape) | 41k / 2.6k | Short version of R14: a free "Cartoon Audio Short" Claude skill, step by step (cut off at Step 2) |

Two of the four (R14, R17) are the SAME style seen from behind: the
"Ricks Clips" story short. That style is the main thing to take.

---

## The style behind R14 and R17: "Ricks Clips" story shorts

The channel: Ricks Clips (YouTube). R17 shows its Popular tab at 00:27-00:37:
31M, 16M, 15M, 14M, 13M views. R14 says (00:00) its last 80 shorts got over
200M views and one got 29M.

**What it looks like (R14 01:27-03:07, from Claude's 20-video study):**
- Flat 2D cartoon people (simple outlined faces, thin black outline, flat
  colours) standing in a real 3D world. They are LIT by the scene: they
  catch the key light and cast real ground shadows.
- The 3D world has black ink outlines on about 3 of every 4 edges, like a
  comic. Wood and stone look hand-painted (grain, dark gaps between planks).
- Very saturated colours. Warm highlights, cool blue or purple shadows.
  No pure black anywhere.
- Backgrounds are blurred (depth of field), so the eye goes to the figure.
- Bodies about 3.5 heads tall, thin arms and legs.
- Lighting follows the story: warm and bright for the set-up, deep night
  blue the moment the explanation starts.
- The camera almost never cuts (12 of 20 have one hard cut or none). It
  glides into the next moment, slow in and slow out over about 23 frames,
  and is slowly pushing in about 65% of the time.
- Captions: one word (sometimes 2-3) at a time, white, bold, centred low
  (R17 00:38-00:50, a 14M-view short: "his boss", "a finger", "my railroad").
- Vertical 1080x1920, 30 fps, 31-78 s (about 60 s median).

**How the script works (R14 01:46-02:37):**
1. **Hook = a paradox, said as fact, in sentence 1.** No intro.
   "They buried a man alive with a bell tied to his finger." "There's a
   button in the middle of town and nobody's allowed to press it."
2. **Setting** in 1-2 lines, present tense, real details.
3. **Escalation**, 3-6 beats: others laugh, doubt, mock.
4. **Pivot**: the real reason comes out. 14 of 20 flip into it with the
   same two words (the words weren't caught clearly in the voice track).
5. **Payoff**: one last line and the twist lands.
- One narrator, about 4 words a second, almost no gaps.
- R14's own short (1831, 74 soldiers break a bridge by marching in step)
  had a best line from a checked fact: "Luckily, the river was only two
  feet deep. Unluckily, the river was only two feet deep."

**How it was made (R14 03:12-09:42).** All of this is close to what we
already do:
- Download the 20 best shorts and look at EVERY frame (30 fps, 32,000
  frames). Small things make it look premium: tiny camera moves, light,
  shading. "Don't ask Claude what it thinks of a video. Make it measure."
- Check every fact before writing (date, number of soldiers, river depth).
- Build in three.js (3D in the browser), render with Remotion frame by
  frame. 37 free 3D models, textures painted by code, 14 faces per figure.
- Check stills BEFORE rendering video (it found the camera inside a house,
  teal trees, a chain across faces).
- Put our frame next to theirs and measure the gap: 7 study agents (colour,
  ink lines, light, texture, characters, depth, motion), 1 for sound, then
  4 builders, each with its own copy and its own files, merged at the end.
- Their study notes had mistakes too (the heads were rounder, not egg-shaped;
  the camera moved more than the tool saw). Measure twice.
- The finished skill is free on GitHub: `mromidev/claude-animated-shorts`
  (R14 10:07: SKILL.md, SCRIPT_example.md, templates, 5,000 reference images).

**How R14 and R17 are made as videos:** big numbers in the first 5 s
("29 million", "200 million"), theirs next to "mine" side by side, "free",
"no Blender, no video generator, no CapCut" (R17 00:08), then step cards
("STEP 1 Install the Claude skill", R17 02:05) and screen recordings.
Both are landscape YouTube videos posted to TikTok.

---

## R15: "Claude made me rich and I'm scared" (1:00)

| Time | Picture | Voice |
|---|---|---|
| 00:00-00:21 | Face to camera, mic held to chin, dark room. Caption pinned at top the whole time: "Claude made me rich and I'm scared" | "I'm scared to show you... if this post gets attention I'm going to delete it" |
| 00:21-00:24 | Phone films the monitor: sales dashboard, $41,329, finger on the number | "Last month Claude made me over $40,000" |
| 00:24-00:30 | AliExpress page, suitcase circled red, then his store's page | "Cheap products... charge a lot more" |
| 00:33-00:43 | The tool's chat box ("Opus 5.5" picker), it builds a page, then reviews | "It builds the entire thing for me" |
| 00:44-00:51 | A dark flow chart of many store versions | "Hundreds of variants... conversion rate" |
| 00:54-01:00 | Face to camera again. Caption: "Comment 'store' 👇" | "Comment store and I'll send it over" |

**What makes it work:** a fear/secret hook ("I'm scared", "I'll delete
it"), proof at 0:21 (a big number on a real screen), filmed on a phone
pointing at a monitor (feels real, not an ad), one-word captions in the
middle of the screen, and a comment-a-word ending that also feeds the
algorithm.
**Watch out:** the screen says "Amboras Business Assistant" (00:33-00:38);
Claude is only the model in its picker. It's an ad made to look like a
confession. Copy the shape, not the money claims.

## R16: "Your Claude edits are missing sound design" (0:40)

| Time | Picture | Voice |
|---|---|---|
| 00:00-00:01 | Split screen: an edit playing on top, his face on the bottom half | "Your Claude edits look pro..." |
| 00:01-00:03 | Full-screen glitch: the edit breaks into tiles, "No audio track" pop-ups pile up, mute icon | "...but they're missing a very important part" |
| 00:04-00:07 | A ring labelled Script / Visuals / Motion with one red gap, then a pulsing speaker | "It's called sound design" |
| 00:07-00:11 | A pixel robot with headphones, "whoosh / hit / click / boom" bubbles; a robot at a piano goes red and glitchy | "Claude can't hear... so it fakes it and it sounds bad" |
| 00:12-00:21 | Bookshelf of coloured "sounds", a counter rolling 0 to 5,000,000+, sound cards (Hits, Whooshes, Clicks, Music) | "Over 5 million real sounds... you name it" |
| 00:21-00:28 | A Claude chat box "Use this library for my sound effects"; a lock with "No API key needed"; sounds dropping onto an edit timeline | "Just give Claude the link... no API key" |
| 00:29-00:35 | "free_whoosh_FINAL(3).mp3, licence: none" cards; a "Use commercially" tick box | "Filter for free to use commercially" |
| 00:35-00:40 | A wall of his other videos, "Claude Code", "Gemini 3.5" | "Hit subscribe" |

**What makes it work:** the top half is always a drawn graphic of exactly
the word being said (every noun gets a picture), a cut about every 0.5-1 s,
captions in a grey box at the seam, one big "broken" moment at 0:01, a
rolling counter for the big number, and the face only as a guide.
**For us:** Openverse (openverse.org) is a real free library; filter "use
commercially" and check each licence before posting.

---

## What to take for Knowitball

1. **The story-short style (R14/R17) fits us best.** We already build in
   three.js (garden, shop, cut scenes) and already make cartoon football
   stories (the Cruyff template). A football version: a paradox hook in
   sentence 1 ("A club sold its best player for a bag of footballs"),
   3-6 escalation beats, the pivot, a twist line. Flat figures in our 3D
   grounds, ink lines, warm-to-night-blue light, a gliding camera.
   Before building, read the free skill (`mromidev/claude-animated-shorts`)
   for rules; our figures and grounds stay our own.
2. **Hook rules from all four:** the claim in the first sentence, a big
   number in the first 5 s, proof on screen by 0:20, no intro.
3. **Captions:** one word at a time, white, bold, low-centre (R14/R17); or
   R15's pinned title at the top for the whole first beat.
4. **Every cut gets a sound** (R16): a whoosh, hit or click per cut, from
   a free, commercial-use library.
5. **End on "Comment '<word>'"** (R15) instead of "follow": e.g. "Comment
   'ball' for the link."
6. **A behind-the-scenes series (R14/R17 shape):** "Claude built my football
   game: here's how", their thing next to ours, real numbers, step cards.
