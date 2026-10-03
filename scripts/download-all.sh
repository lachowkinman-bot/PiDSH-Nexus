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
# —— 24 个 npm 包 + pnpm（与 offline/npm/SHA256SUMS.txt 同名同版本；dsh 按 016 §2 重锁）——
# 格式：base|npm|version
PKGS='deepseek-ai-dsh|@deepseek-ai/dsh|0.1.7-rc.2
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
# —— pnpm 10.32.1（dsh plugin add 的转发依赖；workbench.sh install 第 0 步离线自举）——
PNPM_FILE=pnpm-10.32.1.tgz
PNPM_SHA=9b943b94bc8f55efb993aad8e44b538e6b091e60a9e4a944dcde869855f233e3
if [ -s "offline/npm/$PNPM_FILE" ]; then echo "SKIP(exists) $PNPM_FILE" >&2
elif fetch "$REG/pnpm/-/$PNPM_FILE" "offline/npm/$PNPM_FILE"; then echo "OK $PNPM_FILE" >&2
else echo "FAIL $PNPM_FILE" >&2; fi
if [ -s "offline/npm/$PNPM_FILE" ]; then
  ACTUAL="$(hash_file "offline/npm/$PNPM_FILE")"
  if [ "$ACTUAL" != "$PNPM_SHA" ]; then echo "PNPM-HASH-MISMATCH $PNPM_FILE expect=$PNPM_SHA actual=$ACTUAL" >&2
  else echo "$PNPM_FILE  $ACTUAL" >> offline/npm/SHA256SUMS.txt; fi
fi
# —— pkgmeta.json：download-catalog.mjs / gen-manifest.mjs 的前置清单（file/base/ver/sha）——
{
  printf '[\n'
  FIRST=1
  echo "$PKGS" | while IFS='|' read -r base npm ver; do
    [ -n "$base" ] || continue
    FILE="$base-$ver.tgz"; SHA="$(hash_file "offline/npm/$FILE")"
    [ "$FIRST" = "1" ] || printf ',\n'
    FIRST=0
    printf ' {"file":"%s","base":"%s","ver":"%s","sha":"%s"}' "$FILE" "$base" "$ver" "$SHA"
  done
  printf '\n]\n'
} > offline/npm/pkgmeta.json
# —— dsh 0.1.7-rc.2 引擎双落点：offline/npm 供 workbench.sh，offline-3.0/engines 供 U1/运行时分发 ——
ENGINE_FILE=deepseek-ai-dsh-0.1.7-rc.2.tgz
ENGINE_SHA=5f2da7272d9485abc223e681075809a8d929697c5232ee445718e1b7e066bff8
if [ -s "offline/npm/$ENGINE_FILE" ]; then
  ACTUAL="$(hash_file "offline/npm/$ENGINE_FILE")"
  if [ "$ACTUAL" != "$ENGINE_SHA" ]; then echo "ENGINE-HASH-MISMATCH $ENGINE_FILE expect=$ENGINE_SHA actual=$ACTUAL" >&2
  else
    mkdir -p offline-3.0/engines
    if [ ! -s "offline-3.0/engines/$ENGINE_FILE" ] || [ "$(hash_file "offline-3.0/engines/$ENGINE_FILE")" != "$ACTUAL" ]; then
      cp "offline/npm/$ENGINE_FILE" "offline-3.0/engines/$ENGINE_FILE"
    fi
    echo "OK offline-3.0/engines/$ENGINE_FILE" >&2
  fi
fi
# —— Node 24.21.0（tools-versions.txt 锁定；便携 zip 解压 + msi/pkg 同源校验）——
if [ "${SKIP_NODE:-0}" != "1" ]; then
  NODE_BASE=https://nodejs.org/dist/v24.21.0
  if fetch "$NODE_BASE/SHASUMS256.txt" offline/node/SHASUMS256.txt; then
    PORTABLE_ZIP=node-v24.21.0-win-x64.zip
    PORTABLE_SHA="$(awk -v f="$PORTABLE_ZIP" '$2==f || $2==("*" f) {print $1}' offline/node/SHASUMS256.txt | head -n 1)"
    if [ ! -s "offline/node/$PORTABLE_ZIP" ]; then fetch "$NODE_BASE/$PORTABLE_ZIP" "offline/node/$PORTABLE_ZIP" || echo "FAIL $PORTABLE_ZIP" >&2; fi
    if [ -s "offline/node/$PORTABLE_ZIP" ]; then
      ACTUAL="$(hash_file "offline/node/$PORTABLE_ZIP")"
      if [ -z "$PORTABLE_SHA" ] || [ "$ACTUAL" != "$PORTABLE_SHA" ]; then echo "NODE-HASH-MISMATCH $PORTABLE_ZIP expect=$PORTABLE_SHA actual=$ACTUAL" >&2
      elif [ ! -f offline/node/node-v24.21.0-win-x64/node.exe ]; then
        if command -v unzip >/dev/null 2>&1; then unzip -q -o "offline/node/$PORTABLE_ZIP" -d offline/node
        else tar -xf "offline/node/$PORTABLE_ZIP" -C offline/node; fi
      fi
    fi
    grep -E 'node-v[0-9.]+-(x64|arm64)\.msi$|node-v[0-9.]+\.pkg$' offline/node/SHASUMS256.txt | while read -r sha file; do
      dest="offline/node/$file"
      if [ -s "$dest" ]; then echo "SKIP(exists) $file"; continue; fi
      if fetch "$NODE_BASE/$file" "$dest"; then
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
