#!/usr/bin/env python3
"""Generate the star-career sound effects with ElevenLabs.

    ELEVENLABS_API_KEY=sk_... python3 scripts/sfx/generate.py          # all sounds
    ELEVENLABS_API_KEY=sk_... python3 scripts/sfx/generate.py kick-hard # just these

For each sound it asks ElevenLabs for 3 variants, measures each one with
ffmpeg (length, peak, average loudness), throws out any that clip, keeps
the one closest to the target length with the most punch, levels it to
the same loudness as the rest, and writes a small mono MP3 to
public/sfx/<name>.mp3. public/sfx/manifest.json is rewritten at the end;
the audition page at /sfx-dev reads it.

The key needs to be a real API key (starts with "sk_"), not the key ID.
Uses curl and ffmpeg (both on the sandbox image), so the proxy just works.
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "sfx")
VARIANTS = 3
PEAK_MAX = -1.5  # dB, finished file
STYLE = "Clean, close, dry studio sound effect, no music, no voices speaking."

# name, seconds, what it's for, prompt
SOUNDS = [
    ("kick-soft", 0.5, "A pass or a soft touch", "Single soft football pass, side of boot on a leather ball, short thud on grass."),
    ("kick-hard", 0.5, "A struck shot", "Single powerful football shot, boot smashing a leather ball, sharp punchy thump."),
    ("goal-net", 1.2, "Ball hits the back of the net", "Football ball hitting the back of a goal net, rope net ripple and rustle, short."),
    ("crowd-cheer-small", 3.0, "Goal at a small non-league ground", "Small crowd of a few hundred at a non-league football ground cheering a goal, claps and shouts, short."),
    ("crowd-cheer-stadium", 4.0, "Goal in a big stadium", "Huge football stadium crowd erupting for a goal, roar swelling then fading, short."),
    ("crowd-groan", 2.0, "A near miss or a save", "Football stadium crowd groaning 'ohhh' after a near miss, short."),
    ("keeper-save", 0.6, "Keeper catches or parries", "Goalkeeper gloves catching a football hard, padded leather slap thud."),
    ("whistle-start", 1.0, "Kick-off", "Referee whistle, one short sharp blast."),
    ("whistle-half", 1.6, "Half time", "Referee whistle, two short blasts."),
    ("whistle-full", 2.4, "Full time", "Referee whistle, three blasts, the last one long."),
    ("ui-tap", 0.5, "Any button tap", "Tiny soft UI tap click for a mobile game menu."),
    ("ui-confirm", 0.6, "Confirm / continue", "Short bright positive mobile game UI confirm blip, two rising notes."),
    ("coin-in", 1.4, "Money paid in", "Getting paid: a quick rustle of paper banknotes being counted out, then a cash register drawer opening with a bright ka-ching. Money, not a single coin."),
    ("star-tick", 0.8, "Star bar filling, one tick", "Bright satisfying magical star sparkle chime, a shimmering twinkle with a clear bell ping, mobile game reward, full and rich not tiny."),
    ("level-up", 1.6, "Star rating goes up", "Triumphant short mobile game level-up sting, rising shimmer and chime."),
    ("achievement-pop", 1.6, "Achievement unlocked", "Big satisfying achievement unlocked fanfare: a punchy pop, a bright rising chime arpeggio and a sparkling shimmer tail, celebratory mobile game reward."),
    ("breaking-news", 2.0, "Breaking news headline", "Short TV sports news breaking-news sting, dramatic whoosh and hit."),
    ("phone-notification", 0.8, "New post on the phone feed", "Smartphone notification ping, clean two-tone chime."),
    ("can-open", 1.0, "Opening an energy drink", "Aluminium drink can cracking open with a fizz hiss."),
]


def measure(path):
    """(seconds, peak dB, mean dB) via ffmpeg."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    err = r.stderr
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    secs = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else 0.0
    peak = float(re.search(r"max_volume: (-?[\d.]+) dB", err).group(1))
    mean = float(re.search(r"mean_volume: (-?[\d.]+) dB", err).group(1))
    return secs, peak, mean


def generate(prompt, seconds, dest):
    body = json.dumps({"text": f"{prompt} {STYLE}", "duration_seconds": max(0.5, seconds), "prompt_influence": 0.6})
    r = subprocess.run(["curl", "-sS", "-X", "POST",
                        "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                        "-H", "xi-api-key: " + os.environ["ELEVENLABS_API_KEY"],
                        "-H", "Content-Type: application/json", "-d", body,
                        "-o", dest, "-w", "%{http_code}"], capture_output=True, text=True)
    if r.stdout.strip() != "200":
        msg = open(dest, errors="replace").read()[:300] if os.path.exists(dest) else r.stderr
        raise RuntimeError(f"ElevenLabs {r.stdout.strip()}: {msg}")


def finish(raw, dest, tmp):
    """Trim the lead-in, level to -16 LUFS, then pull the gain down until the
    finished MP3 peaks at or under PEAK_MAX (loudnorm and the MP3 encode both
    overshoot on sharp transients like a kick or a tap)."""
    wav = os.path.join(tmp, "level.wav")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", raw,
                    "-af", "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ac", "1", "-ar", "44100", wav], check=True)
    gain = 0.0
    for _ in range(4):
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", wav,
                        "-af", f"volume={gain}dB", "-b:a", "96k", dest], check=True)
        d, peak, mean = measure(dest)
        if peak <= PEAK_MAX:
            break
        gain -= peak - PEAK_MAX + 0.3
    return d, peak, mean


def main():
    if not os.environ.get("ELEVENLABS_API_KEY", "").startswith("sk_"):
        sys.exit("ELEVENLABS_API_KEY must be a real key starting with sk_ (not the key ID).")
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, "manifest.json")
    manifest = {s["name"]: s for s in json.load(open(man_path))["sounds"]} if os.path.exists(man_path) else {}
    # SFX_REUSE=<dir> re-levels takes already downloaded there instead of paying for new ones
    tmp = os.environ.get("SFX_REUSE") or tempfile.mkdtemp()
    for name, secs, purpose, prompt in SOUNDS:
        if only and name not in only:
            continue
        takes = []
        for v in range(VARIANTS):
            raw = os.path.join(tmp, f"{name}-{v}.mp3")
            if not os.path.exists(raw):
                generate(prompt, secs, raw)
            d, peak, mean = measure(raw)
            takes.append((raw, d, peak, mean))
            print(f"  {name} v{v}: {d:.2f}s peak {peak} dB mean {mean} dB")
        clean = [t for t in takes if t[2] < -0.1] or takes  # drop clipped takes
        # closest to the asked length, then the most punch (peak minus mean)
        best = min(clean, key=lambda t: (round(abs(t[1] - secs), 1), -(t[2] - t[3])))
        dest = os.path.join(OUT, f"{name}.mp3")
        d, peak, mean = finish(best[0], dest, tmp)
        manifest[name] = {"name": name, "file": f"/sfx/{name}.mp3", "duration": round(d, 2),
                          "kb": round(os.path.getsize(dest) / 1024, 1), "purpose": purpose, "prompt": prompt}
        print(f"-> {name}: {d:.2f}s, {manifest[name]['kb']} KB, peak {peak} dB")
    order = [s[0] for s in SOUNDS]
    out = {"sounds": sorted(manifest.values(), key=lambda s: order.index(s["name"]) if s["name"] in order else 99)}
    json.dump(out, open(man_path, "w"), indent=2)
    print(f"Wrote {man_path}")


if __name__ == "__main__":
    main()
