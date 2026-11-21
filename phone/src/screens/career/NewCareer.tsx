/**
 * A NEW CAREER: the website's set-up screens (components/star/ProfileSetup.tsx),
 * same choices in the same order, in its look (green page, "‹ Main menu" bar,
 * one green card, white boxes, Back | Continue at the bottom).
 *   1 "Who are you?": first and last name side by side, nickname, nationality.
 *   2 "Your style": skin tone, hair, hair colour, preferred foot, squad number.
 *   3 "Your photo" (PortraitPicker.tsx): your shirt, or one of the seven faces.
 *     "Add a photo" / "Take a photo" use the phone's own picker (./portrait.ts). Before 21 Nov 2026:
 *     adding or taking your own photo needed the phone's photo picker, which this
 *     app does not have yet: those two buttons show, greyed, with a note.
 *     (Photo faces are off in the game for everyone, FACT-UI-015: the choice
 *     is kept on the player, as on the website.)
 * Position ST, age 16, no club (a club comes from the trial).
 */
import { pickPortrait } from "./portrait";
import { useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Image, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StarPlayer } from "@/lib/star/types";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { ALL_NATIONALITIES } from "@/lib/nationalities";
import { NationFlag } from "../../draw/NationFlag";
import {
  SKIN_TONES, DEFAULT_SKIN_TONE, type SkinTone, DEFAULT_FOOT, type PreferredFoot,
  HAIR_STYLES, HAIR_COLOURS, DEFAULT_HAIR_STYLE, DEFAULT_HAIR_COLOUR, type HairStyle, type HairColour, clampSquadNumber,
  MIN_SQUAD_NUMBER, MAX_SQUAD_NUMBER,
} from "@/lib/star/playerIdentity";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { packedPicture } from "../../data/packed";
import { Press } from "../../ui/Press";
import { Backdrop, Display, Glass, Kicker, LookButton, Tag, LOOK } from "../../ui/look";

type Pane = "who" | "style" | "photo";

