# 3D places audit: how the career moves between them (28 Nov 2026)

Asked by Harry: "fixing any problems between 3D places". Report only: no game code was changed.

How this was done, in plain words:
- **Part 1 (reading the code): done.** Every route below was traced in `app/star-dev/page.tsx` and the place screens.
- **Part 2 (screenshots): NOT done.** The rule was "only when 5 GB is free". The machine had 3 GB free at the start and 1 GB free when I went to start the dev server (`free -g`: 15 total, 13 used). So there are **no stills**, and nothing below was *seen*. Everything is **reasoned from the code**. Each item says what to look at when screenshots can be taken. Stills folder (empty on purpose): `/tmp/claude-0/-home-user-Tierlist/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/3d-audit/`.

## The one picture of how it works

- ONE shared WebGL canvas for every walk-around place (`lib/star/three3d/perf.ts` `acquireRenderer`, line 268). Each place takes it, moves its canvas into its own box, and gives it back on leave. The place's own stuff is freed late (next place, or after 3 s).
- Each place is a `lazyScreen` (`app/star-dev/page.tsx` lines 289-301) with the loading screen as the cover while its file downloads. The place then mounts its OWN `LoadingCurtain` and the two carry on as one screen (`LoadingCurtain.tsx` `CARRY_MS`).
- The page switches place by `phase`. Only ONE place is mounted at a time, except the house and the phone, which are one screen (`HousePhone.tsx`).
- Player state that carries: clothes (`wornAt(career, place)`), kit, number, skin, hair. First-person choice is saved on the device (`viewCam.ts` `VIEW_MODE_KEY`) and every place reads it when it builds.

## Short table: every route

"Read" = verified in code only. No still exists for any row.

| # | Route | Canvas owner during the hop | Loading screen covers it | Player / clothes / view carry | Back goes to the right place | Verdict (code only) |
|---|---|---|---|---|---|---|
| 1 | Home -> Garden (`openHub("garden")`, page.tsx 5148) | Garden takes it | Yes (garden cover from the tap) | Outfit yes (`wornAt "garden"`), view yes | Back -> Home. Right | OK |
| 2 | Garden -> Shop doors (page.tsx 5191) | Garden releases, Shop takes | Yes | Outfit yes, view yes | Shop front door -> Garden at the shop doors. Right. Shop's "Back" -> 2D shop, not the garden (design) | OK, see P8 |
| 3 | Shop -> back out to Garden (front doors, 4902) | Shop releases, Garden takes | Yes | Yes | Arrives at shop doors. Right | OK |
| 4 | 3D shop "See it in the shop" -> 2D shop -> Back (4909-4911) | Shop releases, nothing 3D | n/a | n/a | **No.** Back goes Home, not to the 3D shop | **Problem P7** |
| 5 | Garden -> House back door (5195) | Garden -> Home3D | Yes (house cover) | Outfit yes | House Back -> Garden, labelled "Garden". Right | OK, but see P4 |
| 6 | House -> Garden front door (5203) | House -> Garden | Yes | Yes | Arrives at house door. Right | OK |
| 7 | Garden -> Phone (5196) | Garden releases; the phone is flat page UI, house loads 2.5 s later | Phone usable at once; house behind it is blurred still | Outfit in the house yes | Phone BACK -> house, but house Back now says "Home" (page.tsx 5217) | **Problem P4** |
| 8 | House -> Phone pill -> HOME (5200-5217) | Same screen, no reload | n/a | Yes | After this, `homeFromGarden` stays `true` | **Problem P4** |
| 9 | Garden -> Training gate -> picker -> drill -> back | Garden releases; picker is 2D; drill takes canvas | Yes (training cover, drill box) | Kit on purpose | Picker Back -> Garden at the gate. Right | OK, but see P2, P9 |
| 10 | Garden -> Casino doors -> out | Garden -> Casino -> Garden | Yes | **Casino shows the club kit, not your wardrobe outfit** | Casino Back -> Home, not the garden | **Problems P5, P8** |
| 11 | Casino Back pressed just after a door walk (Casino3D.tsx 129) | Casino | n/a | n/a | A delayed door can fire after Back | **Problem P6** |
| 12 | Training -> 3D drills (Play3D) | Drill takes it | Yes (drill box) | Kit | Exit -> picker. Right | **Problem P2** (no heal) |
| 13 | Crossbar Challenge | Crossbar takes it | Yes | Kit | Exit -> picker | **Problem P2** (no heal) |
| 14 | Training -> Gym (new) | none | none | none | none | **Not in the career yet** (P10) |
| 15 | 3D match (kick-off) | engineView takes it | Yes (match programme), 2D underneath | Kit | n/a | OK. Already healed by Match3DLayer |
| 16 | Casino -> table games over the room | Casino stays | n/a | n/a | n/a | Not traced (needs eyes) |

