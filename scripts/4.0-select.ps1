[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Selection,
  [string]$Output = ''
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root
$selectionPath = [IO.Path]::GetFullPath($Selection)
if (-not (Test-Path $selectionPath)) { throw "selection missing: $selectionPath" }
$config = Get-Content -Raw $selectionPath | ConvertFrom-Json
$sourceRoot = Join-Path $Root 'packs\support-source-pack\Pi_DSH_support'
$sourceArchive = Join-Path $Root 'packs\support-source-pack\support-source-pack.7z'
$selected = @($config.selected)
$resolved = @()
foreach ($id in $selected) {
  if (Test-Path $sourceRoot) {
    $match = Get-ChildItem $sourceRoot -Recurse -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq $id } | Select-Object -First 1
    if (-not $match) { throw "selected plugin source not found: $id" }
    $files = Get-ChildItem $match.FullName -Recurse -File -ErrorAction SilentlyContinue
    $resolved += [pscustomobject]@{
      id = $id
      source = $match.FullName.Substring($Root.Length).TrimStart('\').Replace('\','/')
      files = $files.Count
      bytes = ($files | Measure-Object Length -Sum).Sum
      status = 'resolved-directory'
    }
    continue
  }
  if (-not (Test-Path $sourceArchive)) { throw "support source unavailable: $id" }
  $sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue).Source
  if (-not $sevenZip) { throw '7z is required to inspect the support archive' }
  $listing = & $sevenZip l -ba $sourceArchive
  $paths = foreach ($line in $listing) {
    $parts = $line -split '\s+', 6
    if ($parts.Count -ge 6) { $parts[5].Replace('\','/') }
  }
  $matches = @($paths | Where-Object { $_ -match "(^|/)($([regex]::Escape($id)))(/|$)" })
  if ($matches.Count -eq 0) { throw "selected plugin not found in archive: $id" }
  $resolved += [pscustomobject]@{
    id = $id
    source = 'packs/support-source-pack/support-source-pack.7z'
    archiveEntries = $matches.Count
    sample = $matches | Select-Object -First 5
    status = 'resolved-archive'
  }
}

$lock = [pscustomobject]@{
  schemaVersion = '1.0'
  profile = $config.profile
  selected = $resolved
  excludedByPolicy = @($config.excludedByPolicy)
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  sourceRoot = $sourceRoot.Substring($Root.Length).TrimStart('\').Replace('\','/')
  policy = 'selected-only'
}
if (-not $Output) { $Output = Join-Path $Root 'selection.lock' }
[IO.File]::WriteAllText($Output, ($lock | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
$verifier = Join-Path $Root 'scripts\4.0-verify-selection.mjs'
if (Test-Path $verifier) {
  & node $verifier --root $Root --lock $Output
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$lock | ConvertTo-Json -Depth 12
