# Preset 设计文档 · 员工关系管理（含 EAP）（er-eap）

> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）。
> 本域为最高敏域：`er.offboarding@1.0.0` 与 `eap.referral@1.0.0` 两个 Scene 共用 er-eap 数据域（`skills`/`policies` 完全一致，差异仅在 Scene 绑定与 GT 入口）；EAP 按 015 §8.4 **L4+ 特例**执行。
> 数据快照基准日 **2026-09-30**（所有"≤60 天"判定以此为基准）。全部为合成数据，不含真实个人信息；EAP 表全表匿名。

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| er_cases.csv | L4 | disciplinary_detail | 13 | 员工关系案件台账（纪律/争议/离职交接/绩效申诉/合同续签）。落地路径 `templates/workspace/data/er-eap/er_cases.csv`；人员列 `employee_masked` 为掩码口径（E1***），`owner` 为角色名（HRBP/HR专员/合规部） |
| eap_referrals.csv | L4+ | eap_content, health_mental | 16 | EAP 转介匿名台账。落地路径 `templates/workspace/data/er-eap/eap_referrals.csv`；仅匿名编号 `EAP-ANON-*`，敏感文本一律类别标签。L4+ = L4 级别叠加 §8.4 附加约束（禁网/禁记忆/独立命名空间） |

**Scene 声明 → 落地文件的同名归一化**（供 `scripts/data-consistency-check.mjs` 校验）：

- `er.offboarding@1.0.0` → data_assets `cases.xlsx`（L4，pii `disciplinary_detail`）→ **落地 `er_cases.csv`**
- `eap.referral@1.0.0` → data_assets `eap-cases.xlsx`（L4，pii `eap_content` / `health_mental`）→ **落地 `eap_referrals.csv`**
- `xlsx` 仅为 Scene 规格层命名；工作台事实表为 CSV（UTF-8、表头英文小写下划线、逗号分隔）。行数为数据行（不含表头），与校验脚本口径一致。

## §1.1 字段级数据字典

### er_cases.csv（13 行；表头 14 列，逐字：`case_id,case_type,stage,owner,note,employee_masked,dept_masked,employee_status,case_date,contract_status,contract_end_date,dispute_status,offboard_node,asset_release_status`）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| case_id | string | 是 | 案件编号，主键，形如 ER-XXXX；编号不复用 |
| case_type | enum | 是 | 案件类型：绩效申诉 / 团队争议 / 违纪调查 / 劳动争议 / 离职交接 / 合同续签 |
| stage | enum | 是 | 台账处理阶段（案件维度）：调查中 / 调解中 / 协商中 / 审批中 / HR 面谈 / 仲裁 / 诉讼 / 已完成 / 已结案 |
| owner | enum | 是 | 归口责任角色（非个人标识）：HRBP / HR专员 / 合规部 |
| note | string | 是 | 处理备注（自由文本，属 disciplinary_detail 受控口径；输出前必过 redact_gate） |
| employee_masked | string | 是 | 当事人掩码标识 `E<序号>***`（不得回填工号/姓名/手机号） |
| dept_masked | string | 是 | 归属组织（部门/分支机构粒度，不构成个人可回溯信息） |
| employee_status | enum | 是 | 员工状态：在职 / 离职（离职流程完成后置"离职"，对应参照 EMP_STATUS active/left） |
| case_date | date | 是 | 案件登记日 YYYY-MM-DD |
| contract_status | enum | 是 | 合同状态：履行中 / 即将到期 / 已续签 / 已终止（见 §4.2） |
| contract_end_date | date | 是 | 合同到期日 YYYY-MM-DD（用于"≤60 天"自动判定） |
| dispute_status | enum | 否 | 劳动争议法定阶段：协商中 / 仲裁 / 诉讼 / 已结案；仅 `case_type=劳动争议` 填写，其余记 `—`（见 §4.1） |
| offboard_node | enum | 否 | 离职流程当前节点：提交辞职申请 / 直属上级确认 / HR 面谈 / 工作交接 / 资产与权限回收 / 结算与离职证明；未进入离职流程记 `—` |
| asset_release_status | enum | 是 | 名下资产释放状态：不涉及 / 待释放 / 已释放（离职完成联动 ADMIN 域置"已释放"） |

