/**
 * GOAL REPLAYS ON THE PHONE — every goal recording kept on this phone
 * (match/goalClip/store.ts listClips, newest first); tap one to watch it from
 * the website's four cameras (components/star/GoalClipViewer.tsx: TV, Behind
 * the goal, Fan in the stand, TikTok), drawn from the recording itself.
 * On the website the recordings are reached through the feed and Settings'
 * admin Goal Replays; here this screen lists them all.
 */
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ClipListing } from "@/lib/star/goalClip/store";
import type { ClipStyle } from "@/lib/star/goalClip/edit";
import { listClips } from "../match/goalClip/store";
import { GoalVideo } from "./MatchGoalVideo";
import { C } from "../ui/theme";

const ANGLES: { style: ClipStyle; label: string }[] = [
  { style: "broadcast", label: "TV" },
  { style: "reverse", label: "Behind the goal" },
  { style: "fan", label: "Fan in the stand" },
  { style: "tiktok", label: "TikTok" },
];

export function GoalReplays({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<ClipListing[] | null>(null);
  const [open, setOpen] = useState<ClipListing | null>(null);
  const [style, setStyle] = useState<ClipStyle>("broadcast");
  useEffect(() => { void listClips().then(setList); }, []);
  const label = (c: ClipListing) => `${c.scorer} · ${c.minuteLabel}' · ${c.home} v ${c.away}`;
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
        <Pressable onPress={open ? () => setOpen(null) : onBack} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: C.text, fontWeight: "900" }}>‹ Back</Text>
        </Pressable>
        <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>GOAL REPLAYS</Text>
      </View>
      {open ? (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
          <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>{label(open)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ANGLES.map((a) => (
              <Pressable key={a.style} onPress={() => setStyle(a.style)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: style === a.style ? "#fff" : "rgba(255,255,255,0.1)" }}>
                <Text style={{ color: style === a.style ? "#030712" : "#fff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <GoalVideo key={`${open.id}|${style}`} clipIds={[open.id]} style={style} title={label(open)} autoStart fallback={<Text style={{ color: C.dim }}>This recording is no longer on the phone.</Text>} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
          {list === null ? <Text style={{ color: C.dim }}>Loading…</Text> : list.length === 0 ? (
            <Text style={{ color: C.dim }}>Score in a real match and the goal is recorded here, frame by frame.</Text>
          ) : list.map((c) => (
            <Pressable key={c.id} onPress={() => { setStyle("broadcast"); setOpen(c); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 20 }}>▶</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900" }}>{c.scorer} · {c.minuteLabel}&apos;</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{c.home} v {c.away}{c.how ? ` · ${c.how.replace(/_/g, " ")}` : ""}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
