# Preset 设计文档 · 合规管理（cmp）

> 定位：`cmp.policy-review@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/cmp.policy-review.yaml`（scene_id `cmp.policy-review@1.0.0`、domain `CMP`；required_capabilities 3；skills 3；policies：min_level=L4 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3；industry_overlay=null）
> - Workflows：`manifests/workflows/index.json`（`domain==="cmp"` 共 6 条）+ `manifests/workflows/cmp.*.yaml`
> - Skills：`templates/skills-domain/cmp/SKILL-*.md`（含意图路由 `SKILL-cockpit-intent.md`）；知识种子 `templates/knowledge/seeds/cmp.md`；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/cmp/policy_checklist.csv`、`templates/workspace/data/cmp/pipia.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2.24（合规自查/风险事件/合规审计字段）、§3.3（CHECK_STATUS / RISK_STATUS 枚举）、§4.13（合规整改与风险闭环）、§5.3（数据边界）、§6.4（合规风险总览图表口径）、§7.1（风险/合规项 10/20）、§9.5（曾清 20 项带法条引用 + 合规率自动报告）；PRD §3.7 G4（合规检查/审计）
>
> **数据基线日 = 2026-09-30**（整改时限与逾期判定以此为基准）。全部为**合成数据**，不含真实个人信息：人员一律掩码（`E1***`），组织一律脱敏码（`DEPT-***`）或合成部门名，表内无姓名/工号/联系方式。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| policy_checklist.csv | L2 | —（scene 声明 `policies.xlsx` 的 `pii_fields: []`）；表内含掩码复核人字段 `reviewer_masked`（`E1***`，不可还原，不构成个人可识别信息） | 20 | 制度合规自查清单（合规项 20 项，与参照 §7.1"合规项 20"一致）：制度项/检查项/状态/风险等级/法条引用/发现项/整改时限/证据引用；覆盖 9 类检查类别，含 5 条待整改 + 2 条不合规，是**合规率汇总口径**与整改闭环的来源 |
| pipia.csv | L4 | audit_working_papers（落地口径=评估底稿列组 `mitigation` 缓释措施 / `approval_dual` 审批痕迹 / `assessed_at` 结论日；scene 声明 `audit-papers.xlsx`，`redact.fields: [audit_working_papers]`） | 14 | 个人信息保护影响评估（PIPIA）台账（参照 §7.1"风险 10"，本落地 14 条以覆盖三评估状态）：处理活动/初始与残余风险等级/评估状态/风险事件状态/上线闸门/双审批/检查项外键；含 3 条"高风险 residual 未降级→禁止上线"阻塞样例 |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按"去扩展名 + 前缀"匹配）：

- scene `data_assets` 的 `policies.xlsx`（L2，`pii_fields: []`）/ type-dict `cmp, policies, table, L2, none` → **落地 `policy_checklist.csv`**
- scene `data_assets` 的 `audit-papers.xlsx`（L4，`pii_fields: [audit_working_papers]`）/ type-dict `cmp, audit-papers, table, L4, audit_working_papers` → **落地 `pipia.csv`**（PIPIA 评估底稿即本域审计工作底稿）
- `xlsx` 仅为 Scene 规格层命名；工作台事实表为 CSV（UTF-8、表头英文小写下划线、逗号分隔、字段内不使用英文逗号）。行数为数据行（不含表头），与校验脚本口径一致。字段内多项取值以 `；` 分隔，空值统一写 `—`（不写英文逗号）。
- **声明级别与访问级别分离**：两张表的声明级别为 L2 / L4；Permission Gateway 按 scene `permission.min_level=L4` 统一准入——**凡读取本域任一表均按 L4 校验**，声明级别只用于资产登记与脱敏规则路由（`audit_working_papers` 命中即过 `redact_gate`）。
- **两表口径对应（禁孤儿引用）**：`pipia.check_ref` → `policy_checklist.check_id`；`policy_checklist.evidence_ref` → `EVP-YYYY-###`（`cmp.evidence-pack` 产物编号，审计级证据链锚点）。本域样本 14 条 PIPIA 全部命中既有检查项，20 条检查项的证据引用全部命中 `EVP-2026-###` 号段（§9 V-CMP-04）。
- **合规率自动汇总口径**（参照 §4.13，由表数据直接算出）：`total=20`、`compliant=13`、`pending=5`、`noncompliant=2`；`合规率 = compliant / total = 65.0%`，`待整改率 25.0%`、`不合规率 10.0%`，三者合计 100.0%。口径见 §9 V-CMP-02，图表口径见 §6（合规风险总览）。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref。

#### 1.1.1 policy_checklist.csv（14 列 = 原生 5 列 + 追加 9 列，20 行）