export function NewCareer({ onDone, onBack }: { onDone: (p: StarPlayer) => void; onBack: () => void }) {
  const [pane, setPane] = useState<Pane>("who");
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [nickname, setNick] = useState("");
  const [nationality, setNat] = useState("England");
  const [natOpen, setNatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skin, setSkin] = useState<SkinTone>(DEFAULT_SKIN_TONE);
  const [hairStyle, setHair] = useState<HairStyle>(DEFAULT_HAIR_STYLE);
  const [hairColour, setHairColour] = useState<HairColour>(DEFAULT_HAIR_COLOUR);
  const [foot, setFoot] = useState<PreferredFoot>(DEFAULT_FOOT);
  const [num, setNum] = useState(9);
  const [portrait, setPortrait] = useState<string | undefined>(undefined);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ALL_NATIONALITIES.filter((n) => n.toLowerCase().includes(q)) : ALL_NATIONALITIES;
  }, [search]);
  const canGo = firstName.trim().length > 0 && lastName.trim().length > 0 && !natOpen;

  const submit = () => onDone({
    firstName: firstName.trim(), lastName: lastName.trim(), age: 16, skinTone: skin,
    club: "", clubBadge: null, position: "ST", nationality, startYear: STAR_FIFA_YEAR,
    preferredNumber: num, preferredFoot: foot, hairStyle, hairColour,
    ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
    ...(portrait ? { portrait } : {}),
  } as StarPlayer);

  const title = pane === "who" ? "Who are you?" : pane === "style" ? "Your style" : "Your photo";
  // As the website shows it: details and style are "Step 1 of 2", the photo "Step 2 of 2".
  const step = pane === "photo" ? "Step 2 of 2" : "Step 1 of 2";
  const sub = pane === "who" ? " · your details" : pane === "style" ? " · your style" : "";
  const back = () => (pane === "photo" ? setPane("style") : pane === "style" ? setPane("who") : onBack());
  const next = pane === "who"
    ? <LookButton label="Continue →" disabled={!canGo} onPress={() => setPane("style")} style={{ flex: 1 }} />
    : pane === "style"
      ? <LookButton label="Continue →" onPress={() => setPane("photo")} style={{ flex: 1 }} />
      : <LookButton label="✓ Start Career" onPress={submit} style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop kind="green" />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
        <Press onPress={onBack} style={{ borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.1)", paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>‹ Main menu</Text>
        </Press>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Tag>Road to the Golden Ball</Tag>
            <Display size={21} style={{ marginTop: 6 }}>{title}</Display>
            <Text style={{ color: LOOK.emerald300, fontSize: 11, fontWeight: "700", marginTop: 2 }}>{step}<Text style={{ color: "rgba(52,211,153,0.7)" }}>{sub}</Text></Text>
          </View>

          {pane === "who" && (
            <Glass tone="green" pad={16}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Label>First name</Label><Field value={firstName} onChange={setFirst} /></View>
                <View style={{ flex: 1 }}><Label>Last name</Label><Field value={lastName} onChange={setLast} /></View>
              </View>
              <View style={{ marginTop: 12 }}>
                <Label>Nickname <Text style={{ color: "rgba(52,211,153,0.6)" }}>· optional</Text></Label>
                <Field value={nickname} onChange={setNick} placeholder="What the fans call you" />
                <Note>Used instead of your name on the team sheet and in commentary.</Note>
              </View>
              <View style={{ marginTop: 12 }}>
                <Label>Nationality</Label>
                {!natOpen ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: LOOK.emerald500, paddingHorizontal: 12, paddingVertical: 9, boxShadow: "0px 8px 14px -6px rgba(6,78,59,0.6)" } as ViewStyle}>
                    <NationFlag nation={nationality} width={20} />
                    <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 16, fontWeight: "900" }}>{nationality}</Text>
                    <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>✓</Text>
                    <Press onPress={() => setNatOpen(true)} style={{ borderRadius: 8, backgroundColor: "rgba(6,78,59,0.5)", paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>CHANGE</Text>
                    </Press>
                  </View>
                ) : (
                  <View>
                    <Field value={search} onChange={setSearch} placeholder={`Search ${ALL_NATIONALITIES.length} nationalities…`} max={30} />
                    <ScrollView nestedScrollEnabled style={{ marginTop: 6, maxHeight: 176, borderRadius: 8, backgroundColor: "rgba(31,41,55,0.6)" }} keyboardShouldPersistTaps="handled">
                      {list.length === 0 && <Text style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", padding: 12, fontSize: 12, fontWeight: "700" }}>No match.</Text>}
                      {list.map((n) => (
                        <Press key={n} onPress={() => { setNat(n); setSearch(""); setNatOpen(false); }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: n === nationality ? LOOK.emerald500 : "transparent" }}>
                          <NationFlag nation={n} width={20} />
                          <Text numberOfLines={1} style={{ color: n === nationality ? "#fff" : "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "700" }}>{n}</Text>
                        </Press>
                      ))}
                    </ScrollView>
                    <Press onPress={() => { setSearch(""); setNatOpen(false); }} style={{ marginTop: 6, borderRadius: 8, backgroundColor: "#374151", paddingVertical: 8, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>KEEP {nationality.toUpperCase()}</Text>
                    </Press>
                  </View>
                )}
              </View>
            </Glass>
          )}

          {pane === "style" && (
            <Glass tone="green" pad={16}>
              <Label>Skin tone</Label>
              <Grid cols={4}>
                {SKIN_TONES.map((t) => (
                  <Press key={t.id} onPress={() => setSkin(t.id)} style={[tile(skin === t.id, 44), { backgroundColor: t.hex }]}>
                    {skin === t.id ? <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } }}>✓</Text> : <View />}
                  </Press>
                ))}
              </Grid>
              <Label top>Hair</Label>
              <Grid cols={4}>
                {HAIR_STYLES.map((h) => <Choice key={h.id} label={h.label} on={hairStyle === h.id} onPress={() => setHair(h.id)} small />)}
              </Grid>
              <Grid cols={4} style={{ marginTop: 8 }}>
                {HAIR_COLOURS.map((h) => (
                  <Press key={h.id} onPress={() => setHairColour(h.id)} style={[tile(hairColour === h.id, 36), { backgroundColor: h.hex }]}><View /></Press>
                ))}
              </Grid>
              <Label top>Preferred foot</Label>
              <Grid cols={2}>
                {(["left", "right"] as const).map((f) => <Choice key={f} label={f === "left" ? "Left" : "Right"} on={foot === f} onPress={() => setFoot(f)} />)}
              </Grid>
              <Note>Permanent — you can't change this later.</Note>
              <Label top>Preferred squad number</Label>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Press disabled={num <= MIN_SQUAD_NUMBER} onPress={() => setNum((n) => clampSquadNumber(n - 1))} style={stepper}><Text style={stepTxt}>−</Text></Press>
                <View style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                  <Display size={30} color="#000" shadow={false}>{num}</Display>
                </View>
                <Press disabled={num >= MAX_SQUAD_NUMBER} onPress={() => setNum((n) => clampSquadNumber(n + 1))} style={stepper}><Text style={stepTxt}>+</Text></Press>
              </View>
              <Note>A preference, not a promise — you'll wear what the club gives you until you've earned it.</Note>
            </Glass>
          )}

          {pane === "photo" && (
            <Glass tone="green" pad={16}>
              <PhotoPicker value={portrait} onChange={setPortrait} number={num} />
            </Glass>
          )}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 12, paddingTop: 8, paddingBottom: 12 }}>
          <LookButton kind="navy" label="← Back" onPress={back} style={{ flex: 1 }} />
          {next}
        </View>
      </SafeAreaView>
    </View>
  );
}

