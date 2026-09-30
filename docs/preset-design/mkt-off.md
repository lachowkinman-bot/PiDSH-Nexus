# Preset 设计文档 · 营销管理（线下）（mkt-off）

> 定位：`mkt-off.event-roi@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/mkt-off.event-roi.yaml`（scene_id `mkt-off.event-roi@1.0.0`、domain `MKT`；required_capabilities 3；skills 3；policies：min_level=L3 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="mkt-off"` 共 6 条）+ `manifests/workflows/mkt-off.*.yaml`
> - Skills：`templates/skills-domain/mkt-off/SKILL-*.md`（`event-plan` / `material-compliance` / `roi-review` + 意图路由 `SKILL-cockpit-intent.md`）；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/mkt-off/events.csv`、`materials.csv`、`dealer_agreements.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2（字段级字典写法）、§3.3（状态枚举）、§4（工作流规格＋联动汇总）、§5（RBAC 与数据边界）、§7.1（种子规模）、§8.2/§8.3（字段校验与状态迁移规范）
>
> **数据基线日 = 2026-09-29**（数据快照归属季度 `2026-Q3`；全部为合成数据，非真实活动/客户/经销商数据）。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| events.csv | L2 | —（`owner` 为部门/组级主体，`venue` 为合成场馆名） | 16 | 线下活动台账（金额单位**万元**）：原 6 列（活动/计划预算/实际支出/ROI/城市/责任主体）+ 追加 13 列（event_id/quarter/event_type/venue/start_date/end_date/venue_cost_wan/attendees/leads/leads_dedup/revenue_wan/dept_quarter_pkg_wan/status）。scene 数据资产声明名 `event-ledger.xlsx`，落地为同表同字段的 UTF-8 CSV |
| materials.csv | L2 | —（`reviewer_legal` / `reviewer_brand` 为不可还原掩码名，如 `李**`） | 14 | 物料合规台账：原 5 列（物料/审查状态/法务检查/品牌检查/责任组）+ 追加 10 列（material_id/event_id/type/version/channel/reviewer_legal/reviewer_brand/reviewed_at/external_ready/issue_type）。**非 scene 数据资产**（本域扩展表，GT-MKTOFF-01/02 物料侧取证）；级别按无 PII 定 L2，读取仍受域级 `min_level=L3` 约束 |
| dealer_agreements.csv | L3 | dealer_terms（scene 声明；落地仅保留条款**要点摘要** `terms_digest`，原文不落地）、dealer_masked（不可还原掩码） | 12 | 经销商协议与条款执行台账（L3）：经销商掩码/区域/等级/协议号/条款摘要/返利比例/独家标记/售罄率/争议标记/期间/责任部门/版本时间。承载 scene 声明的 `dealer_terms`，是 `mkt-off.vendor-brief` 的判定依据 |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按"去扩展名 + 前缀"匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 event-ledger.xlsx（`pii_fields: []`）/ type-dict `mkt-off,event-ledger,table,L2,none` | events.csv | L2 |
| scene `data_assets` 的 dealer-agreements.xlsx（`pii_fields: [dealer_terms]`）/ type-dict `mkt-off,dealer-agreements,table,L3,dealer_terms` | dealer_agreements.csv（`dealer_terms` 以 `terms_digest` 摘要形态落地） | L3 |
| （无 scene 声明；GT-MKTOFF-01/02 物料侧取证需要） | materials.csv | L2 |

- 表头英文小写下划线、UTF-8（无 BOM）、逗号分隔、字段内不使用英文逗号；**金额单位写进列名**（`*_wan` = 万元），无单位歧义。
- `events.csv` 原 6 列、`materials.csv` 原 5 列的**列名与列序均未删改**，仅追加列（追加列已逐字段写入 §1.1）；原 4 条 events 行（华南渠道会 / 经销商大会 / 行业展位 / 年终答谢会）与 4 条 materials 行（经销商手册 V5 / 展台易拉宝 / 伴手礼包装 / 现场背板）的**既有取值逐字保留**。
- 每表数据行 ≥12（§15.4 校验下限为 ≥10），本页行数以上表为准（不含表头）。
- **口径恒等式**（由数据保证，§9 V-MKTOFF-05 逐项校验）：`roi = revenue_wan ÷ actual_wan`（2 位小数，actual_wan=0 时 roi=0）；`revenue_wan ÷ actual_wan` 与 `roi` 在全部已结算行成立。
- 存量取值登记：`events.owner` 含 1 条非部门词表值 `筹备中`（EV-2604 年终答谢会，语义为"行政支持筹备专班"，预算包按行政支持口径 80 万元归集）；`materials.brand_check` 含 1 条违规原因直填值 `字号不合规`（M-2604）。两者均为存量命名差异，新增行一律使用词表值，存量行保留原值不改写。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`（不写英文逗号，避免破坏 CSV 分隔）。日期格式 `YYYY-MM-DD`。

#### 1.1.1 events.csv（19 列 = 原生 6 列 + 追加 13 列，16 行）

