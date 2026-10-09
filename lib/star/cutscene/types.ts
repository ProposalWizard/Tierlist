/**
 * THE CUT-SCENE SYSTEM — the shapes everything shares.
 *
 * Harry, 9 Oct 2026: "build a foundation and system that will be translatable
 * for any cut scenes … don't put limits." And the end goal: "in a story mode
 * we wouldn't have to preset a cut scene. A certain set of events occur that
 * lead to X outcome, and we could build that cut scene through the context of
 * events in the game without it being pre built."
 *
 * So there are three layers, and this file holds the data each one passes on:
 *
 *   StoryEvent ──(story.ts: beat grammar)──▶ Beat[]
 *   Beat[]     ──(cinema.ts + perform.ts)──▶ CutsceneScript  (a timeline)
 *   CutsceneScript ──(director.ts)──────────▶ pictures, from t alone
 *
 * A script can also be written by hand (fixtures.ts) — it is the same data.
 * Everything in a script is plain JSON-able data: no functions, no three.js.
 *
 * THE PEOPLE LAYER (faces, expressions, hands, props on hand bones, IK,
 * look-at) is another builder's: `CutsceneActor` below is the agreed
 * interface. peopleAdapter.ts picks the implementation (today the stub in
 * peopleStub.ts, built on people3d.ts; swap one line for people.ts).
 */
import type * as THREE from "three";
import type { StyleId } from "../style3d/styles";

export type Vec3 = [number, number, number];

// ═════════════════════════════════════════════════════════════════════════
// 1. THE SCRIPT (the timeline)
// ═════════════════════════════════════════════════════════════════════════

/** Where it happens. Each has a builder (locations3d.ts) and named marks (presets/locations.ts). */
export type LocationId =
  | "office" | "tunnel" | "pitch" | "dressing-room" | "awards-stage"
  | "press-room" | "training-ground" | "airport" | "garden";

/** Time of day and feeling: sky, sun, grade (presets/moods.ts). */
export type MoodId =
  | "golden-hour" | "floodlit-night" | "overcast" | "interior-warm"
  | "interior-cool" | "dawn" | "rain-night" | "spotlight";

/** Who someone is in the scene. Casting fills each from career data. */
export type Role =
  | "you" | "manager" | "chairman" | "teammate" | "captain" | "rival"
  | "keeper" | "journalist" | "presenter" | "fan" | "agent" | "physio" | "family" | "mentor";

/** How an actor looks. `from: "career"` means: fill it in from the save. */
export interface ActorLook {
  body?: "player" | "player-buzz" | "player-long" | "manager";
  skin?: string;
  hair?: string;
  /** Manager / chairman: how grey (0..1). */
  grey?: number;
  /** Shirt colours; omitted = the role's default (your club for you and team-mates). */
  kit?: { shirt: string; trim: string };
  /** What he wears over or instead of the kit. */
  outfit?: "kit" | "tracksuit" | "suit" | "casual" | "keeper" | "training-bib";
  number?: number | null;
  accessories?: { slot: string; color: string; color2?: string; stripes?: string[] }[];
  /** A fitted face picture (faceFit.ts): passed straight to the people layer. */
  face?: unknown;
}

export interface CastMember {
  /** The id tracks use ("you", "boss", "m7" …). */
  id: string;
  role: Role;
  look?: ActorLook;
  /** Where he stands at t = 0: a mark name or a point. */
  mark?: string | Vec3;
  /** Which way he faces at t = 0: degrees (0 = +z), or a mark/actor to face. */
  face?: number | string;
  /** Only in some careers (see Cond). */
  when?: Cond;
}

/** A thing in someone's hand, or on the set. */
export type PropKind =
  | "pen" | "contract" | "shirt" | "trophy-cup" | "trophy-league" | "mic" | "mic-stand"
  | "phone" | "scarf" | "ball" | "champagne" | "camera" | "medal" | "boots" | "bag"
  | "flag" | "corner-flag" | "clipboard" | "water-bottle" | "armband" | "award-statue" | "chair";

export interface PropSpec {
  id: string;
  kind: PropKind;
  /** Resting place at t = 0: a mark, a point, or nowhere (hidden until attached). */
  at?: string | Vec3;
  /** Its turn about Y at rest, degrees. */
  yaw?: number;
  /** Colours (a shirt in club colours, a scarf …). */
  color?: string;
  color2?: string;
  /** Shirt: the number and name on the back. */
  number?: number | null;
  label?: string;
  scale?: number;
  when?: Cond;
}

