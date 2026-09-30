# Preset 设计文档 · 福利设计（ben）

> 015 §9.2 自制层基线。Agent 定制化时只许细化、不许删域（§8.3）。
> 本域定位：**薪酬福利域族（与 comp 同族）、全域 L4**（scene `permission.min_level: L4`）。唯一硬红线：**体检/健康数据只出聚合分布**——个体健康结果不入盘、不入交付物、不入记忆层（与 er-eap 的健康数据纪律同源，见 §6/§9.1/§10）。
> 事实源：`manifests/scenes/ben.plan-compare.yaml`（scene 唯一权威源）、`manifests/workflows/index.json`（domain=ben 共 6 条）、`manifests/workflows/ben.*.yaml`（节点级）、`templates/skills-domain/ben/SKILL-*.md`、`templates/Type-Dict/type-dict.csv`、`templates/workspace/data/ben/*.csv`（落地数据）。
> 深度参照：《HR智能体工作台-Workbench设计文档.md》§3.2（字段级数据字典写法）、§3.3（状态枚举集中定义）、§4.14（流程联动汇总）、§5.1-5.3（权限双轨与数据边界）、§7.1（种子规模）、§8.1-8.4（命名/校验/枚举/错误提示）；《HR智能体工作台-PRD.md》§3.7-G7（员工关怀）、§2.2（角色权限）、§4.2（敏感字段脱敏）。
> 数据快照基准日 **2026-09-29**（年度 2026；参保与核销记录截至 2026-03）。全部为合成数据，人员仅以掩码标识出现。

---

## 1 数据字典（总表）

**（a）落地资产**（数据根 `templates/workspace/data/ben/`）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| plans.csv | L2 | 无 | 14 | 福利方案目录：方案名/年度积分额度/保障范围/供应商（掩码）/比选组/类别/档位/人均成本/参保数/满意度/方案状态。与 scene 声明 `benefits-plan.xlsx`（L2）同构，CSV 落地 |
| usage.csv | L3 | 无（掩码 + 金额区间口径） | 14 | 员工弹性福利使用台账：掩码标识/积分消耗/余量/积分总额/申请-核销状态/理赔协办字段（金额仅区间）。**scene 未声明的派生表**，级别保守取 L3 |
| checkup_distribution.csv | L4 | 无（health_data 只以聚合形态落盘） | 16 | 体检结果**聚合分布**：年龄段 × 项目类别的受检数/异常数/异常率/抑制标记。对齐 scene 声明 `health-checkups.xlsx`（L4，health_data）；**个体健康结果不入盘**（§9.1/§9.4） |

行数为实测数据行（不含表头）；编码 UTF-8（无 BOM）、表头英文小写下划线、逗号分隔。

**（b）scene 声明 ↔ 实际落地映射（诚实口径）**

| scene 声明 | scene PII 字段 | 实际落地 | 差异说明 |
|---|---|---|---|
| `benefits-plan.xlsx` | —（无 PII） | `plans.csv` | 预置工作区以 CSV 落地；字段语义一致（plan/points/covers/provider 4 列逐字保留，追加 10 列，见 §1.1.1） |
| `health-checkups.xlsx` | health_data | `checkup_distribution.csv` | 仅落**聚合分布**；个体体检明细（姓名/工号/检查指标/结论）**刻意不落盘**，属设计红线而非缺失（§9.4） |
| （scene 未声明） | — | `usage.csv` | 使用/核销/理赔台账为本域派生表，scene 数据资产未声明；`employee_masked` 为掩码口径非 PII 原值 |

> 别名口径：GT 的 `expected_files` 仍写 xlsx 声明名，实际读取上表 CSV（同名归一化由 `scripts/data-consistency-check.mjs` 校验）；跨域引用（如 comp 域的福利成本口径）统一指向 `plans.csv` 的 `plan_id/cost_per_person_yuan/enrolled_count`。

---

## 1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`。

### 1.1.1 `plans.csv`（14 行）

表头逐字（14 列）：`plan,points_per_year,covers,provider_masked,plan_id,category,tier,comparison_group,eligible_group,cost_per_person_yuan,enrolled_count,satisfaction_score,status,effective_year`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `plan` | string | 是 | 方案名（中文展示名，全域唯一）；usage.plan 与本列逐字一致 |
| `points_per_year` | number | 是 | 年度积分额度（分/人·年），正整数；弹性福利测算的额度上限（§9.3） |
| `covers` | string | 是 | 保障/覆盖范围（`+` 连接的覆盖项，如 `门诊+住院+体检`）；比选"覆盖"维度的取值 |
| `provider_masked` | string | 是 | 供应商掩码名（`某保险公司`/`某体检机构`/`某运动平台`/`某EAP机构`/`某口腔机构`/`某出行平台`）；**禁供应商实名与合同号** |
| `plan_id` | string | 是 | 方案主键 `BEN-Pnn`，唯一；usage.plan_id 的外键指向本列 |
| `category` | enum | 是 | 福利类别：商业保险 / 健康体检 / 弹性健身 / 心理支持 / 齿科 / 通勤支持（比选组内类别必须一致，§9.2） |
| `tier` | enum | 是 | 档位：基础 / 升级 / 尊享（同组内的档次梯度，支撑"同维度多方案对照"） |
| `comparison_group` | string | 是 | 比选组 ID `GRP-<类别码>-<年>`；单一方案类目记 `-`（无同维对照） |
| `eligible_group` | string | 是 | 适用人群：全员 / 本人 / 本人+家属1人 / 本人+家属2人（家属口径与 §5"家属信息仅掩码"配套） |
| `cost_per_person_yuan` | number | 是 | 人均年度成本（元/人·年）；与积分额度的换算系数 = 本列 / `points_per_year`，须落在 1.5–2.5（§9.3） |
| `enrolled_count` | number | 是 | 本年度参保/选购人数；`草稿`/`比选中`/`已弃用` 行必须为 0（§9.5） |
| `satisfaction_score` | number | 否 | 最近一次年度满意度得分（1–5，一位小数）；`草稿`/`比选中` 记 `-`（尚无调查样本） |
| `status` | enum | 是 | 方案状态：草稿 / 比选中 / 已采纳 / 已弃用（§4.1） |
| `effective_year` | number | 是 | 生效年度（2026）；跨年度方案须新增行（append-only） |