/** The photo step (PortraitPicker.tsx, its first screen): your shirt, or a face. */
function PhotoPicker({ value, onChange, number }: { value?: string; onChange: (v: string | undefined) => void; number: number }) {
  const kit = kitsOf("").home;
  const [busy, setBusy] = useState<"library" | "camera" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const own = !!value && value.startsWith("data:");
  const pick = async (from: "library" | "camera") => {
    setBusy(from); setProblem(null);
    const r = await pickPortrait(from);
    setBusy(null);
    if (r.ok) onChange(r.dataUrl);
    else if (r.reason !== "cancelled") setProblem(r.message ?? "That did not work. Try again, or pick a face below.");
  };
  return (
    <Glass tone="inset" radius={12} pad={12}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Kicker>Your photo</Kicker>
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Optional</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
        {/* the tile as the graphics draw it: your shirt and number, or your face */}
        <View style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", backgroundColor: kit.shirt }}>
          <View style={{ position: "absolute", top: -6, bottom: -6, left: 4, width: 20, backgroundColor: kit.trim, transform: [{ skewX: "-14deg" }] }} />
          {value ? <Face src={value} />
            : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Display size={24} color="#fff">{number}</Display></View>}
        </View>
        <Text style={{ flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", lineHeight: 15 }}>
          {own ? "Your photo. It shows on team sheets and on Player of the Month graphics." : value ? "" : "Without one you'll show up as a generic face in matches, and as the back of your shirt on Player of the Month graphics."}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <LookButton label={busy === "library" ? "Opening…" : own ? "Change photo" : "Add a photo"} disabled={!!busy} small onPress={() => pick("library")} style={{ flex: 1, paddingVertical: 9 }} />
        <LookButton kind="glass" label={busy === "camera" ? "Opening…" : "Take a photo"} disabled={!!busy} small onPress={() => pick("camera")} style={{ flex: 1, paddingVertical: 9 }} />
      </View>
      <Text style={{ color: problem ? "#fca5a5" : "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4 }}>{problem ?? "Your photo stays on this phone. Taking one asks to use the camera."}</Text>
      <Press onPress={() => { if (value) onChange(undefined); }} style={[{ marginTop: 8, borderRadius: 12, paddingVertical: 8, alignItems: "center" },
        value
          ? ({ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.2), inset 0px 0px 0px 1px rgba(255,255,255,0.12)" } as ViewStyle)
          : ({ backgroundImage: "linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))", boxShadow: "inset 0px 0px 0px 1px rgba(52,211,153,0.7), 0px 0px 14px -4px rgba(16,185,129,0.7)" } as ViewStyle)]}>
        <Text style={{ color: value ? "#fff" : "#a7f3d0", fontSize: 12, fontWeight: "900" }}>{value ? "Use my shirt" : "✓ Using your shirt"}</Text>
      </Press>
      <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingTop: 12 }}>
        <Kicker>Or pick a face</Kicker>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {FAKE_FACES.map((src) => (
            <Press key={src} onPress={() => onChange(src)} style={[{ flex: 1, aspectRatio: 1, borderRadius: 8, overflow: "hidden", borderWidth: 2, backgroundColor: kit.shirt, borderColor: value === src ? "#34d399" : "rgba(255,255,255,0.15)" },
              value === src && ({ boxShadow: "0px 0px 12px -2px rgba(52,211,153,0.9)" } as ViewStyle)]}>
              <Face src={src} />
            </Press>
          ))}
        </View>
      </View>
    </Glass>
  );
}

/** One of the seven faces (lib/star/fakeFaces.ts), from the app's packed pictures. */
function Face({ src }: { src: string }) {
  // your own photo is kept as a data: line; the seven faces are the app's packed pictures
  const uri = src.startsWith("data:") ? src : packedPicture(src);
  if (!uri) return <View style={{ flex: 1 }} />;
  return <Image source={{ uri }} resizeMode="cover" fadeDuration={0} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "115%" }} />;
}

function Label({ children, top }: { children: React.ReactNode; top?: boolean }) {
  return <Text style={{ color: LOOK.emerald300, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center", marginBottom: 6, marginTop: top ? 18 : 0 }}>{children}</Text>;
}
function Note({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4 }}>{children}</Text>;
}
function Field({ value, onChange, placeholder, max = 20 }: { value: string; onChange: (s: string) => void; placeholder?: string; max?: number }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(0,0,0,0.4)" maxLength={max}
      style={{ backgroundColor: "#fff", color: "#000", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, fontSize: 16, fontWeight: "700", textAlign: "center" }} />
  );
}
function Grid({ cols, children, style }: { cols: number; children: React.ReactNode; style?: ViewStyle }) {
  const items = Array.isArray(children) ? children : [children];
  const rows: React.ReactNode[][] = [];
  items.forEach((c, i) => { if (i % cols === 0) rows.push([]); rows[rows.length - 1].push(c); });
  return (
    <View style={[{ gap: 8 }, style]}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          {r.map((c, j) => <View key={j} style={{ flex: 1 }}>{c}</View>)}
          {Array.from({ length: cols - r.length }, (_, k) => <View key={`e${k}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}
const tile = (on: boolean, h: number): ViewStyle => ({
  height: h, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2,
  borderColor: on ? "#fff" : "rgba(0,0,0,0.3)", ...(on ? { boxShadow: "0px 0px 0px 2px #6ee7b7" } : {}),
} as ViewStyle);
/** A choice tile (hair, foot): green when picked, dark navy when not. */
function Choice({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Press onPress={onPress} style={[{ borderRadius: 12, paddingVertical: small ? 10 : 12, alignItems: "center", backgroundColor: on ? LOOK.emerald500 : "#1f2a40" },
      on && ({ boxShadow: "0px 0px 0px 2px #6ee7b7" } as ViewStyle)]}>
      <Text style={{ color: on ? "#fff" : "rgba(255,255,255,0.7)", fontSize: small ? 12 : 14, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
    </Press>
  );
}

const stepper = { height: 48, width: 56, borderRadius: 12, backgroundColor: "#1f2a40", alignItems: "center" as const, justifyContent: "center" as const };
const stepTxt = { color: "#fff", fontSize: 24, fontWeight: "900" as const };
