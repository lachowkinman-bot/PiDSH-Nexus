[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ReleaseDir,
  [string]$Destination = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ReleaseDir = [IO.Path]::GetFullPath($ReleaseDir)
$bomPath = Join-Path $ReleaseDir 'BOM.json'
if (-not (Test-Path $bomPath)) { throw "BOM missing: $bomPath" }
$bom = Get-Content -Raw $bomPath | ConvertFrom-Json

foreach ($item in $bom.files) {
  $file = Join-Path $ReleaseDir ($item.path -replace '/', '\')
  if (-not (Test-Path -LiteralPath $file)) { throw "artifact missing: $file" }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLower()
  if ($hash -ne $item.sha256) { throw "SHA256 mismatch: $file" }
}

if (-not $Destination) {
  if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA unavailable' }
  $Destination = Join-Path $env:LOCALAPPDATA 'UniversalWorkbench\4.0\restore'
}
$Destination = [IO.Path]::GetFullPath($Destination)
if (Test-Path $Destination) {
  if (-not $Force) { throw "destination exists: $Destination" }
} else {
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
}

$extract = @{
  'runtime-pack' = 'runtime-pack.tar'
  'source-pack' = 'source-pack.tar'
  'agent-pack' = 'agent-pack.tar'
  'support-source-pack' = 'support-source-pack.tar'
}
foreach ($item in $bom.files) {
  if ($item.id -notlike '*-pack') { continue }
  $archive = Join-Path $ReleaseDir ($item.path -replace '/', '\')
  if ($archive.EndsWith('.7z', [StringComparison]::OrdinalIgnoreCase)) {
    $sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue).Source
    if (-not $sevenZip) { throw '7z is required to restore support-source-pack' }
    & $sevenZip x $archive "-o$Destination" -y
  } else {
    & tar.exe -xf $archive -C $Destination
  }
  if ($LASTEXITCODE -ne 0) { throw "extract failed: $archive" }
}

$result = [pscustomobject]@{
  schemaVersion = '1.0'
  gate = 'restore'
  releaseDir = $ReleaseDir
  destination = $Destination
  buildId = $bom.buildId
  ok = $true
  finishedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$out = Join-Path $ReleaseDir 'restore.json'
[IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
$result | ConvertTo-Json -Depth 12
