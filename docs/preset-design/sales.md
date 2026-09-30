# Preset 设计文档 · 销售管理（sales）

> 定位：`sales.quote-approval@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/sales.quote-approval.yaml`（scene_id `sales.quote-approval@1.0.0`、domain `SALES`；required_capabilities 3；skills 3；policies：min_level=L3 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="sales"` 共 6 条）
> - Skills：`templates/skills-domain/sales/SKILL-*.md`（含意图路由 `SKILL-cockpit-intent.md`）；知识种子 `templates/knowledge/seeds/sales.md`；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/sales/pipeline.csv`、`quotes.csv`、`targets.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2（字段级字典写法）、§3.3（状态枚举）、§4（工作流规格）、§5（权限模型）、§7.1（种子数据规模）、§8.2/§8.3（字段校验与状态迁移规范）
>
> **数据基线日 = 2026-10-12**（报告月 `2026-10`，目标周期 `2026-Q4`；全部为合成数据，客户/联系人/负责人均掩码，非真实客户与经营数据）。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| pipeline.csv | L2 | —（scene/Type-Dict 声明 none；`owner`/`contact_masked` 为「姓+`****`」不可还原掩码，`customer_id` 为匿名代理键 `CUST-###`） | 20 | 商机主表（金额单位**千元**）：原生 5 列（商机/阶段/金额/负责人/成交日）+ 追加 12 列（商机ID/客户ID/客户掩码/联系人掩码/大区/赢率/来源/成交月/下一动作/输单原因/合同号/版本时间戳）；覆盖 7 阶段 × 5 大区，是管道周报、赢单复盘与目标达成的事实源 |
| quotes.csv | L3 | customer_masked, contact_masked, discount_floor_wan（承载 scene redact 字段 `customer_contract`、`discount_floor`） | 15 | 报价台账（金额单位**万元**）：原生 6 列（报价号/客户掩码/配置/折扣/含税合计/状态）+ 追加 11 列（商机ID/客户ID/联系人掩码/目录价/底价/审批路由/合同号/回款条款/条款偏离/备注/版本时间戳）；报价审批、合同评审的判定依据，合同要素寄存在本表追加列 |
| targets.csv | L2 | — | 12 | 大区→负责人季度目标分解表（金额单位**万元**）：5 大区 12 名负责人；`Σowner_target_wan = region_quota_wan`（§9 V-SALES-06），供 GT-SALES-03 达成看板与 `sales.target-split` 取数；**非 scene 数据资产**（本域扩展表），级别保守继承 pipeline |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按「去扩展名 + 前缀」匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 pipeline.xlsx（Type-Dict：`sales, pipeline, table, L2, none`） | pipeline.csv | L2 |
| scene `data_assets` 的 contracts.xlsx（Type-Dict：`sales, contracts, table, L3, customer_contract`） | **不单独落地合同主表**：合同要素（`contract_no` / `payment_terms` / `terms_deviation`）以 quotes.csv 追加列承载，合同原文与条款正文一律不外发（§10） | L3 |
| （无 scene 声明；GT-SALES-03 达成率与 `sales.target-split` 验收需要） | targets.csv | L2（保守继承） |

