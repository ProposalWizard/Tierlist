/**
 * KIB Next's Android set-up, kept by `expo prebuild` (app.json → plugins).
 * The packed app is a web page inside an app; these three make this app sit on
 * the phone the same way:
 *
 * 1. FONT SIZE: the phone's Settings → Display → "Font size" (and Samsung's
 *    "Font size and style") never changes the game's text. The app and its one
 *    screen both run with font scale 1, so every text (React Native's Text,
 *    TextInput, anything a package draws) is measured at the designed size.
 *    src/rn.js does the same from the JavaScript side for every Text.
 * 2. THE CAMERA CUT-OUT: the game draws under the punch-hole camera (short
 *    edges), so hiding the status bar leaves no black band at the top.
 * 3. HIDDEN BARS: whenever the game's window gets the focus back (a system
 *    pop-up closed, the keyboard went, the app came back), the status and
 *    navigation bars hide again, as MainActivity.hideTopBar does in the packed app.
 *
 * To check on a phone: set the phone's font size to the largest, open the game:
 * the title screen must look exactly as it does at the default size.
 */
const { withMainActivity, withMainApplication } = require("expo/config-plugins");

const MARK = "// kib: withKibAndroid";

const ACTIVITY_METHODS = `
  ${MARK} (font scale 1, cut-out, bars stay hidden)
  override fun attachBaseContext(newBase: android.content.Context) {
    super.attachBaseContext(newBase)
    val fixed = android.content.res.Configuration()
    fixed.fontScale = 1.0f
    applyOverrideConfiguration(fixed)
  }

  private fun kibFullScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val lp = window.attributes
      lp.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = lp
    }
    val bars = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)
    bars.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    bars.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) kibFullScreen()
  }
`;

const APPLICATION_METHODS = `
  ${MARK} (font scale 1)
  override fun attachBaseContext(base: android.content.Context) {
    val fixed = android.content.res.Configuration()
    fixed.fontScale = 1.0f
    super.attachBaseContext(base.createConfigurationContext(fixed))
  }
`;

/** Puts `methods` right after the opening line of `class <name> … {`. */
function addToClass(src, name, methods) {
  if (src.includes(MARK)) return src;
  const re = new RegExp(`(class\\s+${name}\\b[^{]*\\{)`);
  if (!re.test(src)) throw new Error(`withKibAndroid: class ${name} not found (the Expo template changed)`);
  return src.replace(re, `$1\n${methods}`);
}

module.exports = function withKibAndroid(config) {
  config = withMainActivity(config, (c) => {
    if (c.modResults.language !== "kt") throw new Error("withKibAndroid: MainActivity is not Kotlin");
    let src = addToClass(c.modResults.contents, "MainActivity", ACTIVITY_METHODS);
    // also once at start, before the first frame
    if (!/super\.onCreate\(null\)\s*kibFullScreen\(\)/.test(src)) {
      src = src.replace(/(super\.onCreate\(null\))/, "$1\n    kibFullScreen()");
    }
    c.modResults.contents = src;
    return c;
  });
  config = withMainApplication(config, (c) => {
    if (c.modResults.language !== "kt") throw new Error("withKibAndroid: MainApplication is not Kotlin");
    c.modResults.contents = addToClass(c.modResults.contents, "MainApplication", APPLICATION_METHODS);
    return c;
  });
  return config;
};
