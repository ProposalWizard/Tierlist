# The design kit — the home screen's look, anywhere

Harry, 28 Sep 2026: *"that can animation is elite, we need stuff like that all
over … all the pages should just be reskinned to fit the new home screen vibe."*

Everything the home screen (`HomeHub.tsx`) and the title screen
(`TitleScreen.tsx`) are built from. Import from `components/star/ui`:

```tsx
import { KitStyles, useClubTheme, ClubCard, Pill, StatBar, PressButton, CountUp,
  RiseIn, Glow, Stadium, Burst, FloatText, Shake, Pop, Shine, Drips, useTrigger } from "@/components/star/ui";
```

**Render `<KitStyles />` once** on any screen that is not inside the dashboard
(the dashboard shell already renders it as `HomeFxStyles`). Every animation
stops for a phone set to reduce motion.

## Colours

```tsx
const theme = useClubTheme(career);   // { club, shirt, trim, glow }
clubTheme("Arsenal", career);         // any other club (the other side of a fixture)
```

`glow` is the colour to light things with: very dark kits are lifted, white
kits fall back to their trim.

## Pieces

| Piece | One line | What it is |
|---|---|---|
| `ClubCard` | `<ClubCard glow={theme.glow} className="p-3">…</ClubCard>` | Club-colour glass card, layered shadow, top highlight. `strength` = how much colour (0.28). `duel={[a, b]}` for two clubs meeting. |
| `Pill` | `<Pill gold label="Rating" value="★ 7.2" />` | A value over a small caps label. Sits in a flex row. |
| `StatBar` | `<StatBar value={energy} className="mt-1.5 h-4" />` | Glossy bar: gradient fill, sheen, glides to new values, races a sheen when it goes up. `colors={[a, b]}`, or green/amber/red by level. |
| `PressButton` | `<PressButton variant="primary" pulse>Continue</PressButton>` | Presses in under the finger. `primary` / `secondary` / `danger` / `gold` / `accent` (`accent="#60a5fa"`) / `plain`. `size` sm/md/lg/none. `pulse` = the Play button's pulse. |
| `CountUp` | `<CountUp value={money} format={(n) => formatMoney(Math.round(n))} />` | A number that counts to its new value. `useCountUp(value)` for the raw number. |
| `RiseIn` | `<RiseIn index={i}>…</RiseIn>` | Staggered entrance, 80 ms apart. `delay` to wait first. `onPageActive` inside the swipe pages. |
| `Glow` | `<Glow color={theme.glow} className="inset-1 blur-md" />` | A soft coloured glow behind something (put it first in a `relative` box). `pulse` to breathe. |
| `Stadium` | `<Stadium glow={theme.glow} />` | The night stadium behind the home hero. `intro` flickers the lights on; `big` for full screen. |

## Juice — reward animations

Fire each one by bumping a counter; `0` shows nothing.

```tsx
const [won, fireWon] = useTrigger();
<div className="relative">
  <Burst trigger={won} colors={[theme.shirt, theme.trim, "#fde047"]} />   {/* confetti; round for sparks */}
  <FloatText trigger={won} text="+★500" color="#fde047" />               {/* floats up and fades */}
</div>
<Shake trigger={used}><KibCanIcon can={can} /></Shake>                    {/* the can's wobble-and-tip */}
<Drips trigger={used} color="#fb923c" />                                  {/* the can emptying */}
<Pop value={count}>×{count}</Pop>                                        {/* bounces when count changes */}
<button className="relative overflow-hidden"><Shine loop />Play</button> {/* a bright sweep; trigger= for once */}
```

`FloatText motion="tick"` is the can's small "−1".

## Money screens — the shop, the store, the casino