表头逐字：`event,budget_wan,actual_wan,roi,city,owner,event_id,quarter,event_type,venue,start_date,end_date,venue_cost_wan,attendees,leads,leads_dedup,revenue_wan,dept_quarter_pkg_wan,status`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| event | string | 是 | 活动名称（合成名称，全场唯一）；原始列 |
| budget_wan | number | 是 | 计划预算（**万元**，整数）；原始列；预算超包判定字段（§9 V-MKTOFF-03） |
| actual_wan | number | 是 | 实际支出（**万元**，整数）；未发生为 `0`；原始列；`actual_wan > budget_wan` 为超支行（本快照 5 行，最大超支 12.0%） |
| roi | number | 是 | 投入产出比（1 位小数）＝ `revenue_wan ÷ actual_wan`；未结算行为 `0`；原始列；**GT-MKTOFF-03 必填字段，须可追溯到本表行** |
| city | string | 是 | 举办城市（广州/深圳/佛山/东莞/上海/武汉）；原始列 |
| owner | string | 是 | 责任主体（词表：市场部/渠道部/品牌组/行政支持）；原始列；存量值 `筹备中` 见 §1 存量取值登记 |
| event_id | string | 是 | 活动 ID，唯一主键，格式 `EV-YY##`（EV-2601~EV-2616 连续编号）；materials.event_id 的外键指向本列；追加列 |
| quarter | string | 是 | **预算归属季度** `YYYY-Qn`（本快照全部为 2026-Q3，即活动立项获批的季度；跨季举办的活动仍归属立项季度）；追加列 |
| event_type | enum | 是 | 活动类型：发布会/渠道会/经销商大会/展会/答谢会/路演/快闪店/沙龙/开放日/培训营/大会；追加列 |
| venue | string | 是 | 场地名称（合成场馆名，不含真实客户或酒店主体信息）；场地签约审批（`booth-approve`）标的；追加列 |
| start_date | date | 是 | 开始日期；可晚于数据基线日（跨季举办），见 §9 V-MKTOFF-08；追加列 |
| end_date | date | 是 | 结束日期；`end_date ≥ start_date`；追加列 |
| venue_cost_wan | number | 是 | 场地/展位签约金额（**万元**，整数）；单场 >30 万元触发双审批（§5，本快照 7 行命中、1 行 30 万元边界）；追加列 |
| attendees | number | 是 | 现场到场人数；未举办为 `0`；追加列 |
| leads | number | 是 | 现场采集线索数（人次）；`执行中`及以前为 `0`（线索在活动结束后结算）；追加列 |
| leads_dedup | number | 是 | 去重后线索数；`leads_dedup ≤ leads`；移交销售（`lead-handoff`）取此列；追加列 |
| revenue_wan | number | 是 | 活动带来的可归因收入/意向金额（**万元**，1 位小数）；未结算为 `0`；追加列 |
| dept_quarter_pkg_wan | number | 是 | 该责任主体当季活动包额度（**万元**，整数，按 owner+quarter 取值一致）；预算超包判定基准（§9 V-MKTOFF-03）；追加列 |
| status | enum | 是 | 活动状态，枚举见 §4.1（策划中/待审批/执行中/已结束/复盘完成）；追加列 |

#### 1.1.2 materials.csv（15 列 = 原生 5 列 + 追加 10 列，14 行）

表头逐字：`material,review_status,legal_check,brand_check,owner,material_id,event_id,type,version,channel,reviewer_legal,reviewer_brand,reviewed_at,external_ready,issue_type`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| material | string | 是 | 物料名称；原始列 |
| review_status | enum | 是 | 审查状态，枚举见 §4.2（待审/审核中/通过/驳回）；**仅 `通过` 可外发**；原始列 |
| legal_check | enum | 是 | 法务项：未审/待改/通过（"待改"＝法务意见要求修改后重审）；原始列 |
| brand_check | enum | 是 | 品牌项：未审/待改/通过；存量行含违规原因直填值 `字号不合规`（M-2604，等价"待改"，原因见 issue_type）；原始列 |
| owner | string | 是 | 责任组（品牌组/设计组/渠道部/市场部/行政支持）；原始列 |
| material_id | string | 是 | 物料 ID，唯一主键，格式 `M-####`（M-2601~M-2614 连续编号）；追加列 |
| event_id | ref | 是 | → events.event_id 外键，禁止孤儿行（§9 V-MKTOFF-02）；追加列 |
| type | enum | 是 | 物料类型：手册/易拉宝/包装/背板/邀请函/主视觉/视频/通稿/单页/导视/灯箱/海报；追加列 |
| version | string | 是 | 版本号 `V#`；驳回后返修须升版重审（§4.2）；追加列 |
| channel | enum | 是 | 投放渠道：现场/线上/线下+线上（`线上+现场`）/经销商/定向邀约/媒体/校园；决定外发合规留痕去向（§6）；追加列 |
| reviewer_legal | string | 否 | 法务审查人掩码名（姓 + `**`，如 `李**`）；未审为 `-`；追加列 |
| reviewer_brand | string | 否 | 品牌审查人掩码名；未审为 `-`；追加列 |
| reviewed_at | date | 否 | 最近一次审查完成日；未审为 `-`；追加列 |
| external_ready | enum | 是 | 可外发标记 yes/no；`yes` 当且仅当 `review_status=通过` 且 `legal_check=通过` 且 `brand_check=通过`（§9 V-MKTOFF-04）；追加列 |
| issue_type | string | 否 | 未通过原因（如 `文案绝对化用语` / `品牌字号不合规` / `价格比较表述无依据` / `证言授权待补`）；通过行为 `-`；追加列 |

#### 1.1.3 dealer_agreements.csv（13 列，12 行）