- 表头英文小写下划线、UTF-8、逗号分隔、字段内不使用英文逗号；**金额单位写进列名**（`amount_k` = 千元、`*_wan` = 万元），跨表口径折算见 §9 V-SALES-05。
- `pipeline.csv` 原生 5 列（`opportunity,stage,amount_k,owner,close_date`）、`quotes.csv` 原生 6 列（`quote_id,customer_masked,items,discount_pct,total_wan,status`）的**列名与列序均未删改**，仅追加列（追加列已逐字段写入 §1.1）；原 5 条商机行、原 4 条报价行的既有取值逐字保留。
- 每表数据行 ≥12（本页行数以上表为准，不含表头），满足 §15.4 校验下限与 scene 数据资产规模要求。
- **既存口径修正登记**：`pipeline.close_date` 仅 `MM-DD` 无年份（历史 GT 报告已记为口径差异），本版**不改原列**，以追加列 `close_month`（`YYYY-MM`）补全年份口径，报告期取 `close_month`。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`。

#### 1.1.1 pipeline.csv（17 列 = 原生 5 列 + 追加 12 列，20 行）

表头逐字：`opportunity,stage,amount_k,owner,close_date,opportunity_id,customer_id,customer_masked,contact_masked,region,probability_pct,source,close_month,next_action,lost_reason,contract_no,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| opportunity | string | 是 | 商机名称（`商机-<字母>（行业）`），展示口径；原始列 |
| stage | enum | 是 | 商机阶段，枚举与迁移见 §4.1（落地值：线索/接触/方案/报价/谈判/赢单/输单）；原始列 |
| amount_k | number | 是 | 商机预估金额（**千元**，整数）；折算万元 ÷10（§9 V-SALES-05）；原始列 |
| owner | string | 是 | 商机负责人掩码（姓 + `****`，如 `王****`）；原始列 |
| close_date | string | 是 | 预计/实际成交日 `MM-DD`（源表无年份，保留原样）；原始列 |
| opportunity_id | string | 是 | 商机 ID（`OPP-YYYY-####`），唯一主键；quotes.opportunity_id 的外键指向本列；追加列 |
| customer_id | string | 是 | 客户匿名代理键（`CUST-###`），不可还原为真实企业；quotes.customer_id 必须与本列一致；追加列 |
| customer_masked | string | 是 | 客户名称掩码（`某<行业>集团` 形态，如 `某物流集团`），与 quotes.customer_masked 同词表；追加列 |
| contact_masked | string | 是 | 客户联系人掩码（姓 + `****`）；真实姓名/手机/邮箱不入库；追加列 |
| region | enum | 是 | 归属大区：华东 / 华南 / 华北 / 西南 / 华中（与 targets.region 同词表）；追加列 |
| probability_pct | number | 是 | 阶段默认赢率（%）：线索 10 / 接触 20 / 方案 40 / 报价 60 / 谈判 80 / 赢单 100 / 输单 0；追加列 |
| source | enum | 是 | 线索来源：官网表单 / 行业展会 / 投放落地页 / 转介绍 / 渠道推荐 / 陌拜 / CRM导入 / 公开招标（可回写 mkt-on 线索归因，§6）；追加列 |
| close_month | string | 是 | 成交归属月 `YYYY-MM`（2026-10/11/12），管道周报与月报的过滤键；追加列 |
| next_action | string | 是 | 下一动作（销售跟进指令，脱敏文本，不含客户 PII）；追加列 |
| lost_reason | enum | 否 | 输单原因：预算冻结 / 竞品低价；`stage=输单` 时必填，其余为 `-`；追加列 |
| contract_no | string | 否 | 销售合同号 `HT-YYYY-####`（赢单后回填，与 quotes.contract_no 一致）；非赢单为 `-`；追加列 |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`，审计「依据数据版本」取该值，全表快照一致（2026-10-12）；追加列 |

#### 1.1.2 quotes.csv（17 列 = 原生 6 列 + 追加 11 列，15 行）

表头逐字：`quote_id,customer_masked,items,discount_pct,total_wan,status,opportunity_id,customer_id,contact_masked,list_price_wan,discount_floor_wan,approval_route,contract_no,payment_terms,terms_deviation,note,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| quote_id | string | 是 | 报价单号（`QT-####`），唯一主键；原始列 |
| customer_masked | string | 是 | 客户名称掩码（与 pipeline.customer_masked 同值）；原始列 |
| items | string | 是 | 配置明细（`<版本>×<数量>+<附加项>`，如 `旗舰版×2+培训`）；产品版本：标准版/专业版/旗舰版，附加项：实施/培训；原始列 |
| discount_pct | number | 是 | 整单折扣率（%，0–30 有效区间）；审批档位判定阈值键（§5）；原始列 |
| total_wan | number | 是 | 报价含税合计（**万元**，1 位小数）＝ `round(list_price_wan × (1 − discount_pct/100), 1)`（§9 V-SALES-05）；原始列 |
| status | enum | 是 | 报价单状态，枚举与迁移见 §4.2（草稿/待审批/已批准/已驳回/已发出；既存落地值「已审批」≡「已批准」）；原始列 |
| opportunity_id | ref | 是 | → pipeline.opportunity_id 外键，禁止孤儿行；追加列 |
| customer_id | ref | 是 | → pipeline.customer_id；必须等于该商机的 customer_id（防串户，§9 V-SALES-02）；追加列 |
| contact_masked | string | 是 | 客户联系人掩码（姓 + `****`）；追加列 |
| list_price_wan | number | 是 | 目录价合计（**万元**，2 位小数），与 `items` 配置对应；追加列 |
| discount_floor_wan | number | 是 | 该配置的底价（**万元**，2 位小数）。承载 scene redact 字段 `discount_floor`：`total_wan < discount_floor_wan` 即「低于底价」，必须转报价审批（§9 V-SALES-04）；出域仅出「是否低于底价」的结论；追加列 |
| approval_route | enum | 是 | 审批路由（按折扣档位与底价规则取较严者）：一级授权 / 双审批 / 双审批+CFO加签（§5）；映射 workflow `approvals` 字段（签数 1/2/3）；追加列 |
| contract_no | string | 否 | 销售合同号 `HT-YYYY-####`（报价转合同后回填，与 pipeline.contract_no 一致）；未签为 `-`；**合同原文不落地**；追加列 |
| payment_terms | enum | 是 | 拟约定回款条款：30%预付+70%验收（标准模板）/ 20%预付+40%发货+40%验收 / 20%预付+30%发货+50%验收 / 40%预付+60%验收 / 月结30天；追加列 |
| terms_deviation | enum | 是 | 相对标准回款条款的偏离：无 / 偏离；`偏离` 且已签合同 → 触发 cmp 合规留痕（§6）；追加列 |
| note | string | 否 | 备注（审批要点/驳回原因/规则命中说明，如「低于底价已转报价审批」「毛利率低于产品线红线驳回重报」）；追加列 |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`（快照一致 2026-10-12）；追加列 |

#### 1.1.3 targets.csv（6 列，12 行）

表头逐字：`region,region_quota_wan,owner_masked,owner_target_wan,quarter,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| region | enum | 是 | 大区（与 pipeline.region 同词表：华东/华南/华北/西南/华中） |
| region_quota_wan | number | 是 | 大区季度目标（**万元**）；同区各行取值必须一致 |
| owner_masked | string | 是 | 负责人掩码（姓 + `****`，须能在 pipeline.owner 命中） |
| owner_target_wan | number | 是 | 负责人季度目标（**万元**）；`Σ(region 内 owner_target_wan) = region_quota_wan` |
| quarter | string | 是 | 目标周期 `YYYY-Q#`（本快照 2026-Q4） |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`（快照一致 2026-10-12） |

---

## §2 技能规格（scene skills：quote-calc / win-review / quota-dashboard）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| quote-calc | 报价测算（成本×折扣策略，低于底价必须转审批） | data/sales/quotes.csv、pipeline.csv | reports/sales/*（报价测算稿 + `quote-calc-<ts>.json`） | L3 | 逐行给出 `quote_id` + 命中规则（恒等式/底价/折扣档）；低于底价不得直接出报价单，必须转 `sales.quote-approve`；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| win-review | 赢单/丢单复盘（打法沉淀） | data/sales/pipeline.csv、quotes.csv | reports/sales/*（复盘正文 + `win-review-<ts>.json`） | L3 | 每条约结论必须携带证据字段（`opportunity_id` / `stage` / `amount_k` / `lost_reason` / `quote_id`）；结论可追溯到商机记录；连续 3 次失败→登记 capability-gap |
| quota-dashboard | 业绩看板与达成预测（含目标分解） | data/sales/pipeline.csv、quotes.csv、targets.csv | reports/sales/*（看板 + `pipeline-report-<ts>.json` / `target-split-<ts>.json`） | L3 | 目标分解 `Σowner_target_wan = region_quota_wan`（§9 V-SALES-06）；金额单位统一万元，可追溯 pipeline.csv；连续 3 次失败→登记 capability-gap |

- 三个技能文件均声明 `min_level: L3`、`redact_gate: true`，依赖能力 `cap.excel.panel`、`cap.redact.all`（与 scene `required_capabilities` 一致，另含 `cap.approval.single`）；越级读取即 DENY。
- 意图路由技能 `sales-intent`（`templates/skills-domain/sales/SKILL-cockpit-intent.md`）把自然语言意图路由到 `quote-approve` / `win-review` 工作流；跨域意图交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。
- 技能与工作流是**多对多**：`quote-calc` 被 `sales.quote-calc`（测算）与 `sales.quote-approve`（审批）复用；`win-review` 被 `sales.win-review` 与 `sales.contract-review` 复用；`quota-dashboard` 被 `sales.pipeline-report` 与 `sales.target-split` 复用。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="sales"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| sales.quote-approve@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition「触发对外/生效动作」；hitl_nodes=[n3] | `quote-approve-<ts>.json`：quote_id / total_wan / discount_pct / approvals；acceptance：**折扣 ≥10% 双审批；≥15% 加签 CFO** | 报价审批（DAG + 折扣阈值）；skill=quote-calc；审批路由与样例见 §5；audit n5 记「审批人 + 依据数据版本 + 产物哈希」；rollback=savepoint `pre-quote-approve` |
| sales.win-review@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空，仅 n3 audit） | `win-review-<ts>.json`：opportunity / amount_k / win_factors / playbook_update；acceptance：结论可追溯到商机记录 | 赢单复盘（打法沉淀）；skill=win-review；输单行须带 `lost_reason`；rollback=savepoint `pre-win-review` |
| sales.quote-calc@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空） | `quote-calc-<ts>.json`：customer_masked / items / discount_pct / total_wan；acceptance：**低于底价必须转 quote-approve** | 报价测算（规格×数量×折扣）；skill=quote-calc；输出前校验恒等式（§9 V-SALES-05）；rollback=savepoint `pre-quote-calc` |
| sales.pipeline-report@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `pipeline-report-<ts>.json`：stage / count / amount_k / week；acceptance：**金额单位万元，可追溯 pipeline.csv** | 管道周报（阶段×金额）；skill=quota-dashboard；阶段汇总须与明细合计勾稽（§9 V-SALES-07）；rollback=savepoint `pre-pipeline-report` |
| sales.contract-review@1.0.0 | n3 approval（**L4，`dual: true`**）；hitl_nodes=[n3] | `contract-review-<ts>.json`：contract_no / terms_risk / payment_terms / approvals；acceptance：**回款条款偏离标准必须双审批** | 合同评审（法务/财务会签）；skill=win-review；`terms_risk` 取 `terms_deviation` 口径；audit n5 记「审批人 + 依据数据版本 + 产物哈希」；rollback=savepoint `pre-contract-review` |
| sales.target-split@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空） | `target-split-<ts>.json`：region / owner_masked / target_wan / quarter；acceptance：**合计必须等于区目标** | 销售目标分解（区→人）；skill=quota-dashboard；取数 targets.csv；rollback=savepoint `pre-target-split` |

- 节点链：approve 类为 skill(n1) → condition(n2) → approval(n3) → tool `cap.excel.panel.write`(n4) → audit(n5)；report/calc 类为 skill(n1) → tool(n2) → audit(n3)。上表「审批落点」列对无审批工作流明示为「无审批节点」，**不存在任何空值或未定义占位**。
- 场景基线 `policies.permission.min_level=L3`、`dual_approval=false` 为**域默认**；两条 approve 工作流在流程级升格为 L4 双审批（与 workflow 节点一致），规则**单调加严、不放松**；condition 节点不得绕过审批直连写能力。
- scene `workflows` 只钉 2 条基线（`sales.quote-approve.yaml`、`sales.win-review.yaml`），其余 4 条取自工作流索引（本域共 6 条），命名以索引与落地 YAML 为准。

---

## §4 状态机

### 4.1 商机阶段（pipeline.stage，PIPELINE_STAGE）

| 枚举值 | 展示 | 阶段赢率 | 进入条件 |
|---|---|---|---|
| 线索 | 线索 | 10% | 线索入库并完成归属分配（`source` 必填） |
| 接触 | 初访 | 20% | 完成首次有效接触（拜访/演示/技术交流），需求初步明确 |
| 方案 | 方案 | 40% | 需求调研收口，输出解决方案与配置建议 |
| 报价 | 报价 | 60% | 生成报价单并进入报价流程（审批/发送） |
| 谈判 | 谈判 | 80% | 客户接受方案，进入商务条款（价格/回款/交付期）谈判 |
| 赢单 | 赢单 | 100% | 合同签订（`contract_no` 回填） |
| 输单 | 输单 | 0% | 明确失单（`lost_reason` 必填） |

| 迁移 | 触发条件 | 证据/门槛 |
|---|---|---|
| 线索 → 接触 | 首次有效接触完成 | `next_action` 更新；`source` 已归因（可回写 mkt-on） |
| 接触 → 方案 | 需求调研完成、方案评审通过 | 方案阶段赢率 40%；可并行做标准品预报价（`quote-calc`） |
| 方案 → 报价 | 报价单生成并进入报价流程 | quotes.status ≥ 待审批 且 `approval_route` 已判定（§5） |
| 报价 → 谈判 | 客户接受报价或进入条款谈判 | 报价单 `approval_route` 已完成相应签批；回款条款进入评审 |
| 谈判 → 赢单 | 合同签订 | `contract_no` 必填；联动 fin 收入确认/开票（§6） |
| 任意 → 输单 | 失单决策确认 | `lost_reason` 必填；转年度培育池并触发 mkt-on 线索回流（§6） |

```
线索 → 接触 → 方案 → 报价 → 谈判 → 赢单（终态）
  ↘      ↘      ↘      ↘      ↘
            输单（分支终态，须写 lost_reason 并复盘归档）
