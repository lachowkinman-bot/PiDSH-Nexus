#!/usr/bin/env bash
# 包全生命周期演练（Linux / macOS）：安装 -> 功能调用 -> 卸载 -> 残留清零
# 用法：PKG=jsonschema VER=4.23.0 bash scripts/lifecycle.sh
set -uo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PKG="${PKG:-jsonschema}"
VER="${VER:-4.23.0}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
KEEP_ENV="${KEEP_ENV:-0}"

EVID="$ROOT/evidence"; mkdir -p "$EVID"
LOG="$EVID/timeline.log"
VENV="$ROOT/.venv"
PY="$VENV/bin/python"
FAILURES=0

step() { echo "[$(date '+%F %T')] $1 $2" | tee -a "$LOG"; }
note() { [ -n "${1:-}" ] && echo "$1" >> "$LOG" || true; }
pass() { echo "  PASS  $1" | tee -a "$LOG"; }
fail() { echo "  FAIL  $1" | tee -a "$LOG"; FAILURES=$((FAILURES + 1)); }
run()  { note "CMD> $*"; "$@" > "$EVID/.tmp.out" 2>&1; local c=$?; cat "$EVID/.tmp.out" >> "$LOG"; cat "$EVID/.tmp.out"; return $c; }

step S0 '前置检查：解释器可用性'
if ! run "$PYTHON_BIN" -V; then fail "Python 解释器不可用：$PYTHON_BIN"; exit 1; fi
"$PYTHON_BIN" -V > "$EVID/python-version.txt" 2>&1
pass "解释器可用：$(cat "$EVID/python-version.txt")"

step S1 '创建隔离环境（venv），规避全局污染'
[ -x "$PY" ] || run "$PYTHON_BIN" -m venv "$VENV" || { fail 'venv 创建失败'; exit 1; }
[ -x "$PY" ] && pass "venv 就绪：$VENV" || { fail "venv 缺少解释器：$PY"; exit 1; }

step S2 '采集安装前依赖基线'
"$PY" -m pip freeze | sort > "$EVID/freeze.before-install.txt"
pass "基线依赖数：$(wc -l < "$EVID/freeze.before-install.txt" | tr -d ' ')"

step S3 "安装目标包（精确锁定 ${PKG}==${VER}）"
if run "$PY" -m pip install "${PKG}==${VER}"; then pass "安装成功：${PKG}==${VER}"; else fail '安装失败'; fi
cp "$EVID/.tmp.out" "$EVID/install.log" 2>/dev/null || true

step S4 '安装校验：版本 / 安装路径 / 依赖树'
"$PY" -m pip show "$PKG" > "$EVID/pip-show.txt" 2>&1
GOT_VER=$(awk -F': ' '/^Version:/{print $2}' "$EVID/pip-show.txt")
LOCATION=$(awk -F': ' '/^Location:/{print $2}' "$EVID/pip-show.txt")
REQUIRES=$(awk -F': ' '/^Requires:/{print $2}' "$EVID/pip-show.txt")
[ "$GOT_VER" = "$VER" ] && pass "版本号一致：$GOT_VER" || fail "版本号不一致：期望 $VER，实际 '$GOT_VER'"
case "$LOCATION" in "$VENV"*) pass "已隔离在 venv 内：$LOCATION" ;; *) fail "安装位置未隔离：'$LOCATION'" ;; esac
pass "传递依赖：$REQUIRES"

step S5 '功能调用：正例 / 反例双跑（业务契约校验）'
SCRIPT="$ROOT/src/validate_payload.py"
FIX="$ROOT/fixtures"
if run "$PY" "$SCRIPT" --schema "$FIX/schema.order.json" --payload "$FIX/payload.valid.json" \
   && grep -q '^VALID' "$EVID/.tmp.out"; then pass '正例通过：exit=0 / VALID'; else fail '正例未通过'; fi
cp "$EVID/.tmp.out" "$EVID/call.valid.out"

run "$PY" "$SCRIPT" --schema "$FIX/schema.order.json" --payload "$FIX/payload.invalid.json"; BAD_CODE=$?
cp "$EVID/.tmp.out" "$EVID/call.invalid.out"
HIT=0
for k in amount buyer/email debug items order_id; do grep -qF "$k" "$EVID/call.invalid.out" && HIT=$((HIT + 1)); done
[ "$BAD_CODE" -eq 1 ] && [ "$HIT" -eq 5 ] && pass "反例通过：exit=1 / 错误定位命中 5/5" || fail "反例不符合预期：exit=$BAD_CODE，命中 $HIT/5"

step S6 "卸载目标包"
if run "$PY" -m pip uninstall -y "$PKG"; then pass "卸载指令成功：$PKG"; else fail '卸载失败'; fi
cp "$EVID/.tmp.out" "$EVID/uninstall.log" 2>/dev/null || true

step S7 '卸载校验：模块必须不可导入'
if run "$PY" -c 'import jsonschema'; then fail '目标包仍可导入，卸载未生效'; else pass 'import 失败，符合预期（ModuleNotFoundError）'; fi

step S8 '残留清算：传递依赖不得留痕'
"$PY" -m pip freeze | sort > "$EVID/freeze.after-uninstall.txt"
comm -13 "$EVID/freeze.before-install.txt" "$EVID/freeze.after-uninstall.txt" > "$EVID/residual.after-uninstall.txt"
if [ ! -s "$EVID/residual.after-uninstall.txt" ]; then
  pass '无残留，冻结清单与基线一致'
else
  echo "  发现残留：$(tr '\n' ' ' < "$EVID/residual.after-uninstall.txt")"
  mapfile -t NAMES < <(cut -d= -f1 "$EVID/residual.after-uninstall.txt")
  run "$PY" -m pip uninstall -y "${NAMES[@]}" && cp "$EVID/.tmp.out" "$EVID/residual-clean.log"
  "$PY" -m pip freeze | sort > "$EVID/.tmp.freeze"
  comm -13 "$EVID/freeze.before-install.txt" "$EVID/.tmp.freeze" > "$EVID/.tmp.residual"
  if [ ! -s "$EVID/.tmp.residual" ]; then pass "残留已清零（清理 ${#NAMES[@]} 个独占依赖）"; else fail "仍残留：$(tr '\n' ' ' < "$EVID/.tmp.residual")"; fi
fi

step S9 '销毁演示环境（隔离环境的最终零残留证明）'
if [ "$KEEP_ENV" = "1" ]; then
  pass "保留环境（KEEP_ENV=1）：$VENV"
else
  rm -rf "$VENV"; [ -d "$VENV" ] && fail 'venv 删除失败' || pass 'venv 已删除，宿主机零残留'
fi

rm -f "$EVID/.tmp.out" "$EVID/.tmp.freeze" "$EVID/.tmp.residual"
if [ "$FAILURES" -eq 0 ]; then note 'VERDICT PASS'; echo; echo '=== VERDICT: PASS ==='; exit 0
else note "VERDICT FAIL failures=$FAILURES"; echo; echo "=== VERDICT: FAIL (failures=$FAILURES) ==="; exit 1; fi
