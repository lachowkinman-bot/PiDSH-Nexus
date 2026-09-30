# runner-probe.ps1 — 015 §4.1 启动探测自检（Windows PowerShell 7/5.1 兼容）
# 规则：只登记事实，不硬编码 runner 专属命令（D21）；unknown 不是错误
$ErrorActionPreference = 'SilentlyContinue'
function Test-Cmd([string]$c){ if (Get-Command $c -ErrorAction SilentlyContinue) { return $c } else { return '-' } }
$RUNNER = 'unknown'
foreach ($c in @('pi','dsh','codex','claude','zcode','opencode')) {
  if ((Test-Cmd $c) -ne '-') { $RUNNER = $c; break }
}
$GIT_PERSIST = 'no'
& git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $GIT_PERSIST = 'yes' }
$NET = 'no'
& curl.exe -sS --fail --max-time 5 https://registry.npmjs.org/pi2dsh 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $NET = 'yes' }
$HASH = 'none'
foreach ($h in @('shasum','sha256sum','openssl')) { if ((Test-Cmd $h) -ne '-') { $HASH = $h; break } }
$UNVER = (@('minimax','doubao','trae','kimi') | Where-Object { (Test-Cmd $_) -ne '-' }) -join ' '
$now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$os = if ($env:OS) { $env:OS } else { 'Windows' }
$json = @'
{"runner":"__R__","git_persistent":"__G__","network":"__N__","hash_tool":"__H__",
 "os":"__OS__","detected_at":"__T__",
 "unverified_runners_detected":"__U__",
 "unverified_capabilities":["10-runner 矩阵中 minimax/豆包工作/Trae Work/Kimi code 未公开核验，实测后回填"]}
'@
$json = $json.Replace('__R__', $RUNNER)
$json = $json.Replace('__G__', $GIT_PERSIST)
$json = $json.Replace('__N__', $NET)
$json = $json.Replace('__H__', $HASH)
$json = $json.Replace('__OS__', $os)
$json = $json.Replace('__T__', $now)
$json = $json.Replace('__U__', $UNVER)
Set-Content -Encoding UTF8 -Path 'runner-profile.json' -Value $json
Write-Output "runner-profile.json written: runner=$RUNNER git=$GIT_PERSIST net=$NET hash=$HASH"
