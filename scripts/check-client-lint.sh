#!/bin/sh
# Client lint ratchet. `pnpm lint` in client/ fails today (errors and warnings that were already there, mostly
# `no-explicit-any` and `exhaustive-deps`), so CI compares the counts with scripts/client-lint-baseline.txt
# ("<errors> <warnings>"): more of either fails, fewer fails until the baseline is lowered with --update, so the
# numbers only go down. Needs `pnpm install` in client/.
# Usage: scripts/check-client-lint.sh            check
#        UPDATE=1 scripts/check-client-lint.sh   write the current numbers as the baseline (only to lower them)
cd "$(dirname "$0")/.." || exit 1
BASELINE=scripts/client-lint-baseline.txt
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
(cd client && ./node_modules/.bin/eslint . --ext ts,tsx --report-unused-disable-directives -f json -o "$tmp" >/dev/null 2>&1) || true
counts=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(r.reduce((a,f)=>a+f.errorCount,0),r.reduce((a,f)=>a+f.warningCount,0))' "$tmp") || { echo "client lint did not run (pnpm install in client/?)"; exit 1; }
set -- $counts
errors=$1; warnings=$2
if [ "${UPDATE:-}" = "1" ]; then echo "$errors $warnings" > "$BASELINE"; echo "baseline set to $errors errors, $warnings warnings"; exit 0; fi
[ -f "$BASELINE" ] || { echo "missing $BASELINE"; exit 1; }
set -- $(cat "$BASELINE")
be=$1; bw=$2
if [ "$errors" -gt "$be" ] || [ "$warnings" -gt "$bw" ]; then
  echo "client lint got worse: $errors errors (baseline $be), $warnings warnings (baseline $bw). Run 'pnpm lint' in client/ and fix what you added."
  exit 1
fi
if [ "$errors" -lt "$be" ] || [ "$warnings" -lt "$bw" ]; then
  echo "client lint improved: $errors errors (baseline $be), $warnings warnings (baseline $bw). Lower the baseline: UPDATE=1 scripts/check-client-lint.sh"
  exit 1
fi
echo "client lint at its baseline ($errors errors, $warnings warnings): nothing new"