表头逐字：`dealer_id,dealer_masked,region,tier,agreement_no,terms_digest,rebate_pct,exclusive_flag,sellthrough_pct,dispute_flag,period,owner,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| dealer_id | string | 是 | 经销商台账 ID，唯一主键，格式 `DA-####`（DA-2601~DA-2612 连续编号） |
| dealer_masked | string | 是 | 经销商标识掩码 `DEALER-***##`（不可还原）；出域/入报告只允许此形态（§9 V-MKTOFF-07） |
| region | enum | 是 | 区域：华南/华东/华中/西南/华北 |
| tier | enum | 是 | 经销商等级：金级/银级/普通（决定返利比例与独家条款口径） |
| agreement_no | string | 是 | 协议号 `DA-YYYY-###`，供跨域（sales/cmp）取证 |
| terms_digest | string | 是 | **条款要点摘要**（脱敏后形态，如 `独家区域保护+季度返利`）；scene 声明的 `dealer_terms` 原文**不落地、不出域**（§10） |
| rebate_pct | number | 是 | 返利比例（%，1 位小数）；金级 3.0 / 银级 2.0 / 普通 1.5 |
| exclusive_flag | enum | 是 | 是否独家区域：是/否（本快照 4 家为是） |
| sellthrough_pct | number | 是 | 售罄率（0-100，1 位小数）；<60% 触发滞销提示（§9 V-MKTOFF-09） |
| dispute_flag | enum | 是 | 争议标记：是/否（本快照 2 家为是，须在 `vendor-brief` 的 `risk` 字段显式列出） |
| period | string | 是 | 条款执行期间 `YYYY-Qn`（2026-Q3），与 events.quarter 同域 |
| owner | string | 是 | 责任部门（渠道部） |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`，审计"依据数据版本"取该值 |

---

## §2 技能规格（scene skills：event-plan / material-compliance / roi-review）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| event-plan | 线下活动策划案与物料清单生成（预算/场地/排期） | data/mkt-off/events.csv、materials.csv | reports/mkt-off/*（策划案 + 物料清单） | L3 | 预算超部门季度包 20% 必须触发审批并给出审批链与资金来源（V-MKTOFF-03）；场地签约 >30 万元须双审批（§5）；结论附 (文件, 行, 列) 级证据；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| material-compliance | 物料合规审查（广告法口径：绝对化用语/证言授权/价格比较/字号规范） | data/mkt-off/materials.csv、events.csv | reports/mkt-off/*（物料审查结论 + 驳回清单） | L3 | 任一合规项未过即 `external_ready=no`，**不得进入外发清单**（V-MKTOFF-04）；驳回必须写 `issue_type` 与升版要求；出域前过 `redact_gate`；连续 3 次失败→登记 capability-gap |
| roi-review | 活动 ROI 复盘与改善建议；线下线索去重与移交 | data/mkt-off/events.csv、dealer_agreements.csv | reports/mkt-off/*（ROI 复盘 + 线索移交清单） | L3 | ROI/收入/线索数字必须逐行可追溯到 events.csv（V-MKTOFF-05）；线索移交前必过 `redact_gate`（lead-handoff acceptance）；不得用外部常识补数；连续 3 次失败→登记 capability-gap |

- 三个技能文件均声明 `min_level: L3`、`redact_gate: true`，依赖能力 `cap.excel.panel`、`cap.redact.all`（与 scene `required_capabilities` 一致，另含 `cap.approval.single`；两条 dual 工作流另需 `cap.approval.multi` 承载双审批）。
- 意图路由技能 `mkt-off-intent`（`templates/skills-domain/mkt-off/SKILL-cockpit-intent.md`）把自然语言意图路由到 `material-review` / `roi-report` 工作流；跨域意图交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="mkt-off"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| mkt-off.event-roi@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `event-roi-<ts>.json`：event / budget_wan / actual_wan / roi / lessons；acceptance：数字可追溯到 data/mkt-off/events.csv | 活动 ROI 复盘（预算 vs 实际）；skill=roi-review；节点链 skill(n1)→tool `cap.excel.panel.write`(n2)→audit(n3，数据版本 + 产物哈希)；rollback=savepoint `pre-event-roi` |
| mkt-off.material-review@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `material-review-<ts>.json`：material / legal_check / brand_check / final_status；acceptance：任一未过即不得外发；外发走审批 | 物料合规审查（法务→品牌→归档）；skill=material-compliance；audit n5 记"审批人 + 依据数据版本 + 产物哈希"；condition 不得绕过审批直连写能力；rollback=savepoint `pre-material-review` |
| mkt-off.event-plan@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空）；预算超包时由产物携带审批链（见 §5） | `event-plan-<ts>.json`：event / city / budget_wan / schedule；acceptance：预算超部门季度包 20% 触发审批 | 活动策划案（预算/场地/排期）；skill=event-plan；节点链 skill(n1)→tool(n2)→audit(n3，输入参数 + 结果快照)；rollback=savepoint `pre-event-plan` |
| mkt-off.vendor-brief@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `vendor-brief-<ts>.json`：dealer_masked / terms_exec / sellthrough / risk；acceptance：经销商条款 L3 脱敏 | 经销商简报（条款执行）；skill=material-compliance；`terms_exec` 只出 `terms_digest` 摘要口径，`risk` 须覆盖 `dispute_flag=是` 的 2 家；rollback=savepoint `pre-vendor-brief` |
| mkt-off.booth-approve@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `booth-approve-<ts>.json`：venue / cost_wan / dates / approver；acceptance：单场签约 >30 万双审批 | 展位/场地签约审批；skill=event-plan；签约金额取 events.venue_cost_wan；audit n5 记"审批人 + 依据数据版本 + 产物哈希"；rollback=savepoint `pre-booth-approve` |
| mkt-off.lead-handoff@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空）；移交前强制过 `redact_gate` | `lead-handoff-<ts>.json`：event / leads / dedup_pct / owner；acceptance：移交前必须过 redact_gate | 线下线索移交销售（去重+脱敏）；skill=roi-review；`leads` 取 events.leads_dedup，`dedup_pct = (leads − leads_dedup) ÷ leads`；rollback=savepoint `pre-lead-handoff` |

- 节点链：approve 类为 skill(n1) → condition(n2) → approval(n3) → tool `cap.excel.panel.write`(n4) → audit(n5)；report/calc 类为 skill(n1) → tool(n2) → audit(n3)。上表"审批落点"列对无审批工作流明示为"无审批节点"，**不存在 `undefined`**。
- **命名对照（不擅自改 manifest）**：scene `workflows` 只钉 2 条基线（`workflows/mkt-off.material-review.yaml`、`workflows/mkt-off.roi-report.yaml`）。其中 `mkt-off.roi-report`（`manifests/workflows/mkt-off.roi-report.yaml`，YAML 缺 `domain` 字段、未登记进 index.json）是"活动 ROI 复盘报告"的**遗留重复件**，与 `mkt-off.event-roi@1.0.0`（本域唯一登记在册的 ROI 复盘工作流）为同一能力的命名差异，以 index.json 与落地文件为准；意图路由 `mkt-off-intent` 仍指向 `roi-report`，属声明侧待统一项。
- **字段→表列映射**（交付字段全部可在本域 3 张表内取到，不依赖外部数据）：`event/budget_wan/actual_wan/roi` → events 同名列；`material/legal_check/brand_check/final_status` → materials 同名列（`final_status` 由 §4.2 状态映射）；`venue/cost_wan/dates` → events.venue / venue_cost_wan / start_date+end_date；`dealer_masked/terms_exec/sellthrough/risk` → dealer_agreements.dealer_masked / terms_digest / sellthrough_pct / dispute_flag。

---

## §4 状态机

### 4.1 活动（ACTIVITY_STATUS，events.status）

| 枚举值（CSV 落值） | 标识符 | 含义 | 允许后继 |
|---|---|---|---|
| 策划中 | planning | 方案编制中，预算未上报 | 待审批 |
| 待审批 | pending_approval | 预算/超包审批在途（超包行必须携带审批链）；不得签约场地、不得产生不可逆支出 | 执行中 / 策划中（驳回退回） |
| 执行中 | executing | 已签约并进入执行期；`leads/actual/revenue` 尚未结算 | 已结束 |
| 已结束 | closed | 活动已举办，结算与复盘未完成 | 复盘完成 |
| 复盘完成 | reviewed | ROI 复盘出数并归档（终态） | —（重开须新建活动并留痕） |

```
策划中 → 待审批 → 执行中 → 已结束 → 复盘完成（终态）
            ↘（审批驳回）→ 策划中