```tsx
<ScreenShell glow={theme.glow} title="Boots" icon="👟" onBack={back}
  right={<WalletPill value={career.money} format={formatMoney} spent={n} spentText="−★12k" />}>…</ScreenShell>
const [layer, fly] = useFly();  fly(fromEl, toEl, <KibCanIcon …/>, onLand)   {/* render {layer} once */}
<WinCelebration trigger={won} amount={500} format={(n) => `+★${formatMoney(n)}`} colors={[…]} />
<ShakeX trigger={lost}>…the table…</ShakeX>  <LossFlash trigger={lost} />
<Badge count={3} />                                                        {/* a notification that pops in */}
```

`ScreenShell` is a whole screen outside the dashboard (it renders KitStyles).
`WalletPill` counts to its new value and floats `spentText` up off it.
`useFly` sends a copy of what you bought along an arc into where it now lives.

## The flat look (v0.23) — use these, not rounded cards on grey

```tsx
<FlatPanel bleed edge glow={theme.glow}>…</FlatPanel>      {/* full width, square, fades into the page */}
<SquareBar value={energy} colors={["#34d399", "#a3e635"]} className="h-4" animate>85</SquareBar>
<TopHud career={career} screen="home" onUseCan={use} onOpenCans={() => setPhase("shop-kib")} />
```

`FlatPanel` has no rounded corners and no drop shadow; `fade` is "both" (soft
top and bottom), "top", "bottom" or "none". `SquareBar` (and `StatBar`, which
is now the same shape) are square, outlined and ticked; `animate` marches
stripes along the fill. `TopHud` is the strip under the shell header: which
cells it shows per screen is `HUD_SPEC` in `TopHud.tsx`; energy is always one
of them, with its can (USE, or BUY into the cans shop). One heavy font
(Anton) is set on `.star-root` in `flat.css` — do not set a font by hand.

## Navigation the NSS way (v0.23) — `ui/Nav.tsx`

```tsx
<EdgeArrows prev={{ icon: "📅", label: "Season", onClick }} next={{ icon: "🏅", label: "Records", onClick }}>All seasons</EdgeArrows>  {/* one thin row, arrows at the edges */}
<ArrowButton side="right" a={{ icon: "🏠", label: "Home", onClick }} />   {/* one arrow, laid out yourself */}
<ScreenShell bare hud={<TopHud … />} bottomBar={<BottomBar><BarButton icon={<Chev dir="left" />} label="Back" onClick={back} /> … </BottomBar>}>…</ScreenShell>
<HelpDot text="One line." />                 {/* the small "?" */}
<HomeBar onActivate={closePhone} label="Close phone" />   {/* the phone's home bar: tap or swipe up */}
<EmptySlots rows={3} icon="📭" />            {/* an empty page: blacked-out slots, no words */}
```

Three or more tab rows on one screen is a bug: one row of edge arrows, a
bottom bar for Back / the page's switch / Home, and a `?` for any explaining.
A thing you do not have yet is shown blacked out (`filter: brightness(.18)`),
never hidden and never explained in a paragraph.

## Football screens are always the pitch (v0.23, P92)

```tsx
<PitchScope><TrainingMinigame … /></PitchScope>          {/* green, chalk, Anton, square corners — in BOTH looks */}
<PitchScope on={onTrainingPage}><DashboardShell … /></PitchScope>   {/* same wrapper, switched off elsewhere (no remount) */}
```

Training, the drills and the match chrome (scoreboard, bars, buttons around the
canvas) use the Pitch look whichever look Settings has chosen. `PitchScope`
adds the one `star-look-pitch` class; the canvas itself is untouched.

## The match-week page (v0.23, P90)

`components/star/MatchWeek.tsx` is the League screen: edge arrows flip Results ·
Fixtures · Table · Scout · Awards · Squad, the bottom bar is Back · 🔔 · Play,
and the bell opens the live-score list (the same clubs as Settings → Live scores).

## Rules

- No animation loops on a canvas: the one-engine guard fails the build on
  them. Everything here is CSS.
- Anything that has to be read must not depend on motion.
- Add new keyframes to `motion.tsx` (with a reduced-motion line), never inline.
