#!/usr/bin/env bash
# scripts/download-all.sh — 手动下载脚本（macOS terminal / Linux / Windows Git Bash）
# 用途：015 资源包预置层兜底。bash 3.2 兼容（macOS 自带 bash）。
#   bash scripts/download-all.sh                # 全部
#   bash scripts/download-all.sh npmmirror      # 换镜像：official|npmmirror|tencent
#   SKIP_NODE=1 SKIP_DSHWEB=1 bash scripts/download-all.sh
set -uo pipefail
MIRROR="${1:-official}"
RETRY=3
case "$MIRROR" in
  official)  REG="https://registry.npmjs.org";;  npmmirror) REG="https://registry.npmmirror.com";;
  tencent)   REG="https://mirrors.tencent.com/npm";;
  *) echo "unknown mirror $MIRROR"; exit 1;;
esac
ALLOWED="registry.npmjs.org registry.npmmirror.com mirrors.tencent.com nodejs.org github.com codeload.github.com"
allowed_host() { case " $ALLOWED " in *" $1 "*) return 0;; *) return 1;; esac; }
hash_file() {
  if   command -v shasum    >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v openssl   >/dev/null 2>&1; then openssl dgst -sha256 "$1" | awk '{print $NF}'
  else echo "FATAL: no hash tool" >&2; exit 1; fi
}
fetch() { # $1=url $2=dest
  HOST="$(printf '%s' "$1" | sed -E 's#https?://([^/]+)/.*#\1#')"
  allowed_host "$HOST" || { echo "REJECT-HOST $1"; return 1; }
  i=0
  while [ $i -lt $RETRY ]; do
    if curl -L --fail --retry 2 -sS -o "$2" "$1" && [ -s "$2" ]; then return 0; fi; i=$((i+1))
  done
  return 1
}
mkdir -p offline/npm offline/node offline/github
# —— 24 个 npm 包（与 offline/npm/SHA256SUMS.txt 同名同版本；2026-09-27 锁定）——
# 格式：base|npm|version
PKGS='deepseek-ai-dsh|@deepseek-ai/dsh|0.1.5-rc.3
pi2dsh|pi2dsh|0.25.2
dsh-better-sidebar|dsh-better-sidebar|0.21.1
dsh-plugin|dsh-plugin|1.4.8
pi-hermes-memory|pi-hermes-memory|0.9.9
pi-approval-guardian|pi-approval-guardian|0.8.0
pi-redact-all|pi-redact-all|0.2.1
pi-mcp-adapter|pi-mcp-adapter|2.38.0
dsh-excel-panel|dsh-excel-panel|0.6.1
dsh-docs-panel|dsh-docs-panel|0.1.0
rmrdeveloper-sideroom-pi|@rmrdeveloper/sideroom-pi|8.11.0
pi-stats-footer|pi-stats-footer|0.4.0
dsh-undo-savepoint|dsh-undo-savepoint|0.4.9
tintinweb-pi-subagents|@tintinweb/pi-subagents|0.19.0
pi-dag-core|pi-dag-core|0.1.6
graph-memory|graph-memory|1.5.8
mutmutco-pi-plugin|@mutmutco/pi-plugin|4.5.41
pi-deepseek-search|pi-deepseek-search|1.0.20
pi-queue-steer-factory|pi-queue-steer-factory|0.17.5
pi-loop-mode|pi-loop-mode|2.5.4
anionex-dsh-vision-toolkit|@anionex/dsh-vision-toolkit|0.1.45
ychris12138-dsh-usage-stats|@ychris12138/dsh-usage-stats|0.3.4
changfenhuang-dsh-annotation|@changfenhuang/dsh-annotation|1.4.10
dsh-network-settings|dsh-network-settings|0.3.3'
SUMS=""; FAIL=""
echo "$PKGS" | while IFS='|' read -r base npm ver; do
  [ -n "$base" ] || continue
  file="$base-$ver.tgz"; dest="offline/npm/$file"
  if [ -s "$dest" ]; then echo "SKIP(exists) $file" >&2
  else
    url="$REG/$npm/-/$(basename "$npm")-$ver.tgz"
    if ! fetch "$url" "$dest"; then echo "FAIL $file" >&2; continue; fi
  fi
  echo "$file  $(hash_file "$dest")"
done > offline/npm/SHA256SUMS.txt
# —— Node 24 LTS 离线安装器（经 SHASUMS256.txt 解析文件名与哈希；latest-v24.x=v24.21.0）——
if [ "${SKIP_NODE:-0}" != "1" ]; then
  if fetch "https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt" offline/node/SHASUMS256.txt; then
    grep -E 'node-v[0-9.]+-(x64|arm64)\.msi$|node-v[0-9.]+\.pkg$' offline/node/SHASUMS256.txt | while read -r sha star file; do
      dest="offline/node/$file"
      if [ -s "$dest" ]; then echo "SKIP(exists) $file"; continue; fi
      if fetch "https://nodejs.org/dist/latest-v24.x/$file" "$dest"; then
        actual="$(hash_file "$dest")"
        if [ "$actual" != "$sha" ]; then echo "NODE-HASH-MISMATCH $file"; else echo "OK $file"; fi
      else echo "FAIL $file"; fi
    done
  else echo "FAIL node-SHASUMS"; fi
fi
# —— dsh-web 源码（浅克隆；zip 实测 452MB 过重）——
if [ "${SKIP_DSHWEB:-0}" != "1" ]; then
  if [ -d offline/github/dsh-web/.git ]; then echo "SKIP(exists) dsh-web"
  elif git clone --depth 1 https://github.com/zhu1090093659/dsh-web offline/github/dsh-web 2>/dev/null; then
    echo "OK dsh-web (shallow clone)"
  else echo "FAIL dsh-web —— 请手动：git clone --depth 1 https://github.com/zhu1090093659/dsh-web offline/github/dsh-web"; fi
fi
echo "DOWNLOAD_ALL_DONE（逐包结果见上方 OK/FAIL 行；SHA256SUMS.txt 已按实际下载重写）"
