/**
 * SETTINGS -> "GL test" (27 Nov 2026).
 *
 * Mikey's Samsung closes the whole app, with no error screen, every time a GLView is made. This card makes ONE tiny GLView per tap,
 * in an order that goes from the plainest to the most careful, and writes a crash-trail step BEFORE each stage. If the app closes,
 * the next launch's red card ("Last time the app closed while: GL test at <step>") names the test that died, and this card marks this
 * phone's GL as unsafe (src/safety.ts), so no 3D place is walked into again. A pass shows here at once.
 *
 *   1 plain          GLView with its defaults, a view of fractional size (like the full-screen places: 384 x 853.33)
 *   2 whole pixels   the same, every side a whole number
 *   3 no msaa        msaaSamples 0 (the game's own setting; Android ignores it: expo-gl only passes it on iPhone)
 *   4 no view        GLView.createContextAsync(): a context with no view and no screen surface (what the news headshots use)
 * There is no "no depth/stencil" test: on Android expo-gl asks the phone for a 16-bit depth and 8-bit stencil buffer inside its own
 * code (GLContext.java eglChooseConfig) and no JavaScript switch changes that.
 */
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Card, Btn, C } from "../screens/career/kit";
import { GL_TEST_PLACE, clearGlUnsafe, clearTrail, closedWhileInfo, glUnsafeInfo, markStep } from "../safety";

type Variant = { id: number; name: string; what: string; w: number; h: number; msaa?: number; headless?: boolean };
export const GL_TESTS: Variant[] = [
  { id: 1, name: "plain", what: "GLView, defaults, fractional size", w: 96.5, h: 96.7 },
  { id: 2, name: "whole pixels", what: "GLView, whole-number size", w: 96, h: 96 },
  { id: 3, name: "no msaa", what: "GLView, msaaSamples 0", w: 96, h: 96, msaa: 0 },
  { id: 4, name: "no view", what: "GLView.createContextAsync (no view)", w: 0, h: 0, headless: true },
];
const TIMEOUT_MS = 8000;
type Result = { ok: boolean; text: string };
const results = new Map<number, Result>(); // kept while the app runs (a close is shown from the crash trail instead)

/** One step of a test: the trail step is written FIRST, then the work is done. */
const step = (v: Variant, text: string) => markStep(GL_TEST_PLACE, `${v.id} ${v.name}: ${text}`);

/** Draws one frame on the context and reads its numbers; throws on a GL error. */
function drawOnce(v: Variant, gl: any): string {
  step(v, "reading the GL version");
  const ver = String(gl.getParameter(gl.VERSION));
  const vendor = String(gl.getParameter(gl.VENDOR));
  const renderer = String(gl.getParameter(gl.RENDERER));
  step(v, "clearing");
  gl.clearColor(0.1, 0.5, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  step(v, "presenting a frame");
  if (typeof gl.endFrameEXP === "function") gl.endFrameEXP();
  step(v, "reading a pixel");
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const err = gl.getError();
  return `${ver} | ${vendor} | ${renderer} | pixel ${Array.from(px).join(",")} | error ${err}`;
}

export function GlTestCard() {
  const [, bump] = useState(0);
  const [running, setRunning] = useState<Variant | null>(null);
  const [GLViewC, setGLViewC] = useState<any>(null);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsafe = glUnsafeInfo();
  const died = closedWhileInfo()?.place === GL_TEST_PLACE ? closedWhileInfo() : null;

  const finish = (v: Variant, r: Result) => {
    if (finished.current) return;
    finished.current = true;
    if (timer.current) clearTimeout(timer.current);
    results.set(v.id, r);
    clearTrail(GL_TEST_PLACE); // it ran through: no close, no mark
    setRunning(null);
    setGLViewC(null);
    bump((n) => n + 1);
  };

  const onContext = (v: Variant) => (gl: unknown) => {
    if (finished.current) return;
    try { step(v, "context made"); finish(v, { ok: true, text: drawOnce(v, gl) }); }
    catch (e) { finish(v, { ok: false, text: `GL error: ${e instanceof Error ? e.message : String(e)}` }); }
  };

  const start = (v: Variant) => {
    if (running) return;
    finished.current = false;
    results.delete(v.id);
    step(v, "loading expo-gl");
    let mod: any;
    try { mod = require("expo-gl"); } catch (e) { results.set(v.id, { ok: false, text: `expo-gl would not load: ${String(e)}` }); clearTrail(GL_TEST_PLACE); bump((n) => n + 1); return; }
    setRunning(v);
    timer.current = setTimeout(() => finish(v, { ok: false, text: `no context after ${TIMEOUT_MS / 1000} s (the app did not close)` }), TIMEOUT_MS);
    if (v.headless) {
      step(v, "making the context (no view)");
      (async () => {
        let gl: any = null;
        try {
          gl = await mod.GLView.createContextAsync();
          step(v, "context made");
          const text = drawOnce(v, gl);
          finish(v, { ok: true, text });
        } catch (e) { finish(v, { ok: false, text: `GL error: ${e instanceof Error ? e.message : String(e)}` }); }
        finally { if (gl) void mod.GLView.destroyContextAsync(gl).catch(() => {}); }
      })();
    } else {
      step(v, "making the view");
      setGLViewC(() => mod.GLView);
    }
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (Platform.OS === "web") return null;
  const passed = GL_TESTS.filter((t) => results.get(t.id)?.ok).length;
  const View_ = GLViewC;
  return (
    <Card tone={unsafe ? "#ef4444" : undefined}>
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>GL test</Text>
      <Text style={{ color: C.dim, fontSize: 12, marginTop: 4, marginBottom: 8 }}>
        One tiny 3D view per tap, the plainest first. If the app closes, open this screen again: the red card names the test that closed it. Tap one at a time.
      </Text>
      {unsafe && (
        <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginBottom: 8 }}>
          {`This phone's GL failed (${unsafe.place}, "${unsafe.step}"). All 3D is off here until a test passes and you turn it back on.`}
        </Text>
      )}
      {died && !unsafe && <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginBottom: 8 }}>{`The app closed in the GL test at "${died.steps[died.steps.length - 1]?.step}".`}</Text>}
      {GL_TESTS.map((t) => {
        const r = results.get(t.id);
        return (
          <View key={t.id} style={{ marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>{`${t.id}  ${t.name}`}</Text>
                <Text style={{ color: C.dim, fontSize: 11 }}>{t.what}</Text>
              </View>
              <View style={{ width: 90 }}><Btn small label={running?.id === t.id ? "..." : r ? "Again" : "Test"} onPress={() => start(t)} /></View>
            </View>
            {r && <Text selectable style={{ color: r.ok ? "#34d399" : "#f87171", fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 2 }}>{`${r.ok ? "PASSED" : "FAILED"}: ${r.text}`}</Text>}
          </View>
        );
      })}
      {running && View_ && !running.headless && (
        <View style={{ width: running.w, height: running.h, marginTop: 8, overflow: "hidden", borderRadius: 6 }}>
          <View_ msaaSamples={running.msaa} onContextCreate={onContext(running)} style={{ width: running.w, height: running.h }} />
        </View>
      )}
      {(unsafe || passed > 0) && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {unsafe && passed > 0 && <Text style={{ color: C.dim, fontSize: 11 }}>{`${passed} of ${GL_TESTS.length} tests passed in this run.`}</Text>}
          {unsafe && <View style={{ width: 200 }}><Btn small label="Turn 3D back on" onPress={() => { clearGlUnsafe(); bump((n) => n + 1); }} /></View>}
        </View>
      )}
    </Card>
  );
}
