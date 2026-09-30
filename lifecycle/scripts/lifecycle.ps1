#Requires -Version 5.1
<#
.SYNOPSIS
    包全生命周期演练（Windows / PowerShell）：安装 -> 功能调用 -> 卸载 -> 残留清零
.EXAMPLE
    pwsh -File .\scripts\lifecycle.ps1
    pwsh -File .\scripts\lifecycle.ps1 -Pkg jsonschema -Ver 4.23.0 -KeepEnvironment
.NOTES
    全程在隔离 venv 内执行，不触碰全局站点包；证据写入 <Root>\evidence\。
#>
[CmdletBinding()]
param(
    [string]$Root   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string]$Pkg    = 'jsonschema',
    [string]$Ver    = '4.23.0',
    [string]$Python = 'python',
    [switch]$KeepEnvironment
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$Evidence = Join-Path $Root 'evidence'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
$Log  = Join-Path $Evidence 'timeline.log'
$Venv = Join-Path $Root '.venv'
$Py   = Join-Path $Venv 'Scripts\python.exe'
$script:Failures = 0

function Step([string]$Id, [string]$Title) {
    $line = '[{0}] {1} {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Id, $Title
    Write-Host $line -ForegroundColor Cyan
    Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
}
function Note([string]$Text) { if ($Text) { Add-Content -LiteralPath $Log -Value $Text -Encoding UTF8 } }
function Pass([string]$Text) { Write-Host "  PASS  $Text" -ForegroundColor Green; Note "PASS  $Text" }
function Fail([string]$Text) { Write-Host "  FAIL  $Text" -ForegroundColor Red; Note "FAIL  $Text"; $script:Failures++ }

function Run([string]$File, [string[]]$Arguments) {
    Note ("CMD> $File " + ($Arguments -join ' '))
    $raw  = & $File @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = ($raw | Out-String).Trim()
    Note $text
    [pscustomobject]@{ Text = $text; Code = $code }
}

function Get-Freeze {
    $r = Run $Py @('-m', 'pip', 'freeze')
    ($r.Text -split "`r?`n") | Where-Object { $_ } | Sort-Object
}

# ---------------------------------------------------------------- S0 前置检查
Step 'S0' '前置检查：解释器可用性'
$v = Run $Python @('-V')
if ($v.Code -ne 0) { Fail "Python 解释器不可用：$Python"; exit 1 }
$v.Text | Set-Content -LiteralPath (Join-Path $Evidence 'python-version.txt') -Encoding UTF8
Pass "解释器可用：$($v.Text)"

# ---------------------------------------------------------------- S1 隔离环境
Step 'S1' '创建隔离环境（venv），规避全局污染'
if (-not (Test-Path $Py)) {
    $r = Run $Python @('-m', 'venv', $Venv)
    if ($r.Code -ne 0) { Fail 'venv 创建失败'; exit 1 }
}
if (Test-Path $Py) { Pass "venv 就绪：$Venv" } else { Fail "venv 缺少解释器：$Py"; exit 1 }

# ---------------------------------------------------------------- S2 基线快照
Step 'S2' '采集安装前依赖基线'
$before = Get-Freeze
$before | Set-Content -LiteralPath (Join-Path $Evidence 'freeze.before-install.txt') -Encoding UTF8
Pass "基线依赖数：$($before.Count)"

# ---------------------------------------------------------------- S3 安装
Step 'S3' "安装目标包（精确锁定 $Pkg==$Ver）"
$r = Run $Py @('-m', 'pip', 'install', "$Pkg==$Ver")
$r.Text | Set-Content -LiteralPath (Join-Path $Evidence 'install.log') -Encoding UTF8
if ($r.Code -eq 0) { Pass "安装成功：$Pkg==$Ver" } else { Fail "安装失败，退出码 $($r.Code)" }

# ---------------------------------------------------------------- S4 安装校验
Step 'S4' '安装校验：版本 / 安装路径 / 依赖树'
$show = Run $Py @('-m', 'pip', 'show', $Pkg)
$show.Text | Set-Content -LiteralPath (Join-Path $Evidence 'pip-show.txt') -Encoding UTF8
$lines    = $show.Text -split "`r?`n"
$gotVer   = ($lines | Where-Object { $_ -like 'Version:*' })  -replace '^Version:\s*', ''
$location = ($lines | Where-Object { $_ -like 'Location:*' }) -replace '^Location:\s*', ''
$requires = ($lines | Where-Object { $_ -like 'Requires:*' }) -replace '^Requires:\s*', ''
if ($gotVer -eq $Ver) { Pass "版本号一致：$gotVer" } else { Fail "版本号不一致：期望 $Ver，实际 '$gotVer'" }
if ($location -and $location.StartsWith($Venv, 'OrdinalIgnoreCase')) { Pass "已隔离在 venv 内：$location" } else { Fail "安装位置未隔离：'$location'" }
Pass "传递依赖：$requires"

