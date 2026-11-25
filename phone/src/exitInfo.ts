/**
 * ANDROID'S OWN DEATH REPORT (26 Nov 2026). On every start the native app (plugins/withKibAndroid.js, MainApplication.onCreate) asks Android
 * why the app last stopped (ApplicationExitInfo: a native crash with its signal, "Android closed it for memory", swiped away, ...) and
 * writes the newest 3 reports as plain text to filesDir/kib-exit-info.txt. This reads that file for Settings. Android 11+ only; on the
 * web build and on iOS there is no file, so every function here answers "nothing".
 */
import { Platform } from "react-native";

const NAME = "kib-exit-info.txt";

function file(): { exists: boolean; textSync(): string; delete(): void } | null {
  if (Platform.OS !== "android") return null;
  try {
    // required here, not at the top: the web look checks load this file too
    const fs = require("expo-file-system") as typeof import("expo-file-system");
    return new fs.File(fs.Paths.document, NAME);
  } catch { return null; }
}

/** The report text (newest first, up to 3 reports), or null when there is none. */
export function readExitInfo(): string | null {
  try {
    const f = file();
    if (!f || !f.exists) return null;
    const t = f.textSync().trim();
    return t ? t.replace(/^@@ \d+\n/gm, "") : null;
  } catch { return null; }
}

/** Settings → Clear. */
export function clearExitInfo() {
  try { const f = file(); if (f?.exists) f.delete(); } catch { /* nothing to clear */ }
}