```

| 迁移 | 触发条件 | 证据/门槛 |
|---|---|---|
| 策划中 → 待审批 | 策划案与预算上报 | `event-plan-<ts>.json`：event / city / budget_wan / schedule；`budget_wan > dept_quarter_pkg_wan × 20%` 时产物须附审批链与资金来源 |
| 待审批 → 执行中 | 审批通过且场地签约完成 | `booth-approve-<ts>.json`：venue / cost_wan / dates / approver；单场 >30 万元须双审批（§5） |
| 待审批 → 策划中 | 审批驳回 | 驳回原因必填；不得签约场地 |
| 执行中 → 已结束 | 活动结束日到达且现场数据回填 | `end_date`、`attendees`、`leads` 必填；`leads_dedup ≤ leads` |
| 已结束 → 复盘完成 | ROI 复盘出数并归档 | `event-roi-<ts>.json`：budget_wan / actual_wan / roi / lessons，逐行可追溯到 events.csv |

**禁止**：越级推进（策划中→执行中）、未签约即置执行中、`revenue_wan/roi` 在 `执行中` 及以前非 0（未结算不得预估）；已结束/复盘完成行回改 `leads`/`revenue` 须重开复盘记录并留痕。本快照分布（16 行）：复盘完成 10 / 已结束 2 / 执行中 1 / 待审批 1 / 策划中 2；样例：EV-2608（秋季新品发布会，110 万元，待审批）、EV-2612（华南渠道会（秋季），执行中）、EV-2602（经销商大会，复盘完成，ROI 2.4 全场最高）。

### 4.2 物料合规（MATERIAL_STATUS，materials.review_status）

```
待审 →（法务受理）→ 审核中 →（法务过 + 品牌过）→ 通过（可外发，终态）
                     ↘（任一项不过）→ 驳回 →（返修升版后重提）→ 待审