/** A target an actor reaches for, looks at, a camera frames … */
export type Target =
  /** An actor: a body part, or a point in his own frame (x = his left, y up, z = his front; from his feet). */
  | { actor: string; part?: BodyPart; local?: Vec3 }
  | { prop: string; handle?: string }
  | { mark: string; y?: number }
  | { point: Vec3 }
  | { camera: true };

export type BodyPart =
  | "head" | "eyes" | "chest" | "hips" | "feet" | "hand.L" | "hand.R"
  | "shoulder.L" | "shoulder.R" | "knee.L" | "knee.R";

/** Named hand shapes (fingers). The people layer may know more. */
export type HandPose =
  | "relax" | "open" | "flat" | "fist" | "point" | "thumbs-up" | "pen"
  | "shake" | "grip" | "pinch" | "clap" | "wave" | "spread";

/** Faces. The people layer draws them; the stub only tilts the head a touch. */
export type Expression =
  | "neutral" | "smile" | "grin" | "elated" | "proud" | "determined" | "focused"
  | "tense" | "sad" | "crying" | "angry" | "shocked" | "disappointed" | "smirk"
  | "talking" | "shout" | "eyes-closed";

/** Procedural whole-body holds the performance layer can lay over a clip. */
export type PoseHold =
  | "sit" | "stand" | "kneel" | "knee-slide" | "arms-wide" | "arms-up" | "fist-pump"
  | "hold-shirt-up" | "trophy-overhead" | "trophy-chest" | "point-sky" | "badge-kiss"
  | "hands-on-head" | "head-down" | "applaud" | "lean-desk" | "hands-on-hips"
  | "arms-folded" | "salute-crowd" | "kneel-pray" | "lean-in" | "lean-back" | "nod" | "hand-on-shoulder";

/** The camera's framing presets (presets/camera.ts turns these into a lens and a place). */
export type ShotPreset =
  | "establishing" | "wide" | "full" | "medium-wide" | "medium" | "medium-close"
  | "close" | "extreme-close" | "ots" | "two-shot" | "low-hero" | "high-angle"
  | "insert" | "pov" | "profile" | "dutch" | "top-down" | "crowd";

/** How a shot moves while it is on screen. */
export type CameraMove =
  | "static" | "dolly-in" | "dolly-out" | "push" | "pull" | "orbit-left" | "orbit-right"
  | "crane-up" | "crane-down" | "track" | "follow" | "zoom-in" | "zoom-out";

export interface ShotSpec {
  preset: ShotPreset;
  /** Who/what the shot is about. */
  subject: Target;
  /** A second subject (two-shot, over-the-shoulder: the shoulder's owner). */
  subject2?: Target;
  /** Which side of the line of action (looking from subject2 → subject: +1 right, −1 left). */
  side?: 1 | -1;
  /** Extra turn round the subject, degrees (0 = the preset's own). */
  yaw?: number;
  /** Extra height, metres. */
  rise?: number;
  /** Lens, mm (full-frame equivalent). Omitted: the preset's own. */
  lens?: number;
  move?: CameraMove;
  /** How much it moves (preset units: metres for dolly, degrees for orbit). */
  moveAmount?: number;
  /** Handheld shake, 0..1. */
  shake?: number;
  /** Where focus is (rack focus: changes over the shot from `subject` to this). */
  focus?: Target;
  /** Fixed camera (overrides the preset): absolute place and look point. */
  fixed?: { pos: Vec3; look: Vec3; lens?: number };
}

/** Optional on every track: only in careers where this is true. */
export interface Cond {
  home?: boolean;
  trophy?: string | string[];
  emotion?: string | string[];
  rivalPresent?: boolean;
  minStakes?: number;
  maxStakes?: number;
  flag?: string;
  not?: Cond;
}

interface TrackBase { at: number; when?: Cond }

/** Play a body clip (by name; clipAlias in presets/clips.ts finds a stand-in). */
export interface ClipTrack extends TrackBase {
  type: "clip"; actor: string; clip: string;
  /** How long it plays (else until the next clip). */
  dur?: number;
  /** Start this far into the clip. */
  from?: number;
  speed?: number; loop?: boolean;
  /** Seconds to fade in from the last clip, and out at `dur`. */
  blendIn?: number; blendOut?: number;
  /** Freeze the clip at this time (a held pose from a clip). */
  hold?: number;
}

