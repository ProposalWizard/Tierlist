# KIB Next to Google Play: release checklist (26 Nov 2026)

For Mikey and Harry. The new phone app (KIB Next, built with React Native) is going to replace the packed app
(`uk.co.knowitball.game`, version 1.1, versionCode 2, closed test) **at the same package name, on the same Play
listing**. Everything that does not need Mikey is set up. This page says what is ready, what only Mikey can do, the
exact commands, and what can go wrong.

Labels used below: **SEEN** = I ran it or read the generated file. **READ** = I read the code or docs, did not run it.
**GUESS** = reasoned, needs a real phone or Play Console to confirm.

## 1. What is ready (no Mikey needed)

| Piece | State |
|---|---|
| Store switch | `KIB_RELEASE=1` gives package `uk.co.knowitball.game`, name "KnowItBall" (the packed app's name), versionName 2.0.0, versionCode 20. Unset = the "KIB Next" test app, byte for byte as before. SEEN: both `expo prebuild` modes run, the test manifest is identical to before. (`phone/app.config.js`) |
| Permissions | Down to 5 in the store build (section 3). SEEN in the generated manifest; the merged list comes from reading each library's manifest (no gradle run here). |
| 32-bit phones | Store build includes `armeabi-v7a` (32-bit) and `arm64-v8a` (64-bit). Every native library in the app lists armeabi-v7a (section 4). READ, not built. |
| Signing | The release build reads the upload key from gradle properties or environment variables. No key in git. `bundleRelease` stops without a key. SEEN in the generated `app/build.gradle`; not run. |
| Save move from the packed app | The new app finds the old game's save and offers to bring it over (section 6). SEEN: the reader proved against a LevelDB folder laid out as the spec says, with a real career. NOT seen on a phone. |
| Checks | tsc 9 old errors only, match-parity 12/12, match-features, career-flow, screens, world, boot-sim, live3d-check, `node phone/tools/migrate-check.ts` (new), Android Metro export. |

## 2. What only Mikey can do (in this order)

1. **Find the upload key.** It is the key the packed app was uploaded with (alias `upload`, certificate
   `CN=Knowitball, O=Knowitball, C=GB`, from `mobile/README.md`). The file and its passwords are not in the repo (on
   purpose: `mobile/android/keystore.properties` is git-ignored). Tell Harry where it is, or put these four lines in
   `~/.gradle/gradle.properties` on the building machine (never in git, never in chat):
   ```
   KIB_KEYSTORE_FILE=/full/path/to/knowitball-upload.jks
   KIB_KEYSTORE_PASSWORD=...
   KIB_KEY_ALIAS=upload
   KIB_KEY_PASSWORD=...
   ```
   Check it is the right key: `keytool -list -v -keystore knowitball-upload.jks -alias upload` shows a SHA-1. Play Console
   > the game > Test and release > App integrity > App signing > "Upload key certificate" must show the same SHA-1.
2. **If the key is lost:** same page, "Request upload key reset". Google checks who you are, then you make a new key
   (command in section 5) and upload its certificate. This takes a few days. Nothing else changes.
3. **Play Console:** the highest versionCode ever uploaded for this app (Releases, or App bundle explorer). The new app is 20.
   If Play already has 20 or more, set `KIB_VERSION_CODE` higher. (The repo only shows the packed app at code 2.)
4. **Make a closed-test release first** (the same track the packed 1.1 is on). The testers already have 1.1
   installed, so their update to the new app IS the real test of the save move.
5. **Data safety form** (section 7) and **privacy policy** (section 8): fill in and publish.
6. **Store listing:** it stays, since it is the same app. Check the name, screenshots (they show the packed app), the short
   description, and the content rating answers (no casino, no gambling events in the phone app: `PACKED_APP` rules).
7. **Production:** a staged rollout, starting at 1% (section 9).

## 3. Permissions

The store build declares these (READ of each library's manifest, SEEN in the generated app manifest):

| Permission | Kept? | Why (where in the code) |
|---|---|---|
| `INTERNET` | kept for now | The packed app has it. The phone app calls no server: no Supabase, PostHog or Sentry in `phone/package.json`, no `https://` fetch in `phone/src` or `lib/star` (grep: none); the game's `/api/...` requests are answered inside the app (`src/data/offline.ts`). So it is probably NOT needed. GUESS, so it stays until a real phone has played a whole career without it. Test: build with `KIB_NO_INTERNET=1`; if the game plays normally, make that the default and the Data safety form gets simpler. |
| `VIBRATE` | kept | Goal buzz and button feel (`src/match/feel.ts`, `src/ui/Press.tsx`). The packed app has it too. |
| `CAMERA` | kept | "Take a photo" for your player's face (`src/screens/career/portrait.ts`, `launchCameraAsync`, front camera). Not in the packed app. The camera is marked optional, so a phone without one can still install. To drop it, remove the button in `portrait.ts` and add `android.permission.CAMERA` to `BLOCKED` in `phone/app.config.js`. |
| `WRITE_EXTERNAL_STORAGE` (Android 12 and older only) | kept | Saving a goal video to the photos (`MediaLibrary.Asset.create`, `src/screens/MatchGoalVideo.tsx`). The app asks write-only (`requestPermissionsAsync(true, ["video"])`), so on Android 13+ it needs nothing. |
| `MODIFY_AUDIO_SETTINGS` | kept | Added by expo-audio (match sound, music, goal video sound). A normal permission, no pop-up. |
| `RECORD_AUDIO` | removed | The image picker adds it for video. The app takes photos only. |
| `READ_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED` | removed | The app never reads the gallery with a permission: the photo picker needs none, and the video save is write-only. |
| `SYSTEM_ALERT_WINDOW` | removed | A debug overlay from the template. Never used. |
| `requestLegacyExternalStorage` flag | removed | Android 10 only leftover from expo-media-library. |

Not used and not asked: location, contacts, microphone, notifications, ads id, phone state.

## 4. 32-bit phones (armeabi-v7a)

Cost, from reading the libraries' own build files (`node_modules`):
- Hermes (the JavaScript engine, React Native 0.88): builds armeabi-v7a (default list in `hermes-engine/build.gradle.kts`).
- Skia (`@shopify/react-native-skia` 2.14): ships prebuilt `armeabi-v7a` libraries (48 MB of static archives against 58 MB for arm64; final .so is far smaller).
- `expo-gl`, `react-native-mmkv`, `react-native-nitro-modules`, `react-native-reanimated`, `react-native-worklets`: each lists `armeabi-v7a` in its build file.
- The app's own `goal-video-encoder` module is Kotlin only: no native code.
- **Nothing blocks 32-bit.** Not built here (no gradle runs allowed in this task), so a real 32-bit build may still hit a compile problem.
- Size (GUESS): the test arm64 APK is 47 MB (docs/phone-app/PLAN.md). Adding armeabi-v7a makes the .aab roughly 80 to 100 MB in total; Play sends each phone only its own chip's files plus the shared assets (49 MB), so a phone downloads about 45 to 50 MB. For comparison the packed app's .aab was 158 MB (`mobile/README.md`).
- Speed (GUESS): a 32-bit phone is an older, slower phone and the 3D scenes are heavy. The game's own quality tiers (`tierFor`) pick Low on weak phones, but nobody has run it on one. Consider a Play device filter later if testers report it unplayable.
- x86 and x86_64 (emulators, some Chromebooks) are left out of the store build to save size. Add `KIB_ABIS=armeabi-v7a,arm64-v8a,x86_64` to include one.
- Google requires a 64-bit build next to any 32-bit one: yes, both are included.

## 5. Commands

Run from the repo on a machine with the Android SDK (NDK 27.1, CMake 3.22), JDK 17+, Node 22. `maven-mirror.gradle` is only for
machines that Maven Central rate-limits (429).

**Test APK, 64-bit (as before, package `...game.next`, debug key):**
```
cd phone && npm install
rm -rf android && CI=1 npx expo prebuild --platform android --no-install
cd android && ./gradlew -I ../tools/maven-mirror.gradle assembleRelease -PreactNativeArchitectures=arm64-v8a
# app/build/outputs/apk/release/app-release.apk
```
**Test APK, 32-bit** (same, with `-PreactNativeArchitectures=armeabi-v7a`). Use this to try an old phone.

**Store file (.aab), signed with the upload key:**
```
cd phone
rm -rf android                       # always: the two modes make different folders
KIB_RELEASE=1 CI=1 npx expo prebuild --platform android --no-install
cd android
KIB_RELEASE=1 ./gradlew -I ../tools/maven-mirror.gradle bundleRelease     # key from ~/.gradle/gradle.properties
# app/build/outputs/bundle/release/app-release.aab   <- upload this to Play Console
```
(`KIB_RELEASE=1` is needed at prebuild. The key must be set for `bundleRelease`; without it the build stops with a clear message.)

**An APK from the store configuration, for a rehearsal on a phone** (package `uk.co.knowitball.game`, upload key):
`KIB_RELEASE=1 ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Without a key it is signed with the debug key and a warning is printed.

**Check the result:**
```
apksigner verify --print-certs app-release.apk          # SHA-1 must match the Play upload key
jarsigner -verify -certs app/build/outputs/bundle/release/app-release.aab
aapt2 dump badging app-release.apk | grep -E "package|uses-permission|native-code"
```
The permissions line must list only the five above (plus Android's own `...DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`), and `native-code` must show `armeabi-v7a arm64-v8a`.

**Making a new upload key** (only if there is none, or Google reset it):
```
keytool -genkeypair -v -keystore knowitball-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Knowitball, O=Knowitball, C=GB"
```
Keep the .jks and both passwords in two separate safe places (a password manager, not the repo).

**How Play App Signing works here (READ from Google's rules; the repo says the packed app already uses it):** Google holds the
real signing key ("app signing key"). We sign the .aab with the *upload key*; Google checks it is the registered upload key,
removes it, and re-signs with its own key for every phone. A phone that has the packed 1.1 accepts the new app as an
update because Google signs both with the same app signing key. So: **the new .aab must be signed with the same upload key as
the packed app, or with a new one registered through "Request upload key reset".** A brand-new key without that reset is refused at upload.
You cannot make the new app a separate listing: a package name is one app, forever.

## 6. Moving saves from the packed app

What the packed app stores (READ, `lib/star/storage.ts`): the whole game is the website's game, so the save is in the
WebView's `localStorage` under these keys (scope `anon`, the packed app has no sign-in):
`star-career-v2::anon` (career slot 1; slots 2 and 3 are `...#slot2`, `...#slot3`), `star-career-active-slot-v1::anon`,
`star-career-saved-at-v1::anon`, `star-hall-of-fame-v1::anon`, plus settings and tutorial flags. Goal videos are in
IndexedDB (`lib/star/goalClip`), not in the save.

Where it lives after the update (READ from Chromium's design, GUESS for the exact Android WebView version): Android keeps an
app's data folder when an update replaces it. The old WebView's localStorage is a LevelDB folder at
`<app data>/app_webview/Default/Local Storage/leveldb/` (https://localhost, Capacitor's address). The new app reads that
folder with expo-file-system (it may read any readable file in its own data folder: READ of expo-modules-core's
`FilePermissionService`).

What was built (`phone/src/migrate/`, all reads, never writes to the old folder):
- `leveldb.ts`: a small LevelDB reader (log files, tables, snappy, checksums, newest entry wins, deletes) and Chromium's
  localStorage key/value format (Latin-1 and UTF-16 values, both origin spellings).
- `oldSave.ts`: turns the keys into careers through the game's own loader (`loadCareerFromStoredForm`), the same one a pasted save code uses.
- `applyOldSave.ts`: safety copy first (`kib-old-save-backup-<time>.json` in the app's files; if it cannot be written, nothing is imported),
  never over an existing career, careers into the same three slots, the Hall of Fame merged, everything undone on an error, asked once.
- `screens/OldSavePrompt.tsx`: on a first start, if there is an old save and no career here yet, a screen says "We found your saved game"
  with the name, club, season, **Bring it over** / **Not now** (asks again next start). In the test app the folder does not exist, so nothing shows.
  Switch it off with `OLD_SAVE_IMPORT = false` in `src/migrate/oldWebview.ts`.

Proof (`node phone/tools/migrate-check.ts`, 43 checks, SEEN passing): CRC32C and snappy against known answers; a real career
saved by `lib/star/storage.ts` (with a name that forces UTF-16), laid into a fake LevelDB folder the way Chromium does (tables with
snappy blocks, a newer log split over 32 KB blocks, a delete, other origins, an old-style origin); read back byte for byte and equal to what the
website's own `loadCareer` returns; a flipped byte, a torn log, garbage files (nothing throws, the good data stays); the import, the
backup-first rule, the no-overwrite rule, the three slots, the Hall.

**What only a real phone can say:**
1. That the folder is where it is said on the phone's Android WebView version, and that a path with a space ("Local Storage") opens (the code tries three spellings).
2. That the WebView's LevelDB was written the way the spec says by the real Chromium (the fixture is written from the spec, not by Chromium).
3. How long reading takes on a slow phone (a real save is 180 to 550 KB; the reader is plain JavaScript).
4. That nothing else cleans that folder on update (nothing in the repo does).

**Rehearsal to do before Production** (needs the upload key and a phone, no Play): build the packed app's release APK
(`mobile/`, section "Release build") and the new store APK with the same key. `adb install` the packed one, play two matches,
`adb install -r` the new one over it. The "We found your saved game" screen should show. If it does not, send Harry a screenshot of
Settings > "Android says the app last stopped because", and the folder listing with a rooted phone or a debuggable packed build
(`adb shell run-as uk.co.knowitball.game ls -R app_webview/Default/"Local Storage"`).

**Not brought over:** goal videos (IndexedDB), game settings (sound, quality), tutorial flags, daily real-goals progress. The player
sees the tutorials again and sets the sound again. The old folder stays on the phone, untouched, so a later version can import more.

## 7. Play "Data safety" form (what the app stores and sends)

Facts (READ and grep): the phone app has no account, no ads, no analytics (no PostHog, no Sentry, no Supabase in `phone/package.json`,
no external web address called in `phone/src`). The game is on the phone: the career is saved on the phone (MMKV). A photo you take or choose for
your player is cut to a small picture and kept inside the save, on the phone. A goal video you choose to save goes to your photos (write only).

Suggested answers (GUESS: Mikey must make the final call, Google holds the developer responsible):
- Does the app collect or share user data? **No** (nothing leaves the phone).
- Is data encrypted in transit? Not applicable (no data in transit). If `INTERNET` stays, say there is none sent.
- Data deletion: "all data is on the phone; uninstall deletes it".
- Android Auto Backup is on (`allowBackup`, as in the packed app): Google may back up the app's folder to the player's own Google account. Google's form does not count that as collection by the developer (GUESS). If Mikey prefers not, the switch is `android:allowBackup="false"` and the old saves would then not be backed up either.
- Camera and "Photos and videos": used only on the player's tap, only on the phone.
- If a real phone shows any network call after all, this answer changes. That is why `KIB_NO_INTERNET=1` is worth one test.

## 8. Privacy policy

Play needs a public privacy-policy address. The website's `/legal` page is about the website (Google sign-in, Supabase). It does not
yet say what the app does. It lives in `app/legal/page.tsx`, outside this task's folders, so it is not changed here. Needed there:
a short "Android app" paragraph: the game is saved on the phone only, no account, no ads, no analytics, the camera and photos are used
only when you choose to, nothing is sent, and the contact email (knowitballcontact@gmail.com).

## 9. Risks and how to go back

- **A different app replaces the old one at the same package.** After the update there is no "downgrade". If the new app is bad,
  the way back is a NEW release with a higher versionCode: rebuild the packed app from git (tag it first: `git tag packed-1.1 <the commit of mobile/ at 1.1>`),
  set its versionCode to 21 or more, upload. Players then get the packed app again. Their old WebView folder is untouched, so their old
  game is still there (progress made in the new app does not go back).
- **Start with the closed test** (the testers hold 1.1), then production at **1%, then 5%, 20%, 50%, 100%**, a day or more between steps.
  Watch Play Console > Android vitals (crash rate, ANR) and reviews. Halt a rollout with "Halt rollout" the moment crashes show.
- **Known soft spots** (docs/phone-app/STATUS-22NOV.md): the main-menu crash after "Who are you?", the playtest-round fixes still open,
  nothing yet measured for frame rate on a real phone in the heavy 3D scenes, 32-bit phones never run at all.
- **Save safety:** the import is off by default for anyone who has already started a career in the new app; a failed import changes nothing; the old data is never deleted.
- **App size and update time:** the new app is smaller than the packed one (about 45 to 50 MB a phone against 155 MB).
- **Review time:** Google reviews a production release (hours to days); a changed target or permissions can ask for a declaration form. The store build asks for none of the sensitive ones.
- **Store rule (READ):** apps need a target API level of the year; this one is 36. If Play asks for newer, a React Native upgrade is the work.
- **Not done, on purpose:** iPhone, any change to the website, any change to `lib/` or `mobile/`.