表头逐字：`policy,item,status,owner,review_date,check_id,category,legal_basis,level,finding,evidence_ref,rectify_deadline,closed_date,reviewer_masked`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| policy | string | 是 | 制度/政策名称（如"劳动用工制度""个人信息保护""数据管理制度"）；原始列 |
| item | string | 是 | 检查项（条款级颗粒度，如"加班与调休条款""敏感个人信息单独同意"）；原始列 |
| status | enum | 是 | 合规项状态：合规 / 待整改 / 不合规（对应参照 CHECK_STATUS compliant/pending/noncompliant，迁移见 §4.1）；原始列 |
| owner | enum | 是 | 整改/归口部门（合成部门名，**非个人**）；原始列 |
| review_date | date | 是 | 本次检查实施日（待整改/不合规项即发现日）；整改时限自该日起算（§9 V-CMP-03）；原始列（语义口径修正见 §10.7） |
| check_id | string | 是 | 检查项编号，主键，`CHK-YYYY-###`，编号不复用；追加列 |
| category | enum | 是 | 检查类别（9 类，参照 §3.2.24）：劳动用工 / 劳动权益 / 数据保护 / 个人信息保护 / 信息安全 / 采购合规 / 反舞弊 / 职业健康安全 / 财税合规；追加列 |
| legal_basis | string | 是 | 法条引用（《法律名》第 N 条；多项用 `；` 分隔），**不合规/待整改项必填**（§9 V-CMP-01）；追加列（参照 §3.2.24 legalBasis） |
| level | enum | 是 | 检查项风险等级：高 / 中 / 低；决定整改时限（§9 V-CMP-03）；追加列（参照 §3.2.24 level） |
| finding | string | 是 | 发现项/检查结论（工作底稿口径：只写制度、系统与流程事实，**禁写姓名/工号/联系方式**）；追加列 |
| evidence_ref | string | 是 | 证据引用：`EVP-YYYY-###` = `cmp.evidence-pack` 证据包编号（审计级可追溯锚点，§9 V-CMP-04）；追加列 |
| rectify_deadline | date | 否 | 整改完成期限 = `review_date` + 等级时限（高 ≤30 天 / 中 ≤60 天 / 低 ≤90 天）；合规项为 `—`；追加列 |
| closed_date | date | 否 | 整改复验关闭日（对应 §4.1"待整改→合规"迁移完成）；未关闭为 `—`；追加列 |
| reviewer_masked | string | 是 | 检查/复核人掩码 `E<n>***`（不可还原，不得回填工号/姓名，§9 V-CMP-12）；追加列 |

#### 1.1.2 pipia.csv（17 列 = 原生 5 列 + 追加 12 列，14 行）

表头逐字：`process,risk_level,residual_risk,next_review,owner,pipia_id,assessment_status,dept_masked,data_categories,legal_basis,mitigation,residual_downgraded,risk_status,approval_dual,launch_gate,assessed_at,check_ref`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| process | string | 是 | 个人信息处理活动名称（如"员工考勤人脸识别"）；原始列 |
| risk_level | enum | 是 | **初始**风险等级：高 / 中 / 低（未施缓释前的固有风险）；原始列 |
| residual_risk | enum | 是 | **残余**风险等级：高 / 中 / 低（评估中为初步值，已出结论为结论值）；原始列 |
| next_review | date | 是 | 下次复评日 `YYYY-MM-DD`（高风险 ≤6 个月、中风险 ≤9 个月、低风险 ≤12 个月，§9 V-CMP-07）；原始列 |
| owner | enum | 是 | 责任归口（合成部门名或角色名，**非个人**，如"安全合规部""EAP专员"）；原始列 |
| pipia_id | string | 是 | 评估编号，主键，`PIPIA-YYYY-###`；追加列 |
| assessment_status | enum | 是 | PIPIA 评估状态：待评 / 评估中 / 已出结论（迁移见 §4.3）；追加列 |
| dept_masked | string | 是 | 责任部门脱敏码 `DEPT-<职能>-***`（如 `DEPT-SEC-***`），部门标识不落实名；追加列 |
| data_categories | string | 是 | 涉及个人信息类别（**类别标签**，多项用 `；` 分隔，如"生物识别信息；考勤记录"）；不承载任何具体个人数据；追加列 |
| legal_basis | string | 是 | 法条引用（《个人信息保护法》第 N 条等；涉出境加《数据出境安全评估办法》）；追加列 |
| mitigation | string | 是 | 风险缓释措施（**工作底稿口径 `audit_working_papers`**：出域/入报告前必过 `redact_gate`）；追加列 |
| residual_downgraded | enum | 是 | 降级是否**已完成验证**：是 / 否 / 不适用（不适用=初始即低风险）；判定规则见 §9 V-CMP-05；追加列 |
| risk_status | enum | 是 | 风险事件状态：待处理 / 处理中 / 已闭环（对应参照 RISK_STATUS open/doing/closed，迁移见 §4.2）；追加列 |
| approval_dual | string | 否 | 双审批展示口径：`主管✓/DPO✓`（已通过）、`主管待/DPO待`（待审批）、`主管✓/DPO待`（部分通过）；未启动为 `—`；追加列 |
| launch_gate | enum | 是 | 上线闸门：可上线 / 禁止上线 / 待评审；**高风险且 `residual_downgraded=否` 一律"禁止上线"**（§5/§9 V-CMP-05）；追加列 |
| assessed_at | date | 否 | PIPIA 结论出具日；`assessment_status≠已出结论` 时为 `—`；追加列 |
| check_ref | ref | 是 | → `policy_checklist.check_id` 外键（本表风险项与检查项的口径对应，禁孤儿引用）；追加列 |