```

- **禁止**：越级推进（如 线索→报价）；`close_month` 与 `close_date` 的月份不一致（§9 V-SALES-09）；赢单无 `contract_no`、输单无 `lost_reason`。
- 阶段与报价单状态**解耦**（同 fin 的「两表状态各自落值、互不双写」）：报价单 `status` 由报价流程驱动，商机 `stage` 由销售流程驱动；允许「标准化预报价在 接触 阶段发出」（QT-3302）、「草稿测算在 线索 阶段先行」（QT-3304）——此类为**阶段滞后预警样例**（§9 V-SALES-09 黄灯，非阻断）。
- 本快照分布（20 行）：线索 3 / 接触 4 / 方案 3 / 报价 3 / 谈判 3 / 赢单 2 / 输单 2；大区分布 华东 8 / 华南 4 / 华北 4 / 西南 1 / 华中 3。

### 4.2 报价单状态（quotes.status，QUOTE_STATUS）

```
草稿 →（提交审批）→ 待审批 →（签批完成）→ 已批准 →（发送客户）→ 已发出（终态）
                       ↘（驳回，原因必填）→ 已驳回 →（改价重报）→ 草稿
```

| 状态（CSV 落值） | 标识符 | 等价口径 | 允许后继 | 证据字段 |
|---|---|---|---|---|
| 草稿 | draft | 草稿 | 待审批 | `approval_route` 已预判；低于底价时提交必须转审批（QT-3304） |
| 待审批 | pending_approval | 待审批 | 已批准 / 已驳回 | `approval_route` 非空；签批计数与档位一致（§5） |
| 已批准 | approved | **已审批**（既存落地值等价） | 已发出 | 审批人 + 依据数据版本 + 产物哈希（workflow n5 audit） |
| 已驳回 | rejected | 已驳回 | 草稿（改价重报） | `note` 必填驳回原因（QT-3311 毛利红线 / QT-3312 超低价+非标条款） |
| 已发出 | sent | 已发出 | —（终态） | 对外生效证据：客户已接收；合同签订后报价状态**冻结不回写** |

- 迁移只经唯一函数 `setStatus(entity, to, by)` 并写操作日志（参照 §8.3）；流程实例状态（running/done/rejected/cancelled）与单据状态解耦，流程 done 后由 after_complete 钩子回写。
- 本快照分布（15 行）：待审批 6 / 已批准 3（含既存值「已审批」1）/ 草稿 2 / 已驳回 2 / 已发出 2。
- 报价转合同（`contract_no` 回填）后状态冻结：赢单的 QT-3303 保持「已审批」、QT-3310 为「已发出」，两者均合法，避免双写。

### 4.3 合同回款条款状态（quotes.terms_deviation，TERMS_RISK）

| 状态 | 落地取值 | 进入条件 | 允许后继 |
|---|---|---|---|
| 标准 | 无 | 回款条款 = 标准模板「30%预付+70%验收」 | —（终态） |
| 偏离 | 偏离 | 非标条款（降预付/加账期），须 `sales.contract-review` 双审批 | 复核结论回写（cmp 证据包）→ 关闭或退回重谈 |
| 已复核 | （由 cmp 结论承载，不落本表列） | 偏离条款经法务/财务会签并打包证据 | 到期结案；不得自动放行未复核的偏离条款 |

- 偏离样例：QT-3308（20%预付+40%发货+40%验收）、QT-3310（合同 HT-2026-0427，已签且偏离 → cmp 联动）、QT-3312（月结30天，超低价驳回）、QT-3313（客户要求降低预付比例）。

---

## §5 审批链（节点-角色-阈值）

| 档位 | 触发条件（quotes.csv 口径） | 审批节点 | 角色链（建议映射） | 签数 | 依据与样例 |
|---|---|---|---|---|---|
| 一级授权 | `discount_pct < 10` 且 `total_wan ≥ discount_floor_wan` | 域内一级授权（不强制进入 quote-approve；若进入，n3 仍按 manifest L4 双审批执行，规则只加严） | 销售负责人 | 1 | scene `dual_approval=false`；样例 QT-3302（0%）、QT-3311、QT-3314、QT-3315 |
| 双审批 | `10 ≤ discount_pct < 15`，**或** `total_wan < discount_floor_wan`（低于底价，无论折扣） | sales.quote-approve n3（**L4，dual=true**，hitl_nodes=[n3]） | 销售负责人 → 商务/财务负责人 | 2 | acceptance 原文「折扣 ≥10% 双审批」＋「低于底价必须转 quote-approve」；样例 QT-3303（12%）、QT-3307（10%）、QT-3309（12%）、QT-3310（11%）、QT-3313（14%）、QT-3301（8% 但低于底价） |
| 双审批+CFO加签 | `discount_pct ≥ 15` | sales.quote-approve n3 + CFO 加签（第三签） | 销售负责人 → 商务/财务负责人 → CFO | 3 | acceptance 原文「≥15% 加签 CFO」；样例 QT-3305（15%）、QT-3306（18%）、QT-3308（16%）、QT-3312（22%） |
| 合同会签 | 合同评审触发（回款条款偏离标准） | sales.contract-review n3（**L4，dual=true**，hitl_nodes=[n3]） | 法务负责人 → 财务负责人 | 2 | acceptance 原文「回款条款偏离标准必须双审批」；样例 QT-3310（合同 HT-2026-0427） |

- 钉死事实：两条 approve 工作流的 n3 均为 `level: L4`、`dual: true`（取自工作流 YAML/index.json）；`approval_route` 三档与「≥10% 双审批 / ≥15% 加签 CFO」为 acceptance 原文口径，角色映射为落地建议（scene/工作流未钉角色，按 ROLES/caps 配置）。
- 路由判定取**较严者**：折扣档与底价规则同时命中时按高档执行（如 QT-3301 折扣 8% 落一级授权档，但低于底价 → 双审批）。
- 驳回/回滚：驳回 → 流程 rejected，报价回落 `草稿` 并必填原因；rollback savepoint `pre-quote-approve` / `pre-contract-review`；审批意见（通过/驳回原因）写入 audit n5。
- 审批路由 → 交付字段映射：`approval_route` = 一级授权/双审批/双审批+CFO加签 → workflow `approvals` 签数 1/2/3；`status` 为 待审批 时按已签数计（1/2/3 中未完成态）。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，不得绕过 §5 审批链；副作用统一在 after_complete 钩子实现，失败回滚至对应 savepoint。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 商机 `stage=赢单` 且 `contract_no` 回填（sales.win-review / quote-approve 完成） | ①fin 收入确认：按合同号与客户口径登记收入（`fin` 侧 `revenue_ledger.contract_no` 取证）；②fin 开票：触发开票要素校验（`fin.invoice-check`）；③金额口径：报价含税合计（万元）与管道预估（千元）差额须在复盘中显式说明 | pipeline：opportunity_id / stage=赢单 / amount_k / contract_no / close_month；quotes：quote_id / total_wan / contract_no；fin：revenue_id / contract_no / invoice_no |
| 报价被驳回 / 商机 `stage=输单` / 报价停滞（待审批 > 30 天） | mkt-on 线索回流与再培育：客户与来源渠道归因回流（`mkt-on.lead-funnel` 口径），进入再营销/培育池；不回流客户 PII | pipeline：customer_id / source / stage / lost_reason / close_month；quotes：quote_id / status=已驳回 / note |
| 合同回款条款偏离（`terms_deviation=偏离` 且 `contract_no` 非空） | cmp 合规：打包条款偏离证据（`cmp.evidence-pack`，append-only）+ 月度审计留痕（`cmp.audit-trail`）；未复核的偏离条款不得自动放行 | quotes：contract_no / payment_terms / terms_deviation / approval_route；pipeline：opportunity_id / customer_id |
| 管道周报完成（sales.pipeline-report done） | strat 经营分析取数：经营周报（`strat.weekly-report`）的订单/管道段引用阶段×金额汇总；只出汇总不出客户明细 | pipeline-report-<ts>.json：stage / count / amount_k / week；pipeline：region / close_month |
| 线下线索移交（mkt-off.lead-handoff 完成） | 线下活动/物料线索按去重+脱敏结果移交销售，落为 pipeline 新商机行（`source`=行业展会/投放落地页），线索 ID 与商机 ID 建立归因链 | pipeline：opportunity_id / source / customer_id；mkt-off 移交批次：lead_id / batch |

---

## §7 权限矩阵

**scene policies（钉死）**

| 项 | 值 |
|---|---|
| 最低数据级别 | L3（min_level=L3，只能 ≥ Chassis 默认） |
| 双审批 | false（域基线免双审批；两条 approve 工作流在节点级升格 L4 双审批，见 §5） |
| 脱敏字段（redact_gate） | customer_contract, discount_floor；命中写 redact 日志。落地映射：`discount_floor` → `quotes.discount_floor_wan`（出域只出「是否低于底价」结论）；`customer_contract` → `quotes.contract_no` / `payment_terms` / `terms_deviation`（合同原文与条款正文不落地、不外发） |
| 记忆层 | pii_allowed=false；exclude=[]（无 EAP 类排除项） |

**角色 × 操作**

| 角色 | 查看 | 创建/编辑 | 审批 | 数据边界 |
|---|---|---|---|---|
| admin | 全量 | V/C/E/D | 可（含流程推进/驳回） | 全部实体全部行 |
| sales_manager（销售负责人） | 本大区全量 | V/C/E/D | 可（一级授权、双审批第一签） | 本大区行；跨区只读汇总 |
| sales_rep（销售） | 本人商机/报价 | V/C/E（禁改审批中单据） | —（不可自审） | 仅本人 `owner` 商机与关联报价；客户掩码展示 |
| finance（财务） | 全量只读 + 审批视图 | — | 可（报价双审批第二签、合同会签） | 全量金额与条款；客户掩码展示 |
| cfo | 全量只读 | — | 可（≥15% 报价加签） | 全量；底价明细仅审批弹窗按权限展示 |
| employee | 无销售菜单 | — | — | 本域无自助入口 |

| 对象 | 级别 | 脱敏（redact_gate） | 记忆层 | 双审批 |
|---|---|---|---|---|
| pipeline.csv（`owner` / `contact_masked` / `customer_id`） | L2 | 人员一律「姓+****」掩码、客户为 `CUST-###` 匿名键，均不可还原；报告只引用商机 ID 与掩码 | 非 PII 汇总结论可入；掩码标识禁入 | 否 |
| quotes.csv（`customer_masked` / `contact_masked` / `discount_floor_wan` / 合同要素） | L3 | 底价只出「是否低于底价」结论；合同号仅在 L3+ 命名空间引用；合同原文/条款正文禁出 | PII 禁入（仅可入状态/汇总结论） | 报价审批：是（≥10% 双审批、≥15% CFO 加签）；合同会签：是（条款偏离） |
| targets.csv（`owner_masked` / 目标额） | L2 | 人员掩码；目标额按大区口径输出，不做个人排名外发 | 非 PII 汇总可入 | 否 |

