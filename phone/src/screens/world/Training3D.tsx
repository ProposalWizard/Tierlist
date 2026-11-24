/**
 * THE 3D TRAINING PITCH (the website's components/star/Training3D.tsx on the phone): the garden's Training gate.
 *
 * THE TRAINING GATE (Harry, 8 Oct 2026: "random chance of different training drills (or a choice)"): a picker (Random drill, or choose
 * one), then the drill. Crossbar Challenge is ./Crossbar3D.tsx (your shot on the phone's match engine, his as a cut-scene); the fully 3D
 * drills (Two Touch, Free Roam, Headers & Volleys, Wembley, Pace Sprint) are ./Drill3D.tsx on the website's lib/star/play3d. The list is
 * the website's lib/star/play3d/drills.ts: the same names, rules, rewards.
 *
 * A finished drill is the Team game of the week (the same Team bar move and energy as the Woodwork challenge), and Pace Sprint also banks
 * its stars on the pace ladder: `flow.trainingGateDone`, the website's `training-3d` phase. Back goes to the Garden at the gate.
 *
 * Ways in: the Garden's training gate (a "Training ›" card). When the crash guard has the 3D off the gate opens the app's own Training
 * (`career-training`) instead. Params: `{ drill?, mode? }` open a drill straight away (the checks).
 */
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { DRILLS, drillById, pickRandomDrill, type DrillDef, type DrillId } from "@/lib/star/play3d/drills";
import { makeRng } from "@/lib/star/play3d/rng";
import { useCareer } from "../../game/store";
import { usePrefs } from "../../game/prefs";
import * as flow from "../../game/flow";
import { useNav } from "../../nav";
import { partOff } from "../../safety";
import { Press } from "../../ui/Press";
import { GameShell } from "../MatchRelGames";
import { trainingSeed } from "../../three/trainingData";
import { CrossbarChallenge } from "./Crossbar3D";
import { Drill3D } from "./Drill3D";

const TONE = "#38bdf8";

export function Training3DScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  if (!career) return null;
  return <Training3D career={career} params={params} />;
}

function Training3D({ career, params }: { career: CareerState; params?: Record<string, unknown> }) {
  const nav = useNav();
  const prefs = usePrefs();
  const startDrill = typeof params?.drill === "string" ? (params.drill as DrillId) : undefined;
  const [pick, setPick] = useState<DrillId | null>(startDrill ?? null);
  const [mode, setMode] = useState<string | undefined>(typeof params?.mode === "string" ? params.mode : undefined);
  /** The pre-screen's answers; null until it's been through (drills with no options skip it). */
  const [opts, setOpts] = useState<Record<string, string> | null>(null);
  const seed = trainingSeed(career);
  const exit = () => nav.back();
  const back = startDrill ? exit : () => { setPick(null); setOpts(null); };
  const finish = (res: flow.TrainingGateResult) => { flow.trainingGateDone(res); nav.back(); };
  const off = partOff("3d");

  if (pick === "crossbar") return <CrossbarChallenge career={career} showSpeed={prefs.show3dSpeed} onExit={back} onFinish={finish} />;
  const d = pick ? drillById(pick) : null;
  if (d?.start) {
    const m = mode ?? d.modes?.[0]?.id;
    const asks = d.options?.(m) ?? [];
    if (asks.length && !opts) return <DrillSetup team={career.relationships.team} drill={d} mode={m} onStart={setOpts} onBack={back} />;
    return <Drill3D key={`${pick}-${m}`} career={career} drill={d} seed={seed} mode={m} options={opts ?? undefined} showSpeed={prefs.show3dSpeed} onExit={back} onFinish={finish} />;
  }
  return <DrillPicker team={career.relationships.team} seed={seed} off={off} onPick={(id, md) => { setPick(id); setMode(md); }} onExit={exit} />;
}

