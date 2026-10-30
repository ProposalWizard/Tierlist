#!/bin/sh
# Six frames across a clip, side by side (to check a clip by eye): rg-frames.sh clip.mp4 out.jpg
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")
ffmpeg -y -loglevel error -i "$1" -vf "fps=6/$d,scale=195:-2,tile=6x1" -frames:v 1 "$2"
