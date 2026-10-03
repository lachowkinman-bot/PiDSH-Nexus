# scripts/download-all.ps1 — 手动下载脚本（Windows PowerShell 7 优先，兼容 Windows PowerShell 5.1）
# 用途：015 资源包预置层兜底。自动模式下由 Agent 运行；手动模式：
#   pwsh -File scripts/download-all.ps1            # 全部
#   pwsh -File scripts/download-all.ps1 -Mirror npmmirror -SkipNode -SkipDshWeb
# 安全：仅 http/https；host 白名单；拒绝回环/私有/保留地址；SHA256 校验，空哈希=失败
[CmdletBinding()]
param(
  [ValidateSet('official','npmmirror','tencent')][string]$Mirror = 'official',
  [switch]$SkipNode, [switch]$SkipDshWeb, [int]$Retry = 3
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }
$REG = @{ official='https://registry.npmjs.org'; npmmirror='https://registry.npmmirror.com'; tencent='https://mirrors.tencent.com/npm' }
$ALLOWED = @('registry.npmjs.org','registry.npmmirror.com','mirrors.tencent.com','nodejs.org','github.com','codeload.github.com')
function Test-AllowedHost([string]$Url){
  if ($Url -notmatch '^https?://') { return $false }
  $h = ([uri]$Url).Host
  if ($ALLOWED -notcontains $h) { return $false }
  if ($h -match '^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?)') { return $false }
  return $true
}
function Get-Sha([string]$p){ $h = Get-FileHash -Algorithm SHA256 -LiteralPath $p; if (-not $h.Hash) { throw "EMPTY_HASH $p" }; $h.Hash.ToLower() }
function Fetch([string]$url,[string]$dest){
  if (-not (Test-AllowedHost $url)) { Write-Host "REJECT-HOST $url"; return $false }
  for($i=0; $i -lt $Retry; $i++){
    & curl.exe -L --fail --retry 2 -sS -o $dest $url
    if ($LASTEXITCODE -eq 0 -and (Test-Path $dest) -and (Get-Item $dest).Length -gt 0) { return $true }
  }
  return $false
}
# —— 24 个 npm 包 + pnpm（与 offline/npm/SHA256SUMS.txt 同名同版本；dsh 按 016 §2 重锁）——
$PKGS = @(
  @('deepseek-ai-dsh','@deepseek-ai/dsh','0.1.7-rc.2'), @('pi2dsh','pi2dsh','0.25.2'),
  @('dsh-better-sidebar','dsh-better-sidebar','0.21.1'), @('dsh-plugin','dsh-plugin','1.4.8'),
  @('pi-hermes-memory','pi-hermes-memory','0.9.9'), @('pi-approval-guardian','pi-approval-guardian','0.8.0'),
  @('pi-redact-all','pi-redact-all','0.2.1'), @('pi-mcp-adapter','pi-mcp-adapter','2.38.0'),
  @('dsh-excel-panel','dsh-excel-panel','0.6.1'), @('dsh-docs-panel','dsh-docs-panel','0.1.0'),
  @('rmrdeveloper-sideroom-pi','@rmrdeveloper/sideroom-pi','8.11.0'), @('pi-stats-footer','pi-stats-footer','0.4.0'),
  @('dsh-undo-savepoint','dsh-undo-savepoint','0.4.9'), @('tintinweb-pi-subagents','@tintinweb/pi-subagents','0.19.0'),
  @('pi-dag-core','pi-dag-core','0.1.6'), @('graph-memory','graph-memory','1.5.8'),
  @('mutmutco-pi-plugin','@mutmutco/pi-plugin','4.5.41'), @('pi-deepseek-search','pi-deepseek-search','1.0.20'),
  @('pi-queue-steer-factory','pi-queue-steer-factory','0.17.5'), @('pi-loop-mode','pi-loop-mode','2.5.4'),
  @('anionex-dsh-vision-toolkit','@anionex/dsh-vision-toolkit','0.1.45'),
  @('ychris12138-dsh-usage-stats','@ychris12138/dsh-usage-stats','0.3.4'),
  @('changfenhuang-dsh-annotation','@changfenhuang/dsh-annotation','1.4.10'), @('dsh-network-settings','dsh-network-settings','0.3.3')
)
New-Item -ItemType Directory -Force -Path 'offline/npm','offline/node','offline/github' | Out-Null
$sums = @(); $fail = @()
foreach($p in $PKGS){
  $base = $p[0]; $npm = $p[1]; $ver = $p[2]
  $file = "$base-$ver.tgz"; $dest = "offline/npm/$file"
  if (Test-Path $dest) { Write-Host "SKIP(exists) $file"; }
  else {
    $url = "$($REG[$Mirror])/$npm/-/$(($npm -split '/')[-1])-$ver.tgz"
    if (-not (Fetch $url $dest)) { $fail += $file; Write-Host "FAIL $file"; continue }
  }
  $sums += "$file  $(Get-Sha $dest)"; Write-Host "OK $file"
}
# —— pnpm 10.32.1（dsh plugin add 的转发依赖；workbench.ps1 install 第 0 步离线自举）——
$pnpmFile = 'pnpm-10.32.1.tgz'
$pnpmDest = "offline/npm/$pnpmFile"
$pnpmSha = '9b943b94bc8f55efb993aad8e44b538e6b091e60a9e4a944dcde869855f233e3'
if (-not (Test-Path $pnpmDest)) {
  if (Fetch "$($REG[$Mirror])/pnpm/-/$pnpmFile" $pnpmDest) { Write-Host "OK $pnpmFile" }
  else { $fail += $pnpmFile; Write-Host "FAIL $pnpmFile" }
} else { Write-Host "SKIP(exists) $pnpmFile" }
if (Test-Path $pnpmDest) {
  $a = Get-Sha $pnpmDest
  if ($a -ne $pnpmSha) { Write-Host "PNPM-HASH-MISMATCH $pnpmFile`n  expect=$pnpmSha`n  actual=$a"; $fail += $pnpmFile }
  else { $sums += "$pnpmFile  $a" }
}
$sums | Set-Content -Encoding UTF8 'offline/npm/SHA256SUMS.txt'
# —— dsh 0.1.7-rc.2 引擎双落点：offline/npm 供 workbench.ps1，offline-3.0/engines 供 U1/运行时分发 ——
$engineFile = 'deepseek-ai-dsh-0.1.7-rc.2.tgz'
$engineSha = '5f2da7272d9485abc223e681075809a8d929697c5232ee445718e1b7e066bff8'
$engineSrc = "offline/npm/$engineFile"
$engineDst = "offline-3.0/engines/$engineFile"
if (Test-Path $engineSrc) {
  $a = Get-Sha $engineSrc
  if ($a -ne $engineSha) { Write-Host "ENGINE-HASH-MISMATCH $engineFile`n  expect=$engineSha`n  actual=$a"; $fail += $engineFile }
  else {
    New-Item -ItemType Directory -Force -Path 'offline-3.0/engines' | Out-Null
    if ((Test-Path $engineDst) -and ((Get-Sha $engineDst) -eq $a)) { Write-Host "SKIP(exists) $engineDst" }
    else { Copy-Item -LiteralPath $engineSrc -Destination $engineDst -Force; Write-Host "OK $engineDst" }
  }
}
# —— Node 24.21.0（tools-versions.txt 锁定；便携 zip 解压到 workbench.ps1 期望路径，另留 msi/pkg）——
if (-not $SkipNode) {
  $nodeVersion = '24.21.0'
  $nodeBase = "https://nodejs.org/dist/v$nodeVersion"
  $shasums = 'offline/node/SHASUMS256.txt'
  if (Fetch "$nodeBase/SHASUMS256.txt" $shasums) {
    $nodeSums = @{}
    foreach($line in ([IO.File]::ReadAllLines((Resolve-Path $shasums)))){
      if ($line -match '^(?<sha>[0-9a-f]{64})\s+\*?(?<f>.+)$') { $nodeSums[$Matches.f] = $Matches.sha.ToLower() }
    }
    # 便携 zip：offline/node/node-v24.21.0-win-x64/ 是 workbench.ps1 与 build-runtime-bundle.ps1 的硬路径
    $portableZip = "node-v$nodeVersion-win-x64.zip"
    $portableDest = "offline/node/$portableZip"
    if (-not (Test-Path $portableDest)) {
      if (Fetch "$nodeBase/$portableZip" $portableDest) { Write-Host "OK $portableZip" }
      else { $fail += $portableZip; Write-Host "FAIL $portableZip" }
    } else { Write-Host "SKIP(exists) $portableZip" }
    if (Test-Path $portableDest) {
      $expect = $nodeSums[$portableZip]; $a = Get-Sha $portableDest
      if (-not $expect -or $a -ne $expect) { Write-Host "NODE-HASH-MISMATCH $portableZip`n  expect=$expect`n  actual=$a"; $fail += $portableZip }
      else {
        $portableDir = "offline/node/node-v$nodeVersion-win-x64"
        if (-not (Test-Path (Join-Path $portableDir 'node.exe'))) {
          Expand-Archive -LiteralPath $portableDest -DestinationPath 'offline/node' -Force
          Write-Host "EXTRACTED $portableDir"
        } else { Write-Host "SKIP(exists) $portableDir/node.exe" }
      }
    }
    # 系统安装器（可选，macOS/Linux 或不使用便携 Node 的用户）
    foreach($f in @("node-v$nodeVersion-x64.msi","node-v$nodeVersion.pkg")) {
      if (-not $nodeSums.ContainsKey($f)) { continue }
      $dest = "offline/node/$f"
      if (Test-Path $dest) { Write-Host "SKIP(exists) $f"; continue }
      if (Fetch "$nodeBase/$f" $dest) {
        $a = Get-Sha $dest
        if ($a -ne $nodeSums[$f]) { Write-Host "NODE-HASH-MISMATCH $f"; $fail += $f } else { Write-Host "OK $f" }
      } else { $fail += $f }
    }
  } else { $fail += 'node-SHASUMS' }
}
# —— dsh-web 源码（浅克隆；zip 实测 452MB 过重）——
if (-not $SkipDshWeb) {
  if (Test-Path 'offline/github/dsh-web/.git') { Write-Host 'SKIP(exists) dsh-web' }
  else {
    & git clone --depth 1 https://github.com/zhu1090093659/dsh-web offline/github/dsh-web 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host 'OK dsh-web (shallow clone)' } else { $fail += 'dsh-web(需手动 git clone)'; Write-Host 'FAIL dsh-web —— 请手动：git clone --depth 1 https://github.com/zhu1090093659/dsh-web offline/github/dsh-web' }
  }
}
if ($fail.Count -gt 0) { Write-Host "`nFAILED ITEMS:"; $fail | ForEach-Object { Write-Host " - $_" }; exit 1 }
Write-Host "`nDOWNLOAD_ALL_DONE"
