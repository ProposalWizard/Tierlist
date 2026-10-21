---
name: 3d-building
description: Load for ANY 3D, animation, mocap, motion-capture, clip, rig, body, model, GLB, Higgsfield, picture-to-3D, shop item, garden, casino, signing, office, cut scene, director, Look H, quality tier, governor, frame meter, three.js or Blender work on Knowitball. Points at docs/3D_HANDBOOK.md, the one front door to the 3D side (where everything is, how to add a clip or a model, the rules, what changed).
---

Standing rules: search the Brain first (grep brain/_index*.md), cite codes.

# Building on the 3D side

Harry built most of the 3D side. Leo and Mikey build on top of it from their own
branches. This skill makes sure you start from his latest work and use his tools.

## Do this, in order

1. **Merge `main` first** (PRO-3D-001). Harry decides when features reach `main` (RUL-TEAM-019).
   ```bash
   git fetch origin main
   git merge origin/main
   ```
   Shared files conflict most (`app/star-dev/page.tsx`, `lib/star/types.ts`,
   `lib/star/gameVersions.ts`, `lib/adminGuides.ts`, `scripts/perf3d/shrink-models.mjs`,
   `CLAUDE.md`). Keep both sides' additions.
2. **Read `docs/3D_HANDBOOK.md`.** All of it the first time; section 6 and
   "Recent changes" every time. Never guess a path: the handbook lists them.
3. **Run the 3D tests** for what you will touch:
   ```bash
   node scripts/run-star-tests.mjs perf3d play3d orbitCam practiceCam runPosture shop3d cutscene gameVersions assets3d
   npx tsc --noEmit
   ```
4. **Open the test page for your area** (handbook section 1) and look before you change.
5. **Follow the handbook's steps**: animations (section 3), models (section 4).
6. **Keep to the rules** (handbook section 5; Brain codes where one exists):
   no new New | Old row for a new look (RUL-UI-001, RUL-UI-003); fully 3D games
   use `lib/star/play3d` and never import `lib/star/canvasEngine.ts`
   (RUL-3D-001, RUL-3D-008); every GLTFLoader calls `withMeshopt`
   (RUL-3D-007, FACT-3D-002); no body part passes into another (RUL-3D-005);
   3D sizes never change (RUL-3D-006); no Higgsfield use until Harry says
   (RUL-3D-002) and delete what you made there after the round (RUL-3D-003).
   The 3D view of the real match only draws (the 2D match decides); no new
   realtime lights, use the governor; no real brands (handbook, no note yet).
7. **Commit your sources.** Scripts, concept pictures, raw GLBs go under
   `tools/<area>/` with a README. Anything left only in a scratch folder is lost
   when the cloud container ends.
8. **Check before you finish:** `node scripts/check-handbook-paths.mjs` (if you
   changed the handbook), `npx tsc --noEmit`, and the `star-playtest` agent for
   any change under `lib/star/`, `components/star/` or `app/star-dev/`.

If you add a 3D place, tool or rule, add a line to the handbook in the same commit.
