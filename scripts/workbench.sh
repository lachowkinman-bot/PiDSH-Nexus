#!/usr/bin/env bash
# scripts/workbench.sh — Universal Workbench 总控脚本（macOS/Linux bash ≥4 / Windows Git Bash）
# 子命令：fetch | install | verify | repair | report | package   （015 §5）
# 硬规则：native 命令只认退出码；bash set -uo pipefail（不用 -e，局部失败不阻断）；哈希三级回退；空哈希=失败
set -uo pipefail
CMD="${1:-fetch}"; TIER="${2:-ALL}"; MIRROR="${3:-official}"; PKG="${4:-}"
MANIFEST="manifests/packages.manifest.csv"; OUT="offline"; REPORTS="reports"; RETRY=3
case "$MIRROR" in
  official)  REG="https://registry.npmjs.org";;
  npmmirror) REG="https://registry.npmmirror.com";;
  tencent)   REG="https://mirrors.tencent.com/npm";;
  *) echo "unknown mirror $MIRROR"; exit 1;;
esac
ALLOWED="registry.npmjs.org registry.npmmirror.com mirrors.tencent.com github.com codeload.github.com objects.githubusercontent.com nodejs.org"
allowed_host() { case " $ALLOWED " in *" $1 "*) return 0;; *) return 1;; esac; }
private_host() { case "$1" in localhost|127.*|10.*|192.168.*|169.254.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|0.0.0.0|::1) return 0;; *) return 1;; esac; }
hash_file() {
  if   command -v shasum    >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v openssl   >/dev/null 2>&1; then openssl dgst -sha256 "$1" | awk '{print $NF}'
  else echo "FATAL: no hash tool" >&2; exit 1; fi
}
write_gap() { # $1=pkg $2=tier $3=reason $4=elem $5=alt
  GAP="$REPORTS/capability-gap.md"
  [ -f "$GAP" ] || printf '| 包名/能力 | 档 | 失败原因 | 影响要素 | 替代方案 |\n' > "$GAP"
  echo "| $1 | $2 | $3 | $4 | $5 |" >> "$GAP"
}
rows() { tail -n +2 "$MANIFEST" | tr -d '\r'; }
field() { echo "$1" | awk -v k="$2" 'BEGIN{FS=","} {print $k}' ; }

