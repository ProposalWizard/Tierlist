/**
 * Which people layer the cut-scene director uses. Today: the stand-in built
 * on people3d (peopleStub.ts). When the people layer lands
 * (lib/star/cutscene/people.ts, implementing CutscenePeople from types.ts),
 * change this one line to:
 *
 *   export { createCutscenePeople } from "./people";
 */
export { createStubPeople as createCutscenePeople } from "./peopleStub";
