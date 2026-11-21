/**
 * THE APP'S OWN "react-native" (metro.config.js sends every `import … from
 * "react-native"` in phone/src and App.tsx here; packages are not touched).
 * Everything is React Native's own, except three things that must behave like
 * the packed app on every phone:
 *
 *  - Text and TextInput NEVER grow with the phone's "Font size" setting. The
 *    packed app is a web page in CSS pixels and ignores that setting; here every
 *    box was drawn for the same sizes. (React 19 ignores `Text.defaultProps`,
 *    so the prop is set on every Text here. `plugins/withKibAndroid.js` also
 *    pins the Android font scale to 1 for anything that is not a Text.)
 *  - Modal is drawn INSIDE the app's own window (OverlayHost in App.tsx). An
 *    Android Modal is a second window: it brings the hidden status and
 *    navigation bars back and is laid out without the camera cut-out.
 *
 * Browser only, for the look check: `?fs=1.3` draws every Text the way Android
 * did BEFORE this file (sizes times the font scale), to compare.
 */
const React = require("react");
const RN = require("react-native");

const OLD_SCALE = (() => {
  try {
    if (RN.Platform.OS !== "web" || typeof location === "undefined") return 1;
    const m = /[?&]fs=([\d.]+)/.exec(location.search || "");
    return m ? Math.max(0.5, Math.min(3, parseFloat(m[1]) || 1)) : 1;
  } catch {
    return 1;
  }
})();

function oldScaled(style) {
  const f = RN.StyleSheet.flatten(style) || {};
  const out = { ...f, fontSize: (f.fontSize ?? 14) * OLD_SCALE };
  if (typeof f.lineHeight === "number") out.lineHeight = f.lineHeight * OLD_SCALE;
  return out;
}

function Text(props) {
  if (OLD_SCALE !== 1) return React.createElement(RN.Text, { ...props, style: oldScaled(props.style) });
  return React.createElement(RN.Text, { ...props, allowFontScaling: false });
}
Text.displayName = "Text";

function TextInput(props) {
  if (OLD_SCALE !== 1) return React.createElement(RN.TextInput, { ...props, style: oldScaled(props.style) });
  return React.createElement(RN.TextInput, { ...props, allowFontScaling: false });
}
TextInput.displayName = "TextInput";

// ── Modal, in the app's own window ────────────────────────────────────────────
let entries = [];
let seq = 1;
let hosts = 0;
const subs = new Set();
const emit = () => { for (const f of subs) f(); };
const subscribe = (f) => { subs.add(f); return () => { subs.delete(f); }; };
const snapshot = () => entries;
const hostSnapshot = () => hosts > 0;
const noHost = () => false;
function put(id, node) {
  const i = entries.findIndex((e) => e.id === id);
  entries = i < 0 ? [...entries, { id, node }] : entries.map((e) => (e.id === id ? { id, node } : e));
  emit();
}
function drop(id) {
  if (!entries.some((e) => e.id === id)) return;
  entries = entries.filter((e) => e.id !== id);
  emit();
}

const FILL = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 };

/** Fades (and for "slide", rises) in once. */
function Layer({ animationType, transparent, onShow, children }) {
  const moves = !!animationType && animationType !== "none";
  const a = React.useRef(new RN.Animated.Value(moves ? 0 : 1)).current;
  React.useEffect(() => {
    const done = () => { if (onShow) onShow(); };
    if (!moves) { done(); return undefined; }
    const run = RN.Animated.timing(a, { toValue: 1, duration: animationType === "slide" ? 220 : 160, useNativeDriver: RN.Platform.OS !== "web" });
    run.start(done);
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const slide = animationType === "slide";
  return React.createElement(RN.Animated.View, {
    style: [FILL, { backgroundColor: transparent ? "transparent" : "#000", opacity: slide ? 1 : a },
      slide ? { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [RN.Dimensions.get("window").height, 0] }) }] } : null],
  }, children);
}

/** App.tsx mounts one, above every screen. */
function OverlayHost() {
  const list = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  React.useEffect(() => { hosts++; emit(); return () => { hosts--; emit(); }; }, []);
  if (!list.length) return null;
  return React.createElement(RN.View, { style: FILL, pointerEvents: "box-none" },
    list.map((e) => React.createElement(RN.View, { key: e.id, style: FILL }, e.node)));
}

function Modal({ visible = true, transparent = false, animationType = "none", onRequestClose, onShow, children }) {
  const id = React.useRef(0);
  if (!id.current) id.current = seq++;
  const hasHost = React.useSyncExternalStore(subscribe, hostSnapshot, noHost);
  const close = React.useRef(onRequestClose);
  close.current = onRequestClose;
  const layer = visible ? React.createElement(Layer, { animationType, transparent, onShow }, children) : null;
  // every render: the newest children go to the host
  React.useEffect(() => { if (hasHost && visible) put(id.current, layer); else drop(id.current); });
  React.useEffect(() => () => drop(id.current), []);
  // the phone's back button closes the top pop-up first (added last = asked first)
  React.useEffect(() => {
    if (!visible) return undefined;
    const sub = RN.BackHandler.addEventListener("hardwareBackPress", () => { if (close.current) close.current(); return true; });
    return () => sub.remove();
  }, [visible]);
  if (!visible || hasHost) return null;
  // no host (a fault page, a test): over its own parent
  return React.createElement(RN.View, { style: [FILL, { zIndex: 999 }] }, layer);
}
Modal.displayName = "Modal";

const OWN = { Text, TextInput, Modal, __KibOverlayHost: OverlayHost };
module.exports = new Proxy(RN, {
  get(target, key) { return Object.prototype.hasOwnProperty.call(OWN, key) ? OWN[key] : target[key]; },
});