- 列表/报告始终掩码；完整底价明细仅审批弹窗按权限展示（落地以 workbench-ui-plugin 为准）；无 approve 权限不渲染审批按钮；越级读取（<L3）直接 DENY。

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-SALES-01 | 按客户需求生成报价单并走折扣审批 | quote-calc + cap.excel.panel / cap.approval.single | L3（触达 L4 双审批/CFO 加签） | reports/sales/gt-01.md | data/sales/pipeline.xlsx、contracts.xlsx → pipeline.csv、quotes.csv | 读/算/写审计事件 + 审批记录 | 结论可溯源到 sheet/row 级证据；≥10% 双审批、≥15% CFO 加签 |
| GT-SALES-02 | 汇总本月赢单复盘要点 | win-review + cap.excel.panel / cap.approval.single | L3 | reports/sales/gt-02.md | 同上（主用 pipeline.csv 赢单行 + quotes.csv） | 读/算/写审计事件 | 结论可溯源到商机记录（逐 `opportunity_id`） |
| GT-SALES-03 | 生成大区业绩达成看板 | quota-dashboard + cap.excel.panel / cap.approval.single | L3 | reports/sales/gt-03.md | 同上（主用 pipeline.csv + targets.csv） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据；达成率 = 赢单额 / 区目标（万元口径） |