### eap_referrals.csv（16 行；表头 10 列，逐字：`anon_id,direction,status,approvals,sessions_left,approval_supervisor,approval_specialist,sessions_used,referral_month,status_date`）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| anon_id | string | 是 | 匿名转介编号，主键，形如 `EAP-ANON-XXXX`；与真实身份的映射表分离存放于 EAP 独立命名空间，工作台内不可反查 |
| direction | enum | 是 | 转介方向（**类别标签**，禁写内容/机构实名/人名）：心理咨询(外部机构) / 心理咨询(内部) / 法律援助(劳动咨询) / 危机干预 / 健康管理(外部机构) / 家庭与照护(外部机构) / 职业发展咨询(内部) |
| status | enum | 是 | 转介状态：待双审批 / 进行中 / 已结案 / 已驳回（见 §4.3） |
| approvals | string | 是 | 双审批展示口径：`主管✓/专员✓`（已通过）、`主管待/专员待`（待审批）、`主管✓/专员✗`（已驳回） |
| sessions_left | int | 是 | 剩余会话额度（≥0）；待双审批行未核销，通过后方可使用 |
| approval_supervisor | enum | 是 | 主管侧审批机读值：已通过 / 待审批 / 已驳回（`approvals` 的拆分列，供门禁机检） |
| approval_specialist | enum | 是 | EAP 专员侧审批机读值：已通过 / 待审批 / 已驳回 |
| sessions_used | int | 是 | 已消耗会话次数（≥0）；`status=待双审批/已驳回` 时必须为 0（见 §9 R2） |
| referral_month | string | 是 | 转介受理月份 YYYY-MM（供匿名月报聚合，不落具体日） |
| status_date | date | 是 | 当前状态更新日 YYYY-MM-DD（状态迁移留痕） |

## §2 技能规格

| 技能 | 绑定工作流 | 用途 | 输入 | 输出 | 权限 | 质量检查与门禁 |
|---|---|---|---|---|---|---|
| offboarding-flow | er-eap.offboard-approve、er-eap.exit-interview | 离职流程推进与离职面谈纪要结构化（脱敏） | data/er-eap/er_cases.csv + 离职流程上下文 | `offboard-approve-<ts>.json`、`exit-interview-<ts>.json` | L4 | 交接未完成不得进入最后一步；敏感表述经脱敏；产物与审批单一致，否则 rollback |
| dispute-ops | er-eap.dispute-case | 争议处理台账（阶段/证据）与材料准备 | data/er-eap/er_cases.csv | `dispute-case-<ts>.json`（case_id/type/stage/evidence_refs） | L4 | 证据引用必须指向 CMP 域 evidence-pack；仅登记阶段与证据，不作法律结论 |
| eap-referral | er-eap.eap-referral、er-eap.anon-report、er-eap.wellbeing-check | EAP 匿名化转介建议（仅到建议为止）与匿名聚合口径 | data/er-eap/eap_referrals.csv（**禁止与 er_cases.csv 拼装**，两表无匿名主键） | `eap-referral-<ts>.json`、`anon-report-<ts>.json`、`wellbeing-check-<ts>.json` | L4+（禁网） | 输出仅匿名编号；双审批齐备方可推进；禁入记忆层；聚合 n<5 不出分 |

