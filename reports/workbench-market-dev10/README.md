# dev10 安装态验收 · 对齐 dataelement 的工作台市场与即插即用（2026-10-11）

> 版本 `4.0.0-dev10`｜安装包 `installer-output/UniversalWorkbench-Setup-4.0.0-dev10.exe`（594,487,903 B，sha256 `8A91CEE035706F91F95EE610C990A9018D678B4C5A7C46E09E3BB784CFAB08EE`）｜静默安装 exit=0（`inno-dev10.log`）

## 本轮落地（对照计划）

- **A 目录协议 v2**：`pids-nexus/workbench-catalog/v2`（categories/workbenches、owner/repo 或 pids:<domain> 身份、分发型、截图 sha256/宽/高/字节、指标）；本地文件源默认 + 可选 HTTPS 远程源（`workspace/config/market-sources.json`，`allowRemote` 默认 false）；2MB/10s/15min 缓存、`force=1` 刷新、失败回退 stale 并标记来源；`check-updates` + **禁止降级**（downgrade-blocked）。
- **B 市场 UI**：三页签（工作台市场/我的收藏/已安装）+ 搜索/分类/排序（市场顺序/星标/下载）+ 检查更新 + 刷新目录 + 主开关；卡片含**截图轮播 + 放大预览**、作者、版本、收藏书签、安装/更新/卸载状态；**卸载确认弹窗**（按来源区分影响说明）；空态/离线降级文案；关于/来源折叠。
- **C 状态模型**：`workspace/custom/workbench-state.json` v1（enabled/added/pinned/favorites/active/sessionBindings/recentSessions/notes/hiddenWorkspaces）；revision 乐观并发（409）；不变量校验（置顶⊆added、归属不可改、删除保留笔记等）；已安装工作台自动并入 added。
- **D 工作台模式**：顶部切换器（会话（未绑定）↔ 各工作台，`aria-label=工作台模式入口:*`）；进入工作台写入 active；客户端订阅宿主会话列表，**激活状态下新建会话自动绑定归属**；每工作台笔记（GET/PUT /custom/notes，≤200KB，本地保存）。
- **E 包 v2 + 双包**：`pids-nexus/workbench-package/v2` + `scripts/custom/check-workbench-package.mjs`（目录与 .tgz 两种校验、截图尺寸/哈希）；运行时包即装即用；**DSH 插件包链路**（本地 .tgz → 探测 CLI → `dsh plugin add` → 重启生效；卸载 `plugin remove`；记录在 `market-installs.json`）；远程分发默认关闭（显式错误提示 + 本地 .tgz 指引）。
- **F 三步向导**：「制作我的工作台」= 第一步交给 Agent（规范 + 复制开发指令）→ 第二步装到本机自测（校验/完整门禁/预览/安装 + 自测清单）→ 第三步导出并登记（导出 .tgz / 登记目录 / 导出合入包固化）。
- **G 兼容迁移**：install.json v1 → v2 自动迁移（补 catalog_id/version/category/description/screenshots，保留资产与生成物）；样例包与目录升 v2（真实截图 `samples/workbenches/cust-learning/screenshots/01.png`）。

## 门禁与验收

- `WORKBENCH_UI_V4 PASS 34/34`（开发壳，含市场 v2 三页签/收藏/检查更新/确认弹窗/导入、向导三步+复制+校验+预览+后台门禁+安装守卫、工作台模式进入/笔记/退出、独立应用兜底）
- 安装态 `33/34`：全部功能旅程通过；唯一失败为**已证实的第三方槽位崩溃**（`conversation.input.left` React #130，dev8 已证明与工作台无关）
- `SHELL_VERIFY PASS 107/107 unknown=0`；`APP_VERIFY 45/45`（安装态）；`4.0-verify ok=true`
- 安装：静默安装 `exit=0`；安装态 `app.html` 与 `{app}\workbench-ui-plugin`（junction）均为 dev10 构建

## 未跑 / 残留（如实登记）

- 本轮未新增 `verify-fixtures` 的目录 v2 / 状态不变量 / 包校验夹具（以 `check-workbench-package` 冒烟 + UI 旅程覆盖）；`workflow-contracts 549 / delivery 546 / design:verify 21` 沿用 dev9 的最近一次全绿结果（dev10 未改这些链路）。
- 插件式包安装的"重启后加载"只验证到 CLI 安装 + 记录 + 重启提示（未构造第二个真实插件包做整链 UI 验证）。
- 独立应用（SPA）市场为轻量对齐（目录 v2 卡片 + 安装/卸载 + 收藏 + 更新提示），未做轮播/放大。
- 远程目录源与联网安装默认关闭，未做真实远程源联调。

## 文件

`workbench-v4-ui-dev.json` / `workbench-v4-ui-installed.json` / `shell-strict-dev10.json` / `verify-app-installed.json` / `4.0-verify.json` / `inno-dev10.log`