**追加列声明**：`plan_id`、`category`、`tier`、`comparison_group`、`eligible_group`、`cost_per_person_yuan`、`enrolled_count`、`satisfaction_score`、`status`、`effective_year` 为本轮补齐时**追加**的列；原 4 列表头（`plan,points_per_year,covers,provider_masked`）逐字未改，原 4 行方案记录保留。

### 1.1.2 `usage.csv`（14 行）

表头逐字（15 列）：`employee_masked,points_used,plan,remaining,usage_id,plan_id,dept_masked,status,applied_month,settled_month,points_total,claim_masked,claim_type,claim_days,claim_amount_range_yuan`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `employee_masked` | string | 是 | 员工掩码标识 `EMP-****NN`。**禁原值**；与 comp/prf/er-eap 域同 ID 可跨域对齐（§6） |
| `points_used` | number | 是 | 已消耗积分（≥0）；必须 ≤ `points_total`（超额度即拦截，§9.3） |
| `plan` | string | 是 | 所选方案名，外键（展示口径）→ `plans.plan`，须逐字一致 |
| `remaining` | number | 是 | 剩余积分 = `points_total − points_used`（≥0）；**不得以 0 掩盖负值**（§9.3/§10） |
| `usage_id` | string | 是 | 使用记录主键 `BEN-Unnn`，唯一 |
| `plan_id` | ref | 是 | → `plans.plan_id` 外键；禁止孤儿行，且所引方案必须 `status=已采纳`（§9.5） |
| `dept_masked` | string | 是 | 归属部门（部门粒度，不构成个人可回溯信息） |
| `status` | enum | 是 | 使用状态：已申请 / 已核销 / 已驳回（§4.2） |
| `applied_month` | string | 是 | 申请月 `YYYY-MM` |
| `settled_month` | string | 否 | 核销月 `YYYY-MM`；`已申请`/`已驳回` 记 `-` |
| `points_total` | number | 是 | 年度积分总额，必须等于所引方案的 `plans.points_per_year`（积分测算口径，§9.3） |
| `claim_masked` | string | 否 | 理赔协办掩码单号 `CLM-****NN`；仅参保类方案的已核销行填写，其余 `-` |
| `claim_type` | enum | 否 | 险种**结算类别**：门诊 / 住院 / 意外 / 齿科；**禁诊断、病种、检查指标、药品明细**（§9.4） |
| `claim_days` | number | 否 | 协办结案时效（自然日，≥0）；未结案记 `-` |
| `claim_amount_range_yuan` | string | 否 | 理赔金额**区间**（`a~b`，元，下沿 ≥100 且宽度 ≥1000）；**禁单值**（对齐 `ben.claim-review` 验收"理赔金额仅区间"） |

**追加列声明**：`usage_id`、`plan_id`、`dept_masked`、`status`、`applied_month`、`settled_month`、`points_total`、`claim_masked`、`claim_type`、`claim_days`、`claim_amount_range_yuan` 为追加列；原 4 列表头（`employee_masked,points_used,plan,remaining`）逐字未改。

### 1.1.3 `checkup_distribution.csv`（16 行）

表头逐字（8 列）：`year,age_band,item_category,examined_count,abnormal_count,abnormal_rate_pct,suppression_flag,note`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `year` | number | 是 | 体检年度（2026） |
| `age_band` | enum | 是 | 年龄段：20-29岁 / 30-39岁 / 40-49岁 / 50岁以上（**聚合分组**，非出生日期） |
| `item_category` | enum | 是 | 体检项目类别：血压 / 血脂 / 血糖 / 骨密度（**类别标签**，不含检查数值与结论） |
| `examined_count` | number | 是 | 该年龄段接受该项目检查人数（聚合分母 n） |
| `abnormal_count` | number | 是 | 异常检出计数（聚合分子，≤ `examined_count`） |
| `abnormal_rate_pct` | number | 否 | 异常检出率（%，一位小数，= `abnormal_count / examined_count × 100`）；`suppression_flag=suppressed` 时记 `-` |
| `suppression_flag` | enum | 是 | `normal` / `suppressed`（`examined_count < 5` 即抑制，不出分防反推，§9.1） |
| `note` | string | 否 | 备注（加项说明/抑制原因），不含个体信息 |

**本表为唯一承载体检数据的落地表，只含聚合计数与占比，无员工标识列、无个体结果列**（§9.4 一票否决口径）。

