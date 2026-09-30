# 终端指令 · 版本锁定 + 手动下载 + 文档/视频交付冒烟（Windows PowerShell / macOS Terminal）

> 配套 015 任务书与 BUNDLE-INDEX。锁定版本：**pi = 0.87.1**（@earendil-works/pi-coding-agent）、**dsh = 0.1.5-rc.3**（@deepseek-ai/dsh）、Node ≥24.19 LTS（离线包 offline/node/；实测 latest-v24.x=v24.21.0，满足 pi-vault-mind engines）。所有命令可直接整段复制执行；`#` 开头为注释。安全约定：仅 http/https；下载只指向 registry.npmjs.org / nodejs.org / github.com 官方主机。

## 0. 版本锁定核验（两平台相同意图）

```powershell
# Windows PowerShell 7 或 5.1
npm view "@earendil-works/pi-coding-agent@0.87.1" dist.tarball
npm view "@deepseek-ai/dsh@0.1.5-rc.3" dist.tarball
```
```bash
# macOS Terminal
npm view "@earendil-works/pi-coding-agent@0.87.1" dist.tarball
npm view "@deepseek-ai/dsh@0.1.5-rc.3" dist.tarball
```

## 1. 下载锁定引擎（备用离线 tarball）

```powershell
# Windows —— 在 universal-workbench-bundle 目录执行
mkdir offline\engines -Force
curl.exe -L --fail -o offline\engines\earendil-works-pi-coding-agent-0.87.1.tgz "https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-0.87.1.tgz"
curl.exe -L --fail -o offline\engines\deepseek-ai-dsh-0.1.5-rc.3.tgz "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.5-rc.3.tgz"
Get-FileHash offline\engines\*.tgz -Algorithm SHA256
# 期望：pi  1423EE3C61E7C96464E1CBF3C8DC24D3056CB3410995C3671A98C3ECC527540F
#       dsh 4977D29233A5928A4EF1C16E44BDC19D77BBF38F16823D54EC87C5B0198830BF
```
```bash
# macOS —— 在 universal-workbench-bundle 目录执行
mkdir -p offline/engines
curl -L --fail -o offline/engines/earendil-works-pi-coding-agent-0.87.1.tgz "https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-0.87.1.tgz"
curl -L --fail -o offline/engines/deepseek-ai-dsh-0.1.5-rc.3.tgz "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.5-rc.3.tgz"
shasum -a 256 offline/engines/*.tgz   # 期望值同上（小写）
```

## 2. 下载全部插件包（P0/P1 核心 24 + 目录层 155，已核验锁定）

```powershell
# Windows —— 一键（幂等，重跑只补缺失）
pwsh -File scripts\download-all.ps1          # 核心 + Node 24 LTS 离线安装器（latest-v24.x=v24.21.0） + dsh-web 浅克隆
node scripts/download-catalog.mjs             # 目录层 155 包（含文档/视频/KG 全量）
```
```bash
# macOS
bash scripts/download-all.sh                  # 同上
node scripts/download-catalog.mjs
```

## 3. 安装锁定版本（引擎 + 桌面插件）

