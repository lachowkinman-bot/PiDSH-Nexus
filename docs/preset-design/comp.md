# Preset 设计文档 · 薪酬管理（comp）

> 015 §9.2 自制层基线。Agent 定制化时只许细化、不许删域（§8.3）。
> 本域定位：**全域 L4 高敏**（015 §8.3 COMP 行）。唯一硬约束：**个体薪酬只出区间**——一切交付物、审批件、审计记录只允许带宽/区间/分档口径。
> 事实来源：`manifests/scenes/comp.salary-review.yaml`（scene 主口径）、`manifests/workflows/index.json`（domain=comp 共 6 条）、`manifests/workflows/comp.*.yaml`（节点级）、`templates/skills-domain/comp/SKILL-*.md`、`templates/Type-Dict/type-dict.csv`、`templates/workspace/data/comp/*.csv`（落地数据）。
> 深度参照：`HR智能体工作台-Workbench设计文档.md` §3.2.18-3.2.20（定薪/核算/工资条、薪等带宽、调薪）、§3.3（PAY_STATUS/ADJ_STATUS）、§4.7（晋升→调薪联动）、§4.14（流程联动汇总）、§7.1（种子规模）；`HR智能体工作台-PRD.md` §3.5（E1-E8）、§4.2（脱敏表）。

---

## 1. 数据字典（总表）

**（a）落地资产**（数据根 `templates/workspace/data/comp/`）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| bands.csv | L4 | 无 | 12 | 职级带宽表（P1-P9/M1-M3）：p25/p50/p75 + 带宽族。非 PII，但按域高敏随 L4 定级（Type-Dict：`comp,salary-band,table,L4,none`） |
| adjust_queue.csv | L4 | salary（区间口径落地） | 16 | 调薪队列：调薪前/后职级、事由、状态、双审批进度、薪资**区间**、幅度区间、生效月、批次。`employee_masked` 为掩码标识非 PII 原值 |

行数为实测数据行（不含表头）：bands 12 行、adjust_queue 16 行；编码 UTF-8、表头英文小写下划线、逗号分隔。

**（b）scene 声明 ↔ 实际落地映射（诚实口径）**

| scene 声明（L4） | scene PII 字段 | 实际落地 | 差异说明 |
|---|---|---|---|
| `data/comp/salary_master.xlsx` | salary, bank_account, id_number | `adjust_queue.csv`（功能同构） | 预置工作区以 CSV 落地；**bank_account/id_number 未落地**——本域不引入该类字段的原值，需要时须先过 Type-Dict 扩项 + redact_gate |
| `data/comp/salary-band.xlsx` | —（无 PII） | `bands.csv` | 表名语义一致（salary-band ↔ bands），仅载体为 CSV |

> 别名口径：跨域引用（如 `rec.jd-draft` 的 `薪酬带引用 comp.bands 区间口径`）统一指向 `bands.csv` 的 `band/p25_wan/p50_wan/p75_wan`。

---

## 1.1 字段级数据字典

### 1.1.1 `bands.csv`（12 行）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `band` | string | 是 | 职级代码，枚举 P1-P9 / M1-M3（对齐参照 §3.2.19 的 `level`） |
| `p25_wan` | number | 是 | 带宽下限量（分位 P25），单位：万元/年。对应参照 §3.2.19 的 `min` |
| `p50_wan` | number | 是 | 带宽中位（P50），CR/调薪校验基准。对应参照的 `mid` |
| `p75_wan` | number | 是 | 带宽上限（P75）。对应参照的 `max` |
| `zone` | string | 是 | 带宽族：`基准`（P 系专业带）/`管理带`（M 系） |

结构约束：每行必须满足 `p25_wan < p50_wan < p75_wan`；P1-P9 与 M1-M3 各自单调不减。