```

| 状态（CSV 落值） | 标识符 | 进入条件 | 允许后继 | 证据字段 |
|---|---|---|---|---|
| 待审 | pending_review | 物料新建/返修重提；法务、品牌均未受理 | 审核中 | `legal_check=未审` 且 `brand_check=未审`；`reviewer_*` 与 `reviewed_at` 为 `-` |
| 审核中 | in_review | 至少一项已受理（法务项与品牌项分别流转，子状态由 `legal_check`/`brand_check` 承载） | 通过 / 驳回 | `legal_check` 或 `brand_check` ∈ {通过, 待改}；`reviewed_at` 为最近一次审查完成日 |
| 通过 | approved | `legal_check=通过` 且 `brand_check=通过` | —（终态） | `external_ready=yes`；进入外发清单（仍须走 `material-review` 审批，§5） |
| 驳回 | rejected | 任一项不过 | 待审（返修升版重提） | `issue_type` 必填（如 `文案绝对化用语` / `品牌字号不合规` / `价格比较表述无依据` / `证言授权待补`） |

- 子状态口径：`legal_check` / `brand_check` ∈ {未审, 待改, 通过}；`待改` 与存量值 `字号不合规`（M-2604）等价，均不得置 `通过`。
- **可外发不变量**：`external_ready = yes ⟺ review_status=通过 ∧ legal_check=通过 ∧ brand_check=通过`（§9 V-MKTOFF-04）；本快照可外发 6 行（M-2601/2603/2605/2607/2611/2612），未过 8 行（M-2602/2604/2606/2608/2609/2610/2613/2614）。
- 本快照分布（14 行）：通过 6 / 审核中 4 / 待审 2 / 驳回 2；驳回样例 M-2604（现场背板，`brand_check=字号不合规`）与 M-2610（经销商返利政策单页，法务 `待改`：价格比较表述无依据）。

### 4.3 场地/展位签约（BOOTH_STATUS，`mkt-off.booth-approve`）

| 状态 | 判定 | 证据字段 |
|---|---|---|
| 待审批 | 场地/展位报价已确认，审批未发起 | events：venue / venue_cost_wan / start_date+end_date / status=待审批 |
| 双审批中 | 签约金额 >30 万元（§5 阈值），`approvals` 计数 1/2 | `booth-approve-<ts>.json`：cost_wan / approver |
| 已签约 | 双人（或阈值内单人）签批完成 | approver 非空；events.status 迁移至执行中 |
| 已驳回 | 审批驳回或预算超包未解决 | 驳回原因必填；不得产生不可逆支出（押金/定金同样受控） |

---

## §5 审批链（节点-角色-双审批-金额阈值）

| 流程 | 节点链 | 审批角色 | 双审批 | 金额/条件阈值 | manifest 落点 |
|---|---|---|---|---|---|
| 物料外发（mkt-off.material-review） | 物料审查 → 条件判定 → L4 审批 → 写产物 → 审计 | 法务负责人 → 品牌负责人（对外投放物料两级均须签字） | **是**（`dual: true`，无免审例外） | 域基线：所有 `external_ready=yes` 的物料外发均须双审批；任一合规项未过 → 一票否决（不得外发） | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 场地/展位签约（mkt-off.booth-approve） | 策划案 → 条件判定 → L4 审批 → 写产物 → 审计 | 部门负责人 + 法务/财务 BP →（大额）分管副总 | **是**（`dual:true` 恒定；阈值决定是否加签） | acceptance 原文"单场签约 >30 万双审批"：`venue_cost_wan > 30` 必须双人签批并加签分管副总；`≤30` 为双审基础档（本快照边界样例 EV-2614 = 30 万元，另一侧命中 7 行，最大 EV-2602 = 56 万元） | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 活动 ROI 复盘（mkt-off.event-roi） | 取数 → 复盘 → 写产物 → 审计 | 无审批（报告类，分级出数） | 否 | 数字须逐行可追溯；不得外推或倒轧 | 无 approval 节点（kind=report） |
| 活动策划（mkt-off.event-plan） | 取数 → 计算 → 写产物 → 审计 | 无审批节点；**预算超包时由产物携带审批链** | 否（产物携带，不等同审批节点） | `budget_wan > dept_quarter_pkg_wan × 20%` → 产物必须给出审批链与资金来源（本快照 12 行命中，如 EV-2608：110 > 400 × 20% = 80） | 无 approval 节点（kind=calc） |
| 经销商简报（mkt-off.vendor-brief） | 取数 → 汇总 → 写产物 → 审计 | 无审批（对外前由 CMP 侧留痕，§6） | 否 | `dealer_terms` 原文不出域，只出摘要与掩码 | 无 approval 节点（kind=report） |
| 线索移交（mkt-off.lead-handoff） | 取数 → 去重 → 写产物 → 审计 | 无审批（`redact_gate` 为硬闸门） | 否 | 移交前必须过 `redact_gate`；`leads_dedup` 不得为 0 时误报为有效线索（0 不得移交） | 无 approval 节点（kind=calc） |

- 场景基线 `policies.permission.min_level=L3`、`dual_approval=false` 为**域默认**；两条 approve 工作流在流程级升格为 L4 双审批（与 workflow YAML 一致），规则**单调加严、不放松**。
- 30 万元与"季度包 20%"为本文档细化的可检查阈值；定制时必须与 scene/workflow 配置保持同一口径并只允许加严。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，统一在 after_complete 钩子执行，失败回滚至对应 savepoint，不得绕过 §5 审批链。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 活动结束并结算线索（events.status 迁移至 已结束/复盘完成 且 `leads_dedup > 0`） | ①sales 域线索跟进：按 `leads_dedup` 生成待跟进线索池并指派责任人；②回流 `mkt-off.lead-handoff` 产物供销售认领 | events：event_id / event / leads / leads_dedup / owner；lead-handoff-<ts>.json：event / leads / dedup_pct / owner |
| 物料外发通过（mkt-off.material-review done 且 `external_ready=yes`） | cmp 域合规留痕：外发物料清单、审查人、依据数据版本与产物哈希 append-only 归档（广告法审查证据包） | materials：material_id / review_status=通过 / legal_check / brand_check / channel / reviewer_legal / reviewer_brand / reviewed_at；audit n5（审批人 + 依据数据版本 + 产物哈希） |
| 活动实际花费发生（`actual_wan` / `venue_cost_wan` 回填） | fin 域预算核销：按责任主体与季度登记活动支出，冲减部门活动包；超包部分转预算调整 | events：event_id / owner / quarter / budget_wan / actual_wan / venue_cost_wan / dept_quarter_pkg_wan |
| 部门季度累计超包 ≥20%（`Σ budget_wan(dept, quarter) > dept_quarter_pkg_wan × 1.2`） | fin 域 `fin.budget-review`：预算调整审批（L4 双审批 + CFO 加签），并冻结该部门新增非必要活动立项 | 本快照命中：渠道部 317/200 = 158.5%、市场部 510/400 = 127.5%；预警档：品牌组 165/150 = 110% |
| 经销商条款对外（mkt-off.vendor-brief done） | ①cmp 域留痕（条款执行与争议清单归档）；②出域前强制 `redact_gate`：只出 `dealer_masked` 与条款摘要 | dealer_agreements：dealer_id / dealer_masked / region / terms_digest / dispute_flag / updated_at；vendor-brief-<ts>.json：dealer_masked / terms_exec / sellthrough / risk |
| 物料被驳回（review_status=驳回） | 关联活动（events.event_id）的执行风险提示：该物料不得投产/布展，返修升版重提前不得进入现场投放 | materials：material_id / event_id / issue_type / version；events：event_id / status / start_date |

---

## §7 权限矩阵

### 7.1 策略层（与 scene `policies` 逐字一致）

| 项 | 值 | 来源 |
|---|---|---|
| 最低数据级别 | **L3**（越级读取即 DENY；materials.csv 虽为 L2，读取仍受域级 min_level 约束） | scene `policies.permission.min_level: L3` |
| 双审批 | 域级 `false`；节点级 `true`（material-review n3、booth-approve n3，见 §5） | scene `dual_approval: false` + workflow YAML `n3.dual: true` |
| 脱敏字段（redact_gate） | `dealer_terms`（scene 声明）；实际落地脱敏对象：dealer_agreements 的 `dealer_masked` / `terms_digest`；materials 的 `reviewer_legal` / `reviewer_brand` 掩码名 | scene `redact.fields`、`redact.gate: redact_gate` |
| 记忆层 | `pii_allowed=false`；`exclude=[]`（无额外排除项；经销商条款与经销商标识禁入长期记忆） | scene `policies.memory` |
| 所需能力 | `cap.excel.panel`、`cap.approval.single`、`cap.redact.all`（两条 dual 工作流另需 `cap.approval.multi`） | scene `required_capabilities` |
| 技能级 | 3 技能均 `min_level: L3`、`redact_gate: true` | `templates/skills-domain/mkt-off/SKILL-*.md` |

### 7.2 对象级（级别 / 脱敏 / 记忆层 / 双审批）

| 对象 | 级别 | 脱敏（redact_gate） | 记忆层 | 双审批 |
|---|---|---|---|---|
| events.csv（活动/预算/花费/线索/收入） | L2 | 无 PII；`venue` 为合成场馆名，无真实客户主体 | 允许仅非 PII 汇总结论入记忆层 | 场地签约 >30 万元：是（§5） |
| materials.csv（物料与审查状态） | L2 | 审查人只以掩码名出现（`李**`），掩码前值永不落产物 | 允许仅物料状态/合规结论入记忆层 | 物料外发：是（L4 双审批） |
| dealer_agreements.csv（条款执行） | L3 | `dealer_terms` 原文不落地：只出 `terms_digest` 摘要与 `DEALER-***##` 掩码；出域前必过 `redact_gate` | **禁入** | 否（只读取证；对外经 CMP 留痕，§6） |

