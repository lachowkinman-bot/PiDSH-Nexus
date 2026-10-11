# Current Candidate · 2026-10-11（工作台市场 v2 + 即插即用）

- Version: `4.0.0-dev10`（含 dev8 三入口、dev9 运行时层；dev8/dev9 未单独发布）
- Build ID: `507f1c223c9adbb54f0127f4eec0783f955af2356cd1b14ed3560c6ab4e9ba62`
- Engine: `@deepseek-ai/dsh@0.2.0-rc.2`（npm 官方 tarball sha256 `bd27847c…f38859`；overrides 与 23 条精确豁免见 `manifests/runtime-web.package.json` 与 `templates/runtime/compatibility.json`）
- Installer: `installer-output/UniversalWorkbench-Setup-4.0.0-dev10.exe`（594,487,903 B，sha256 `8A91CEE035706F91F95EE610C990A9018D678B4C5A7C46E09E3BB784CFAB08EE`）。
- 安装须知（exit=5 根因，已用 /LOG 复现并固化）：应用被强制结束后会遗留 `{app}\offline\node` 的 dsh 子进程占用文件，Inno RestartManager 在静默模式下默认 Abort → exit=5。静默安装前先正常关闭应用（或清理 `{app}` 下的 node 进程），本机实测 exit=0。
- Status: 本机 QA + 安装态全绿候选（唯一例外：已证实的第三方槽位崩溃，见证据 README）；preview/stable 标记待 Windows 10/11 clean VM（H10）。
- Verified（本机）: 4.0-verify ok；UI v4 **34/34**（开发壳）/ **33/34**（安装态，唯一失败为第三方 `conversation.input.left` React #130）；shell strict **107/107**；APP_VERIFY **45/45**（安装态）；目录 v2/包 v2/状态/双包/向导/工作台模式旅程全绿；静默安装 `exit=0`（`/LOG` 固化）。
- Not run: Windows 10/11 clean VM 完整矩阵（H10）；目标机 development-rebuild 复验；独立驾驶舱"应用内新窗口"的真人点击确认（Rust 已接管 + 同窗口兜底，见证据 README）。
- Evidence: `reports/workbench-market-dev10/`（安装态 UI/自检/壳严格/Inno 日志 + 未跑项登记）、`reports/workbench-runtime-dev9/`（运行时层）、`docs/adr/ADR-0018-integration-layer-and-custom-workbench.md`；GitHub 推送点仍为 3.0 仓库 master / release-preview / tag `v0.2.0-preview`（提交 `1339110`，本轮未提交/未推送）。
