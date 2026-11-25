/**
 * "WE FOUND YOUR SAVED GAME FROM THE OLD APP" (release build only, at the real package uk.co.knowitball.game).
 *
 * Mounted once over every screen (App.tsx). A moment after start it looks in the old app's WebView folder
 * (src/migrate/oldWebview.ts). In the test app, on a fresh install, or once any career exists here, it finds nothing
 * and shows nothing. If a save is there it asks; "Bring it over" makes a safety copy first, then imports
 * (src/migrate/applyOldSave.ts). "Not now" asks again next time; the old folder is never touched.
 * Everything is inside try/catch and its own error boundary: this can never stop the game from opening.
 */
import { Component, useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";
import { readOldWebview } from "../migrate/oldWebview";
import { extractOldSave, type OldSave } from "../migrate/oldSave";
import { applyOldSave, importState, phoneHasCareer, rememberImport } from "../migrate/applyOldSave";

class Quiet extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? null : this.props.children; }
}

function Prompt() {
  const [old, setOld] = useState<OldSave | null>(null);
  const [step, setStep] = useState<"ask" | "working" | "done" | "failed" | "hidden">("hidden");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      try {
        if (importState() || phoneHasCareer()) return;
        const r = await readOldWebview();
        if (dead || r.state !== "read") return;
        const found = extractOldSave(r.entries);
        if (dead || !found || !found.slots.length || phoneHasCareer()) return;
        setOld(found); setStep("ask");
      } catch { /* never block the game */ }
    }, 700);
    return () => { dead = true; clearTimeout(t); };
  }, []);
  if (!old || step === "hidden") return null;
  const bring = () => {
    setStep("working");
    // a tick later so "Bringing it over" is drawn first
    setTimeout(() => {
      const r = applyOldSave(old);
      if (r.ok) { setMsg(r.slots === 1 ? "Your saved game is here. Press CONTINUE." : `Your ${r.slots} saved games are here. Press CONTINUE.`); setStep("done"); }
      else { setMsg(r.message); setStep("failed"); }
    }, 60);
  };
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.86)", justifyContent: "center", padding: 22 }}>
      <View style={{ backgroundColor: C.panel, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12 }}>
        <Text style={{ color: C.gold, fontSize: 20, fontWeight: "900" }}>{step === "done" ? "All done" : step === "failed" ? "Not brought over" : "We found your saved game"}</Text>
        {step === "ask" || step === "working" ? (
          <>
            <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>This is the new KnowItBall. Your game from the old app is still on this phone. Bring it over to carry on where you stopped.</Text>
            {old.slots.map((s) => (
              <View key={s.slot} style={{ backgroundColor: C.panel2, borderRadius: 12, padding: 12 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: "800" }}>{s.summary.name}</Text>
                <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{s.summary.retired ? "Retired" : s.summary.club || "On trial"} · Season {s.summary.season}{old.slots.length > 1 ? ` · Save ${s.slot}` : ""}</Text>
              </View>
            ))}
            <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>A safety copy is kept first. Nothing in the old app is deleted. Goal videos from the old app do not come over.</Text>
            <Press disabled={step === "working"} onPress={bring} style={{ backgroundColor: C.green, borderRadius: R.card, paddingVertical: 15, alignItems: "center" }}>
              <Text style={{ color: "#05261a", fontSize: 18, fontWeight: "900" }}>{step === "working" ? "BRINGING IT OVER..." : "BRING IT OVER"}</Text>
            </Press>
            <Press disabled={step === "working"} onPress={() => setStep("hidden")} style={{ backgroundColor: C.panel2, borderRadius: R.card, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "800" }}>NOT NOW</Text>
            </Press>
          </>
        ) : (
          <>
            <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }}>{msg}</Text>
            <Press onPress={() => setStep("hidden")} style={{ backgroundColor: C.green, borderRadius: R.card, paddingVertical: 15, alignItems: "center" }}>
              <Text style={{ color: "#05261a", fontSize: 18, fontWeight: "900" }}>OK</Text>
            </Press>
          </>
        )}
      </View>
    </View>
  );
}

export function OldSavePrompt() { return <Quiet><Prompt /></Quiet>; }
// kept so a later "never ask again" button can use the same memory
export const neverAskAboutOldSave = () => rememberImport({ state: "never", at: Date.now() });