# ---------------------------------------------------------------- S5 功能调用
Step 'S5' '功能调用：正例 / 反例双跑（业务契约校验）'
$script   = Join-Path $Root 'src\validate_payload.py'
$fixtures = Join-Path $Root 'fixtures'
$schema   = Join-Path $fixtures 'schema.order.json'

$ok = Run $Py @($script, '--schema', $schema, '--payload', (Join-Path $fixtures 'payload.valid.json'))
$ok.Text | Set-Content -LiteralPath (Join-Path $Evidence 'call.valid.out') -Encoding UTF8
if ($ok.Code -eq 0 -and $ok.Text -match '^VALID') { Pass '正例通过：exit=0 / VALID' } else { Fail "正例未通过：exit=$($ok.Code)" }

$bad = Run $Py @($script, '--schema', $schema, '--payload', (Join-Path $fixtures 'payload.invalid.json'))
$bad.Text | Set-Content -LiteralPath (Join-Path $Evidence 'call.invalid.out') -Encoding UTF8
$expect = @('amount', 'buyer/email', 'debug', 'items', 'order_id')
$hit    = @($expect | Where-Object { $bad.Text -match [regex]::Escape($_) })
if ($bad.Code -eq 1 -and $hit.Count -eq $expect.Count) {
    Pass "反例通过：exit=1 / 错误定位命中 $($hit.Count)/$($expect.Count)"
} else {
    Fail "反例不符合预期：exit=$($bad.Code)，命中 $($hit.Count)/$($expect.Count)"
}

# ---------------------------------------------------------------- S6 卸载
Step 'S6' "卸载目标包"
$u = Run $Py @('-m', 'pip', 'uninstall', '-y', $Pkg)
$u.Text | Set-Content -LiteralPath (Join-Path $Evidence 'uninstall.log') -Encoding UTF8
if ($u.Code -eq 0) { Pass "卸载指令成功：$Pkg" } else { Fail "卸载失败，退出码 $($u.Code)" }

Step 'S7' '卸载校验：模块必须不可导入'
$imp = Run $Py @('-c', 'import jsonschema')
if ($imp.Code -ne 0) { Pass 'import 失败，符合预期（ModuleNotFoundError）' } else { Fail '目标包仍可导入，卸载未生效' }

# ---------------------------------------------------------------- S8 残留清零
Step 'S8' '残留清算：传递依赖不得留痕'
$after    = Get-Freeze
$after | Set-Content -LiteralPath (Join-Path $Evidence 'freeze.after-uninstall.txt') -Encoding UTF8
$residual = @(Compare-Object -ReferenceObject $before -DifferenceObject $after |
              Where-Object SideIndicator -eq '=>' | Select-Object -ExpandProperty InputObject)
$residual | Set-Content -LiteralPath (Join-Path $Evidence 'residual.after-uninstall.txt') -Encoding UTF8
if ($residual.Count -eq 0) {
    Pass '无残留，冻结清单与基线一致'
} else {
    Write-Host "  发现 $($residual.Count) 个残留：$($residual -join ', ')" -ForegroundColor Yellow
    Note "残留清单：$($residual -join ', ')"
    $names = @($residual | ForEach-Object { ($_ -split '==')[0] })
    $c = Run $Py @(@('-m', 'pip', 'uninstall', '-y') + $names)
    $c.Text | Set-Content -LiteralPath (Join-Path $Evidence 'residual-clean.log') -Encoding UTF8
    $final = Get-Freeze
    $still = @(Compare-Object -ReferenceObject $before -DifferenceObject $final |
               Where-Object SideIndicator -eq '=>' | Select-Object -ExpandProperty InputObject)
    if ($still.Count -eq 0) { Pass "残留已清零（清理 $($names.Count) 个独占依赖）" } else { Fail "仍残留：$($still -join ', ')" }
}

# ---------------------------------------------------------------- S9 终局清理
Step 'S9' '销毁演示环境（隔离环境的最终零残留证明）'
if ($KeepEnvironment) {
    Pass "保留环境（-KeepEnvironment）：$Venv"
} else {
    Remove-Item -LiteralPath $Venv -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $Venv) { Fail 'venv 删除失败' } else { Pass 'venv 已删除，宿主机零残留' }
}

$verdict = if ($script:Failures -eq 0) { 'PASS' } else { 'FAIL' }
Note "VERDICT $verdict failures=$($script:Failures)"
Write-Host "`n=== VERDICT: $verdict (failures=$($script:Failures)) ===" -ForegroundColor $(if ($verdict -eq 'PASS') { 'Green' } else { 'Red' })
exit $(if ($verdict -eq 'PASS') { 0 } else { 1 })
