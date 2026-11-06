#!/usr/bin/env bash
# Dev helper: call the development-only devtools web trigger without echoing secrets.
# Usage:
#   scripts/dev.sh status | seed | check KEY-1 | precompute KEY-1 | twg-app
#   scripts/dev.sh search "text" | sync PAGEID | list | page-info [PAGEID] | make-editable [PAGEID]
#   scripts/dev.sh record "Title" "Decision text" [issueKey]
#   scripts/dev.sh supersede DEC-n "Title" "Decision text" [issueKey]
#   scripts/dev.sh get DEC-n
set -euo pipefail
. /home/box/.secrets/precedent-dev.env
op=${1:-status}
qs="op=$op&key=$PRECEDENT_DEV_KEY"
body=""
case $op in
  check|precompute) qs+="&issue=${2:-}";;
  search) qs+="&q=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "${2:-}")";;
  sync|page-info|make-editable) [ -n "${2:-}" ] && qs+="&page=$2";;
  seed) [ -n "${2:-}" ] && qs+="&project=$2";;
  get) qs+="&id=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "${2:-}")";;
  record)
    body=$(python3 -c 'import json,sys; p={"title":sys.argv[1],"decision":sys.argv[2]};
i=sys.argv[3] if len(sys.argv)>3 and sys.argv[3] else "";
p.update({"issueKey":i} if i else {}); print(json.dumps(p))' "${2:-}" "${3:-}" "${4:-}")
    ;;
  supersede)
    body=$(python3 -c 'import json,sys; p={"decisionId":sys.argv[1],"title":sys.argv[2],"decision":sys.argv[3]};
i=sys.argv[4] if len(sys.argv)>4 and sys.argv[4] else "";
p.update({"issueKey":i} if i else {}); print(json.dumps(p))' "${2:-}" "${3:-}" "${4:-}" "${5:-}")
    ;;
esac
sep='?'; [[ $PRECEDENT_WT_URL == *\?* ]] && sep='&'
method=GET
case $op in seed|make-editable|record|supersede) method=POST;; esac
if [ -n "$body" ]; then
  curl -sS -X "$method" -H 'Content-Type: application/json' -d "$body" "$PRECEDENT_WT_URL$sep$qs"
else
  curl -sS -X "$method" "$PRECEDENT_WT_URL$sep$qs"
fi
echo
