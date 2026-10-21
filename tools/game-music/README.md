# Game music (Mikey, 21 Oct 2026)

The 11 tracks behind Settings → Game music (`lib/star/gameMusic.ts`).
They were inspired by the Blue Lock soundtrack: same speed, key and energy,
but every note is new. Mikey's reference tracks are NOT in the repo and must
never be (copyright). The finished files are in `public/star/music/`.

## What each file does
- `analyse.py <folder of mp3s>`: measures speed, key, the energy shape over
  time, brightness, drums and bass for each track. Gives you the style brief.
- `sampler.py`: plays notes through real orchestra recordings. It measures
  each recording's real pitch once (cached in `pitch_cache.json`).
- `cuelib.py`: the shared kit (instruments, chords, themes, loop render).
- `cues_all.py 01 02 …`: the 11 tracks. Loops are written so the end runs
  straight into the start, then padded with half a second of themselves on
  each side, so the game can loop them without a click.
- `final_boss_full.py`: the full 50-second final-boss piece Mikey approved
  (v3), with its own intro and ending. The game plays the loop version (11).

## Make them again
1. Get the free orchestra library VSCO 2 Community Edition (CC0, no conditions):
   `git clone --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE vsco`
   then in `vsco/`: `git checkout HEAD -- "Strings" "Brass" "Woodwinds" "Percussion" "Keys/Upright Piano"`.
2. `pip install librosa soundfile pyloudnorm scipy`
3. `python3 cues_all.py 01 02 03 04 05 06 07 08 09 10 11` (wavs land in `cues/`)
4. Encode: `ffmpeg -i cues/X.wav -codec:a libmp3lame -b:a 112k ../../public/star/music/X.mp3`
5. Copy each loop's `len` from `cues/X.json` into `CUES` in `lib/star/gameMusic.ts`.

## Where each plays in the game
See the header of `lib/star/gameMusic.ts`.
