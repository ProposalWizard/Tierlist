/**
 * A NEW CAREER: the website's set-up screens (components/star/ProfileSetup.tsx),
 * same choices in the same order. Step 1 "Who are you?": first name, last
 * name, nickname, nationality. Step 2 "Your style": skin tone, hair, hair
 * colour, preferred foot, preferred squad number. Position ST, age 16, no
 * club (a club comes from the trial). The website's step 3 (your photo) is
 * left out: photo faces are off for everyone (FACT-UI-015).
 */
import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import type { StarPlayer } from "@/lib/star/types";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { ALL_NATIONALITIES, nationalityFlag } from "@/lib/nationalities";
import {
  SKIN_TONES, DEFAULT_SKIN_TONE, type SkinTone, DEFAULT_FOOT, type PreferredFoot,
  HAIR_STYLES, HAIR_COLOURS, DEFAULT_HAIR_STYLE, DEFAULT_HAIR_COLOUR, type HairStyle, type HairColour, clampSquadNumber,
} from "@/lib/star/playerIdentity";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, C, R } from "./kit";

export function NewCareer({ onDone, onBack }: { onDone: (p: StarPlayer) => void; onBack: () => void }) {
  const [pane, setPane] = useState<"who" | "style">("who");
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
  } as StarPlayer);

  if (natOpen) {
    return (
      <Frame title="Nationality" onBack={() => setNatOpen(false)} scroll={false}>
        <View style={{ paddingHorizontal: 14 }}>
          <Field value={search} onChange={setSearch} placeholder={`Search ${ALL_NATIONALITIES.length} nationalities…`} />
        </View>
        <FlatList data={list} keyExtractor={(n) => n} initialScrollIndex={search ? undefined : Math.max(0, ALL_NATIONALITIES.indexOf(nationality) - 3)}
          getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
          contentContainerStyle={{ padding: 14 }}
          ListEmptyComponent={<Text style={{ color: C.dim, textAlign: "center" }}>No match.</Text>}
          renderItem={({ item }) => (
            <Press onPress={() => { setNat(item); setSearch(""); setNatOpen(false); }}
              style={{ height: 46, marginBottom: 6, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: item === nationality ? "rgba(52,211,153,0.2)" : C.panel }}>
              <Text style={{ fontSize: 20, width: 34 }}>{nationalityFlag(item)}</Text>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>{item}</Text>
            </Press>
          )} />
      </Frame>
    );
  }

  if (pane === "who") {
    return (
      <Frame kicker="Step 1 of 2" title="Who are you?" onBack={onBack}
        footer={<Btn label="Next" disabled={!canGo} onPress={() => setPane("style")} />}>
        <Card>
          <Label color={C.green}>First name</Label>
          <Field value={firstName} onChange={setFirst} placeholder="First name" />
          <Label color={C.green}>Last name</Label>
          <Field value={lastName} onChange={setLast} placeholder="Last name" />
          <Label color={C.green}>Nickname</Label>
          <Field value={nickname} onChange={setNick} placeholder="What the fans call you" />
        </Card>
        <Card>
          <Label color={C.green}>Nationality</Label>
          <Press onPress={() => setNatOpen(true)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.panel2, borderRadius: 12, padding: 14 }}>
            <Text style={{ fontSize: 22, width: 36 }}>{nationalityFlag(nationality)}</Text>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 17, flex: 1 }}>{nationality}</Text>
            <Text style={{ color: C.gold, fontWeight: "800" }}>Change</Text>
          </Press>
        </Card>
      </Frame>
    );
  }

  return (
    <Frame kicker="Step 2 of 2" title="Your style" onBack={() => setPane("who")}
      footer={<Btn label="Start the trial" onPress={submit} />}>
      <Card>
        <Label color={C.green}>Skin tone</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {SKIN_TONES.map((t) => (
            <Press key={t.id} onPress={() => setSkin(t.id)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.hex, borderWidth: skin === t.id ? 3 : 0, borderColor: C.gold }}><View /></Press>
          ))}
        </View>
      </Card>
      <Card>
        <Label color={C.green}>Hair</Label>
        <Chips items={HAIR_STYLES.map((h) => ({ id: h.id, label: h.label }))} value={hairStyle} onPick={(v) => setHair(v as HairStyle)} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          {HAIR_COLOURS.map((h) => (
            <Press key={h.id} onPress={() => setHairColour(h.id)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: h.hex, borderWidth: hairColour === h.id ? 3 : 1, borderColor: hairColour === h.id ? C.gold : C.line }}><View /></Press>
          ))}
        </View>
      </Card>
      <Card>
        <Label color={C.green}>Preferred foot</Label>
        <Chips items={[{ id: "left", label: "Left" }, { id: "right", label: "Right" }]} value={foot} onPick={(v) => setFoot(v as PreferredFoot)} />
      </Card>
      <Card>
        <Label color={C.green}>Preferred squad number</Label>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <Press onPress={() => setNum((n) => clampSquadNumber(n - 1))} style={stepper}><Text style={stepTxt}>−</Text></Press>
          <Text style={{ color: C.text, fontSize: 40, fontWeight: "900", minWidth: 70, textAlign: "center" }}>{num}</Text>
          <Press onPress={() => setNum((n) => clampSquadNumber(n + 1))} style={stepper}><Text style={stepTxt}>+</Text></Press>
        </View>
      </Card>
    </Frame>
  );
}

const stepper = { width: 52, height: 52, borderRadius: 26, backgroundColor: C.panel2, alignItems: "center" as const, justifyContent: "center" as const };
const stepTxt = { color: C.text, fontSize: 28, fontWeight: "900" as const };

function Field({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)" maxLength={24}
      style={{ backgroundColor: C.panel2, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontWeight: "700", marginBottom: 14 }} />
  );
}

export function Chips({ items, value, onPick }: { items: { id: string; label: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => (
        <Press key={it.id} onPress={() => onPick(it.id)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, backgroundColor: value === it.id ? C.green : C.panel2 }}>
          <Text style={{ color: value === it.id ? "#05261a" : C.text, fontWeight: "900" }}>{it.label}</Text>
        </Press>
      ))}
    </View>
  );
}
