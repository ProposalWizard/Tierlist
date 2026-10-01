#!/bin/bash
# worker: reads queue.txt lines "fam level", renders finals, logs to done.log
cd /dev/shm/blender-shop/scripts; export LD_LIBRARY_PATH=/dev/shm/blender-shop/venv/lib
mkdir -p ../final; touch ../queue.txt ../done.log
while true; do
  line=$(grep -vxFf ../done.log ../queue.txt | head -1)
  if [ -z "$line" ]; then [ -f ../STOP ] && exit 0; sleep 10; continue; fi
  while [ $(free -g | awk '/Mem:/{print $7}') -lt 2 ]; do sleep 15; done
  set -- $line
  out=../final/$1-L$2.png
  t0=$(date +%s)
  nice -n 19 env THREADS=2 ../venv/bin/python run.py -- $1 $2 $out ${SAMPLES:-32} 600 450 2>&1 | grep -i "Traceback\|Error" | head -3
  if [ -s $out ]; then echo "$line" >> ../done.log; echo "$line $(( $(date +%s)-t0 ))s" >> ../times.log; else echo "$line FAILED" >> ../fail.log; echo "$line" >> ../done.log; fi
done
