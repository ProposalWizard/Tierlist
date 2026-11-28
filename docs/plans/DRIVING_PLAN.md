# Driving plan: house → your car → training (and matchday) — 28 Nov 2026

Plan and audit only. No game code changed. **No Higgsfield call was made**; section 5 is a proposal for
Harry's yes/no. Tags: **[seen]** I looked at it, **[measured]** a number I pulled, **[reasoned]** my call.

Reads with: `docs/research/gym-compound-driving-2026-11-27.md` §4 and §6 (phase 4-5),
`docs/research/world-3d-2026-11-20.md` §A, `docs/plans/LIVING_WORLD_IDEAS.md` §4,
Harry's answers `docs/plans/2026-10-19/harry-answers-round.md` (21 Oct: steer yourself **and** a skip;
several cars = tap one at the car park; no car = taxi with a small fare).

---

## 1. The cars we already have (audit)

Every vehicle model in the repo [measured with gltf-transform + Blender 4.0.2, 28 Nov]:

| # | File | Size | Triangles | Wheels separate? | Doors / inside | Used for | Made by / licence |
|---|---|---|---|---|---|---|---|
| 1 | `public/star/shop3d/items/car-family-hf.glb` | 452 KB | **36,413** (over the 25k rule) | No: one fused mesh | No | Family Car (`car-1`) in 3D shop look H, garage | Higgsfield image → Tripo H3.1 (≈9.25 credits, 9 Oct) |
| 2 | `.../car-hatch-hf.glb` | 354 KB | 23,280 | No | No | Hatchback (`car-2`) | Higgsfield, same |
| 3 | `.../car-suv-hf.glb` | 385 KB | 23,279 | No | No | Luxury SUV (`suv`) | Higgsfield, same |
| 4 | `.../car-sports-hf.glb` | 332 KB | 23,278 | No | No | Sports Car (`car-3`) | Higgsfield, same |
| 5 | `.../car-classic-hf.glb` | 405 KB | 23,279 | No | No | Classic Car (`classic`) | Higgsfield, same |
| 6 | `.../car-super-hf.glb` | 352 KB | 23,279 | No | No | Supercar (`car-4`) | Higgsfield, same |
| 7 | `.../bike-hf.glb` | 383 KB | 17,453 | No | n/a | Motorbike (`bike`) | Higgsfield, same |
| 8-14 | `public/star/home3d/car-{family,hatch,suv,sports,classic,super}-lod.glb`, `bike-lod.glb` | 110-146 KB | 3,865-4,059 | No | No | House drive window, garage, the compound's parked cars (other builder, `compoundPlace.ts addParkedCars`) | Light copies of 1-7 (`tools/home3d/make_lods.mjs`), no credits |
| 15-20 | `.../items/car-1.glb`, `car-2`, `car-3`, `car-4`, `car-suv`, `car-classic` | 163-196 KB | 30,000 each | Joined at export, **but built as separate wheel objects in code** | No (classic L3 is open-top with seats) | Old 3D shop look | Code-built in Blender (`tools/blender-shop/scripts/car.py`, `cars.py`, exported by `tools/shop3d/export_items.py`); ours, no outside assets |
| 21-23 | `public/star/star-pass/3d/reward-hatchback.glb`, `reward-sports-car`, `reward-supercar` | 55-60 KB | 18,940-20,152 | **Yes: 4 `wheel` nodes each, ready to spin and steer** | No | Star Pass rewards (L20, L40, L70) | Code-built in Blender (`tools/star-pass-art/render_pass_rewards.py`); ours |

Not a car: `jet-hf.glb` / `jet-lod.glb` (Private Jet), `reward-private-jet.glb`.

Stills at phone size (390×260 @2x, Cycles CPU), one per file:
`/tmp/claude-0/-home-user-Tierlist/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/driving/stills/` and one sheet
`/tmp/claude-0/-home-user-Tierlist/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/driving/audit_sheet.png` [seen].

What the stills say [seen]:
1. The six Higgsfield cars (1-6) are the only ones that look like real cars. They are the ones to drive.
2. The code-built shop cars (15-20) and the Star Pass cars (21-23) look like toys. Harry already
   swapped the shop away from them on 9 Oct ("inflated Blender one"). Do not drive them.
