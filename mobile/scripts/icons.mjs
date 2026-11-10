/**
 * mobile/scripts/icons.mjs — the app's icon and opening screen (Android and iPhone).
 *
 *   cd mobile && node scripts/icons.mjs
 *
 * Made from the game's own icon (public/star/app-icon-512.png), so the app
 * on the phone matches the website's home-screen icon. Writes every size
 * Android asks for into android/app/src/main/res. Run again if the icon
 * changes; the results are committed.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RES = path.join(MOBILE, "android/app/src/main/res");
const ICON = path.join(MOBILE, "../public/star/app-icon-512.png");
const SPLASH_BG = "#0b100e";

// The icon's own green (its top-left corner), for the shaped-icon background.
const { data } = await sharp(ICON).extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const green = "#" + [data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, "0")).join("");

const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  const dir = path.join(RES, `mipmap-${d}`);
  const s = Math.round(48 * k);
  await sharp(ICON).resize(s, s).png().toFile(path.join(dir, "ic_launcher.png"));
  // Round: the same picture cut to a circle.
  const circle = Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
  await sharp(ICON).resize(s, s).composite([{ input: circle, blend: "dest-in" }]).png().toFile(path.join(dir, "ic_launcher_round.png"));
  // Shaped icons (Android 8+): the phone cuts its own shape out of the middle
  // two thirds, so the picture sits at 66% on its own green.
  const f = Math.round(108 * k), inner = Math.round(f * 0.66);
  const art = await sharp(ICON).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: f, height: f, channels: 4, background: green } }).composite([{ input: art, gravity: "centre" }]).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
}
fs.writeFileSync(path.join(RES, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${green}</color>\n</resources>\n`);

// The opening screen: the icon on the game's dark green, at every size there is.
let n = 0;
for (const dir of fs.readdirSync(RES).filter((x) => x.startsWith("drawable"))) {
  const file = path.join(RES, dir, "splash.png");
  if (!fs.existsSync(file)) continue;
  const m = await sharp(file).metadata();
  const side = Math.round(Math.min(m.width, m.height) * 0.34);
  const circle = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2}"/></svg>`);
  const art = await sharp(ICON).resize(side, side).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
  const out = await sharp({ create: { width: m.width, height: m.height, channels: 4, background: SPLASH_BG } }).composite([{ input: art, gravity: "centre" }]).png().toBuffer();
  fs.writeFileSync(file, out);
  n++;
}
// iPhone (mobile/ios): one 1024 icon with no see-through parts, and the
// opening picture. The source is 512, so the 1024 is an enlargement: swap in
// a true 1024 original before the App Store upload if one exists.
const IOS = path.join(MOBILE, "ios/App/App/Assets.xcassets");
if (fs.existsSync(IOS)) {
  await sharp(ICON).resize(1024, 1024, { kernel: "lanczos3" }).flatten({ background: green }).png().toFile(path.join(IOS, "AppIcon.appiconset/AppIcon-512@2x.png"));
  const side = 2732, art = Math.round(side * 0.2);
  const circle = Buffer.from(`<svg width="${art}" height="${art}"><circle cx="${art / 2}" cy="${art / 2}" r="${art / 2}"/></svg>`);
  const ball = await sharp(ICON).resize(art, art).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
  const splash = await sharp({ create: { width: side, height: side, channels: 4, background: SPLASH_BG } }).composite([{ input: ball, gravity: "centre" }]).png().toBuffer();
  for (const f of fs.readdirSync(path.join(IOS, "Splash.imageset")).filter((x) => x.endsWith(".png"))) fs.writeFileSync(path.join(IOS, "Splash.imageset", f), splash);
  console.log("iPhone: icon 1024 and opening picture");
}
console.log(`icons: 5 sizes x 3, background ${green}; opening screens: ${n}`);
