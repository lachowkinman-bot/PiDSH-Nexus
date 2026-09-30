# Preset 设计文档 · 培训管理（trn）

> 015 §9.2 自制层基线（12 域之一，Agent 定制化时**只许细化、不许删域**，015 §8.3）。
> 事实来源：`manifests/scenes/trn.plan-approve.yaml`（scene_id `trn.plan-approve@1.0.0`，domain `TRN`）、`manifests/workflows/index.json`（domain=trn 共 6 条）、`manifests/workflows/trn.*.yaml`、`templates/skills-domain/trn/SKILL-*.md`、`templates/workspace/data/trn/*.csv`。
> 深度参照：`HR智能体工作台-Workbench设计文档.md` §3.2.21（培训四件套）、§3.3（TRAIN_STATUS）、§7.1（种子规模 培训计划/课程/记录 = 6/12/30+）；业务参照：`HR智能体工作台-PRD.md` §3.6 培训发展 F1–F9。
> **数据基线日 = 2026-09-29**（`certificates.csv` 的到期天数、`90天内到期` 状态枚举均以该日为基准；跨日重跑须重算 `days_left`，见 §10）。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| courses.csv | L2 | — | 18 | 课程库 + 培训计划台账（排期/名额/学时/预算/审批人）。scene 声明名 `courses.xlsx`（Excel 面板语义），落地为同名 CSV；`scripts/data-consistency-check.mjs` 按 basename 归一化匹配 |
| certificates.csv | L3 | cert_id | 14 | 岗位技能认证与证书台账（有效期/状态/换证费用/岗位依赖）。scene 声明名 `certificates.xlsx`；`cert_id` 以 `CERT-****-NNNN` 假名化存储，输出侧仍强制过 `redact_gate` |

口径与关系：

- **行数** = 数据行数（不含表头），两张表均 ≥10 行，满足数据字典规格与 `data-consistency-check` 的下限校验。
- **级别**：`courses.csv` L2（可外发口径，无 PII）；`certificates.csv` L3（含 PII 字段 `cert_id`，且 `holder_masked`/`approver`/`renew_date` 组合可反查个人，按 L3 管控）。
- **外键**：`certificates.course` → `courses.course`（逐字命中，见 §9 规则 R7）；`courses.prereq` → `courses.course`（自引用）。
- 本域落地数据根为 `templates/workspace/data/trn/`；GT 八元组中的 `data/trn/courses.xlsx` 指同一逻辑表的 scene 声明名。

### §1.1 字段级数据字典

**courses.csv**（15 列 = 原生 5 列 + 追加 10 列；原生列名与顺序不得删改）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| course | string | 是 | 课程名（业务主键；被 `certificates.course` 与 `prereq` 引用） |
| hours | number | 是 | 计划学时（整数，1–24） |
| enrolled | number | 是 | 已报名人数（校验 `enrolled ≤ seat_cap`） |
| next_session | string | 是 | 场次日期 `MM-DD`（数据基线年 2026；`已结束` 行填已结束场次日期） |
| category | enum | 是 | 课程分类：必修 / 进阶 / 领导力 / 合规 / 技能（对齐 PRD F2 的 入职/管理/业务/合规/技能 维度） |
| dept | string | 是 | 追加列·主办部门（`trn.hours-report` 的部门口径来源） |
| trainer | string | 是 | 追加列·讲师（脱敏工号 `T1***`–`T9***`，外部讲师 `EXT-***A`–`EXT-***D`） |
| room | string | 是 | 追加列·场地（教室号 / `线上直播` / `实训基地` / `外部场地`；与 trainer+日期共同做冲突检测） |
| seat_cap | number | 是 | 追加列·名额上限（报名确认的上限依据，见 §9 R4） |
| prereq | string | 是 | 追加列·前置课（课程名；无前置填 `无`） |
| pass_rate | number | 否 | 追加列·最近一期通过率 %（保留 1 位小数）；`已结束` 行必填，`进行中/报名中` 行留空 |
| completed_h | number | 是 | 追加列·已完成学时（`报名中`=0；`进行中` 0<completed_h<hours；`已结束`=hours） |
| status | enum | 是 | 追加列·计划/课程状态：报名中 / 进行中 / 已结束（= TRAIN_STATUS，见 §4.1） |
| budget_wan | number | 是 | 追加列·预算（万元）；外部采购课程 >0 即触发 `trn.plan-approve` 审批 |
| approver | string | 否 | 追加列·预算审批人（脱敏工号 `A1***`/`A2***`）；留空 = 未提审或审批在途 |

