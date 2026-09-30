# scripts/workbench.ps1 — Universal Workbench 总控脚本（Windows PowerShell 7 优先，兼容 Windows PowerShell 5.1）
# 子命令：fetch | install | verify | repair | report | package   （015 §5）
# 硬规则：native 命令成败只认 $LASTEXITCODE（禁 try/catch 判定）；curl.exe；显式 UTF-8；空哈希=失败
[CmdletBinding()]
param(
  [ValidateSet('fetch','install','verify','repair','report','package')][string]$Cmd = 'fetch',
  [ValidateSet('P0','P1','P2','ALL')][string]$Tier = 'ALL',
  [ValidateSet('official','npmmirror','tencent')][string]$Mirror = 'official',
  [string]$Manifest = 'manifests/packages.manifest.csv',
  [string]$OutDir = 'offline', [string]$Reports = 'reports', [int]$Retry = 3,
  [string]$Package = ''
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }
# 3.0 修订（2026-09-29）：脚本自带 Set-Location 到项目根。postinstall（Inno [Run]）的 cwd 不保证是 {app}，
# 而 reports/ offline/ manifests/ 都是相对路径 → 此前安装器路径上日志会写错位置甚至直接抛错终止。
$Root = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $Root
$REG = @{ official='https://registry.npmjs.org'; npmmirror='https://registry.npmmirror.com'; tencent='https://mirrors.tencent.com/npm' }
$ALLOWED = @('registry.npmjs.org','registry.npmmirror.com','mirrors.tencent.com','github.com','codeload.github.com','objects.githubusercontent.com','nodejs.org')

function Test-AllowedHost([string]$Url){
  if ($Url -notmatch '^https?://') { return $false }
  $h = ([uri]$Url).Host
  if ($ALLOWED -notcontains $h) { return $false }
  if ($h -match '^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?)') { return $false }
  return $true
}
function Get-FileSha([string]$Path){
  $h = Get-FileHash -Algorithm SHA256 -LiteralPath $Path
  if (-not $h -or -not $h.Hash) { throw "EMPTY_HASH: $Path" }   # 空哈希=失败（014 P0-4）
  return $h.Hash.ToLower()
}
function Get-Rows {
  $lines = [IO.File]::ReadAllLines((Join-Path (Get-Location) $Manifest), (New-Object Text.UTF8Encoding($false))) |
           Where-Object { $_ -and $_ -notmatch '^tier,' }
  foreach($r in $lines){
    $c = $r -split ',(?=(?:[^"]*"[^"]*")*[^"]*$)', 17
    [pscustomobject]@{ tier=$c[0]; rank=$c[1]; name=$c[2]; npm=$c[3]; src=$c[4]; repo=$c[5]; ver=$c[6];
      role=$c[7]; ind=$c[9]; install=$c[10]; test=$c[11]; rver=$c[12]; tar=$c[13]; sha=$c[14]; status=$c[15]; note=$c[16] }
  }
}
function Write-Gap([string]$pkg,[string]$tier,[string]$reason,[string]$elem,[string]$alt){
  $p = Join-Path $Reports 'capability-gap.md'
  if (-not (Test-Path $p)) { "| 包名/能力 | 档 | 失败原因 | 影响要素 | 替代方案 |" | Set-Content -Encoding UTF8 $p }
  $line = (Get-Content $p -Raw) + "| $pkg | $tier | $reason | $elem | $alt |`n"
  Set-Content -Encoding UTF8 -Path $p -Value $line
}

# —— 安全断言：递归删除/移动前必须确认目标在 DSH_HOME 内（2026-09-30 事故后纪律）——
function Assert-UnderDshHome([string]$Path,[string]$DshHome){
  $p = [IO.Path]::GetFullPath($Path)
  $h = [IO.Path]::GetFullPath($DshHome)
  if (-not $p.StartsWith($h, [StringComparison]::OrdinalIgnoreCase)) { throw "拒绝操作 DSH_HOME 之外的路径：$p" }
  return $p
}

