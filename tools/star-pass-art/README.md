# Star Pass art

Every picture and 3D model on the Star Pass road is made here, in Blender, from
simple shapes (no downloaded models, no real brands). Run with the Blender in
the cloud session (`/usr/bin/blender`, 4.0).

| Script | Makes |
|---|---|
| `render_star_pass.py` | podiums, boxes, the level-100 stand |
| `render_star_pass_items.py` | the first test rewards and the figurine footballer (`footballer()`, `apply_pose()`) |
| `render_pass_rewards.py` | the 17 collectibles of 25 Oct 2026 |
| `render_pass_rewards_more.py` | the 31 rewards that were a plain box (boots, wearables, celebrations, run-ups) and stills for the two live-3D cards (28 Oct 2026). `GLB=1` exports every reward (these and the 17) as a model for the tap-to-preview |
| `export_live3d.py` | podium models (`podium-<theme>-<tier>`), the Star Ball, the Gold Aviators footballer |
| `make_webp.py` | frames -> one WebP, cropped round the podium |
| `build_stills.py` | runs make_webp on every `render_pass_rewards_more.py` still and writes `lib/star/starPassArtData.ts` |

## Remake the 28 Oct rewards

```bash
OUT=/tmp/sp; mkdir -p $OUT/png $OUT/glb
blender -b --factory-startup -P tools/star-pass-art/render_pass_rewards_more.py -- $OUT/png 48 all   # ~1 h on CPU
python3 tools/star-pass-art/build_stills.py $OUT/png                                              # -> public/star/star-pass/reward-<job>.webp
GLB=1 blender -b --factory-startup -P tools/star-pass-art/render_pass_rewards_more.py -- $OUT/glb 1 all
cp $OUT/glb/*.glb public/star/star-pass/3d/ && node scripts/perf3d/shrink-models.mjs <each new file>
```

Draft first: `... -- $OUT/png 6 all` renders all 33 in about 2 minutes at half size.

## Rules

- One camera per tier in `render_pass_rewards_more.py` (`CAM`): every medium
  reward is framed alike, every great one too. The screen gives every medium
  reward the same box and every great (10th) one a bigger box
  (`components/star/StarRatingSheet.tsx`, `SLOT_*`).
- A reward stands on the podium of its level in `DEFAULT_PASS_LEVELS`
  (`lib/star/rewardCatalogue.ts`). Moving a card to another level on
  `/admin/star-pass` keeps its picture's podium.
- Which card uses which still and model: `lib/star/starPassArt.ts` (`JOB_OF`).
- The road shows stills only; live 3D runs only in the tap-to-preview (one
  canvas at a time). Many WebGL canvases on the road made it lag.