### 7.3 角色 × 操作（落地建议；scene 未逐角色声明，定制化时细化，只允许加严）

| 角色 | 查看 | 创建/编辑 | 审批 | 数据边界 |
|---|---|---|---|---|
| admin | 全量 | V/C/E/D | 可（含流程推进/驳回） | 全部实体全部行；审计查询 |
| 市场负责人（本域主责） | 全量（含 dealer_agreements） | V/C/E/D | 可（物料外发、场地签约、预算超包） | 全部业务行；经销商明细仅掩码 + 摘要 |
| 活动执行/品牌/设计（业务用户） | events、materials（脱敏视图） | V/C（本组物料送审） | 否（无审批按钮） | 仅本部门/本组行；经销商台账不可见 |
| 渠道/销售（跨域只读） | 线索移交件与外发物料结论 | — | — | 仅 `lead-handoff` 产物与 `dealer_masked` 口径 |
| employee | 无本域菜单 | — | — | 本域无自助入口 |

- 列表/报告始终掩码；`dealer_terms` 完整条款文本任何角色均不可见（物理不落地）。
- 无 approve 权限不渲染审批按钮；越级读取（<L3）直接 DENY；产物只落 `reports/mkt-off/` 与 `templates/workspace/deliverables/mkt-off/`。

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-MKTOFF-01 | 生成新品发布会活动方案与物料清单 | event-plan + cap.excel.panel / cap.approval.single | L3 | reports/mkt-off/gt-01.md | data/mkt-off/event-ledger.xlsx → events.csv + materials.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据 |
| GT-MKTOFF-02 | 对三套物料做广告法合规审查 | material-compliance + cap.excel.panel / cap.approval.single | L3 | reports/mkt-off/gt-02.md | 同上（主用 materials.csv，法务/品牌口径） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（未过物料不得进外发清单） |
| GT-MKTOFF-03 | 复盘上季度展会 ROI 并给出改善建议 | roi-review + cap.excel.panel / cap.approval.single | L3 | reports/mkt-off/gt-03.md | 同上（主用 events.csv，经销商侧佐证 dealer-agreements.xlsx → dealer_agreements.csv） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（ROI 数字逐行可追溯） |

### 任务分解（scene `expected_plan` 指向本页）

**GT-MKTOFF-01 新品发布会方案与物料清单**
1. 读取 events.csv 16 行：按 `quarter=2026-Q3` 归集各责任主体的季度包占用——渠道部 317/200 = 158.5%、市场部 510/400 = 127.5%、品牌组 165/150 = 110%、行政支持 65/80 = 81.3%（含 EV-2604 `owner=筹备中` 按行政支持归集）。
2. 新建活动立项：单场 `budget_wan > dept_quarter_pkg_wan × 20%` 即触发审批（对市场部即 400×20% = 80 万元；样例 EV-2608 秋季新品发布会 110 万元 > 80 万元，状态 `待审批`），产物必须给出审批链、超包金额与资金来源。
3. 关联 materials.csv：仅 `external_ready=yes` 的 6 行可进入物料清单（M-2601/2603/2605/2607/2611/2612）；未过 8 行按 `issue_type` 给出返修/升版/重做动作与时点，且不得标注为可投产。
4. 输出策划案（预算拆分/场地/排期/物料清单），逐项标注 (文件, 行, 列) 证据；落 `reports/mkt-off/gt-01.md`；写审计（数据版本 + 产物哈希）。

**GT-MKTOFF-02 物料广告法合规审查**
1. 读取 materials.csv 全量 14 行（任务描述为"三套"，源表登记 14 套：**按源表全量审查**，数量差异须在产物中显式登记，不得以描述数量裁剪台账）。
2. 逐行判定 `legal_check` / `brand_check`，命中广告法口径的驳回样例：M-2602（绝对化用语）、M-2604（品牌字号不合规）、M-2610（价格比较表述无依据）、M-2613（证言授权待补）、M-2608（字幕免责声明待补）。
3. 复算 `external_ready`：必须等于"三项全过"，本快照 6 行 yes / 8 行 no；对 `review_status=驳回` 行核对 `issue_type` 与 `version`（返修须升版）。
4. 输出审查结论与驳回清单；对即将外发物料给出 `material-review` L4 双审批路径（§5）；落 `reports/mkt-off/gt-02.md`；写审计。