# —— runtime 刷新：备份旧 profile → 解压到暂存 → 原子换入 → 合并出厂 patch（R9）——
function Invoke-RuntimeRefresh([string]$Archive,[string]$BuildId,[string]$DshHome,[string]$Root){
  $ErrorActionPreference = 'Continue'
  $profile = Assert-UnderDshHome (Join-Path $DshHome 'profiles/web') $DshHome
  $stage = Assert-UnderDshHome (Join-Path $DshHome '.runtime-stage') $DshHome
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $stage | Out-Null
  & tar.exe -xf $Archive -C $stage
  if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue; return $LASTEXITCODE }
  $staged = Join-Path $stage 'profiles/web'
  if (-not (Test-Path (Join-Path $staged 'package.json'))) {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    return 2
  }
  $backup = Join-Path $Root ('.dsh-home.pre-r9-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $hadProfile = Test-Path -LiteralPath $profile
  if ($hadProfile) { Move-Item -LiteralPath $profile -Destination $backup }
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path $profile) | Out-Null
    Move-Item -LiteralPath $staged -Destination $profile
    $live = Join-Path $profile 'cordis.patch.yml'
    $presetText = if (Test-Path $live) { Get-Content -Raw $live } else { '' }
    if ($hadProfile) {
      $oldPatch = Join-Path $backup 'cordis.patch.yml'
      if (Test-Path -LiteralPath $oldPatch) { Copy-Item -LiteralPath $oldPatch -Destination $live -Force }
    }
    $existing = if (Test-Path -LiteralPath $live) { Get-Content -Raw $live } else { '' }
    if ($existing -notmatch 'welcomeNoticeVersion') {
      $merged = if ([string]::IsNullOrWhiteSpace($existing)) { $presetText } else { $existing.TrimEnd() + "`n" + $presetText }
      Set-Content -LiteralPath $live -Value $merged -Encoding UTF8
    }
    $marker = @{ build_id = $BuildId; refreshed_at = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json
    Set-Content -LiteralPath (Join-Path $profile 'runtime-build.json') -Value $marker -Encoding UTF8
  } catch {
    if (Test-Path -LiteralPath $profile) { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue }
    if ($hadProfile) { Move-Item -LiteralPath $backup -Destination $profile }
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    return 3
  }
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  return 0
}

