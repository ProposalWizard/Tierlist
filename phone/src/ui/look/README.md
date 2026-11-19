# The look kit: KIB Next in the packed app's look

Mikey, 19 Nov 2026: "the packed app version is really what you should be aiming
to get … compare it with that". The packed app is the website's own screens
(`components/star/*`, the **Glass stadium** skin `components/star/ui/glassLook.css`
on the Pitch look `pitchLook.css`). This folder is those pieces, rebuilt for the
phone. Restyle a screen with these, then check it on the side-by-side sheets:

```bash
node phone/tools/look/compare.mjs --build --only <screen ids>   # phone/tools/look/README.md
```

Open the sheets in `phone/tools/look/out/sheets/` and LOOK at them after every change.

## Rules (why it is built this way)

- **No blur, ever** (no BlurView, no backdrop blur). The website frosts panels by
  blurring what is behind them; here a panel is a see-through fill a little
  darker than the website's, a light rim and a bright top edge. The one blurred
  picture (`STADIUM_BLUR`) was blurred once, when it was made.
- **Nothing moves at rest.** The website's pulses, shines and floating lights are
  left out. Gradients and shadows are plain styles (`backgroundImage`,
  `boxShadow`): the phone draws them once.
- Gradients: `backgroundImage: "linear-gradient(...)"` / `"radial-gradient(...)"`
  as a style (React Native 0.88 draws CSS gradients natively; react-native-web
  passes them to the browser). Cast the style `as ViewStyle` where TypeScript asks.
- Risky drawing (Skia, 3D) stays behind `useRiskyPart` (`src/safety.ts`). The kit
  itself uses only plain views and pictures.

## Import

```tsx
import { Backdrop, TopBar, BottomBar, Glass, LookButton, SlantButton, Display, Kicker,
  SectionHeading, Pill, Tag, Bar, FillStar, LOOK, FONT, ICON, CAN, rgba } from "../ui/look";
```

## Pieces

| Piece | Use | Website source |
|---|---|---|
| `FONT.display` | `fontFamily: FONT.display` = **Anton** (headings, names, big numbers; one weight, never set `fontWeight` with it) | `ui/pitchFont.ts` |
| `FONT.serif` | **Cinzel Black**, the gold STAR PASS serif | `app/layout.tsx` |
| body | leave `fontFamily` unset: the phone's sans (Roboto), as the website's `font-sans` | |
| `<Backdrop kind="stadium" />` | blurred day stadium: Stats, League, Phone, Post-match, Settings | glassLook 1 |
| `<Backdrop kind="title" sky />` | the stadium seen from the pitch (title) | `TitleScreen.tsx` |
| `<Backdrop kind="home" sky lineY />` | Home's scene, hoardings on screen height `lineY` | `HomeHub.tsx HomeScene` |
| `<Backdrop kind="green" />` | the new-career green | `ProfileSetup.tsx` |
| `<TopBar career onHelp onSettings onStarPass left? />` | name, AGE, ★money, ?, ⚙; star badge + gold bar; lightning + energy bar. `left="happiness"` (Relations) or `"reputation"` (Style) | `ui/GameBar.tsx`, `ui/TopHud.tsx` |
| `<BottomBar active="home" on={{…}} />` | League · Training · Home · Phone · PLAY, badges (training left ⚡, phone unread), padlocks with the "how to open" line. Without `on` it goes to the app's screens (`useMainBarActions`). Put it at the bottom of any full screen. | `MainBar.tsx` |
| `<Glass>` / `tone="green" \| "inset" \| "dark"` / `glow="#hex"` | the panels | glassLook 2, `ClubCard.tsx` |
| `<LookButton kind label />` | `primary` green, `navy` Back, `gold`, `glass`, `dark`, `danger`, `accent` (+`accent="#hex"`); `small` | `ui/PressButton.tsx` |
| `<SlantButton icon label primary? gold? hint? badge? />` | the title menu's slanted tabs | `TitleScreen.tsx MenuButton` |
| `<PlayButton />` | the round glowing PLAY (the bottom bar uses it) | glassLook 6 |
| `<Display size>` `<Kicker>` `<SectionHeading right>` `<Pill label value>` `<Tag>` | words | |
| `<Bar value colors />`, `<FillStar fraction level />`, `levelColors(v)` | the top bar's glossy bar and filling star | `ui/TopMeter.tsx`, `ui/StatBar.tsx` |
| `LOOK`, `rgba()`, `vgrad()`, `GLASS_EDGE`, `TEXT_SHADOW` | colours and small helpers | |
| `ICON.energy / world / fame / starFull / starEmpty / ball / boot`, `CAN.basic / premium / elite`, `TITLE_STADIUM`, `HOME_SCENE`, `STADIUM_BLUR` | pictures | `public/icons3d`, `public/home`, `public/star` |

## Pictures and fonts (phone/assets/look)

Copied from the website's `public/` (only what a screen uses; add a line in
`pictures.ts` when a screen needs another):

- `bg/title-stadium-{day,sunset,night}.webp`, `bg/scene-{day,sunset,night}.webp`
- `bg/stadium-blur.webp`: `public/home/title-stadium-day.webp` at half size, blurred
  (ImageMagick: `convert title-stadium-day.webp -resize 50% -blur 0x9.5 -modulate 85,115 -quality 80 stadium-blur.webp`)
- `icons/`: `icons3d/{energy,world,fame,star-full,star-empty}.png`, `star/ball.webp`,
  `shop/boot-control-L1.webp`, `star/kib-{basic,premium,elite}.webp`
- `fonts/Anton.ttf`, `fonts/Cinzel-Black.ttf` (Google Fonts, SIL Open Font License;
  from `@expo-google-fonts/anton` and `@expo-google-fonts/cinzel`). Loaded once in
  `App.tsx` (`useLookFonts`, at most 1.5 s, then the app starts anyway).
- The seven default faces of the photo step are already in the app's packed
  pictures (`data/packed.ts packedPicture`, from `lib/star/fakeFaces.ts`).

## Screens done in this look (19 Nov 2026)

Title (`screens/career/TitleMenu.tsx`), new career incl. the photo step
(`screens/career/NewCareer.tsx`), Home (`screens/Home.tsx`) with the bottom bar
(`areas/core.tsx` Tabs). Every other screen still uses the old flat kit
(`screens/career/kit.tsx`, `ui/theme.ts`); restyle it with these pieces.

The tabs screen opens on League with `nav.replace("tabs", { tab: "league" })`
(the bottom bar's League button does this from any screen).
