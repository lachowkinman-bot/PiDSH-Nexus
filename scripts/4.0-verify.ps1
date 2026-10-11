[CmdletBinding()]
param(
  [string]$DataRoot = $env:UNIVERSAL_WORKBENCH_DATA_ROOT,
  [switch]$RequireOnline,
  [switch]$RequireL2,
  [switch]$DeepTools,
  [switch]$LiveWorkflow,
  [switch]$RuntimeSmoke,
  [switch]$SkipRuntimeInstall
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root
$ReportDir = Join-Path $Root 'reports\4.0'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$checks = New-Object System.Collections.Generic.List[object]
$portable = Join-Path $Root 'offline\node\node-v24.21.0-win-x64'
if (Test-Path (Join-Path $portable 'node.exe')) { $env:PATH = "$portable;$env:PATH" }

function Add-Check([string]$Id, [bool]$Ok, [string]$Evidence, [string]$Detail = '') {
  $checks.Add([pscustomobject]@{
    id = $Id
    status = if ($Ok) { 'PASS' } else { 'FAIL' }
    evidence = $Evidence
    detail = $Detail
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
  })
}

function Write-Json([string]$Path, [object]$Value) {
  [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
}

$required = @(
  'GOAL-PACK-4.0.md',
  'AGENTS.md',
  'agent-task-pack.md',
  'RESOURCE_CHECKLIST.md',
  'manifests\pack-layers.json',
  'manifests\release-gates.json',
  'manifests\model-provider-contract.json',
  'manifests\runtime-bundles.json',
  'manifests\runtime-web.package.json',
  'manifests\plugin-catalog.json',
  'manifests\evidence-summary.json',
  'config\workspace-paths.json',
  'packs\runtime-pack\README.md',
  'packs\source-pack\README.md',
  'packs\agent-pack\README.md',
  'packs\support-source-pack\README.md',
  'packs\support-source-pack\support-source-pack.7z',
  'scripts\4.0-init.ps1',
  'scripts\4.0-pack.ps1',
  'scripts\4.0-restore.ps1',
  'tools\model-adapter\cli.mjs',
  'tools\model-adapter\index.mjs'
)
foreach ($relative in $required) {
  $full = Join-Path $Root $relative
  Add-Check "required:$relative" (Test-Path -LiteralPath $full) $full
}

$runtimeArchive = Join-Path $Root 'offline-3.0\runtime-web.zip'
$installer = Join-Path $Root 'installer-output\UniversalWorkbench-Setup.exe'
Add-Check 'runtime:runtime-web.zip' (Test-Path $runtimeArchive) $runtimeArchive
Add-Check 'runtime:installer' (Test-Path $installer) $installer

$supportRoot = Join-Path $Root 'packs\support-source-pack\Pi_DSH_support'
$supportDsh = Join-Path $supportRoot 'dsh-plugins'
$supportPi = Join-Path $supportRoot 'pi-packages'
$supportArchive = Join-Path $Root 'packs\support-source-pack\support-source-pack.7z'
$supportAvailable = (Test-Path $supportDsh) -and (Test-Path $supportPi)
Add-Check 'support:available' ($supportAvailable -or (Test-Path $supportArchive)) $(if ($supportAvailable) { $supportRoot } else { $supportArchive })

if (-not $DataRoot) {
  $DataRoot = $env:UNIVERSAL_WORKBENCH_DATA_ROOT
}
if (-not $DataRoot) {
  $DataRoot = Join-Path $env:LOCALAPPDATA 'UniversalWorkbench\4.0'
}
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$RootFull = [IO.Path]::GetFullPath($Root)
$separated = -not $DataRoot.StartsWith($RootFull, [StringComparison]::OrdinalIgnoreCase)
Add-Check 'path:program-data-separated' $separated $DataRoot
$pathBoundaryReport = Join-Path $ReportDir 'path-boundary.json'
[IO.File]::WriteAllText($pathBoundaryReport, ([pscustomobject]@{
  schemaVersion = '1.0'
  gate = 'path-boundary'
  root = $Root
  dataRoot = $DataRoot
  separated = $separated
  ok = $separated
  finishedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))

if (-not $SkipRuntimeInstall) {
  if (Test-Path (Join-Path $Root 'scripts\4.0-init.ps1')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\4.0-init.ps1') -DataRoot $DataRoot
    Add-Check 'runtime:init-exit' ($LASTEXITCODE -eq 0) (Join-Path $ReportDir 'init.json') "exit=$LASTEXITCODE"
  }
}

if ($RuntimeSmoke) {
  $smoke = Join-Path $Root 'scripts\4.0-smoke-runtime.ps1'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $smoke -DataRoot $DataRoot -Port 3098
  Add-Check 'runtime:ui-smoke-exit' ($LASTEXITCODE -eq 0) (Join-Path $ReportDir 'runtime-ui.json') "exit=$LASTEXITCODE"
}

$modelConfig = Join-Path $Root 'config\model-provider.json'
if ($RequireOnline) {
  $modelAvailable = Test-Path $modelConfig
  Add-Check 'model:config-present' $modelAvailable $modelConfig
  if ($modelAvailable) {
    $modelOut = Join-Path $ReportDir 'model-capability.json'
    $nodeArgs = @('tools\model-adapter\cli.mjs', '--root', $Root, '--config', $modelConfig, '--probe', '--out', $modelOut)
    if ($DeepTools) { $nodeArgs += '--deep-tools' }
    if ($RequireL2) { $nodeArgs += '--require-l2' }
    & node @nodeArgs
    Add-Check 'model:probe-exit' ($LASTEXITCODE -eq 0) $modelOut "exit=$LASTEXITCODE"
    if ($LiveWorkflow) {
      $liveOut = Join-Path $ReportDir 'workflow-live.json'
      $liveArgs = @('scripts\4.0-live-workflow.mjs', '--root', $Root, '--config', $modelConfig, '--out', $liveOut)
      if ($RequireL2) { $liveArgs += '--require-l2' }
      & node @liveArgs
      Add-Check 'workflow:live-exit' ($LASTEXITCODE -eq 0) $liveOut "exit=$LASTEXITCODE"
    }
  }
} else {
  Add-Check 'model:config-optional' $true $modelConfig 'offline baseline'
}

$scan = Join-Path $Root 'scripts\4.0-scan-secrets.mjs'
if (Test-Path $scan) {
  $scanOut = Join-Path $ReportDir 'security-scan.json'
  & node $scan --root $Root --out $scanOut
  Add-Check 'security:scan-exit' ($LASTEXITCODE -eq 0) $scanOut "exit=$LASTEXITCODE"
}

$selectionLock = Join-Path $Root 'selection.lock'
$selectionVerifier = Join-Path $Root 'scripts\4.0-verify-selection.mjs'
if ((Test-Path $selectionLock) -and (Test-Path $selectionVerifier)) {
  $selectionOut = Join-Path $ReportDir 'plugin-selection-verification.json'
  & node $selectionVerifier --root $Root --lock $selectionLock --out $selectionOut
  Add-Check 'plugins:selection-exit' ($LASTEXITCODE -eq 0) $selectionOut "exit=$LASTEXITCODE"
}

$inputBom = Join-Path $Root 'manifests\input-bom.json'
Add-Check 'input:bom-present' (Test-Path $inputBom) $inputBom

$result = [pscustomobject]@{
  schemaVersion = '1.0'
  gate = 'verify'
  root = $Root
  dataRoot = $DataRoot
  requireOnline = [bool]$RequireOnline
  checks = $checks
  ok = -not ($checks | Where-Object status -eq 'FAIL')
  finishedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$report = Join-Path $ReportDir 'verify.json'
Write-Json $report $result
$result | ConvertTo-Json -Depth 12
if (-not $result.ok) { exit 2 }
