[CmdletBinding()]
param(
  [string]$DataRoot = $env:UNIVERSAL_WORKBENCH_DATA_ROOT,
  [int]$Port = 3098
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
if (-not $DataRoot) { $DataRoot = Join-Path $env:LOCALAPPDATA 'UniversalWorkbench\4.0' }
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$ReportDir = Join-Path $Root 'reports\4.0'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$oldPath = $env:PATH
$portable = Join-Path $Root 'offline\node\node-v24.21.0-win-x64'
$env:PATH = "$portable;$oldPath"
$env:DSH_HOME = Join-Path $DataRoot 'dsh-home'
$env:UNIVERSAL_WORKBENCH_DATA_ROOT = $DataRoot
$env:UNIVERSAL_WORKBENCH_ROOT = $Root

$existing = netstat -ano | Select-String "127.0.0.1:$Port\s+0.0.0.0:0\s+LISTENING" | Select-Object -First 1
if ($existing) { throw "port already in use: $Port" }

$dsh = Join-Path $portable 'dsh.cmd'
if (-not (Test-Path $dsh)) { throw "dsh missing: $dsh" }
$cmdLine = "`"$dsh`" --profile web --no-open --port $Port"
$wrapper = Start-Process -FilePath 'C:\Windows\System32\cmd.exe' -ArgumentList @('/d','/s','/c',$cmdLine) -WorkingDirectory $Root -WindowStyle Hidden -PassThru
$started = (Get-Date).ToUniversalTime()
$ok = $false
$size = 0
$status = 0
$oldErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  $response = & 'C:\Windows\System32\curl.exe' -sS -o NUL -w '%{http_code} %{size_download}' --max-time 4 "http://127.0.0.1:$Port/workbench/api/app-page" 2>$null
  if ($LASTEXITCODE -eq 0 -and $response) {
    $parts = "$response".Trim().Split(' ')
    $status = [int]$parts[0]
    $size = [int]$parts[1]
    if ($status -eq 200 -and $size -gt 100000) { $ok = $true; break }
  }
}
$ErrorActionPreference = $oldErrorAction

$listener = netstat -ano | Select-String "127.0.0.1:$Port\s+0.0.0.0:0\s+LISTENING" | Select-Object -First 1
if ($listener) {
  $ownerId = [int](($listener.Line -split '\s+')[-1])
  Stop-Process -Id $ownerId -Force -ErrorAction SilentlyContinue
}
if ($wrapper -and -not $wrapper.HasExited) { Stop-Process -Id $wrapper.Id -Force -ErrorAction SilentlyContinue }

$report = [pscustomobject]@{
  schemaVersion = '1.0'
  gate = 'runtime-ui'
  startedAt = $started.ToString('o')
  finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  dataRoot = $DataRoot
  port = $Port
  appPageStatus = $status
  appPageBytes = $size
  ok = $ok
}
$out = Join-Path $ReportDir 'runtime-ui.json'
[IO.File]::WriteAllText($out, ($report | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
$report | ConvertTo-Json -Depth 8
if (-not $ok) { exit 2 }
