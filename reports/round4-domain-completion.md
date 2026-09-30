# 第四轮：13 域设计完善 + 应用完整性复核（2026-09-29）

> 本轮目标（用户 `/goal`）：①确认应用完整运行、组件正常、勾稽正确、action 均可响应；②参考《HR智能体工作台-PRD.md》与《HR智能体工作台-Workbench设计文档.md》完善全部 13 个工作域。
> 参照文档位置：`F:\AI_HR_Workshop\HR_AI线下实战集训营\工作台pi-dsh方案\`（该目录另存有本交付包的**原始副本** `universal-workbench-3.0\`，含 `exemplar-reference/`；本轮所有改动都在工作副本 `F:\Pi_DSH_workplace\universal-workbench-3.0\`）。

## 一、目标① 应用完整性复核

执行器 `scripts/verify-app.mjs`（新建）：**41/41 PASS** → `reports/app-verification.json`

| 覆盖面 | 项数 | 结果 |
|---|---|---|
| 端点（壳/场景/域/current/审计/交付物/工作流库/按钮清零表/工具版本） | 9 | 全 200 且结构符合预期 |
| 13 域数据端点 + 落地表行数 | 26 | 全 200，每域 2-4 张表、行数 > 0 |
| action 清零表条目 | 1 | 12 项（preset 选/用/存/切/新建/编辑 + 审计 + 回滚演练等） |
| 勾稽关系 | 5 | 场景→技能→工作流一致性、场景引用工作流均存在、数据字典↔落地表 0 issue、交付物↔审计、引擎调用可追溯 |

**勾稽关键项**：`data-consistency-check` → `tables=46 issues=0`（46 张声明表全部落地且行数达标）。

**UI 层复核（浏览器实入，非仅 API）**：壳内 `⟡ 工作台` 面板渲染 **13 域卡片**（标题「13 域工作台」、页签 业务域/工作流(78)/交付物/审计/F7），每卡显示本域独有业务元素 + 「工作流 6 条」+ 进入按钮；进入 FIN 域后**数据资产卡渲染出新补齐的 `revenue_wan`/`net_wan` 列**——数据文件→API→界面表格三段贯通。证据截图 `reports/ui-walkthrough/r3-fin-domain-enriched.png`。

**控制台错误（如实登记，均非工作台组件）**：`/modlens/config` 404、`/smooth-stream/settings.read` 405（两个 catalog 插件）、`sessionController is unavailable`（web profile 下会话控制流不可用，与 boot log 中 `dsh-task-board session/list failed` 同源，属已登记类问题）。

## 二、目标② 13 域设计完善

### 2.1 完善前的问题（实测）

| 项 | 完善前 | 完善后 |
|---|---|---|
| `docs/preset-design/<域>.md` | 每域约 41 行；只声明 2 技能/2 工作流（实际各有 3/6）；含 `undefined` 占位；声明的表名与实际落地不符 | 每域 **211-359 行**（合计 **3,705 行**）；§1-§10 齐备；0 处 `undefined` |
| 数据资产 | 每域 2 张表、每表 4-5 行（全库 140 行） | 每域 2-4 张表、每表 12-29 行（**33 张表 / 557 行**） |
| 数据字典↔落地表 | 9-10 条 issue（含 5 个域表名对不上） | **0 issue**（46 张声明表全部命中） |

### 2.2 每域新增的设计章节（§1-§10）

数据字典总表 + **字段级数据字典**（与 CSV 表头逐字一致）、技能规格、**全部 6 条工作流**（含审批落点与交付规范）、**状态机**（枚举+迁移条件）、**审批链**（节点-角色-是否双审批-金额阈值）、**跨域联动**（触发→副作用→证据字段）、权限矩阵、Golden Tasks、**校验规则**、特殊约束。深度写法参照 Workbench 文档的 §3.2 字段字典 / §3.3 状态枚举 / §4 工作流规格 / §5 权限模型 / §8 校验规范。

### 2.3 敏感域纪律（按域施加，非泛化）

- **er-eap**：EAP 表只出现匿名编号（`EAP-ANON-xxxx`），无姓名/工号/可反推字段；§10 把 015 §8.4 五条硬约束落成可检查条款；§2 明写「EAP 必走 eap-referral，禁 dispute-ops 顶替」。
- **ben**：体检/健康数据只落**聚合分布**（年龄段×项目计数与占比），无个体健康结果。
- **comp**：薪资一律区间/掩码口径，不落可还原到个体的完整金额。
- **mkt-on**：线索手机号/邮箱全掩码。
- 其余域人员标识统一 `E1***` / `EMP-****12` 形式。

### 2.4 修掉的地雷（子代理一致上报）

`scripts/seed-domain-data.mjs` 内嵌的是 4-5 行冷启动样例，**原实现无条件覆盖**——重跑会把 13 域补齐的数据打回旧样。
已改为**非破坏性播种**：只写缺失/空文件，已存在且非空一律跳过（实测 `files=0 skipped_existing=26`，数据零改动）；需覆盖时显式 `--force`。

## 三、连带修复的既有 FAIL

GT 重跑（第 3 轮，数据对齐后）**PASS 39/39**（此前 38/39），12 域全部达「每域≥3」（此前 11）：

- 唯一旧 FAIL **GT-FIN-02** 现已通过：`period=2026-09, revenue_wan=1180, cost_wan=1062, net_wan=118`（1180−1062=118 自洽）。
  该失败根因正是「FIN 域种子数据缺收入/净额口径」，本轮补齐 `revenue_ledger.csv` + `budget.csv` 扩列后消失。

验收线（015 §8.5）≥25 GT PASS 覆盖 ≥6 域且每域 ≥3 → **PASS**（39/39，12 域）。

## 四、证据路径

`reports/app-verification.json`（41/41）、`reports/data-consistency.csv`（0 issue）、`reports/gt-results.csv` + `reports/gt-skill-consistency.csv`（39/39）、`reports/ui-walkthrough/r3-fin-domain-enriched.png`、逐域文档 `docs/preset-design/*.md`、逐域数据 `templates/workspace/data/*/`。

## 五、仍需接手人知道的事

1. **两处副本**：`F:\AI_HR_Workshop\...\工作台pi-dsh方案\universal-workbench-3.0\` 是原始包（未同步本轮改动）。若交付目标其实是那一份，需要我做一次同步（本轮未动它）。
2. **PRD 与 13 域不是一一对应**：PRD 的 11 个模块是 HR 视角，本工作台 13 域是跨职能视角（含 MKT/SALES/FIN/STRAT/CMP 等 HR 外域）。故本轮把 PRD/Workbench 当作**深度模板**（字段字典/状态机/审批链/联动/校验/规模）套用到各域，而非按模块改写域定义。
3. **`skills-domain` 的 SKILL-*.md 未同步**：域文档已深化，但 `templates/skills-domain/<域>/SKILL-*.md`（52 个技能文件）仍是旧版（简短）；GT 执行注入的是这些文件，建议下轮把新校验规则/审批链回写到技能文件。
4. **GT 产物已刷新**，但 `reports/<域>/gt-0N.md` 之外的历史报告（如 `reports/u17-benchmark.md` 的 T10 观察）未重新生成。
5. 前端 13 域卡片的**数据资产卡已实时消费新 CSV**；但各域「独有交互」与「域 GT」卡片仍为内联示例内容，未与本轮深化的状态机/校验规则联动——这是"设计完善"尚未贯穿到 UI 交互层的部分，建议列下轮。