**certificates.csv**（12 列 = 原生 5 列 + 追加 7 列；原生列名与顺序不得删改）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| certificate | string | 是 | 证书/资质名（如 特种作业操作证、安全员B证） |
| holder_masked | string | 是 | 持证人（脱敏工号 `E1***`–`E12***`；禁存姓名/身份证） |
| issue_date | date | 是 | 首次发证日 `YYYY-MM-DD` |
| expire_date | date | 是 | 有效期至 `YYYY-MM-DD`（`已续期` 行 = 续期后新效期） |
| status | enum | 是 | 证书状态：有效 / 90天内到期 / 已过期 / 已续期（见 §4.2） |
| cert_id | string | 是 | 追加列·证书编号（假名化 `CERT-****-NNNN`，**PII**，`redact_gate` 强制脱敏后方可出产物） |
| holder_dept | string | 是 | 追加列·持证人部门（到期拦截按部门聚合的唯一口径） |
| course | string | 是 | 追加列·对应培训课程（`→ courses.course`，用于"先培训后发证/换证"闭环） |
| required_role | string | 是 | 追加列·岗位强依赖（如 特种作业岗/叉车司机岗；**排班拦截**的匹配键） |
| renew_fee | number | 否 | 追加列·换证/复审费用（元）；`已续期`=实际发生，`90天内到期`=预估，其余留空 |
| approver | string | 否 | 追加列·换证审批人（脱敏工号）；仅已提审/已续期行非空 |
| renew_date | date | 否 | 追加列·最近一次复审/换证生效日（`已续期` 行非空） |

---

## §2 技能规格

本域 3 个技能（与 scene `skills: [course-schedule, hour-stats, cert-expiry]` 一致；`templates/skills-domain/trn/` 各 SKILL.md 为字段级来源）：

| 技能 | 用途 | 触发词 | 输入 | 输出 | 权限 | 依赖能力 |
|---|---|---|---|---|---|---|
| course-schedule | 培训计划排期（讲师/场地/名额冲突检测、前置课校验） | `course schedule` | `data/trn/courses.csv`（+ `certificates.csv` 校验持证前置） | `reports/trn/` · `course-schedule-<ts>.json` · `enroll-approve-<ts>.json` · `plan-approve-<ts>.json` | L3（`min_level: L3`，越级即 DENY） | cap.excel.panel、cap.redact.all |
| hour-stats | 学时统计与达标分析（人/部门口径、通过率） | `hour stats` | `data/trn/courses.csv` | `reports/trn/` · `hours-report-<ts>.json` · `cert-renew-<ts>.json` | L3 | cap.excel.panel、cap.redact.all |
| cert-expiry | 证书资质到期监控（90 天窗口 + 过期拦截） | `cert expiry` | `data/trn/certificates.csv` | `reports/trn/` · `cert-expiry-<ts>.json` | L3 | cap.excel.panel、cap.redact.all |

共性执行约定（3 技能一致）：

1. 读取 `data/trn/` 输入（校验 Level ≤ L3，越级即 DENY）；
2. 经 Permission Gateway 授权后执行（`redact_gate: true`，产物中的 `cert_id`/人员字段先脱敏）；
3. 产出写入 `reports/trn/`，附证据来源 sheet/row（CSV 口径为 `文件:行号`）；
4. 自检 Expected vs Actual 逐项比对，失败进入 RETRY；**连续 3 次失败 → 登记 capability-gap 并停止当前任务**。

---

