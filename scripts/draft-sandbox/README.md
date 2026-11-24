# Draft sandbox

Plays PL Draft in a phone-sized headless browser and logs page errors, failed
API calls, slow squad loads (over 1.5 s), text glitches (undefined, NaN) and
every screen's buttons, with a still per screen.

    npx next dev -p 3300          # in another terminal
    node scripts/draft-sandbox/play.mjs <outDir> [--steps 260] [--watch-sim]

`--watch-sim` lets the season play out week by week instead of pressing Skip all.
Season numbers are checked separately: `npx tsx tests/draft/seasonSanity.mts 100`.
