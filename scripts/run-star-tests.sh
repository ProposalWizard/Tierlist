#!/usr/bin/env bash
# Run every tests/star/*.mts suite and report which ones fail.
cd "$(dirname "$0")/.." || exit 1
fails=0
for f in tests/star/*.mts; do
  if ! npx tsx "$f" > /tmp/star-test-out.txt 2>&1; then
    echo "FAIL $f"
    tail -8 /tmp/star-test-out.txt
    fails=$((fails + 1))
  fi
done
echo "suites failing: $fails"
