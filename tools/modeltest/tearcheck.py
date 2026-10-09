"""Tear check: plays clips on a fitted player and measures how far any edge stretches.
blender -b --python tools/modeltest/tearcheck.py -- <anim.glb> run,kick_r,sprint
Reports, per clip (units: cm, the rig is in centimetres), the worst edge stretch
frame and the share of edges stretched past 1.5x. A tear shows as a huge worst value."""
import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=argv[0])
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
pl = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm][0]
sc = bpy.context.scene
ACTS = {a.name.split("_Armature")[0]: a for a in bpy.data.actions}
arm.animation_data_create()
for t in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(t)
edges = [tuple(e.vertices) for e in pl.data.edges]
rest = [(pl.data.vertices[a].co - pl.data.vertices[b].co).length for a, b in edges]
for name in argv[1].split(","):
    a = ACTS[name]; arm.animation_data.action = a
    worst = 1.0; over = 0; n = 0
    f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
    for f in range(f0, f1 + 1, 2):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get(); dg.update()
        m = bpy.data.meshes.new_from_object(pl.evaluated_get(dg))
        vs = m.vertices
        s = arm.matrix_world.to_scale().x  # mesh is under the armature's scale
        for (i, j), r in zip(edges, rest):
            if r < 1e-6: continue
            k = (vs[i].co - vs[j].co).length / r
            if k > worst: wat = (f, tuple(round(x, 2) for x in pl.data.vertices[i].co), round(r, 2), round(k * r, 1))
            worst = max(worst, k); n += 1
            globals()["dl"] = max(globals().get("dl", 0), k * r - r)
            if k > 1.5 and r > 1.0: big = globals().get("big", 0) + 1; globals()["big"] = big
            if k > 1.5: over += 1
    print("TEAR", name, "worst stretch", round(worst, 2), "edges >1.5x", f"{100 * over / max(1, n):.3f}%", "worst at (frame, rest pos, rest cm, stretched cm)", wat,
          "| edge-frames over 1.5x that were 1cm+ long at rest:", globals().get("big", 0))
    print("TEAR", name, "largest gap an edge opened (cm)", round(globals().get("dl", 0), 2)); globals()["big"] = 0; globals()["dl"] = 0