### 任务分解（scene `expected_plan` 指向本页）

**GT-SALES-01 报价单生成与折扣审批**
1. 读 quotes.csv 定位报价单（如 QT-3305，商机 OPP-2026-0105），校验恒等式 `total_wan = round(list_price_wan × (1 − discount_pct/100), 1)` 与底价关系（§9 V-SALES-04/V-SALES-05）。
2. 判定 `approval_route`：折扣档与底价规则取较严者（§5）；QT-3305 折扣 15% → 双审批+CFO加签。
3. 走 `sales.quote-approve`：n3 L4 双签 + CFO 加签；产物 `quote-approve-<ts>.json`（quote_id / total_wan / discount_pct / approvals）。
4. 输出报价说明与审批轨迹到 `reports/sales/gt-01.md`，逐项标注 (文件, 行, 列) 证据；写审计（审批人 + 依据数据版本 + 产物哈希）。

**GT-SALES-02 本月赢单复盘（可满足）**
1. 取报告月：`pipeline.close_month = 2026-10`（**不得用时序戳臆造期间**）；赢单行 = 商机-C（OPP-2026-0103，660 千元，合同 HT-2026-0421）、商机-J（OPP-2026-0110，1500 千元，合同 HT-2026-0427）。
2. 交叉取报价证据：QT-3303（89.5 万元，12% 折扣，双审批）、QT-3310（146.6 万元，11% 折扣，双审批，回款条款偏离）——`quote_id` 与 `opportunity_id` 双向对齐。
3. 差额说明：商机-C 管道预估 66.0 万元 vs 报价 89.5 万元（附加项培训），商机-J 150 万元 vs 146.6 万元（折扣）——口径差异必须显式说明，不得静默对齐。
4. 输单侧同步复盘：商机-K（预算冻结）、商机-Q（竞品低价），`lost_reason` 作为证据字段。
5. 输出 win_factors / playbook_update（逐条带 evidence / rationale）；落 `reports/sales/gt-02.md`；写审计。