### 1.1.2 `adjust_queue.csv`（16 行）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `employee_masked` | string | 是 | 员工掩码 ID（`EMP-****NN`）。**禁原值**；与 prf/ben 域同 ID 保持跨域可对齐 |
| `current_band` | string | 是 | 调薪前职级，外键 → `bands.band` |
| `proposed_band` | string | 是 | 调薪后职级，外键 → `bands.band` |
| `reason` | string | 是 | 事由：晋升 / 绩效调薪 / 普调 / 特别调薪 / 超带宽校准 / 异动调薪 / 转正调薪（对齐参照 §3.2.20 的 `type`） |
| `status` | enum | 是 | 调薪单状态：`草稿`/`待审批`/`已通过`/`已生效`/`已驳回`（§4.1） |
| `approvals` | string | 是 | 双审批进度：`HRD✓/CFO✓`、`HRD✓/CFO待`、`HRD待/CFO待`、`HRD✗/CFO待`；草稿为 `-` |
| `current_salary_range_wan` | string | 是 | 调整前薪资**区间**（`a~b`，万元/年，宽度 ≥4）。禁单值 |
| `proposed_salary_range_wan` | string | 是 | 调整后薪资**区间**（同上）。带宽越界校验的直接依据（§9.1） |
| `adjust_pct_range` | string | 是 | 申报调薪幅度区间（`a%~b%`，可为负）。与区间中点幅度须自洽（§9.3） |
| `effective_month` | string | 是 | 生效月 `YYYY-MM`；草稿/驳回为 `-` |
| `batch` | string | 是 | 审批批次号 `BATCH-<年><季>-<序号>`，`comp.queue-approve` 的聚合单位 |

**追加列声明**：`current_salary_range_wan`、`proposed_salary_range_wan`、`adjust_pct_range`、`effective_month`、`batch` 为本轮补齐时**追加**的列；原 6 列表头（`employee_masked,current_band,proposed_band,reason,status,approvals`）逐字未改。`bands.csv` 未追加列。

**与参照实体的字段映射**（§3.2.18-3.2.20）：

| 参照实体/字段 | 本域落地 | 口径差异 |
|---|---|---|
| `salaryGrades.level / min / mid / max` | `bands.band / p25_wan / p50_wan / p75_wan` | 分位命名（P25/P50/P75）替代 min/mid/max，语义等价 |
| `adjustments.empId / type / before / after / pct / reason / status / effectiveDate / approver` | `adjust_queue.employee_masked / reason / current_salary_range_wan / proposed_salary_range_wan / adjust_pct_range / reason / status / effective_month / approvals` | `before/after` 降级为**区间**；`effectiveDate` 降级为**月粒度**；`approver` 升为双审批进度串 |
| `payrollRuns.items{social,fund,tax,gross,net}` | 不落盘（仅 reports/ 区间口径输出） | 个体金额禁止入表（§9.2） |

---

## 2. 技能规格

本域技能以 scene `skills` 为准，共 3 个（实现见 `templates/skills-domain/comp/SKILL-<name>.md`）：

| 技能 | 用途 | 输入 | 输出 | 权限 | 质量检查 |
|---|---|---|---|---|---|
| `band-analysis` | 薪酬带宽偏离分析（**只出区间不出个体**） | `data/comp/*`（bands + adjust_queue） | `reports/comp/*`，附 sheet/row 级证据 | L4；`redact_gate: true` | Expected vs Actual 逐项比对；连续 3 次失败 → 登记 capability-gap 并停止任务 |
| `payroll-recon` | payroll 对账（应发 vs 实发） | `data/comp/*` | `reports/comp/*`，差异 >0.5% 逐项列出 | L4；`redact_gate: true` | 同上；差异项必须可追溯到行 |
| `compa-ratio` | CR 比率报告（人/带宽，0.8–1.2 分档） | `data/comp/*` | `reports/comp/*`，CR 仅区间展示 | L4；`redact_gate: true` | 同上；个体 CR 只出分档不出现单值 |

- 依赖能力：`cap.excel.panel`、`cap.redact.all`（scene `required_capabilities` 另含 `cap.approval.multi`，由工作流审批节点消费）。
- 路由：`templates/skills-domain/comp/SKILL-cockpit-intent.md` 目前只登记 2 条路由（`salary-adjust`/`band-report`）；其余 4 条工作流由命令触发或经 Chief of Staff（`cap.orchestration.chief`）编排。
- 执行前置：读取 `data/comp/` 前校验 Level ≤ L4，越级即 DENY；产出前过 `redact_gate`。

---

## 3. 工作流