**与参照实体的字段映射**（Workbench §3.2 实体口径）：

| 参照实体/字段 | 本域落地 | 口径差异 |
|---|---|---|
| PRD §3.7-G7 员工关怀（节日/生日/福利关怀记录） | `plans.csv`（方案目录）+ `usage.csv`（个人申领记录） | 关怀记录细化为"方案—积分—核销"三段可核账口径 |
| 参照无体检实体（PRD 仅"入职材料含体检"） | `checkup_distribution.csv`（年龄段 × 项目类别聚合） | 本域**只接聚合统计**，不接个体体检报告；个体结果留在外部体检机构系统 |
| Workbench §3.2.4 `employees.gender/dept` 等 | `usage.dept_masked` | 只保留部门粒度，员工标识降级为掩码 |

---

## 2 技能规格

本域技能以 scene `skills` 为准，共 3 个（实现见 `templates/skills-domain/ben/SKILL-<name>.md`）：

| 技能 | 绑定工作流 | 用途 | 输入 | 输出 | 权限 | 质量检查与门禁 |
|---|---|---|---|---|---|---|
| `plan-compare` | ben.vendor-compare、ben.plan-enroll | 福利方案比选（成本/覆盖/满意度三维）与投保/变更核对 | `data/ben/plans.csv`、`data/ben/usage.csv` | `vendor-compare-<ts>.json`、`plan-enroll-<ts>.json` + `reports/ben/*` | L4；`redact_gate: true` | Expected vs Actual 逐项比对；比选维度完整性（§9.2）；结论可溯源到 `plan_id` 行；连续 3 次失败 → 登记 capability-gap 并停止任务 |
| `checkup-report` | ben.checkup-report、ben.claim-review | 体检数据**脱敏聚合**统计报告；理赔协办周报（时效/结案） | `data/ben/checkup_distribution.csv`、`data/ben/usage.csv` | `checkup-report-<ts>.json`、`claim-review-<ts>.json` + `reports/ben/*` | L4；`redact_gate: true` | 只出分布：n<5 不出分（§9.1）；个体健康字段命中即一票否决（§9.4）；理赔金额仅区间 |
| `flex-benefit` | ben.points-calc、ben.annual-survey | 弹性福利积分测算（年度额度/选配/余量）与年度满意度聚合 | `data/ben/plans.csv`、`data/ben/usage.csv` | `points-calc-<ts>.json`、`annual-survey-<ts>.json` + `reports/ben/*` | L4；`redact_gate: true` | 剩余分为负即拦截（§9.3）；聚合 n<5 抑制；开放题只出主题标签不出原文 |

- 依赖能力：`cap.excel.panel`、`cap.approval.single`、`cap.redact.all`（scene `required_capabilities`；审批节点由工作流 n3 承载）。
- 路由：`templates/skills-domain/ben/SKILL-cockpit-intent.md` 目前只登记 2 条路由（`vendor-compare` / `checkup-report`）；其余 4 条工作流由命令触发或经 Chief of Staff（`cap.orchestration.chief`）编排（属跨域协同项，不在本域可改范围）。
- 执行前置：读取 `data/ben/` 前校验 Level ≤ L4，越级即 DENY；产出前过 `redact_gate`。
- **技能绑定纪律**：GT-BEN-02（体检聚合）必须由 `checkup-report` 执行，不得用 `flex-benefit` 顶替；GT-BEN-03（积分测算）必须由 `flex-benefit` 执行；GT-BEN-01（方案比选）必须由 `plan-compare` 执行（015 §15.4 技能一致性比对）。

---

## 3 工作流

本域工作流**全部 6 条**（`manifests/workflows/index.json` 中 `domain === "ben"`；每条均有 `manifests/workflows/ben.*.yaml` 落地）：

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| `ben.vendor-compare@1.0.0` | `n3`：L4 + `dual: true`（HITL） | `vendor-compare-<ts>.json`：`category / vendors / points / winner`；验收=健康数据 L4 禁入记忆层 | 方案比选（DAG：商保/体检/弹性）；kind=approve，skill=`plan-compare`，trigger=`vendor-compare` |
| `ben.checkup-report@1.0.0` | 无（不触发审批节点） | `checkup-report-<ts>.json`：`employee_masked / abnormal_items / followup / year`；验收=个体健康指标不出原值，仅建议 | 体检报告聚合（脱敏）；kind=report，skill=`checkup-report`，trigger=`checkup-report` |
| `ben.points-calc@1.0.0` | 无 | `points-calc-<ts>.json`：`employee_masked / points_total / selected / remaining`；验收=剩余分可为负拦截 | 弹性积分测算（年度额度）；kind=calc，skill=`flex-benefit`，trigger=`points-calc` |
| `ben.plan-enroll@1.0.0` | `n3`：L4 + `dual: true`（HITL） | `plan-enroll-<ts>.json`：`employee_masked / plan / effective_date / approver`；验收=家属信息仅掩码 | 方案投保/变更审批；kind=approve，skill=`plan-compare`，trigger=`plan-enroll` |
| `ben.claim-review@1.0.0` | 无 | `claim-review-<ts>.json`：`claim_masked / type / days / status`；验收=理赔金额仅区间 | 理赔协办周报（时效/结案）；kind=report，skill=`checkup-report`，trigger=`claim-review` |
| `ben.annual-survey@1.0.0` | 无 | `annual-survey-<ts>.json`：`dimension / score / n / verbatim_theme`；验收=开放题经脱敏聚合 | 年度福利满意度调查（聚合）；kind=report，skill=`flex-benefit`，trigger=`annual-survey` |

