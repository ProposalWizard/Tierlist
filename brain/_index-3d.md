# Brain index 3d
ID | summary | tags
FACT-3D-001 | Low tier (old Android, low PC) may run 3D at a steady 30 fps with the same picture. | three-d
FACT-3D-002 | scripts/perf3d/shrink-models.mjs packs the GLBs in place (meshopt, WebP, Draco); a new file needs a POLICY line. | three-d
PRO-3D-001 | Any 3D, animation, mocap, model or cut-scene work: merge main first, then read docs/3D_HANDBOOK.md. | three-d,deploy
RUL-3D-001 | Fully 3D games are the exception: own physics and rules in lib/star/play3d/, never importing canvasEngine.ts. | engine,three-d,rule
RUL-3D-002 | No Higgsfield use by any builder until Harry says otherwise (about 730 credits used on 20 Oct). | three-d
RUL-3D-003 | Delete every Higgsfield image, video and 3D model there once a round is done, keeping copies in the repo first. | three-d
RUL-3D-004 | [SUPERSEDED] Higgsfield is ON for now; always say what is being made there. | three-d
RUL-3D-005 | No body part may pass into another in any 3D clip or pose; measure it with the self-overlap check. | three-d,process
RUL-3D-006 | 3D sizes never change: every man, the keeper and the goal keep ONE fixed scale in every chance and frame. | three-d,rule
RUL-3D-007 | Every GLTFLoader must call withMeshopt(loader) or it fails on the packed GLB files. | three-d,rule
RUL-3D-008 | 3D games take shared basics (ball size, gravity, how skills scale a kick) from one shared file. | three-d