本域工作流**全部 6 条**（`manifests/workflows/index.json` 中 `domain === "comp"`；每条均有 `manifests/workflows/comp.*.yaml` 落地）：

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| `comp.salary-adjust@1.0.0` | `n3`：L4 + `dual: true`（HITL） | `salary-adjust-<ts>.json`：`employee_masked / band_from / band_to / approvals`；验收=个体薪酬只出区间、redact_gate 强制 | 调薪审批（双审批 + redact_gate）；kind=approve，skill=`band-analysis`，trigger=`salary-adjust` |
| `comp.band-report@1.0.0` | 无（不触发审批节点） | `band-report-<ts>.json`：`band / headcount / above_p75 / below_p25`；验收=不出现任何个体原值 | 带宽偏离报告（区间口径）；kind=report，skill=`band-analysis`，trigger=`band-report` |
| `comp.payroll-recon@1.0.0` | 无 | `payroll-recon-<ts>.json`：`period / headcount / gross_diff / items`；验收=差异 >0.5% 逐项列出 | payroll 对账（应发 vs 实发）；kind=report，skill=`payroll-recon`，trigger=`payroll-recon` |
| `comp.compa-ratio@1.0.0` | 无 | `compa-ratio-<ts>.json`：`employee_masked / band / cr / zone`；验收=CR 仅区间展示（0.8–1.2 分档） | CR 指数报告（人/带宽）；kind=report，skill=`compa-ratio`，trigger=`compa-ratio` |
| `comp.queue-approve@1.0.0` | `n3`：L4 + `dual: true`（HITL） | `queue-approve-<ts>.json`：`batch / items / total_impact_wan / approvals`；验收=批量影响 >50 万/年 加签 CEO | 调薪队列批量审批（HRD+CFO）；kind=approve，skill=`compa-ratio`，trigger=`queue-approve` |
| `comp.cost-projection@1.0.0` | 无 | `cost-projection-<ts>.json`：`scenario / pct / cost_impact_wan / note`；验收=测算不含个体原值 | 调薪包成本测算（区间口径）；kind=calc，skill=`payroll-recon`，trigger=`cost-projection` |

**场景声明与工作流清单的口径差**：`comp.salary-review` scene 的 `workflows:` 只声明 `[comp.salary-adjust, comp.band-report]` 2 条；`index.json` 中 `domain=comp` 注册 6 条。§3 以 **index.json + 6 份 YAML** 为准（全部有落地链路），scene 的 2 条为核心场景主线。

### 3.1 节点链明细

| 工作流 | 节点链 | 回滚 |
|---|---|---|
| `comp.salary-adjust` | n1 skill(band-analysis) → n2 condition(触发对外/生效动作) → **n3 approval(L4,dual)** → n4 tool(cap.excel.panel.write) → n5 audit | savepoint `pre-salary-adjust` |
| `comp.band-report` | n1 skill(band-analysis) → n2 tool(cap.excel.panel.write) → n3 audit | savepoint `pre-band-report` |
| `comp.payroll-recon` | n1 skill(payroll-recon) → n2 tool → n3 audit | savepoint `pre-payroll-recon` |
| `comp.compa-ratio` | n1 skill(compa-ratio) → n2 tool → n3 audit | savepoint `pre-compa-ratio` |
| `comp.queue-approve` | n1 skill(compa-ratio) → n2 condition → **n3 approval(L4,dual)** → n4 tool → n5 audit | savepoint `pre-queue-approve` |
| `comp.cost-projection` | n1 skill(payroll-recon) → n2 tool → n3 audit | savepoint `pre-cost-projection` |

---

## 4. 状态机

### 4.1 调薪单（ADJ_STATUS，对齐参照 §3.3）

枚举：`草稿(draft)` / `待审批(pending)` / `已通过(approved)` / `已生效(effective)` / `已驳回(rejected)`。
主链（参照 §3.3 原文）：**待审批 → 已通过 → 已生效**；`草稿` 为提交前前态，`已驳回` 为终止态（本域按审批需要补齐，已在 CSV `status` 取值落地）。

| 迁移 | 触发条件 | 守卫 | 证据字段 |
|---|---|---|---|
| `草稿 → 待审批` | HR 提交 / 晋升流程联动创建后提交 | 提案区间不越界，或越界但附特批依据（§9.1） | `status` 变更 + `batch` 赋予 + audit 事件 |
| `待审批 → 已通过` | 双审批齐备：`HRD✓` 且 `CFO✓` | L4 + dual 不可绕过；批内影响 >50 万/年 须加签 CEO | `approvals` 串 + 审批人 + 依据数据版本 |
| `已通过 → 已生效` | 到达 `effective_month` 且被下期薪酬核算引用 | 生效月不得早于当前核算周期 | `effective_month` + payroll 引用记录 |
| `待审批 → 已驳回` | 任一审批人 `✗`，或带宽越界未获特批 | 驳回须记录原因 | `approvals`（HRD✗/CFO待）+ audit |
| 回滚 | 交付物/落盘异常 | savepoint 回退 | `pre-salary-adjust` / `pre-queue-approve` 快照 |