**GT-MKTOFF-03 上季度展会 ROI 复盘**
1. 取 `2026-Q3` 且 `event_type=展会` 的 3 行（EV-2603 行业展位 ROI 1.2 / EV-2607 广州美妆博览会展位 ROI 1.4 / EV-2614 行业展位-东莞工业展 ROI 1.6）：计划预算 147 万元、实际支出 147 万元、可归因收入 203.6 万元，**加权 ROI = 1.39**（逐场 ROI 高于加权值的仅 EV-2614）。
2. 全量对照：`复盘完成` 10 行合计预算 675 / 实际 698 / 收入 1292.9，加权 ROI 1.85；最低 ROI 为 EV-2609 校园路演 0.9，最高为 EV-2602 经销商大会 2.4。
3. 超支归因：`actual_wan > budget_wan` 5 行，最大超支 EV-2602 112.0%（超支 <20%，须在报告中标注但不必转审批；≥20% 须转审批，§9 V-MKTOFF-06）。
4. 线索与物料佐证：EV-2603 现场物料 M-2602 / M-2604 均未过合规（易拉宝"文案绝对化用语"、背板"品牌字号不合规"），与该场 ROI 1.2 为展会场次最低相印证；经销商侧以 dealer_agreements 的 `sellthrough_pct` 与 `dispute_flag` 佐证（2 家争议）。
5. 输出结论与改善建议（含 ROI 准入线、预算分段释放等），每个数字给出 (文件, 行, 列) 证据；落 `reports/mkt-off/gt-03.md`；写审计。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-MKTOFF-01 主键与必填 | events：`event_id`/`event`/`budget_wan`/`actual_wan`/`roi`/`city`/`owner`/`quarter`/`status` 非空且 `event_id` 唯一；materials：`material_id`/`material`/`review_status`/`legal_check`/`brand_check`/`owner`/`event_id` 非空且 `material_id` 唯一；dealer_agreements：`dealer_id`/`dealer_masked` 非空且唯一 | 缺失或重复即拒写，提示"请填写必填项"/"已存在" |
| V-MKTOFF-02 引用完整性 | `materials.event_id ∈ events.event_id`（禁孤儿行；本快照 14 行全部命中 EV-2601~EV-2616 中的活动）；`events.owner` 须落在词表内（存量值 `筹备中` 为登记例外） | 外键校验失败即拒写；孤儿物料不得进入任何报告 |
| V-MKTOFF-03 **预算超部门季度包 20% 触发审批**（workflow acceptance 原文口径，两条同时生效、取严） | ①单场口径：`budget_wan > dept_quarter_pkg_wan × 20%` → 立项须触发审批，产物携带审批链与资金来源（本快照 12 行命中，命中样例 EV-2608：110 > 80）；②季度累计口径：`Σ budget_wan(owner, quarter) > dept_quarter_pkg_wan × 1.2` → 超包 ≥20%，转 `fin.budget-review` 并冻结新增非必要活动（本快照命中 渠道部 317/200 = 158.5%、市场部 510/400 = 127.5%）；③超包 10%~20% 为预警（品牌组 165/150 = 110%），<100% 为正常（行政支持 65/80 = 81.3%） | 未触发却产生不可逆支出 = 流程违例（回滚 + 审计）；触发而未在产物列出审批链 = 交付不合格 |
| V-MKTOFF-04 **任一合规项未过不得外发** | `external_ready=yes` 当且仅当 `review_status=通过 ∧ legal_check=通过 ∧ brand_check=通过`；未过行（本快照 8 行）不得出现在任何外发清单/投放排期；外发必经 `material-review` L4 双审批 | 违规外发 = **一票否决**，回滚至 `pre-material-review` 并记审计 |
| V-MKTOFF-05 **ROI 数字可追溯** | 已结算行 `roi = revenue_wan ÷ actual_wan`（2 位小数四舍五入）；`actual_wan=0` 时 `roi=0` 且 `revenue_wan=0`；报告中每个 ROI/收入/线索数字必须给出 (文件, 行, 列) 证据 | 无证据链或倒轧 = 交付不合格；数字不得外推或用常识补数 |
| V-MKTOFF-06 金额与超支 | `budget_wan/actual_wan/venue_cost_wan/revenue_wan ≥ 0`；`actual_wan > budget_wan` 的超支行（本快照 5 行，最大 112.0%）须在报告中标注；超支 ≥20% 转审批 | 负值拒写；超支未标注 = 报告不合格 |
| V-MKTOFF-07 **经销商条款 L3 脱敏** | `dealer_terms` 原文不落地；出域/入报告只允许 `dealer_masked`（`DEALER-***##`）与 `terms_digest` 摘要；出域前必过 `redact_gate`；`vendor-brief` 的 `risk` 必须覆盖 `dispute_flag=是` 的全部行（本快照 2 家） | 命中未脱敏 = 一票否决（redact_gate 未命中即出域）；经销商真名/条款原文泄露 = 安全事件 |
| V-MKTOFF-08 日期与结算一致性 | `end_date ≥ start_date`；`start_date` 可晚于数据基线日（跨季举办），但 `quarter` 恒等于预算归属季度；`status ∈ {执行中, 策划中, 待审批}` 时 `leads=0`、`revenue_wan=0`、`roi=0`（未结算不得预估）；`leads_dedup ≤ leads` | 违反即拒写；预估数入账 = 交付不合格 |
| V-MKTOFF-09 枚举与阈值白名单 | `status ∈ {策划中, 待审批, 执行中, 已结束, 复盘完成}`；`review_status ∈ {待审, 审核中, 通过, 驳回}`；`legal_check/brand_check ∈ {未审, 待改, 通过}`（存量 `字号不合规` 为登记例外）；`external_ready ∈ {yes, no}`；`sellthrough_pct < 60` 触发滞销提示；`dispute_flag=是` 必入 `risk` | 非法枚举值拒绝写入；跳级迁移回退并记审计 |
| V-MKTOFF-10 场地签约阈值 | `venue_cost_wan > 30` 的行必须给出双审批记录（approver 双人）；`≤30` 不得误报为双审批档（边界样例 EV-2614 = 30 万元） | 阈值错判或双审批缺失 = 不得置"已签约" |
| V-MKTOFF-11 脱敏与记忆边界 | events/materials 无 PII 出域；materials 审查人只出掩码名；`pii_allowed=false` —— 经销商条款与标识禁入记忆层与公网检索 | 违规即一票否决；已入记忆层须按策略清除并留痕 |
| V-MKTOFF-12 交付验收 | 三条 GT 产物落 `reports/mkt-off/gt-*.md`（附 JSON 交付物）；审计为读/算/写三段事件；approve 类工作流须记"审批人 + 依据数据版本 + 产物哈希" | 缺审计或缺审批记录 = 交付不合格 |