```powershell
# Windows
npm i -g ".\offline\engines\earendil-works-pi-coding-agent-0.87.1.tgz"
npx -y --package "@deepseek-ai/dsh@0.1.5-rc.3" dsh --version        # 必须 ≥0.1.2（CVE-2026-82533 红线）
dsh plugin --profile web add ".\offline\npm\pi2dsh-0.25.2.tgz"; 重启 dsh
dsh plugin --profile web add ".\offline\npm\dsh-better-sidebar-0.21.1.tgz"
dsh plugin --profile web add ".\offline\npm\dsh-ppt-0.5.0.tgz"
dsh plugin --profile web add ".\offline\npm\dsh-office-tools-1.0.4.tgz"
dsh plugin --profile web add ".\offline\npm\dsh-univer-office-0.3.5.tgz"
dsh plugin --profile web add ".\offline\npm\dsh-excel-panel-0.6.1.tgz"
dsh plugin --profile web add ".\offline\npm\dsh-docs-panel-0.1.0.tgz"
```
```bash
# macOS
npm i -g ./offline/engines/earendil-works-pi-coding-agent-0.87.1.tgz
npx -y --package "@deepseek-ai/dsh@0.1.5-rc.3" dsh --version
dsh plugin --profile web add ./offline/npm/pi2dsh-0.25.2.tgz && 重启 dsh
dsh plugin --profile web add ./offline/npm/dsh-better-sidebar-0.21.1.tgz
dsh plugin --profile web add ./offline/npm/dsh-ppt-0.5.0.tgz
dsh plugin --profile web add ./offline/npm/dsh-office-tools-1.0.4.tgz
dsh plugin --profile web add ./offline/npm/dsh-univer-office-0.3.5.tgz
dsh plugin --profile web add ./offline/npm/dsh-excel-panel-0.6.1.tgz
dsh plugin --profile web add ./offline/npm/dsh-docs-panel-0.1.0.tgz
```

## 4. 系统级文档/视频工具（交付链外部依赖）

```powershell
# Windows（管理员）
winget install Gyan.FFmpeg          # 视频转码/剪辑/字幕/合成
winget install yt-dlp.yt-dlp        # 视频下载
winget install JohnMacFarlane.Pandoc # md↔docx↔pptx↔pdf 万能转换
pip install markitdown-mcp md-exporter  # Office→MD / MD→DOCX/HTML/PDF/PNG/SVG/PPTX/XLSX
```
```bash
# macOS
brew install ffmpeg yt-dlp pandoc
pip3 install markitdown-mcp md-exporter
```

## 5. 文档/视频交付冒烟（逐格式验证，结果写入 reports/doc-delivery-smoke.md）

| 格式 | 冒烟任务（对 Agent 说） | 期望产物 |
|---|---|---|
| pptx | "把 reports/rec/ 漏斗周报转成 10 页 PPTX（含演讲者备注）" | .pptx 可打开可编辑（dsh-ppt） |
| xlsx | "生成 Q4 招聘预算表（真实结构 xlsx，含公式）" | .xlsx 公式可见可编辑（dsh-excel-panel/univer） |
| docx | "生成本周工作周报 docx" | .docx 可打开（dsh-office-tools/pandoc） |
| html | "把 30 天计划转成单页 HTML 放映" | .html 浏览器可开（dsh-ppt/genui） |
| md | "把会议纪要转 Markdown 并回转 docx" | 双向转换成功（markitdown/pandoc） |
| pdf | "把漏斗周报转成 A4 版式 PDF" | .pdf 可检索（pi-pdf/pandoc；旧 scope 需 --legacy-peer-deps） |
| video | "把 PPTX 放映录屏为 30 秒 mp4，加字幕" | .mp4 时长 >10s 可播放（ffmpeg 路由） |

## 6. 兼容性筛选结论（对照锁定版本，详见 manifests/compat-screening.csv）

- ✅ 精确适配锁定 dsh 0.1.5-rc.3：`dsh-univer-office`（peer 逐字命中 ^0.1.5-rc.3）
- ✅ 适配：`dsh-ppt` / `dsh-office-tools` / `dsh-excel-panel` / `dsh-docs-panel` / `dsh-genui` / `pi-markdown-preview` / `pi-agent-pi-markitdown`
- ⚠️ 有条件：`@joemccann/pi-pdf`（旧 scope `@mariozechner/*`，安装加 `--legacy-peer-deps`）；~~`pi-vault-mind`~~（Node 基线已改锁 24.19 LTS→**条件解除，转为适配-推荐**）
- ❌ 弃用改路由：npm `markitdown`（占位包）→ 真身 `pip install markitdown-mcp`
- ❌ 视频生成：无 npm 包（V8）→ ffmpeg/yt-dlp + PPTX 放映录屏路由，`cap.doc.video-gen` 登记扩展位