### 4.2 薪酬核算（PAY_STATUS，对齐参照 §3.3）

枚举：`草稿(draft)` / `待审批(pending)` / `已发放(paid)`；`已驳回(rejected)` 为终止态（本域补齐）。
主链（参照 §3.3 原文）：**草稿 → 待审批 → 已发放**。

| 迁移 | 触发条件 | 守卫 | 证据字段 |
|---|---|---|---|
| `草稿 → 待审批` | 月度核算 run 完成、社保/公积金/个税自动算毕 | 逐人勾稽 `gross = net + social + fund + tax`（§9.4） | 核算 run 版本 + 公式快照 |
| `待审批 → 已发放` | 双审批通过且过发放日 | L4 + dual；发放前 `redact_gate` 复核 | 审批人 + 发放批次 + 产物哈希 |
| `待审批 → 已驳回` | 对账差异 >0.5% 未澄清 / 审批 ✗ | 差异项逐项列出 | `payroll-recon.items` + audit |

> 与工作的衔接：`comp.payroll-recon`（report，无审批节点）是核算状态的**只读观测器**；状态迁移的审批动作由核算 run 的审批链承载（scene `permission.dual_approval: true`）。工资条可见性跟随 `已发放`（PRD E3/S5：员工自助仅见已发放）。

---

## 5. 审批链

| 事项 | 节点 | 角色 | 级别 | 双审批 | 说明 |
|---|---|---|---|---|---|
| 单人调薪（`comp.salary-adjust`） | n2 条件 → n3 审批 | ① HRD ② CFO | L4 | 是（`dual: true`） | 两个审批节点串行；任一人 ✗ 即 `已驳回`；审批件只载区间（`band_from/band_to` + 区间字段） |
| 调薪队列批量（`comp.queue-approve`） | n2 条件 → n3 审批 | ① HRD ② CFO（③ CEO 条件加签） | L4 | 是 | 批量影响 >50 万/年 加签 CEO；`total_impact_wan` 为区间测算值 |
| 薪酬核算/发放 | 核算 run 审批链 | ① HR 复核 ② 财务/CFO | L4 | 是 | 与 §4.2 状态机绑定；发放前 redact_gate 复核 |
| 季度关账调薪包（`strat.quarter-close` 联动） | 跨域审批 | HRD + CFO | L4 | 是 | 调薪包触发 COMP 域双审批联动（`comp_package_flag`） |

**区间口径如何落到审批**：

1. **提案层**：进入审批队列的每条提案，薪资只以 `current_salary_range_wan` / `proposed_salary_range_wan` / `adjust_pct_range` 形式存在；无单值薪资字段可传。
2. **审批层**：审批人看到的是「职级带宽（p25/p50/p75）+ 提案区间 + 越界标记 + 批内影响区间」；越界提案必须在此节点留特批依据，否则不得置 `已通过`。
3. **闸门层**：`redact_gate` 在 n2 条件之前**物理前置**——未脱敏内容不进入审批载荷，更不出域；这是 scene 的特殊约束（"个体薪酬永不越过闸门流向公网/外部工具"）。
4. **留痕层**：audit 只记录 审批人 + 依据数据版本 + 产物哈希，不落个体金额。

---