**技能绑定纪律（015 §15.4）**：GT 落账时比对"实际执行技能 vs Scene 声明技能"，不一致即 FAIL（2.0 曾出现 EAP 任务误跑 dispute-ops）。**EAP 相关 GT（GT-EAP-01，及任何触碰 eap_referrals.csv / `eap_content` / `health_mental` 的任务）必须由 `eap-referral` 执行，禁止用 `dispute-ops` 顶替**；`dispute-ops` 仅服务 er-eap.dispute-case。三个技能均须落在 Scene 的 `skills` 声明内（offboarding-flow / dispute-ops / eap-referral），不得新增域外技能顶岗。

## §3 工作流

### 3.1 域内工作流（`manifests/workflows/index.json` 中 `domain === "er-eap"` 的全部 6 条）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| er-eap.offboard-approve@1.0.0 | 处分/离职决定生效前（node n3） | `offboard-approve-<ts>.json`；字段 employee_masked / last_day / handover_ok / approvals；验收：交接未完成不得进入最后一步 | kind=approve；技能 offboarding-flow；L4 双审批；hitl_nodes=[n3]；rollback=savepoint `pre-offboard-approve`；审计"审批人 + 依据数据版本 + 产物哈希" |
| er-eap.eap-referral@1.0.0 | 转介建议发出前（node n3） | `eap-referral-<ts>.json`；字段 anon_id / direction / approvals / sessions；验收：输出仅匿名编号；禁网；禁入记忆层 | kind=approve；技能 eap-referral；L4 双审批；hitl_nodes=[n3]；rollback=savepoint `pre-eap-referral`；同节点 n5 审计 |
| er-eap.dispute-case@1.0.0 | 无审批节点（kind=report） | `dispute-case-<ts>.json`；字段 case_id / type / stage / evidence_refs；验收：证据引用指向 evidence-pack | 技能 dispute-ops；hitl_nodes 为空；字段映射 er_cases.csv（case_id/case_type/stage/dispute_status） |
| er-eap.exit-interview@1.0.0 | 无审批节点（kind=report） | `exit-interview-<ts>.json`；字段 employee_masked / reasons / improvements / rehire_flag；验收：敏感表述经脱敏 | 技能 offboarding-flow；面谈原文不落交付物，只落结构化脱敏结论 |
| er-eap.anon-report@1.0.0 | 无审批节点（kind=report） | `anon-report-<ts>.json`；字段 month / total_referrals / by_direction / sessions；验收：仅聚合数字，无任何个体字段 | 技能 eap-referral；by_direction 仅 n≥5 的分组出分（§9 R4） |
| er-eap.wellbeing-check@1.0.0 | 无审批节点（kind=calc） | `wellbeing-check-<ts>.json`；字段 dimension / score / n / trend；验收：n<5 不出分（防反推） | 技能 eap-referral；先算 n，n<5 的分维度记 suppressed 不出分 |

### 3.2 Scene 绑定（Scene YAML `workflows` 字段指向的绑定文件，审批准入同 3.1）

| Scene | 绑定文件 | workflow_id / 触发命令 | 审批落点 | 说明 |
|---|---|---|---|---|
| er.offboarding@1.0.0 | workflows/er.offboard-approve.yaml | er.offboard-approve@1.0.0；`offboard-approve` | 处分/离职决定生效前（n3，L4 dual） | 审计记录"离职流程多级审批 + 审批人 + 依据数据版本"；check：产物与审批单一致，on_fail=rollback |
| eap.referral@1.0.0 | workflows/eap.referral-approve.yaml | eap.referral-approve@1.0.0；`referral-approve` | 转介建议发出前（n3，L4 dual） | 审计记录"EAP 转介双审批+匿名化 + 审批人 + 依据数据版本"；与 er-eap.eap-referral 同技能、同审批落点 |

两个 Scene 的 `required_capabilities`（cap.excel.panel / cap.approval.multi / cap.redact.all）与 `policies` 完全一致；三个 Golden Task 的 `expected_tools` 同为 `cap.excel.panel` + `cap.approval.multi`。

## §4 状态机

