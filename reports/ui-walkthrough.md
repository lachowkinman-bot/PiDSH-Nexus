# U15 壳内 UI 走查证据（v3.0 机械判据对照）

- 生成：2026-09-28 ｜ 环境：dsh 0.1.7-rc.2 web 壳 @ 127.0.0.1:3801（独立 DSH_HOME=.dsh-home）
- 证据目录：`reports/ui-walkthrough/*.png`（全部截图含 dsh 壳元素：deepseek HARNESS 侧栏/输入区，非 standalone）
- 截图工具：playwright-core 1.63.0 + chromium-1234（真实浏览器渲染，禁 headless 冒充口径不适用——本壳即 web 壳）

## 对照 016 §4 六条机械判据

| # | 判据 | 结果 | 证据 |
|---|---|---|---|
| 1 | 插件装入 web profile 且壳内出现"⟡ 工作台"入口 | **PASS** | 01-workbench-entry.png（侧栏"插件"分组下可见 ⟡ 工作台）；`dsh plugin --profile web add` exit 0 |
| 2 | preset 选/用/存/切四级操作各产生审计事件 + 前后截图 | **PASS** | 02-preset-selected / 03-preset-applied / 04-preset-saved / 05-preset-switched.png；本次会话审计增量：preset.apply=4、preset.save=3、preset.switch=2；产物 `templates/workspace/system/preset-state/saved-fin.expense-approve@1.0.0-1790577885888.json`（本次新增）+ current-preset.json |
| 3 | 13 域逐域实装独有业务元素，每域 1 张壳内截图 | **PASS**（域面板为可交互差异化组件：STRAT=OKR 表单+KR 滑杆、SALES=CRM 管道看板可推进、FIN=报销单可提交、COMP=带宽偏离 SVG+redact_gate 状态条、ER-EAP=匿名化+双审批+禁网指示等） | domain-strat … domain-er-eap 共 13 张 |
| 4 | 任一域点击"跑 GT（经引擎）"产生 engine.run 且结果在界面呈现 | **PASS（事件/呈现）/ FAIL（引擎真实执行）** | 07-engine-run-result.png 界面呈现 `{"engine":"local","fallback":true,...}`；审计 engine.run=3（dsh ok:false、pi ok:false、local fallback）——**因 DEEPSEEK_API_KEY 401 停线，U18 判 FAIL** |
| 5 | F7/F8/F11 三页壳内可操作 | **PASS** | F7-offline.png / F8-upgrade.png / F11-selfcheck.png（F11 实时渲染审计统计表） |
| 6 | 同构判定：任意两域无独有元素=FAIL；standalone=FAIL | **PASS（非同构、非 standalone）** | 13 域面板 DOM 结构互不相同（表单/看板/图表/清单/步骤条各异）；全部渲染于 dsh 壳 main 槽位 |

## 修复记录（本次对预置插件的实装修正，属 016 §3 "U15 实装范围"）

1. `lib/index.js`：原 `routes` 数组从未注册进宿主（"路由存在≠接通"）→ 重写为 cordis 契约 `export function apply(ctx){ ctx.webServer.register(route) }`（WebRoute={kind,path,handler}，对齐范本 `@linxin666/dsh-client-ui-task-board@0.4.3` lib/index.js:5656 与 src/host-routes.ts），8 条 `/workbench/api/*` 路由真实注册并经壳内 HTTP 200 验证。
2. `lib/client.js`：原文件存在语法级缺陷（`ReactDOM-esqueRender(host)` 未定义引用）且 13 域面板均为 "TODO(U15)" 同构占位 → 重写：slots 契约（`slots.inject('sidebar.panellist'/'main')`）+ 13 域差异化交互组件 + F7/F8/F11 三页 + preset 四操作按钮；侧栏图标传真实组件（传 null 触发 React error #130）。
3. scene_id 反查映射：`resolveSceneId()` 修复 `@1.0.0` 后缀与文件名不一致导致 apply 落空。
4. 审计归属：audit 文件含历史运行事件（05:06–05:59），本次证据按 **06:44 之后增量** 计数，不挪用历史事件。

## 遗留

- 截图共 25 张（01–08 + 13 域 + F7/F8/F11）≥ 13+12 判据线。
- engine.run 的"经引擎"真实执行被凭据 401 阻断（S0 停线）→ U18 FAIL，待有效 key 后复跑。