## 6. 跨域联动

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 调薪单 `已生效`（COMP） | 下期薪酬核算引用新定薪 → 工资条重算（参照 §4.14"薪资核算→社保/公积金/个税自动计算"） | `adjust_queue.effective_month`、`current_band/proposed_band`、`payroll-recon.period` |
| 绩效等级确认（PRF `calibration-approve`） | 等级 → 调薪系数 → 创建绩效调薪提案（A/B 等映射幅度区间） | `reason=绩效调薪（A 等/B 等）`、`adjust_pct_range`、prf `calibrated_grade` |
| 晋升 / 异动流程完成（参照 §4.7：不自动写调薪，提示登记；可配置为自动创建 `草稿`） | 职级更新 → 生成调薪单（默认 `草稿`） | `current_band → proposed_band`、`reason=晋升答辩通过`、`status=草稿`（EMP-****63 即此形态） |
| 调薪队列批量审批（`comp.queue-approve`） | 成本测算 `comp.cost-projection` → 预算/关账引用（FIN） | `batch`、`total_impact_wan`、`cost_impact_wan`、`scenario` |
| 调薪生效 | 社保/公积金/个税基数重算 → 工资条 `gross/social/fund/tax/net` | §9.4 公式快照、payroll `items` |
| 招聘 Offer 审批（REC `offer-approve`） | 核对薪酬带（`offer 超出 P75 必须双审批`） | `offer_band`、`bands.p75_wan` |
| JD 起草（REC `jd-draft`） | 引用本域带宽区间口径 | `band` ← `bands.band` |
| 战略季度关账（STRAT `quarter-close`） | 调薪包触发 COMP 域双审批联动 | `comp_package_flag`、`approvals` |
| 长期激励/预算（FIN `budget-review`） | 调薪包成本占用部门季度包 | `cost_impact_wan`（区间）、`fin budget_wan` |

---

## 7. 权限矩阵

### 7.1 域级策略（取自 scene `policies`）

| 项 | 取值 | 落地 |
|---|---|---|
| 最低数据级别 | **L4** | `permission.min_level: L4`；越级读取即 DENY |
| 双审批 | **true** | `permission.dual_approval: true`；§5 全部审批链强制 |
| 脱敏字段 | `salary, bank_account, id_number` | `redact.fields`；gate=`redact_gate` |
| 记忆层 | `pii_allowed: false`，`exclude: []` | 个体薪酬禁入图；graph-memory `restricted` 命名空间已含 comp（L4 隔离子图） |

### 7.2 角色 × 能力

| 角色 | 定薪/调薪 | 核算/对账 | 带宽/CR 报告 | 工资条 | 说明 |
|---|---|---|---|---|---|
| admin | 全量 | 全量 | 全量 | 全量 | 仅本地；bank_account/id_number 完整值仅 admin（PRD §4.2） |
| hr（HRD） | 提案 + 审批（第 1 节点） | 复核 | 全量（区间输出） | 全量 | 审批留痕 |
| 财务/CFO | — | 审批（第 2 节点） | 区间 | 全量 | 加签 CEO 由批量影响阈值触发 |
| employee | — | — | — | **仅本人、仅 `已发放`** | 自助口径（PRD S5） |
| candidate | — | — | — | — | 无本域可见性 |

### 7.3 脱敏口径（PRD §4.2 + 参照 §4.2）

| 字段 | 脱敏规则 | 可见性 |
|---|---|---|
| 薪资（工资条/定薪/调薪） | 列表页 `¥**,***`；提案/报告一律 `a~b` 区间（万元/年，宽度 ≥4） | admin/hr 全量；employee 仅本人已发放工资条 |
| 银行账号 | `****` | 仅 admin（**本域表未落地该字段**） |
| 身份证号 | `110***********1234`（保留前 3 后 4） | 仅 admin/hr（**本域表未落地该字段**） |
| 员工标识 | `EMP-****NN` | 全域一律掩码 |

### 7.4 记忆层策略

`pii_allowed: false` → 可入图实体仅 `Band` / `SalaryStructure(anonymous)` / `Proposal`，关系仅 `WITHIN_BAND` / `DEVIATES_FROM` / `APPROVED_BY`（`templates/knowledge/seeds/comp.md` 建图规则）；个体薪酬字段不入实体属性（redact_gate 前置）。

---

## 8. Golden Tasks

本域 3 条，与 scene `golden_tasks` 逐字一致：

| ID | 输入 | 权限 | 工具 | 期望产物 | 数据 | 审计 | 质量 |
|---|---|---|---|---|---|---|---|
| GT-COMP-01 | 分析调薪提案与带宽偏离并生成报告 | L4+双审批 | `cap.excel.panel`, `cap.approval.multi` | `reports/comp/gt-01.md` | `data/comp/salary_master.xlsx`, `data/comp/salary-band.xlsx` | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |
| GT-COMP-02 | payroll 与发放明细对账出差异表 | L4+双审批 | `cap.excel.panel`, `cap.approval.multi` | `reports/comp/gt-02.md` | 同上 | 同上 | 同上 |
| GT-COMP-03 | 输出 CR 比率分布（区间口径） | L4+双审批 | `cap.excel.panel`, `cap.approval.multi` | `reports/comp/gt-03.md` | 同上 | 同上 | 同上 |

