/**
 * ONE ABSOLUTE SIZE FOR EVERYTHING ON A 3D PITCH (Harry, 12 Oct 2026).
 *
 * "Why can't the players just have a measurement on their own? Why is it 4% of
 * the screen? … why aren't they just a set size? Yes, they may look bigger when
 * the camera comes in, but at least they will always actually be the same size."
 *
 * Every man, the keeper and the goal are drawn at REAL size (× 1), the ball at one fixed 1.6× (13 Oct 2026),
 * on every 3D screen (the real match, Infinite Highlights / the Play Area, the
 * Match Lab, the drills, Free Roam, the anim test page) and with every camera
 * (New, Old, the set-piece camera, the broadcast camera). The only thing that
 * changes what you see is the camera's position and lens.
 *
 * A man's own build (playerLook height, Slim / Strong / Tall) still varies him
 * a little: that is HIS measurement, not the camera's. It sits on the model
 * under the root; the root itself is always exactly these numbers.
 *
 * Nothing here may be worked out from the screen, the camera's distance,
 * pixels per metre, the field of view, the framing or the chance.
 * tests/star/size3d.mts fails if anything does.
 */
export const SIZE3D = Object.freeze({
  /** Every outfield man's root scale (× real life). */
  man: 1,
  /** The keeper's root scale (× real life): the same as a man. */
  keeper: 1,
  /** The goal frame (posts, bar, net) (× real life). */
  goal: 1,
  /** The ball (× its real 0.11 m radius). 1.6 since 13 Oct 2026 (Harry picked "C" from real / 1.6× / 2×: at real
   *  size it is ~6 px on a phone and its black patches cannot show). Still ONE fixed size, every chance, every frame. */
  ball: 1.6,
});

/** A man's real height at scale 1, metres (the model's height; playerLook adds his own build on top). */
export const MAN_HEIGHT_M = 1.8;
