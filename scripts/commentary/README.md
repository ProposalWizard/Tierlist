# Commentary voices

The goal-video commentary (and the live match's late goal call) is a set of
short recorded lines. The words live in `lib/star/goalClip/commentary.ts`.
There are two sets of recordings of the same lines:

| Set | Files | Made by | Plays when |
|-----|-------|---------|------------|
| v1, the first voice | `public/sfx/cl-*.mp3`, `cc-*.mp3` | `generate.py` (Kokoro) | always, unless the switch below is on |
| v2, the new voice | `public/sfx/v2/cl-*.mp3`, `cc-*.mp3` | `generate_v2.py` (Chatterbox) | Settings → Updates → Leo's update → "New commentary voice" |
| teams, four commentary teams | `public/sfx/teams/cl-<who>-*.mp3`, `cc-<who>-*.mp3` | `generate_teams.py` (Chatterbox) | Leo's update → "Different commentators" (wins over "New commentary voice") |

The switch is read in `lib/star/goalClip/commentaryVoice.ts`. Off, on the
server and in tests: v1, exactly as before (`tests/star/commentators.mts`
checks 870 sound plans against a snapshot taken before the teams existed).
A line replaced on the Sound Board plays its replacement in every set.

## The commentator teams (31 Oct 2026)

Lines and who says them: `lib/star/goalClip/commentators.ts`. Each
commentator has his or her own lines (leads 37, co-commentators 30), not the
v1 lines re-read. Voices and licences: `public/sfx/teams/LICENSE.txt`.

| Team | Lead | Co | Picked for |
|------|------|----|-----------|
| Matchday | The Anchor (classic, measured; bm_george) | The Old Pro (bm_daniel) | TV accounts / any match |
| Big Night | The Poet (lyrical; bf_emma) | The Analyst (bf_lily) | TV accounts / any match |
| Late Show | The Deadpan (dry; bf_isabella) | The Old Pro | TV accounts / any match |
| Fan TV | The Live Wire (excitable; bm_fable) | The Mate (am_puck) | non-official accounts / any match |

`teamFor(matchKey, poster?)`: same match, same team. `planAudio(edit, set,
poster?)` and `playLateGoalCall(kind, seed, matchKey?)` take the optional
inputs; without them the team comes from the match (or the seed).

```
nice -n 10 python3 scripts/commentary/generate_teams.py /home/user/models            # every line not made yet
python3 scripts/commentary/generate_teams.py /home/user/models cl-poet-g1             # remake one (adds takes)
python3 scripts/commentary/ab_teams.py docs/handoffs/2026-10-31-leo/commentators      # the A/B page's audio
```

Takes per line: up to 3 (leads) / 2 (co), stopping at the first that passes.
Each take's scores are in `teams-takes.json`: `wer` (words missed, little
words like "and"/"is" ignored), `wer_strict`, `mos`/`sig` (DNSMOS), `lift`
(median pitch rise over the calm voice, semitones), `peak` (top 5 % rise;
over 20 = squeal, rejected), `weak` (why the chosen take is still doubtful).

## The v2 voice: what it is

- **Model: Chatterbox** by Resemble AI, MIT licence, run on the CPU through
  ONNX Runtime (`chatterbox_engine.py`). It has an emotion control
  ("exaggeration"), which is what lets a goal call build and the
  co-commentator stay calm.
- **Whose voice: nobody's.** Chatterbox copies the voice of a short reference
  recording. The references here are read by Kokoro's own bundled voices
  (Apache-2.0): `bm_lewis` for the lead, `bm_daniel` for the co-commentator.
  No real person was recorded, cloned or imitated, and no prompt names one.
  Keep it that way: never use a recording of a real commentator as a reference.
- **Delivery per kind of line** (`STYLE` in `generate_v2.py`): goal calls
  exaggeration 1.1, late calls 1.3, score lines 0.8, co-commentator 0.45.
  `SPOKEN` holds how a few lines are said aloud when that differs from the text.
- **Takes:** up to 5 per line. Each take is heard back by a speech recogniser
  and scored (`quality.py`): every word right first, then the right amount of
  excitement (how far the pitch rises above his calm voice: 10-17 semitones
  for a goal call), then the predicted naturalness (DNSMOS). The scores of
  every take are in `v2-takes.json`.
- **Commentary-box sound** (`broadcast.py`): low cut, presence lift,
  compression, a touch of room, "hot mic" on the big calls. Because the files
  carry it, `audio.ts` puts only a gentle low cut on top for v2.

## Remake the v2 voice

Models stay OUT of the repo (about 4 GB). Put them in one folder, e.g.
`/home/user/models`:

```
chatterbox/tokenizer.json, chatterbox/default_voice.wav
chatterbox/onnx/{speech_encoder,embed_tokens,conditional_decoder}.onnx (+ .onnx_data)
chatterbox/onnx_q4/language_model.onnx + language_model_q4.onnx_data
misc/kokoro-v1.0.onnx, misc/voices-v1.0.bin
asr/sherpa-onnx-whisper-base.en/   (base.en-*.int8.onnx, base.en-tokens.txt)
dnsmos/sig_bak_ovr.onnx, dnsmos/model_v8.onnx
```

Where they came from (Hugging Face was blocked in the build container, so
GitHub release mirrors were used):

- Chatterbox ONNX (export of onnx-community/chatterbox-ONNX, MIT):
  github.com/wxzrd21614/looperbox-models releases `v0.1.0-fp32` (all files)
  and `v0.1.0-q4` (`language_model.onnx` + data; rename the data file to
  `language_model_q4.onnx_data`). The 4-bit language model is ~7x faster on
  a CPU; the voice comes from the decoder, which stays full precision.
- Kokoro: github.com/thewh1teagle/kokoro-onnx releases `model-files-v1.0`.
- Speech recogniser: github.com/k2-fsa/sherpa-onnx releases `asr-models`,
  `sherpa-onnx-whisper-base.en.tar.bz2` (Whisper, MIT).
- DNSMOS: github.com/microsoft/DNS-Challenge, `DNSMOS/DNSMOS/*.onnx` (MIT).

```
pip install onnxruntime kokoro-onnx sherpa-onnx librosa soundfile av scipy tokenizers
python3 scripts/commentary/generate_v2.py /home/user/models            # every line not made yet
python3 scripts/commentary/generate_v2.py /home/user/models cl-g1 cc-g8  # remake these
python3 scripts/commentary/ab_samples.py /home/user/models docs/handoffs/2026-10-30-leo/voice
```

About 30-60 s per line on a 4-core CPU. A new line in `commentary.ts` needs a
v2 recording too (`tests/star/goalClipVoice.mts` fails until it has one).