任务分解（对 `expected_plan` 的细化，供 Agent 定制）：GT-01 = 读 bands+adjust_queue → 逐行做带宽越界判定（§9.1）→ 按批次聚合 → 出区间报告；GT-02 = 应发/实发两口径分组 → 逐项差异 >0.5% 列出 → 归因；GT-03 = 逐人 CR 分档（<0.8 / 0.8–1.0 / 1.0–1.2 / >1.2）→ 按 band 聚合出分布，禁单值。
`expected_files` 中的 xlsx 为 scene 声明名（别名），实际读取 `data/comp/bands.csv` 与 `data/comp/adjust_queue.csv`（§1.2）。

---

## 9. 校验规则

### 9.1 带宽上下限校验

| 规则 | 判定式 | 动作 |
|---|---|---|
| 区间合法性 | `p25_wan < p50_wan < p75_wan`（bands 每行） | 违例即数据不可用 |
| 提案越界（超上限） | `max(proposed_salary_range_wan) > bands[proposed_band].p75_wan` | 标记"越界·超上限"；强制双审批 + 特批依据，否则 `已驳回` |
| 提案越界（低于下限） | `min(proposed_salary_range_wan) < bands[proposed_band].p25_wan` | 标记"越界·低于下限"；同上 |
| 在带内 | `p25 ≤ min ≤ max ≤ p75` | 常规双审批路径 |
| 职级外键 | `current_band`、`proposed_band` ∈ `bands.band` | 悬空即校验失败 |

**可验证样例**（区间口径，可复现；数据见 `adjust_queue.csv`，判定可溯源到行）：

| 记录 | 目标带宽 `p25/p50/p75` | 提案区间（万元/年） | 判定 |
|---|---|---|---|
| `EMP-****51` | P4 = 28/36/46 | 48~54 | **越界·超上限**（48 > 46，整段在带外） |
| `EMP-****88` | P6 = 60/80/105 | 58~68 | **越界·低于下限**（58 < 60） |
| `EMP-****46` | P5 = 42/55/70 | 66~76 | **越界·超上限**（76 > 70） |

其余 13 条提案均在目标带宽内，校验规则可通过"3 越界 + 13 合规"同时被正反验证。

### 9.2 区间口径（禁止个体明文）

| 规则 | 判定 | 动作 |
|---|---|---|
| 区间格式 | 薪资字段匹配 `^\d+(\.\d+)?~\d+(\.\d+)?$`，幅度字段匹配 `^-?\d+%~-?\d+%$` | 不符即 DENY |
| 最小宽度 | 薪资区间宽度 ≥ 4（万元/年）；幅度区间跨度 ≥ 3 个百分点 | 过窄视为可还原个体 → `redact_gate` 拦截 |
| 单值禁令 | reports/、交付物、审批件、审计记录中不得出现可还原到个体的单值薪资 | 一票否决（对齐 `rec.resume-forward` 的"未脱敏外发 = 一票否决"强度） |
| 输出白名单 | 允许：带宽值、区间、分档（CR zone）、聚合数（headcount/above_p75/below_p25/cost_impact_wan） | — |

### 9.3 调薪幅度上限

| 事由 | 幅度上限（区间上沿） | 超限动作 |
|---|---|---|
| 普调 | ≤10% | 强制升级审批 |
| 绩效调薪 | ≤15% | 强制升级审批 |
| 特别调薪（关键保留） | ≤20% | 强制升级审批 |
| 转正调薪 | ≤15% | 强制升级审批 |
| 异动调薪（调岗） | ≤45% | 加签 CEO |
| 晋升调薪（含跨级） | ≤55% | 加签 CEO |
| 超带宽校准（含下调） | 绝对值 ≤20% | 必须双审批 + 特批依据 |

自洽校验：设 `mid_current = (min+max)/2`（取 `current_salary_range_wan`），`mid_proposed = (min+max)/2`（取 `proposed_salary_range_wan`），则 `midpct = (mid_proposed / mid_current − 1) × 100%`，要求 `midpct ∈ [adjust_pct_range 下沿, 上沿]`（容差 ±2pp）。带宽限制优先于幅度上限——任何事由都不得突破目标带宽（带宽越界即走 §9.1）。

事由归类（CSV `reason` 取值 → 上表校验类别；数据内 16 条取值全部可归类）：

