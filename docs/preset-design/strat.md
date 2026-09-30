# Preset 设计文档 · 战略管理（strat）

> 定位：`strat.quarterly-review@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/strat.quarterly-review.yaml`（scene_id `strat.quarterly-review@1.0.0`、domain `STRAT`；required_capabilities 3 = cap.excel.panel / cap.approval.multi / cap.redact.all；skills 3；policies：min_level=L4 / dual_approval=**true** / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="strat"` 共 6 条）+ `manifests/workflows/strat.*.yaml`
> - Skills：`templates/skills-domain/strat/SKILL-*.md`（含意图路由 `SKILL-cockpit-intent.md`）；知识种子 `templates/knowledge/seeds/strat.md`；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/strat/okr.csv`、`weekly.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2（字段级字典写法）、§3.3（状态枚举）、§4（工作流规格＋联动）、§5（权限模型）、§7.1（种子规模）、§8（校验规范）
>
> **数据基线日 = 2026-10-18**（ISO 2026-W42 末）；目标周期 `Q4`（2026Q4），周表为**华南区销售口径的滚动 12 周**（W31–W42，跨 2026Q3 尾与 Q4 头）；全部为合成数据，非真实经营数据，不含真实企业信息。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| okr.csv | L2 | —（scene 声明 `pii_fields: []`） | 18 | OKR 目标与 KR 台账（4 个 Objective × 共 18 条 KR，全部 Q4）：原 5 列（objective/kr/progress_pct/quarter/owner）+ 追加 10 列（kr_id/dept/dept_code/metric_unit/baseline_value/target_value/status/confidence/due_week/updated_at）；是 `strat.okr-set` / `strat.quarterly-review` 的判定基准，`weekly.kr_ref` 的外键目标 |
| weekly.csv | L3 | — | 12 | 华南区经营周报台账（滚动 12 周 W31–W42）：原 5 列（week/revenue_wan/orders/new_customers/risk_note）+ 追加 10 列（week_start/week_end/period/dept/dept_code/revenue_target_wan/risk_level/risk_owner/kr_ref/updated_at）；营收/订单/新客为**未公开经营数字**（无 PII，但按经营敏感保守定级 L3），是 `strat.weekly-report` 的行级取证来源 |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按"去扩展名 + 前缀"匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 okr_master.xlsx / type-dict 的 `strat, okr_master, table, L2, none` | okr.csv | L2 |
| （无 scene 声明；`strat.weekly-report` 行级取证与 GT-STRAT-02 需要） | weekly.csv | L3（保守定级） |

- `comp-review-merged.xlsx`（scene 声明的合并薪酬盘点，`salary_merged`）按 scene 尾注**只在 L4 命名空间内以区间口径引用**：本域不落任何个人薪酬明细列，仅在 `quarterly-review` 的 `comp_review_flag` 中出"是否涉及/区间结论"（详见 §7 与 §10-1）。
- 表头英文小写下划线、UTF-8（无 BOM）、逗号分隔、字段内不使用英文逗号；空值统一写 `-`；`revenue_wan` / `*_wan` 单位**万元**、`new_customers` 单位**家**、`orders` 单位**单**。
- `okr.csv` 原 5 列、`weekly.csv` 原 5 列的**列名与列序均未删改**，仅追加列（追加列已逐字段写入 §1.1）；`weekly.csv` 原 4 行（W39–W42）逐字保留。
- 每表数据行 ≥10（§15.4 校验下限），本页行数以上表为准（不含表头）。
- **可复算口径**（§9 逐项校验）：①逐周 `round(revenue_wan × 10000 / orders, 2)` 落在 40,000–41,600 元（即 4.00–4.15 万元）；②`Σ weekly(period=2026Q4).revenue_wan = 4,024` 万元（Q4 截至基线日累计，**禁外推为季度全量**）；③`okr` 状态分布 `on_track 4 / at_risk 9 / behind 4 / done 1 = 18`。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`（不写英文逗号，避免破坏 CSV 分隔）。

#### 1.1.1 okr.csv（15 列 = 原生 5 列 + 追加 10 列，18 行）

