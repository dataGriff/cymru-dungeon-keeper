#!/usr/bin/env bash
# Parse docs/backlog.md and create milestones, labels and issues on GitHub.
# Idempotent: existing milestones, labels and issue titles are left alone.
#
#   scripts/create-issues.sh [owner/repo] [backlog.md]
#
# Needs `gh` authenticated (or GH_TOKEN) and `python3`.
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"
FILE="${2:-$(dirname "$0")/../docs/backlog.md}"
if [[ -z "$REPO" ]]; then
  echo "usage: $0 owner/repo [backlog.md]" >&2
  exit 1
fi

# Emit one JSON object per line: {milestone, title, labels, body} plus a
# {milestones: {...}} header, so the shell loop below stays simple.
PARSED=$(python3 - "$FILE" <<'PY'
import json, re, sys
text = open(sys.argv[1], encoding="utf-8").read()
milestones = {}
for m in re.finditer(r"^- (M\d) (.+?) — (.+)$", text, re.M):
    milestones[m.group(1)] = {"title": f"{m.group(1)} {m.group(2)}", "description": m.group(3)}
print(json.dumps({"milestones": milestones}))
for block in re.split(r"^## ", text, flags=re.M)[1:]:
    head, _, rest = block.partition("\n")
    m = re.match(r"\[(M\d)\] (.+)$", head.strip())
    if not m:
        continue
    lines = rest.strip("\n").split("\n")
    labels = []
    if lines and lines[0].startswith("labels:"):
        labels = [l.strip() for l in lines[0][len("labels:"):].split(",") if l.strip()]
        lines = lines[1:]
    body = "\n".join(lines).strip().split("\n---")[0].rstrip()
    print(json.dumps({"milestone": m.group(1), "title": m.group(2).strip(), "labels": labels, "body": body}))
PY
)

header=$(printf '%s\n' "$PARSED" | head -n1)
issues=$(printf '%s\n' "$PARSED" | tail -n +2)

echo "== milestones"
declare -A MS_NUM
existing_ms=$(gh api "repos/$REPO/milestones?state=all&per_page=100")
for key in $(printf '%s' "$header" | python3 -c 'import json,sys; print(" ".join(sorted(json.load(sys.stdin)["milestones"])))'); do
  title=$(printf '%s' "$header" | python3 -c "import json,sys; print(json.load(sys.stdin)['milestones']['$key']['title'])")
  desc=$(printf '%s' "$header" | python3 -c "import json,sys; print(json.load(sys.stdin)['milestones']['$key']['description'])")
  num=$(printf '%s' "$existing_ms" | python3 -c "import json,sys; ms=[m for m in json.load(sys.stdin) if m['title']=='''$title''']; print(ms[0]['number'] if ms else '')")
  if [[ -z "$num" ]]; then
    num=$(gh api -X POST "repos/$REPO/milestones" -f title="$title" -f description="$desc" -q .number)
    echo "created  $num  $title"
  else
    echo "exists   $num  $title"
  fi
  MS_NUM[$key]=$num
done

echo "== labels"
declare -A LABEL_COLOR=([infra]=0e8a16 [sim]=1d76db [render]=5319e7 [ui]=fbca04 [content]=d93f0b [test]=006b75 [design]=c2e0c6 [perf]=b60205 [art]=f9d0c4 [audio]=bfd4f2)
existing_labels=$(gh api "repos/$REPO/labels?per_page=100" -q '.[].name')
for label in "${!LABEL_COLOR[@]}"; do
  if ! grep -qx "$label" <<<"$existing_labels"; then
    gh api -X POST "repos/$REPO/labels" -f name="$label" -f color="${LABEL_COLOR[$label]}" >/dev/null
    echo "created  $label"
  fi
done

echo "== issues"
existing_titles=$(gh api "repos/$REPO/issues?state=all&per_page=100" --paginate -q '.[] | select(.pull_request == null) | .title')
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  title=$(printf '%s' "$line" | python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])')
  if grep -qxF "$title" <<<"$existing_titles"; then
    echo "exists   $title"
    continue
  fi
  ms=$(printf '%s' "$line" | python3 -c 'import json,sys; print(json.load(sys.stdin)["milestone"])')
  payload=$(printf '%s' "$line" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(json.dumps({'title': d['title'], 'body': d['body'], 'labels': d['labels'], 'milestone': int('${MS_NUM[$ms]}')}))")
  num=$(printf '%s' "$payload" | gh api -X POST "repos/$REPO/issues" --input - -q .number)
  echo "created  #$num  [$ms] $title"
done <<<"$issues"