**场景声明与工作流清单的口径差**：scene `workflows:` 只声明 `[ben.vendor-compare, ben.checkup-report]` 2 条核心主线；`index.json` 中 `domain=ben` 注册 6 条。§3 以 **index.json + 6 份 YAML** 为准（全部有落地链路）。

**交付物字段与红线的收口（诚实口径）**：`ben.checkup-report` 的字段声明含 `employee_masked`，与本域"体检只出分布"红线存在字面冲突 → 落地口径为：**字段名保留（不改工作流定义），取值收敛**——`employee_masked` 一律记 `-`（或聚合分组标签），`abnormal_items` 填项目**类别**枚举（血压/血脂/血糖/骨密度），`followup` 填聚合级建议，`year` 填年度；不得回填任何个体标识或个体结果。`ben.points-calc` 的 `employee_masked` 为处理单元标识（积分测算按人计算），保留掩码原样。

### 3.1 节点链明细

| 工作流 | 节点链 | 回滚 |
|---|---|---|
| `ben.vendor-compare` | n1 skill(plan-compare) → n2 condition(触发对外/生效动作) → **n3 approval(L4,dual)** → n4 tool(cap.excel.panel.write) → n5 audit | savepoint `pre-vendor-compare` |
| `ben.checkup-report` | n1 skill(checkup-report) → n2 tool(cap.excel.panel.write) → n3 audit | savepoint `pre-checkup-report` |
| `ben.points-calc` | n1 skill(flex-benefit) → n2 tool → n3 audit | savepoint `pre-points-calc` |
| `ben.plan-enroll` | n1 skill(plan-compare) → n2 condition → **n3 approval(L4,dual)** → n4 tool → n5 audit | savepoint `pre-plan-enroll` |
| `ben.claim-review` | n1 skill(checkup-report) → n2 tool → n3 audit | savepoint `pre-claim-review` |
| `ben.annual-survey` | n1 skill(flex-benefit) → n2 tool → n3 audit | savepoint `pre-annual-survey` |

> 审批留痕统一落 audit n5：审批人 + 依据数据版本 + 产物哈希；`condition` 的 then 分支禁止绕过 n3 直连 `cap.excel.panel.write`（015 §8.2）。

---

## 4 状态机

### 4.1 福利方案（`plans.status`）

枚举：`草稿(draft)` / `比选中(comparing)` / `已采纳(adopted)` / `已弃用(deprecated)`；落地存中文枚举值（工作台事实表口径，参照 §3.3 集中常量）。

| 迁移 | 触发条件 | 守卫 | 证据字段 |
|---|---|---|---|
| `草稿 → 比选中` | 方案进入 `comparison_group` 比选（组内 ≥2 方案） | 组内类别一致、成本与覆盖非空（§9.2） | `comparison_group` 赋予 + `status` 变更 + audit 事件 |
| `比选中 → 已采纳` | `ben.vendor-compare` 胜出 或 `ben.plan-enroll` 投保审批通过 | n3 L4 双审批齐备；年度预算增量 >20 万元/年 加签 CEO（§5） | `status=已采纳` + `approvals` + 依据数据版本 |
| `比选中 → 已弃用` | 比选落败或年度评审不通过 | 须记录落败维度（成本/覆盖/满意度） | `status` 变更 + audit |
| `已采纳 → 已弃用` | 年度评审下架 / 供应商变更 / 参保归零 | 已有参保行须先结清（usage 对应行置 `已核销`） | `status` + `enrolled_count=0` |
| 回滚 | 交付物/落盘异常 | savepoint 回退 | `pre-vendor-compare` / `pre-plan-enroll` 快照 |

字段一致性（§9.5）：`草稿/比选中 ⇒ enrolled_count = 0 且 satisfaction_score = -`；`已采纳 ⇒ enrolled_count > 0 且 satisfaction_score 非空`；`已弃用 ⇒ enrolled_count = 0`（满意度可保留历史值，如 `BEN-P13` = 3.9）。终态（已弃用）不得回退，变更只可新增行（append-only）。

### 4.2 员工福利使用（`usage.status`）

枚举：`已申请(applied)` / `已核销(settled)`；`已驳回(rejected)` 为终止态（本域按审批需要补齐）。
主链：**已申请 → 已核销**。

| 迁移 | 触发条件 | 守卫 | 证据字段 |
|---|---|---|---|
| `已申请 → 已核销` | 积分扣减校验通过且方案已生效 | `points_used ≤ points_total = plans.points_per_year`；`remaining = points_total − points_used ≥ 0`，负值即拦截（对齐 `ben.points-calc` 验收） | `status`/`settled_month` 回填 + `points_used`/`remaining` |
| `已申请 → 已驳回` | 名额已满、材料不符或超年度额度 | `points_used` 必须归 0，`remaining` 回到 `points_total` | `status=已驳回` + audit（驳回原因必填） |
| 回滚 | 交付物/落盘异常 | savepoint 回退 | `pre-points-calc` 快照 |

样例数据：`已核销` 9 行、`已申请` 4 行（`BEN-U003/U007/U008/U013`，`settled_month=-` 且无理赔字段）、`已驳回` 1 行（`BEN-U012`，`points_used=0`、`remaining=900`）。