表头逐字：`objective,kr,progress_pct,quarter,owner,kr_id,dept,dept_code,metric_unit,baseline_value,target_value,status,confidence,due_week,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| objective | string | 是 | 目标（Objective）名称，同一目标下多条 KR 共用（本快照 4 个：华南区营收增长 / 组织效能提升 / 产品竞争力提升 / 竞争应对与经营韧性）；原始列 |
| kr | string | 是 | KR 标题，**必须为"指标 + 目标值"形态**（如 `KR1 新客数 +30%`、`KR4 交付周期 ≤30 天`），是可量化校验（V-STRAT-01）的第一道防线；原始列 |
| progress_pct | number | 是 | 季度里程碑加权完成度（0–100 整数），由 KR owner 按月度节奏填报；**非**累计值/目标值的机械比，禁由 weekly 倒算（V-STRAT-06）；状态判定依据见 §4.1；原始列 |
| quarter | enum | 是 | 目标周期 Q1–Q4（本快照全为 `Q4`，对应 2026Q4，与复盘 `period` 一致，V-STRAT-05）；原始列 |
| owner | string | 是 | KR 责任人/责任部门（保留原始口径：销售VP / 客户成功部 / 产品商业化 / HRBP / 各BU负责人；新增行用角色口径 产品VP / 交付负责人 / 市场部负责人）；原始列 |
| kr_id | string | 是 | KR 唯一主键，前缀即 Objective 码：`SC-` 华南区营收增长 / `B-` 组织效能提升 / `PV-` 产品竞争力提升 / `RC-` 竞争应对与经营韧性；`weekly.kr_ref` 外键指向本列；追加列 |
| dept | enum | 是 | 归属部门（词表：华南区销售部 / 客户成功部 / 产品与商业化部 / 交付与实施部 / 人力资源部 / 市场部），与 `weekly.dept` 同词表；追加列 |
| dept_code | enum | 是 | 部门码 SL-SC / CS / PD / DL / HR / MK（与 `weekly.dept_code` 一致，用于跨表连接）；追加列 |
| metric_unit | enum | 是 | 度量单位：家 / % / 万元 / 万元/人 / 天 / 分 / 个 / 倍 / 项；追加列 |
| baseline_value | number | 是 | 基线值（2025Q4 同口径），与 `target_value`、`metric_unit` 构成"必可量化"三要素；追加列 |
| target_value | number | 是 | 季度目标值（与 `kr` 标题中的目标值同口径：如 SC-KR1 baseline 180 家 → target 234 家 = +30%）；追加列 |
| status | enum | 是 | KR 状态机取值 **on_track / at_risk / behind / done**（阈值与迁移见 §4.1；`done` 必须 `progress_pct=100`）；追加列 |
| confidence | enum | 是 | owner 对达成判断的置信度：高 / 中 / 低（`低` + `at_risk`/`behind` 者为复盘必查清单）；追加列 |
| due_week | string | 是 | KR 检查点 ISO 周（W50 双周检查点 / W52 季末），必须 ≥ `weekly.week` 最大值（V-STRAT-07）；追加列 |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`（本快照 2026-10-18）；审计"依据数据版本"取该值；追加列 |

#### 1.1.2 weekly.csv（15 列 = 原生 5 列 + 追加 10 列，12 行）

表头逐字：`week,revenue_wan,orders,new_customers,risk_note,week_start,week_end,period,dept,dept_code,revenue_target_wan,risk_level,risk_owner,kr_ref,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| week | string | 是 | ISO 周号 `W31`–`W42`（华南区销售口径，滚动 12 周：Q3 尾 9 周 + Q4 头 3 周）；原始列 |
| revenue_wan | number | 是 | 当周确认营收（**万元**，整数，华南区口径）；原始列 |
| orders | number | 是 | 当周订单数（单）；原始列 |
| new_customers | number | 是 | 当周新增客户数（家）；原始列 |
| risk_note | string | 否 | 风险摘要，**必附责任方**（如 `投放ROI 周环比 -7%（市场部复盘）`）；无风险写 `-`；原始列 |
| week_start | date | 是 | ISO 周起始日（周一）`YYYY-MM-DD`；追加列 |
| week_end | date | 是 | ISO 周结束日（周日）；`week_end − week_start = 6 天`（V-STRAT-05）；追加列 |
| period | enum | 是 | 归属季度 2026Q3 / 2026Q4，必须与 `week_start` 的 ISO 季度一致；追加列 |
| dept | enum | 是 | 数据归属部门（本表全为 华南区销售部，与 `okr.dept` 同词表）；追加列 |
| dept_code | enum | 是 | 部门码 SL-SC（与 `okr.dept_code` 一致）；追加列 |
| revenue_target_wan | number | 是 | 当周营收目标（**万元**）：Q3 周 1200 / Q4 周 1500；用于逐周达成率与异动归因，**不得改写为事后目标**；追加列 |
| risk_level | enum | 是 | 风险等级：无 / 低 / 中 / 高（无风险行 = `无`）；追加列 |
| risk_owner | string | 是 | 风险跟进责任方（部门/角色：市场部 / 交付与实施部 / 产品与商业化部 / 供应链 / 人力资源部 / 财务部 / 法务与合规 / 行政部），无风险写 `-`；追加列 |
| kr_ref | ref | 是 | → `okr.kr_id` 外键，**分号分隔多值**（如 `SC-KR4;SC-KR5;RC-KR3`）：该周异动/风险归因命中的 KR；`status ∈ {at_risk, behind}` 的 KR 必须至少被 1 条**风险行**（`risk_note ≠ -`）命中（V-STRAT-03）；追加列 |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`（本快照 2026-10-18）；追加列 |

---

