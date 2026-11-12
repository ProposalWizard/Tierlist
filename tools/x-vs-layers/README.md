# Which ball breaks all 20 layers? (12 Nov 2026)

Practice copy of @aptiqlabs "Which ball breaks all 20 layers?" (290k views) to learn the
format; never post the copy. Study: STUDY.md. Timeline measured from the original: plan_layers.json.

- `layers.py`: one Blender file per round (17). A disc breaks on the exact frame the ball
  reaches it; the counter reads the same frames. `check` proves it per disc, that no shard
  shows early and that no shard lands on the floor.
- `finish_layers.py`: labels ("Glass Ball", "Layers 3/20", "+ Gold"), sound, and the rewind
  ending (the last 1.9 s plays the tungsten round backwards, like the original).
- `render_layers.py --blender <Blender 4.1>`: everything in one go on a PC with a graphics card
  (`--test` = rounds 1, 7, 16 only). Output out/layers_full.mp4.

Lessons:
- The ball must NOT collide with the shards (collision collection 2): a kinematic ball moving
  through freshly released shards fires them across the room.
- Voronoi shards must be shrunk a little (gaps) or touching pieces push each other apart.
- An invisible cone around the tower (not rendered) keeps the rubble heaped like the original;
  for the heavy rounds it is tall, so the burst rains back down on the base.
- Thin the shards (45% of disc thickness) or the heavy-round heap stands as tall as the tower.
- Heavy balls pass several discs in one frame: break by the ball's position, not the clock.