### 4.3 理赔协办阶段（派生，不落盘）

`ben.claim-review` 交付物的 `status` 不设独立列，由 `usage.status` **派生**：`已申请` → 协办中（`claim_days=-`）；`已核销` → 已结案（`claim_days` 为结案时效）；`已驳回` → 不予受理。理由：理赔是参保核销的附属流程，独立状态列会与 `usage.status` 形成双写不一致（参照 §8.3 状态迁移只经唯一函数）。

---

## 5 审批链

| 事项 | 节点 | 角色（双审批，两名不同审批人） | 级别 | 是否双审批 | 阈值与说明 |
|---|---|---|---|---|---|
| 方案采纳/比选定稿（`ben.vendor-compare`） | n2 条件 → n3 审批 | 甲：HR 福利负责人；乙：财务负责人 | L4 | 是（`dual: true`） | 年度预算增量 >20 万元/年 加签 CEO；审批件只载 `category/vendors/points/winner`（不含个体使用明细） |
| 方案投保/变更（`ben.plan-enroll`） | n2 条件 → n3 审批 | 甲：HR 福利负责人；乙：HRD | L4 | 是（`dual: true`） | 家属参保为高敏动作：家属信息仅掩码（`E1***` 形态），不得载入姓名/证件/关系明细 |
| 弹性积分测算（`ben.points-calc`） | 无审批节点（kind=calc） | — | L4 | 否 | 不是审批而是**硬闸门**：`remaining < 0` 即拦截，不出交付物（§9.3） |
| 体检聚合报告（`ben.checkup-report`） | 无审批节点（kind=report） | — | L4 | 否 | 输出前过 `redact_gate` + n<5 抑制；个体健康字段命中即一票否决（§9.1/§9.4） |
| 理赔协办周报（`ben.claim-review`） | 无审批节点（kind=report） | — | L4 | 否 | 理赔金额仅区间；涉对外理赔材料外发时回到 `ben.plan-enroll` 走双审批 |
| 年度满意度调查（`ben.annual-survey`） | 无审批节点（kind=report） | — | L4 | 否 | 聚合 n<5 抑制；开放题只出主题标签（`verbatim_theme`），禁原文 |

- **域级 vs 节点级**：scene `permission.dual_approval: false` 是域级基线（普通报表任务免双审批）；**任何对外/生效动作在节点级升到 L4 + 双审批**（§3 的 n3），与 rec 域同构造。
- 角色映射为落地建议（scene/工作流未钉角色名，按 ROLES/caps 配置）；阈值 >20 万元/年为基线建议值。
- 审批留痕：`audit/n5` 记录审批人 + 依据数据版本 + 产物哈希；驳回原因必填；批复件与产物不一致即 `on_fail=rollback`。

---

## 6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，不得绕过 §5 审批链。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 方案采纳（`ben.vendor-compare` 双审批通过） | ①参保口径与**人均福利成本**进入 comp 域薪酬包成本测算（福利成本 = `cost_per_person_yuan × enrolled_count`，按聚合口径）；②**积分不折算现金工资、不计入社保/公积金基数**（与 comp §9.4 口径解耦，避免重复计列） | plans.csv：`plan_id / category / cost_per_person_yuan / enrolled_count / status=已采纳`；comp `cost-projection`：`cost_impact_wan`（区间） |
| 方案投保/变更（`ben.plan-enroll` 通过） | 员工参保状态变更 → 入职/离职联动：新入职参保、`er-eap.offboard-approve` 离职完成后停保结算（当年按在职月数折算额度） | `plan-enroll-<ts>.json`：`employee_masked / plan / effective_date / approver`；usage：`points_total / applied_month` |
| 体检数据接入（`ben.checkup-report`） | **只出分布**：输出年龄段 × 项目类别计数与占比；与 er-eap 健康数据纪律一致（禁入记忆层、n<5 不出分、禁公网外发）；个体体检明细留在体检机构系统 | checkup_distribution.csv：`age_band / item_category / examined_count / abnormal_count / abnormal_rate_pct / suppression_flag`；`checkup-report-<ts>.json`：`abnormal_items / followup / year` |
| 福利使用核销（usage `已申请 → 已核销`） | 费用核销联动 fin：以**总量口径**登记福利费用（按部门/期间汇总），个人理赔金额仅以区间进入协办台账，不与报销单重复计列 | usage：`usage_id / dept_masked / points_used / settled_month / claim_amount_range_yuan`；fin 费用台账按 `dept_masked + period` 聚合 |
| 理赔协办（`ben.claim-review`） | 结案时效与结案率进入福利运营周报；**不做医疗结论**，不引用任何诊断/病种信息；涉对外材料外发转 `ben.plan-enroll` 双审批 | `claim-review-<ts>.json`：`claim_masked / type / days / status`；usage：`claim_days / claim_amount_range_yuan / claim_type` |
| 年度满意度调查（`ben.annual-survey`） | 满意度维度分回流方案比选（`satisfaction_score` 更新只在年度调查后）与次年预算建议 | plans.csv：`satisfaction_score`；`annual-survey-<ts>.json`：`dimension / score / n / verbatim_theme` |
| 心理支持类方案使用（`plans.category=心理支持`） | **本域只记积分消耗，不记咨询内容**；心理支持转介/危机干预一律走 er-eap 的匿名转介流程（`er-eap.eap-referral`，L4+ 独立命名空间） | plans：`category=心理支持`；usage：`points_used`（无内容字段）；er-eap：`eap_referrals.anon_id` |
| 供应商比选结果 | 合同与采购价格核对走 admin/cmp：合同价格与 `provider_masked` 绑定留痕（本域不落供应商实名） | plans：`provider_masked / cost_per_person_yuan`；admin `vendor-price` 交付件 |

