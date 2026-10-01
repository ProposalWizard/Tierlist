# v0.24 part A — the gameplay LOOK (plan only)

Source: Harry's 1 Oct "HUGE UPDATES" review (`playtest-notes/huge-1001/points.md` P8, P16, P18–P20, P24–P26, P52, P55, P100, and the "Gameplay / look" list). At 42:42 he split this off from the v0.22/0.23 feature work: "the actual look and feel of the engine … goes into a different one." He also said (P23) he doesn't want a copy of NSS, only its ideas.

Everything below I **read in the code and worked out**. Nothing has been measured on a screen yet. Phase 0 does that measuring.

---

## 1. The items

| # | Item (his words) | What changes on screen | Where it lives | Render-only? | Risk | Harry judges by eye first? |
|---|---|---|---|---|---|---|
| L1 | "Ball is way smaller" (P8, P16) | The drawn ball shrinks. Today it is about 7 px across the middle on a 366 px canvas, which is a **1.0 m ball** against 0.22 m in real life (4.5× too big). | The ball's size line and its draw (CanvasMatch), plus `drawBall` (fiveASide/render) so the gallery picture matches | Yes | Low. If it goes too small you lose it in flight; there is a floor in px | **Yes.** Sheet of 3 sizes: today / 0.6 m / 0.35 m, each in flight + at rest + in the air |
| L2 | "Lighter", then "heavier at the start", "the heaviness of the ball" (P8, P18, P100) | How fast it leaves the boot, how far it rolls, how it bounces | Ball flight in `canvasEngine.ts` | **No, this is physics** | High. It changes every chance and the tuned conversion rates | Not a picture: ask Harry what he meant first (Q2), then Mikey (M1) |
| L3 | Pitch texture (P16, the NSS ring-mown grass in the keyframes) | Grass pattern: today it is fine grain and stripes were removed on purpose. NSS has big circular mow rings | Grass tile (CanvasMatch, scenarioRender, firstPersonRender, trainingRender) | Yes | Low | **Yes.** 3 options: plain grain / stripes / rings |
| L4 | "The size of the box", "camera angle" (P16) | Either see more pitch (everything smaller, the box no longer wider than the screen) or a tilted view | Framing is `scenario.viewport`; the projection is `toPx` (CanvasMatch) | **Partly.** The code's own comment says the ball goes out of play at the frame's edge, so zooming out by drawing alone shows a ball "going out" on visible grass | Medium–high. A tilt also changes how a finger drag turns into an aim, and perspective was taken out before because it "was the single biggest reason the game looked wrong" | **Yes.** Show 3 frames: today (26 m across) / 34 m / 42 m. Tilt only as a 4th card if he asks for it (Q5) |
| L5 | Keeper "not just sat on a line … looking down onto him" (P19) | The keeper starts off his line in the shooting stage | His start spot comes from the **drawings**; how he comes out is the engine (stepKeeper). The penalty keeper must stay on the line by law (kindRules/penalty, 0.4 m) | **No**: placement is drawings, movement is physics | Medium | Yes, but as a drawing: Harry redraws the one-on-one keeper in the gallery, then we check by eye |
| L6 | "Gates are taller" (P18) | Gate drill markers become tall poles/flags instead of 0.56 m cones (about 8 px) | The cone draw inside CanvasMatch's markers (decoration only, already listed as such in the guard) | Yes | Low | **Yes.** Today's cones / 1.5 m poles / 1.5 m poles with flags |
| L7 | NSS-quality figures (P24, P55) | Player figures. The "3d" skin (figure3d) is already the default; Harry's comparison was against a classic clip. Next step: an NSS-tuned 3d (smaller, dark outline, one light) **or** Blender-rendered sprites | `figureSkin.ts` + `figure3d.ts` + `fiveASide/render.ts` | Yes | Medium. Sprites need 8 directions × poses × kit colouring (L size) | **Yes.** Classic / 3d today / 3d-NSS-tuned / one Blender sprite test |
| L8 | "You don't actually see your guy, I actually think that's good" (P16, P24) | Your figure is not drawn in shot stages; you aim from the ball | A new "you" switch on the scene picture (scenePicture) | Yes. It only takes something off, like the keeper/goal switches already do | Low in trial. In the real match your figure is used in Touch Mode and dribbles, so hide it only while you're aiming | **Yes**: before/after film, plus Q4 |
| L9 | "Little amount of attackers … how the scenarios look" (P26) | Fewer team-mates per chance | **The drawings** (SCENARIO RULES COME FROM THE DRAWINGS). Runners and the poacher are physics actors | No | High. Removing runners changes who can receive the ball | Count them first (Phase 0). Harry decides whether to redraw (Q8). Nothing hand-written |
| L10 | "How the ball bounces off people" (P26) | More balls ricochet off bodies | `deflection.ts` (already outside the engine). Today the first block in a chance always comes off him (22 glance on / 20 loop up / 58 loose); a second block in the same chance just ends it | No, it's gameplay | Medium | No. Mikey call (M3) |
| L11 | Spinning player "is exactly how it should look in the dribbling mode" (P52) | Your own man in the chase-cam dribble is drawn as the Home hero figure (front/back, heroFigure + heroBack) | `firstPersonRender.ts` (graphics lane, not the engine) | Yes | Medium. Back view at about 120 px tall has to read in motion | **Yes.** Today vs hero-back, filmed while running |

Out of part A, kept with the v0.22/0.23 feature batch: the tutorial hand pointer (P8), "real pitch behind the screens" (P16), making the vision trial bigger (P20, its own still canvas).

## 2. Safe architecture: one engine, different looks

