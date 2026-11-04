# Running the video factory in a fresh cloud session

## Voice D (default): Qwen3-TTS cloning Tadhg Hynes
```bash
cd /home/user/Tierlist   # or wherever the repo is
python3 -m venv /tmp/qwen-tts
/tmp/qwen-tts/bin/pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu
/tmp/qwen-tts/bin/pip install -q qwen-tts soundfile
pip install -q faster-whisper soundfile numpy pillow || pip install -q --break-system-packages faster-whisper soundfile numpy pillow
[ -d node_modules/playwright ] || npm ci --no-audit --no-fund
export QWEN_PY=/tmp/qwen-tts/bin/python      # make.py's default is this path
python3 tools/video-factory/make.py tools/video-factory/stories/<id>.json
```
- **First run** downloads the model `Qwen/Qwen3-TTS-12Hz-0.6B-Base` (about 2.4 GB) into
  `~/.cache/huggingface`. Keep about 6 GB of disk free.
- It uses about 7 GB of RAM. make.py starts ONE voice process per video (`voice_qwen.py --serve`),
  loads the model once and sends it every line. Do not run two videos at once on a 16 GB machine.
- On 4 CPU cores a line takes about 8 to 12 times its own length (a 4 s line: 30 to 50 s);
  up to 3 seeds a line, the best kept by the transcriber.
- Optional env: `QWEN_THREADS` (CPU threads, default all), `QWEN_MODEL`.
- The reference voice is `voice/hynes.wav` with its words in `voice/hynes.txt` (LibriVox, public domain).

## Voice E (old): Chatterbox
```bash
python3 -m venv /tmp/cbx
/tmp/cbx/bin/pip install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
/tmp/cbx/bin/pip install -q chatterbox-tts==0.1.7
export CHATTERBOX_PY=/tmp/cbx/bin/python
python3 tools/video-factory/make.py tools/video-factory/stories/<id>.json --voice e
```

## A queue of videos
```bash
ONLY="id1,id2" OUT=$PWD/tools/video-factory/out python3 -I tools/video-factory/run_queue.py
```

## Real club badges
make.py reads Supabase `club_logos` with the public anon key (env `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
else `.env.local`, else the key in the live site's JavaScript) and caches badges in
`tools/video-factory/assets/badges/` (git-ignored). Delete `assets/badges/_index.json` to refresh the list.