## §3 工作流（本域 6 条，`manifests/workflows/index.json` domain=trn）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| trn.plan-approve | **n3 审批节点（HITL，L4，dual=true）**；触发条件 n2："培训计划审批（预算/学时）触发对外/生效动作" | `plan-approve-<ts>.json`（json）；字段 `course / hours / budget_wan / approver`；验收："外部采购课程走审批" | kind=approve，主技能 course-schedule，落盘 `cap.excel.panel.write`，n5 审计记录"审批人 + 依据数据版本 + 产物哈希"，回滚 savepoint `pre-plan-approve` |
| trn.hours-report | 无审批节点（n1→n2→n3 直出） | `hours-report-<ts>.json`（json）；字段 `dept / planned_h / completed_h / rate`；验收："学时数字可追溯 courses.csv" | kind=report，主技能 hour-stats，n3 审计"数据版本 + 产物哈希"，回滚 savepoint `pre-hours-report` |
| trn.course-schedule | 无审批节点（n1→n2→n3 直出） | `course-schedule-<ts>.json`（json）；字段 `course / date / trainer / room`；验收："冲突自动标红并建议备选" | kind=calc，主技能 course-schedule，n3 审计"输入参数 + 结果快照"，回滚 savepoint `pre-course-schedule` |
| trn.cert-expiry | 无审批节点（只读计算 + 出清单） | `cert-expiry-<ts>.json`（json）；字段 `certificate / holder_masked / expire_date / days_left`；验收："90 天内到期必须列出；过期立即拦截" | kind=report，主技能 cert-expiry，n3 审计"数据版本 + 产物哈希"，回滚 savepoint `pre-cert-expiry` |
| trn.cert-renew | **n3 审批节点（HITL，L4，dual=true）**；触发条件 n2："证书复审/换证审批 触发对外/生效动作" | `cert-renew-<ts>.json`（json）；字段 `certificate / holder_masked / renew_fee / approver`；验收："岗位强依赖证书过期未续 = 上岗拦截" | kind=approve，主技能 hour-stats，n4 回写 `cap.excel.panel.write`，n5 审计"审批人 + 依据数据版本 + 产物哈希"，回滚 savepoint `pre-cert-renew` |
| trn.enroll-approve | 无审批节点（前置校验失败即拒绝，不进入审批） | `enroll-approve-<ts>.json`（json）；字段 `course / employee_masked / prereq_ok / seats_left`；验收："前置课未修直接拒绝" | kind=calc，主技能 course-schedule，n3 审计"输入参数 + 结果快照"，回滚 savepoint `pre-enroll-approve` |

差异说明（不改 manifest，仅登记事实，供 CR 追溯）：

- scene `workflows:` 只列了两个文件 `workflows/trn.plan-approve.yaml`、`workflows/trn.expiry-block.yaml`；而 `index.json` 登记 6 条（上表全部 6 条）。
- `manifests/workflows/trn.expiry-block.yaml`（`workflow_id: trn.expiry-block@1.0.0`，触发词 `expiry-block`，节点 skill(cert-expiry)→condition"资质过期人员不得排班上岗"→approval(L3, dual=false)→tool write→audit，回滚 savepoint `pre-expiry-block`）**文件存在但未登记进 index.json**；其语义已由 §6 的"证书到期→排班拦截"承接。
- 域级 `policies.permission.dual_approval=false`（scene）与上表两条工作流节点级 `dual=true` 并存：**域默认单审批，识别到"对外/生效动作"（预算支出、证书换发生效）时由节点级升为双审批**（见 §5）。

---

## §4 状态机

### 4.1 培训计划/课程状态（TRAIN_STATUS，参照 §3.3）

| 状态 | 枚举值 | 进入条件 | 允许迁移 | 本域样例行 |
|---|---|---|---|---|
| 报名中 | `signup` | 计划已建、场次未开（`next_session` 晚于数据基线日），`completed_h=0`，`pass_rate` 空 | → 进行中（到达开课日）；→ 已结束（取消并归档，须留审计） | 新员工入职、合规与信息安全、销售进阶谈判、管理者 First 30 天、数据安全与隐私保护、项目管理实战、客户服务与投诉处理（7 行） |
| 进行中 | `ongoing` | 已到开课日，`0 < completed_h < hours` | → 已结束（结课 + 成绩录入，`completed_h=hours` 且 `pass_rate` 非空） | 特种作业安全操作、焊接与热切割作业、危化品安全管理、安全员 B 证考前培训、安全员 C 证考前培训（5 行） |
| 已结束 | `done` | 结课，`completed_h = hours` 且 `pass_rate` 已录 | 终态；如需复盘另起新计划行（不复用行） | 电动叉车安全操作、高处作业安全操作、一级建造师继续教育、注册安全工程师继续教育、注册会计师继续教育、消防安全与应急处置（6 行） |

