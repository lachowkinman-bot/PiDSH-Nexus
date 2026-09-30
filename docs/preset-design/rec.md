# Preset 设计文档 · 招聘管理（rec）

> 015 §9.2 自制层基线。Agent 定制化时只许细化、不许删域（§8.3）。
> 事实源：`manifests/scenes/rec.funnel-weekly.yaml`（scene 唯一权威源）＋ `manifests/workflows/index.json`（本域 6 条）＋ `templates/skills-domain/rec/SKILL-*.md`；数据快照 `templates/workspace/data/rec/`（时点 2026-10-12，ISO 2026-W41 末）。

## 1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| candidates.csv | L3 | candidate_phone, candidate_idcard | 14 | 候选人主表。scene 数据资产声明名为 candidates.xlsx，落地为同表同字段的 UTF-8 CSV（校验器按同名归一化匹配） |
| interviews.csv | L3 | — | 21 | 面试主表。scene 数据资产声明名为 interviews.xlsx，落地 CSV；仅以 cand_id 关联候选人，不含 PII 列 |
| funnel.csv | L3 | — | 15 | 漏斗周报派生汇总表（3 周 × 5 阶段，2026-W38/W39/W40）。非 scene 数据资产，供 GT-REC-01 使用；级别保守继承源表 L3 |

> 口径：candidates/interviews 与 Type-Dict（`templates/Type-Dict/type-dict.csv`）逐行一致（rec, candidates, table, L3, candidate_phone;candidate_idcard / rec, interviews, table, L3, none）。全表为合成数据，非真实个人信息；PII 列在落地前已按 redact_gate 掩码。

### 1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/datetime/enum/ref；空值统一写 `-`。

#### 1.1.1 candidates.csv（14 行）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| candidate_masked | string | 是 | 姓名掩码（姓 + `**`），唯一展示标识；原始姓名不入库 |
| position | string | 是 | 应聘岗位名（对齐职位表 title；本域职位表未落地，暂按岗位名引用） |
| stage | enum | 是 | 候选人阶段，枚举见 §4.1，落地存英文枚举值（screening/first/second/final/offer/hired/rejected/talent） |
| interview_at | datetime | 否 | 下一场（或最近一场关键）面试时间，格式 `YYYY-MM-DD HH:mm`；无则 `-` |
| source | enum | 否 | 来源渠道：猎头/内推/官网/招聘网站/BOSS直聘/猎聘/校招（对齐 PRD B8 渠道口径） |
| candidate_id | string | 是 | 候选人 ID（`C` + 3 位），唯一主键；interviews.cand_id 的外键指向本列 |
| candidate_phone | string | 否 | 手机号（PII）。落地值为脱敏形态 `138****5678`（前 3 后 4，中间 4 星）；完整值不得出域 |
| candidate_idcard | string | 否 | 身份证号（PII）。落地值为脱敏形态 `4403**********1234`（前 4 后 4，中间 10 星）；完整值不得出域 |
| education | enum | 否 | 大专/本科/硕士/博士 |
| exp_years | number | 否 | 工作年限（0-40，整数） |
| score | number | 否 | 已完成轮次的最新面试评分（0-100）；无已评轮次为 `-` |
| offer_salary | number | 否 | 定薪（元/月），须落在 comp.bands 区间内；未发放为 `-` |
| offer_status | enum | 否 | `-` / sent 已发送 / accepted 已接受 / declined 已放弃 |
| onboard_status | enum | 否 | `-` / pending 待入职 / done 已入职 |
| summary | enum | 否 | 面试摘要徽标：good/medium/bad（看板卡片字段） |
| note | string | 否 | 运营注记（淘汰原因、冲突提示、联动待办等） |

#### 1.1.2 interviews.csv（21 行）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| interview_id | string | 是 | 面试记录 ID（`IV` + 3 位），唯一主键 |
| cand_id | ref | 是 | → candidates.candidate_id 外键；禁止孤儿行（见 §9） |
| round | enum | 是 | first 初试 / second 复试 / final 终面 |
| interviewer | string | 是 | 面试官掩码名（姓 + `**`）。本表 PII 字段声明为空，故不得落面试官全名 |
| interviewer_role | string | 是 | 面试官角色：销售总监/HRD/技术负责人/前端组长/数据负责人/招聘负责人/财务经理 |
| interview_at | datetime | 是 | 面试时间，格式 `YYYY-MM-DD HH:mm` |
| mode | enum | 是 | 现场/视频/电话 |
| score | number | 否 | 评分 0-100；result=pending 时为 `-` |
| result | enum | 是 | 面试结果，枚举见 §4.2：pending 待定 / pass 通过 / fail 未通过 |
| comment | string | 否 | 评语与结论（脱敏后写入，不含候选人 PII） |

