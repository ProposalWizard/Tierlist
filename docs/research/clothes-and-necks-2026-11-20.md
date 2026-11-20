# Clothes that read as cloth, and clean necks (20 Nov 2026)

Asked by Harry after tonight's cut scenes: "The kits look not like fabric but painted on with blobs of
differing paint." "You're struggling a lot with necks and skin colour into clothes." Later, on the first
proof: "the real cloth looks better but you're still struggling for where to cut off the clothes/colours."
So this report is about EDGES first: where a garment ends, and where one colour ends.

Marks: **[measured]** = counted or seen in our own renders. **[source]** = read in a source listed at the
bottom. **[reasoned]** = my reasoning, not checked.

Proof code (not in the game; a dev page was used to film it and then removed): `tools/clothes3d/clothes.ts` (the builder), `tools/clothes3d/proof-page.tsx`
(copy to `app/star-3d-bench-dev/clothes/page.tsx` to run), `tools/clothes3d/shoot.mjs` (stills).
Pictures: `scratchpad/clothes-research/proof-*.png` (session scratchpad, not in the repo).

## 0. Cost first

One person, the "Buzz/crop & beard" body (h6, Tall), measured on this machine's software renderer
(draw calls and triangles are exact; frame time was NOT measured).

| | Draws per person | Triangles drawn per person (incl. ink line) | Extra memory | 22 players on screen |
|---|---|---|---|---|
| Today (painted kit) | 2 (body + ink) [measured] | 29,872 [measured] | 0 | 44 draws, 0.66 M tris |
| Cloth kit, as built in the proof (shirt, shorts, socks each own mesh) | 8 [measured] | 39,588 (+33%) [measured] | ~1 MB geometry per head-and-outfit, shared by everyone on that head [reasoned: ~12k verts x 88 bytes] | 176 draws, 0.87 M tris |
| Cloth kit, merged (all garments one mesh, colours by garment id) | 4 (body, body ink, cloth, cloth ink) [reasoned] | same 39,588 | same | 88 draws, 0.87 M tris |
| Cloth kit, merged, far players (LOD: no ink on cloth, no socks mesh) | 3 [reasoned] | ~27k [reasoned] | same | ~66 draws |
| Jumper + shirt + trousers (cut scenes, 1-5 people) | 8 [measured] | 48,216 (+61%) [measured] | ~1.2 MB per head-and-outfit [reasoned] | n/a |

- The body loses what the clothes cover: 14,936 → 7,992 triangles under a kit, 6,013 under a jumper [measured].
  So the cloth costs less than its own size.
- No new textures per person. Crest, number and sponsor are small canvases per club (256x256, 512x512,
  1024x256), not per player [measured in code]. Use one digit atlas for numbers in the game [reasoned].
- Budgets in other engines: ~100-200 draws on a low-end phone (PlayCanvas) [source, via
  stylised-bodies-2026-11-20.md]. So merge to 4 draws per person before 22 players wear cloth [reasoned].
- The clothes are built once per head + build + outfit when a scene loads, then cached. Build time was not
  measured; it is plain JavaScript over ~15k vertices [reasoned: tens of ms].
- Frame time: the fabric shader is three.js's own toon shader plus a few lines; fill cost is about the
  same as the body's shader on the same pixels [reasoned]. Measure on a mid Android with the frame meter
  before it goes in.

## 1. What is wrong today, in one line each

Seen in `scratchpad/people-overhaul/` and in my "today" panels [measured by eye]:
1. Every person is ONE mesh with ONE generated texture. A mask texture says kit / skin / hair per texel.
   The shader paints shirt, shorts and socks by mask and by height lines.
2. So every edge (collar, cuff, hem, sock top) is a texel line. Masks are coarse and blurred by mip-mapping,
   so edges come out ragged: skin-coloured flecks in the collar, kit flecks on the jaw (diagnosis.md 3a-c).
3. The generated texture's own lumpy paint is multiplied in: "blobs of differing paint".
4. Nothing stands off the body: no collar, no hem thickness, no cuff. Cloth has no silhouette, so it reads
   as body paint.

## 2. Research: how other games do it

### 2.1 Separate clothes over a body, hidden skin removed (the industry norm)
- **Ready Player Me:** an outfit is its own mesh skinned to the same skeleton. Their guide says to remove
  body parts hidden by clothing, for optimisation, and to drop the body entirely when an outfit covers it.
  Limits: top 6,000 tris, bottom 5,000 [source].
- **Reallusion Character Creator:** "Auto Hide Mesh" hides the body under clothes to stop poke-through
  [source]. **Fab Dynamic Mesh Occluder** removes skeletal-mesh triangles covered by clothing [source].