迁移触发器与证据字段：`next_session`（开课判定）→ `completed_h`（进度判定）→ `pass_rate`（结课判定）；每次迁移须落 `audit`（工作流 n3 节点），并保留"依据数据版本 + 产物哈希"。

### 4.2 证书状态（certificates.status）

判定式（以数据基线日 `T0 = 2026-09-29` 计算 `days_left = expire_date − T0`）：

| 状态 | 判定式 | 迁移 | 本域样例行（days_left） |
|---|---|---|---|
| 有效 | `days_left > 90` | → 90天内到期（随日历推进自动降级，无需人工动作） | 注册会计师(244)、一级建造师(537)、注册安全工程师(923)、低压电工作业证(586)、起重机械指挥证(134)、消防设施操作员证(1086)、一级注册消防工程师(774) |
| 90天内到期 | `0 < days_left ≤ 90` | → 已过期（到期未换证）；→ 已续期（`trn.cert-renew` 审批通过并顺延 `expire_date`） | 特种作业操作证(15)、安全员B证(62)、危化品安全作业证(82) |
| 已过期 | `days_left ≤ 0` 且未换证 | **不可自动复位**；须走 `trn.cert-renew` 双审批后才可置 `已续期`；期间 `trn.expiry-block` 持续输出上岗拦截 | 电动叉车司机证(−29)、焊接与热切割作业证(−102)、安全员C证(−728) |
| 已续期 | `renew_date` 非空 且 `expire_date` 为顺延后新效期（新 `days_left > 90`） | 终态（下一周期从"有效"重新计时） | 高处作业操作证（`renew_date=2026-09-10`，新效期 2029-09-13，days_left=1080） |

门槛口径：提醒窗口 **90 天**（本域强约束，严于合同/证照类参照的 60 天窗口）；到期当日仍可上岗，次日零时起视为已过期。

---

## §5 审批链

| 流程 | 节点 | 角色 | 双审批 | HITL | 回滚点 |
|---|---|---|---|---|---|
| trn.plan-approve | n1 技能（course-schedule）→ n2 条件（触发对外/生效动作）→ **n3 审批 L4** → n4 写盘 → n5 审计 | n3：HRD / 培训负责人；预算超阈值（建议 ≥10 万元，本域样例行 `项目管理实战 12.8 万`）加签财务负责人 | **是**（n3.dual=true；域默认 false，由节点级升级） | 是（`hitl_nodes: [n3]`） | savepoint `pre-plan-approve` |
| trn.cert-renew | n1 技能（hour-stats）→ n2 条件（触发对外/生效动作）→ **n3 审批 L4** → n4 写盘 → n5 审计 | n3：安全负责人 + HRD（特种作业/执业证换发属"对外生效"） | **是**（n3.dual=true） | 是（`hitl_nodes: [n3]`） | savepoint `pre-cert-renew` |
| trn.expiry-block（文件在册，未登记 index） | n1 技能（cert-expiry）→ n2 条件（资质过期人员不得排班上岗）→ n3 审批 L3 → n4 写盘 → n5 审计 | n3：HR 培训专员（拦截清单确认） | 否（n3.dual=false） | 是（`hitl_nodes: [n3]`） | savepoint `pre-expiry-block` |
| trn.hours-report / trn.course-schedule / trn.enroll-approve | 仅 n1 技能 →（写盘）→ 审计 | 无审批角色 | 否 | 否（`hitl_nodes: []`） | 各自 savepoint |

规则：

- **条件节点 n2 的 then 分支禁止绕过审批直连外部写能力**（YAML 内联注释的硬约束）；`plan-approve`/`cert-renew` 的 n4 写盘必须在 n3 审批通过之后。
- 双审批判定：域级 `dual_approval=false`；**涉及预算支出、证书换发生效、对外提交**时按节点级 `dual=true` 执行，两人复核缺一即挂起（不落盘、不推进）。
- 审批失败/驳回：按 `rollback.method=savepoint` 回滚到对应 tag，产物不落 `reports/trn/`，仅留审计事件。

