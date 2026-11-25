/**
 * Expo reads app.json first and hands it to this file, which may change it.
 *
 *   (default)       the TEST app: "KIB Next", package uk.co.knowitball.game.next, versionCode from app.json (2).
 *                   Installs beside the real game and the packed app. Exactly what app.json says.
 *   KIB_RELEASE=1   the STORE app: the real game uk.co.knowitball.game, name "KnowItBall" (the packed app's
 *                   app_name, mobile/android/app/src/main/res/values/strings.xml), versionName 2.0.0, a versionCode
 *                   above every packed-app upload (the packed app's last is 2, versionName 1.1:
 *                   mobile/android/app/build.gradle), no extra permissions, 32-bit + 64-bit phones, signed with the
 *                   upload key (plugins/withKibRelease.js). Read docs/phone-app/RELEASE.md before using it.
 *
 * Switches (all optional, environment variables):
 *   KIB_RELEASE=1          store build
 *   KIB_VERSION_CODE=NN    override the store build's versionCode (it must be higher than every code on Play)
 *   KIB_VERSION_NAME=x.y.z override the store build's versionName
 *   KIB_ABIS=a,b           phone chips to build in the store build (default armeabi-v7a,arm64-v8a)
 *   KIB_NO_INTERNET=1      store build without the INTERNET permission (the game is offline; see RELEASE.md before using)
 */
const RELEASE = process.env.KIB_RELEASE === "1";

/** Packed-app facts, from mobile/ (read-only there). */
const REAL_PACKAGE = "uk.co.knowitball.game";
const REAL_NAME = "KnowItBall";
const PACKED_LAST_VERSION_CODE = 2; // mobile/android/app/build.gradle: versionCode 2 / versionName "1.1" (closed test)
const RELEASE_VERSION_CODE = 20; // far above the packed app's, leaving room for any code Play already has

const BLOCKED = [
  "android.permission.SYSTEM_ALERT_WINDOW", // draw over other apps: debug overlay of the template, never used
  "android.permission.RECORD_AUDIO", // the image picker declares it for video; the app only takes photos
  "android.permission.READ_EXTERNAL_STORAGE", // the app only WRITES to the gallery (goal videos) and uses the photo picker
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED", // read access to photos: not needed (write only)
];

module.exports = ({ config }) => {
  if (!RELEASE) return config;
  const code = Number(process.env.KIB_VERSION_CODE || RELEASE_VERSION_CODE);
  if (!Number.isInteger(code) || code <= PACKED_LAST_VERSION_CODE) {
    throw new Error(`KIB_VERSION_CODE must be a whole number above ${PACKED_LAST_VERSION_CODE} (the packed app's last upload), got "${process.env.KIB_VERSION_CODE}"`);
  }
  const name = REAL_NAME;
  const blocked = [...BLOCKED];
  if (process.env.KIB_NO_INTERNET === "1") blocked.push("android.permission.INTERNET");
  const plugins = (config.plugins || []).map((p) => {
    // the permission sentences name the app: the store app is not "KIB Next"
    if (Array.isArray(p) && typeof p[1] === "object") {
      const o = { ...p[1] };
      for (const k of Object.keys(o)) if (typeof o[k] === "string") o[k] = o[k].replace(/KIB Next/g, name);
      return [p[0], o];
    }
    return p;
  });
  // FIRST in the list = its changes are applied LAST (Expo runs a later plugin before an earlier one), so it can undo what expo-media-library adds
  plugins.unshift(["./plugins/withKibRelease", { noInternet: process.env.KIB_NO_INTERNET === "1", abis: process.env.KIB_ABIS || "armeabi-v7a,arm64-v8a" }]);
  return {
    ...config,
    name,
    version: process.env.KIB_VERSION_NAME || config.version,
    android: { ...config.android, package: REAL_PACKAGE, versionCode: code, blockedPermissions: blocked },
    plugins,
  };
};