---

## 7 权限矩阵

### 7.1 域级策略（取自 scene `policies`）

| 项 | 取值 | 落地 |
|---|---|---|
| 最低数据级别 | **L4** | `permission.min_level: L4`；越级读取即 DENY |
| 双审批（域级） | **false** | `permission.dual_approval: false`；对外/生效动作在**节点级**升为 `dual: true`（§5） |
| 脱敏字段 | `health_data, insurance_id` | `redact.fields`；gate=`redact_gate`；命中写 redact 日志 |
| 记忆层 | `pii_allowed: false`，`exclude: []` | 健康数据与个体使用明细分禁入图；可入图仅聚合节点（§7.4） |
| 必装能力位 | `cap.excel.panel`、`cap.approval.single`、`cap.redact.all` | `required_capabilities` |

### 7.2 角色 × 能力

| 角色 | 方案目录/比选 | 积分与使用台账 | 体检聚合报告 | 理赔协办 | 说明 |
|---|---|---|---|---|---|
| admin | 全量 | 全量（掩码） | 仅聚合 | 全量（金额区间） | 仅本地；无个体健康明细可看（本域不落盘） |
| hr（福利负责人） | 全量 + 提案 | 全量（掩码） | 仅聚合 | 全量 | 双审批第 1 节点 |
| 财务/CFO | 只读（成本维度） | 只读（聚合） | **无** | 只读（金额区间） | 双审批第 2 节点；预算阈值加签 CEO |
| employee | 只读本人可选方案 | **仅本人**（积分余额/参保方案） | 本人年度建议（不落盘，仅提示） | 仅本人协办进度 | 自助口径（对齐 PRD S1-S5 模式） |
| candidate | — | — | — | — | 无本域可见性 |

### 7.3 脱敏口径（高敏字段）

| 字段类别 | 脱敏规则 | 可见性 |
|---|---|---|
| 体检/健康数据（`health_data`） | **只出聚合分布**（年龄段 × 项目类别计数/占比），n<5 抑制；任何个体结果（姓名/工号/指标值/结论）不入盘、不出交付物 | 所有角色一律只见聚合（§9.1） |
| 参保标识（`insurance_id`） | 掩码 `****`；本域表未落地该字段（见 §10-9） | — |
| 家属信息（plan-enroll） | 仅掩码形态；审批件不得载姓名/证件/关系明细 | 审批人（掩码口径） |
| 理赔金额 | 一律区间 `a~b`（下限 ≥100 元、宽度 ≥1000 元），列表页与交付物均不出现单值 | hr/admin/财务（区间） |
| 员工标识 | `EMP-****NN`（与 comp/prf/er-eap 同构） | 全域一律掩码 |
| 供应商 | `provider_masked`（`某保险公司` 形态），禁实名与合同号 | 全域一律掩码 |

### 7.4 记忆层策略

`pii_allowed: false` → 可入图实体仅 `Plan` / `Vendor` / `Benefit` / `Enrollment(anonymous)`，关系仅 `OFFERED_BY` / `COMPARES_TO` / `COVERS`（`templates/knowledge/seeds/ben.md` 建图规则）；**健康数据不入图，仅保留聚合统计节点**；个体使用明细与理赔区间字段不入实体属性（redact_gate 前置）。

---

## 8 Golden Tasks

本域 3 条，与 scene `golden_tasks` 逐字一致：

| ID | 输入 | 权限 | 工具 | 期望产物 | 数据 | 审计 | 质量 |
|---|---|---|---|---|---|---|---|
| GT-BEN-01 | 生成三套福利方案比选矩阵 | L4（触发生效动作时 n3 双审批） | `cap.excel.panel`, `cap.approval.single` | `reports/ben/gt-01.md` | `data/ben/benefits-plan.xlsx`, `data/ben/health-checkups.xlsx`（落地 `plans.csv` / `checkup_distribution.csv`） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据 |
| GT-BEN-02 | 体检数据脱敏聚合报告（只出分布） | L4 | `cap.excel.panel`, `cap.approval.single` | `reports/ben/gt-02.md` | 同上 | 同上 | 同上 |
| GT-BEN-03 | 弹性福利积分测算与模拟 | L4 | `cap.excel.panel`, `cap.approval.single` | `reports/ben/gt-03.md` | 同上 | 同上 | 同上 |

**任务分解**（对 `expected_plan` 的细化，供 Agent 定制）：