/** A whole-body hold laid over the clip (IK and bone turns). */
export interface PoseTrack extends TrackBase {
  type: "pose"; actor: string; pose: PoseHold; dur: number;
  blendIn?: number; blendOut?: number;
  /** 0..1, how far. */
  amount?: number;
  /** Things the pose holds (trophy-overhead: the trophy prop's id). */
  prop?: string;
}

/** Walk / jog / run somewhere along a path, the feet matched to the ground. */
export interface MoveTrack extends TrackBase {
  type: "move"; actor: string; dur: number;
  /** Points (marks or places); the actor's place at `at` is the first point unless `from` is given. */
  path: (string | Vec3)[];
  from?: string | Vec3;
  /** The gait clip (walk, jog, sprint …); its speed is matched to the path. "none": slide (a step while standing up). */
  gait?: string;
  /** Face along the path (default), or a fixed yaw / target. */
  facing?: "path" | number | Target;
  /** Ease in and out (0 = constant speed). */
  ease?: number;
}

/** Turn to face something (in place). */
export interface TurnTrack extends TrackBase { type: "turn"; actor: string; dur: number; to: number | Target }

/** Put an actor somewhere at once (a cut: the editor moved him). */
export interface PlaceTrack extends TrackBase { type: "place"; actor: string; to: string | Vec3; yaw?: number | Target }

/** IK: a hand reaches for a target and holds it there. */
export interface ReachTrack extends TrackBase {
  type: "reach"; actor: string; hand: "L" | "R"; target: Target; dur: number;
  blendIn?: number; blendOut?: number;
  /** The hand shape while there. */
  grip?: HandPose;
  /** Offset from the target, metres (world). */
  offset?: Vec3;
  /** Pump up and down (a handshake): metres, per second. */
  pump?: [number, number];
  /** The hand's way, in the actor's own frame: fingers along, palm towards. Omitted: the clip's. */
  along?: Vec3; palm?: Vec3;
  /** The elbow (or knee) bends towards this, actor's frame. */
  pole?: Vec3;
  /** Put the held tool's grip point (not the wrist) on the target (picking up a pen). */
  toolGrip?: boolean;
}

/**
 * The tip of a held prop follows a path drawn on another prop's surface
 * (the pen signing the contract: `along: { prop: "contract", path: "signature" }`).
 */
export interface TraceTrack extends TrackBase {
  type: "trace"; actor: string; hand: "L" | "R"; tool: string;
  along: { prop: string; path: string }; dur: number;
  /** Lift between strokes, metres. */
  lift?: number;
  /** The writing hand's way, actor's frame (default: a right-handed writer's). */
  handAlong?: Vec3; handPalm?: Vec3;
  /** Lead in from / out to the tool's resting point over this long, s. */
  leadIn?: number; leadOut?: number;
}

/** Hand shape on its own (no reach). */
export interface HandTrack extends TrackBase { type: "hand"; actor: string; hand: "L" | "R" | "both"; pose: HandPose; dur: number; blendIn?: number }

/** A prop changes hands, appears, goes. */
export interface PropTrack extends TrackBase {
  type: "prop"; prop: string;
  action: "attach" | "detach" | "show" | "hide" | "place";
  /** attach: whose hand (and which). */
  actor?: string; hand?: "L" | "R";
  /** attach to a body part instead of a hand (a scarf on the neck, a medal). */
  part?: BodyPart;
  /** place / detach: where it goes. */
  to?: string | Vec3;
  yaw?: number;
  /** Move to the new place over this long (else at once). */
  dur?: number;
  /** A flight: lift this high in the middle of the move (a ball struck, a thrown shirt). */
  arc?: number;
}

export interface FaceTrack extends TrackBase { type: "face"; actor: string; expression: Expression; dur?: number; amount?: number; blendIn?: number }
export interface LookTrack extends TrackBase { type: "look"; actor: string; target: Target; dur: number; amount?: number; blendIn?: number; blendOut?: number }
export interface SpeakTrack extends TrackBase { type: "speak"; actor: string; dur: number; line?: string; /** A recorded line (voiceLines.ts): the mouth and head move with its loudness. */ cue?: string }

export interface CameraTrack extends TrackBase {
  type: "camera"; shot: ShotSpec; dur: number;
  /** How we get here from the last shot: a cut (default), a blend over `blend` s, a whip pan, a fade. */
  cut?: "cut" | "blend" | "whip";
  blend?: number;
  /** A label for the shot (the dev page shows it). */
  name?: string;
}