| CSV `reason` 取值 | 校验类别 |
|---|---|
| 晋升答辩通过 / 管理岗晋升 / 储备干部晋升 / 总监晋任 | 晋升调薪 |
| 绩效调薪（A 等）/ 绩效调薪（B 等） | 绩效调薪 |
| 普调（年度）/ 带宽内调薪 | 普调 |
| 特别调薪（关键保留）/ 特别调薪（补贴并入）/ 关键人才保留 / 长期激励校准 | 特别调薪 |
| 异动-调岗至平台组 | 异动调薪 |
| 超带宽校准 / 超带宽校准（低于下限） | 超带宽校准 |
| 转正调薪 | 转正调薪 |

现有 16 条数据在幅度口径下全部合规（含 1 条负幅度下调、2 条超带宽校准、3 条带宽越界——越界走 §9.1 特批路径，不因幅度合规而放行）。

### 9.4 社保/公积金/个税计算口径与公式

| 项 | 公式 | 说明 |
|---|---|---|
| 应发 `gross` | `基本 + 岗位 + 绩效 + 补贴 (+加班费 − 缺勤扣)` | 定薪四件套（参照 §3.2.18 定薪） |
| 社保 `social` | `基薪 × 10.5%` | PRD E2：社保（基薪 10.5%） |
| 公积金 `fund` | `基薪 × 7%` | PRD E2：公积金（7%） |
| 应纳税所得额 | `gross − social − fund − 起征点(5000/月) − 专项附加扣除` | 累计预扣法口径 |
| 个税 `tax` | 累计预扣：`(累计应纳税所得额 × 预扣率 − 速算扣除数) − 已预扣税额` | 分级累进 |
| 实发 `net` | `gross − social − fund − tax` | — |

对账恒等式：`gross − (net + social + fund + tax) = 0`；`comp.payroll-recon` 验收线：**差异 >0.5% 逐项列出**。以上明细**不落本域 CSV**，仅在 `reports/comp/*` 以区间/聚合口径输出。

### 9.5 其他数据级校验

| 规则 | 说明 |
|---|---|
| 状态-审批一致 | `status=已通过/已生效` ⇒ `approvals` 必须含 `HRD✓` 且 `CFO✓`；`status=草稿` ⇒ `approvals=-` |
| 生效月一致 | `status=已生效` ⇒ `effective_month` ≤ 当前核算月；`已通过` ⇒ 可为未来月 |
| 批次一致性 | 同一 `batch` 内不得混用不同 `zone` 的职级族之外语义；`queue-approve` 聚合按 `batch` 分组 |
| 跨域 ID 可对齐 | `employee_masked` 与 prf/ben 域同名 ID 可直接关联（不含原值） |

---

## 10. 特殊约束

1. **redact_gate 物理前置**（scene 脚注）：个体薪酬永不越过闸门流向公网/外部工具。闸门位于工作流 n2 条件之前，未过闸的载荷不进入审批、审计与交付物。
2. **唯一硬红线**：个体薪酬只出区间。任何 skill/工作流/自定义都不得新增单值薪资输出通道；区间最小宽度见 §9.2。
3. **域边界**：本域能力位 `cap.domain.comp`；跨域只传区间与 flag（`comp_package_flag`、`offer_band`、`band`），禁止跨域传明细。
4. **记忆层**：`pii_allowed=false`；个体薪酬不入图，仅带宽/偏离/审批关系可入（§7.4）。
5. **审批不可绕过**：L4 + 双审批为 scene 硬策略；批量影响 >50 万/年 加签 CEO（`comp.queue-approve` 验收）。
6. **字段准入**：`bank_account`/`id_number` 虽在 scene `redact.fields` 中，但当前**未落地**于本域表；如需引入须先扩 Type-Dict 并通过 redact_gate 演练，不得直接落盘。
7. **数据再生成风险**：`scripts/seed-domain-data.mjs` 为幂等种子脚本，重跑会以 5 行基线条目覆盖本目录；本域补齐（bands 12 行 / adjust_queue 16 行 + 5 追加列）须由脚本侧同步（该脚本不在本域可改范围，属跨域协同项）。
8. **已知未落地项（如实）**：scene `knowledge_seeds: seeds/comp/README.md` 未落地，实际种子为 `templates/knowledge/seeds/comp.md`；GT 的 `expected_files` 仍为 xlsx 声明名，实际读取 CSV（§1.2）。