### 4.1 劳动争议（dispute_status；中文值 ↔ 参照 DISPUTE_STATUS）

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 协商中（negotiate） | 协商/调解不成，转入仲裁 | 仲裁（arbitrate） | dispute_status 与 stage 同步更新 |
| 协商中 | 达成和解并按约履行 | 已结案（closed） | 不得越级直达"诉讼" |
| 仲裁 | 对裁决不服，进入诉讼 | 诉讼（lawsuit） | 需登记外部文书/受理信息 |
| 仲裁 | 裁决生效并按约履行 | 已结案 | 结案需归档说明 |
| 诉讼 | 判决/调解生效 | 已结案 | — |
| 已结案 | —（终态） | 已结案 | 终态不得回退；变更只可新增行（append-only） |

本域样本：协商中 2（ER-1205、ER-1211）、仲裁 1（ER-1206）、诉讼 1（ER-1207）、已结案 1（ER-1208），劳动争议共 n=5。

### 4.2 劳动合同（contract_status；中文值 ↔ 参照 CONTRACT_STATUS）

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 履行中（active） | 快照基准日与 contract_end_date 差值 ≤60 天（系统自动） | 即将到期（expiring） | contract_end_date + 基准日 2026-09-30 |
| 履行中 | 离职流程完成（决定生效） | 已终止（terminated） | employee_status=离职 + offboard_node=结算与离职证明 |
| 即将到期 | 完成续签并登记新到期日 | 已续签（renewed） | 续签次数按参照 contracts.renew 登记 |
| 即将到期 | 到期未续签，或离职/解除生效 | 已终止 | — |
| 已续签 | 新一轮到期前 60 天 | 即将到期 | 循环预警 |
| 已终止 | —（终态） | 已终止 | 终态为 append-only；参照保留值"已解除（cancelled）"本域样本未使用，解除类事件先走 offboard-approve 双审批再登记 |

本域样本：履行中 7、即将到期 2（ER-1206 到期 2026-10-31 距基准日 31 天；ER-1212 到期 2026-11-20 距 51 天）、已续签 2（ER-1208、ER-1210）、已终止 2（ER-1207、ER-1209）。

### 4.3 EAP 转介（status）

| 当前状态 | 触发条件 | 迁移到 | 证据/规则 |
|---|---|---|---|
| 待双审批 | 主管与专员双审批均=已通过 | 进行中 | approval_supervisor=approval_specialist=已通过；此前 sessions_used 必须为 0 |
| 待双审批 | 任一审批=已驳回 | 已驳回（终态） | approval_* 记"已驳回"；sessions_used=0，转介不得启动服务 |
| 进行中 | 服务完成/结案评估通过 | 已结案（终态） | 更新 status_date；sessions_left 结清 |
| 进行中 | — | 进行中（核心路径：进行中 → 已结案） | 每次迁移只更新 status/status_date，历史走 append-only 留痕 |

本域样本：待双审批 2（EAP-ANON-0734、EAP-ANON-0752）、进行中 6、已结案 7、已驳回 1（EAP-ANON-0755）。

## §5 审批链

Scene `policies.permission.dual_approval=true` 为**域级声明**：任何触发生效/对外动作的节点必须落到 L4 + 双审批；`condition` 的 then 分支禁止绕过审批直连外部写能力（015 §8.2）。

| 业务动作 | 工作流（Scene 绑定） | 节点 | 审批落点 | 审批角色（基线建议，两角色须为不同审批人） | 是否双审批 |
|---|---|---|---|---|---|
| 离职 / 处分决定生效 | er-eap.offboard-approve（绑定 workflows/er.offboard-approve.yaml） | n3 | 处分/离职决定生效前 | 甲：HR 负责人（HRD）；乙：员工关系归口负责人（HRBP / 合规负责人） | 是（dual=true，L4） |
| EAP 转介建议发出 | er-eap.eap-referral（绑定 workflows/eap.referral-approve.yaml） | n3 | 转介建议发出前 | 甲：EAP 归口主管；乙：EAP 专员（对应数据列 approval_supervisor / approval_specialist） | 是（dual=true，L4） |
| 争议台账登记（阶段/证据） | er-eap.dispute-case | 无审批节点（kind=report） | — | — | 否；涉证据对外或解除类动作时分别转 CMP cmp.evidence-pack 或本域 offboard 双审批 |

