[CmdletBinding()]
param(
  [string]$CodexHome = $env:CODEX_HOME,
  [string]$AgentsHome = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
if (-not $AgentsHome) {
  if ($env:USERPROFILE) { $AgentsHome = Join-Path $env:USERPROFILE '.agents\skills' }
  else { throw 'USERPROFILE unavailable; pass -AgentsHome' }
}
$target = Join-Path $AgentsHome 'universal-workbench-4.0'
$source = Join-Path $Root 'agent-pack\skills\universal-workbench-4.0'
if (-not (Test-Path $source)) { throw "agent skill source missing: $source" }
if ((Test-Path $target) -and -not $Force) { throw "skill already exists: $target; use -Force" }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $target -Recurse -Force
[pscustomobject]@{
  ok = $true
  source = $source
  target = $target
  force = [bool]$Force
  installedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 6
