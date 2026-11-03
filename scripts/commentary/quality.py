"""Numbers you can check a take with, since a script cannot listen.

    q = Quality("/home/user/models")      # needs asr/ and dnsmos/ there (README)
    q.score(wav, sr, "And it's in!")       # -> dict

- wer:   words the speech recogniser (Whisper base.en via sherpa-onnx, Apache-2.0)
         heard wrong, 0 = every word right. Catches mumbled or invented words.
- mos:   DNSMOS P.808 (Microsoft, MIT): predicted listener score 1-5 for how
         clean and natural it sounds.
- sig:   DNSMOS SIG: the voice itself, 1-5 (robotic/garbled scores low).
- range: pitch range in semitones (10th to 90th percentile). Flat reading ~3-5,
         an excited TV call 8+.
- rate:  words per second.
"""
import os, re
import numpy as np
import librosa
import onnxruntime as ort


_SAME = {"we're": "we are", "they're": "they are", "you're": "you are", "he's": "he is", "it's": "it is",
         "that's": "that is", "there's": "there is", "i'd": "i would", "he'll": "he will", "i'll": "i will",
         "you've": "you have", "can't": "cannot", "won't": "will not", "30": "thirty", "1": "one", "2": "two",
         "ok": "okay", "leveled": "levelled", "goalkeeper": "goal keeper", "cutback": "cut back"}


def _words(s):
    s = s.lower().replace("’", "'").replace("-", " ")
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    out = []
    for w in s.split():
        out += _SAME.get(w, w).split()
    return out


def wer(ref, hyp):
    r, h = _words(ref), _words(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int)
    d[:, 0] = range(len(r) + 1); d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r), len(h)] / max(1, len(r))


class Quality:
    def __init__(self, models: str):
        import sherpa_onnx
        a = os.path.join(models, "asr", "sherpa-onnx-whisper-base.en")
        self.asr = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=os.path.join(a, "base.en-encoder.int8.onnx"), decoder=os.path.join(a, "base.en-decoder.int8.onnx"),
            tokens=os.path.join(a, "base.en-tokens.txt"), num_threads=2)
        d = os.path.join(models, "dnsmos")
        self.sbo = ort.InferenceSession(os.path.join(d, "sig_bak_ovr.onnx"), providers=["CPUExecutionProvider"])
        self.p808 = ort.InferenceSession(os.path.join(d, "model_v8.onnx"), providers=["CPUExecutionProvider"])

    def heard(self, x16):
        s = self.asr.create_stream(); s.accept_waveform(16000, x16.astype(np.float32))
        self.asr.decode_stream(s)
        return s.result.text.strip()

    def dnsmos(self, x16):
        n = int(9.01 * 16000)
        a = x16
        while len(a) < n:
            a = np.concatenate([a, x16])
        a = a[:n].astype(np.float32)
        mel = librosa.feature.melspectrogram(y=a[:-160], sr=16000, n_fft=321, hop_length=160, n_mels=120)
        mel = ((librosa.power_to_db(mel, ref=np.max) + 40) / 40).T.astype(np.float32)
        p808 = float(self.p808.run(None, {"input_1": mel[np.newaxis]})[0][0][0])
        sig, bak, ovr = self.sbo.run(None, {"input_1": a[np.newaxis]})[0][0]
        sig = np.poly1d([-0.08397278, 1.22083953, 0.0052439])(sig)
        return p808, float(sig)

    def score(self, x, sr, text, fmax=500):
        """fmax: the highest pitch looked for. 500 Hz (the v2 voice) can hide a
        squeal; generate_teams.py uses 900 and also reads `p95` (the pitch
        of the top 5 % of the voiced moments), which is where a squeal shows."""
        x16 = librosa.resample(np.asarray(x, dtype=np.float32), orig_sr=sr, target_sr=16000)
        hyp = self.heard(x16)
        mos, sig = self.dnsmos(x16)
        f0, vf, _ = librosa.pyin(x16, fmin=60, fmax=fmax, sr=16000)
        f0 = f0[~np.isnan(f0)]
        rng = float(12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))) if len(f0) > 5 else 0.0
        dur = len(x16) / 16000
        out = {"wer": round(wer(text, hyp), 3), "heard": hyp, "mos": round(mos, 2), "sig": round(sig, 2),
               "range": round(rng, 1), "f0": round(float(np.median(f0)), 0) if len(f0) else 0,
               "rate": round(len(_words(text)) / max(0.3, dur), 2), "dur": round(dur, 2)}
        if fmax != 500:
            out["p95"] = round(float(np.percentile(f0, 95)), 0) if len(f0) > 5 else 0
            out["voiced"] = round(len(f0) / max(1, len(x16) / 512), 2)
        return out