export interface TransitionTrack extends TrackBase { type: "transition"; kind: "fade-in" | "fade-out" | "dip-black" | "dip-white" | "flash"; dur: number; color?: string }

export interface LightTrack extends TrackBase {
  type: "light"; dur: number;
  /** Exposure multiplier, key/sun intensity multiplier, a spotlight on an actor … */
  exposure?: number; sun?: number; spot?: { target: Target; intensity: number; color?: string };
}

export type FxKind =
  | "camera-flashes" | "confetti" | "rain" | "crowd-roar" | "fireworks" | "ticker-tape"
  | "smoke" | "sparks" | "streamers" | "dust" | "speed-lines" | "flare";

export interface FxTrack extends TrackBase { type: "fx"; fx: FxKind; dur: number; amount?: number; around?: Target; color?: string; colors?: string[] }
export interface LetterboxTrack extends TrackBase { type: "letterbox"; amount: number; dur?: number }
export interface CaptionTrack extends TrackBase { type: "caption"; text: string; dur: number; style?: "subtitle" | "title" | "lower-third" | "stamp"; speaker?: string }
export interface SoundTrack extends TrackBase { type: "sound"; cue: string; volume?: number }

export type Track =
  | ClipTrack | PoseTrack | MoveTrack | TurnTrack | PlaceTrack | ReachTrack | TraceTrack
  | HandTrack | PropTrack | FaceTrack | LookTrack | SpeakTrack | CameraTrack | TransitionTrack
  | LightTrack | FxTrack | LetterboxTrack | CaptionTrack | SoundTrack;

/** A named span of the timeline (story beats; the dev page shows them under the scrubber). */
export interface BeatMark { name: string; at: number; dur: number; act?: Act }

export type Act = "setup" | "build" | "moment" | "reaction" | "aftermath";

export interface CutsceneScript {
  id: string;
  title: string;
  duration: number;
  set: {
    location: LocationId;
    mood: MoodId;
    /** Art style; default A (golden). */
    look?: StyleId;
    /** Location options (office: the window view; pitch: which end …). */
    options?: Record<string, string | number | boolean>;
  };
  cast: CastMember[];
  props?: PropSpec[];
  tracks: Track[];
  beats?: BeatMark[];
  /** Text for the contract, the press backdrop …: {club}, {player} … are filled from the context. */
  text?: Record<string, string>;
  /** The seed every random thing in the scene uses (confetti, crowds, shake). */
  seed?: number;
  /** Where the script came from: a fixture, or the generator (with its event). */
  source?: { kind: "fixture" | "generated"; event?: StoryEvent; seed?: number };
}

// ═════════════════════════════════════════════════════════════════════════
// 2. CAREER CONTEXT (what a script is filled from) and STORY EVENTS
// ═════════════════════════════════════════════════════════════════════════

export interface ClubColours { name: string; short?: string; shirt: string; trim: string; third?: string }

/** Everything a cut scene may read from a save. All optional: defaults fill gaps. */
export interface CareerContext {
  player?: { name?: string; surname?: string; number?: number | null; skin?: string; hair?: string; hairStyle?: "short" | "long" | "buzz" | "none"; face?: unknown; accessories?: ActorLook["accessories"] };
  club?: ClubColours;
  opponent?: ClubColours;
  manager?: { name?: string; skin?: string; hair?: string; grey?: number };
  home?: boolean;
  trophy?: "league" | "fa-cup" | "league-cup" | "champions-league" | "europa-league" | "ballon-dor" | "golden-boot" | "player-of-month";
  season?: number;
  /** Any extra yes/no facts a Cond can test (`flag`). */
  flags?: string[];
}

export type EventKind =
  | "signed" | "scored" | "won-trophy" | "injured" | "dropped" | "sacked"
  | "record-broken" | "transfer-request" | "rivalry" | "debut" | "walkout"
  | "press-conference" | "award" | "promoted" | "relegated" | "retired" | "arrival" | "mentor-advice";

export type Emotion =
  | "joy" | "pride" | "relief" | "defiance" | "anger" | "sadness" | "shock"
  | "tension" | "calm" | "gratitude" | "hunger" | "inspired";

