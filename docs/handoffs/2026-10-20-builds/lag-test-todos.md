# Lag test to-dos (Harry, 20 Oct 2026)

Harry: "me mikey and Leo have 3 different levels of phones, maybe we could add to do copy and paste prompts for each of us to run lag tests".

Runs after the next push (the lag test reaches phones with it). Each person adds the to-do on the Team board (To-do tab), then pastes the prompt into their own Claude chat when they sit down to do it.

## To-do (one each: Harry, Mikey, Leo)

Lag test on my phone (10 min, after the next push): ⚙ (top right of Home) → 🛠 Dev → Start lag test. Paste the lag-test prompt into my Claude chat first.

## The prompt (same for all three)

```
Lag test for Knowitball (B18). Merge main into my branch first.
I'm going to run the in-game Lag test on my phone now. Walk me through it one step at a time, short and plain:
1. Open knowitball.co.uk/star-dev on my phone, signed in. ⚙ (top right of Home) → 🛠 Dev → Start lag test.
2. Pick my device on the first screen (iPhone 16 or newer / iPhone 13 or 14 / older Android / a PC tier) and my name.
3. Follow the pill at the top: go to each screen it names, tap "I'm there", wait for "Done, tap Next", tap Next. Skip any step I can't reach.
4. At the end, screenshot the ✓/✗ table. It sends itself; if it says it didn't, tap "Send again".
When I say done, run `npx tsx scripts/lag-runs.mts` and tell me: my run is saved (yes/no), my device, and each step that failed with its numbers.
If it says "Saved on this device only", tell me to tap "Copy results" and paste them into the Team chat instead.
Don't change any game code for this.
```
