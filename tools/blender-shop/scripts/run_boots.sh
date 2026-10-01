#!/bin/bash
cd /dev/shm/blender-shop
export LD_LIBRARY_PATH=$PWD/venv/lib
for b in speed starter power control elite curl maestro; do for l in 1 2 3 4 5; do
  while [ $(free -g | awk '/Mem:/{print $7}') -lt 2 ]; do sleep 10; done
  ./venv/bin/python boot.py -- $b $l final/boot-$b-L$l.png 64 2>&1 | grep -i "RENDERED\|error"
done; done
echo ALLDONE