- **Roblox layered clothing:** the garment sits between an inner and an outer "cage"; the engine wraps the
  inner cage onto whatever body is under it, and the next layer onto the outer cage [source]. This is how
  any garment fits any body. Too heavy for us; our bodies share one skeleton and our clothes are made FROM
  the body, so they already fit [reasoned].
- **The Sims 4:** clothing parts are mesh parts per body region; a "null body" part cancels the human body
  under a full outfit [source, community mod docs].
- **EA FC:** jerseys and shorts are their own cloth meshes, GPU-simulated against the body since FC 24
  [source]. Madden's "Swish" predicts wrinkles from pose with normal maps [source]. Far beyond a phone.
- **Genshin-style cel games:** clothes are modelled geometry; shading is a ramp texture per material,
  chosen by a material id in a lightmap channel [source, community reverse-engineering]. The lesson for us:
  one flat ramp per MATERIAL, not per texel.
- **Mii / Animal Crossing / Rocket League-style simple toon:** simple modelled shapes, flat colours,
  decals for logos [reasoned, no source read].

What a small three.js team can copy [reasoned]: clothes as real meshes on the same skeleton, body under
them deleted, flat colours per material, logos as crisp decals. We do not need cages or cloth simulation.

### 2.2 What makes fabric read as fabric at phone size
1. **Silhouette.** A collar that stands off the neck, a hem with thickness, a cuff. This is the biggest
   single cue; it is what painting can never give [measured: compare proof-edges.png rows].
2. **Clean edges on mesh lines.** Every edge is a straight cut, not a blurred texel line [measured].
3. **Smooth shading.** Cloth bridges the body's small bumps. Copying the body's lumpy normals gave dark
   blotches on the jumper [measured]. Smoothing the shell's normals over neighbours fixed most of it [measured].
4. **Fabric sheen.** Cloth is brighter at grazing angles (fibres scatter light) [source: CryEngine cloth,
   Blender sheen]. In toon, a thin stepped sheen band for polyester kits, a wide soft one for wool [reasoned].
   Too sharp a sheen looks oily [source: V-Ray note].
5. **Crisp kit details.** Crest, number, sponsor, stripes and trim drawn from position (decal or distance
   field), never from the body's 1024 texture [measured: crest and sponsor stay sharp in proof-neck.png].
6. **Why ours looks like blobs:** low texel density (one 1024 texture for a whole body), mip blur at phone
   size, the generated texture's painted lumps multiplied in, and no geometry at any edge [measured + reasoned].

### 2.3 Necks and collars
- The neck opening must be a ring round the neck's BASE, not a height line. My first cut by height alone
  sliced the shoulders flat into a "boat neck" shelf [measured, early proof]. A ring + a low line, never
  above the collar line, gives a clean crew neck on this body [measured].
- The collar is geometry: a band rising from the cut edge and leaning in to touch the neck [measured].
- The body under the collar is removed up to 1.5 cm inside the edge, so no skin can show through and there
  is no gap [measured].
- Our bodies have very short necks (chin ~2.5 cm above the painted collar line, handbook). So the collar
  must sit low at the front (~6 cm below the back) or it touches the jaw [measured].
- Any head fits any body because the cut is measured from each body's own joints (neck, shoulders, hips,
  knees, ankles) and the painted kit lines the file already stores (collar, sleeve end, shorts end, sock
  top, boot top) [measured on one head; reasoned for the rest].

### 2.4 Free sources (licences)
| Source | Licence | Safe? | Use for us |
|---|---|---|---|
| Quaternius Modular Character Outfits (Fantasy) + Universal Base Characters | CC0 [source] | Yes | reference for shapes; not football kit |
| KayKit (characters, animations) | CC0 [source] | Yes | too blocky for our style |
| Kenney | CC0 (handbook) | Yes | too blocky |
| MakeHuman / MPFB core assets | CC0 core; community clothes CC0 or CC-BY, check each [source] | Core yes | shirt/trouser shapes to copy |
| Mixamo | royalty-free in games; no redistributing raw files [source] | Yes inside the game | no clothing worth taking |
| VRoid | presets usable commercially unless an item says otherwise; Booth add-ons often restrict [source] | Careful | anime style, not ours |
| Ready Player Me | docs host not reachable from this session | Not checked | — |

Conclusion [reasoned]: no free pack gives football kits on our skeleton. Making the clothes from our own
body (this proof) is cheaper and fits every clip and head.

### 2.5 Blender
`blender` is installed here (4.0.2). It cannot open our packed bodies: "EXT_meshopt_compression is not
available on this addon version" [measured]. A Blender route (shrinkwrap + solidify + weight transfer)
would need unpacked source bodies. The proof does the same jobs in three.js at load, so it works on the
packed files and needs no export [measured].

