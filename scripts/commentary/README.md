# Commentary voices

The goal-video commentary (and the live match's late goal call) is a set of
short recorded lines. The words live in `lib/star/goalClip/commentary.ts`.
There are two sets of recordings of the same lines:

| Set | Files | Made by | Plays when |
|-----|-------|---------|------------|
| v1, the first voice | `public/sfx/cl-*.mp3`, `cc-*.mp3` | `generate.py` (Kokoro) | always, unless the switch below is on |
| v2, the new voice | `public/sfx/v2/cl-*.mp3`, `cc-*.mp3` | `generate_v2.py` (Chatterbox) | Settings → Updates → Leo's update → "New commentary voice" |

The switch is read in `lib/star/goalClip/commentaryVoice.ts`. Off, on the
server and in tests: v1, exactly as before. A line replaced on the Sound Board
plays its replacement in both sets.

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
