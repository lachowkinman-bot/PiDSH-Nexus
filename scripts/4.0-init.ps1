[CmdletBinding()]
param(
  [string]$DataRoot = $env:UNIVERSAL_WORKBENCH_DATA_ROOT,
  [switch]$SkipRuntimeInstall,
  [switch]$Start
)

$ErrorActionPreference = 'Stop'
$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root

if (-not $DataRoot) {
  $DataRoot = Join-Path $env:LOCALAPPDATA 'UniversalWorkbench\4.0'
}
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$RootFull = [IO.Path]::GetFullPath($Root)
if ($DataRoot.StartsWith($RootFull, [StringComparison]::OrdinalIgnoreCase)) {
  throw "数据根不能位于源码目录内：$DataRoot"
}

$ReportDir = Join-Path $Root 'reports\4.0'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$steps = New-Object System.Collections.Generic.List[object]

function Add-Step([string]$Id, [string]$Status, [string]$Detail) {
  $steps.Add([pscustomobject]@{
    id = $Id
    status = $Status
    detail = $Detail
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
  })
}

function Write-Json([string]$Path, [object]$Value) {
  $json = $Value | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($Path, $json, (New-Object Text.UTF8Encoding($false)))
}

$dirs = @(
  $DataRoot,
  (Join-Path $DataRoot 'dsh-home'),
  (Join-Path $DataRoot 'workspace'),
  (Join-Path $DataRoot 'reports'),
  (Join-Path $DataRoot 'logs'),
  (Join-Path $DataRoot 'backups'),
  (Join-Path $DataRoot 'versions')
)
foreach ($dir in $dirs) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
Add-Step 'data-root' 'PASS' $DataRoot

$seed = Join-Path $Root 'templates\workspace'
$workspace = Join-Path $DataRoot 'workspace'
if ((Test-Path $seed) -and -not (Test-Path (Join-Path $workspace '.initialized'))) {
  Get-ChildItem -LiteralPath $seed -Force | Copy-Item -Destination $workspace -Recurse -Force
  New-Item -ItemType File -Force -Path (Join-Path $workspace '.initialized') | Out-Null
  Add-Step 'workspace-seed' 'PASS' 'copied dedicated seed workspace'
} elseif (Test-Path (Join-Path $workspace '.initialized')) {
  Add-Step 'workspace-seed' 'PASS' 'existing workspace preserved'
} else {
  Add-Step 'workspace-seed' 'WARN' 'no templates/workspace seed found'
}

$portable = Join-Path $Root 'offline\node\node-v24.21.0-win-x64'
if (Test-Path (Join-Path $portable 'node.exe')) {
  $env:PATH = "$portable;$env:PATH"
}

$env:UNIVERSAL_WORKBENCH_ROOT = $Root
$env:UNIVERSAL_WORKBENCH_DATA_ROOT = $DataRoot
$env:DSH_HOME = Join-Path $DataRoot 'dsh-home'

$modelConfig = Join-Path $Root 'config\model-provider.json'
if (Test-Path $modelConfig) {
  $env:WORKBENCH_MODEL_CONFIG = $modelConfig
  Add-Step 'model-config' 'PASS' $modelConfig
} else {
  Add-Step 'model-config' 'WARN' 'not set; offline baseline can run, online model gate remains disabled'
}

if (-not $SkipRuntimeInstall) {
  $workbench = Join-Path $Root 'scripts\workbench.ps1'
  if (-not (Test-Path $workbench)) {
    Add-Step 'runtime-install' 'FAIL' 'scripts/workbench.ps1 missing'
  } else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $workbench -Cmd install
    $installExit = $LASTEXITCODE
    $installReport = Join-Path $ReportDir 'runtime-offline.json'
    Write-Json $installReport ([pscustomobject]@{
      schemaVersion = '1.0'
      command = 'scripts/workbench.ps1 -Cmd install'
      exitCode = $installExit
      dataRoot = $DataRoot
      dshHome = $env:DSH_HOME
      finishedAt = (Get-Date).ToUniversalTime().ToString('o')
    })
    if ($installExit -ne 0) {
      Add-Step 'runtime-install' 'FAIL' "exit=$installExit"
    } else {
      Add-Step 'runtime-install' 'PASS' 'offline runtime install completed'
      $apply = Join-Path $Root 'scripts\4.0-apply-runtime-manifest.mjs'
      if (Test-Path $apply) {
        & node $apply --root $Root --data-root $DataRoot
        if ($LASTEXITCODE -ne 0) {
          Add-Step 'runtime-profile-apply' 'FAIL' "exit=$LASTEXITCODE"
        } else {
          Add-Step 'runtime-profile-apply' 'PASS' '4.0 runtime bundles applied'
        }
      } else {
        Add-Step 'runtime-profile-apply' 'WARN' 'apply script missing'
      }
    }
  }
} else {
  Add-Step 'runtime-install' 'SKIPPED' 'SkipRuntimeInstall'
}

$result = [pscustomobject]@{
  schemaVersion = '1.0'
  gate = 'init'
  root = $Root
  dataRoot = $DataRoot
  dshHome = $env:DSH_HOME
  steps = $steps
  finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  ok = -not ($steps | Where-Object status -eq 'FAIL')
}
$initReport = Join-Path $ReportDir 'init.json'
Write-Json $initReport $result
$result | ConvertTo-Json -Depth 10

if ($Start) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\launch.ps1')
}
if (-not $result.ok) { exit 2 }
