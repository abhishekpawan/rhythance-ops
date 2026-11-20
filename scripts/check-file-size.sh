#!/bin/sh
# File-size ratchet: no source file (ts, tsx, css in client/src and server/src) over 300 lines, but 112 are over
# today, so the check is a ratchet against scripts/file-size-baseline.txt ("<lines> <path>" for each oversized file):
#   * a file that is not in the baseline must be at most 300 lines,
#   * a file in the baseline must not grow,
#   * a file in the baseline that shrank (or went under 300, or was deleted) must have its entry lowered or removed
#     with `scripts/check-file-size.sh --update`, so the baseline only ever shrinks.
# Usage: scripts/check-file-size.sh             check every tracked file (CI)
#        scripts/check-file-size.sh --staged    check the staged version of the staged files (pre-commit hook)
#        scripts/check-file-size.sh --update    lower or remove baseline entries that shrank; never adds or raises
#        scripts/check-file-size.sh --init      write the baseline from today's files (only when there is none)
# Exit codes: 0 fine, 1 a rule is broken.
cd "$(dirname "$0")/.." || exit 1
LIMIT=300
BASELINE=scripts/file-size-baseline.txt
SCOPE="client/src server/src"
mode=${1:-all}

lines_of() { # path -> number of lines (of the staged version in --staged mode)
  if [ "$mode" = "--staged" ]; then git show ":$1" 2>/dev/null | wc -l | tr -d ' '; else wc -l < "$1" | tr -d ' '; fi
}

all_files() { git ls-files $SCOPE | grep -E '\.(ts|tsx|css)$'; }

sizes() { # "<lines> <path>" for the files in play
  if [ "$mode" = "--staged" ]; then
    list=$(git diff --cached --name-only --diff-filter=AM -- $SCOPE | grep -E '\.(ts|tsx|css)$')
  else
    list=$(all_files)
  fi
  [ -z "$list" ] && return 0
  echo "$list" | while IFS= read -r f; do [ -f "$f" ] && echo "$(lines_of "$f") $f"; done
}

if [ "$mode" = "--init" ]; then
  [ -f "$BASELINE" ] && { echo "$BASELINE exists; the baseline only shrinks (use --update)"; exit 1; }
  mode=all
  sizes | awk -v l=$LIMIT '$1>l' | LC_ALL=C sort -k2 > "$BASELINE"
  echo "wrote $BASELINE: $(wc -l < "$BASELINE" | tr -d ' ') files over $LIMIT lines"
  exit 0
fi

[ -f "$BASELINE" ] || { echo "missing $BASELINE (scripts/check-file-size.sh --init)"; exit 1; }

now=$(sizes)
fail=0
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# files in play against the baseline
echo "$now" | while read -r n f; do
  [ -z "$f" ] && continue
  base=$(awk -v f="$f" '$2==f {print $1}' "$BASELINE")
  if [ -z "$base" ]; then
    [ "$n" -gt "$LIMIT" ] && echo "NEW   $f has $n lines (limit $LIMIT): split it, or do not add it" >> "$tmp"
  elif [ "$n" -gt "$base" ]; then
    echo "GREW  $f has $n lines, was $base: files over $LIMIT lines must not grow" >> "$tmp"
  elif [ "$n" -lt "$base" ]; then
    echo "STALE $f has $n lines, baseline says $base: run scripts/check-file-size.sh --update" >> "$tmp"
  fi
done

# baseline entries whose file is gone (full check only)
if [ "$mode" = "all" ] || [ "$mode" = "--update" ]; then
  while read -r base f; do
    [ -f "$f" ] || echo "STALE $f no longer exists: run scripts/check-file-size.sh --update" >> "$tmp"
  done < "$BASELINE"
fi

if [ "$mode" = "--update" ]; then
  grep -E '^(NEW|GREW)' "$tmp" && { echo "--update never adds or raises an entry"; exit 1; }
  mode=all
  new=$(mktemp)
  while read -r base f; do
    [ -f "$f" ] || continue
    n=$(wc -l < "$f" | tr -d ' ')
    [ "$n" -gt "$LIMIT" ] && echo "$n $f"
  done < "$BASELINE" | LC_ALL=C sort -k2 > "$new"
  mv "$new" "$BASELINE"
  echo "baseline now lists $(wc -l < "$BASELINE" | tr -d ' ') files over $LIMIT lines"
  exit 0
fi

if [ -s "$tmp" ]; then
  sort "$tmp"
  echo "file-size check failed ($(wc -l < "$tmp" | tr -d ' ') problem(s)). See docs/development/testing.md, 'File-size ratchet'."
  exit 1
fi
echo "file-size check passed ($(wc -l < "$BASELINE" | tr -d ' ') files over $LIMIT lines in the baseline, none new, none grown)"
