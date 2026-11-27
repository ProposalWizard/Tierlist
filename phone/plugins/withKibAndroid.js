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
 * 4. ANDROID'S OWN DEATH REPORT (26 Nov 2026): on every start, MainApplication.onCreate asks Android why the app last stopped
 *    (ApplicationExitInfo, Android 11+) and writes the newest 3 reports as plain text to filesDir/kib-exit-info.txt, newest first.
 *    Settings shows it ("Android says the app last stopped because"). Everything is in try/catch on a background thread; it never throws.
 *
 * 5. R8 KEEP RULES FOR expo-gl (27 Nov 2026): the release build has R8 on (android.enableMinifyInReleaseBuilds=true in the Expo template).
 *    expo-gl's C++ finds Java code BY NAME (GLContext.flush() through GetMethodID, the EXGL native methods through their symbol names)
 *    and ships no consumer rules, so R8 renames/removes them: GetMethodID returns null and the next JNI call kills the process the
 *    moment a GLView is made. The rules below keep expo.modules.gl as written. See docs/phone-app/3D-PLAN.md "GLView crash".
 *
 * To check on a phone: set the phone's font size to the largest, open the game:
 * the title screen must look exactly as it does at the default size.
 */
const { withMainActivity, withMainApplication, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARK = "// kib: withKibAndroid";
const EXIT_MARK = "// kib: exitInfo";

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

// String.raw: the Kotlin below keeps its backslash escapes as written, and uses no dollar-brace templates (JS would read them).
const EXIT_INFO_KOTLIN = String.raw`
  ${EXIT_MARK} (Android's own report of why the app last stopped -> filesDir/kib-exit-info.txt)
  private fun kibSaveExitInfo() {
    try {
      if (android.os.Build.VERSION.SDK_INT < 30) return
      val ctx = this
      Thread {
        try {
          val am = ctx.getSystemService(android.content.Context.ACTIVITY_SERVICE) as android.app.ActivityManager
          val infos = am.getHistoricalProcessExitReasons(ctx.packageName, 0, 5)
          val file = java.io.File(ctx.filesDir, "kib-exit-info.txt")
          val blocks = java.util.TreeMap<Long, String>()
          if (file.exists()) {
            var ts = 0L
            val sb = StringBuilder()
            for (line in file.readText().split("\n")) {
              if (line.startsWith("@@ ")) {
                if (ts > 0L) blocks[ts] = sb.toString().trimEnd()
                ts = line.substring(3).trim().toLongOrNull() ?: 0L
                sb.setLength(0)
                sb.append(line).append("\n")
              } else sb.append(line).append("\n")
            }
            if (ts > 0L) blocks[ts] = sb.toString().trimEnd()
          }
          for (i in infos) {
            try {
              val ts = i.timestamp
              if (blocks.containsKey(ts)) continue
              blocks[ts] = kibDescribeExit(i)
            } catch (e: Throwable) { }
          }
          val out = StringBuilder()
          var n = 0
          for (k in blocks.descendingKeySet()) {
            if (n >= 3) break
            out.append(blocks[k]).append("\n")
            n++
          }
          file.writeText(out.toString())
        } catch (e: Throwable) { }
      }.start()
    } catch (e: Throwable) { }
  }

  private fun kibDescribeExit(i: android.app.ApplicationExitInfo): String {
    val reason = when (i.reason) {
      android.app.ApplicationExitInfo.REASON_ANR -> "ANR (the app stopped answering)"
      android.app.ApplicationExitInfo.REASON_CRASH -> "CRASH (a JavaScript/Java crash)"
      android.app.ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE (a crash in native code)"
      android.app.ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
      android.app.ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE_USAGE"
      android.app.ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF (the app closed itself)"
      android.app.ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INITIALIZATION_FAILURE"
      android.app.ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY (Android closed it for memory)"
      android.app.ApplicationExitInfo.REASON_OTHER -> "OTHER"
      android.app.ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
      android.app.ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED (killed by a signal)"
      android.app.ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED (swiped away or force stopped)"
      android.app.ApplicationExitInfo.REASON_USER_STOPPED -> "USER_STOPPED"
      else -> "UNKNOWN"
    }
    val sb = StringBuilder()
    sb.append("@@ ").append(i.timestamp).append("\n")
    sb.append("when: ").append(java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(i.timestamp))).append(" UTC\n")
    sb.append("reason: ").append(reason).append(" (").append(i.reason).append(")\n")
    sb.append("status: ").append(i.status).append("\n")
    sb.append("description: ").append(i.description ?: "-").append("\n")
    sb.append("importance: ").append(i.importance).append("  process: ").append(i.processName ?: "-").append("\n")
    sb.append("memory: pss ").append(i.pss).append(" KB, rss ").append(i.rss).append(" KB\n")
    if (i.reason == android.app.ApplicationExitInfo.REASON_CRASH_NATIVE) {
      try {
        val tr = i.traceInputStream
        if (tr != null) {
          val buf = ByteArray(16384)
          var got = 0
          while (got < buf.size) {
            val r = tr.read(buf, got, buf.size - got)
            if (r <= 0) break
            got += r
          }
          tr.close()
          sb.append("tombstone: ").append(kibStrings(buf, got)).append("\n")
        } else sb.append("tombstone: none\n")
      } catch (e: Throwable) { sb.append("tombstone: unreadable\n") }
    }
    return sb.toString().trimEnd()
  }

  /** The readable words in a tombstone (it is partly binary): the lines about signals, libraries and frames first, then the first few others. */
  private fun kibStrings(buf: ByteArray, len: Int): String {
    val runs = ArrayList<String>()
    val cur = StringBuilder()
    for (k in 0 until len) {
      val c = buf[k].toInt() and 0xff
      if (c in 32..126) cur.append(c.toChar())
      else { if (cur.length >= 5) runs.add(cur.toString()); cur.setLength(0) }
    }
    if (cur.length >= 5) runs.add(cur.toString())
    val key = Regex("signal|SIG|\\.so|abort|Abort|Fatal|libc|libexpo|libhermes|libreact|libskia|libGLES|libEGL|libvulkan|/data/app|pc [0-9a-f]|Cause|fault")
    val out = StringBuilder()
    val seen = HashSet<String>()
    for (r in runs) { if (key.containsMatchIn(r) && seen.add(r)) { if (out.length + r.length > 1500) break; out.append(r).append(" | ") } }
    var others = 0
    for (r in runs) { if (others >= 8 || out.length > 1900) break; if (!key.containsMatchIn(r) && seen.add(r)) { out.append(r.take(120)).append(" | "); others++ } }
    return out.toString().trimEnd(' ', '|')
  }
`;

/** Puts `methods` right after the opening line of `class <name> … {`. */
function addToClass(src, name, methods, mark = MARK) {
  if (src.includes(mark)) return src;
  const re = new RegExp(`(class\\s+${name}\\b[^{]*\\{)`);
  if (!re.test(src)) throw new Error(`withKibAndroid: class ${name} not found (the Expo template changed)`);
  return src.replace(re, `$1\n${methods}`);
}

const PRO_MARK = "# kib: expo-gl keep rules";
const PRO_RULES = `
${PRO_MARK} (27 Nov 2026) - expo-gl's C++ looks these up by name; R8 must not rename or drop them
-keep class expo.modules.gl.** { *; }
-keep class expo.modules.gl.cpp.EXGL { *; }
-keepclasseswithmembernames class * { native <methods>; }
`;

module.exports = function withKibAndroid(config) {
  config = withDangerousMod(config, ["android", (c) => {
    const file = path.join(c.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
    const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (!cur.includes(PRO_MARK)) fs.writeFileSync(file, cur.replace(/\s*$/, "\n") + PRO_RULES);
    return c;
  }]);
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
    let src = addToClass(c.modResults.contents, "MainApplication", APPLICATION_METHODS);
    // the exit report: its methods once, and the call right after super.onCreate() (so it never runs before the app is set up)
    src = addToClass(src, "MainApplication", EXIT_INFO_KOTLIN, EXIT_MARK);
    if (!/super\.onCreate\(\)\s*kibSaveExitInfo\(\)/.test(src)) {
      if (!/super\.onCreate\(\)/.test(src)) throw new Error("withKibAndroid: MainApplication.onCreate not found (the Expo template changed)");
      src = src.replace(/(super\.onCreate\(\))/, "$1\n    kibSaveExitInfo()");
    }
    c.modResults.contents = src;
    return c;
  });
  return config;
};