/** A thing that happened in the game, with its context: the generator's input. */
export interface StoryEvent {
  kind: EventKind;
  /** Who is in it, beyond you. */
  with?: Role[];
  /** A location hint (else the planner picks). */
  where?: LocationId;
  /** How much it matters, 0..1 (a pre-season friendly goal 0.1, a cup-final winner 1). */
  stakes: number;
  /** How you feel about it. */
  emotion: Emotion;
  /** How intense, 0..1. */
  intensity?: number;
  rivalPresent?: boolean;
  home?: boolean;
  /** Relationships, −1..1 (manager, fans, rival). */
  relationships?: Partial<Record<"manager" | "fans" | "rival" | "teammates", number>>;
  /** Recent history: a streak, a drought, "first", "last" … */
  history?: { streak?: number; drought?: number; first?: boolean; last?: boolean; previousClub?: string };
  /** Details: minute, score, the trophy, the record's name, the injury … */
  detail?: { minute?: number; score?: string; trophy?: CareerContext["trophy"]; record?: string; injury?: string; fee?: string; opponent?: string; question?: string; answer?: string };
  /** Time of day if known (a night match). */
  night?: boolean;
  career?: CareerContext;
}

// ═════════════════════════════════════════════════════════════════════════
// 3. THE PEOPLE LAYER — the agreed interface (people.ts implements it)
// ═════════════════════════════════════════════════════════════════════════

/** What the director asks for when it casts someone. */
export interface ActorSpec {
  id: string;
  role: Role;
  look: Required<Pick<ActorLook, "body" | "skin">> & ActorLook;
  /** Quality tier's choices. */
  outline: number;
  castShadow: boolean;
}

/**
 * One actor. The director poses him every frame, from t alone, in this order:
 *   beginFrame → poseClips → setRoot → pose holds (bones) → reach / hands →
 *   lookAt → setExpression / setBlink / setMouth → endFrame
 * Nothing here may keep state between frames that t does not decide
 * (seek(t) must give the same picture whichever frame came before).
 */
export interface CutsceneActor {
  readonly id: string;
  readonly root: THREE.Object3D;
  /** Clip names this body can play. */
  clips(): string[];
  clipDuration(name: string): number;
  /** Bind pose, every weight to 0. */
  beginFrame(): void;
  /** [clip, time, weight][] — sampled now (no internal clock). */
  poseClips(entries: [string, number, number][]): void;
  /** The root on the floor: position (y = floor height) and yaw (radians, 0 faces +z). */
  setRoot(pos: Vec3, yaw: number): void;
  /** A bone by its rig name (Hips, Spine, Spine01, Spine02, neck, Head, LeftArm …). */
  bone(name: string): THREE.Object3D | null;
  /** World point of a body part, now. */
  point(part: BodyPart): THREE.Vector3;
  /** Bend the upper body forward (+) / back (−), radians. */
  lean(rad: number, side?: number): void;
  /** Keep the lowest foot on the floor (clips' legs differ from bodies'). */
  plantFeet(weight: number): void;
  /** Arm IK: the wrist to `wrist` with the hand's fingers along `along`, palm to `palm` (world). */
  reach(hand: "L" | "R", wrist: THREE.Vector3, along: THREE.Vector3 | null, palm: THREE.Vector3 | null, weight: number, pole?: THREE.Vector3): void;
  /** Leg IK: the ankle to `ankle`, the knee bending towards `pole`. */
  reachFoot(foot: "L" | "R", ankle: THREE.Vector3, weight: number, pole?: THREE.Vector3): void;
  /** Finger shape (a name, or the people layer's own numbers). */
  hand(hand: "L" | "R", pose: HandPose, weight: number): void;
  /**
   * Where a held prop's grip point is in the world, and its axis, for this
   * grip. `pen`: the pen's tip and its barrel's direction (tip → back).
   */
  gripFrame(hand: "L" | "R", grip: HandPose): { pos: THREE.Vector3; axis: THREE.Vector3; up: THREE.Vector3 };
  /** Head and neck (and eyes, if it has them) towards a point, `weight` of the way. */
  lookAt(target: THREE.Vector3, weight: number): void;
  setExpression(expr: Expression, amount: number): void;
  setBlink(closed: number): void;
  setMouth(open: number): void;
  /** After everything: world matrices up to date. */
  endFrame(): void;
  /** Style kit hooks (outline, materials). */
  readonly person?: unknown;
  dispose(): void;
}

export interface CutscenePeople {
  create(spec: ActorSpec): Promise<CutsceneActor>;
  dispose(): void;
}

/** Everything a people layer needs to start. */
export interface CutscenePeopleInit {
  T: typeof import("three");
  SkeletonUtils: { clone(o: THREE.Object3D): THREE.Object3D };
  loader: unknown;
  /** "new" = the one body with fingers (Settings → Look → 3D people). */
  body: "new" | "old";
}
