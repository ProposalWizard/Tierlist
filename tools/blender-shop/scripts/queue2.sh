#!/bin/bash
# re-render the first 45 pictures (boots x7x5, car-3, house-1) at the same settings as the rest, with no baked-in sparkles
cd /dev/shm/blender-shop/scripts; export LD_LIBRARY_PATH=/dev/shm/blender-shop/venv/lib
while [ -n "$(grep -vxFf ../done.log ../queue.txt | head -1)" ]; do sleep 20; done
for l in 5 1 2 3 4; do
for b in starter speed power control elite curl maestro; do
  [ -s ../final/boot-$b-L$l.png ] && continue
  nice -n 19 env THREADS=2 ../venv/bin/python boot.py -- $b $l ../final/boot-$b-L$l.png 32 2>&1 | grep -i "Traceback\|Error"
  echo "boot-$b $l" >> ../done2.log
done
nice -n 19 env THREADS=2 ../venv/bin/python car.py -- $l ../final/car-3-L$l.png 32 2>&1 | grep -i "Traceback\|Error"
nice -n 19 env THREADS=2 ../venv/bin/python house.py -- $l ../final/house-1-L$l.png 32 2>&1 | grep -i "Traceback\|Error"
echo "lv$l" >> ../done2.log
done
echo ALLDONE2 >> ../done2.log
