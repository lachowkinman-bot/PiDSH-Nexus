[CmdletBinding()]
param(
  [string[]]$Plugin = @(),
  [switch]$All
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
$Archive = Join-Path $Root 'packs\support-source-pack\support-source-pack.7z'
if (-not (Test-Path $Archive)) { throw "support archive missing: $Archive" }
$sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue).Source
if (-not $sevenZip) { throw '7z is required to materialize support sources' }
$output = Join-Path $Root 'packs\support-source-pack'
New-Item -ItemType Directory -Force -Path $output | Out-Null

if ($All) {
  & $sevenZip x $Archive "-o$output" -y
  if ($LASTEXITCODE -ne 0) { throw "7z extract failed: exit=$LASTEXITCODE" }
  exit 0
}
if ($Plugin.Count -eq 0) { throw 'Specify -Plugin <id> or -All' }
foreach ($id in $Plugin) {
  $patterns = @(
    "Pi_DSH_support/dsh-plugins/$id/*",
    "Pi_DSH_support/pi-packages/$id/*"
  )
  $ok = $false
  foreach ($pattern in $patterns) {
    & $sevenZip x $Archive "-o$output" -y $pattern
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  }
  if (-not $ok) { throw "support plugin not found in archive: $id" }
}