---

## §10 特殊约束

1. **经销商条款（L3）只做条款要点抽取，不外发原文**——scene 尾注原文。落地措施：`dealer_agreements.csv` **不落 `dealer_terms` 原文字段**，只有 `terms_digest` 摘要（如"独家区域保护+季度返利"）与 `DEALER-***##` 掩码；`vendor-brief` 产物字段 `terms_exec` / `dealer_masked` 只允许摘要与掩码口径；出域前强制过 `redact_gate`（§9 V-MKTOFF-07）。
2. **物料外发一票否决**：任何物料在 `legal_check` 或 `brand_check` 未过时不得外发/投产/布展；`external_ready=yes` 的行仍须经 `mkt-off.material-review` 的 L4 双审批。本快照刻意保留 8 行未过物料（含 2 行"驳回"）用于拦截规则回归验证。
3. **预算超包硬门禁**：单场超部门季度包 20% 即触发审批（12 行命中样例）；季度累计超包 ≥20% 转 `fin.budget-review`（渠道部 158.5%、市场部 127.5%）；审批未通过前不得签约场地、不得产生不可逆支出（§4.1 / §9 V-MKTOFF-03）。
4. **数据规模**：demo 数据由"4 行模板继承"升级为本设计规格——events 16 行 / materials 14 行 / dealer_agreements 12 行（每表 ≥12 行，§15.4 下限 ≥10）；原 4+4 条存量行取值逐字保留，列名与列序未删改，仅追加列（追加列已逐字段写入 §1.1）。
5. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `mkt-off` 段仍只含 4 行 events / 4 行 materials 的旧快照（旧表头），**重跑该脚本会覆盖本页已补齐的 events.csv / materials.csv**；本域数据的权威版本以本页 §1/§1.1 为准，重跑生成器后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
6. **声明与落地对照（不擅自改 manifest）**：scene `data_assets` 声明 `event-ledger.xlsx` / `dealer-agreements.xlsx`，工作区落地为 UTF-8 CSV 的 `events.csv` / `dealer_agreements.csv`（同名归一化由 `scripts/data-consistency-check.mjs` 校验）；scene `workflows` 只钉 2 条基线且含遗留件 `mkt-off.roi-report`（未登记进 index.json、YAML 缺 `domain`），本域在册工作流以 index.json 的 6 条为准（§3）。以上均属声明侧与实物侧差异，需在 manifest 侧修复时统一。
7. **记忆层与回滚**：`pii_allowed=false`、`exclude=[]`；6 条工作流各带 savepoint 标签（`pre-event-roi` / `pre-material-review` / `pre-event-plan` / `pre-vendor-brief` / `pre-booth-approve` / `pre-lead-handoff`），失败即回滚，副作用写失败同样回滚至对应 savepoint。
8. **规则命中样例（刻意埋点，非数据缺陷）**：①超预算触发审批样例 EV-2608（110 万元 > 市场部季度包 400×20% = 80 万元，状态待审批）；②季度累计超包样例 渠道部 158.5%、市场部 127.5%；③场地签约阈值边界样例 EV-2614（venue_cost_wan = 30，单审批侧）与 EV-2602（56，双审批侧）；④合规未过样例 8 行（M-2602/M-2604/M-2606/M-2608/M-2609/M-2610/M-2613/M-2614，含驳回 2 行）；⑤超支样例 5 行（最大 EV-2602 112.0%）；⑥经销商争议样例 2 家（DA-2604 / DA-2606，`dispute_flag=是`）；⑦存量命名差异样例 2 处（events.owner=`筹备中`、materials.brand_check=`字号不合规`）。
9. **未采纳的参照点（及原因）**：
   - 参照 §3.2 的"核心实体 30+"建模规模：线下营销域只落 3 张最小可用表（活动/物料/经销商协议），场馆供应商、礼品库存、媒体投放等实体归 admin / mkt-on 域，避免跨域重复建模。
   - 参照 §4.1 的通用流程引擎（FLOW 建表 + after_complete 钩子）：本 preset 的工作流由 `manifests/workflows/*.yaml` 静态定义（节点链 + savepoint 回滚），不额外建流程实例表；跨域副作用以 §6 设计约定表达。
   - 参照 §7.1 的产品级种子规模（如合同 60-100 条、资产 30-50 条）：本 preset 为冷启动样例（16/14/12 行，均 ≥12 行），规模扩展归生成器（脚本侧）。
   - 参照 §5.2 的 employee 自助入口：本域无员工自助场景，故不设 employee 菜单与数据边界行（§7.3 明示"无本域菜单"）。
   - PRD 侧"客户/线索 CRM 明细"：线索只以 `leads` / `leads_dedup` 计数与移交件形态出现，不落联系人明细（PII 禁入），明细归 sales 域。
10. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需行业化（如快消品经销商体系、汽车 4S 店活动），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
