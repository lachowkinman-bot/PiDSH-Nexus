$ErrorActionPreference = 'Stop'
$root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $root

# 0) 由固定清单生成 package.json（缺离线 tar 包即失败，不静默降级）
node scripts/gen-runtime-manifest.mjs
if ($LASTEXITCODE -ne 0) { throw "生成 runtime 清单失败 exit=$LASTEXITCODE" }

function Assert-UnderRoot([string]$Path, [string]$Label) {
  $resolved = [IO.Path]::GetFullPath($Path)
  $prefix = [IO.Path]::GetFullPath($root + [IO.Path]::DirectorySeparatorChar)
  if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label 越出项目根：$resolved"
  }
  return $resolved
}

$runtime = Assert-UnderRoot (Join-Path $root '.work/runtime-web') 'runtime-web'
$stage = Assert-UnderRoot (Join-Path $root '.work/runtime-stage') 'runtime-stage'
$archive = Assert-UnderRoot (Join-Path $root 'offline-3.0/runtime-web.zip') 'runtime archive'

if (-not (Test-Path (Join-Path $runtime 'package.json'))) {
  throw "缺少 runtime package.json：$runtime"
}
Copy-Item -LiteralPath (Join-Path $root 'manifests/runtime-web.package.json') -Destination (Join-Path $runtime 'package.json') -Force

Push-Location $runtime
try {
  npm install --omit=dev --install-links --legacy-peer-deps
  $npmExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($npmExit -ne 0) { throw "npm install 失败 exit=$npmExit" }

$baseScope = Join-Path $root 'offline/node/node-v24.21.0-win-x64/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai'
$runtimeScope = Join-Path $runtime 'node_modules/@deepseek-ai'
& robocopy $baseScope $runtimeScope /E /NFL /NDL /NJH /NJS /NP | Out-Null
$baseCopyExit = $LASTEXITCODE
if ($baseCopyExit -ge 8) { throw "复制 DSH 基础包失败 robocopy=$baseCopyExit" }

$pluginSource = Join-Path $root 'workbench-ui-plugin'
$pluginTarget = Join-Path $runtime 'node_modules/@workbench/client-ui'
New-Item -ItemType Directory -Force -Path $pluginTarget | Out-Null
& robocopy $pluginSource $pluginTarget /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
$copyExit = $LASTEXITCODE
if ($copyExit -ge 8) { throw "复制工作台插件失败 robocopy=$copyExit" }

if (Test-Path $stage) {
  $resolved = [IO.Path]::GetFullPath($stage)
  if ($resolved -ne [IO.Path]::GetFullPath((Join-Path $root '.work/runtime-stage'))) {
    throw "拒绝清理非预期目录：$resolved"
  }
  Remove-Item -LiteralPath $stage -Recurse -Force
}
$profileStage = Join-Path $stage 'profiles/web'
New-Item -ItemType Directory -Force -Path $profileStage | Out-Null

Copy-Item -LiteralPath (Join-Path $runtime 'package.json') -Destination $profileStage -Force
if (Test-Path (Join-Path $runtime 'package-lock.json')) {
  Copy-Item -LiteralPath (Join-Path $runtime 'package-lock.json') -Destination $profileStage -Force
}
# 出厂 profile patch：预置「内测声明已确认」（升级时由 ensure_runtime 合并保留）
Copy-Item -LiteralPath (Join-Path $root 'templates/runtime/cordis.patch.yml') -Destination (Join-Path $profileStage 'cordis.patch.yml') -Force
& robocopy (Join-Path $runtime 'node_modules') (Join-Path $profileStage 'node_modules') /E /NFL /NDL /NJH /NJS /NP | Out-Null
$copyExit = $LASTEXITCODE
if ($copyExit -ge 8) { throw "复制 runtime node_modules 失败 robocopy=$copyExit" }

$buildFiles = @(
  (Join-Path $root 'workbench-ui-plugin/package.json'),
  (Join-Path $root 'workbench-ui-plugin/lib/index.js'),
  (Join-Path $root 'workbench-ui-plugin/lib/client.js'),
  (Join-Path $root 'workbench-ui-plugin/lib/delivery-service.cjs'),
  (Join-Path $root 'manifests/runtime-web.package.json'),
  (Join-Path $root 'manifests/runtime-bundles.json'),
  (Join-Path $root 'templates/runtime/cordis.patch.yml')
)
$fingerprint = ($buildFiles | ForEach-Object {
  "$_`n$((Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash)"
}) -join "`n"
$sha = [System.Security.Cryptography.SHA256]::Create()
$buildId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($fingerprint)))).Replace('-','').ToLowerInvariant()
$marker = [ordered]@{
  build_id = $buildId
  built_at = (Get-Date).ToUniversalTime().ToString('o')
  plugin_version = ([IO.File]::ReadAllText((Join-Path $root 'workbench-ui-plugin/package.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json).version
  dsh_version = ([IO.File]::ReadAllText((Join-Path $runtime 'node_modules/@deepseek-ai/dsh/package.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json).version
}
$marker | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $profileStage 'runtime-build.json')
Set-Content -Encoding ASCII (Join-Path $root 'offline-3.0/runtime-web.build-id') $buildId

New-Item -ItemType Directory -Force -Path (Split-Path $archive) | Out-Null
if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
& tar.exe -a -c -f $archive -C $stage profiles
if ($LASTEXITCODE -ne 0) { throw "runtime zip 构建失败 exit=$LASTEXITCODE" }

$entry = Join-Path $stage 'profiles/web/node_modules/@deepseek-ai/dsh/lib/bin.js'
$plugin = Join-Path $stage 'profiles/web/node_modules/@workbench/client-ui/package.json'
if (-not (Test-Path $entry)) { throw "runtime 缺 DSH 引擎：$entry" }
if (-not (Test-Path $plugin)) { throw "runtime 缺工作台插件：$plugin" }

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
$bytes = (Get-Item -LiteralPath $archive).Length
Write-Host "RUNTIME_BUNDLE_OK $archive bytes=$bytes sha256=$hash"
Write-Host "RUNTIME_BUILD_ID $buildId"