## The problems, worst first

### P1. A place you leave while it is still loading keeps building and drawing on the shared canvas  (Medium, hits fast taps)
- What you would see: tap Garden then Shop in under ~15 s (the garden cold load is 17.8 s in the handbook table). The shop arrives slower than it should, or its first frames hitch. Could also give a short grey flash. **Not seen**: needs a screenshot run with fast taps.
- Steps: Home -> Garden (cold) -> tap a door or Back within a few seconds -> next place.
- Likely cause: the screens only learn they were closed after the build finishes. `Garden3D.tsx` 184, `Shop3D.tsx` 178, `Home3D.tsx` 220, `Casino3D.tsx` 152 run `if (dead) { c.dispose(); return; }` only AFTER `startX` returns. The cleanup runs `ctrlRef.current?.dispose()`, but `ctrlRef.current` is still `null` during the build, so nothing stops it. The one check that exists (`acquireRenderer`, `perf.ts` 273: "container no longer on the page") only fires if the place leaves BEFORE it asks for the canvas. The garden asks at `garden3d/scene.ts` 263, early, so after that the whole GLB download, `warmUp` (`perf.ts` 460: compile and a 1-pixel draw on the shared renderer) and shader build run for a place nobody sees. `warmUp` and `awaitSmoothFrame` do not check who owns the canvas (`awaitSmoothFrame` even counts the NEW place's frames, `perf.ts` 505).
- Fix idea (not done): pass an `isDead()` into each `startX` and check it after every `await`; make `warmUp` skip when `!isOwner()`.

### P2. The training drills and the Crossbar Challenge do not heal a lost 3D  (Medium-High)
- What you would see: a drill (3D-only ones cannot be played any other way) freezes on the last picture when the phone takes the graphics memory away. Harry's rule (27 Nov): never a frozen screen that needs a tap.
- Cause: `webglcontextlost` is listened for in the garden, house, shop, casino, signing scene, test kit and the match, but **not** in `lib/star/play3d/scene.ts` or `lib/star/training3d/scene.ts` (grep shows no listener), and `Play3D.tsx` 245 / `Training3D.tsx` only go to "off" on a build error. A 3D drill in "off" says "pick Crossbar instead" (`Play3D.tsx` 514), which also has no heal.

### P3. Healing is not the same in every place  (Low-Medium)
- Garden and house: 2 silent rebuilds (`AUTO_REBUILDS`, first one at Low) AND a rebuild after a failed build (`Garden3D.tsx` 121, 192; `Home3D.tsx` 180, 229).
- **Shop** gives up after ONE rebuild (`Shop3D.tsx` 127: `restarts > 1`) and never retries after a failed build (183-188).
- **Casino** gives up after one rebuild (`Casino3D.tsx` 117, 169) and a failed build goes straight to the old casino (`Casino3D.tsx` 156-157).
- The counters never forget. `autoHeal.ts` says "one that lost it once an hour ago still heals" (a 60 s window) but only the match (`Match3DLayer.tsx` 146) and the home player (`ToonHomePlayer.tsx` 56) use `afterLoss`. A long garden walk that loses the 3D three times in a morning ends on the drawn garden.

### P4. "Back" from the house goes to the wrong place after the phone  (Medium)
- What you would see: Garden -> your house -> 📱 Phone -> put away -> the house now says "Back to Home", not "Garden". Worse: Garden -> house -> Phone -> phone's HOME button, then later Home -> House: it says "Garden" and takes you there.
- Cause: `homeFromGarden` (`page.tsx` 540) is only reset in `toGarden`, the house Back and `onPutAway` (5203, 5211, 5217). The phone's HOME (`onHome` -> `handleNavigate`, 1255) and every other exit never clear it. The reverse is also true: `onPutAway` clears it even when you came from the garden.

### P5. The casino ignores your wardrobe  (Medium, plain to see)
- What you would see: set a casual outfit at the wardrobe. Garden and shop show it; the 3D casino shows the club football kit.
- Cause: `Casino3D.tsx` 95-104 builds `opts` with kit, number and player look but no `worn`, and `casino3d/scene.ts` 590-615 dresses with `kit` only (`grep worn` finds nothing in either). The garden (`Garden3D.tsx` 460), shop (`Shop3D.tsx` 163) and house pass `wornAt(career, place)`. Handbook (line 1241 area) says wearables should carry to the shop and garden; the casino was missed.

### P6. A door walk in the casino can fire after you pressed Back  (Low-Medium)
- Steps: walk out of the casino doors and, within 0.35 s, tap Back.
- Cause: `Casino3D.tsx` 129: `setTimeout(() => doorRef.current?.(), 350)` is never cleared when the screen closes. Back goes Home (`page.tsx` 4998); then the old timer fires `onDoor` (4999) and throws you into the garden. `endCasinoVisit` also runs twice, which can roll the casino scandal twice for one visit (`page.tsx` 3652 clears the start on the first call, so the second sees `money - start` of 0, probably harmless but unproven).

### P7. 3D shop -> "See it in the shop" -> Back does not return to the 3D shop  (Low-Medium)
- Cause: `page.tsx` 4909-4911 sets `shopFocus` and `setPhase(to)` with no `pushFrom` (the thing that remembers where Back goes, 522-529). The 2D shop's Back (4924, 4932) then finds nothing remembered and goes Home. The 3D shop also restarts at its default spot (`atDoor` false).

### P8. Back is not symmetrical between the places  (Low, a design call)
- Shop3D Back -> 2D shop or Home; Casino3D Back -> Home; Garden Back -> Home; only the doors lead into the garden. So Garden -> Shop -> Back (the top-left pill) does not return to the garden, while the doors do. The pill says "Shop" (`Shop3D.tsx` `backLabel` default) so it reads as "the 2D shop", which is true, but a player who just walked in from the garden may expect the garden.
- Also the casino ban screen (`page.tsx` 4979-4989) ends on "Back home" even if you came from the garden gate.

### P9. First-person choice does not reach every place  (Low, design call)
- The eye button and the saved choice exist in garden, house, shop, casino (Look H only: `casino3d/scene.ts` 703) and the test kit. Not in Crossbar, 3D drills or the match, and not in the OLD garden (`garden3d/sceneOld.ts` has no `setView`, so `Garden3D.tsx` 269 hides the button, while the saved "first" is silently ignored).
- Not verified by eye: what the camera does for the first 0.4 s when you arrive in a place while "first" is saved (`ViewCam` constructor sets `k = 1` at once, so it should start in his eyes with no blend; needs a still at each door arrival, especially the shop doors and the house door where the player stands next to a wall).

### P10. The gym is not in the career  (Info)
- "Training -> Gym (new)" has no route: `app/star-dev/page.tsx` mentions the gym only as `gymSkillBonus` (69, 4336). The gym room exists only on `/star-world3d-dev?place=gym` (`lib/star/world3d/gymPlace.ts` line 5 says "not in the career yet"), and its career effect is switched off (`lib/star/gym/progress.ts` `GYM_CAREER_EFFECT = "off"`). Nothing to fix between places yet; when it is wired in it needs: a door or a Training picker row, the loading curtain (add a `gym` section in `lib/star/loading/pick.ts`), a heal, the wardrobe rule (`wornAt "training"` is kit only) and the view toggle (already in `World3D.tsx` 74).

## Smaller things seen while reading
- `Casino3D.tsx` 157 logs "3D casino failed to load" even for a place closed mid-load (the other places check `dead` first: Garden 187, Shop 183, Home 185). Noise only.
- `Garden3D.tsx` `leaving` (the dark fade over the screen) is never reset. It is only safe because every door unmounts the garden; a door that does not (a future one) would leave a black screen.
- Shop and garden build once per visit from the career at mount (`Garden3D.tsx` 100, `Casino3D.tsx` 95). Money or outfit changes while you stand in the place do not show until you re-enter. By design.
- The 3D phone's house loads 2.5 s after the phone is up (`HousePhone.tsx` `HOUSE_AFTER`). If you tap "put away" before then, you see the house loading cover under the lowering hand (`lowerAndPull`). Looks intended; worth one still.

## What to do when memory is free (Part 2 plan, nothing run)
1. Dev server on 3116, ONE browser, 390x844 at 2x, hide cookie banner and chat badge.
2. Signed-out dev career. For each row of the table, two passes: fast taps (door the moment the cover lifts) and normal.
3. First stills to take, in this order (most likely to show a real bug): P1 (garden -> shop in under 5 s, then a still at 3 s, 10 s and 20 s of the shop), P5 (casino in a casual outfit), P4 (garden -> house -> phone -> put away -> label), P6 (casino door then Back inside 0.35 s), P9 (arrival in first person at each door), P2 (drill, then kill the context with `WEBGL_lose_context`).