---

## §6 跨域联动

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 培训完成（courses.status=已结束 且 `pass_rate ≥ 80`） | → **prf 能力项/技能标签更新**：以 `certificates.course` 对应的技能认证结果刷新绩效档案中的能力项（培训达标即获得对应技能标记） | `courses.course`、`courses.pass_rate`、`courses.completed_h`、`certificates.certificate` |
| 证书进入 90 天窗口或已过期 | → **排班/上岗拦截**：按 `required_role` 输出拦截名单（`trn.cert-expiry` / `trn.expiry-block`），过期立即拦截、90 天内预警并催办换证；本仓无独立排班域，拦截清单由下游排班/调度侧消费（scene 特殊约束：特种作业证/执业证到期拦截，Overlay 预留） | `certificates.holder_masked`、`required_role`、`expire_date`、`days_left`、`status`、`course` |
| 新人入职（rec 域 offer→已入职 / 员工状态 active） | → **新人培训自动建档**：在 `courses.course=新员工入职` 的当期计划下建报名记录，占用名额（`enrolled +1 ≤ seat_cap`），到期未参训计入学时达标率分母 | `courses.course`、`courses.next_session`、`courses.enrolled`、`courses.seat_cap`、`courses.status=报名中` |
| 证书换证审批通过（trn.cert-renew n3 双审批通过） | → 证书台账顺延 `expire_date`、置 `已续期`、写 `renew_date`/`renew_fee`/`approver`；同时解除该 `required_role` 的排班拦截 | `renew_date`、`expire_date`、`status=已续期`、`renew_fee`、`approver` |
| 外部采购课程立项（budget_wan>0 且讲师为 `EXT-***`） | → 触发 `trn.plan-approve` 双审批；审批通过前不得写入计划生效列 | `courses.budget_wan`、`courses.approver`、`courses.trainer` |
| 学时达标率（hours-report `rate`）低于阈值 | → 输出部门级复盘清单（`reports/trn/`），供 prf 校准会与预算复盘引用 | `courses.dept`、`courses.completed_h`、`courses.hours` |

对端域未落地的字段（如 prf 侧"能力项"字段、排班侧"拦截位"）一律以**清单/证据字段**形式交付，不直写对端数据表。

---

## §7 权限矩阵

| 项 | 取值 | 来源 |
|---|---|---|
| 最低数据级别 | **L3**（读 `certificates.csv` 需 ≥L3；`courses.csv` 为 L2 但仍受域级 min_level 约束） | scene `policies.permission.min_level: L3` |
| 双审批 | 域级 `false`；节点级 `true`（plan-approve n3、cert-renew n3，见 §5） | scene `dual_approval: false` + 两份 workflow YAML `n3.dual: true` |
| 脱敏字段 | `cert_id`（scene 声明级）；实际脱敏的人员标识：台账列 `holder_masked` / `trainer` / `approver` + 工作流产物字段 `employee_masked`（trn.enroll-approve） | scene `redact.fields: [cert_id]`、`redact.gate: redact_gate` |
| 脱敏闸门 | `redact_gate`：产物出域前强制过闸；未脱敏产物不得写入 `reports/trn/` | scene `redact.gate` |
| 记忆层 | `pii_allowed: false`；`exclude: []`（本域无额外排除项，但证书明细/持证人标识**禁入长期记忆**） | scene `policies.memory` |
| 所需能力 | `cap.excel.panel`、`cap.approval.single`、`cap.redact.all`（两条 dual 工作流另需 `cap.approval.multi` 承载双审批） | scene `required_capabilities` + workflow `dual: true` |
| 技能级 | 3 技能均 `min_level: L3`、`redact_gate: true`，越级访问即 DENY | `templates/skills-domain/trn/SKILL-*.md` |

角色落地建议（scene 未逐角色声明，供定制化时细化）：HR 培训专员（本域主责，L3 读写）；员工（仅本人证书/学时，`holder_masked` 视角，只读）；部门负责人（本部门 `dept` 口径只读）；admin（全量 + 审计查询）。任何角色均不得把 `cert_id` 原值或持证人标识带出工作区。