3. **Which shop cars have no model?** None, by family: all six cars and the motorbike have a Higgsfield
   model. By level, yes: the shop has 35 vehicle levels (`lib/star/lifestyleLevels.ts`, e.g. Old Banger,
   Stretch Limo, Six-Wheel SUV, Track Racer, Custom Chopper) but the 3D world shows **one model per
   family**, repainted per level. Only the toy Blender cars have per-level shapes.
4. No car has doors that open or an inside. No taxi, no team coach, no traffic set.

### Can the existing models drive?

- **Yes, with one Blender step, no credits.** The blocker from 20 Nov is that the wheels are baked into
  one mesh. I tried it on the Hatchback [seen]: `scratchpad/driving/cut_wheels.py` finds the four tyre
  contact patches, fits a circle to each, and separates every vertex inside each wheel. It ran in about
  10 s and gave four clean wheel parts (907-1,163 vertices each) with their pivot at the hub, so they can
  spin and the fronts can steer. Sheet: `scratchpad/driving/cut/hatch_sheet.png` (as cut / other side /
  body alone).
- **Two things to fix in the real tool** [seen]: (a) the hole left in the body shows the inside of the
  car, so each arch needs a dark liner (a code-built half-cylinder, a few dozen triangles); (b) one front
  wheel was fitted slightly small and left a thin crescent of tyre on the body, so use radius ×1.1 and an
  eye check per car (RUL-ALL-009).
- Same step for the light copies (8-13), so a Low phone drives the 3.9k-triangle car.
- Car 1 (Family Car, 36k) also needs re-prepping to 24k with `tools/models3d/prep.mjs` (free).

---

## 2. What it is (phase 1)

1. **Garden → your car.** The garden's side gate (not the shop doors) leads to your drive. Your cars
   stand there; with two or more, tap the one you want. No car: "Buy one in the shop" and a taxi.
2. **The drive in (25-30 s).** A fixed route, not a city: your street (houses, parked cars) → a
   roundabout and a short high street → a country lane with trees → the compound gate. One road piece
   repeated, fog hides the far end. 2-3 other cars on the road (none on Low).