## §2 技能规格（scene skills：strategy-decode / biz-analysis / competitor-watch）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| strategy-decode | 把年度目标拆解为季度 KR 并标注依赖（承接 `strat.okr-set` / `strat.quarterly-review` / `strat.quarter-close`） | data/strat/okr.csv、weekly.csv | reports/strat/*（KR 追踪表、复盘产物、关账决议） | L4 | 每条 KR 必可量化（metric_unit + baseline_value + target_value + progress_pct 齐备，V-STRAT-01）；`status` 与进度阈值一致（V-STRAT-02）；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| biz-analysis | 经营周报指标计算与异动归因（收入/订单/风险三段） | data/strat/weekly.csv（+ fin/budget.csv 公司级汇总做对照） | reports/strat/*（周报正文、`weekly-report-<ts>.json`） | L4 | 数字可追溯到 weekly.csv **行级**（workflow acceptance 原文）；逐周达成率与 AOV 必须可复算（V-STRAT-06）；连续 3 次失败→登记 capability-gap |
| competitor-watch | 竞品公开信息**脱敏摘要**（禁原始链接直出、禁未公开财务） | 外部公开检索 + data/strat/okr.csv（关联 RC-KR1/RC-KR2） | reports/strat/*（`competitor-brief-<ts>.json`：competitor / move_type / impact / our_response） | L4 | 外部内容必须经脱敏摘要后出域，原文/原始链接一律不得落产物（V-STRAT-08）；涉及并购条款（`ma_terms`）一票否决；连续 3 次失败→登记 capability-gap |

- 三技能文件（`templates/skills-domain/strat/SKILL-*.md`）均声明 `min_level: L4`、`redact_gate: true`，依赖能力 `cap.excel.panel` + `cap.redact.all`（与 scene `required_capabilities` 一致，scene 另含 `cap.approval.multi`）；越级读取即 DENY。
- 意图路由技能 `strat-intent`（`templates/skills-domain/strat/SKILL-cockpit-intent.md`）当前只登记 2 条路由（`review-approve` / `weekly-report`），指向上代命名；本页以落地工作流索引为准（`quarterly-review` 承载原 review-approve 能力，差异登记见 §10-6）。跨域意图（如"调薪包成本影响"）交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="strat"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| strat.quarterly-review@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"季度战略复盘（合并薪酬盘点走双审批）触发对外/生效动作"；hitl_nodes=[n3] | `quarterly-review-<ts>.json`：**period / okr_reached / comp_review_flag / decision**；acceptance：合并薪酬盘点仅区间口径；**双审批通过方可归档** | 季度战略复盘（强审批）；skill=strategy-decode；节点链 skill(n1)→condition(n2)→approval(n3)→tool `cap.excel.panel.write`(n4)→audit(n5)；rollback=savepoint `pre-quarterly-review` |
| strat.quarter-close@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"季度关账经营决议（含调薪包）触发对外/生效动作"；hitl_nodes=[n3] | `quarter-close-<ts>.json`：**period / highlights / comp_package_flag / approvals**；acceptance：**调薪包触发 COMP 域双审批联动** | 季度关账经营决议（含调薪包）；skill=strategy-decode；节点链同上；rollback=savepoint `pre-quarter-close` |
| strat.weekly-report@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `weekly-report-<ts>.json`：**week / revenue_wan / orders / risks / next_actions**；acceptance：**数字可追溯到 data/strat/weekly.csv 行级** | 经营周报（收入/订单/风险三段）；skill=biz-analysis；节点链 skill(n1)→tool(n2)→audit(n3)；rollback=savepoint `pre-weekly-report` |
| strat.okr-set@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空） | `okr-set-<ts>.json`：**objective / kr_list / quarter / owner**；acceptance：**每条 KR 必须可量化（progress_pct 数值）** | OKR 目标与 KR 制定（表格化提交）；skill=strategy-decode；rollback=savepoint `pre-okr-set` |
| strat.competitor-brief@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `competitor-brief-<ts>.json`：**competitor / move_type / impact / our_response**；acceptance：**外部检索内容必须经脱敏摘要（禁原文外发）** | 竞品动态简报（脱敏摘要口径）；skill=competitor-watch；rollback=savepoint `pre-competitor-brief` |
| strat.org-inventory@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `org-inventory-<ts>.json`：**position / incumbent_masked / successor_masked / risk_level**；acceptance：**人员字段一律掩码（Type-Dict L4 口径）** | 组织盘点（关键岗位/继任）；skill=biz-analysis；rollback=savepoint `pre-org-inventory` |

- 节点链：approve 类为 skill(n1) → condition(n2) → approval(n3) → tool `cap.excel.panel.write`(n4) → audit(n5)；report/calc 类为 skill(n1) → tool(n2) → audit(n3)。上表"审批落点"列对无审批工作流明示为"无审批节点"，**无空值、无占位符**。
- **命名差异登记**：scene `workflows` 只钉 2 条基线（`strat.review-approve.yaml`、`strat.weekly-report.yaml`）。其中 `strat.review-approve.yaml` 为**工作流索引之外的上代文件**（带 `check: {expected, actual_ref, on_fail: rollback}` 校验段，节点链与 quarterly-review 同构），不在索引的 6 条内；同能力在索引侧落地为 **`strat.quarterly-review@1.0.0`**（同为 L4 双审批 + savepoint），本页以落地文件与索引为准。
- 交付字段与 GT 判定解耦：`okr_reached`（bool）只在全部 KR `status=done` 时为 true；本快照 1/18 达成、平均进度 44.2% → `false`，产物必须附 at_risk/behind 清单与行级证据。

---

## §4 状态机

### 4.1 KR 状态（okr.status，KR_STATUS）

```
on_track ──（进度跌破 60）──→ at_risk ──（进度跌破 25）──→ behind
    ↑                              │                        │
    └──（进度回升，需证据行支撑）──────┴────────────────────────┘
done：progress_pct = 100（终态；须 updated_at 落在当期季度内）
```

| 状态（CSV 落值） | 判定（progress_pct） | 含义 | 允许后继 | 证据字段 |
|---|---|---|---|---|
| on_track | ≥ 60 | 按节奏推进，预期达成 | at_risk / behind / done | okr：kr_id / progress_pct / confidence / updated_at |
| at_risk | 25–59 | 进度偏离节奏，需专项动作 | behind / on_track / done | + weekly 风险行命中（`kr_ref` 命中 ≥1 次，V-STRAT-03） |
| behind | < 25 | 显著落后，须列复盘必查清单 | at_risk / on_track / done | + weekly 风险行命中 + `confidence=低` 时须给整改责任人与检查点（`due_week`） |
| done | = 100 | 已达成（终态） | —（终态；不得只改状态不改 progress） | progress_pct=100 + updated_at 落在当期 |

- 迁移只经唯一函数 `setStatus(entity, to, by)` 并写操作日志（参照 §8.3）；**禁止跳级改写**（如 behind → done 而无 progress 变化）、禁止 `done` 回退（须重开 KR 记录并留痕）。
- 判定以阈值为准、以证据为限：`status` 与 `progress_pct` 阈值不一致即 V-STRAT-02 FAIL；`at_risk`/`behind` 缺 weekly 证据行即记"证据缺口"（不得直接判定达成）。
- 本快照分布（18 条）：on_track 4（SC-KR2 68 / B-KR1 80 / B-KR3 62 / RC-KR1 75）、at_risk 9、behind 4（SC-KR5 18 / B-KR4 22 / PV-KR4 12 / RC-KR4 21）、done 1（B-KR5 = 年度编制与人力预算评审完成）。样例：`SC-KR5 经销回款周期 ≤45 天`（progress 18，behind，证据行 W37/W39 回款周期 68 天、华南经销商回款延迟）。

### 4.2 季度复盘决议（`quarterly-review-<ts>.json` 的 decision）

| 状态（落值） | 进入条件 | 允许后继 | 证据字段 |
|---|---|---|---|
| draft 草稿 | 取数与 KR 判定完成，尚未提交 | pending_dual_approval | okr.csv 全量 + weekly 行级证据 |
| pending_dual_approval 待双审批 | 提交审批（hitl n3，L4 双审批） | approved / rejected | `approvals` 计数 0/2→1/2；审批人 + 依据数据版本（okr.updated_at） |
| approved 已通过 | 双审批 **2/2** 通过 | archived | 两条审批记录 + 产物哈希 |
| rejected 已驳回 | 任一审批人 ✗（判定证据不足 / 薪酬盘点非区间口径） | draft（补证重提） | 驳回原因必填 + 缺口项清单（V-STRAT-03） |
| archived 已归档 | 通过后写入 `reports/strat/` 与 `templates/workspace/deliverables/strat/`（终态） | —（终态） | 产物哈希 + 审计事件 |

**禁止**：审批未满 2/2 即归档（acceptance 原文"双审批通过方可归档"）；驳回后原样重提；把 `comp_review_flag` 写成个人级数据。

### 4.3 季度关账决议（`quarter-close-<ts>.json` 的 decision，含调薪包）

```
数据封版（period 取最近已结束季度，本快照 2026Q3）
  → draft → pending_dual_approval（L4 双审批）
  → approved ─┬→ comp_package_flag=true：触发 COMP 域双审批联动（comp.salary-adjust / comp.queue-approve）
              └→ comp_package_flag=false：仅经营决议归档
  → rejected：回退 draft（补证）；archived：终态
```

| 判定 | 条件 | 证据字段 |
|---|---|---|
| 免联动关账 | `comp_package_flag=false` | quarter-close 产物：period / highlights / approvals |
| 触发薪酬包联动 | `comp_package_flag=true` | + `comp/adjust_queue.csv`：batch / status / approvals / current_salary_range_wan（**只引用区间列**） |
| 回退 | 审批 ✗ 或调薪包越过区间口径闸门 | 驳回原因 + redact_gate 未命中记录 |

---

## §5 审批链（节点-角色-双审批-条件阈值）

| 流程 | 节点链 | 审批角色（建议映射） | 双审批 | 阈值/条件 | manifest 落点 |
|---|---|---|---|---|---|
| 季度战略复盘（strat.quarterly-review） | decode n1 → condition n2 → approval n3 → write n4 → audit n5 | ① 战略负责人（CSO）② 合规与数据口径审批人（HRD/法务） | **是**（`dual:true`） | n2 原文"复盘结论涉及组织与预算变更"；涉及合并薪酬盘点时产物**仅区间口径**；归档锁定至 2/2 通过 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 季度关账经营决议（strat.quarter-close） | decode n1 → condition n2 → approval n3 → write n4 → audit n5 | ① CEO/CSO ② CFO（调薪包口径）→ 涉及人力条款加签 HRD | **是**（`dual:true`） | acceptance 原文"调薪包触发 COMP 域双审批联动"：`comp_package_flag=true` 必须 CFO+HRD 签字且 COMP 侧再走双审批 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 经营周报（strat.weekly-report） | n1 → n2 → n3 | 无审批（分级出数） | 否 | 数字可追溯至 weekly.csv 行级；**不对外发布**（对外发布走 mkt-on 发布审批链） | 无 approval 节点（kind=report） |
| OKR 制定（strat.okr-set） | n1 → n2 → n3 | 无审批（草拟/表格化提交） | 否 | 每条 KR 必可量化；KR 生效需经季度复盘/关账审批链，本流程只产出草稿版 | 无 approval 节点（kind=calc） |
| 竞品动态简报（strat.competitor-brief） | n1 → n2 → n3 | 无审批（脱敏摘要） | 否 | 外部检索经脱敏摘要；禁原文与原始链接出域 | 无 approval 节点（kind=report） |
| 组织盘点（strat.org-inventory） | n1 → n2 → n3 | 无审批（只读视图） | 否 | 人员字段一律掩码（`incumbent_masked` / `successor_masked`） | 无 approval 节点（kind=report） |

- 场景基线 `policies.permission.min_level=L4`、`dual_approval=**true**` 为**域默认**——本域比 fin/rec 更严：**任何审批动作都是双审批**，两条 approve 工作流在流程级同样 `dual:true`（规则**单调加严、不放松**）。
- 对外/生效动作只有 n3 一条链：condition 节点不得绕过审批直连写能力（manifest 注释原文）；审批意见（通过/驳回原因）写入 audit n5（审批人 + 依据数据版本 + 产物哈希）。
- 双审批角色不可同一人兼任；`approvals` 计数不足 2 时产物不得置 `approved`，也不得归档（V-STRAT-09）。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，不得绕过 §5 审批链。跨域只做**字段级**联动，不做跨域数值对账（各域合成口径独立）。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| OKR/KR 定版（`strat.okr-set` done 或季度复盘 approved） | **prf 域**接收部门/岗位目标基线：KR 按 `dept` 分解为部门目标与岗位 KPI（只出目标与口径，不改 prf 台账） | okr.csv：kr_id / dept / dept_code / metric_unit / target_value / quarter；prf/kpi.csv：kpi / target / period / dept / position / weight |
| 季度复盘决议 approved（`strat.quarterly-review`） | ①经营评价基线供 **prf** 校准参考（不写等级，等级由 prf.calibration-approve 决定）；②合并薪酬盘点**仅区间口径**入汇报；③审计留痕 | quarterly-review-<ts>.json：period / okr_reached / comp_review_flag / decision；okr.csv：kr_id / status / progress_pct；prf/calibration.csv：cycle / dept / calibrated_grade（只读引用） |
| 季度关账 approved 且 `comp_package_flag=true`（`strat.quarter-close`） | **comp 域**调薪包双审批联动：按部门/批次生成调薪提案，COMP 侧独立走双审批；本域只出 flag 与**区间口径**，禁出个人薪酬数值 | quarter-close-<ts>.json：period / comp_package_flag / approvals；comp/adjust_queue.csv：batch / status / approvals / current_salary_range_wan / proposed_salary_range_wan（区间列） |
| 季度关账 approved（关账口径） | **fin 域**预算引用：下一期预算包与部门执行率按 `fin.budget-review` 审议落地；本域只提供经营结论与口径 | quarter-close-<ts>.json：period / highlights；fin/budget.csv：dept / period / budget_wan / used_wan / revenue_wan / net_wan；budget-review-<ts>.json：dept / budget_wan / delta_wan / reason |
| 反向输入：`fin.monthly-report` done | 公司级 revenue / cost / net 与部门执行率作为 `strat.weekly-report` 与季度复盘的**公司级对照口径**（周表为华南区口径，两者**不可直接相加**） | fin/budget.csv：period / revenue_wan / used_wan / net_wan；weekly-report-<ts>.json：week / revenue_wan |
| 竞品动态简报 done（`strat.competitor-brief`） | **mkt-on 域**投放/内容策略调整输入：只交付脱敏摘要与应对建议，禁原始链接直出 | competitor-brief-<ts>.json：competitor / move_type / impact / our_response；mkt-on/content_calendar.csv：date / channel / title / status |
| 组织盘点 done（`strat.org-inventory`） | **rec/trn 联动**：关键岗位缺口 → 招聘优先序；继任覆盖不足（B-KR4 behind）→ 领导力培养计划 | org-inventory-<ts>.json：position / incumbent_masked / successor_masked / risk_level；okr.csv：B-KR1 / B-KR4 的 progress_pct |

---

## §7 权限矩阵

- 最低数据级别：**L4**（scene `policies.permission.min_level=L4`，越级读取即 DENY）；双审批：**域基线 `dual_approval=true`**（本域任何审批动作均双人，见 §5）。
- 脱敏字段（redact_gate，gate=`redact_gate`）：`salary_merged`、`ma_terms`。落地映射：`salary_merged` → 合并薪酬盘点（scene 声明的 comp-review 资产）**仅以区间/结论口径**出现（`comp_review_flag`），本域不落明细列；`ma_terms`（并购条款）**不落任何明细列**，仅允许"是否涉及"的结论引用。
- 记忆层策略（scene `policies.memory`）：`pii_allowed=false`、`exclude=[]` —— 个人级数据与未公开经营数字一律禁入记忆层，仅允许非 PII 汇总结论（如 KR 状态分布、周度趋势）入图；产物只落 `reports/strat/` 与 `templates/workspace/deliverables/strat/`。

| 对象 | 级别 | 脱敏（redact_gate） | 记忆层 | 双审批 |
|---|---|---|---|---|
| okr.csv（目标/KR/责任人） | L2 | 无 PII；责任人为角色/部门口径，禁补个人联系方式 | 允许非 PII 汇总结论入记忆层 | 复盘/关账决议：是（L4 双审批，§5） |
| weekly.csv（营收/订单/新客） | L3 | 无 PII；**未公开经营数字**出报告须行级可溯，禁原文外发（§10-3） | 禁入（经营敏感） | 周报：否（无审批，仅 audit） |
| 合并薪酬盘点（`salary_merged`） | L4 | 仅区间口径：个人薪酬数值/个人绩效/身份信息一律不出现在任何产物与审批件 | 禁入 | 是（`comp_review_flag=true` 时双审批 + COMP 域联动） |
| 并购条款（`ma_terms`） | L4 | **禁入任何输出**（未公开重大信息），仅可出"是否涉及"结论 | 禁入 | 是（涉及即双审批 + 法务加签） |
| 人员掩码字段（org-inventory） | L4 | `incumbent_masked` / `successor_masked` 一律掩码（姓 + `****`），掩码前值不进产物 | 禁入 | 否（只读视图） |

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-STRAT-01 | 把 2026 年度战略拆解为 Q4 季度 KR 并生成追踪表 | strategy-decode + cap.excel.panel / cap.approval.multi | L4+双审批 | reports/strat/gt-01.md | data/strat/okr_master.xlsx → okr.csv（+ weekly.csv 取证）；comp-review-merged.xlsx → 仅区间口径引用 | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据（逐 `kr_id`） |
| GT-STRAT-02 | 汇总本月经营周报并给出三大异动归因 | biz-analysis + cap.excel.panel / cap.approval.multi | L4+双审批 | reports/strat/gt-02.md | 同上（主用 weekly.csv） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据（逐 `week` 行） |
| GT-STRAT-03 | 生成竞品季度动态脱敏摘要（禁含未公开财务） | competitor-watch + cap.excel.panel / cap.approval.multi | L4+双审批 | reports/strat/gt-03.md | 同上（外部检索 + okr.csv 的 RC-KR 系列） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据；**未脱敏/含未公开财务 = 一票否决** |

### 任务分解（scene `expected_plan` 指向本页）

**GT-STRAT-01 年度战略拆解为 Q4 KR 并生成追踪表**
1. 读 okr.csv 全量 18 行（4 个 Objective：华南区营收增长 5 / 组织效能提升 5 / 产品竞争力提升 4 / 竞争应对与经营韧性 4），按 `kr_id` 归一化"Objective → KR → owner → 部门 → 度量 → 基线/目标"。
2. 判定校验：`status` 必须与 §4.1 阈值一致（on_track ≥60 / at_risk 25–59 / behind <25 / done=100）；`done` 行 `progress_pct` 必须 = 100（样例 B-KR5）。
3. 交叉取证：对 13 条 `at_risk`/`behind` 的 KR，逐条在 `weekly.kr_ref` 中命中风险行并落 (文件, 行, 列) 证据（如 SC-KR5 ← W37/W39；PV-KR4 ← W33/W35；RC-KR2 ← W41）。
4. `comp_review_flag`：合并薪酬盘点**仅区间口径**（不得出现个人薪酬数值、个人绩效、身份信息）。
5. 判定 `okr_reached`：本快照 1/18 达成、平均进度 44.2% → `false`；输出追踪表 + at_risk/behind 清单，落 `reports/strat/gt-01.md`；归档动作锁定至双审批 **2/2**（初始为 pending_dual_approval 0/2）。

**GT-STRAT-02 经营周报与三大异动归因**
1. 取报告期：`weekly.csv` 中 `period=2026Q4` 的 3 行（W40–W42）为当期，`period=2026Q3` 的 9 行（W31–W39）为基线期；**不得用时序戳臆造期间**。
2. 周报三段：收入（`revenue_wan` + 周目标达成率 = revenue_wan / revenue_target_wan）、订单（`orders`、AOV = revenue_wan×10000/orders）、风险（`risk_note` + `risk_level` + `risk_owner`）；产物字段 week / revenue_wan / orders / risks / next_actions。
3. 三大异动归因（本快照）：① **W41** 营收 1,194（环比 **-11.7%**）、新客 38（四期最低）、投放 ROI -7% → 获客效率下滑（`kr_ref` = SC-KR4;SC-KR1;SC-KR3;RC-KR2;B-KR2）；② **W33** 营收 1,086（12 周最低，环比 -5.4%）→ 深圳大客户验收延期致收入确认后移（PV-KR4、PV-KR2）；③ **W37** 营收 1,162（环比 -6.0%）+ 回款周期 68 天 → 回款/现金流风险（SC-KR5）。
4. 勾稽红线：`Σ weekly(2026Q4).revenue_wan = 4,024` 万元为**截至基线日累计**，禁外推为季度全量（V-STRAT-06）；每个数字附 (文件, 行, 列) 证据；落 `reports/strat/gt-02.md`；写审计。

**GT-STRAT-03 竞品季度动态脱敏摘要**
1. 输入为外部公开检索 + 本域 `okr.csv` 中 RC-KR1（竞品动态监控覆盖率）/ RC-KR2（重点投放 ROI）作影响评估锚点。
2. 摘要化输出四字段：competitor / move_type / impact / our_response；**禁原文、禁原始链接直出**（workflow acceptance 原文），只出脱敏结论。
3. **禁含未公开财务**（scene GT 原文）：不得引用合并薪酬盘点、未披露经营数字；涉及并购条款（`ma_terms`）一票否决。
4. 落 `reports/strat/gt-03.md`；审计记"数据版本 + 产物哈希"。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-STRAT-01 KR 必可量化 | 每行 `metric_unit` / `baseline_value` / `target_value` / `progress_pct` 齐备且为数值；`progress_pct ∈ [0,100]` 整数；`kr` 标题须为"指标 + 目标值"形态（原文 5 条均满足，如 `KR2 客户续约率 92%`） | FAIL：任一缺项或不可量化（如"加强协同"式表述）即拒写，提示补量化口径 |
| V-STRAT-02 状态—进度一致 | `status` 与阈值映射一致：on_track ≥60 / at_risk 25–59 / behind <25 / done=100；`status` ∈ 四值白名单 | FAIL：不一致即拒写（本快照 18 行全部通过） |
| V-STRAT-03 状态—证据覆盖 | `status ∈ {at_risk, behind}` 的 KR（13 条）必须至少被 1 条**风险行**（`risk_note ≠ -`）的 `kr_ref` 命中；`on_track` 的 KR 在最近 4 周（W39–W42）不得被 `risk_level=高` 命中 | FAIL：未命中记"证据缺口"，不得直接判定达成/关闭；高风险误挂 on_track 立即回退状态 |
| V-STRAT-04 主键与外键 | `okr.kr_id` 唯一；`weekly.kr_ref`（分号分隔多值）⊆ `okr.kr_id`，禁止孤儿引用 | FAIL：孤儿引用拒写；重复主键覆盖前值并记审计 |
| V-STRAT-05 期间一致性 | `weekly.period` 必须等于 `week_start` 所在 ISO 季度（W31–W39→2026Q3、W40–W42→2026Q4）；`week_start` 为周一、`week_end − week_start = 6 天`；`okr.quarter = Q4` 与复盘 `period = 2026Q4` 一致；`due_week ≥ max(weekly.week)` | FAIL：跨期/错周即拒写；期间冲突时先修数据再出报告（禁以时序戳补数，U10 类问题） |
| V-STRAT-06 合计口径勾稽与禁倒轧 | 逐周 `round(revenue_wan × 10000 / orders, 2)` 可复算（本快照 40,000–41,600 元，即 AOV 4.00–4.15 万元）；`Σ weekly(2026Q4).revenue_wan = 4,024` 万元、`Σ new_customers(2026Q4) = 135`；**progress_pct 不得由 weekly 倒算，weekly 汇总不得外推为季度全量** | FAIL：勾稽不成立即拒绝出数；出现倒轧/外推一律标 B 级并显式声明缺口 |
| V-STRAT-07 检查点与终态一致性 | `due_week` ∈ {W50, W52}（本快照）；`done` 行 `progress_pct=100` 且 `updated_at` 落在当期；`behind` 且 `confidence=低` 的行必须有整改责任人与检查点 | FAIL：终态与取值矛盾即拒写 |
| V-STRAT-08 脱敏与边界（一票否决） | `salary_merged` 一律区间口径（个人薪酬数值/绩效/身份信息不得出现）；`ma_terms` 禁入任何输出；竞品简报禁原文与原始链接直出；`incumbent_masked`/`successor_masked` 不可还原；未公开经营数字禁外发 | FAIL：任一违规即一票否决（redact_gate 未命中即出域） |
| V-STRAT-09 审批完整性 | `quarterly-review` / `quarter-close` 产物必须含 `approvals` 且计数 = 2/2 才可置 approved / archived；`comp_package_flag=true` 必须同批写 COMP 域联动请求 | FAIL：审批不足不得归档；flag 与联动不一致时回退至 pending |
| V-STRAT-10 状态迁移合法 | KR 状态与决议状态均按 §4 白名单迁移（禁跳级、禁 done 回退、禁 rejected 原样重提）；迁移只经唯一函数并写操作日志 | FAIL：非法枚举拒写；跳级迁移回退并记审计 |

---

## §10 特殊约束

1. **合并薪酬盘点只在 L4 命名空间且仅区间口径**——scene 尾注与 `quarterly-review` acceptance 原文。本域**不落任何个人薪酬明细列**：`salary_merged` 只以"合并口径的区间/结论"进入 `comp_review_flag`；个人薪酬数值、个人绩效、身份信息一律不得出现在产物、审批件与审计记录中（V-STRAT-08，一票否决）。
2. **竞品检索走脱敏摘要**——scene 尾注原文。`strat.competitor-brief` 只交付脱敏结论，**禁原始链接直出**、禁原文搬运；对外发送前必须过 `redact_gate`。
3. **未公开财务禁外发**——GT-STRAT-03 明令"禁含未公开财务"。竞品简报不得引用合并薪酬盘点与未披露经营数字；经营数字（weekly.csv）出报告须行级可溯，对外发布另走 mkt-on 发布审批链。
4. **数据口径说明（禁倒轧）**：`progress_pct` 为 KR owner 按季度里程碑填报表征，**不是**累计值/目标值的机械比；weekly.csv 为华南区销售口径的滚动 12 周（W31–W39 属 2026Q3、W40–W42 属 2026Q4），其客单价为**直销订单口径**，与 KR3"全渠道客单价"口径不同，只作趋势参照——两者不得相互倒算或外推（V-STRAT-06）。
5. **既有数据逐字保留**：`okr.csv` 原 5 列与原 5 行、`weekly.csv` 原 5 列与原 4 行（W39–W42）**逐字未改**；本版仅追加列与行（追加列已写入 §1.1），追加行为 Q3 基线周与补齐的 Objective，属**数据补齐，非口径改写**。
6. **声明与落地对照（不擅自改 manifest）**：scene 数据资产名 `okr_master.xlsx` 落地为 `okr.csv`（L2）；`comp-review-merged.xlsx` 按约束 ①**不落明细表**，只以区间口径引用；`weekly.csv` 为本域扩展表（L3，供周报与异动归因取证）。scene `knowledge_seeds` 声明 `seeds/strat/README.md`，落地为 `templates/knowledge/seeds/strat.md`；scene `workflows` 声明 `strat.review-approve.yaml`（2 节点上代文件），落地为 `strat.quarterly-review@1.0.0`；意图路由技能仍指向 `review-approve`。以上命名差异**须在 manifest/skills 侧统一修复**，本 preset 只允许改本页文档与 `templates/workspace/data/strat/`，不擅自改动。
7. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `strat` 段仍是 **5 行 okr / 4 行 weekly、仅 5 列表头**的旧快照；**重跑该脚本会覆盖本页已补齐的两张表**。本域数据的权威版本以本页 §1/§1.1 为准，重跑生成器后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
8. **记忆层与产物边界**：`pii_allowed=false`、`exclude=[]`；本域数据（含未公开经营数字）不得写入 graph-memory / pi-vault-mind；产物只落 `reports/strat/` 与 `templates/workspace/deliverables/strat/`。
9. **未采纳的参照点（及原因）**：
   - 参照 §7.1 的产品级种子规模（如全员级台账数百行）：本 preset 为冷启动样例（okr 18 行 / weekly 12 行，均 ≥10 行校验下限），规模扩展归生成器（脚本侧）。
   - 参照 §3.2 的组织人事档案/编制台账：人员主数据属 HR 域（rec/prf/comp），本域只做**组织盘点视图**（org-inventory，掩码口径），不重复建模。
   - 参照 §5 的逐角色自助权限（员工自助/候选人自助）：本域无自助入口，权限只到"域级 L4 + 双审批"，不细分页面级动作权限。
   - 并购条款（`ma_terms`）明细建模：属未公开重大信息，合规上禁落库/禁出域，故**故意不落地**，只保留"是否涉及"的结论位。
10. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需战略行业化（如项目制目标树、多区域目标分解），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