## 3. The recommendation

Do these in order. Stop painting clothes onto the body's texture.

1. **Clothes are made from the body, at load, cached per head + build + outfit** (`clothes.ts` approach).
   Each garment is the body's own surface cut along named landmark lines, pushed off the skin 4-13 mm,
   skinned to the same skeleton with the body's own weights (every clip fits). Buys: real silhouette, clean
   edges. Cost: +33% triangles for a kit, 0 textures.
2. **Every edge is a cut at a landmark, never a painted line.** Neck ring, collar line, shoulder seam,
   sleeve end, wrist, hem, waist, shorts end, sock top, sock end, ankle. Triangles are split exactly on the
   line, new vertices take mixed skin weights. Each open edge gets a lip down to the skin (thickness and a
   darker contact line). The body is deleted 1.5 cm inside every edge.
3. **Colour edges inside a garment are mesh edges or crisp lines.** Contrast sleeves = a second piece cut
   on the same shoulder seam (its own material). Stripes and hoops = a square wave on rest position,
   anti-aliased per pixel. Trim, collar, sock tape = a fixed distance from an edge. Crest, number, sponsor =
   decals from rest position. None read from the body texture.
4. **Shading per material:** a 3-step toon ramp from smoothed normals, a sheen band (polyester thin,
   wool wide, cotton almost none), a faint knit for wool. Smoothing moves points only outward along the
   normal (sideways moves dragged trim lines into zigzags) [measured].
5. **Merge to one cloth mesh per person** (garment id → colour slots in one material): 4 draws per person.
   Far LOD drops cloth ink and socks.
6. **Then** cut scenes first (1-5 people, close up), the match last, after a phone frame-meter check.

What the data already drives, without re-authoring [measured in the proof]:
- **Football kits:** shirt, trim, shorts, socks colours from `kitsOf(club)` or `nationKits.ts`. The
  pattern words go through the existing `parseKitPattern` → stripes, hoops, contrast sleeves. Sleeve colour
  from `sleevesHex`. Proof: Argentina home, Austria home, American Samoa away (proof-patterns.png).
- **Tracksuits:** same as the kit with long sleeves (wrist cut) and trouser legs (ankle cut), poly sheen,
  a trim band on cuffs and a zip line as a decal [reasoned, not built].
- **Jumper over a shirt:** shirt (high crew + folded collar, cuffs past the jumper) under a wool jumper (V
  cut, ribbed hem and cuffs) and cotton trousers. Colours from the people presets (`suit.coat`,
  `suit.shirt`, `suit.trousers`) [measured].
- **Suits:** coat = jumper recipe with a lapel piece and an opening down the front; shirt + tie under it
  [reasoned, not built: lapels and tie are new geometry].

Stop doing: kit and suit colour by mask texture; the "skin-coloured texel is skin" rules; multiplying the
generated texture's paint into cloth. Keep the mask only for skin vs hair on the head.

## 4. The proof

Same body (preset prs-reporter: h6, Tall build), same idle pose, camera and light, 780x1688 per panel,
today left, cloth right.
- `proof-kit.png`: Liverpool kit, full body. Crew collar band of even width, sleeve trim, shirt tucked
  2 cm under the shorts' waistband (a darker waistband band on the shorts), plain shorts hem, modelled
  socks with a tape band.
- `proof-jumper.png`: three-quarter. V-neck wool jumper, shirt collar and white cuffs showing, trousers.
- `proof-neck.png`: kit neck close-up. `proof-neck-jumper.png`: jumper neck close-up.
- `proof-edges.png`: the six edges side by side (collar, sleeve end, shirt hem, shorts hem, sock top, cuff).
- `proof-patterns.png`: stripes, contrast sleeves, hoops from real nation-kit data, today top, cloth bottom.

How it was made: `buildClothes` in `tools/clothes3d/clothes.ts`; the landmarks are in `proof-page.tsx`
(`LM`). The painted kit still under the cut is turned into the body's even skin colour, so no other skin
tone shows at an edge.

### My honest verdict
- **Kit: yes, show it.** Every edge is a straight, clean line at a landmark, with a lip: collar, sleeve end,
  waistband, shorts hem, sock top, sock end. The neck is clean skin into an even white collar band. No
  colour of one garment sits on another's surface (the shirt tucks under the shorts' waistband). Stripes,
  hoops and black sleeves have hard borders from real nation-kit data. Crest and sponsor are sharp. Harry
  should not say "blobs of paint" about this one.
  Small faults left: the standing part of the collar is a touch uneven on top at close range; the
  waistband is a shade band, not a raised band; a few short ink ticks at the shorts' edge.
