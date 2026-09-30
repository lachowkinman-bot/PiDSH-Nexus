# scripts/launch.ps1 — 桌面启动器（F1：双击图标启动）
# 行为：确保 DSH 运行（仅 127.0.0.1:3080）→ 打开工作台窗口；失败时给出 ERR-INST-002 指引
# 3.0 修复：不再 npx 联网拉取（离线安装契约，§10.1）；dsh 启动语法为 `dsh --profile web`（0.1.7-rc.2 实测）；优先用安装目录内便携 Node 的 dsh
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 0) 项目内便携 Node 优先入 PATH（含随安装预置的 dsh 引擎）
$portable = Join-Path $root 'offline\node\node-v24.21.0-win-x64'
if (Test-Path (Join-Path $portable 'dsh.cmd')) { $env:PATH = "$portable;$env:PATH" }
if (-not $env:DSH_HOME) { $env:DSH_HOME = Join-Path $root '.dsh-home' }

# 1) 自愈（2026-09-29 补）：dsh 引擎或工作台插件缺失时，先静默跑一次离线安装。
#    覆盖两种现实情形：①安装器 [Run] 带 skipifsilent，静默安装不会跑 postinstall；
#    ②用户直接拷贝目录/升级安装。没有这步，双击图标只会看到"尚未构建"占位页或壳首页。
$dshOk    = [bool](& dsh --version 2>$null)
$pluginOk = Test-Path (Join-Path $env:DSH_HOME 'profiles\web\node_modules\@workbench\client-ui\package.json')
if (-not ($dshOk -and $pluginOk)) {
  Write-Host "[launch] 自愈：离线安装 DSH 引擎 / pnpm / 插件（含工作台插件）…"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'scripts\workbench.ps1') -Cmd install
}

# 2) DSH 是否已在 3080 端口
& curl.exe -sS --fail --max-time 3 http://127.0.0.1:3080 2>$null | Out-Null
$up = ($LASTEXITCODE -eq 0)

if (-not $up) {
  Write-Host "[launch] 启动 DSH Web（仅绑定 127.0.0.1:3080）…"
  $dshVer = & dsh --version 2>$null
  if (-not $dshVer) { Write-Host "[launch] 未检测到 Node/DSH —— 请先完成安装（见 docs/README-学员版.md §安装）；错误码 ERR-INST-002"; exit 1 }
  Start-Process -WindowStyle Hidden -FilePath "powershell.exe" -ArgumentList "-Command", "dsh --profile web --no-open --port 3080"
  Start-Sleep -Seconds 8
}

# 3) 以“桌面应用窗口”打开工作台（app 模式：无地址栏、无标签页、独立任务栏项 —— 非浏览器标签）
#    形态优先级：dsh-web 桌面壳（若已构建）→ Edge/Chrome app 模式 → 默认浏览器兜底
#    2026-09-29 修订：原实现 `Start-Process "http://127.0.0.1:3080"` 会在默认浏览器里开标签页（网页版），
#    与「桌面版」目标形态不符；改为 app 模式窗口，并直接落在工作台应用页（而非壳首页）。
$shell = Join-Path $root 'offline/github/dsh-web/dist'
if (Test-Path $shell) { Write-Host "[launch] 检测到 dsh-web 构建（D2 形态）；壳接入见 015 §10.2" }

# 2026-09-30 修订（用户反馈「主驾驶舱不见了，只剩下 13 个工作域」）：
#   主驾驶舱 = DSH 主壳首页（聊天会话 / 插件市场 / 技能中心 / 记忆系统 / ⟡ 工作台面板），
#   13 域驾驶舱只是壳内 ⟡ 工作台 面板里的一项。启动器必须落在主壳，否则用户会误判主驾驶舱丢失。
$appUrl = 'http://127.0.0.1:3080/'
for ($i = 0; $i -lt 15; $i++) {                              # 等主壳就绪（首启可能需数秒）
  & curl.exe -sS --fail --max-time 2 $appUrl 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}

$profileDir = Join-Path $env:LOCALAPPDATA 'UniversalWorkbench\app-profile'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$cands = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
) | Where-Object { Test-Path $_ }
if ($cands.Count -gt 0) {
  Start-Process -FilePath $cands[0] -ArgumentList @("--app=$appUrl", "--user-data-dir=$profileDir", '--no-first-run', '--no-default-browser-check')
  Write-Host "[launch] 已以桌面应用窗口打开：$appUrl"
  Write-Host "[launch] app 模式（无地址栏）；应用数据目录：$profileDir（仅本机可达）"
} else {
  Start-Process $appUrl
  Write-Host "[launch] 未检测到 Edge/Chrome，已回退为默认浏览器打开：$appUrl"
}
