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
config.resolver.assetExts = [...config.resolver.assetExts, "glb"];
const PHONE_GLTF = path.join(__dirname, "src/three/GLTFLoader.ts");
const PHONE_MESHOPT = path.join(__dirname, "src/three/meshopt.ts");
const LIB_MESHOPT = path.join(root, "lib/star/three3d/meshopt");
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const from = context.originModulePath || "";
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
