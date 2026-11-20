#!/bin/bash
# pt.sh js '<js>'      run a command in drive.mjs (P = packed page, N = KIB Next page)
# pt.sh shot NAME [s]  shoot both apps, make NAME-pair.jpg (scale s, default 0.6)
D=$(cd "$(dirname "$0")" && pwd)
S=${PT_SHOTS:-/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/playtest/career}
case "$1" in
  js) shift; node "$D/cmd.mjs" "$*" ;;
  shot) node "$D/cmd.mjs" "return shot('$2')" >/dev/null; python3 "$D/pair.py" "$S" "$2" "${3:-0.6}" ;;
esac
