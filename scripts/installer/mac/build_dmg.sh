#!/usr/bin/env bash
# scripts/installer/mac/build_dmg.sh — Universal Workbench macOS 安装包构建基线（015 §10.1）
# 产出：installer-output/UniversalWorkbench.dmg
# 前置：Xcode CLT（xcode-select --install）；Agent 按 U14 实构建后固化
set -uo pipefail
APP="Universal Workbench"
STAGING="$(mktemp -d)"
OUT="installer-output"
mkdir -p "$OUT" "$STAGING/$APP"

# 1) 打包资源进 .app 骨架（与 Windows setup.iss 同构：offline/scripts/templates/manifests/docs）
rsync -a offline scripts templates manifests docs "$STAGING/$APP/" || exit 1
cp "$(dirname "$0")/../launch.sh" "$STAGING/$APP/scripts/launch.sh" 2>/dev/null || true

# 2) 生成 .app 结构（最小壳：双击启动 launch.sh）
mkdir -p "$STAGING/$APP.app/Contents/MacOS" "$STAGING/$APP.app/Contents/Resources"
cat > "$STAGING/$APP.app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Universal Workbench</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIdentifier</key><string>io.universalworkbench.desktop</string>
</dict></plist>
PLIST
cat > "$STAGING/$APP.app/Contents/MacOS/launch" <<'LAUNCH'
#!/bin/bash
DIR="$(cd "$(dirname "$0")/../.." && pwd)" || exit 1
case "$DIR" in *[\"\';\ \$\&\|]* ) echo "unsafe install path"; exit 1;; esac
exec bash "$DIR/scripts/launch.sh"
LAUNCH
chmod +x "$STAGING/$APP.app/Contents/MacOS/launch"

# 3) 构建 DMG（含 .app 与资源目录）
hdiutil create -volname "$APP" -srcfolder "$STAGING" -ov -format UDZO "$OUT/UniversalWorkbench.dmg"
RC=$?
rm -rf "$STAGING"
echo "BUILD_DMG_DONE exit=$RC → $OUT/UniversalWorkbench.dmg（干净环境安装→双击→工作台可达→F11 自检报告，U14）"
exit $RC
