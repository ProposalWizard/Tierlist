/**
 * SAFE START. Loads the game inside a try/catch and an error boundary, and
 * catches any crash after that too, so a fault shows on screen (what broke,
 * and where) instead of Android closing the app ("KIB Next keeps stopping").
 * Mikey, 19 Nov 2026: the app closed the moment it opened.
 */
import { Component, useEffect, useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

type Fault = { where: string; message: string; stack?: string };
let reported: Fault | null = null;
const listeners = new Set<(f: Fault) => void>();
function report(where: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  reported = { where, message: err.message, stack: err.stack };
  listeners.forEach((f) => f(reported!));
}

// Any later crash (a timer, a promise, a screen) comes here instead of closing the app.
const EU = (globalThis as unknown as { ErrorUtils?: { setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
EU?.setGlobalHandler((e, fatal) => report(fatal ? "a crash" : "an error", e));

let App: (() => ReactNode) | null = null;
try {
  require("./appFlags");
} catch (e) { report("starting up (phone settings)", e); }
if (!reported) {
  try {
    App = require("../App").default;
  } catch (e) { report("loading the game", e); }
}

class Boundary extends Component<{ children: ReactNode }, { f: Fault | null }> {
  state = { f: null as Fault | null };
  static getDerivedStateFromError(e: unknown) { const err = e instanceof Error ? e : new Error(String(e)); return { f: { where: "drawing a screen", message: err.message, stack: err.stack } }; }
  render() { return this.state.f ? <FaultScreen f={this.state.f} /> : this.props.children; }
}

function FaultScreen({ f }: { f: Fault }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0b100e", paddingTop: 60, paddingHorizontal: 18 }}>
      <Text style={{ color: "#f5c542", fontSize: 22, fontWeight: "900" }}>Something went wrong</Text>
      <Text style={{ color: "#fff", fontSize: 15, marginTop: 8 }}>Please screenshot this whole screen and send it to Claude.</Text>
      <ScrollView style={{ marginTop: 14 }}>
        <Text selectable style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>While {f.where}:</Text>
        <Text selectable style={{ color: "#f87171", fontSize: 14, marginTop: 6 }}>{f.message}</Text>
        <Text selectable style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 10, fontFamily: "monospace" }}>{(f.stack ?? "").slice(0, 3000)}</Text>
      </ScrollView>
    </View>
  );
}

export default function Boot() {
  const [f, setF] = useState<Fault | null>(reported);
  useEffect(() => { listeners.add(setF); if (reported) setF(reported); return () => { listeners.delete(setF); }; }, []);
  if (f) return <FaultScreen f={f} />;
  const A = App!;
  return <Boundary><A /></Boundary>;
}
