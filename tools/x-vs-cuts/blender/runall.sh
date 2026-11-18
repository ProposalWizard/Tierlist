#!/bin/bash
cd /tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend
while pgrep -f "cuts2.py -- render" >/dev/null; do sleep 15; done
echo "round1 done $(date)" >> runall.log
RANGES=("1 166 499" "2 499 864" "3 864 1264" "4 1264 1692" "5 1692 2160")
worker(){ j=$1
  for r in "${RANGES[@]}"; do set -- $r; i=$1;a=$2;b=$3;n=$((b-a));s=$((a+n*j/3));e=$((a+n*(j+1)/3))
    blender -b cuts3_r$((i+1)).blend --python cuts3.py -- render $i $s $e > w${j}_r$((i+1)).log 2>&1
    echo "worker $j round $((i+1)) $s-$e done $(date)" >> runall.log
  done; }
worker 0 & worker 1 & worker 2 & wait
echo "ALL DONE $(date)" >> runall.log
