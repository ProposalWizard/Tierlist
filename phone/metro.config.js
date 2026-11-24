// The phone app reads the game's rules from the repo's lib/ (never copies them),
// so a fix to the rules reaches the website, the packed app and this app alike.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
// Every bundle (expo start, and the release build's bundling step) first puts
// the packed app's squads, settings and pictures in place (mobile/packed/ →
// phone/src/data/generated + phone/assets/packed; scripts/data-pack.js).
require("./scripts/data-pack").ensurePacked();
const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, "lib"), path.join(root, "data"), path.join(root, "node_modules")];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules"), path.join(root, "node_modules")];
// React and React Native always come from the phone app's own packages, never the website's.
config.resolver.extraNodeModules = {
  react: path.join(__dirname, "node_modules/react"),
  "react-native": path.join(__dirname, "node_modules/react-native"),
};
// 3D (phone/src/three): the website's 3D files (copies in assets/3d) are bundled as files,
// and two browser-only pieces of the 3D code are swapped for the phone's own, for every
// importer (lib/star included): three's GLTFLoader (files from the app, pictures through
// Skia) and lib/star/three3d/meshopt.ts (the same files, a plain-JavaScript decoder:
// the phone has no WebAssembly). Everything else in three and lib/star runs as is.
config.resolver.assetExts = [...config.resolver.assetExts, "glb", "hdr", "bin"];
const PHONE_GLTF = path.join(__dirname, "src/three/GLTFLoader.ts");
const PHONE_MESHOPT = path.join(__dirname, "src/three/meshopt.ts");
const LIB_MESHOPT = path.join(root, "lib/star/three3d/meshopt");
const WEB_DIR = path.join(__dirname, "src/web") + path.sep;
const WEB_SKIA = path.join(WEB_DIR, "skia.tsx");
const upstream = config.resolver.resolveRequest;
// ONE React: the game's files in lib/ sit next to the WEBSITE's packages (React 18),
// so `import "react"` from lib/ found that copy while the app runs its own (React 19).
// Two Reacts crash the first game hook on a screen (Mikey, 19 Nov 2026: Home after
// the trial, "useSyncExternalStore of null"). Every React import resolves from the app.
const PHONE_ENTRY = path.join(__dirname, "index.ts");
const ONE_COPY = /^(react|react-native|react-dom|scheduler)(\/.*)?$/;
// THE APP'S OWN "react-native" (src/rn.js): Text and TextInput that never grow with the
// phone's font size, and a Modal drawn in the app's own window. For the app's own files
// only (phone/src, App.tsx, index.ts): packages and src/rn.js itself get the real one.
const OWN_RN = path.join(__dirname, "src/rn.js");
const APP_DIR = __dirname + path.sep;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Browser only: the web build's compiler turns `import { Text } from "react-native"` into
  // "react-native-web/dist/exports/Text" before this runs, so the same three are sent on here.
  if (platform === "web") {
    const m = /^react-native-web\/dist\/exports\/(Text|TextInput|Modal)$/.exec(moduleName);
    const o = context.originModulePath || "";
    if (m && o !== OWN_RN && o.startsWith(APP_DIR) && !o.includes(`${path.sep}node_modules${path.sep}`)) {
      return { type: "sourceFile", filePath: path.join(WEB_DIR, `rn${m[1]}.js`) };
    }
  }
  if (moduleName === "react-native") {
    const o = context.originModulePath || "";
    if (o !== OWN_RN && o.startsWith(APP_DIR) && !o.includes(`${path.sep}node_modules${path.sep}`)) {
      return { type: "sourceFile", filePath: OWN_RN };
    }
  }
  if (ONE_COPY.test(moduleName) && !(context.originModulePath || "").startsWith(path.join(__dirname, "node_modules"))) {
    const ctx = { ...context, originModulePath: PHONE_ENTRY };
    return upstream ? upstream(ctx, moduleName, platform) : context.resolveRequest(ctx, moduleName, platform);
  }
  const from = context.originModulePath || "";
  // Browser only (the look check, tools/look): Skia's Canvas through src/web/skia.tsx.
  // The Android bundle is never redirected.
  if (platform === "web" && moduleName === "@shopify/react-native-skia" && !from.startsWith(WEB_DIR) && !from.includes(`${path.sep}node_modules${path.sep}`)) {
    return { type: "sourceFile", filePath: WEB_SKIA };
  }
  if (moduleName === "three/examples/jsm/loaders/GLTFLoader.js" && from !== PHONE_GLTF) {
    return { type: "sourceFile", filePath: PHONE_GLTF };
  }
  if (/(^|\/)meshopt(\.ts)?$/.test(moduleName)) {
    const abs = moduleName.startsWith("@/") ? path.join(root, moduleName.slice(2)) : moduleName.startsWith(".") ? path.resolve(path.dirname(from), moduleName) : "";
    if (abs.replace(/\.ts$/, "") === LIB_MESHOPT) return { type: "sourceFile", filePath: PHONE_MESHOPT };
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