---

## §8 Golden Tasks

八元组见 scene YAML；下表为同源摘要（`expected_files` 在 scene 中写作 `data/trn/courses.xlsx` / `certificates.xlsx`，落地为同名 CSV）。

| GT | 输入 | 期望工具 | 权限 | 产物 | 数据文件 | 审计 | 质量 |
|---|---|---|---|---|---|---|---|
| GT-TRN-01 | 生成下月培训计划并走审批 | cap.excel.panel、cap.approval.single | L3 | `reports/trn/gt-01.md` | courses.csv、certificates.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据 |
| GT-TRN-02 | 统计上半年学时达标率 | cap.excel.panel、cap.approval.single | L3 | `reports/trn/gt-02.md` | courses.csv、certificates.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据 |
| GT-TRN-03 | 输出 90 天内到期证书清单与拦截建议 | cap.excel.panel、cap.approval.single | L3 | `reports/trn/gt-03.md` | courses.csv、certificates.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据 |

任务分解（即 scene `expected_plan` 指向的本节）：

- **GT-TRN-01**：① 读 `courses.csv` 取当期 `status=报名中` 行（7 行）与 `next_session` 所在月份 → ② 用 `seat_cap − enrolled` 算余量、用 `prereq` 校验前置课、用 `trainer+room+next_session` 做三键冲突检测（预置命中：`焊接与热切割作业` 与 `危化品安全管理` 同为 T5***/实训基地/10-06）→ ③ 汇总 `budget_wan`（外部采购课程：销售进阶谈判 6.5、管理者 First 30 天 8.0、项目管理实战 12.8，合计 27.3 万）→ ④ 走 `trn.plan-approve`（n3 双审批）→ ⑤ 出 `plan-approve-<ts>.json` + `reports/trn/gt-01.md`，附行号证据。
- **GT-TRN-02**：① 读 `courses.csv` 全量 → ② 按 `dept` 聚合 `planned_h=Σhours`、`completed_h=Σcompleted_h`、`rate=completed_h/planned_h`（`已结束` 行 `completed_h=hours`，`报名中/进行中` 计入分母不计入分子，口径须在报告中显式声明）→ ③ 标出 `pass_rate < 80` 的课程（`注册会计师继续教育 78.5`）→ ④ 出 `hours-report-<ts>.json` + `reports/trn/gt-02.md`，数字逐项可回溯到 courses.csv 行号。
- **GT-TRN-03**：① 以数据基线日 2026-09-29 读 `certificates.csv` 算 `days_left = expire_date − 2026-09-29` → ② 筛 `0 < days_left ≤ 90`（特种作业操作证 15 天、安全员B证 62 天、危化品安全作业证 82 天）与 `days_left ≤ 0`（电动叉车司机证 −29、焊接与热切割作业证 −102、安全员C证 −728）→ ③ 按 `required_role`/`holder_dept` 出拦截清单与换证建议（含 `renew_fee` 预估值）→ ④ 出 `cert-expiry-<ts>.json` + `reports/trn/gt-03.md`；产物中 `cert_id` 必须已过 `redact_gate`。

---

## §9 校验规则