---

## §2 技能规格（scene skills：policy-checklist / pipia-list / evidence-pack）

| 技能 | 绑定工作流 | 用途 | 输入 | 输出 | 权限 | 质量检查与门禁 |
|---|---|---|---|---|---|---|
| policy-checklist | cmp.policy-review、cmp.audit-trail（Scene 绑定 `workflows/cmp.policy-report.yaml`） | 制度合规审查 checklist（逐条比对，带法条引用）与审计留痕覆盖率汇总 | data/cmp/policy_checklist.csv | `policy-review-<ts>.json`、`audit-trail-<ts>.json` | L4 | 每条结论必须附 `check_id` + `legal_basis`；合规率口径固定 total/compliant/pending/noncompliant（§9 V-CMP-02）；覆盖率 <95% 必须显式报缺口；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| pipia-list | cmp.pipia-review、cmp.training-check | PIPIA 清单生成/评审（高风险处理活动）与合规培训完成度核查 | data/cmp/pipia.csv、policy_checklist.csv | `pipia-review-<ts>.json`、`training-check-<ts>.json` | L4 | 高风险 residual 未降级**不得置"可上线"**；未出结论不得放行；培训必修未完成 >5% 必须上报管理层；连续 3 次失败→登记 capability-gap |
| evidence-pack | cmp.evidence-pack、cmp.reg-filing | 审计证据打包（Requirement→Implementation→Test→Evidence→Release 五级链）与监管报送清单 | data/cmp/*、审计事件流、审批单 | `evidence-pack-<ts>.json`、`reg-filing-<ts>.json` | L4 | 打包后**不可增删**（append-only）；每项证据可复算哈希；对外/提交前双审批齐备；7 天内到期必须置顶；连续 3 次失败→登记 capability-gap |

- 三个技能文件（`templates/skills-domain/cmp/SKILL-*.md`）均声明 `min_level: L4`、`redact_gate: true`，依赖能力 `cap.excel.panel`、`cap.redact.all`（与 scene `required_capabilities` 的 cap.excel.panel / cap.approval.single / cap.redact.all 一致）。
- 意图路由技能 `cmp-intent`（`templates/skills-domain/cmp/SKILL-cockpit-intent.md`）把自然语言意图路由到 `evidence-pack` / `policy-report` 工作流；跨域意图交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。
- **技能绑定纪律（015 §15.4）**：GT 落账时比对"实际执行技能 vs Scene 声明技能"，不一致即 FAIL；本域三个 GT 的实际执行技能必须落在 scene `skills` 之内，不得用域外技能顶岗。
- **效率登记（不改 manifest）**：`manifests/workflows/index.json` 中 `cmp.training-check` 绑定技能为 `pipia-list`、`cmp.reg-filing` 绑定技能为 `evidence-pack`，与字面语义（培训核查/报送清单）不完全贴合；本页按 manifest 原样登记，迁移到培训/报送专用技能须走 manifest 侧变更（§10.6）。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="cmp"）

### 3.1 域内工作流

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| cmp.evidence-pack@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `evidence-pack-<ts>.json`：case / evidence_items / hashes / packaged_at；acceptance：**打包后不可增删（append-only）** | kind=approve；skill=evidence-pack；落 `reports/cmp/`；审计记"审批人 + 依据数据版本 + 产物哈希"；rollback=savepoint `pre-evidence-pack` |
| cmp.pipia-review@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition；hitl_nodes=[n3] | `pipia-review-<ts>.json`：process / risk_level / residual / approvals；acceptance：**高风险 residual 未降级不得上线** | kind=approve；skill=pipia-list；对应 `pipia.launch_gate` 闸门（§5）；rollback=savepoint `pre-pipia-review` |
| cmp.policy-review@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `policy-review-<ts>.json`：policy / items / pass_rate / gaps；acceptance：Requirement→Release 链完整 | skill=policy-checklist；逐条比对模式（scene 命令 `policy-review`）；审计记"数据版本 + 产物哈希"；rollback=savepoint `pre-policy-review` |
| cmp.audit-trail@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `audit-trail-<ts>.json`：scope / events / coverage_pct / gaps；acceptance：**关键动作覆盖率 ≥95%** | skill=policy-checklist；审计留痕月报，覆盖率不足必须在 gaps 列明；rollback=savepoint `pre-audit-trail` |
| cmp.training-check@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `training-check-<ts>.json`：dept / required / completed / rate；acceptance：**必修未完成 >5% 上报管理层** | skill=pipia-list；口径与 `policy_checklist` 的 CHK-2026-014（必修未完成率 6.2%）对齐；rollback=savepoint `pre-training-check` |
| cmp.reg-filing@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空）；7 天内到期项转人工置顶 | `reg-filing-<ts>.json`：filing / authority / deadline / days_left；acceptance：**7 天内到期必须置顶** | skill=evidence-pack；审计记"输入参数 + 结果快照"；rollback=savepoint `pre-reg-filing` |

- 节点链：approve 类为 skill(n1) → condition(n2) → approval(n3) → tool `cap.excel.panel.write`(n4) → audit(n5)；report/calc 类为 skill(n1) → tool(n2) → audit(n3)。上表"审批落点"列对无审批工作流明示为"无审批节点"，不存在空值占位。
- condition 的 then 分支禁止绕过 approval 直连 `cap.excel.panel.write`（015 §8.2）；approve 类的产物写库动作只在审批通过后发生。

### 3.2 Scene 绑定（Scene YAML `workflows` 字段指向的绑定文件）

| Scene | 绑定文件 | workflow_id / 触发命令 | 审批落点 | 说明 |
|---|---|---|---|---|
| cmp.policy-review@1.0.0 | workflows/cmp.evidence-pack.yaml | cmp.evidence-pack@1.0.0；`evidence-pack` | 打包产物对外/提交前（n3，L4 dual） | 与 3.1 同工作流；审计记录"审批人 + 依据数据版本 + 产物哈希"；check：产物与审批单一致，on_fail=rollback |
| cmp.policy-review@1.0.0 | workflows/cmp.policy-report.yaml | cmp.policy-report@1.0.0；`policy-report` | 报告对外/生效前（n3，L4，**dual=false**） | 制度审查报告单审批；check：产物与审批单一致，on_fail=rollback；命名与 index.json 的 `cmp.policy-review@1.0.0` 差异见 §10.6 |

---

## §4 状态机

### 4.1 合规项（policy_checklist.status；中文值 ↔ 参照 CHECK_STATUS）

```
待整改(pending) ──(整改完成 + 复验通过)──→ 合规(compliant) ──(复查发现回潮)──→ 待整改
待整改(pending) ──(逾期未整改 / 复验不通过)──→ 不合规(noncompliant)
不合规(noncompliant) ──(重大整改 + 双人复核)──→ 合规(compliant)
```

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 合规 | 复查发现整改回潮/控制失效 | 待整改 | 需重新登记 `review_date` 与 `rectify_deadline`（§9 V-CMP-03） |
| 待整改 | 整改完成且复验通过（`closed_date` 落值） | 合规 | 复验证据必须引用同一 `evidence_ref` 的更新包；关闭人不得为原发现人（§5） |
| 待整改 | 超过 `rectify_deadline` 未关闭，或复验不通过 | 不合规 | 逾期即升级，不得静默延期；升级需在 `finding` 追加说明 |
| 不合规 | 完成重大整改并通过双人复核 | 合规 | 双人复核记录（复核人 ∈ 合规负责人 + 原检查人之外角色）；不得跳级回"待整改" |
| 合规 | —（当前合格） | 合规 | 状态变更只可新增行/追加审计事件（append-only），历史不改写 |

本域样本（20 项）：合规 13（CHK-2026-001/004/005/006/009/011/012/015/016/017/018/019/020）、待整改 5（002/003/007/010/014）、不合规 2（008/013）；高风险开放项 5（002/003/007/008/013）。

### 4.2 风险事件（pipia.risk_status；中文值 ↔ 参照 RISK_STATUS）

```
待处理(open) ──(责任人接单并启动缓释措施)──→ 处理中(doing) ──(缓释完成 + residual 降级验证通过)──→ 已闭环(closed)
处理中(doing) ──(复验不通过)──→ 处理中（退回重做：状态不变，只追加操作日志）
```

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 待处理 | `owner` 接单并启动 `mitigation` | 处理中 | 必须登记责任人（`owner` 非空）与措施；**禁止 待处理→已闭环 跳级** |
| 处理中 | 缓释措施完成且残余风险降级验证通过 | 已闭环 | 需 `residual_downgraded=是` 或初始低风险（不适用）；关联 `approval_dual` 双通过 |
| 处理中 | 复验不通过 | 处理中 | 只追加日志、不改变状态，禁止回退到"待处理" |
| 已闭环 | —（终态） | 已闭环 | 终态 append-only；重新打开须新增风险条目并关联原 `pipia_id` |

本域样本（14 条）：待处理 1（PIPIA-2026-007）、处理中 4（004/009/010/012）、已闭环 9。

### 4.3 PIPIA 评估（pipia.assessment_status）与上线闸门

```
待评 ──(受理并组建评估)──→ 评估中 ──(结论出具 + 双审批齐备)──→ 已出结论（终态）
评估中 ──(材料不足/范围变更)──→ 待评（退回，需在 mitigation 追加说明）
```

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 待评 | 受理评估申请、指定 DPO 与业务归口 | 评估中 | 无审批要求；`approval_dual` 为 `—` |
| 评估中 | 出具评估结论并经 **L4 双审批**（cmp.pipia-review n3） | 已出结论（终态） | `assessed_at` 必填；`approval_dual=主管✓/DPO✓`；结论不可回退，重评新增行 |
| 评估中 | 材料不足/处理活动范围变更 | 待评 | 不得删除原有结论痕迹（append-only） |
| （闸门） | `risk_level=高` 且 `residual_downgraded=否` | 闸门=**禁止上线** | 评估中亦不得放行，不得以"待评审"规避（§9 V-CMP-05）；本域样本 3 条：004/009/012 |
| （闸门） | 已出结论且降级已验证（或初始低风险） | 闸门=可上线 | 需 `assessed_at` 非空 + 双审批齐备（§9 V-CMP-06） |

本域样本（14 条）：待评 1、评估中 4、已出结论 9；闸门分布：可上线 9、禁止上线 3、待评审 2。

---

## §5 审批链（节点-角色-双审批）

| 业务动作 | 工作流 | 节点 | 审批落点 | 审批角色（基线建议，两角色须为**不同审批人**） | 是否双审批 |
|---|---|---|---|---|---|
| 证据包对外提交（外部审计/监管/争议举证） | cmp.evidence-pack | n3 | 打包产物对外前 | 甲：合规负责人（CCO）；乙：法务/DPO | **是**（dual=true，L4） |
| 高风险处理活动上线 / 重大变更 | cmp.pipia-review | n3 | 结论生效与上线前 | 甲：DPO（安全合规部）；乙：业务归口负责人（对应 `owner`） | **是**（dual=true，L4） |
| 制度审查报告对外 | cmp.policy-report（Scene 绑定） | n3 | 报告对外/生效前 | 甲：合规归口负责人；乙：—（单审批） | 否（dual=false，L4） |
| 合规项整改关闭（待整改/不合规 → 合规） | 无独立工作流（`cmp.policy-review` 复核分支） | — | 复验通过后关闭 | 甲：复核人（原检查人之外）；乙：合规负责人确认（高风险项） | 高风险项**是**；中/低风险单复核 |
| 低风险项整改关闭 | 同上 | — | 复验通过后关闭 | 甲：复核人 | 否 |

- **整改闭环四闸门**：① 发现（登记 `finding` + `legal_basis` + `evidence_ref`）→ ② 整改（责任人按 `rectify_deadline` 执行，措施落 `mitigation`）→ ③ 复验（复核人 ≠ 发现人，回归测试证据入同一证据包）→ ④ 关闭（`closed_date` 落值，状态置"合规"，追加审计事件）。四闸门任一缺失不得关闭（§9 V-CMP-04/V-CMP-09）。
- **高风险上线闸门**：`risk_level=高` 且 `residual_downgraded=否` 的处理活动，`launch_gate` 必须为"禁止上线"；即使双审批已通过也不得放行——先完成缓释并验证降级，重评后再走 n3 双审批（workflow acceptance 原文"高风险 residual 未降级不得上线"）。
- 审批记录统一落 `audit/n5`：审批人 + 依据数据版本 + 产物哈希；`check` 判据"产物与审批单一致"，`on_fail=rollback`（savepoint：`pre-evidence-pack` / `pre-pipia-review` / `pre-policy-report`）。
- 场景基线 `policies.permission.dual_approval=false` 为**域默认**；两条 approve 工作流在流程级升格为 L4 双审批（与 workflow YAML 一致），规则**单调加严、不放松**。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

| 触发 | 联动副作用 | 证据字段（落点） | 目标域/组件 |
|---|---|---|---|
| 合规审计发现需举证（争议/仲裁/诉讼） | 生成审计级证据包并按 append-only 封存，供争议处理引用（**不得复制原文，只传引用**） | policy_checklist：check_id / evidence_ref；pipia：pipia_id | er-eap（`er-eap.dispute-case` 的 evidence_refs，指向 CMP evidence-pack） |
| PIPIA 结论=禁止上线（高风险未降级） | 阻断相关业务上线与内容外发（含自动化决策/个人信息处理场景） | pipia：launch_gate=禁止上线 / risk_level / residual_downgraded | mkt-on（内容外发）、产品上线评审 |
| PIPIA 结论涉及单独同意/告知义务 | 合同与触达文案增补数据处理条款与告知语 | policy_checklist：CHK-2026-007 / literal legal_basis；pipia：legal_basis | sales（合同条款）、mkt-on（外发文案与告知） |
| 风险事件状态变更（待处理/处理中/已闭环） | 报表洞察"合规风险总览"按等级/部门重算未闭环数 | pipia：risk_status / risk_level / dept_masked | 报表洞察（参照 §6.4 合规风险总览） |
| 合规项整改关闭 | 制度版本更新 + 证据包追加（不改写历史） | policy_checklist：check_id / closed_date / evidence_ref | 知识库（`seeds/cmp`）、审计留痕 |
| 审计留痕覆盖率 <95% | 报告 gaps 列明缺口并升级至管理层，触发留痕补齐 | audit-trail-`<ts>`.json：coverage_pct / gaps | 管理层报表（本域） |
| 合规培训必修未完成率 >5% | 按部门上报管理层并跟踪补训 | training-check-`<ts>`.json：dept / required / completed / rate；policy_checklist：CHK-2026-014 | 管理层报表（本域）、trn（培训执行） |
| fin 域发票 FAIL / 连号 / 抬头不符 | 触发本域留痕与整改登记（财税合规检查项） | policy_checklist：CHK-2026-013 / finding / evidence_ref | FIN（`fin.invoice-check` → CMP `cmp.audit-trail`） |
| er-eap 离职/处分决定生效，涉证据对外 | 由本域打包证据链后再对外（er-eap 双审批 + CMP 证据双审批） | pipia/policy_checklist：evidence_ref；er_cases：dispute_status | ER-EAP（`er-eap.offboard-approve`） |
| 任一触及对外/生效动作 | 一律回到 L4 审批（approve 类双审批），审计绑定数据版本 | 审批记录 + 数据版本 + 产物哈希 | Permission Gateway |

---

## §7 权限矩阵

### 7.1 策略层（与 Scene `policies` 逐字一致）

| 项 | 值 | 来源 |
|---|---|---|
| 最低数据级别 | L4（越级读取即 DENY；域内任一表统一按 L4 准入） | Scene `permission.min_level=L4` |
| 双审批 | 域基线 false；approve 类工作流级升格为 true（cmp.evidence-pack / cmp.pipia-review） | Scene `permission.dual_approval=false` + workflow `dual:true` |
| 必装能力位 | cap.excel.panel、cap.approval.single、cap.redact.all | Scene `required_capabilities` |
| 脱敏字段（redact_gate） | audit_working_papers（落地口径=评估底稿列组：`pipia.mitigation` / `pipia.approval_dual` / `pipia.assessed_at`） | Scene `redact.fields` + `gate=redact_gate` |
| 记忆层 | `pii_allowed=false`；`exclude=[]` | Scene `policies.memory` |
| 留痕 | 读/算/写审计事件 + 审批记录（审批人、数据版本、产物哈希），append-only | GT `expected_audit`；015 §8.4 |
| 行业扩展位 | `industry_overlay: null`（首批 0 个） | Scene |

### 7.2 操作 × 约束

| 操作 | 最低级别 | 双审批 | 脱敏 | 记忆层 | 网络 |
|---|---|---|---|---|---|
| 读取 policy_checklist.csv / pipia.csv | L4 | 否（只读） | 命中 `audit_working_papers` 即过 redact_gate | PII 禁入（仅可入状态/汇总结论） | 按域策略（无外部检索需求） |
| Excel 面板计算（台账比对/合规率汇总） | L4 | 否 | 同上 | 禁写入 | 同上 |
| 写产物/交付物（reports/cmp/*） | L4 | 触及对外/生效动作时必须 | 只出掩码 `E<n>***` 与脱敏码 `DEPT-***`，不出姓名/工号 | 禁写入 | 同上 |
| 证据包对外提交 | L4 | **是**（n3，双人） | 证据项只出引用与哈希 | 禁写入 | 同上 |
| 高风险处理活动上线 | L4 | **是**（n3，双人）+ 闸门校验 | 同上 | 禁写入 | 同上 |
| 合规项整改关闭 | L4 | 高风险项双复核，中/低单复核 | 同上 | 禁写入 | 同上 |
| 培训核查 / 监管报送清单 | L4 | 否（report/calc） | 只出部门级聚合，不出个人明细 | 禁写入 | 同上 |

### 7.3 数据边界（参照 §5.3）

| 角色 | 可见范围 |
|---|---|
| admin | 全部实体全部行（含证据包与底稿列） |
| hr（合规岗/HR） | 本域全部业务行（人员列一律掩码；`mitigation`/`finding` 属工作底稿口径，出域前过 redact_gate） |
| employee | **不可见**：合规台账、风险事件、证据包均不对员工角色开放（无自助视图） |
| 审计/监管（外部） | 仅经 `cmp.evidence-pack` 双审批后提交的证据包（含哈希清单），不含底稿原文与个人字段 |

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 执行技能 | 工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|---|
| GT-CMP-01 | 对员工手册做合规 checklist 审查 | policy-checklist（cmp.policy-review） | cap.excel.panel、cap.approval.single | L4 | reports/cmp/gt-01.md | data/cmp/policies.xlsx → policy_checklist.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 `check_id`） |
| GT-CMP-02 | 生成新业务上线 PIPIA 清单 | pipia-list（cmp.pipia-review） | cap.excel.panel、cap.approval.single | L4 | reports/cmp/gt-02.md | data/cmp/audit-papers.xlsx → pipia.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 `pipia_id`） |
| GT-CMP-03 | 打包某任务的完整证据链（审计级） | evidence-pack（cmp.evidence-pack） | cap.excel.panel、cap.approval.single | L4（对外双审批） | reports/cmp/gt-03.md | 两份均用（审计底稿口径） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据（五级链可复算哈希） |

### 任务分解（scene `expected_plan` 指向本页）

**GT-CMP-01 员工手册合规 checklist 审查**
1. 读 policy_checklist.csv 全 20 行，按 `category`（9 类）分组，逐条核对 `status` 与 `legal_basis`（不合规/待整改项必须带法条引用）。
2. 筛出开放项 7 条：高风险 5（CHK-2026-002/003/007/008/013）、中风险 2（010/014）；逐条给出 `rectify_deadline` 与剩余天数（基准日 2026-09-30），逾期即升级。
3. 汇总合规率：`total=20 / compliant=13 / pending=5 / noncompliant=2 → 65.0%`；同时给出三类占比（65.0%/25.0%/10.0%）与放行建议（高风险项阻断相关上线）。
4. 每条结论附 `check_id` + `evidence_ref`（EVP 编号）；输出 `reports/cmp/gt-01.md`，写审计（数据版本 + 产物哈希）。

**GT-CMP-02 新业务上线 PIPIA 清单**
1. 以 pipia.csv 14 行为基线库，抽取五类必备评估项：告知同意 / 最小必要 / 存储期限 / 第三方共享 / 跨境传输；新业务按同一模板逐项填列。
2. 比对既有高风险样例（PIPIA-2026-004 招聘背调、009 门禁监控、012 跨境传输）确定新业务风险等级与缓释要求。
3. 闸门判定：`risk_level=高` 且降级未验证 → 结论"禁止上线"（不得置"可上线"/"待评审"）；结论出具后走 `cmp.pipia-review` n3 L4 双审批。
4. 输出清单（process / risk_level / residual / mitigation / launch_gate / check_ref），落 `reports/cmp/gt-02.md`；写审计。

**GT-CMP-03 打包某任务的完整证据链（审计级）**
1. 选定案件（示例：CHK-2026-013 发票与报销凭证真实性），按五级链取证：Requirement（`legal_basis`）→ Implementation（制度与 `mitigation`）→ Test（`finding` 抽样结论）→ Evidence（`evidence_ref` 命中证据包）→ Release（审批单 + 交付物哈希）。
2. 逐项校验引用可解析（`evidence_ref` → EVP 编号、`check_ref` → check_id），缺引用即失败，不得以说明文字代替证据。
3. 封存：产物 `evidence-pack-<ts>.json`（case / evidence_items / hashes / packaged_at）append-only，打包后不可增删；对外提交前过 n3 L4 双审批。
4. 落 `reports/cmp/gt-03.md`，写审计（审批人 + 依据数据版本 + 产物哈希）。

---

## §9 校验规则

| 编号 | 规则 | 判定/证据 |
|---|---|---|
| V-CMP-01 | 法条引用必填：`status ∈ {待整改, 不合规}` 的检查项 `legal_basis` 非空且形如《X》第 N 条；`policy_checklist` 全表 20 行均带法条引用 | 数据列机检；缺引用即 FAIL（参照 §3.2.24 legalBasis） |
| V-CMP-02 | 合规率口径固定：`合规率 = compliant / total`；由表数据自动算出 `13/20 = 65.0%`，`pending 25.0%` + `noncompliant 10.0%` 合计 100.0%；报告不得手工改口径或四舍五入掩盖 | 汇总产物与 policy_checklist.csv 逐行重算比对 |
| V-CMP-03 | 整改时限：`rectify_deadline − review_date ≤ 30/60/90 天`（高/中/低）；合规项 `rectify_deadline` 必须为 `—`；`rectify_deadline < 基准日` 判"已逾期"并升级，不得静默延期 | 日期差机检（本样本 7 个开放项全部合规，无逾期） |
| V-CMP-04 | 证据链可追溯到审计级：每条检查项 `evidence_ref` 必须命中 `cmp.evidence-pack` 证据包编号（`EVP-YYYY-###`），且包内哈希可复算；`pipia.check_ref` 必须命中既有 `check_id`（禁孤儿引用） | 引用解析 + 哈希复算；无引用/引用悬空即 FAIL |
| V-CMP-05 | 高风险上线闸门：`risk_level=高` 且 `residual_downgraded=否` → `launch_gate` 必须为"禁止上线"（评估中亦不得置"待评审"规避）；本样本 PIPIA-2026-004/009/012 三条命中 | 数据列机检（workflow acceptance 原文"高风险 residual 未降级不得上线"） |
| V-CMP-06 | 结论完整性：`assessment_status=已出结论` 时 `assessed_at` 非空且 `approval_dual=主管✓/DPO✓`；`launch_gate=可上线` 的行必须已出结论 | 状态 × 字段交叉机检（本样本 9 条可上线全部合规） |
| V-CMP-07 | 状态枚举与迁移合法：三项状态机取值必须在 §4 词表内；禁止跳级（待处理→已闭环、待评→已出结论、待整改→不变更直接关闭）；状态变更只经唯一函数并写操作日志 | 枚举机检 + 操作日志回放 |
| V-CMP-08 | 风险事件闭环：`risk_status=已闭环` 需 `mitigation` 非空且降级验证通过（`是`/`不适用`）；`处理中/待处理` 行 `owner` 必填；`已闭环` 为终态 only-append | 数据列交叉机检 |
| V-CMP-09 | 留痕覆盖率：`cmp.audit-trail` 的 `coverage_pct ≥95%`，未达标必须在 `gaps` 列明并上报；读/算/写全量 append-only 审计可回放 | audit/n5 + 轨迹回放（F5） |
| V-CMP-10 | 培训上报：`cmp.training-check` 必修未完成率 >5% 必须上报管理层（本样本 CHK-2026-014 = 6.2% 已登记为待整改） | 产物 rate 字段与台账交叉机检 |
| V-CMP-11 | 报送提醒：`cmp.reg-filing` 中 `days_left ≤ 7` 的条目必须置顶且列入提醒 | 产物排序断言 |
| V-CMP-12 | 脱敏与边界：`audit_working_papers` 命中 `redact_gate`；产物/报告中不得出现姓名、工号（正则 `E\d+`）、手机号、身份证号；`reviewer_masked` 不得还原；员工角色不可读本域台账（§7.3） | redact_gate 命中日志 + 正则扫描；命中即一票否决 |
| V-CMP-13 | 数据一致性（015 §15.4）：本文件 §1/§1.1 的文件名、行数（20/14）、字段须与 templates/workspace/data/cmp/*.csv 逐表一致；xlsx/csv 做同名归一化匹配 | `scripts/data-consistency-check.mjs` |

---

## §10 特殊约束

1. **证据链五级不可缺级**（scene 尾注原文）：Requirement→Implementation→Test→Evidence→Release。`cmp.evidence-pack` 的 `evidence_items` 必须按五级组织，缺任一环不得出包（V-CMP-04）；证据包 append-only，**打包后不可增删**（acceptance 原文）。
2. **高风险 residual 未降级不得上线**（cmp.pipia-review acceptance 原文）：`launch_gate=禁止上线` 是硬闸门，双审批通过也不放行；须先完成缓释、验证降级、重新出结论（§5、V-CMP-05）。
3. **报告类验收阈值**：留痕覆盖率 ≥95%（audit-trail）、必修未完成 >5% 上报（training-check）、7 天内到期置顶（reg-filing）。三者均为产物级断言，未达标不得标"通过"。
4. **脱敏与数据边界**：`audit_working_papers` 出域前必过 `redact_gate`；人员一律 `E<n>***`、组织一律 `DEPT-***` 或合成部门名；`policy_checklist.finding` 只写制度/系统/流程事实，禁写个人可识别信息；employee 角色不可见本域数据（§7.3）。
5. **记忆层**：`pii_allowed=false`、`exclude=[]` —— 本域 PII 与底稿口径一律禁入记忆层，产物只落 `reports/cmp/`；`seeds/cmp` 仅注入实体/关系/建图规则（Policy / Requirement / Evidence / Audit 与 IMPLEMENTS / EVIDENCED_BY / AUDITED_IN），不含个体属性。
6. **命名差异登记（不擅自改 manifest）**：① scene `workflows` 指向 `workflows/cmp.policy-report.yaml`，而 `index.json` 的 `domain==="cmp"` 清单里是同族的 `cmp.policy-review@1.0.0`（触发命令 `policy-review`），两者命名与触发词不一致；② scene `knowledge_seeds` 声明 `seeds/cmp/README.md`，落地种子为 `templates/knowledge/seeds/cmp.md`；③ `cmp.training-check` / `cmp.reg-filing` 的技能绑定与字面语义不完全贴合（§2）。三处均属声明侧与实物侧差异，需在 manifest 侧修复时统一，本页只登记。
7. **数据口径修正登记（本页 + 数据侧，非 manifest 改动）**：① `review_date` 语义由"计划复查日"修正为"本次检查实施日/发现日"（原 2026-10-30、2026-11-15 两个未来日期改为 2026-09-20、2026-09-22），使整改时限可机检（V-CMP-03）；② 原 `status=进行中` 的"PIPIA 年度评估"修正为 `待整改`，对齐参照 CHECK_STATUS 三值枚举（§3.3）；③ 既有 5 个原生列与 4 条原始行其余取值逐字保留，仅追加列（追加列已逐条写入 §1.1）。
8. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `cmp` 段仍是 `policy_checklist` 4 行 + `pipia` 3 行（5 列窄表头）的旧快照；**重跑该脚本会覆盖本页已补齐的两张表**。本域数据的权威版本以本页 §1/§1.1 为准，重跑生成器后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
9. **未采纳的参照点（及原因）**：
   - 参照 §3.2.24 的 `risks`（风险事件）独立实体表：本域仅 2 张落地表，风险事件生命周期以 `pipia.risk_status` 承载（PIPIA 台账即风险台账），不另立第三张表；如后续扩表，须同步 scene `data_assets`。
   - 参照 §3.2.24 的 `audits`（合规审计：title/scope/result/date）独立实体：审计信息收敛为 `evidence_ref`（EVP 编号）+ `cmp.audit-trail` 覆盖率产物，不单独落地审计台账。
   - 参照 §3.2.24 的责任人字段（曾清/梁钰琦/刘本颖等个人）：本域只落部门名或角色名 + `E<n>***` 掩码，**不落真实人名**（与 er-eap 掩码纪律一致）。
   - 参照 §5.3 的 employee 自助可见范围：合规域数据**不设员工自助视图**（§7.3），employee 对本域全部不可见。
   - 参照 §7.1 的风险项建议规模 10：本落地 14 条（≥12 行校验下限，且需覆盖待评/评估中/已出结论三状态与 3 条禁止上线样例）；合规项 20 条与参照一致。
10. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需合规行业化（如金融/医疗专项合规包），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。

（数据合规声明：本域两张 CSV 全为合成数据，人员仅以掩码 `E<n>***` 出现，组织仅以脱敏码或合成部门名出现，处理活动与法条引用均为人造样例，不映射任何真实主体。）