/** The pre-screen: a drill's choices (Wembley: how many players), then Start. */
function DrillSetup({ team, drill, mode, onStart, onBack }: { team: number; drill: DrillDef; mode?: string; onStart: (o: Record<string, string>) => void; onBack: () => void }) {
  const asks = drill.options?.(mode) ?? [];
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(asks.map((a) => [a.key, a.default])));
  const modeName = drill.modes?.find((x) => x.id === mode)?.label;
  return (
    <GameShell title={modeName ? `${drill.name} · ${modeName}` : drill.name} who="Team" current={team} tone={TONE} onBack={onBack}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 12 }}>{drill.blurb}</Text>
      {asks.map((a) => (
        <View key={a.key} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#bae6fd", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{a.label}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {a.choices.map((c) => {
              const on = vals[a.key] === c.value;
              return (
                <Press key={c.value} onPress={() => setVals((v) => ({ ...v, [a.key]: c.value }))}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: "center", backgroundColor: on ? "#0ea5e9" : "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: on ? "#bae6fd" : "rgba(255,255,255,0.25)" }}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{c.label}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      ))}
      <Press onPress={() => onStart(vals)} style={{ marginTop: 8, paddingVertical: 14, borderRadius: 4, alignItems: "center", backgroundColor: "#22c55e", borderWidth: 2, borderColor: "#bbf7d0" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", textTransform: "uppercase" }}>Start</Text>
      </Press>
    </GameShell>
  );
}

function DrillPicker({ team, seed, off, onPick, onExit }: { team: number; seed: number; off: boolean; onPick: (id: DrillId, mode?: string) => void; onExit: () => void }) {
  // with the 3D off (the crash guard) only the Crossbar Challenge plays: it still runs on the match engine
  const usable = (d: DrillDef) => d.status === "ready" && (!off || d.kind === "engine");
  const random = () => {
    const r = pickRandomDrill(makeRng(seed + 7));
    onPick(off && r.kind !== "engine" ? "crossbar" : r.id);
  };
  const rows = useMemo(() => DRILLS, []);
  return (
    <GameShell title="Training pitch" who="Team" current={team} tone={TONE} onBack={onExit}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Pick a drill, or let the coach pick one.</Text>
        <Press onPress={random} style={{ marginBottom: 12, paddingHorizontal: 16, paddingVertical: 18, borderRadius: 4, backgroundColor: "#0ea5e9", borderWidth: 2, borderColor: "#bae6fd" }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase" }}>🎲 Random drill</Text>
          <Text style={{ color: "#e0f2fe", fontSize: 12, fontWeight: "700", marginTop: 2 }}>One of the ready drills below, picked for you.</Text>
        </Press>
        {off && <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "700", marginBottom: 8 }}>The phone's 3D is switched off, so only the Crossbar Challenge plays.</Text>}
        <View style={{ gap: 8 }}>
          {rows.map((d) => d.modes && d.status === "ready" ? (
            // a drill with modes: the row shows them as its buttons (Wembley: Normal / Doubles)
            <View key={d.id} style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", opacity: usable(d) ? 1 : 0.5 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", textTransform: "uppercase" }}>{d.name}</Text>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{d.blurb}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {d.modes.map((m) => (
                  <Press key={m.id} disabled={!usable(d)} onPress={() => onPick(d.id, m.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: "center", backgroundColor: "rgba(14,165,233,0.8)", borderWidth: 1, borderColor: "#bae6fd" }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>{m.label}</Text>
                  </Press>
                ))}
              </View>
            </View>
          ) : (
            <Press key={d.id} disabled={!usable(d)} onPress={() => onPick(d.id)}
              style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: 4, backgroundColor: d.status === "ready" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: d.status === "ready" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", textTransform: "uppercase" }}>{d.name}</Text>
                {d.status !== "ready" && <Text style={{ color: "#bae6fd", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Coming next</Text>}
              </View>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{d.blurb}</Text>
            </Press>
          ))}
        </View>
      </ScrollView>
    </GameShell>
  );
}
