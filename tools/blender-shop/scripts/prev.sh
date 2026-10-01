#!/bin/bash
# prev.sh fam  -> low-quality 5-level contact sheet in out/prev-<fam>.png
cd /dev/shm/blender-shop/scripts; export LD_LIBRARY_PATH=/dev/shm/blender-shop/venv/lib
fam=$1; s=${2:-12}; levels=${3:-1 2 3 4 5}
for l in $levels; do nice -n 19 env THREADS=${THREADS:-3} ../venv/bin/python run.py -- $fam $l ../out/p-$fam-$l.png $s 360 270 2>&1 | grep -i "RENDERED\|error\|Traceback\|File \"" ; done
../venv/bin/python - <<PY
from PIL import Image
import os
fam="$fam"; ls="1 2 3 4 5".split()
ims=[Image.open(f'../out/p-{fam}-{l}.png').convert('RGBA') for l in ls if os.path.exists(f'../out/p-{fam}-{l}.png')]
bgs=[(58,63,74),(21,94,117),(30,64,175),(107,33,168),(183,121,31)]
w,h=360,270
sheet=Image.new('RGB',(w*len(ims),h))
for i,(im,l) in enumerate(zip(ims,ls)):
    bg=Image.new('RGBA',(w,h),bgs[int(l)-1]+(255,)); bg.alpha_composite(im); sheet.paste(bg.convert('RGB'),(i*w,0))
sheet.save(f'../out/prev-{fam}.png')
PY