#### 1.1.3 funnel.csv（15 行，派生汇总）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| stage | string | 是 | 漏斗阶段（展示口径）：简历投递/初筛通过/面试通过/offer发放/入职 |
| count | number | 是 | 该周该阶段人数 |
| conversion_pct | number | 是 | 以当周「简历投递」为基期 100 的累计转化率（占比口径，非段间转化），引用时须区分 |
| week | string | 是 | ISO 周（2026-W38/W39/W40）。追加列：原有 3 列列名保持不变 |

## 2 技能规格

| 技能 | 用途 | 输入 | 输出 | 权限 | 质量检查 |
|---|---|---|---|---|---|
| funnel-analysis | 招聘漏斗转化分析（各阶段人数/转化率/瓶颈定位，对齐 PRD B7） | data/rec/candidates.csv、data/rec/funnel.csv | reports/rec/*（漏斗周报正文 + funnel-weekly JSON） | min_level=L3；redact_gate=true；依赖 cap.excel.panel + cap.redact.all | 结论可溯源到 sheet/row 级证据；Expected vs Actual 逐项比对，失败 RETRY；连续 3 次失败→登记 capability-gap 并停止 |
| jd-gen | JD 生成与合规检查（岗位/要求/薪酬带，对齐 PRD B2） | data/rec/candidates.csv、data/rec/interviews.csv、comp/bands.csv（薪酬带引用） | reports/rec/*（JD 草稿、外发件） | min_level=L3；redact_gate=true；cap.excel.panel + cap.redact.all | 薪酬带必须引用 comp.bands 区间口径；合规检查项留痕；外发前强制 redact_gate 命中 |
| interview-summary | 面试纪要结构化（脱敏）（对齐 PRD B4） | data/rec/interviews.csv、data/rec/candidates.csv | reports/rec/*（面试安排、纪要、入职清单） | min_level=L3；redact_gate=true；cap.excel.panel + cap.redact.all | 输出 PII 仅掩码；面试官同时段冲突须标红；结论附证据行号 |

> 三技能的 `min_level: L3`、`redact_gate: true` 取自 `templates/skills-domain/rec/SKILL-*.md`；越级读取即 DENY。技能本身 L3，但对外/生效动作由工作流审批节点升到 L4（见 §5）。

## 3 工作流（本域全部 6 条）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| rec.funnel-weekly@1.0.0 | 无 approval 节点（免审批，仅 audit n3） | `funnel-weekly-<ts>.json`；fields: stage, count, conversion_pct, week；验收：候选人 PII 仅掩码 | kind=report；skill=funnel-analysis；trigger=command `funnel-weekly`；rollback savepoint `pre-funnel-weekly` |
| rec.resume-forward@1.0.0 | n3 approval **L4 / dual=true**（简历外发触发对外动作） | `resume-forward-<ts>.json`；fields: candidate_masked, target, redact_fields, approver；验收：未脱敏外发 = 一票否决 | kind=approve；skill=jd-gen；n2 condition 分支不得绕过审批；audit n5 记录审批人+依据数据版本+产物哈希 |
| rec.jd-draft@1.0.0 | 无 approval 节点（免审批） | `jd-draft-<ts>.json`；fields: position, requirements, band, locale；验收：薪酬带引用 comp.bands 区间口径 | kind=calc；skill=jd-gen；rollback `pre-jd-draft` |
| rec.interview-schedule@1.0.0 | 无 approval 节点（免审批） | `interview-schedule-<ts>.json`；fields: candidate_masked, slot, interviewers, mode；验收：同一面试官同时段冲突须标红 | kind=calc；skill=interview-summary；rollback `pre-interview-schedule` |
| rec.offer-approve@1.0.0 | n3 approval **L4 / dual=true**（offer 触发生效动作） | `offer-approve-<ts>.json`；fields: candidate_masked, position, offer_band, approvals；验收：offer 超出 P75 必须双审批 | kind=approve；skill=funnel-analysis；audit n5 记录审批人+依据数据版本+产物哈希 |
| rec.onboarding-check@1.0.0 | 无 approval 节点（免审批） | `onboarding-check-<ts>.json`；fields: item, owner, due, status；验收：入职日前 3 天必须全绿 | kind=report；skill=interview-summary；rollback `pre-onboarding-check` |

> 命名对照：scene.workflows 只钉 2 条基线（rec.resume-forward、漏斗周报 rec.funnel-report），其余 4 条取自 `manifests/workflows/index.json`（本域共 6 条）。漏斗周报落地文件名为 `rec.funnel-weekly.yaml`，与 scene 中的 `rec.funnel-report.yaml` 指同一能力，以落地文件名为准。

## 4 状态机

### 4.1 candidates 阶段（CAND_STAGE）

| 枚举值 | 展示 | 含义 |
|---|---|---|
| screening | 简历筛选 | 已投递/入库，待初筛 |
| first | 初试 | 一面已安排或进行中 |
| second | 复试 | 一面通过，二面已安排 |
| final | 终面 | 复试通过，终面已安排 |
| offer | 已发 Offer | 终面通过并生成/发出 Offer |
| hired | 已入职 | Offer 接受且入职完成 |
| rejected | 已淘汰 | 任一轮未通过或主动淘汰（终态） |
| talent | 人才储备 | 岗位暂缓/储备池（暂存态，可重新激活） |

| 迁移 | 触发条件 | 证据/门槛 |
|---|---|---|
| screening → first | 初筛通过（学历/年限/渠道核验） | candidates.stage 变更留痕；进入面试安排 |
| first → second | 该轮 interviews.result=pass | interviews.round=first 的 pass 记录 |
| second → final | 该轮 interviews.result=pass | interviews.round=second 的 pass 记录 |
| final → offer | 该轮 interviews.result=pass 且完成定薪 | 生成 Offer 提示（不自动外发）；offer_salary 落入 comp.bands 区间 |
| offer → hired | offer_status=accepted 且 onboard_status=done | 入职流程完成回写 |
| 任意 → rejected | 任一轮 result=fail，或淘汰决策 | note 必填淘汰原因（终态） |
| 任意 → talent | 岗位暂缓/储备决策 | 保留 score/source，可重新激活 |

```
screening → first → second → final → offer → hired
     ↘         ↘        ↘       ↘
              rejected / talent（分支终态，可留痕回主链）
```

**禁止**：越级推进（如 screening→final）、无 pass 记录前进、rejected/talent 后原地回主链（须重开候选人记录并留痕）。

### 4.2 interviews 结果（INTERVIEW_RESULT）

| 枚举值 | 展示 | 迁移条件 |
|---|---|---|
| pending | 待定 | 初始态；不得用于推进候选人阶段 |
| pass | 通过 | 由 pending 迁移；评分与评委结论一致（评分建议 ≥75） |
| fail | 未通过 | 由 pending 迁移；须写 comment 结论 |

**禁止**：pass↔fail 原地改写（须重开面试记录并留痕）；pending 记分（pending 时 score 必须为 `-`）。样例数据含 1 处面试官同时段冲突（IV008 与 IV019 同为孙**、2026-10-06 11:00，均 pending），为 `rec.interview-schedule` 冲突检测规则的命中样例，预期标红后重排。

## 5 审批链

| 工作流 | 审批节点 | 最低级别 | 审批角色（建议映射） | 双审批 | 驳回/回滚 |
|---|---|---|---|---|---|
| rec.resume-forward | n3 | L4 | 招聘负责人 → HRD（外发对象为外部面试官/客户时，两级均须签字） | 是（dual=true） | 驳回→流程 rejected，落回草稿；rollback savepoint `pre-resume-forward` |
| rec.offer-approve | n3 | L4 | 用人部门负责人 → HRD；offer 超出 P75 时加签 CEO/CFO | 是（dual=true） | 驳回→流程 rejected，Offer 不发送；rollback `pre-offer-approve` |

- 钉死事实：两节点的 `level: L4`、`dual: true` 取自工作流 YAML；角色映射为落地建议（scene/工作流未钉角色，按 ROLES/caps 配置）。
- 其余 4 条工作流无 approval 节点，仅 audit 留痕；任何对外/生效动作必须经上述两条链，condition 节点不得绕过审批直连写能力。
- 未脱敏外发 = 一票否决；审批意见（通过/驳回原因）写入 audit n5。

## 6 跨域联动（完成后副作用）

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| offer_status=accepted / stage→hired | ①trn 培训建档：新人入职培训记录与课程报名（对齐 trn.courses「新员工入职」）；②员工档案（org 域，未落地） | candidate_id, candidate_masked, position, offer_status, onboard_status |
| onboard_status=done（入职完成） | admin 资产/工牌/门禁/办公用品派发，按入职清单逐项核对 | onboarding-check 交付物字段：item, owner, due, status |
| offer 定薪（rec.offer-approve 通过） | comp 薪酬带核对/定薪单：offer_salary 必须落在 comp.bands [p25, p75] | offer_salary, offer_band, position |
| rec.resume-forward 完成 | cmp 个人信息外发留痕（PIPIA/审计证据包，append-only） | approver, target, redact_fields, candidate_masked |
| 入职合同签订 | ER 域劳动合同（当前未落地，登记为 gap，不阻塞主链） | onboard_status, candidate_id |

> 联动统一在 after_complete 钩子实现，不在页面散落业务逻辑；副作用写失败回滚至对应 savepoint。

## 7 权限矩阵

**scene policies（钉死）**

| 项 | 值 |
|---|---|
| 最低数据级别 | L3（min_level=L3，只能 ≥ Chassis 默认） |
| 双审批 | false（基线免双审批；对外/生效动作在节点级升级，见 §5） |
| 脱敏字段（redact_gate） | candidate_phone, candidate_idcard；命中写 redact 日志 |
| 记忆层 | pii_allowed=false；exclude=[]（无 EAP 类排除项） |

**角色 × 操作**

| 角色 | 查看 | 创建/编辑 | 审批 | 数据边界 |
|---|---|---|---|---|
| admin | 全量 | V/C/E/D | 可（含流程推进/驳回） | 全部实体全部行 |
| hr | 全量 | V/C/E/D | 可（含流程推进/驳回） | 全部业务行；列表脱敏展示 |
| employee | 无招聘菜单 | — | — | 仅本人相关（本域无自助入口） |
| candidate | 仅本人 Offer | — | 仅 Offer 接受/拒绝 | 仅本人 Offer 记录 |

- 列表/报告始终掩码；完整值仅审批弹窗按权限展示（见 §8.2 口径，落地以 workbench-ui-plugin 为准）。
- 无 approve 权限不渲染审批按钮；越级读取（<L3）直接 DENY。

## 8 Golden Tasks（八元组见 Scene YAML）

| ID | 任务 | 交付物 | 工具/权限 | 质量判据 |
|---|---|---|---|---|
| GT-REC-01 | 生成本周招聘漏斗周报（含瓶颈环节） | reports/rec/gt-01.md（附 funnel-weekly JSON） | cap.excel.panel, cap.approval.single；L3 | 结论可溯源到 sheet/row 级证据 |
| GT-REC-02 | 按岗位需求生成 JD 并做合规检查 | reports/rec/gt-02.md（附 jd-draft JSON） | cap.excel.panel, cap.approval.single；L3 | 结论可溯源到 sheet/row 级证据；JD 薪酬带引用 comp.bands |
| GT-REC-03 | 把候选人简历脱敏后转发面试官（走审批） | reports/rec/gt-03.md（附 resume-forward JSON） | cap.excel.panel, cap.approval.single；L3（触达 L4 双审批） | 未脱敏外发 = 一票否决；结论可溯源 |

> 预期读取文件：data/rec/candidates.xlsx、data/rec/interviews.xlsx（落地为同名 CSV）；审计：读/算/写三段事件 + 审批记录。

## 9 校验规则

| 类别 | 规则 | 口径/示例 |
|---|---|---|
| 必填 | candidates: candidate_masked/position/stage/source/candidate_id；interviews: interview_id/cand_id/round/interviewer/interviewer_role/interview_at/mode/result | 缺失即拒写，提示「请填写必填项」 |
| 唯一 | candidate_id、interview_id 唯一；candidate_phone/candidate_idcard 在源系统唯一（掩码后不可用于唯一性判定） | 重复即拒写并提示「已存在」 |
| 格式 | 手机 `/^1[3-9]\d{9}$/`（掩码前校验）；身份证 18 位 `/^\d{17}[\dXx]$/` + 校验位；日期 `YYYY-MM-DD HH:mm`；枚举值白名单 | 落地掩码：手机 `138****5678`（前 3 后 4）、身份证 `4403**********1234`（前 4 后 4） |
| 引用完整性 | interviews.cand_id → candidates.candidate_id 必须命中；禁止孤儿行 | 外键校验失败即拒写 |
| 数值 | score/评分 0-100；exp_years 0-40；offer_salary > 0 且 ∈ comp.bands [p25, p75] | 超出 P75 → 强制双审批 |
| 阶段业务规则 | 阶段不可越级；无对应 round 的 pass 记录不得前进；rejected/talent 为分支终态 | 见 §4.1 迁移表 |
| 面试业务规则 | result=pending 时 score 必须为 `-`；同一面试官同时段冲突须标红；pass/fail 不可原地改写 | 样例冲突 IV008/IV019 |
| 审批业务规则 | 未脱敏外发 = 一票否决；offer 超 P75 必须双审批；驳回原因必填 | 见 §5 |
| 编制/余额类规则 | 本域无年假余额规则；对应「余额」校验为 ①offer_salary 落在薪酬带区间 ②岗位编制余额 count-hired ≥ 0 | hired ≥ count 时职位自动置「已完成」 |
| 交付验收 | 漏斗周报 PII 仅掩码；入职清单在入职日前 3 天全绿 | 见 §3 交付规范 |

## 10 特殊约束

- **PII 脱敏后流转**：候选人手机/身份证只以掩码形态出域（`138****5678`、`4403**********1234`）；完整值仅存在于源系统，工作区数据全部为合成数据，不含真实个人信息。
- **外发一票否决**：任何简历/候选人信息对外发送（外部面试官、客户）必须经 rec.resume-forward 的 L4 双审批 + redact_gate 物理闸门；未脱敏外发直接否决并留痕。
- **数据规模**：demo 数据由「6 行模板继承 002」升级为本设计规格——candidates 14 行 / interviews 21 行 / funnel 15 行（每表 ≥12 行），与数据字典逐表核对（文件名/行数/字段）。
- **声明与落地对照**：scene 数据资产名为 xlsx，工作区落地为 UTF-8 CSV（同名归一化由 `scripts/data-consistency-check.mjs` 校验）；本域新增 interviews.csv，funnel.csv 追加 week 列，candidates.csv 追加 11 列，原有列名均未改动。
- **记忆层**：pii_allowed=false，候选人 PII 禁入记忆层与公网检索；exclude=[]。
- **回滚**：6 条工作流各带 savepoint 标签（pre-funnel-weekly / pre-resume-forward / pre-jd-draft / pre-interview-schedule / pre-offer-approve / pre-onboarding-check），失败即回滚。
- **规则命中样例**：IV008/IV019 为面试官同时段冲突样例，属刻意埋点（用于回归测试 `rec.interview-schedule` 标红规则），非数据缺陷。
- **命名差异**：scene.workflows 列出 `rec.funnel-report`，落地为 `rec.funnel-weekly.yaml`；两者为同一能力的命名差异，以工作流索引与落地文件为准。

## 11 LLM 全流程接入标准（2026-09-30 增补）

招聘工作流从“生成一段建议”升级为可审计的 LLM 阶段编排。所有模型输出必须是结构化 JSON，并满足：

1. 每个结论带 `evidence_refs`，能指向简历页、候选人行、面试记录、薪酬带或用户提交字段；没有证据只能输出 `unknown` 或 `manual_review`。
2. 输出包含 `confidence`、`redactions`、`model`、`prompt_version`，模型失败时保留草稿且状态为 `blocked_model`。
3. 模型不得自行批准、发送 Offer、淘汰候选人、外发简历或写入正式业务结论。
4. 受保护属性（性别、年龄、婚育、民族、宗教、健康等）不得作为筛选、评价或定价维度。
5. 用户提交的面试过程、评分和反馈是 Offer 评价的必要输入；缺失时只能生成“待面试数据”的任务包。

| 工作流 | LLM 责任 | 人工责任 | 终态门禁 |
|---|---|---|---|
| rec.jd-draft | 岗位能力模型、关键结果、JD 草稿、合规检查 | 确认职责、能力和薪酬带 | 合规项全通过；薪酬带来自 comp |
| rec.resume-forward | 简历解析、真实性/完整性校验、岗位匹配、短名单与追问 | 复核证据，批准是否外发 | 脱敏通过 + 两个不同角色/操作者签字 |
| rec.interview-schedule | 针对性题库、追问、评分锚点、冲突检测 | 确认面试官与时间 | 无时间冲突；题库覆盖所有能力项 |
| rec.offer-approve | 汇总面试反馈、一致性/冲突判断、Offer 建议和草稿 | 提交面试数据并完成双审批 | 反馈完整；超 P75/预算不足/证据冲突必须双审批 |
| rec.onboarding-check | 入职清单、30/60/90 天目标和质量评价 | 确认任务责任人与实际状态 | 合同/账号/设备/培训等阻断项完成 |
| rec.funnel-weekly | 渠道与留存漏斗、招聘周期、Offer 接受率、招聘质量 | 复核数据口径和改进行动 | 阶段人数守恒；结论可下钻到源行 |

## 12 招聘闭环与用户提交数据

完整闭环为：

`岗位需求/JD -> 简历上传与解析 -> 格式/真实性/PII 校验 -> 岗位匹配和筛选评价 -> 邀约信 -> 针对性面试题库 -> 面试过程与反馈提交 -> 综合评价/风险项 -> 人工角色签名审批 -> Offer 生成与发送 -> 入职任务链 -> 30/60/90 天成效 -> 交付质量评估 -> 渠道留存漏斗 -> 战略 KR 回写`

其中面试过程与反馈必须由用户通过界面提交，至少包含：

- `candidate_masked`、`round`、`interviewer_role`、`interview_at`。
- 每个能力项的 `score`、`evidence`、`risk_note`。
- `result`（pending/pass/fail/hold）与人工确认意见。
- 关联的题库、评分卡和上一轮证据引用。

系统不得把“没有反馈”推导成“未通过”；缺失数据应进入 `awaiting_user_data` 或 `manual_review`。

## 13 成效、质量与战略贡献

招聘域的北极星是“招聘质量、速度与 90 天留存”，同时向 `KR-TALENT`（入职人数）和 `KR-CAPABILITY`（能力供给）贡献指标：

| 指标 | 口径 | 用途 |
|---|---|---|
| time_to_fill_days | 从需求批准到 Offer 接受 | 招聘速度与流程瓶颈 |
| offer_acceptance_pct | 接受 Offer / 发放 Offer | 定薪与雇主竞争力 |
| quality_of_hire | 30/60/90 天业务达标、经理评价和试用期结果的加权分 | 招聘质量 |
| retention_90d_pct | 入职 90 天仍在职人数 / 入职人数 | 渠道与筛选有效性 |
| source_quality | 各来源的“入职且 90 天留存”转化与质量分 | 渠道投入决策 |
| cost_per_hire_wan | 招聘相关总成本 / 入职人数 | 预算效率 |

所有指标必须回传 `metrics/snapshots-YYYY-MM.jsonl`，并带有 `instance_id`、`workflow_id`、`data_version` 和贡献 KR。战略总看板只消费这些有来源的证据，不允许人工直接填写汇总数。

## 14 UI 交付规范（壳内工作台）

招聘域在壳内工作台提供：

- 经营路径与贡献 KR、当前指标、待审批和最近实例。
- 六个流程卡片，每张显示业务目的、交付物、格式和验收标准。
- 输入阶段提供“填入示例”和逐字段说明，支持 JSON/CSV 导入与用户上传材料引用。
- 阶段链实时显示输入、校验、LLM、质量门、审批、发布、成效和战略回写状态。
- 双审批使用“角色 + 操作者签名 + 意见”，同一角色或同一操作者不能重复完成双审批。
- 交付页可下载实例 JSON、Markdown、正式交付包及 manifest；失败状态显示恢复动作。
- 招聘质量与留存复盘可从总看板下钻到实例、源数据行和产物哈希。
