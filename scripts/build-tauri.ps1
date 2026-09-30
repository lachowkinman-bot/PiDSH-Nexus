$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
  Write-Error 'CARGO_MISSING：需要 Rust 工具链构建原生壳'
  exit 1
}

Push-Location (Join-Path $root 'src-tauri')
try {
  & cargo build --release
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($code -ne 0) {
  Write-Error "TAURI_BUILD_FAILED exit=$code"
  exit $code
}

$exe = Join-Path $root 'src-tauri\target\release\universal-workbench.exe'
if (-not (Test-Path $exe)) {
  Write-Error "TAURI_OUTPUT_MISSING $exe"
  exit 1
}
$hash = (Get-FileHash -Algorithm SHA256 $exe).Hash
Write-Host "TAURI_BUILD_OK $exe bytes=$((Get-Item $exe).Length) sha256=$hash"
