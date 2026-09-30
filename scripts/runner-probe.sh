#!/usr/bin/env bash
# runner-probe.sh — 015 §4.1 启动探测自检：产出 runner-profile.json（所有门禁据此分支）
# 规则：只登记事实，不硬编码 runner 专属命令（D21）；unknown 不是错误
set -uo pipefail
detect(){ command -v "$1" >/dev/null 2>&1 && echo "$1" || echo "-"; }
RUNNER="unknown"
for c in pi dsh codex claude zcode opencode; do
  [ "$(detect "$c")" != "-" ] && RUNNER="$c" && break
done
GIT_PERSIST="no"; git rev-parse --is-inside-work-tree >/dev/null 2>&1 && GIT_PERSIST="yes"
NET="no";   curl -sS --fail --max-time 5 https://registry.npmjs.org/pi2dsh >/dev/null 2>&1 && NET="yes"
HASH="none"
if   command -v shasum    >/dev/null 2>&1; then HASH=shasum
elif command -v sha256sum >/dev/null 2>&1; then HASH=sha256sum
elif command -v openssl   >/dev/null 2>&1; then HASH=openssl; fi
UNVER=""
for c in minimax doubao trae kimi; do
  [ "$(detect "$c")" != "-" ] && UNVER="$UNVER$c "
done
cat > runner-profile.json <<EOF
{"runner":"$RUNNER","git_persistent":"$GIT_PERSIST","network":"$NET","hash_tool":"$HASH",
 "os":"$(uname -s)","detected_at":"$(date -Iseconds)",
 "unverified_runners_detected":"${UNVER%s }",
 "unverified_capabilities":["10-runner 矩阵中 minimax/豆包工作/Trae Work/Kimi code 未公开核验，实测后回填"]}
EOF
echo "runner-profile.json written: runner=$RUNNER git=$GIT_PERSIST net=$NET hash=$HASH"
