[CmdletBinding()]
param(
  [string]$Version = '4.0.0',
  [switch]$IncludeSupportPack,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root
$release = Join-Path $Root "releases\$Version"
if ((Test-Path $release) -and -not $Force) { throw "Release already exists: $release; use -Force only after review" }
New-Item -ItemType Directory -Force -Path $release | Out-Null
$releaseFull = [IO.Path]::GetFullPath($release)

function Invoke-Tar([string]$Archive, [string[]]$Includes, [string[]]$Excludes) {
  $tarArgs = @('-cf', $Archive, '-C', $Root)
  foreach ($pattern in $Excludes) { $tarArgs += "--exclude=$pattern" }
  $tarArgs += $Includes
  & tar.exe @tarArgs
  if ($LASTEXITCODE -ne 0) { throw "tar failed: $Archive" }
}

function Add-Artifact([System.Collections.Generic.List[object]]$List, [string]$Id, [string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "artifact missing: $Path" }
  $item = Get-Item -LiteralPath $Path
  $pathFull = [IO.Path]::GetFullPath($Path)
  if (-not $pathFull.StartsWith($releaseFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw "artifact must be under release directory: $Path"
  }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLower()
  $List.Add([pscustomobject]@{
    id = $Id
    path = $pathFull.Substring($releaseFull.Length).TrimStart('\').Replace('\','/')
    bytes = $item.Length
    sha256 = $hash
  })
}

$artifacts = New-Object System.Collections.Generic.List[object]
if (-not (Test-Path (Join-Path $Root 'manifests\input-bom.json'))) {
  throw 'manifests/input-bom.json missing; run scripts/4.0-generate-manifests.mjs first'
}
$sourceTar = Join-Path $release "source-pack-$Version.tar"
$runtimeTar = Join-Path $release "runtime-pack-$Version.tar"
$agentTar = Join-Path $release "agent-pack-$Version.tar"
$supportTar = Join-Path $release "support-source-pack-$Version.tar"

$sbomGenerator = Join-Path $Root 'scripts\4.0-generate-sbom.mjs'
if (Test-Path $sbomGenerator) {
  & node $sbomGenerator --root $Root
  if ($LASTEXITCODE -ne 0) { throw 'SBOM generation failed' }
  $sbomRelease = Join-Path $release 'SBOM.json'
  $noticesRelease = Join-Path $release 'THIRD_PARTY_NOTICES.md'
  Copy-Item -LiteralPath (Join-Path $Root 'manifests\sbom.json') -Destination $sbomRelease -Force
  Copy-Item -LiteralPath (Join-Path $Root 'THIRD_PARTY_NOTICES.md') -Destination $noticesRelease -Force
  Add-Artifact $artifacts 'sbom' $sbomRelease
  Add-Artifact $artifacts 'third-party-notices' $noticesRelease
}

Invoke-Tar $sourceTar @('.') @(
  'packs/runtime-pack', 'packs/agent-pack', 'packs/support-source-pack', 'releases', 'node_modules', '.work', '.dsh-home', 'src-tauri/target',
  'src-tauri/gen', 'offline', 'offline-3.0', 'installer-output', 'Pi_DSH_support',
  'reports/.tmp', 'reports/4.0'
)
Add-Artifact $artifacts 'source-pack' $sourceTar

Invoke-Tar $runtimeTar @('offline', 'offline-3.0', 'installer-output', 'packs/runtime-pack') @()
Add-Artifact $artifacts 'runtime-pack' $runtimeTar

Invoke-Tar $agentTar @(
  'agent-pack', 'AGENTS.md', 'agent-task-pack.md', 'README.md', 'GOAL-PACK-4.0.md',
  'RESOURCE_CHECKLIST.md', 'config/model-provider.example.json',
  'config/model-provider.dsh.example.json', 'config/model-provider.offline.example.json',
  'config/workspace-paths.json', 'manifests/model-provider-contract.json',
  'manifests/release-gates.json', 'manifests/pack-layers.json', 'packs/agent-pack'
) @()
Add-Artifact $artifacts 'agent-pack' $agentTar

if ($IncludeSupportPack) {
  $supportArchive = Join-Path $Root 'packs\support-source-pack\support-source-pack.7z'
  if (-not (Test-Path $supportArchive)) { throw "support archive missing: $supportArchive" }
  Invoke-Tar $supportTar @(
    'packs/support-source-pack/support-source-pack.7z',
    'packs/support-source-pack/README.md',
    'packs/support-source-pack/selection.example.json'
  ) @()
  Add-Artifact $artifacts 'support-source-pack' $supportTar
}

$restoreCopy = Join-Path $release '4.0-restore.ps1'
Copy-Item -LiteralPath (Join-Path $Root 'scripts\4.0-restore.ps1') -Destination $restoreCopy -Force
Add-Artifact $artifacts 'restore-script' $restoreCopy

$hashSeed = ($artifacts | ForEach-Object { "$($_.id):$($_.sha256)" }) -join "`n"
$sha = [Security.Cryptography.SHA256]::Create()
$buildId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($hashSeed)))).Replace('-','').ToLower()
$bom = [pscustomobject]@{
  schemaVersion = '1.0'
  semver = $Version
  buildId = $buildId
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  targetPlatforms = @('Windows 10 22H2 x64', 'Windows 11 x64 current supported')
  files = $artifacts
  supportPackIncluded = [bool]$IncludeSupportPack
}
$bomPath = Join-Path $release 'BOM.json'
[IO.File]::WriteAllText($bomPath, ($bom | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))

$readme = @"
# Universal Workbench $Version

- buildId: $buildId
- source pack: source-pack-$Version.tar
- runtime pack: runtime-pack-$Version.tar
- agent pack: agent-pack-$Version.tar
- support pack: $(if ($IncludeSupportPack) { "support-source-pack-$Version.tar" } else { "not included; source directory remains under packs/support-source-pack/" })

All archives are created from this directory and are checked by BOM.json.
"@
[IO.File]::WriteAllText((Join-Path $release 'README.md'), $readme, (New-Object Text.UTF8Encoding($false)))
$bom | ConvertTo-Json -Depth 12