case "$CMD" in
fetch)
  mkdir -p "$OUT/npm" "$REPORTS"
  RESOLVED="manifests/packages.manifest.resolved.csv"; : > "$RESOLVED"; OKC=0
  rows() { tail -n +2 "$MANIFEST" | tr -d '\r'; }
  rows | while IFS=, read -r tier rank name npm src repo ver role purpose ind install_cmd test_cmd rver tar sha status note; do
    [ -n "$tier" ] || continue
    { [ "$TIER" = "ALL" ] || [ "$tier" = "$TIER" ]; } || continue
    if [ "$src" = "github-source" ]; then
      write_gap "$name" "$tier" "npm E404（设计如此）；dev 分支 zip 实测 452MB→git clone --depth 1" "要素1" "git clone https://github.com/zhu1090093659/dsh-web 后本地构建（人工可选）"
      echo "$npm,SKIP_GITHUB_SOURCE," >> "$RESOLVED"; continue
    fi
    T="$OUT/npm/$tar"
    if [ "$status" = "PRESET_OK" ] && [ -s "$T" ]; then
      ACT="$(hash_file "$T")"
      if [ "$ACT" != "$sha" ]; then write_gap "$npm" "$tier" "SHA256 不符" "—" "重跑 download-all 或换镜像"; echo "$npm,HASH_MISMATCH," >> "$RESOLVED"; continue; fi
      echo "$npm,PRESET_OK,$ACT" >> "$RESOLVED"; continue
    fi
    V=""; i=0
    while [ $i -lt $RETRY ]; do
      V="$(npm view "$npm@latest" version --registry "$REG" 2>/dev/null | tr -d '\r\n')"; [ -n "$V" ] && break; i=$((i+1))
    done
    if [ -z "$V" ]; then write_gap "$npm" "$tier" "npm view 失败" "十要素映射待评" "登记降级"; echo "$npm,FAILED," >> "$RESOLVED"; continue; fi
    URL="$REG/$npm/-/$(basename "$npm")-$V.tgz"; HOST="$(printf '%s' "$URL" | sed -E 's#https?://([^/]+)/.*#\1#')"
    if ! allowed_host "$HOST" || private_host "$HOST"; then write_gap "$npm" "$tier" "host 校验拒绝" "—" "换镜像"; echo "$npm,REJECTED_HOST," >> "$RESOLVED"; continue; fi
    DEST="$OUT/npm/$(echo "$npm" | sed 's/@//; s#/#-#')-$V.tgz"; dl=""; i=0
    while [ $i -lt $RETRY ]; do
      if curl -L --fail --retry 2 -sS -o "$DEST" "$URL" && [ -s "$DEST" ]; then dl=1; break; fi; i=$((i+1))
    done
    if [ -z "$dl" ]; then write_gap "$npm" "$tier" "下载失败" "十要素映射待评" "重试/换镜像"; echo "$npm,FAILED," >> "$RESOLVED"; continue; fi
    echo "$npm,$V,$(hash_file "$DEST")" >> "$RESOLVED"
  done
  for f in "$OUT"/npm/*.tgz; do [ -e "$f" ] || continue; echo "$(basename "$f")  $(hash_file "$f")"; done > "$OUT/npm/SHA256SUMS.txt"
  echo "FETCH_DONE tier=$TIER"
  ;;
install)
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  mkdir -p "$REPORTS"   # 装出的产品无 reports/（不入安装包）；缺目录 install-log.csv 写不进去（3.0 补）
  # 项目便携 Node（≥24.19）优先入 PATH；DSH_HOME 默认锁项目内 .dsh-home（独立环境，不影响其他项目）
  if [ -x "$ROOT/offline/node/node-v24.21.0-win-x64/node.exe" ] || [ -x "$ROOT/offline/node/node-v24.21.0-win-x64/bin/node" ]; then
    export PATH="$ROOT/offline/node/node-v24.21.0-win-x64:$PATH"
  fi
  export DSH_HOME="${DSH_HOME:-$ROOT/.dsh-home}"
  PROFILE_WEB="$DSH_HOME/profiles/web"
  clear_locks() { rm -f "$PROFILE_WEB/package.json.lock" "$PROFILE_WEB"/.lock.takeover-* 2>/dev/null || return 0; }
  : > "$REPORTS/install-log.csv"
  echo "name,npm,method,exit,timestamp" >> "$REPORTS/install-log.csv"

  # —— 第 0 步（3.0 补齐，2026-09-29）：pnpm 自举 ——
  # dsh plugin add/remove 是【转发给 PATH 上的 pnpm】的（engine lib/bin.js → execa('pnpm')）；
  # 离线包不含 pnpm 时干净机 postinstall 全部 exit 127（dsh: pnpm was not found）。随包 tarball 离线装入便携 Node 前缀。
  if ! command -v pnpm >/dev/null 2>&1; then
    PNPM_TGZ="$(ls -1 "$ROOT/$OUT"/npm/pnpm-*.tgz 2>/dev/null | sort -V | tail -1)"
    if [ -n "$PNPM_TGZ" ]; then
      npm i -g "$PNPM_TGZ" >/dev/null 2>&1; RC=$?; hash -r 2>/dev/null || true
      echo "pnpm,$(basename "$PNPM_TGZ"),npm-i-g-offline-tgz,$RC,$(date -Iseconds)" >> "$REPORTS/install-log.csv"
      if ! command -v pnpm >/dev/null 2>&1; then write_gap "pnpm" "P0" "自举失败 exit=$RC" "—" "检查 offline/npm/pnpm-*.tgz 与便携 Node 的 npm"; fi
    else
      echo "pnpm,none,missing-tarball,127,$(date -Iseconds)" >> "$REPORTS/install-log.csv"
      write_gap "pnpm" "P0" "offline/npm 缺 pnpm-*.tgz" "—" "补入 pnpm tarball 并更新 SHA256SUMS.txt"
    fi
  fi
  rows | awk -F, '$1=="P0"||$1=="P1"' | { FAILN=0
    while IFS=, read -r tier rank name npm src repo ver role purpose ind install_cmd test_cmd rver tar sha status note; do
      [ -n "$tier" ] || continue
      T="$ROOT/$OUT/npm/$tar"   # 绝对路径：相对路径会被 pnpm 解析到 profiles/web/ 下 → ENOENT（3.0 实测根因）
      if [ ! -s "$T" ]; then write_gap "$npm" "$tier" "tarball 缺失" "—" "先跑 fetch"; echo "$name,$npm,none,127,$(date -Iseconds)" >> "$REPORTS/install-log.csv"; continue; fi
      if [ "$npm" = "@deepseek-ai/dsh" ]; then
        # 016 §2 重锁：引擎只从离线 tarball 安装（禁 registry 按 resolved_version 降级）；装后断言 ≥0.1.2
        npm i -g "$T" >/dev/null 2>&1; RC=$?
        if [ $RC -eq 0 ]; then
          V="$(dsh --version 2>/dev/null | head -1 | tr -d '\r')"
          LOWEST="$(printf '%s\n' "0.1.2" "$V" | sort -V 2>/dev/null | head -1)"
          { [ "$LOWEST" = "0.1.2" ] && [ -n "$V" ]; } || RC=9
        fi
        METHOD="npm-i-g-offline-tgz"
      else
        clear_locks   # 陈旧写者锁会让每次 add 在 atomic-write 上超时 60-120s 后 exit 1（3.0 实测根因）
        dsh plugin --profile web add "$T" >/dev/null 2>&1; RC=$?
        METHOD="dsh-plugin-add-web"
      fi
      if [ $RC -eq 0 ]; then echo "$name,$npm,$METHOD,0,$(date -Iseconds)" >> "$REPORTS/install-log.csv"; git tag "v1.$rank-$name-ok" >/dev/null 2>&1 || true
      else echo "$name,$npm,$METHOD,$RC,$(date -Iseconds)" >> "$REPORTS/install-log.csv"; write_gap "$npm" "$tier" "install exit=$RC" "—" "workbench repair 或登记降级"; fi
    done; }

  # —— 第 9 步（3.0 补齐，2026-09-29）：工作台插件 @workbench/client-ui 装入 profile ——
  # 不装则产品没有 ⟡ 工作台 面板、/workbench/api/app-page 404、launch.ps1 退化成壳首页。
  WB="$ROOT/workbench-ui-plugin"
  if [ ! -f "$WB/package.json" ]; then
    echo "@workbench/client-ui,link,missing-source,127,$(date -Iseconds)" >> "$REPORTS/install-log.csv"
    write_gap "@workbench/client-ui" "P0" "安装目录缺 workbench-ui-plugin/" "F1/U15" "检查安装包 [Files] 是否含插件目录"
  else
    clear_locks
    dsh plugin --profile web add "$WB" >/dev/null 2>&1; RC=$?
    if [ $RC -eq 0 ] && [ -f "$PROFILE_WEB/node_modules/@workbench/client-ui/package.json" ] && grep -q '@workbench/client-ui' "$PROFILE_WEB/package.json" 2>/dev/null; then
      echo "@workbench/client-ui,link,dsh-plugin-add-web,0,$(date -Iseconds)" >> "$REPORTS/install-log.csv"
    else
      echo "@workbench/client-ui,link,dsh-plugin-add-web,$RC,$(date -Iseconds)" >> "$REPORTS/install-log.csv"
      write_gap "@workbench/client-ui" "P0" "install exit=$RC（link/激活清单断言失败）" "F1/U15" "手工 dsh plugin --profile web add <插件目录>"
    fi
  fi
  echo "INSTALL_DONE"
  ;;
verify)
  { echo "# 十要素机械检查矩阵"; echo; echo "| # | 要素 | 判定 | 证据 |"; echo "|---|---|---|---|"
    i=1
    while IFS='|' read -r elem ev; do echo "| $i | $elem | TODO-实测 | $ev |"; i=$((i+1)); done <<'EOT'
工作空间|workspace/ 16 子目录存在
Agent OS|dsh --version 通过且≥0.1.2
专业 Skills|templates/skills-domain 数量=13
工具连接器|excel/docs panel tarball 就位
数据/知识|Type-Dict 行数>40
任务编排|workflows YAML 数量≥24
人机审批|approval 包 PRESET_OK
产物管理|reports/ 可写
工作记忆|memory 包 PRESET_OK
审计追踪|tag-manifest.csv 存在
EOT
    echo; echo "> 注：本命令生成矩阵骨架；TODO 由 S6 冒烟实测回填（010-02 口径：不接受部分通过）。"; } > "$REPORTS/ten-elements-matrix.md"
  echo "VERIFY_SKELETON_DONE"
  ;;
repair)
  [ -n "$PKG" ] || { echo "repair 需要 <package>"; exit 1; }
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [ -x "$ROOT/offline/node/node-v24.21.0-win-x64/node.exe" ]; then export PATH="$ROOT/offline/node/node-v24.21.0-win-x64:$PATH"; fi
  export DSH_HOME="${DSH_HOME:-$ROOT/.dsh-home}"
  npm cache clean --force >/dev/null 2>&1 || true
  # 工作台插件不在 packages.manifest.csv（随包目录，不是 npm tarball 行）
  if [ "$PKG" = "@workbench/client-ui" ]; then
    rm -f "$DSH_HOME/profiles/web/package.json.lock" "$DSH_HOME"/profiles/web/.lock.takeover-* 2>/dev/null || true
    if [ -f "$ROOT/workbench-ui-plugin/package.json" ]; then
      dsh plugin --profile web add "$ROOT/workbench-ui-plugin" >/dev/null 2>&1; RC=$?; else RC=127; fi
    echo "$PKG,repair,exit=$RC,$(date -Iseconds)" >> "$REPORTS/repair-log.md"
    echo "REPAIR_DONE exit=$RC（复测走 verify）"; exit 0
  fi
  T=$(rows | awk -F, -v p="$PKG" '$3==p || $4==p {print $14}' | head -1)
  rm -f "$DSH_HOME/profiles/web/package.json.lock" "$DSH_HOME"/profiles/web/.lock.takeover-* 2>/dev/null || true
  if [ -n "$T" ] && [ -s "$ROOT/$OUT/npm/$T" ]; then dsh plugin --profile web add "$ROOT/$OUT/npm/$T" >/dev/null 2>&1; RC=$?; else RC=127; fi
  echo "$PKG,repair,exit=$RC,$(date -Iseconds)" >> "$REPORTS/repair-log.md"
  echo "REPAIR_DONE exit=$RC（复测走 verify）"
  ;;
report)
  { echo "# Universal Workbench 交付自评报告"; echo; echo "- 生成时间：$(date -Iseconds)"
    echo "- 预置层校验：offline/npm/SHA256SUMS.txt"; echo "- 安装日志：reports/install-log.md"
    echo "- 十要素矩阵：reports/ten-elements-matrix.md"; echo "- 能力缺口：reports/capability-gap.md"
    echo "- Runner 档案：runner-profile.json"; echo
    echo "## 评分（015 §11.2）"; echo
    echo "五维百分制自评 + 22 类缺陷清零表 + 一票否决 V1-V8 + CR 覆盖率 100%；每行引用证据路径，无证据按 0 分。"; } > "$REPORTS/workbench-report.md"
  echo "REPORT_DONE → $REPORTS/workbench-report.md"
  ;;
package)
  echo "PACKAGE：Windows 侧运行 iscc scripts/installer/win/setup.iss；macOS 侧运行 bash scripts/installer/mac/build_dmg.sh（015 §10）"
  ;;
*) echo "unknown cmd $CMD"; exit 1;;
esac