审批记录统一落 `audit/n5`：审批人 + 依据数据版本 + 产物哈希；`check` 判据"产物与审批单一致"，`on_fail=rollback`（savepoint：`pre-offboard-approve` / `pre-eap-referral`）。

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

| 触发 | 联动副作用 | 证据字段（落点） | 目标域/组件 |
|---|---|---|---|
| 离职流程 6 节点完成且 n3 双审批通过 | 员工主数据置"离职"并写离职日 | er_cases.csv：employee_status=离职、offboard_node=结算与离职证明 | 员工主数据（组织人事/REC） |
| 同上 | 名下资产释放（置闲置、清使用人） | er_cases.csv：asset_release_status=已释放 | ADMIN（assets / asset-inventory） |
| 同上 | 劳动合同置"已终止" | er_cases.csv：contract_status=已终止、contract_end_date | 合同台账（ER） |
| 同上 | 离职面谈纪要结构化且脱敏，原文不入交付物 | exit-interview-`<ts>`.json：employee_masked / reasons / improvements / rehire_flag | ER（本域） |
| 同上（可后置） | 当月考勤/薪酬核算截止 | offboard_node 完成时间 + 审批单 | 考勤 / COMP |
| EAP 转介建议发出（双审批通过） | 输出仅匿名编号；匿名池与真实身份映射分离存放 | eap_referrals.csv：anon_id、direction；eap-referral-`<ts>`.json | EAP 独立命名空间 workspace/eap/ |
| EAP 任意数据落入工作台 | 免入记忆层：pii_allowed=false，exclude=[graph-memory, pi-hermes-memory] | Scene `policies.memory` + 读/算/写审计事件 | 记忆层（graph-memory / pi-hermes-memory） |
| EAP 匿名月报 / 组织健康度脉搏 | by_direction / 分维度 n<5 不出分（防反推） | anon-report：by_direction；wellbeing-check：n | 报表（本域） |
| 争议进入仲裁/诉讼或结案 | 证据引用指向 evidence-pack（append-only 对齐） | dispute-case-`<ts>`.json：evidence_refs | CMP（evidence-pack） |
| 任一触及生效/对外动作 | 一律回到 L4 双审批，审计绑定数据版本 | 审批记录 + 数据版本 + 产物哈希 | Permission Gateway |

## §7 权限矩阵

### 7.1 策略层（与两个 Scene 的 `policies` 逐字一致）

| 项 | 值 | 来源 |
|---|---|---|
| 最低数据级别 | L4（EAP 记 L4+：L4 叠加禁网/禁记忆/独立命名空间） | Scene `permission.min_level=L4`；015 §8.4 |
| 双审批 | true（域级，不可按任务关闭） | Scene `permission.dual_approval=true` |
| 必装能力位 | cap.excel.panel、cap.approval.multi、cap.redact.all | Scene `required_capabilities` |
| 脱敏字段（redact_gate） | disciplinary_detail、eap_content、health_mental | Scene `redact.fields`；`gate=redact_gate` |
| 记忆层 | pii_allowed=false；exclude=[graph-memory, pi-hermes-memory] | Scene `policies.memory` |
| 网络 | 禁公网（EAP 网络策略 deny） | 015 §8.4 |
| 命名空间 | workspace/eap/（卸载可逆 C5） | 015 §8.4 |
| 留痕 | 读/算/写审计事件 + 双审批记录（append-only） | GT `expected_audit`；015 §8.4 |

### 7.2 操作 × 约束