- **A new `matchLook.ts` copies `figureSkin.ts` exactly**, because that file already does this safely. It holds one setting that every renderer reads when it draws, a per-screen override that is set on mount and cleared on unmount, and no new prop. One "look profile" holds: ball px per metre and floor, grass pattern, frame width, gate style, `showYou`, figure skin. **"classic" equals today's numbers exactly**, so the real career match doesn't change until Harry says so.
- Each renderer reads the same profile: CanvasMatch draw code, scenarioRender (the gallery picture), trainingRender, firstPersonRender. That way a gallery card still looks the same as Play (this broke once before, at 13%).
- **Guard check:** no new loop, no new canvas, no new `<CanvasMatch>` mount, nothing added to KNOWN_COPIES, CEILING, KNOWN_CANVASES or the canary. Because the profile is module-level and not a prop, rule 5 (the real match and EnginePlay must pass the same settings) has nothing new to compare. The "you" switch goes into the existing `scene` prop, which is already in TEST_ONLY. Run `scripts/one-engine-guard.mjs` after each phase.
- **Drawing only, never physics.** The profile is never read by `canvasEngine.ts`, `deflection.ts` or kindRules. Ball weight, frame/out-of-play, the keeper's start and deflections go through Mikey (section 3).
- **Lanes:** CanvasMatch is listed under Mikey's physics/engine lane. The edits there are read-only hooks whose defaults are identical to today, and he signs off before they merge (M5).

## 3. What needs Mikey's sign-off, with the exact question

- **M1 (ball weight, L2):** "Harry wants the ball to feel lighter, like NSS ('heaviness of the ball'). That's launch speed, drag and bounce in canvasEngine.ts. Will you try it in /star-match-dev, or are you OK with us adding a per-mode multiplier outside the engine, the way deflection.ts does? Yes/no."
- **M2 (frame, L4):** "The ball goes out where the picture ends (scenario.viewport). If Harry picks a wider frame, can we draw a wider picture than the out-of-play edge? Or would you widen the viewport in buildScenario? Does either count as 'changing' gameplay?"
- **M3 (bounces, L10):** "deflection.ts lets only the first block in a chance come off the defender (22/20/58). Harry wants more balls coming off people. Is letting a second block deflect too, or shifting the mix toward glances, 'adding' or 'changing'?"
- **M4 (keeper, L5):** "In the trial's one-on-one, can the keeper start further off his line in the stage's own picture? His rushing stays exactly as stepKeeper has it."
- **M5 (lane):** "OK for us to add read-only look hooks in CanvasMatch's draw code? Defaults are pixel-identical, checked by a screenshot comparison."
- **M6 (only if Harry picks tilt):** "A tilted camera changes how a screen drag becomes an aim direction. Does aim feel count as gameplay to you?"

## 4. Phases

| Phase | What | Size | Model |
|---|---|---|---|
| 0 | Baseline: film today's trial (penalty, free kick, gate, take-him-on), a real match chance and the dribble at 390×844 with `scripts/film/rec.mjs`. Take every number in section 5. Same ratios off the NSS keyframes (as % of screen width) | S | everyday, medium |
| 1 | Send M1–M5 to Mikey alongside Phase 0. Don't wait on him for the render-only items | S | — |
| 2 | One `show-options` sheet at phone size, in a throwaway worktree: L1, L3, L4 (frames only), L6, L7, L8, L11. Each card labelled with its numbers. Harry points | M | everyday, medium |
| 3 | `matchLook.ts` scaffold. "classic" proven pixel-identical by a before/after screenshot diff. Guard green | S–M | top (touches the match draw path) |
| 4 | Build Harry's picks straight on `Harry`, trial profile first. Match profile only if he answers "all" to Q9 | M | everyday, medium |
| 5 | Mikey-dependent items as he answers: L2, L4 frame, L5, L10. The tilt only if Harry picks it | M–L | top |
| 6 | Film each change: before + after clip of the whole phone screen + a still, one full-width clip at a time, ½×/¼×. `star-playtest` run. Patch notes as their own artifact (P110) | S–M | everyday, medium |

## 5. Numbers to take before and after (390×844)

Ball: radius in px and the metres it represents (worked out: about 7 px, 1.0 m). Figure height (last measured 40.2 px) and keeper height. Goal width as % of screen width (worked out 28%). Box width as % of screen width (worked out **154%**: the 40.3 m box is wider than the 26.25 m frame). Frame width in metres. Gate/cone height (about 0.56 m, about 8 px). Keeper's start distance from the line per kind (penalty 0.4 m; one-on-one from the drawings). Camera: straight down today, with 1 m of height drawn as 1 m across. Ball (simulated, no engine edits): leave speed at full power, time to cover 16 m, how far a soft touch rolls. Attackers per chance per kind, counted from the drawings. Deflections per chance (at most 1 today) and the 22/20/58 mix. Pair each with the NSS keyframe figure where there is one.

## 6. Questions for Harry (one word each)

1. **Ball size:** A / B / C (from the sheet)?
2. **"Heavier at the start":** at the start of your *career* (low Power), or at the start of each *kick*? career / kick
3. **Smaller box:** see more pitch, everything smaller (**zoom-out**)? Or **keep** the zoom? This pulls against P20 "make everything closer". zoom-out / keep
4. **Hide your player:** in **trial** shots only, or **everywhere** (the real match too, while aiming)? trial / everywhere
5. **Camera:** **flat** top-down as now, or a slight **tilt** looking down? flat / tilt
6. **Figures:** a tuned **3d** skin, or test **blender** sprites? 3d / blender
7. **Grass:** **rings** (NSS), **stripes**, or **plain**?
8. **Fewer attackers:** will you **redraw** the chances in the gallery, or **leave** them? redraw / leave
9. **Scope:** the new look in the **trial** first, or **all** screens including the career match? trial / all
10. **Keeper off his line:** only in the one-on-one stage? Penalties have to stay on the line. yes / no
