/**
 * A GOAL VIDEO ON THE PHONE — components/star/media/GoalVideoOld.tsx (the
 * goal video players see: Leo's update switch is off by default), drawn
 * from the goal's RECORDING, never a re-run: every play is the same goal,
 * frame for frame.
 *
 * Same as the website:
 *   - the recordings for the post's clip ids that this phone has (match/goalClip/store.ts),
 *     plus goals from matches you did not play, made by lib/star/goalClip/synth.ts,
 *     in the order they were scored; a Football Twitter stand-in for any it lacks;
 *     none at all: the post's `fallback` (a picture, never a fake play button);
 *   - the same cut (lib/star/goalClip/edit.ts makeEdit: broadcast, behind the goal,
 *     the fan's phone, TikTok; the author's own variant), the same frames
 *     (lib/star/goalClip/render.ts, ported as match/goalClip/render.ts onto the
 *     phone's sprites), the same still (posterMoment) with a play button;
 *   - in a feed it plays only when you press play, loops, one at a time;
 *     the speaker mutes every goal video (remembered), sound from the same plan
 *     (lib/star/goalClip/audio.ts planAudio) and the same files (match/goalClip/clipAudio.ts).
 * Different: the website encodes a video file, then plays it; the phone draws
 * the frames live (30 a second) as it plays, and makes the file only for
 * "Save video".
 *
 * "Save video" (the website's button, same place: under the video, after the
 * speaker): makes the MP4 on the phone (match/goalClip/makeVideo.ts: the same
 * frames, size, length and sound mix as the website's file), with a progress
 * bar and % on the video while it is made, then puts it in the phone's
 * gallery (asking permission the normal way). The website sends the file to
 * the share menu (where an iPhone keeps "Save Video"); the phone saves it
 * straight to the gallery and then offers "Share" for that menu. Made once a
 * session per goal and cut. A phone with no encoder (iPhone for now) says so.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Canvas, Picture, Group, Skia, createPicture, type SkPicture } from "@shopify/react-native-skia";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import { makeEdit, editDuration, posterMoment, type ClipStyle, type Edit } from "@/lib/star/goalClip/edit";
import { planAudio } from "@/lib/star/goalClip/audio";
import { synthTrack, type SynthGoal } from "@/lib/star/goalClip/synth";
import { setSkia } from "../match/skiaApi";
import { loadSpriteSheet } from "../match/spriteAssets";
import { drawEditFrame, prepareClipSprites, type ClipCredit } from "../match/goalClip/render";
import { getClips } from "../match/goalClip/store";
import { ClipSound } from "../match/goalClip/clipAudio";
import { canMakeVideo, makeGoalVideo, type MadeVideo } from "../match/goalClip/makeVideo";
import { installWebStorage } from "../match/webStorage";
import { recordDrawing } from "../draw/useDrawing";
import { getPrefs } from "../game/prefs";
import { C } from "../ui/theme";

setSkia(Skia);
installWebStorage();

/** The speaker on every goal video (lib/star/goalClip/sound.ts): one setting, starting as Settings → Sound is. */
let clipSound: boolean | null = null;
const soundSubs = new Set<() => void>();
function soundOn() { return clipSound ?? getPrefs().sound; }
function setSoundOn(v: boolean) { clipSound = v; soundSubs.forEach((f) => f()); }
/** One video plays at a time, like a feed. */
let playingNow: (() => void) | null = null;

/** recordedOrStandIn (lib/star/media/standIn.ts) on the phone's store, and the made goals. */
async function tracksFor(clipIds: string[], synth: SynthGoal[] = [], standIn?: SynthGoal[]): Promise<GoalTrack[]> {
  const made = synth.map(synthTrack).filter((t): t is GoalTrack => !!t);
  let rec: GoalTrack[];
  if (standIn && standIn.length === clipIds.length) {
    rec = [];
    for (const [i, id] of clipIds.entries()) {
      const [t] = await getClips([id]);
      if (t) rec.push(t); else { const s = synthTrack(standIn[i]); if (s) rec.push(s); }
    }
  } else rec = await getClips(clipIds);
  return clipIds.length ? [...rec, ...made].sort((a, b) => a.meta.minute - b.meta.minute) : made;
}

