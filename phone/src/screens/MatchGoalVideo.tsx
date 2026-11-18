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
 * Different: the website encodes a video file, then plays it; the phone has no
 * encoder, so it draws the frames live (30 a second) as it plays. "Save video"
 * (the share menu) is not here: nothing is encoded to save.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Canvas, Picture, Group, Skia, createPicture, type SkPicture } from "@shopify/react-native-skia";
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

  if (tracks === null) return <View style={{ height: 120, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }} />;
  if (!edit) return <>{fallback}</>;
  return (
    <View onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w > 0 && Math.abs(w - boxW) > 1) setBoxW(w); }} style={{ width: "100%", alignItems: tall ? "center" : "stretch" }}>
      {dispW > 0 && (
        <Pressable onPress={() => setPlaying((p) => !p)} style={{ width: dispW, height: dispH, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "#000" }}>
          <Canvas style={{ width: dispW, height: dispH }}>
            <Group transform={[{ scale: 1 / pr }]}><Picture picture={pic} /></Group>
          </Canvas>
          {!playing && (
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
        <Text numberOfLines={1} style={{ flex: 1, color: C.dim, fontSize: 12, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontVariant: ["tabular-nums"] }}>{mmss(editDuration(edit))}</Text>
      </View>
    </View>
  );
}