switch ($Cmd) {

'fetch' {
  $work = Get-Rows | Where-Object { $_.src -in 'npm','github-source' }
  if ($Tier -ne 'ALL') { $work = $work | Where-Object tier -eq $Tier }
  $resolved = @(); $okCount = 0
  foreach($p in ($work | Sort-Object rank)){
    if ($p.src -eq 'github-source'){
      Write-Gap $p.name $p.tier 'npm E404（设计如此）；dev 分支 zip 实测 452MB→git clone --depth 1' '要素1' 'git clone https://github.com/zhu1090093659/dsh-web 后本地构建（人工可选）'
      $resolved += "$($p.npm),SKIP_GITHUB_SOURCE,,"; continue }
    $t = Join-Path $OutDir "npm/$($p.tar)"
    if ($p.status -eq 'PRESET_OK' -and (Test-Path $t)) {          # 预置层：只校验不联网
      $actual = Get-FileSha $t
      if ($actual -ne $p.sha.ToLower()) { Write-Gap $p.npm $p.tier "SHA256 不符（期望 $($p.sha.Substring(0,12))…）" '—' '重跑 download-all 或换镜像'; $resolved += "$($p.npm),HASH_MISMATCH,"; continue }
      $resolved += "$($p.npm),PRESET_OK,$actual"; $okCount++; continue }
    $ver = $null                                                   # 缺口层：允许联网
    for($i=0; $i -lt $Retry; $i++){
      $out = npm view "$($p.npm)@latest" version --registry $REG[$Mirror] 2>$null
      if ($LASTEXITCODE -eq 0 -and $out) { $ver = ("$out").Trim(); break }
    }
    if (-not $ver) { Write-Gap $p.npm $p.tier 'npm view 失败' '十要素映射待评' '登记降级'; $resolved += "$($p.npm),FAILED,"; continue }
    $url = "$($REG[$Mirror])/$($p.npm)/-/$(($p.npm -split '/')[-1])-$ver.tgz"
    if (-not (Test-AllowedHost $url)) { Write-Gap $p.npm $p.tier 'host 校验拒绝' '—' '换镜像'; $resolved += "$($p.npm),REJECTED_HOST,"; continue }
    $dest = Join-Path $OutDir ("npm/" + ($p.npm -replace '@','').Replace('/','-') + "-$ver.tgz")
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    $dl = $false
    for($i=0; $i -lt $Retry -and -not $dl; $i++){
      & curl.exe -L --fail --retry 2 -sS -o $dest $url
      if ($LASTEXITCODE -eq 0 -and (Test-Path $dest) -and (Get-Item $dest).Length -gt 0) { $dl = $true }
    }
    if (-not $dl) { Write-Gap $p.npm $p.tier '下载失败' '十要素映射待评' '重试/换镜像'; $resolved += "$($p.npm),FAILED,"; continue }
    $resolved += "$($p.npm),$ver,$(Get-FileSha $dest)"; $okCount++
  }
  $resolved | Set-Content -Encoding UTF8 'manifests/packages.manifest.resolved.csv'
  Get-ChildItem (Join-Path $OutDir 'npm') -Filter *.tgz | ForEach-Object { "$($_.Name)  $(Get-FileSha $_.FullName)" } |
    Set-Content -Encoding UTF8 (Join-Path $OutDir 'npm/SHA256SUMS.txt')
  "FETCH_DONE tier=$Tier ok=$okCount"
}

'install' {
  # 3.0 修复（2026-09-29 实装实测）：本分支内必须用 Continue。
  # Windows PowerShell 5.1 下，native 命令往 stderr 写一个字符（npm/pnpm 的 deprecation/进度警告）就会在
  # $ErrorActionPreference='Stop' 时升级为终止性 NativeCommandError（"npm warn deprec ... came from Write-Error"），
  # 脚本在安装第一步（npm i -g 引擎）即退出，profile 一个包都装不上。
  # 本文件顶部硬规则即"native 命令成败只认 $LASTEXITCODE"，故此处按该规则执行；关键结果另有显式断言。
  $ErrorActionPreference = 'Continue'
  $portable = Join-Path $Root 'offline/node/node-v24.21.0-win-x64'
  if (Test-Path (Join-Path $portable 'node.exe')) { $env:PATH = "$portable;$env:PATH" }   # 项目便携 Node（≥24.19）优先
  if (-not $env:DSH_HOME) { $env:DSH_HOME = Join-Path $Root '.dsh-home' }                  # 项目内独立 DSH_HOME（隔离）
  $profileWeb = Join-Path $env:DSH_HOME 'profiles/web'
  # 原生 3.0：优先解压构建期已解析的 runtime profile，目标机不再访问 npm/pnpm registry。
  $runtimeArchive = Join-Path $Root 'offline-3.0/runtime-web.zip'
  $runtimeBuildFile = Join-Path $Root 'offline-3.0/runtime-web.build-id'
  $runtimeMarker = Join-Path $profileWeb 'runtime-build.json'
  $runtimeEntry = Join-Path $profileWeb 'node_modules/@deepseek-ai/dsh/lib/bin.js'
  $expectedBuild = if (Test-Path $runtimeBuildFile) { (Get-Content -Raw $runtimeBuildFile).Trim() } else { '' }
  $installedBuild = if (Test-Path $runtimeMarker) {
    try { (Get-Content -Raw $runtimeMarker | ConvertFrom-Json).build_id } catch { '' }
  } else { '' }
  $runtimeNeedsExtract = (-not (Test-Path $runtimeEntry)) -or ($expectedBuild -and $expectedBuild -ne $installedBuild)
  if ($runtimeNeedsExtract -and (Test-Path $runtimeArchive)) {
    New-Item -ItemType Directory -Force -Path $env:DSH_HOME | Out-Null
    # R9：不再直接覆盖解压——改为「备份旧 profile → 暂存解压 → 原子换入 → 合并出厂 patch」，失败自动回滚
    $runtimeExtractExit = Invoke-RuntimeRefresh $runtimeArchive $expectedBuild $env:DSH_HOME $Root
  } else { $runtimeExtractExit = 0 }
  $installedBuild = if (Test-Path $runtimeMarker) {
    try { (Get-Content -Raw $runtimeMarker | ConvertFrom-Json).build_id } catch { '' }
  } else { '' }
  $runtimeMode = (Test-Path $runtimeEntry) -and ((-not $expectedBuild) -or ($expectedBuild -eq $installedBuild))
  $log = @(); $work = if ($runtimeMode) { @() } else { Get-Rows | Where-Object { $_.tier -in @('P0','P1') -and $_.src -eq 'npm' } }
  if ($Tier -in 'P0','P1') { $work = $work | Where-Object tier -eq $Tier }
  # 3.0 补（2026-09-29）：装出的产品里没有 reports/（不入安装包），而本分支要写 install-log.csv / capability-gap.md
  # → 缺目录时 Set-Content 直接抛错终止（$ErrorActionPreference='Stop'），安装会在第一步静默失败。
  New-Item -ItemType Directory -Force -Path $Reports | Out-Null
  $csv = Join-Path $Reports 'install-log.csv'
  Set-Content -Encoding UTF8 -Path $csv -Value "name,npm,method,exit,timestamp"

  # —— 第 0 步（3.0 补齐，2026-09-29）：pnpm 自举 ——
  # dsh plugin add/remove 是【转发给 PATH 上的 pnpm】的（engine lib/bin.js → execa('pnpm')）。
  # 此前离线包不含 pnpm（只有 corepack shims，离线不可用）→ 干净机 postinstall 全部 exit 127：
  #   "dsh: pnpm was not found; install pnpm and make it available on PATH."
  # 随包 offline/npm/pnpm-<ver>.tgz 离线装入便携 Node 全局前缀（{app}\offline\node\...），无需网络。
  if ($runtimeMode) {
    $log += 'runtime-web,RUNTIME_BUNDLE'
    Add-Content -Encoding UTF8 $csv "runtime-web,runtime-web.zip,tar-extract,$runtimeExtractExit,$(Get-Date -Format s)"
  } elseif (-not (Get-Command pnpm -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $portable 'pnpm.cmd'))) {
    $pnpmTgz = Get-ChildItem (Join-Path $Root "$OutDir/npm") -Filter 'pnpm-*.tgz' -ErrorAction SilentlyContinue |
               Sort-Object Name -Descending | Select-Object -First 1
    if ($pnpmTgz) {
      & cmd /c ("npm i -g " + "`"$($pnpmTgz.FullName)`"") 2>&1 | Out-Null
      $rcPnpm = $LASTEXITCODE
      $pnpmOk = (Test-Path (Join-Path $portable 'pnpm.cmd'))     # 不依赖 Get-Command 缓存（同会话新建文件它看不到）
      Add-Content -Encoding UTF8 $csv "pnpm,$($pnpmTgz.Name),npm-i-g-offline-tgz,$rcPnpm,$(Get-Date -Format s)"
      $log += "pnpm,$(if ($pnpmOk) { 'PASS' } else { "FAIL(exit=$rcPnpm)" })"
      if (-not $pnpmOk) { Write-Gap 'pnpm' 'P0' "自举失败 exit=$rcPnpm" '—' '检查 offline/npm/pnpm-*.tgz 与便携 Node 的 npm' }
    } else {
      $log += 'pnpm,MISSING'; Add-Content -Encoding UTF8 $csv "pnpm,none,missing-tarball,127,$(Get-Date -Format s)"
      Write-Gap 'pnpm' 'P0' 'offline/npm 缺 pnpm-*.tgz' '—' '补入 pnpm tarball 并更新 SHA256SUMS.txt'
    }
  } else { $log += 'pnpm,PRESENT' }
  foreach($p in ($work | Sort-Object rank)){
    $t = Join-Path $Root "$OutDir/npm/$($p.tar)"   # 绝对路径：相对路径会被 pnpm 解析到 profiles/web/ 下 → ENOENT（3.0 实测根因）
    $method = 'dsh-plugin-add-web'; $rc = 0
    if (-not (Test-Path $t)) { Write-Gap $p.npm $p.tier 'tarball 缺失' '—' '先跑 fetch'; $log += "$($p.name),GAP"; Add-Content -Encoding UTF8 $csv "$($p.name),$($p.npm),none,127,$(Get-Date -Format s)"; continue }
    if ($p.npm -eq '@deepseek-ai/dsh') {
      # 016 §2 重锁：引擎只从离线 tarball 安装（禁 registry 降级）；装后断言 ≥0.1.2
      $method = 'npm-i-g-offline-tgz'
      & cmd /c ("npm i -g " + "`"$t`"") 2>&1 | Out-Null; $rc = $LASTEXITCODE
      if ($rc -eq 0) { $v = (& dsh --version 2>$null | Select-Object -First 1)
        $ok = ($v -match '^\d') -and ([version](([regex]::Match($v,'^\d+\.\d+\.\d+').Value))) -ge [version]'0.1.2'
        if (-not $ok) { $rc = 9 } }
    } else {
      Get-ChildItem $profileWeb -Filter 'package.json.lock' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
      Get-ChildItem $profileWeb -Filter '.lock.takeover-*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue   # 陈旧写者锁 → add 超时 exit 1（3.0 实测根因）
      & cmd /c ("dsh plugin --profile web add " + "`"$t`"") 2>&1 | Out-Null; $rc = $LASTEXITCODE
    }
    if ($rc -eq 0) { $log += "$($p.name),PASS"; Add-Content -Encoding UTF8 $csv "$($p.name),$($p.npm),$method,0,$(Get-Date -Format s)"
      if (Get-Command git -ErrorAction SilentlyContinue) { git tag "v1.$($p.rank)-$($p.name)-ok" 2>$null } }   # 无 git 时由哈希链兜底（§4.3）；且不因 git 缺失在安装日志里刷 CommandNotFound
    else { $log += "$($p.name),FAIL(exit=$rc)"; Add-Content -Encoding UTF8 $csv "$($p.name),$($p.npm),$method,$rc,$(Get-Date -Format s)"; Write-Gap $p.npm $p.tier "install exit=$rc" '—' 'workbench repair 或登记降级' }
  }

  # —— 第 9 步（3.0 补齐，2026-09-29）：工作台插件 @workbench/client-ui 装入 profile ——
  # 该插件此前只存在于开发机的手工 link（.dsh-home/profiles/web），安装包与安装流程都不含它 →
  # 装出的产品没有 ⟡ 工作台 面板、/workbench/api/app-page 404、launch.ps1 退化成壳首页。
  # 随包目录 {app}\workbench-ui-plugin，以 link: 装载（改 lib/*.js 后重启壳即生效）。
  $wbPlugin = Join-Path $Root 'workbench-ui-plugin'
  if ($runtimeMode) {
    $linked = Test-Path (Join-Path $profileWeb 'node_modules/@workbench/client-ui/package.json')
    $pkgJson = Join-Path $profileWeb 'package.json'
    $inBundles = (Test-Path $pkgJson) -and ((Get-Content -Raw $pkgJson) -match '@workbench/client-ui')
    if ($linked -and $inBundles) {
      $log += 'workbench-client-ui,RUNTIME_BUNDLE'
      Add-Content -Encoding UTF8 $csv "@workbench/client-ui,runtime-bundle,offline-extract,0,$(Get-Date -Format s)"
    } else {
      $log += "workbench-client-ui,FAIL(runtime-linked=$linked bundles=$inBundles)"
      Write-Gap '@workbench/client-ui' 'P0' "runtime bundle 缺插件或激活清单 linked=$linked bundles=$inBundles" 'F1/U15' '重建 offline-3.0/runtime-web.zip'
    }
  } elseif (-not (Test-Path (Join-Path $wbPlugin 'package.json'))) {
    $log += 'workbench-client-ui,MISSING'
    Add-Content -Encoding UTF8 $csv "@workbench/client-ui,link,missing-source,127,$(Get-Date -Format s)"
    Write-Gap '@workbench/client-ui' 'P0' '安装目录缺 workbench-ui-plugin/' 'F1/U15' '检查安装包 [Files] 是否含插件目录'
  } else {
    if (-not (Test-Path $profileWeb)) { New-Item -ItemType Directory -Force -Path $profileWeb | Out-Null }
    Get-ChildItem $profileWeb -Filter 'package.json.lock' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem $profileWeb -Filter '.lock.takeover-*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    & cmd /c ("dsh plugin --profile web add " + "`"$wbPlugin`"") 2>&1 | Out-Null; $rcw = $LASTEXITCODE
    # 硬断言（禁止静默成功）：link 必须真实落在 node_modules，且已登记进 profile 激活清单 dsh.profile.bundles
    $linked  = Test-Path (Join-Path $profileWeb 'node_modules/@workbench/client-ui/package.json')
    $pkgJson = Join-Path $profileWeb 'package.json'
    $inBundles = (Test-Path $pkgJson) -and ((Get-Content -Raw $pkgJson) -match '@workbench/client-ui')
    if ($rcw -eq 0 -and $linked -and $inBundles) {
      $log += 'workbench-client-ui,PASS'
      Add-Content -Encoding UTF8 $csv "@workbench/client-ui,link,dsh-plugin-add-web,0,$(Get-Date -Format s)"
    } else {
      $log += "workbench-client-ui,FAIL(exit=$rcw linked=$linked bundles=$inBundles)"
      Add-Content -Encoding UTF8 $csv "@workbench/client-ui,link,dsh-plugin-add-web,$rcw,$(Get-Date -Format s)"
      Write-Gap '@workbench/client-ui' 'P0' "install exit=$rcw linked=$linked bundles=$inBundles" 'F1/U15' '手工 dsh plugin --profile web add <插件目录>'
    }
  }
  $log | Set-Content -Encoding UTF8 (Join-Path $Reports 'install-log.md')
  "INSTALL_DONE"
}

'verify' {
  $ErrorActionPreference = 'Continue'   # runner-probe 是 native 调用：同 install 的 5.1 stderr 陷阱
  New-Item -ItemType Directory -Force -Path $Reports | Out-Null   # 装出的产品无 reports/（3.0 补）
  $lines = @('# 十要素机械检查矩阵','','| # | 要素 | 判定 | 证据 |','|---|---|---|---|')
  $elem = @(
    @('工作空间','workspace/ 16 子目录存在'), @('Agent OS','dsh --version 通过'), @('专业 Skills','templates/skills-domain 数量=13'),
    @('工具连接器','excel/docs panel tarball 就位'), @('数据/知识','Type-Dict 行数>40'),
    @('任务编排','workflows YAML 数量≥24'), @('人机审批','approval 包 PRESET_OK'), @('产物管理','reports/ 可写'),
    @('工作记忆','memory 包 PRESET_OK'), @('审计追踪','tag-manifest.csv 存在'))
  for($i=0; $i -lt 10; $i++){ $lines += "| $($i+1) | $($elem[$i][0]) | TODO-实测 | $($elem[$i][1]) |" }
  $lines += '', '> 注：本命令生成矩阵骨架；每格 TODO 由 install/冒烟实测后改为 PASS/FAIL（010-02 口径：不接受部分通过）。'
  $lines | Set-Content -Encoding UTF8 (Join-Path $Reports 'ten-elements-matrix.md')
  # 3.0 补（2026-09-29）：合约 §10.1 ⑥ 要求首启自检含 runner-probe → 产出 runner-profile.json（F11 报告的一部分）。
  # 此前 verify 只写矩阵骨架，runner-profile.json 从不出现在装出的产品里。best-effort：探针失败不影响自检产物。
  $probe = Join-Path $Root 'scripts/runner-probe.ps1'
  if (Test-Path $probe) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $probe 2>&1 | Out-Null
    if (Test-Path (Join-Path $Root 'runner-profile.json')) { "RUNNER_PROBE_DONE → runner-profile.json" }
    else { "RUNNER_PROBE_SKIPPED（探针未产出 runner-profile.json，不阻断自检）" }
  }
  "VERIFY_SKELETON_DONE（实测项由 S6 冒烟回填）"
}

'repair' {
  if (-not $Package) { throw 'repair 需要 -Package <name>' }
  $ErrorActionPreference = 'Continue'   # 同 install：native stderr 不得升级为终止错误（5.1 陷阱）
  $portable = Join-Path $Root 'offline/node/node-v24.21.0-win-x64'
  if (Test-Path (Join-Path $portable 'node.exe')) { $env:PATH = "$portable;$env:PATH" }
  if (-not $env:DSH_HOME) { $env:DSH_HOME = Join-Path $Root '.dsh-home' }
  $profileWeb = Join-Path $env:DSH_HOME 'profiles/web'
  & cmd /c "npm cache clean --force" 2>$null
  # 工作台插件（@workbench/client-ui）不在 packages.manifest.csv 里：它是随包目录，不是 npm tarball 行
  if ($Package -eq '@workbench/client-ui') {
    $t = Join-Path $Root 'workbench-ui-plugin'
    if (-not (Test-Path (Join-Path $t 'package.json'))) { throw "缺少 $t" }
  } else {
    $p = Get-Rows | Where-Object npm -eq $Package
    if (-not $p) { throw "manifest 中找不到 $Package" }
    $t = Join-Path $Root "$OutDir/npm/$($p.tar)"   # 绝对路径（3.0 实测根因修复）
  }
  Get-ChildItem $profileWeb -Filter 'package.json.lock' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem $profileWeb -Filter '.lock.takeover-*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  & cmd /c ("dsh plugin --profile web add " + "`"$t`"") 2>&1 | Out-Null
  "REPAIR_DONE exit=$LASTEXITCODE（结果入 reports/repair-log.md，复测走 verify）"
  "$Package,repair,exit=$LASTEXITCODE,$(Get-Date -Format s)" | Add-Content -Encoding UTF8 (Join-Path $Reports 'repair-log.md')
}

'report' {
  New-Item -ItemType Directory -Force -Path $Reports | Out-Null   # 装出的产品无 reports/（3.0 补）
  $rep = Join-Path $Reports 'workbench-report.md'
  @('# Universal Workbench 交付自评报告','',"- 生成时间：$(Get-Date -Format s)",
    "- 预置层校验：见 offline/npm/SHA256SUMS.txt","- 安装日志：reports/install-log.md",
    "- 十要素矩阵：reports/ten-elements-matrix.md","- 能力缺口：reports/capability-gap.md",
    "- Runner 档案：runner-profile.json（由 runner-probe 产出）",
    '', '## 评分（015 §11.2）','', '五维百分制自评 + 22 类缺陷清零表 + 一票否决 V1-V8 + CR 覆盖率 100%。',
    '每行必须引用证据文件路径；无证据按 0 分。','') | Set-Content -Encoding UTF8 $rep
  "REPORT_DONE → $rep"
}

'package' {
  $ErrorActionPreference = 'Continue'   # ISCC 往 stderr 写编译进度；同 install 的 5.1 陷阱
  $tauriBuilder = Join-Path $Root 'scripts/build-tauri.ps1'
  if (Test-Path $tauriBuilder) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tauriBuilder
    if ($LASTEXITCODE -ne 0) { Write-Error "TAURI_BUILD_FAILED exit=$LASTEXITCODE"; exit $LASTEXITCODE }
  }
  & cmd /c ("iscc scripts\installer\win\setup.iss") 2>&1 | Out-Null
  "PACKAGE_WIN exit=$LASTEXITCODE（macOS 侧：bash scripts/installer/mac/build_dmg.sh，见 015 §10）"
}

default { throw "unknown cmd $Cmd" }
}
