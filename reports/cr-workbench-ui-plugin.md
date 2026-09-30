# cr-workbench-ui-plugin.md — 工作台双面插件代码审查记录

- 审查对象：`workbench-ui-plugin/`（lib/index.js Node 半面、lib/client.js 浏览器半面、package.json、cordis.patch.yml）
- 审查依据：016 §3/§4/§6、015 §14.6 语义禁令、范本 `@linxin666/dsh-client-ui-task-board@0.4.3`（已解包至 `.work/exemplar/`）
- 结论：**预置件不可用（4 项阻断缺陷）→ 已实装修正 → 修正后壳内实跑通过**

## 缺陷清单（改前）

| # | 缺陷 | 位置 | 性质 | 修正 |
|---|---|---|---|---|
| D1 | `routes` 数组从未注册进宿主：`ctx.webServer.register()` 调用缺失 | lib/index.js 原 128 行 | **语义禁令命中**（路由存在≠接通） | 重写为 cordis 契约 `export function apply(ctx)`，8 条 WebRoute 真实注册；壳内 HTTP 200 验证 |
| D2 | `ReactDOM-esqueRender(host)` —— 未定义引用，运行时必抛 | lib/client.js 原 103 行 | 语法/引用错误（界面无法挂载） | 整段重写为 slots 契约挂载 |
| D3 | 13 域面板内容均为 `TODO(U15)：绑定…` 占位 | lib/client.js 原 60 行 | **同构占位页 → U15 判据 FAIL** | 13 域各实现独有可交互组件（OKR 表单 / CRM 看板 / 报销单 / 带宽偏离 SVG / EAP 匿名化表单 等） |
| D4 | F7/F8/F11 三页完全缺失 | lib/client.js | U15 判据 5 不满足 | 补三页（离线指示 / 升级回退 / 自检报告，自检页实时读审计统计） |
| D5 | 导出形态不符 cordis 契约（缺 `apply`/`inject`） | lib/index.js | 导致 `failed to import`（壳启动报错） | 对齐范本 `export { apply, inject }` |
| D6 | 侧栏 slot 组件传 `null` | lib/client.js | React error #130（slot entry crashed） | 传真实 `WorkbenchIcon` 组件 |
| D7 | scene_id 含 `@1.0.0` 后缀，文件名不含 → apply 落空 | lib/index.js | 功能失效 | 加 `resolveSceneId()` 反查映射 |

## 契约对齐核对（逐条对范本）

- Node 半面导出：`export { apply, inject }` ← 范本 lib/index.js:5656 `export { ..., apply, ... }` ✅
- 路由注册：`ctx.webServer.register({ kind, path, handler })` ← 范本 lib/index.js:5596 段 + `@deepseek-ai/dsh-host-webserver` 类型定义 ✅
- 浏览器半面：`window.__ModuleLoader__.load({ id, factory })` → `module.exports = { apply, inject }` ← 范本 lib/client.js:1 起 ✅
- slots：`slots.inject("sidebar.panellist", …)` / `slots.inject("main", …)` ← 范本 lib/client.js:4943–4956 ✅
- patch：`- insert: [{ id, name }]` ← 范本 cordis.patch.yml ✅

## 验证（实跑，非静态检查）

1. `node --check` 双面语法通过；
2. 桩 ctx 调用 `apply` → 注册 8 条路由，逐条 handler 返回真实数据（scenes 14 条 / domains 13 域清单）；
3. `dsh plugin --profile web add` exit 0 → 壳启动无 failed plugin → 侧栏出现"⟡ 工作台"；
4. 壳内 HTTP：`GET /workbench/api/scenes` = 200（真实 JSON）；
5. preset 四操作产生审计增量：preset.apply=4、preset.save=3、preset.switch=2；产物 `saved-fin.expense-approve@1.0.0-*.json`；
6. 25 张壳内截图（含 13 域 + F7/F8/F11），控制台 0 错误。

## 遗留

- `engineRun()` 的两个引擎（dsh via npx / pi CLI）本轮均因 **DEEPSEEK_API_KEY 401** 失败 → 回落 `local` 并标注 `fallback=offline`；**U18 判 FAIL**（降级率 100% > 50%）。
- `exemplar-reference/` 目录在包内缺失（016 §6 引用），本轮改以 `.work/exemplar/`（自解包）替代，建议回写进资源包。
