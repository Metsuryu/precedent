#!/usr/bin/env bash
# Dev helper: call the development-only devtools web trigger without echoing secrets.
# Usage: scripts/dev.sh status | seed | check KEY-1 | search "text" | sync PAGEID | list
set -euo pipefail
. /home/box/.secrets/precedent-dev.env
op=${1:-status}; arg=${2:-}
qs="op=$op&key=$PRECEDENT_DEV_KEY"
case $op in check) qs+="&issue=$arg";; search) qs+="&q=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$arg")";; sync) qs+="&page=$arg";; seed) [ -n "$arg" ] && qs+="&project=$arg";; esac
sep='?'; [[ $PRECEDENT_WT_URL == *\?* ]] && sep='&'
method=GET; [ "$op" = seed ] && method=POST
curl -sS -X $method "$PRECEDENT_WT_URL$sep$qs"; echo