1. **GT-BEN-01**：① 读 `plans.csv` 14 行，按 `comparison_group` 聚合出 5 个比选组（`GRP-INS-2026` 3 行 / `GRP-CHK-2026` 3 行 / `GRP-FIT-2026` 2 行 / `GRP-EAP-2026` 2 行 / `GRP-COM-2026` 2 行）；② 逐组按**成本维度**（`cost_per_person_yuan`）、**覆盖维度**（`covers`）、**满意度维度**（`satisfaction_score`）出对照矩阵，矩阵单元格值必须溯源到 `plan_id` 行；③ winner 判定要求组内至少 1 行 `status=已采纳`（基线）；`GRP-COM-2026` 无已采纳基线（基线 `BEN-P13` 已弃用、候选 `BEN-P14` 草稿）→ **只出对照不出 winner**，并提示先走 `ben.plan-enroll`；④ 采纳动作必须经 n3 L4 双审批。
2. **GT-BEN-02**：① 读 `checkup_distribution.csv` 16 行（4 年龄段 × 4 项目类别），只做聚合汇总；② 抑制校验：`50岁以上 × 骨密度` 的 `examined_count=3 < 5` 且 `suppression_flag=suppressed`，该格**不出分**（`abnormal_rate_pct=-`），报告中记 suppressed 并说明防反推理由；③ 输出 `checkup-report-<ts>.json` 时 `employee_masked` 记 `-`、`abnormal_items` 填项目类别、`followup` 填聚合建议；④ 全流程禁个体字段、禁入记忆层。
3. **GT-BEN-03**：① 读 `usage.csv` 14 行 + `plans.csv`，逐行重算 `points_total`（必须 = 所引方案的 `points_per_year`）与 `remaining = points_total − points_used`；② 校验 `remaining ≥ 0`，负值即拦截（示例：`EMP-****12` 1600−1450=150；`EMP-****88` 1600−1200=400；`EMP-****07` 600−300=300）；③ 输出 `points-calc-<ts>.json`：`employee_masked / points_total / selected / remaining`；④ 只读模拟，不回写台账、不产生真实扣账。

---

## 9 校验规则

### 9.1 体检数据只出分布（聚合口径 + n<5 抑制）

| 规则 | 判定式 | 动作 |
|---|---|---|
| 聚合口径 | 体检数据只能以 `age_band × item_category` 聚合形态出现；表内不得存在员工标识列/个体结果列 | 出现个体行即一票否决（§9.4） |
| 计数自洽 | `abnormal_count ≤ examined_count`；`abnormal_rate_pct = abnormal_count / examined_count × 100`（±0.1pp） | 违例即数据不可用 |
| n<5 抑制 | `examined_count < 5 ⇒ suppression_flag=suppressed` 且 `abnormal_rate_pct=-` | 未抑制即 FAIL（防反推） |
| 分组下钻限制 | 报告不得按部门/职级/性别等更细维度交叉（避免反推到个体） | 越细维度即 DENY |
| 对外禁令 | 体检类产物不得出域/入记忆层/公网外发（与 er-eap 同纪律） | 命中即一票否决 |

**可验证样例**：`50岁以上 × 骨密度` `examined_count=3`、`abnormal_count=2`、`abnormal_rate_pct=-`、`suppression_flag=suppressed`（刻意埋点，用于回归 n<5 抑制规则）；其余 15 行 `normal`，形成"15 出分 + 1 抑制"的正反样例。

### 9.2 方案比选维度完整性

| 规则 | 判定式 | 动作 |
|---|---|---|
| 组内规模 | `comparison_group ≠ -` ⇒ 组内 ≥2 行（`GRP-COM-2026` 2 行、`GRP-FIT-2026` 2 行、`GRP-EAP-2026` 2 行、`GRP-INS-2026` 3 行、`GRP-CHK-2026` 3 行） | 单行组即 FAIL（应记 `-`） |
| 组内同质 | 组内 `category` 必须一致（`GRP-INS-2026` 全为 商业保险，`GRP-CHK-2026` 全为 健康体检） | 混类别即 FAIL |
| 维度齐全 | 组内每行 `points_per_year`/`cost_per_person_yuan`/`covers`/`tier` 非空；比选矩阵须覆盖 成本 / 覆盖 / 满意度 三维 | 缺维度的 winner 判定无效 |
| 基线要求 | winner 判定要求组内 ≥1 行 `status=已采纳`；无基线组（`GRP-COM-2026`）只出对照不出 winner | 违反即视为越权结论 |
| 溯源 | winner 与每个对照值可下钻到 `plan_id` 行（含 `provider_masked`、`enrolled_count`） | 无溯源即 FAIL |

### 9.3 弹性福利积分测算口径

| 规则 | 判定式 | 动作 |
|---|---|---|
| 额度来源唯一 | `usage.points_total = plans[usage.plan_id].points_per_year`（14 行全部成立） | 不符即数据不可用 |
| 余量恒等式 | `remaining = points_total − points_used`，且 `remaining ≥ 0`；**禁止以 0 掩盖负值** | 负值即拦截（`ben.points-calc` 验收：剩余分可为负拦截） |
| 积分-成本系数 | `cost_per_person_yuan / points_per_year ∈ [1.5, 2.5]`，且同 `category` 组内一致（商业保险 2.2 / 健康体检 2.0 / 弹性健身 1.8 / 心理支持 2.4 / 齿科 1.6 / 通勤支持 1.5） | 越界即预算口径不可用 |
| 状态-字段一致 | `已申请` ⇒ `settled_month=-` 且理赔四字段（`claim_masked/claim_type/claim_days/claim_amount_range_yuan`）全 `-`；`已核销` ⇒ `settled_month` 非空；`已驳回` ⇒ `points_used=0` 且 `remaining=points_total` | 违例即拒写 |
| 方案可选择性 | `usage.plan_id` 所引方案必须 `status=已采纳`（草稿/比选中/已弃用不可被选购） | 孤儿或不可选方案即 FAIL |

