#!/bin/bash
cd /dev/shm/blender-shop
export LD_LIBRARY_PATH=$PWD/venv/lib
while ! grep -q ALLDONE boots.log; do sleep 15; done
for l in 1 2 3 4 5; do
  while [ $(free -g | awk '/Mem:/{print $7}') -lt 2 ]; do sleep 10; done
  ./venv/bin/python car.py -- $l final/car-L$l.png 64 2>&1 | grep -i "RENDERED\|error"
done
for l in 1 2 3 4 5; do
  while [ $(free -g | awk '/Mem:/{print $7}') -lt 2 ]; do sleep 10; done
  ./venv/bin/python house.py -- $l final/house-L$l.png 64 2>&1 | grep -i "RENDERED\|error"
done
echo RESTDONE