| 操作 | 最低级别 | 双审批 | 脱敏 | 记忆层 | 网络 |
|---|---|---|---|---|---|
| 读取 er_cases.csv / eap_referrals.csv | L4（EAP L4+） | 否（只读） | 命中受控字段即过 redact_gate | 禁写入 | 禁 |
| Excel 面板计算 | L4 | 否 | 同上 | 禁写入 | 禁 |
| 写产物/交付物 | L4 | 触及生效/对外动作时必须 | 输出仅掩码（er_cases）/匿名编号（EAP） | 禁写入 | 禁 |
| 离职/处分决定生效 | L4 | 是（n3） | 面谈/处分类字段脱敏 | 禁写入 | 禁 |
| EAP 转介建议发出 | L4 | 是（n3） | 仅匿名编号（`EAP-ANON-*`） | 禁写入 | 禁 |
| 争议台账登记 | L4 | 否（report；证据对外转 CMP 双审批） | 只引用证据不复制原文 | 禁写入 | 禁 |

## §8 Golden Tasks（八元组见 Scene YAML；`expected_plan` 指向本节"任务分解"）

| GT | 输入 | 执行技能（强制） | 工具 | 权限 | 交付物 | 期望文件 | 审计 | 质量 |
|---|---|---|---|---|---|---|---|---|
| GT-ER-01 | 生成分支机构裁撤的员工关系风险清单 | offboarding-flow（er-eap.offboard-approve） | cap.excel.panel、cap.approval.multi | L4+双审批 | reports/er-eap/gt-01.md | data/er-eap/er_cases.csv（Scene 声明 data/er-eap/cases.xlsx） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |
| GT-ER-02 | 离职面谈纪要结构化（脱敏） | offboarding-flow（er-eap.exit-interview） | cap.excel.panel、cap.approval.multi | L4+双审批 | reports/er-eap/gt-02.md | data/er-eap/er_cases.csv（Scene 声明 data/er-eap/cases.xlsx） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |
| GT-EAP-01 | 匿名化 EAP 转介建议（双审批+禁网） | **eap-referral（er-eap.eap-referral；禁止 dispute-ops 顶替）** | cap.excel.panel、cap.approval.multi | L4+双审批 | reports/er-eap/gt-03.md | data/er-eap/eap_referrals.csv（Scene 声明 data/er-eap/eap-cases.xlsx） | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |

**任务分解**

1. **GT-ER-01**：① 以 er_cases.csv 全 13 行为口径，筛出 dept_masked ∈ {分支机构A, 分支机构B, 分支机构C} 的 3 行（ER-1202 在办交接、ER-1206 仲裁且合同即将到期、ER-1209 已完成离职）；② 逐行核对 employee_status / contract_status / asset_release_status 与 offboard_node，标出阻断项（交接未完成、资产待释放、合同 ≤60 天到期）；③ 出风险清单，每条附 case_id 行级证据与放行建议；④ 引用 note 前先过 redact_gate。
2. **GT-ER-02**：① 以在办离职交接行（ER-1202、ER-1212）为输入；② 结构化 reasons / improvements，仅保留主题标签，不落面谈原文；③ 判定 rehire_flag（存在未结案调查或争议时置 false）；④ 走 er-eap.exit-interview，产物脱敏后写入 reports/er-eap/gt-02.md。
3. **GT-EAP-01**：① 只读 eap_referrals.csv（16 行，仅匿名编号），**禁止与 er_cases.csv 拼装**（两表无匿名主键，拼装即破坏匿名化口径）；② 校验 approval_supervisor / approval_specialist，未双通过的 0734、0752 保持挂起且 sessions_used=0；③ 输出仅含 anon_id / direction / approvals / sessions；④ 全程禁网、禁入记忆层，产物与审批单一致，否则 rollback。

## §9 校验规则