**GT-SALES-03 大区业绩达成看板**
1. 取目标：targets.csv（2026-Q4）5 大区 12 名负责人；`Σowner_target_wan = region_quota_wan`（§9 V-SALES-06）。
2. 取达成：赢单额 = Σ`amount_k`(stage=赢单, region) ÷ 10（万元）；本快照 华东 66.0 万 / 华南 150.0 万，其余大区 0。
3. 达成率 = 赢单额 / 区目标；管道覆盖率 = Σ`amount_k`(stage≠输单) ÷ 10 ÷ 区目标（§9 V-SALES-08，华中区 25.0% 触发预警）。
4. 单位统一万元，逐单元格标注证据 (文件, 行, 列)；`achievement_rate_pct` 取真实值，**禁用推测值填充**（历史版本因缺大区与目标字段置 null，本版已闭合）。
5. 输出阶段×金额、大区×达成、负责人目标分解三段；落 `reports/sales/gt-03.md`；写审计。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-SALES-01 必填与枚举 | pipeline：opportunity_id / stage / amount_k / owner / region / probability_pct / close_month / customer_id 非空；quotes：quote_id / discount_pct / total_wan / status / opportunity_id / customer_id / list_price_wan / discount_floor_wan / approval_route / payment_terms / terms_deviation 非空；targets：region / region_quota_wan / owner_masked / owner_target_wan / quarter 非空；枚举白名单（阶段 §4.1、报价状态 §4.2、大区、来源、路由、条款偏离） | 缺失或越界即拒写，提示「请填写必填项/枚举非法」 |
| V-SALES-02 主键与外键 | opportunity_id、quote_id 唯一；`quotes.opportunity_id ∈ pipeline.opportunity_id`（禁孤儿行）；`quotes.customer_id ≡ 该商机 customer_id`（防串户）；`targets.region ⊆ pipeline.region` 且 `targets.owner_masked ⊆ pipeline.owner` | 外键/一致性失败即拒写；孤儿报价不得进入审批 |
| V-SALES-03 折扣阈值与加签 | `approval_route = 双审批+CFO加签`（discount ≥15）＞ `双审批`（10 ≤ discount <15，或低于底价）＞ `一级授权`（discount <10 且 ≥底价），取较严者；`status ∈ {已批准, 已审批, 已发出}` 的行必须与阈值一致（≥10% 不得为一级授权；≥15% 必须含 CFO 加签） | 档位低于规则或路由与折扣不符即 FAIL，不得置已批准/已发出 |
| V-SALES-04 低于底价必须转审批 | 逐行判定 `total_wan < discount_floor_wan`：命中行 `approval_route ∈ {双审批, 双审批+CFO加签}`；草稿命中时提交必须进入 `sales.quote-approve`（不得直接发送） | 低于底价且未转审批即一票否决（quote-calc acceptance 原文）；样例 QT-3301 / QT-3304 / QT-3312 |
| V-SALES-05 金额恒等式与单位口径 | 报价恒等式 `total_wan = round(list_price_wan × (1 − discount_pct/100), 1)` 逐行成立；单位口径：pipeline 千元、quotes/targets 万元，报告与产物统一万元（`amount_k ÷ 10`）；`close_month` 必须与 `close_date` 月份一致 | 恒等式不成立或单位混用即拒绝出数；跨表比较须先折算并注明口径 |
| V-SALES-06 目标分解合计 = 区目标 | `Σ owner_target_wan(region) = region_quota_wan`，5 大区全部成立（华东 900 / 华南 600 / 华北 520 / 西南 280 / 华中 360，误差 0）；同区 `region_quota_wan` 取值一致 | target-split acceptance 原文「合计必须等于区目标」；不等即拒出分解表 |
| V-SALES-07 管道汇总勾稽 | 管道周报的 stage×count×amount_k 汇总必须等于 pipeline.csv 全量明细合计（Σ20 行 `amount_k` = 15,790 千元 = 1,579.0 万元；其中赢单 2,160 千元 = 216.0 万元）；`probability_pct` 与阶段枚举一一对应 | 汇总与明细不一致即拒绝出报告；口径差异需显式说明（如赢单额 vs 管道预估） |
| V-SALES-08 管道覆盖率 | `Σ amount_k(stage≠输单) ÷ 10 ÷ region_quota_wan ≥ 40%`；本快照 华东 71.1% / 华南 41.5% / 华北 50.8% / 西南 75.0% / **华中 25.0%（刻意埋点预警）** | 低于阈值仅**预警**（黄灯）不阻断，进入线索补量清单 |
| V-SALES-09 状态迁移合法 | 阶段不可越级（§4.1）；`stage=输单` 必填 `lost_reason`；`stage=赢单` 必填 `contract_no`；`status=已驳回` 必填 `note`；报价 `status ∈ {待审批, 已批准, 已审批, 已发出}` 而商机 `stage ∈ {线索, 接触}` → 阶段滞后预警（黄灯，样例 QT-3302）；草稿态而商机 `stage=线索` → 提示补齐阶段推进（样例 QT-3304） | 非法迁移回退并记审计；预警项须在报告中列明，不阻断流程 |
| V-SALES-10 脱敏与边界 | `discount_floor_wan` 出域仅出「是否低于底价」结论；`customer_contract` 口径（合同号/条款/正文）禁出原文；客户标识仅 `CUST-###` + `某<行业>` 掩码形态；人员仅「姓+****」；PII 禁入记忆层 | 任一违规即一票否决（redact_gate 未命中即出域） |
| V-SALES-11 交付验收 | quote-approve：≥10% 双审批、≥15% CFO 加签；quote-calc：低于底价必须转 quote-approve；pipeline-report：万元口径可追溯 pipeline.csv；contract-review：回款条款偏离标准必须双审批；target-split：合计等于区目标；win-review：结论可追溯到商机记录 | 任一条不满足即交付不合格，重跑并补证据 |

