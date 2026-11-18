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
module.exports = config;