| 编号 | 规则 | 判定/证据 |
|---|---|---|
| R1 | 匿名化：EAP 输入输出仅匿名编号；eap_referrals.csv 不得出现姓名/工号/机构实名/联系方式；direction 仅类别标签 | 机检正则在 EAP 数据与产物上扫描（工号 `E\d+`、11 位手机号、身份证号）；命中即 FAIL |
| R2 | 双审批不可绕过：`status=进行中` 行必须 approval_supervisor=approval_specialist=已通过；`sessions_used>0` 而审批未齐 = FAIL；待双审批/已驳回行 sessions_used 必须为 0；condition 的 then 分支禁止绕 n3 直连 cap.excel.panel.write（015 §8.2） | 数据列 + 审批记录交叉机检 |
| R3 | 禁网：EAP 任务全程公网 deny；出现外部检索/外发调用即 FAIL（离线可用性另见 F7） | 网络策略 + 执行轨迹扫描 |
| R4 | n<5 不出分（防反推）：wellbeing-check 先算 n，n<5 的分维度不出分；anon-report 的 by_direction 仅 n≥5 分组出分（本样本 7 个方向仅"心理咨询(外部机构)" n=5 达标，其余 6 组抑制） | 聚合产物中 n 字段与分组成对校验 |
| R5 | 脱敏字段：disciplinary_detail / eap_content / health_mental 命中 redact_gate；未过 gate 的输出 = 一票否决 | redact_gate 命中日志 |
| R6 | 记忆层：读/算/写全过程不得写 graph-memory / pi-hermes-memory（pii_allowed=false）；写入尝试记 FAIL 事件 | 记忆面板排除名单（F6，EAP 灰显）+ 写入日志 |
| R7 | 命名空间：EAP 产物只落 workspace/eap/ 与 reports/er-eap/；跨域引用只传匿名编号 | 产物路径与字段检查 |
| R8 | 全量留痕：读/算/写审计事件 + 双审批记录（审批人、依据数据版本、产物哈希）append-only，不可改写 | audit/n5 + 轨迹回放（F5） |
| R9 | 溯源：每条结论可下钻到 CSV 行（sheet/row 级证据）；产物与审批单一致，否则 rollback 到 savepoint | check.actual_ref=audit/n5 |
| R10 | 数据一致性（015 §15.4）：本文件 §1/§1.1 的文件名、行数（13/16）、字段须与 templates/workspace/data/er-eap/*.csv 逐表一致；xlsx/csv 做同名归一化匹配 | scripts/data-consistency-check.mjs |

## §10 特殊约束（015 §8.4 五条硬约束 → 可检查条款）

| # | 015 §8.4 约束原文 | 可检查条款（验收判据） |
|---|---|---|
| C1 | 禁联网（网络策略 deny） | EAP 任务的执行轨迹不得出现任何公网请求；断网可用；网络策略对 workspace/eap/ 域置 deny |
| C2 | 禁入记忆层（graph-memory/pi-hermes-memory 排除名单写入 policies.memory.exclude） | `policies.memory.exclude` 必须含 graph-memory、pi-hermes-memory 且 `pii_allowed=false`；UI 记忆与知识面板对 EAP 灰显（F6） |
| C3 | 双审批 + 匿名化（输出仅匿名编号） | 转介建议发出前双审批齐备（两名不同审批人、均达 L4）；输入输出仅 `EAP-ANON-*`；审批单与产物一致（R2/R1） |
| C4 | 独立命名空间（workspace/eap/，卸载可逆 C5） | EAP 数据只落 workspace/eap/；卸载后不影响其它域命名空间；EAP 数据不得写入其它域 |
| C5 | 访问全量留痕（append-only） | 每次读/算/写与审批产生不可修改的追加式审计事件（含审批人、数据版本、产物哈希），只可追加（R8） |

（数据合规声明：本域 CSV 全为合成数据，人物仅以掩码/角色名/匿名编号出现；EAP 表把敏感文本收敛为类别标签，不承载任何真实个人信息。）
