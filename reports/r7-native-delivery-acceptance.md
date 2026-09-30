# R7 原生桌面与全格式交付验收

日期：2026-09-30

## 1. 结论

- Windows 原生桌面壳已实现并实装：Tauri 2 + 系统 WebView2，桌面快捷方式直接指向 `UniversalWorkbench.exe`。
- 主驾驶舱与 13 个域驾驶舱可在同一应用中使用；UI 与交付按钮验收 `23/23 PASS`。
- 13 域 × 7 格式的公开交付矩阵在直接调用和已安装 HTTP 实例两种模式下均为 `117/117 PASS`，共验证 91 个公开文件。
- 每个域生成 `report.md`、`data.csv`、`report.html`、`data.xlsx`、`report.docx`、`deck.pptx`、`report.pdf`，并附内部 `manifest.json`。
- 聊天工具 `workbench_deliver` 已注册并在真实 Agent 会话中调用成功，生成了 Markdown 与 DOCX 实物。
- 严格离线路径已改为预解析 runtime profile：目标机只解压 `runtime-web.zip`，不再依赖 npm/pnpm registry。

## 2. 关键产物

| 产物 | 路径/版本 | 字节数 | SHA-256 |
|---|---|---:|---|
| 原生壳 EXE | `src-tauri/target/release/universal-workbench.exe`，Tauri 2.12 / Rust | 3,185,664 | `E65128FD7B5EEE331D4E97B3F768C4513DD3C3FDBA0CC71665DCC873D9C0736D` |
| 离线 runtime | `offline-3.0/runtime-web.zip`，DSH 0.1.7-rc.2 + 工作台插件 3.0.0 | 163,857,655 | `57AE4AD21C3A95A803B8FDD08952849F324EE08EC649373B4120F1F19CB07C32` |
| 最终安装包 | `installer-output/UniversalWorkbench-Setup.exe` | 216,744,087 | `7EE0FBAD573A10C86B1FE30670FD085814AF86A7F1420CB9D980E45E37A35F4F` |

## 3. 新增实现

- `src-tauri/`：单实例原生窗口；选择 3080-3090 端口；启动/复用本机 DSH；仅回收自己启动的 Node 子进程；首次启动可自解压离线 runtime。
- `workbench-ui-plugin/src/delivery-service.mjs`：统一交付服务，驾驶舱 HTTP 与聊天工具共用。
- `workbench-ui-plugin/lib/delivery-service.cjs`：构建期内联 `exceljs`、`docx`、`pdfkit`、`marked`，运行期无需 npm registry。
- `manifests/domain-delivery.json`：13 域主表、辅助表、代表工作流和格式声明。
- `assets/fonts/NotoSansCJKsc-Regular.otf`：PDF 中文嵌入字体，SIL OFL 1.1。
- `assets/dsh-ppt/deck-core.mjs`：PPTX/HTML 演示文稿生成引擎，MIT。
- `scripts/verify-delivery-matrix.mjs`：91 文件、OOXML/PDF/CSV/Markdown/内容守恒与 LibreOffice 重读验收。
- `scripts/verify-delivery-ui.mjs`：主驾驶舱、13 域驾驶舱、生成全部格式与下载按钮 UI 验收。
- `scripts/build-runtime-bundle.ps1`：生成可完全离线解压的 DSH runtime profile。

## 4. 验收证据

| 门禁 | 结果 | 证据 |
|---|---|---|
| 直接交付矩阵 | `117/117 PASS` | `reports/delivery-matrix-direct.json` |
| 已安装实例 HTTP 交付矩阵 | `117/117 PASS` | `reports/delivery-matrix-installed.json` |
| 驾驶舱 UI 旅程 | `23/23 PASS` | `reports/delivery-ui-installed.json` |
| 安装实例综合自检 | `45/45 PASS` | `reports/app-verification-installed-r7.json` |
| 聊天工具注册 | PASS | 安装实例审计含 `tool.register workbench_deliver ok=true` |
| 聊天工具实调 | PASS | exec session `session-b6d53f71-5690-4c4b-a408-23bad1c132af`，实际生成 admin 域 MD/DOCX |
| 离线安装分支 | exit 0 | 黑洞代理 + 空 `DSH_HOME`；日志仅 `runtime-web,RUNTIME_BUNDLE` 与 `workbench-client-ui,RUNTIME_BUNDLE` |
| 桌面快捷方式 | 原生 EXE | `%USERPROFILE%\Desktop\Universal Workbench.lnk` → `%LOCALAPPDATA%\Programs\UniversalWorkbench\UniversalWorkbench.exe` |
| 安装实例启动 | PASS | 桌面快捷方式启动后窗口句柄 `17107550`、标题 `Universal Workbench`；3080 由安装目录内 Node 子进程监听；`/workbench/api/workflows` 返回 78 |
| 单实例 | PASS | 再次触发快捷方式前后 `UniversalWorkbench.exe` 进程数保持 1 |

## 5. 格式与文件校验

- `DOCX/XLSX/PPTX`：校验 ZIP 文件头与必要 OOXML 部件；XLSX 用 ExcelJS 重读并要求汇总公式存在。
- `PDF`：校验 `%PDF-`，使用 PDF.js 提取页面文本并核对标题。
- `HTML`：无头 Edge 加载，无控制台错误，标题与业务字段存在。
- `Markdown/CSV`：核对标题、工作流标识、表头和数据行。
- Office 可打开性：DOCX/XLSX/PPTX 逐域由 LibreOffice headless 转换为 PDF；矩阵无失败。
- 完整性：清单记录源 CSV 与每个产物的 SHA-256；发布前后进行哈希比对。

## 6. 当前限制

- 本轮仅验收 Windows；macOS/Linux 未执行。
- 使用系统 WebView2；安装器会预检并在缺失时明确阻断，但未外带固定版 WebView2。
- 安装包未做商业代码签名。
- 未在第二台物理 Windows 机器上运行；离线结论来自全新 `DSH_HOME`、空缓存和黑洞代理的隔离验收。
- 交付内容来自合成冷启动数据，只证明链路、格式、结构、可打开性和内容守恒，不构成真实经营、薪酬、健康或法律结论。
- 为执行干净安装验收，旧安装 profile 保留在安装目录 `.dsh-home.pre-tauri-20260930-092001`，未删除。

