// Builds KIB Next for a browser (Expo web, react-native-web) into
// phone/tools/look/out/web. About 3 minutes. Also puts next to index.html:
//  - canvaskit.wasm (Skia for the web; src/Boot.web.tsx loads it from "/canvaskit.wasm")
//  - /fonts/Roboto-<weight>.ttf, Android's own font, for the screens' words (an
//    @font-face added to index.html) and for Skia's drawn words (src/web/fonts.ts).
//    Fetched once with `npm pack @expo-google-fonts/roboto` (Apache 2.0) into out/roboto.
//
//   node phone/tools/look/build-web.mjs [outDir]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHONE = path.resolve(HERE, "../..");
export const WEB_OUT = path.join(HERE, "out/web");
const ROBOTO = path.join(HERE, "out/roboto");
const WEIGHTS = { 400: "400Regular", 500: "500Medium", 700: "700Bold", 800: "800ExtraBold", 900: "900Black" };

function robotoFiles() {
  if (!fs.existsSync(path.join(ROBOTO, "package"))) {
    fs.mkdirSync(ROBOTO, { recursive: true });
    const tgz = execFileSync("npm", ["pack", "@expo-google-fonts/roboto", "--silent"], { cwd: ROBOTO, encoding: "utf8" }).trim().split("\n").pop();
    execFileSync("tar", ["xzf", tgz], { cwd: ROBOTO });
  }
  const files = Object.entries(WEIGHTS).map(([w, d]) => ({ name: `Roboto-${w}.ttf`, weight: w, italic: false, src: path.join(ROBOTO, "package", d, `Roboto_${d}.ttf`) }));
  files.push({ name: "Roboto-400i.ttf", weight: "400", italic: true, src: path.join(ROBOTO, "package/400Regular_Italic/Roboto_400Regular_Italic.ttf") });
  // the heavy italics too (the title's KNOWITBALL is Roboto Black Italic on a phone): without
  // them a browser fakes the slant on another weight, and the word's width is wrong
  files.push({ name: "Roboto-700i.ttf", weight: "700", italic: true, src: path.join(ROBOTO, "package/700Bold_Italic/Roboto_700Bold_Italic.ttf") });
  files.push({ name: "Roboto-900i.ttf", weight: "900", italic: true, src: path.join(ROBOTO, "package/900Black_Italic/Roboto_900Black_Italic.ttf") });
  return files;
}

export function buildWeb(out = WEB_OUT) {
  fs.rmSync(out, { recursive: true, force: true });
  execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out], {
    cwd: PHONE, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, CI: "1" },
  });
  fs.copyFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm"), path.join(out, "canvaskit.wasm"));
  try {
    const fonts = robotoFiles();
    fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
    for (const f of fonts) fs.copyFileSync(f.src, path.join(out, "fonts", f.name));
    // Under two names. react-native-web asks for `-apple-system, BlinkMacSystemFont, "Segoe UI",
    // Roboto, …`, and Chromium answers BlinkMacSystemFont with the computer's own font, so the
    // words were never Roboto and every width was off (measured: 4.5% wider, 11% for the heavy
    // italic). "-apple-system" is first in that list and means nothing on Linux: named here, it
    // is Roboto, and the words are as wide as Android draws them.
    const css = ["Roboto", "-apple-system"].map((fam) => fonts.map((f) => `@font-face{font-family:"${fam}";src:url(/fonts/${f.name}) format("truetype");font-weight:${f.weight};font-style:${f.italic ? "italic" : "normal"}}`).join("")).join("");
    const index = path.join(out, "index.html");
    fs.writeFileSync(index, fs.readFileSync(index, "utf8").replace("</head>", `<style id="look-fonts">${css}</style></head>`));
  } catch (e) {
    console.warn("Roboto not added (no network?): the screens show the browser's own font.", String(e).slice(0, 200));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("built:", buildWeb(process.argv[2] ? path.resolve(process.argv[2]) : WEB_OUT));
}
