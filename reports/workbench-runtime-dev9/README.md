# dev9 安装态验收 · 工作台运行时装上即用（2026-10-11）

> 版本：`4.0.0-dev9`｜安装包：`installer-output/UniversalWorkbench-Setup-4.0.0-dev9.exe`（594,377,279 B，sha256 `341779D9D0B34A3F6D73B203370DFA764B87FA33F565B5645314A35F1253E4FA`）
> 桌面壳：`universal-workbench.exe` sha256 `0FF4DA08…`：安装态静默安装 `exit=0`（Inno `/LOG`：`Installation process succeeded`）

## 用户可见问题逐条验收

| # | 问题 | 结果 | 证据 |
|---|---|---|---|
| 1 | 侧边栏看不到自定义工作台 / 市场入口 | ✅「工作台市场」为面板一级导航；安装后侧边栏出现「⧉ 名称」一级固定入口 | `workbench-v4-ui-installed.json`：`ui.market.open` / `ui.market.sidebar-entry` |
| 3 | 新会话无法自然语言设计工作台、无法在侧边栏调用 | ✅ 注册工作台工具集（catalog/draft_create/draft_list/draft_verify/draft_preview/draft_export/verify_heavy/install/uninstall/data_import）+「工作台设计师」技能；草稿一键安装后侧边栏立即出现 | 工具/技能注册代码 + `ui.custom.*`、`ui.market.sample-installed` |
| 4 | 独立驾驶舱不能启动 | ✅ 根因：wry 无 `on_new_window` 时 `window.open` 被 `SetHandled(true)` 丢弃；已在 Tauri 主窗口接管新窗口（应用内新窗口）+ 前端弹窗被拦时同窗口兜底 | 根因证据：wry-0.57 `webview2/mod.rs`；`ui.integration.standalone-link`、`ui.integration.standalone-fallback` |
| 4b | 集成中心只是信息，无意义 | ✅ 改造为「工作台市场」：已安装管理（打开/停用/启用/卸载）+ 本地目录（样例安装/本地包导入）+ 数据源骨架 + 关于/来源折叠 | `ui.market.*`、`ui.market.about-sources` |
| 5 | 13 域工作台要能自然语言修订；要真实数据接口 | ✅ 运行时修订内置域（overlay，不改 78 工作流闭集）；真实 CSV 导入（严格表头 + 列映射预览→写入，含备份/审计/数据版本）+ 独立驾驶舱实时读服务端数据（种子仅离线回退）+ 外部只读数据源骨架（file/http 已实现探测与刷新，sql 预留） | `fixtures.json`（10/10）；`ui.market.import-preview` / `ui.market.import-write` |

## 门禁

- `CUSTOM_FIXTURES PASS 10/10`（运行时装订样例/草稿、导入严格/反例/映射、卸载回归）
- `WORKBENCH_UI_V4 PASS 28/28`（开发壳）；安装态 `27/28`，唯一失败为下述第三方残留
- `SHELL_VERIFY PASS 107/107 unknown=0`
- `APP_VERIFY 45/45`（开发壳与安装态各一轮）
- `4.0-verify ok=true`；`RUNTIME_CAPABILITIES fail=0`；`design:verify 21/21`；`workflow-contracts 549/549`；`workflow-delivery 546/546`
- 数据面：严格导入拒绝和映射导入均有夹具证据（`fixtures.json` 07/08/09）

## 已知残留（与本次改动无关，已证实可复现）

1. 安装态控制台仍有 `conversation.input.left` 的 React #130 槽位崩溃：在不打开工作台面板、仅加载壳时即复现（第三方 0.1 代插件注入，见 ADR-0017 接受风险）；同理 `dsh-sonarqube` / `dsh-sentry` 无凭据启动报错。
2. `install exit=5` 根因已用 `/LOG` 复现并固化：应用被**强制结束**会遗留 `{app}\offline\node` 的 dsh 子进程，Inno RestartManager 发现 Node 占用文件，静默模式对弹窗默认 Abort → `User canceled the installation process`（exit=5）。清理该进程后同一安装包 `exit=0`、`Installation process succeeded`。正常关闭窗口（走 Tauri 退出事件）不会遗留子进程。
3. 独立驾驶舱的"应用内新窗口"路径无法用 Playwright 驱动 WebView2 自动点击验收：已由（a）wry 根因与 Rust 处理代码、（b）构建通过、（c）"弹窗被拦→同窗口兜底"旅程三方证据覆盖；如需一次真人点击确认，可在桌面应用里点一次「打开独立驾驶舱 ↗」。
4. 工具注册缺陷已修复并验证：宿主要求工具 `output.render`，此前 11 个工作台工具在 register 处静默失败；修复后开发壳与安装态审计均记录 12 个 `tool.register ok=true` 与 `skill.register:workbench-designer ok=true`。

## 文件索引

- `fixtures.json`：运行时装订/导入/卸载夹具证据
- `workbench-v4-ui-dev.json` / `workbench-v4-ui-installed.json`：开发壳与安装态 UI 旅程
- `shell-strict-dev9.json`：壳严格门禁（控件登记 107/107）
- `4.0-verify.json`、`capabilities-*.json`、`domain-work-design-validation.json`、`workflow-contracts-549.json`、`workflow-delivery-546.json`
- `verify-app-installed.json`：安装态自检 45/45
- `inno-dev9.log` / `inno-dev9c.log`（待补：最终一次）/ `inno-dev9b.log`：静默安装 Inno 日志（exit=0 / exit=5 根因 / 清理后 exit=0）