### 9.4 个人健康字段禁明文

| 层级 | 禁令 | 判据 |
|---|---|---|
| 数据层 | `checkup_distribution.csv` 只有聚合列；任何新增个人健康字段须先过 Type-Dict 扩项 + 隐私评审 | 表头正则扫描 + 行级抽样 |
| 使用层 | `usage.claim_type` 仅险种结算类别（门诊/住院/意外/齿科）；**禁诊断、病种、检查指标、药品明细** | 字段值白名单 |
| 交付层 | 报告/交付物/审批件中不得出现个体健康原值与可反推的小样本（n<5） | `redact_gate` 命中日志 + n 值成对校验 |
| 记忆层 | 健康数据不入图（`pii_allowed=false`），仅聚合统计节点 | 记忆面板排除 + 写入日志 |

> 与 er-eap 的健康数据纪律一致：`redact.fields` 含 `health_data`，命中即过闸；未过闸输出 = 一票否决。

### 9.5 其他数据级校验

| 规则 | 说明 |
|---|---|
| 外键完整性 | `usage.plan_id → plans.plan_id` 必须命中；`usage.plan ↔ plans.plan` 逐字一致；禁止孤儿行 |
| 状态-字段一致 | 见 §4.1（方案）与 §9.3（使用）两条；`已弃用 ⇒ enrolled_count=0` |
| 主键唯一 | `plan_id`（14 个）、`usage_id`（14 个）、`claim_masked`（4 个，仅核销行）唯一；掩码后不得用于唯一性判定以外的反查 |
| 家属口径 | `eligible_group` 含家属的方案，其参保/理赔记录不得落家属个人信息（仅掩码 + 关系类别） |
| 格式与编码 | UTF-8（无 BOM）、LF、表头英文小写下划线、逗号分隔；空值统一 `-`；金额区间格式 `^\d+~\d+$` |
| 数据一致性 | 本文件 §1/§1.1 的文件名、行数（14/14/16）与字段须与 `templates/workspace/data/ben/*.csv` 逐表一致（`scripts/data-consistency-check.mjs`；xlsx/csv 同名归一化） |
| 跨域 ID 可对齐 | `employee_masked` 与 comp/prf/er-eap 同 ID 可直接关联（不含原值） |

---

## 10 特殊约束

1. **体检/健康数据只出分布（唯一硬红线）**：个体健康结果不入盘、不出交付物、不入记忆层；聚合口径 + n<5 抑制（§9.1/§9.4）。任何 skill/工作流/自定义都不得新增个体健康输出通道。
2. **记忆层**：`pii_allowed=false`；健康数据不入图，仅聚合统计节点可入；个体使用明细与理赔字段不入实体属性（§7.4）。
3. **域边界**：本域能力位 `cap.domain.ben`；跨域只传聚合与区间（人均成本、参保数、部门费用汇总、积分额度），禁止跨域传个体健康明细与理赔单值。
4. **审批不可绕过**：方案采纳/投保变更必须走 n3（L4 + `dual: true`）；`condition` 的 then 分支禁止直连写能力；family 参保按高敏动作处理。
5. **家属信息仅掩码**：`ben.plan-enroll` 验收口径；参保与理赔记录不得携带家属姓名/证件/关系明细。
6. **理赔金额仅区间**：`ben.claim-review` 验收口径；单值金额出现即拒绝交付（对齐 §9.4 交付层禁令）。
7. **redact_gate 前置**：`health_data`、`insurance_id` 命中即过闸；未脱敏载荷不进入审批、审计与交付物。
8. **数据再生成风险**：`scripts/seed-domain-data.mjs` 为幂等种子脚本，重跑会以 4 行基线条目覆盖 `plans.csv`/`usage.csv`；本域补齐（14/14 行 + 追加列，新增 `checkup_distribution.csv` 16 行）须由脚本侧同步（该脚本不在本域可改范围，属跨域协同项）。
9. **已知未落地项（如实）**：① scene `knowledge_seeds: seeds/ben/README.md` 未落地，实际种子为 `templates/knowledge/seeds/ben.md`；② `insurance_id` 在 `redact.fields` 中但本域表未落地该字段，如需引入须先扩 Type-Dict 并通过 redact_gate 演练；③ `usage.csv` 与 `checkup_distribution.csv` 未登记 Type-Dict（现仅 `benefits-plan` / `health-checkups` 两行），补登属跨域协同项；④ GT 的 `expected_files` 仍为 xlsx 声明名，实际读取 CSV（§1(b)）。
10. **规则命中样例（刻意埋点）**：`50岁以上 × 骨密度`（n=3 抑制）；`GRP-COM-2026`（无已采纳基线的比选组）；`BEN-U012`（已驳回、积分归零）；`BEN-U003/U007/U008/U013`（在途申请）。以上用于回归 §9 各规则，非数据缺陷。
11. **数据修正说明**：原 `usage.csv` 中 `EMP-****51` 记 `points_used=600`，超出 EAP 方案年度额度 300 且 `remaining` 记 0（掩盖负值）——本轮按"额度上限 + `remaining=points_total−points_used`"口径修正为 `300 / 0`，并新增 `points_total` 列使恒等式可机检（§9.3）。