---

## §10 特殊约束

1. **CRM 只读接入与合同原文边界**（scene 尾注原文）：CRM 集成走扩展位 `cap.ind.crm-readonly`，**只读**，不得回写 CRM；合同原文与条款正文不外发，本域只落地合同要素列（`contract_no` / `payment_terms` / `terms_deviation`）。
2. **数据规模**：demo 数据由「5 行 pipeline / 4 行 quotes 模板继承 002」升级为本设计规格——pipeline 20 行 / quotes 15 行 / targets 12 行（每表 ≥12 行），与数据字典逐表核对（文件名/行数/字段）。
3. **声明与落地对照**：scene 数据资产名为 xlsx，工作区落地为 UTF-8 CSV（同名归一化由 `scripts/data-consistency-check.mjs` 校验）；scene/Type-Dict 的 contracts.xlsx **未落地为独立表**，其字段级承载为 quotes.csv 追加列；targets.csv 为本域新增派生表（级别保守继承 L2）。`pipeline.csv` 追加 12 列、`quotes.csv` 追加 11 列，**原生列名与列序均未改动**，原 5 条商机行与原 4 条报价行取值逐字保留。
4. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `sales` 段仍只含 5 行 pipeline / 4 行 quotes 的旧快照；**重跑该脚本会覆盖本页已补齐的数据**。本域数据的权威版本以本页 §1/§1.1 为准，重跑后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
5. **记忆层**：`pii_allowed=false`、`exclude=[]`；客户/联系人掩码标识、底价明细与合同要素禁入记忆层与公网检索；产物只落 `reports/sales/` 与 `templates/workspace/deliverables/sales/`。
6. **回滚**：6 条工作流各带 savepoint 标签（pre-quote-approve / pre-win-review / pre-quote-calc / pre-pipeline-report / pre-contract-review / pre-target-split），失败即回滚；副作用统一在 after_complete 钩子实现，不在页面散落业务逻辑。
7. **规则命中样例（刻意埋点，用于回归测试）**：QT-3301（8% 折扣但低于底价 → 双审批）、QT-3304（草稿低于底价，提交必须转审批）、QT-3305/3306/3308/3312（≥15% → CFO 加签，其中 QT-3312 已驳回）、QT-3311（毛利红线驳回）、QT-3302/3304（报价状态领先于商机阶段的滞后预警）、商机-K/Q（输单必填 `lost_reason`）、华中区管道覆盖率 25.0%（预警）、QT-3310（合同 HT-2026-0427 回款条款偏离 → cmp 联动样例）——均为设计样例，非数据缺陷。
8. **未采纳的参照点（及原因）**：
   - 参照 §3.2 的多级产品/价目表（CPQ 报价配置器）：本 preset 只落 `items` 文本配置 + `list_price_wan` 目录价合计 + 底价，不建产品主数据表（产品版本与附加项词表在 §1.1 固化），配置器与价目表体系留待行业 Overlay。
   - 参照 §4.3 的可配置审批深度（N 级审批链）：本域按 acceptance 原文固定三段（一级授权 / 双审批 / 双审批+CFO加签），不引入可配置深度，避免与 manifest 的 `dual: true` 口径冲突。
   - 参照 §7.1 的产品级种子规模（全员×多期×全量商机）：本 preset 为冷启动快照（20/15/12 行，均 ≥12 行），规模扩展归生成器（脚本侧），不在本页膨胀。
   - CRM 双向同步 / 合同原文落地：scene 明令只读与「合同原文不外发」，故**故意不落地**，仅以合同要素列与结论口径出现。
9. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需销售行业化（如项目型销售、渠道分销），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
