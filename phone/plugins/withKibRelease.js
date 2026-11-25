/**
 * The STORE build's Android set-up (only added by app.config.js when KIB_RELEASE=1; the test app never sees it).
 *
 * 1. MANIFEST: the camera is optional (a phone with no camera can still install); the old
 *    `requestLegacyExternalStorage` flag (Android 10 only, template leftover) is removed.
 * 2. CHIPS: gradle.properties `reactNativeArchitectures` = armeabi-v7a (32-bit) + arm64-v8a (64-bit); the .aab then
 *    lets Google Play send each phone only its own chip's files. `-PreactNativeArchitectures=...` on the command line
 *    still wins (the test APKs).
 * 3. SIGNING: the release build is signed with the UPLOAD KEY, read from gradle properties (~/.gradle/gradle.properties)
 *    or environment variables, never from a file in git:
 *        KIB_KEYSTORE_FILE  KIB_KEYSTORE_PASSWORD  KIB_KEY_ALIAS  KIB_KEY_PASSWORD
 *    (the same four names the packed app uses, mobile/android/app/build.gradle). With no key, `assembleRelease` still
 *    makes an APK for testing, signed with the debug key and a loud warning; `bundleRelease` (the store file) STOPS.
 * 4. NATIVE SYMBOLS: the .aab carries a native symbol table, so Play's crash reports name the library and function
 *    (the app has had native crashes: libskia, libhermes).
 */
const { withAndroidManifest, withGradleProperties, withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withKibRelease(config, props = {}) {
  config = withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    const app = m.application?.[0];
    if (app?.$) delete app.$["android:requestLegacyExternalStorage"];
    m["uses-feature"] = m["uses-feature"] || [];
    for (const f of ["android.hardware.camera", "android.hardware.camera.front"]) {
      const have = m["uses-feature"].find((x) => x.$["android:name"] === f);
      if (have) have.$["android:required"] = "false";
      else m["uses-feature"].push({ $: { "android:name": f, "android:required": "false" } });
    }
    return c;
  });

  config = withGradleProperties(config, (c) => {
    const set = (key, value) => {
      const i = c.modResults.findIndex((p) => p.type === "property" && p.key === key);
      if (i >= 0) c.modResults[i].value = value; else c.modResults.push({ type: "property", key, value });
    };
    set("reactNativeArchitectures", props.abis || "armeabi-v7a,arm64-v8a");
    return c;
  });

  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") throw new Error("withKibRelease: app/build.gradle is not Groovy (the Expo template changed)");
    let g = c.modResults.contents;
    if (g.includes("// kib: release signing")) return c;
    const helper = `
// kib: release signing (plugins/withKibRelease.js). The upload key comes from gradle properties or environment variables, never from git.
def kibProp = { String n -> (findProperty(n) ?: System.getenv(n)) }
def kibStoreFile = kibProp('KIB_KEYSTORE_FILE')
def kibHasKey = kibStoreFile && file(kibStoreFile).exists() && kibProp('KIB_KEYSTORE_PASSWORD') && kibProp('KIB_KEY_ALIAS') && kibProp('KIB_KEY_PASSWORD')
if (!kibHasKey) {
    logger.warn("KIB: no upload key (KIB_KEYSTORE_FILE / KIB_KEYSTORE_PASSWORD / KIB_KEY_ALIAS / KIB_KEY_PASSWORD): a release APK is signed with the DEBUG key (testing only); bundleRelease will stop.")
}
gradle.taskGraph.whenReady { graph ->
    if (!kibHasKey && graph.allTasks.any { it.name == 'bundleRelease' || it.name == 'packageReleaseBundle' || it.name == 'signReleaseBundle' }) {
        throw new GradleException("KIB: bundleRelease needs the upload key. Set KIB_KEYSTORE_FILE, KIB_KEYSTORE_PASSWORD, KIB_KEY_ALIAS and KIB_KEY_PASSWORD (docs/phone-app/RELEASE.md).")
    }
}
`;
    if (!/^android \{/m.test(g)) throw new Error("withKibRelease: 'android {' not found in app/build.gradle (the Expo template changed)");
    g = g.replace(/^android \{/m, helper + "\nandroid {");
    // a release signing config, before the debug one
    if (!/signingConfigs \{\s*\n\s*debug \{/.test(g)) throw new Error("withKibRelease: signingConfigs.debug not found (the Expo template changed)");
    g = g.replace(/(signingConfigs \{\s*\n)(\s*)debug \{/, `$1$2release {
$2    if (kibHasKey) {
$2        storeFile file(kibStoreFile)
$2        storePassword kibProp('KIB_KEYSTORE_PASSWORD')
$2        keyAlias kibProp('KIB_KEY_ALIAS')
$2        keyPassword kibProp('KIB_KEY_PASSWORD')
$2    }
$2}
$2debug {`);
    // the release build type uses it (or the debug key when there is none: testing only)
    const rel = g.search(/buildTypes \{[\s\S]*?\n\s*release \{/);
    if (rel < 0) throw new Error("withKibRelease: buildTypes.release not found (the Expo template changed)");
    const before = g.slice(0, rel), after = g.slice(rel);
    const fixed = after.replace(/(\n\s*release \{[\s\S]*?)signingConfig signingConfigs\.debug/, "$1signingConfig kibHasKey ? signingConfigs.release : signingConfigs.debug\n            ndk { debugSymbolLevel 'SYMBOL_TABLE' }");
    if (fixed === after) throw new Error("withKibRelease: release signingConfig line not found (the Expo template changed)");
    c.modResults.contents = before + fixed;
    return c;
  });
  return config;
};
