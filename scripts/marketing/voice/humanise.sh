#!/bin/bash
# humanise.sh in.wav out.wav  — mic-like finish: low cut, warmth, presence, gentle compression, small room, faint room tone
in="$1"; out="$2"
ffmpeg -v error -y -i "$in" -f lavfi -t 60 -i "anoisesrc=color=brown:amplitude=0.0025:sample_rate=24000" -filter_complex \
"[0:a]aresample=24000,highpass=f=75,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=7500:t=q:w=1:g=-2,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,aecho=0.8:0.85:22|37:0.10|0.06[v];[1:a]lowpass=f=900[n];[v][n]amix=inputs=2:duration=first:weights='1 1',alimiter=limit=0.95" -ar 44100 "$out"