- **Jumper: better than today, not yet good enough to show alone.** The V, ribbed hem and cuffs are clean.
  The shirt collar is a flat faceted white ribbon (not a folded collar), the V's left edge has small steps,
  one small white fleck (a crack in the jumper shell) shows on the chest, and soft shading patches remain.
  Fix: a modelled collar piece placed on the neck loop, not grown from the cut edge.
- **Not built:** polo collar, suit lapels, tie, tracksuit. Not tested on other heads/builds or in motion
  (only the idle pose). Frame time not measured.

## 5. Rollout plan

Times are estimates for one builder, not measured.

| Step | What | Visual gain | Cost (22 on screen) | Time |
|---|---|---|---|---|
| 1 | Move `clothes.ts` into `lib/star/style3d/toon/clothes/`; cache per head + build + outfit | — | build once per scene load | 1 day |
| 2 | Landmarks from each head's own joints + kit lines; check on all 12 heads x 3 builds (contact sheet), and on run / sit / kneel clips (no poke-through) | edges right on every body | — | 2 days |
| 3 | Kit outfit from data: `kitsOf(club)` and `nationKits.ts` (shirt, trim, shorts, socks, `sleevesHex`, pattern words via `parseKitPattern`). 211 nations x 2 kits and every club kit are just colour slots + pattern kind; no per-kit authoring | every kit clean | 0 textures; one crest canvas per club, one digit atlas | 1 day |
| 4 | Merge garments into one cloth mesh per person, colour slots by garment id | — | 88 draws (vs 44 today, 176 unmerged), 0.87 M tris | 1-2 days |
| 5 | Cut scenes: jumper, shirt collar piece, tracksuit, suit (lapel + tie pieces), polo | press room, office, signing look like clothes | 1-5 people: negligible | 3-4 days |
| 6 | Match: LOD (far players: no cloth ink, no socks mesh, ~3 draws) and a frame-meter check on a mid Android | 3D match kits | ~66 draws far, 88 near | 1-2 days |
| 7 | Remove kit / suit painting from the body shader once every scene uses cloth | simpler shader | small saving | 1 day |

Order: cut scenes first (few people, close up, where Harry saw the faults), the match last.

## Sources
- Ready Player Me, custom outfits: https://docs.readyplayer.me/ready-player-me/customizing-guides/create-custom-assets/create-custom-outfits (read via search summary; host blocked here)
- Reallusion, hiding body meshes: https://manual.reallusion.com/Character-Creator-4/Content/ENU/4.0/08_Cloth/Automatically_Hiding_Inner_Meshes.htm
- Fab Dynamic Mesh Occluder: https://www.fab.com/listings/74734a8d-f8d3-4474-810b-f4577cdb769b
- Unreal forum, hiding the body under clothing: https://forums.unrealengine.com/t/do-video-games-hide-the-player-model-underneath-the-clothing/33335
- Roblox layered accessories and cages: https://create.roblox.com/docs/avatar/layered-accessories , https://create.roblox.com/docs/avatar/layered-accessories/caging-best-practices
- Sims 4 null body (community): https://db.modthesims.info/d/542279
- EA FC cloth (Frostbite GPU cloth): https://www.ea.com/en-gb/news/2024-ea-sports-latest-tech-innovations
- EA SEED Swish (Madden): https://www.ea.com/seed/news/swish-neural-network-cloth-sim-in-madden-nfl-21
- Genshin shader breakdowns (community): https://adrianmendez.artstation.com/projects/wJZ4Gg , https://juejin.cn/post/7207631397094948920
- Cloth sheen: https://www.cryengine.com/docs/static/engines/cryengine-3/categories/1114113/pages/1048603 , https://docs.blender.org/manual/en/4.2/render/shader_nodes/shader/sheen.html , https://novedge.com/blogs/design-news/v-ray-tip-creating-realistic-fabric-materials-with-v-ray-sheen
- Quaternius outfits (CC0): https://quaternius.com/packs/modularcharacteroutfitsfantasy.html
- KayKit (CC0): https://kaylousberg.itch.io/kaykit-adventurers
- MakeHuman licence: https://static.makehumancommunity.org/about/license.html , https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html
- Mixamo FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- VRoid guidelines: https://vroid.com/en/studio/guidelines
- three.js skinned batching: https://discourse.threejs.org/t/how-to-batch-skinned-mesh/30348 , https://discourse.threejs.org/t/optimization-of-large-amounts-100-1000-of-skinned-meshes-cpu-bottlenecks/58196
