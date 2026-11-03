# Running the video factory in a fresh cloud session

```bash
cd /home/user/Tierlist   # or wherever the repo is
python3 -m venv /tmp/cbx
/tmp/cbx/bin/pip install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
/tmp/cbx/bin/pip install -q chatterbox-tts==0.1.7
pip install -q faster-whisper soundfile numpy || pip install -q --break-system-packages faster-whisper soundfile numpy
[ -d node_modules/playwright ] || npm ci --no-audit --no-fund
export CHATTERBOX_PY=/tmp/cbx/bin/python
ONLY="id1,id2" OUT=$PWD/tools/video-factory/out python3 -I tools/video-factory/run_queue.py
```
First run downloads the voice model (about 3 GB). One video takes about 20-30 minutes on 4 cores.
