"""Chatterbox (Resemble AI, MIT licence) run through ONNX Runtime, CPU only.

The ONNX export is onnx-community/chatterbox-ONNX (MIT, same as the model).
The core loop follows chatterbox_onnx (TigreGotico, MIT,
https://pypi.org/project/chatterbox-onnx/), changed to SAMPLE the speech
tokens (temperature + min-p + top-p, a fixed seed per take) the way the
original PyTorch Chatterbox does, instead of always taking the single most
likely token. Greedy decoding is what makes it sound flat and samey.

    eng = Chatterbox("/home/user/models/chatterbox")
    voice = eng.voice("reference.wav")
    wav = eng.say("And it's in!", voice, exaggeration=0.9, seed=3)   # 24 kHz float32
"""
import os
import numpy as np
import onnxruntime as ort
import librosa
from tokenizers import Tokenizer

SR = 24000
START_SPEECH = 6561
STOP_SPEECH = 6562
LAYERS, KV_HEADS, HEAD_DIM = 30, 16, 64


class Chatterbox:
    def __init__(self, model_dir: str, threads: int = 0, lm_dir: str = "onnx"):
        so = ort.SessionOptions()
        if threads:
            so.intra_op_num_threads = threads
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        p = lambda n: os.path.join(model_dir, "onnx", n)
        self.tok = Tokenizer.from_file(os.path.join(model_dir, "tokenizer.json"))
        self.enc = ort.InferenceSession(p("speech_encoder.onnx"), so, providers=["CPUExecutionProvider"])
        self.emb = ort.InferenceSession(p("embed_tokens.onnx"), so, providers=["CPUExecutionProvider"])
        self.lm = ort.InferenceSession(os.path.join(model_dir, lm_dir, "language_model.onnx"), so, providers=["CPUExecutionProvider"])
        self.dec = ort.InferenceSession(p("conditional_decoder.onnx"), so, providers=["CPUExecutionProvider"])

    def voice(self, wav_path: str, max_seconds: float = 10.0):
        """Speaker conditioning from a reference recording (first 10 s)."""
        x, _ = librosa.load(wav_path, sr=SR, res_type="soxr_hq")
        x = x[: int(max_seconds * SR)]
        return self.enc.run(None, {"audio_values": x[np.newaxis, :].astype(np.float32)})

    def say(self, text: str, voice, exaggeration: float = 0.5, temperature: float = 0.8,
            min_p: float = 0.05, top_p: float = 1.0, rep_penalty: float = 1.2,
            seed: int = 0, max_tokens: int = 400) -> np.ndarray:
        cond_emb, prompt_tok, xvec, feat = voice
        rng = np.random.default_rng(seed)
        ids = np.array([self.tok.encode(text).ids], dtype=np.int64)
        pos = np.where(ids >= START_SPEECH, 0, np.arange(ids.shape[1])[np.newaxis, :] - 1)
        feed = {"input_ids": ids, "position_ids": pos, "exaggeration": np.array([exaggeration], dtype=np.float32)}
        gen = [START_SPEECH]
        past = None
        mask = None
        for i in range(max_tokens):
            e = self.emb.run(None, feed)[0]
            if i == 0:
                e = np.concatenate((cond_emb, e), axis=1)
                past = {f"past_key_values.{l}.{kv}": np.zeros([1, KV_HEADS, 0, HEAD_DIM], dtype=np.float32)
                        for l in range(LAYERS) for kv in ("key", "value")}
                mask = np.ones((1, e.shape[1]), dtype=np.int64)
            logits, *present = self.lm.run(None, dict(inputs_embeds=e, attention_mask=mask, **past))
            lg = logits[0, -1, :].astype(np.float64)
            # repetition penalty on every token said so far (as the original does)
            seen = np.unique(np.array(gen))
            s = lg[seen]
            lg[seen] = np.where(s < 0, s * rep_penalty, s / rep_penalty)
            if temperature <= 0:
                nxt = int(np.argmax(lg))
            else:
                lg = lg / temperature
                pr = np.exp(lg - lg.max()); pr /= pr.sum()
                if min_p > 0:
                    pr[pr < min_p * pr.max()] = 0
                if top_p < 1:
                    order = np.argsort(-pr); c = np.cumsum(pr[order])
                    cut = order[c > top_p][1:]
                    pr[cut] = 0
                pr /= pr.sum()
                nxt = int(rng.choice(len(pr), p=pr))
            gen.append(nxt)
            if nxt == STOP_SPEECH:
                break
            feed["input_ids"] = np.array([[nxt]], dtype=np.int64)
            feed["position_ids"] = np.array([[i + 1]], dtype=np.int64)
            mask = np.concatenate([mask, np.ones((1, 1), dtype=np.int64)], axis=1)
            for j, k in enumerate(past):
                past[k] = present[j]
        toks = np.array([gen[1:-1] if gen[-1] == STOP_SPEECH else gen[1:]], dtype=np.int64)
        toks = toks[toks < START_SPEECH][np.newaxis, :]
        speech = np.concatenate([prompt_tok, toks], axis=1)
        wav = self.dec.run(None, {"speech_tokens": speech, "speaker_embeddings": xvec, "speaker_features": feat})[0]
        return np.squeeze(wav, axis=0).astype(np.float32)