| 编号 | 规则 | 阈值/口径 | 违反处理 |
|---|---|---|---|
| R1 | 学时下限/达标 | 单课程 `hours ≥ 1`；部门达标率 `rate = Σcompleted_h / Σhours ≥ 80%` | 未达阈值 → 报告标注"不达标"并出复盘清单，不自动改数 |
| R2 | 通过率 | `pass_rate ≥ 80` 为该课程达标；`< 80` 需复盘（本域实例：注册会计师继续教育 78.5） | 低于阈值课程不得计入"技能达标"、不得触发 §6 的 prf 能力项更新 |
| R3 | 证书提醒窗口 | `0 < days_left ≤ 90` 必须出现在到期清单；`days_left ≤ 0` 立即进入上岗拦截 | 漏列/漏拦截 = 任务失败（验收："90 天内到期必须列出；过期立即拦截"） |
| R4 | 报名名额上限 | `enrolled ≤ seat_cap`；报名确认 `seats_left = seat_cap − enrolled ≥ 0`，不足即拒绝 | 超出上限的报名必须拒绝并回写原因，不得静默截断 |
| R5 | 前置课 | `prereq ≠ 无` 时须命中 `courses.course`，未修直接拒绝（验收："前置课未修直接拒绝"） | `enroll-approve` 输出 `prereq_ok=false` 并拒绝 |
| R6 | 课程状态与报名一致性 | `报名中` ⇒ `completed_h=0` 且 `pass_rate` 空；`进行中` ⇒ `0<completed_h<hours` 且 `pass_rate` 空；`已结束` ⇒ `completed_h=hours` 且 `pass_rate` 非空 | 不一致行标红并阻断出报告 |
| R7 | 引用完整性 | `certificates.course`、`courses.prereq` 必须逐字命中 `courses.course`；证书表 14 行全部命中 | 未命中即数据缺陷，阻断聚合 |
| R8 | 字段格式 | 日期 `YYYY-MM-DD`（`next_session` 为 `MM-DD`）；枚举取值仅限 §4 所列；人员字段一律 `E*`/`T*`/`A*`/`EXT-***` 脱敏格式 | 格式违规行不进聚合口径，单独列入缺陷清单 |
| R9 | 状态-日期自洽 | `有效` ⇒ `days_left > 90`；`90天内到期` ⇒ `0 < days_left ≤ 90`；`已过期` ⇒ `days_left ≤ 0`；`已续期` ⇒ `renew_date` 非空且新效期 `days_left > 90` | 不自洽行阻断 §§9 全部聚合结论 |
| R10 | 预算/审批一致性 | `trainer` 为 `EXT-***` 的行必须提审；`approver` 为空表示审批在途，不得出现在"已生效计划"结论中 | 未提审即出计划的结论无效 |
| R11 | 排期冲突 | 同 `trainer` 或同 `room` 在同一 `next_session` 重叠即为冲突，须标红并给备选（验收："冲突自动标红并建议备选"） | 冲突未标注即任务失败 |
| R12 | 脱敏出域 | 任何写入 `reports/trn/` 的产物不得含 `cert_id` 原值、姓名、身份证、联系方式 | 直接拦截，产物不落盘并记审计 |

---

## §10 特殊约束

1. **行业化预留（唯一允许扩展的维度）**：特种作业证/执业证到期拦截走 Overlay；`industry_overlay: null`（首批 0 个，后续 P1-4 只扩 1 个行业试点）。扩展时只增字段/枚举，不得删除本域既有字段与状态。
2. **拦截不可自动放行**：证书过期人员的上岗限制只能由 `trn.cert-renew` 双审批（换证生效）解除；禁止以"例外说明""临时授权"绕过，禁止任何自动化放行路径（对应 §5 的审批节点硬约束）。
3. **数据基线日**：全部到期天数以 2026-09-29 为基准。跨日重跑 `cert-expiry`/`enroll-approve` 必须以运行日重算 `days_left`，并同步刷新 `certificates.csv` 的 `status`（§4.2 迁移），不得沿用陈旧快照。
4. **记忆层**：`pii_allowed=false`；证书明细、持证人标识、审批意见禁入长期记忆（`exclude` 为空表示本域无额外命名空间排除，但禁入规则对 PII 一律生效）。
5. **数据为合成样例**：全部为合成脱敏数据，人员标识仅保留 `E*`/`T*`/`A*`/`EXT-***` 形态；不得据本文件推断任何真实个人。
6. **落地文件形态**：scene 声明 `*.xlsx`（Excel 面板语义），实际落地为 UTF-8 无 BOM、LF、逗号分隔、英文小写下划线表头的 CSV；表头列名与顺序不得删改，只允许在尾部追加列（追加列必须回写 §1.1）。
7. **产物只落 `reports/trn/`**：本域技能不写业务库、不直改其它域数据表；跨域效果以清单/证据字段交付（§6）。
8. **预置冲突样例**：`courses.csv` 中 `焊接与热切割作业` 与 `危化品安全管理`（同为 T5***/实训基地/10-06）为**故意保留**的冲突样例，用于验证 R11 与 §3 的"冲突标红"验收，不得"顺手修掉"。
