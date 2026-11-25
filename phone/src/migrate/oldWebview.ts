/**
 * THE OLD APP'S WEBVIEW FOLDER, READ FROM THE NEW APP (Android only).
 *
 * When this app is installed over the packed Capacitor app (same package uk.co.knowitball.game, Play update), Android
 * keeps the app's data folder, so the old WebView's folder is still there:
 *     <data dir>/app_webview/Default/Local Storage/leveldb/      (the localStorage: the career save)
 * <data dir> is the parent of `Paths.document` (filesDir). Any file inside the app's own data folder can be read by the
 * app (expo-file-system allows it when the file is readable; checked in expo-modules-core FilePermissionService).
 *
 * In the test app (a different package, uk.co.knowitball.game.next) the folder does not exist, so nothing happens there.
 * It only READS. The old folder is never changed or deleted: a later version can look again.
 * Kill switch: OLD_SAVE_IMPORT below.
 */
import { Platform } from "react-native";
import { chromiumLocalStorage, readLevelDb, type LevelDbFile, type LocalStorageRead } from "./leveldb";

/** Set false to switch the whole look-for-the-old-save feature off. */
export const OLD_SAVE_IMPORT = true;

/** Folders the old app's localStorage can be in, from the data folder (the first one that exists is used). */
const CANDIDATES = [
  ["app_webview", "Default", "Local Storage", "leveldb"],
  ["app_webview", "Local Storage", "leveldb"],
  // the same two with the space written as a URI would (in case the path joiner does not do it): only a real phone can say which is needed
  ["app_webview", "Default", "Local%20Storage", "leveldb"],
];

export interface OldWebviewRead extends LocalStorageRead {
  dir: string | null;
  filesRead: number;
  /** Why there is nothing, when there is nothing: "no-folder" | "not-android" | "error" | "read". */
  state: "read" | "no-folder" | "not-android" | "disabled" | "error";
  error?: string;
}

const none = (state: OldWebviewRead["state"], extra: Partial<OldWebviewRead> = {}): OldWebviewRead =>
  ({ entries: new Map(), origin: null, notes: [], dir: null, filesRead: 0, state, ...extra });

/** Looks in the old app's folder and reads its localStorage. Never throws. */
export async function readOldWebview(): Promise<OldWebviewRead> {
  if (!OLD_SAVE_IMPORT) return none("disabled");
  if (Platform.OS !== "android") return none("not-android");
  try {
    // required here, not at the top: the web look checks load the app's files too
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("expo-file-system") as typeof import("expo-file-system");
    const data = fs.Paths.document.parentDirectory;
    let dir: InstanceType<typeof fs.Directory> | null = null;
    for (const parts of CANDIDATES) {
      const d = new fs.Directory(data, ...parts);
      if (d.exists) { dir = d; break; }
    }
    if (!dir) return none("no-folder");
    const files: LevelDbFile[] = [];
    const skipped: string[] = [];
    for (const item of dir.list()) {
      if (!(item instanceof fs.File)) continue;
      const name = item.name;
      if (!/\.(log|ldb|sst)$/i.test(name)) continue;
      try { files.push({ name, bytes: await item.bytes() }); } catch (e) { skipped.push(`${name}: could not be opened (${e instanceof Error ? e.message : String(e)})`); }
    }
    const ls = chromiumLocalStorage(readLevelDb(files));
    return { ...ls, notes: [...skipped, ...ls.notes], dir: dir.uri, filesRead: files.length, state: "read" };
  } catch (e) {
    return none("error", { error: e instanceof Error ? e.message : String(e) });
  }
}