3. **The arrival (the TikTok moment, 8 s).** At the gate the camera cuts to a low wide shot by the
   barrier. The arm lifts, your car rolls in, slows, swings into your bay. Two team-mates by the door turn
   to look; one says something about your car (a line that changes with the car's level). Cut on the door
   moment, so no door animation is needed; you are standing by the car, keys in hand.
4. **The drive back** is the map: after training, a fork in the road with signs: Home, Casino, Shop
   (later Barber). Your form today sets the radio line or a call (below).
5. **Matchday.** Home games: the same drive, ending at the stadium's players' entrance (the stadium already
   exists in code: `lib/star/style3d/stadium.ts buildStadium`). Fans behind a rail, phone flashes, you get
   out in the suit. Away games: no drive at first (the squad goes by coach; see section 5).
6. **Skip** from the first frame, and a setting "Drive to training: Always / Matchdays / Never".

## 3. How it feels on a phone

1. **Default: auto-drive.** The car follows the road line on its own. You hold the right side of the
   screen to go faster, let go to ease off. Tap left/right half to change lane (overtake a slow car).
2. **Steer option** (Settings, Harry's 21 Oct "steer yourself"): a thumb stick, or tilt the phone
   (off by default). The car still keeps to the road: it cannot leave it, flip, or crash. A bump slows
   you and sounds the horn.
3. **Our own simple car**, no physics library: lane offset, speed, faked lean in corners and nose dip on
   braking, wheels turned by the distance driven, front wheels turned with the steer. Pure numbers,
   tested like `viewCam.ts`, and filmable with `__frameStep`.
4. **Cameras:** a chase camera behind and above (eases wider at speed); tap to cycle to a low bumper
   view and an in-car view (a code-built dashboard and wheel; the 3D phone sits on the dash for calls).
   The arrival always uses its own shot.
5. **Sound:** engine pitch by speed (one loop, higher for the better car), indicator tick, gate, crowd at
   the stadium. All from the Sound Board's free set; no new sound generation.

### Speed budget for a Samsung S20 [reasoned; to be measured at `?fps=1` before anything else]

| | Low | Medium | High (PC) |
|---|---|---|---|
| Your car | light copy, 3.9k tris | full model, 23k | full model, 23k |
| Wheels | 4 parts, 2 draws (one wheel instanced) | same | same |
| Other cars | none | 2-3 light copies (≈4k each) | 5-6 |
| Road and scenery | one road piece, lamps / kerbs / trees as InstancedMesh, garden props reused | same | denser |
| Shadows | one blob under the car | blob | real shadow on your car only |
| Fog | 50 m | 70 m | 110 m |
| Target | **under 37 draws and 35k triangles in view, 30 fps** | 45 draws, 60k | 60 fps |

## 4. Events while driving (phase 2)

1. **A call 8-15 s into the drive**, on the 3D phone on the dash (GTA's habit). One a drive at most;
   not every drive.
2. **Team-mate wants to borrow something** (LIVING_WORLD_IDEAS §4): "Can I borrow your [car / watch /
   £2k]?" Yes = he likes you more, a small chance it comes back late or damaged. No = he is cooler with
   you at training today.
3. **A random agent call:** a club is asking about you; a sponsor wants a photo at the car park; or a
   contract nudge. Yes/no, the answer feeds the normal systems (sponsors, transfer interest).
4. **On the way back:** your manager about today's session; a mate inviting you to the casino (that sets
   the fork's sign).
5. The events are data in the same choice shape as `lib/star/dilemmas.ts`, so writers add more later.

## 5. What can be built TODAY with no generation

1. `tools/drive3d/cut_wheels.py`: the proof above made into a tool, with arch liners and a still per car,
   for all six Higgsfield cars and their six light copies. Re-prep the Family Car to 24k. **0 credits.**
2. `lib/star/drive3d/`: the road line, the simple car, the chase and arrival cameras, the Skip.
3. Test page `/star-drive3d-dev` (RUL-UI-002): garden gate → drive → compound car park → back.
   The compound car park joins once the other builder's `lib/star/world3d/compound*` is merged.
4. Traffic and parked cars: the six light copies in other paint colours (as the compound already does).
5. **Taxi:** the Hatchback's light copy painted black with a code-built roof sign. **0 credits.**
6. Matchday arrival at the code-built stadium. Away days skipped.
7. Calls with yes/no on the existing 3D phone.

Order and size [reasoned]: wheels tool 1 day · road + car + cameras 3-4 days · arrival shot 1-2 days ·
calls + drive-back fork 2-3 days · matchday arrival 2 days. Each ends with stills on the test page before
it touches a career.

## 6. Higgsfield proposal (for Harry's yes/no; nothing spent)

**My pick: Option A, 0 credits.** The six cars we have are good enough to drive once the wheels are cut;
every phase-1 piece above works without a new model.

Only these are worth paying for, and only if Harry wants them:

| Option | What | Which shop item | How many | Tool | Credits (from our past spend: picture 0.25-0.5, Tripo H3.1 image→3D 9-12) |
|---|---|---|---|---|---|
| A | Nothing new. Cut the wheels of the cars we have; taxi and traffic are repaints. | all | 0 | none | **0** |
| B | The team coach for away days (no model exists; a repaint cannot make one) | none (club coach) | 1 | `generate_image` (`gpt_image_2_5`, unbranded, side 3/4 view) → `generate_3d` `image_to_3d` (Tripo H3.1), then `prep.mjs` 24k + the wheel tool | **≈9.5-12.5** |
| C | Team-mates' car park variety: six more shapes so the car park is not six models in different paint (estate, pickup, electric saloon, convertible, big 4x4, people carrier) | none (team-mates' cars) | 6 | same as B | **≈57-75** |
| D | The striking shop levels that are now a repaint: Stretch Limo (`car-1` L5), Six-Wheel SUV (`suv` L5), Track Racer (`car-3` L5), Old Banger (`car-1` L1) | shop levels | 4 | same as B | **≈38-50** |

- B + C + D together: ≈104-138 credits. That is past the ~200 round budget Harry gave before for heads,
  and the floor rule (keep ≥60 in the shared account) applies.
- Before any of it: check `balance`, and run `get_cost:true` on one picture and one 3D job, so the exact
  number replaces the ranges here ("to be priced with the estimate tool").
- **The alternative to all of B-D: existing models.** Away days skip the drive (no coach). The car park
  uses the six light copies in many colours. The shop levels stay one shape per family, repainted.

**Question for Harry:** A only (0 credits)? Or A + B (one coach, ≈10-13)? C and D can wait until the
drive is on his phone.