/** Videos made this session (encode.ts's `made`): a second save of the same goal and cut is instant. */
const madeVideos = new Map<string, MadeVideo>();
/** One video is made at a time. */
let makingNow = false;

async function toGallery(v: MadeVideo): Promise<"saved" | "denied"> {
  const p = await MediaLibrary.requestPermissionsAsync(true, ["video"]);
  if (!p.granted) return "denied";
  await MediaLibrary.Asset.create(v.uri);
  return "saved";
}

function mmss(s: number) { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }

export interface GoalVideoProps {
  clipIds: string[];
  synth?: SynthGoal[];
  standIn?: SynthGoal[];
  style: ClipStyle;
  variant?: number;
  credit?: ClipCredit;
  title: string;
  badge?: string;
  fallback: ReactNode;
  autoStart?: boolean;
}

export function GoalVideo({ clipIds, synth, standIn, style, variant = 0, credit, title, badge, fallback, autoStart = false }: GoalVideoProps) {
  const [tracks, setTracks] = useState<GoalTrack[] | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  // How far through: on the graphics side, so the bar moves without drawing the whole post again.
  const played = useSharedValue(0);
  const playedBar = useAnimatedStyle(() => ({ width: `${Math.round(played.value * 1000) / 10}%` }));
  const [audible, setAudible] = useState(soundOn());
  const empty = useMemo(() => createPicture(() => {}), []);
  const pic = useSharedValue<SkPicture>(empty);
  const synthKey = (synth ?? []).map((g) => g.seed).join(",");
  // Save video: null = idle, 0..1 = making.
  const [making, setMaking] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<MadeVideo | null>(null);
  const abort = useRef({ aborted: false });
  useEffect(() => () => { abort.current.aborted = true; }, []);

  useEffect(() => { const f = () => setAudible(soundOn()); soundSubs.add(f); return () => { soundSubs.delete(f); }; }, []);
  useEffect(() => {
    let live = true;
    tracksFor(clipIds, synth, standIn).then((t) => { if (live) setTracks(t); }).catch(() => { if (live) setTracks([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipIds.join(","), synthKey]);
  const edit = useMemo<Edit | null>(() => (tracks && tracks.length ? makeEdit(tracks, style, "new", variant) : null), [tracks, style, variant]);
  const tall = style === "fan" || style === "tiktok";
  const dispW = edit ? Math.round(tall ? Math.min(260, boxW * 0.64) : boxW) : 0;
  const dispH = edit ? Math.round((dispW * edit.h) / edit.w) : 0;
  const pr = 2;
  const frameAt = (t: number, poster = false) => {
    if (!edit) return empty;
    const k = dispW / edit.w;
    return recordDrawing(dispW, dispH, (ctx) => { ctx.scale(k, k); drawEditFrame(ctx, edit, t, credit, poster ? posterMoment(edit) : undefined); }, { pixelRatio: pr });
  };

  // The still: one frame, once every figure it uses has loaded (prepareClipSprites).
  useEffect(() => {
    if (!edit || !dispW) return;
    let live = true;
    void loadSpriteSheet().then(() => prepareClipSprites(edit.moves)).finally(() => {
      if (!live) return;
      pic.value = frameAt(0, true);
      setReady(true);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, dispW]);

  // Playing: the frames drawn live from the recording, the sound in step, looping.
  const soundRef = useRef<ClipSound | null>(null);
  useEffect(() => {
    if (!playing || !edit || !ready) return;
    const dur = editDuration(edit);
    const snd = (soundRef.current ??= new ClipSound(planAudio(edit), audible));
    snd.setAudible(audible);
    snd.warm();
    const stopMe = () => setPlaying(false);
    if (playingNow && playingNow !== stopMe) playingNow();
    playingNow = stopMe;
    let raf = 0, t0 = 0, lastDraw = -1;
    const loop = (now: number) => {
      if (!t0) t0 = now;
      const t = ((now - t0) / 1000) % Math.max(0.01, dur);
      const f = Math.floor(t * edit.fps);
      if (f !== lastDraw) { lastDraw = f; pic.value = frameAt(f / edit.fps); snd.at(t); }
      played.value = t / dur;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); snd.stop(); if (playingNow === stopMe) playingNow = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, edit, ready, audible]);
  useEffect(() => { if (autoStart && ready) setPlaying(true); }, [autoStart, ready]);
  useEffect(() => () => { soundRef.current?.stop(); }, []);

  const videoKey = `${clipIds.join(",")}|${synthKey}|${style}|${variant}|${credit?.handle ?? ""}`;
  const save = async () => {
    if (!edit || making !== null) return;
    if (!canMakeVideo()) { setNote("This phone can't make videos yet."); return; }
    let v = madeVideos.get(videoKey) ?? null;
    if (!v) {
      if (makingNow) { setNote("Another video is being made. Try again in a moment."); return; }
      makingNow = true;
      setNote(null);
      setMaking(0);
      try {
        v = await makeGoalVideo(edit, { credit, onProgress: setMaking, signal: abort.current });
      } catch {
        v = null;
        if (!abort.current.aborted) setNote("The video could not be made.");
      } finally {
        makingNow = false;
        if (!abort.current.aborted) setMaking(null);
      }
      if (!v) return;
      madeVideos.set(videoKey, v);
    }
    if (abort.current.aborted) return;
    try {
      const r = await toGallery(v);
      setSaved(v);
      setNote(r === "saved" ? "Saved to your gallery." : "No permission for the gallery. Tap Share to send it.");
    } catch {
      setSaved(v);
      setNote("Could not reach the gallery. Tap Share to send it.");
    }
  };
  const share = async () => {
    if (!saved) return;
    try { await Sharing.shareAsync(saved.uri, { mimeType: "video/mp4", dialogTitle: title }); } catch { /* closed */ }
  };

  if (tracks === null) return <View key="wait" style={{ height: 120, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }} />;
  if (!edit) return <>{fallback}</>;
  // key: a NEW box, not the waiting one re-used. In a browser a box that gains onLayout after it
  // was first drawn is never measured (react-native-web starts watching at mount only), so the
  // video's width stayed 0 and the picture was never drawn (world playtest R2-16).
  return (
    <View key="video" onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w > 0 && Math.abs(w - boxW) > 1) setBoxW(w); }} style={{ width: "100%", alignItems: tall ? "center" : "stretch" }}>
      {dispW > 0 && (
        <Pressable onPress={() => setPlaying((p) => !p)} style={{ width: dispW, height: dispH, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "#000" }}>
          <Canvas style={{ width: dispW, height: dispH }}>
            <Group transform={[{ scale: 1 / pr }]}><Picture picture={pic} /></Group>
          </Canvas>
          {making !== null && (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", zIndex: 2 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
                <View style={{ width: 96, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                  <View style={{ width: `${Math.round(making * 100)}%`, height: 4, backgroundColor: "#fff" }} />
                </View>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 4, letterSpacing: 1 }}>MAKING {Math.round(making * 100)}%</Text>
              </View>
            </View>
          )}
          {!playing && making === null && (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 2, borderColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 22, marginLeft: 3 }}>{ready ? "▶" : "…"}</Text>
              </View>
            </View>
          )}
          {!playing && badge ? <Text style={{ position: "absolute", right: 8, top: 8, backgroundColor: "#dc2626", color: "#fff", fontSize: 9, fontWeight: "900", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, overflow: "hidden" }}>{badge}</Text> : null}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.25)" }}>
            <Animated.View style={[{ height: 3, backgroundColor: "#fff" }, playedBar]} />
          </View>
        </Pressable>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, width: dispW || undefined }}>
        <Pressable accessibilityLabel={audible ? "Mute" : "Sound on"} onPress={() => setSoundOn(!audible)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 14 }}>{audible ? "🔊" : "🔇"}</Text>
        </Pressable>
        <Pressable accessibilityLabel="Save video" onPress={() => void save()} disabled={making !== null} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: making !== null ? 0.6 : 1 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "800" }}>⤓</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800" }}>{making !== null ? `Making ${Math.round(making * 100)}%` : "Save video"}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{mmss(editDuration(edit))}</Text>
      </View>
      {note ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, width: dispW || undefined }}>
          <Text style={{ flex: 1, color: note.startsWith("Saved") ? "#6ee7b7" : "#fde68a", fontSize: 12, fontWeight: "700" }}>{note}</Text>
          {saved ? (
            <Pressable accessibilityLabel="Share the video" onPress={() => void share()} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Share</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
