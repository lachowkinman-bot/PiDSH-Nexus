# 福利 BEN · 工作模块与闭环设计

- 北极星：员工满意度、使用率与人均成本
- 战略贡献：KR-TALENT、KR-CAPABILITY
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、WORLDATWORK-TOTAL-REWARDS、HR-OPEN、EAPA

## 外部标杆

| ID | 标准/项目 | 状态 | 采纳模式 |
|---|---|---|---|
| [BPMN20](https://www.omg.org/spec/BPMN/2.0/) | OMG BPMN 2.0 | verified | 流程节点、网关、事件、人工任务和审计任务统一显式建模 |
| [JSONSCHEMA202012](https://json-schema.org/specification) | JSON Schema 2020-12 | verified | 输入、LLM 输出、审批记录和交付清单使用可验证 JSON Schema |
| [OPENAPI321](https://spec.openapis.org/oas/latest.html) | OpenAPI Specification 3.2.1 | verified | 工作流平台 API 使用语言无关的接口和消息模型描述 |
| [TABLESCHEMA1](https://specs.frictionlessdata.io/table-schema/) | Frictionless Table Schema v1 | verified | CSV 字段名、标题、类型、格式、缺失值、主键、外键和约束进入 TypeDict |
| [OPENLINEAGE153](https://openlineage.io/docs/spec/object-model/) | OpenLineage 1.53 Object Model | verified | Job、Run、Input Dataset、Output Dataset、运行状态和设计血缘统一留痕 |
| [GREATEXPECTATIONS](https://github.com/great-expectations/great_expectations) | Great Expectations | verified | 把数据质量规则设计为可重复执行、可生成文档的 Expectations |
| [NIST-PRIVACY](https://www.nist.gov/privacy-framework) | NIST Privacy Framework | verified | 个人数据处理以识别、治理、控制、沟通和保护为主线进行风险管理 |
| [NIST-AI-RMF](https://www.nist.gov/itl/ai-risk-management-framework) | NIST AI Risk Management Framework | verified | LLM 环节包含 Govern、Map、Measure、Manage，记录风险、信心、验证和人审 |
| [WORLDATWORK-TOTAL-REWARDS](https://www.worldatwork.org/) | WorldatWork Total Rewards | verified | 薪酬、福利、幸福感和认可作为组合管理，并与留才、绩效和成本联动 |
| [HR-OPEN](https://www.hropenstandards.org/) | HR Open Standards | verified | 人才、岗位、技能、雇佣和 HR 数据交换使用标准词汇与可互操作结构 |
| [EAPA](https://www.eapassn.org/) | Employee Assistance Professionals Association | reference-only | 员工援助以保密、自愿、临床适当转介和组织支持为原则 |

## 福利策略与方案设计

用成本、满意度和风险选择福利方案

### 福利方案比选

- 工作流：`ben.vendor-compare@1.0.0`
- 责任角色：福利负责人
- 频率：年度/按项目
- 结果：成本、覆盖、满意度和供应商风险可比较
- 输入契约：`manifests/workflow-contracts/ben.json#ben.vendor-compare@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.vendor-compare@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：健康数据 L4 禁入记忆层

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 category、vendors、points、winner 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 健康数据 L4 禁入记忆层；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 plan-compare 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：健康数据 L4 禁入记忆层；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-vendor-compare-INPUT-REQUIRED` | invariant | all_required(category,vendors,points,winner) | active |
| `ben-vendor-compare-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-vendor-compare-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-vendor-compare-DOMAIN-RULE` | domain_rule | 健康数据 L4 禁入记忆层 | active |
| `ben-vendor-compare-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-vendor-compare-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-vendor-compare-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-vendor-compare-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-vendor-compare-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `ben-vendor-compare-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `ben-vendor-compare-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-vendor-compare-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-vendor-compare-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-vendor-compare-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-vendor-compare-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-vendor-compare-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-vendor-compare-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-vendor-compare-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-vendor-compare-ACCEPT-1` | policy_threshold | 健康数据 L4 禁入记忆层 | draft_requires_owner_confirmation |




### 年度福利满意度调查

- 工作流：`ben.annual-survey@1.0.0`
- 责任角色：福利运营
- 频率：年度
- 结果：聚合问卷、开放题脱敏并形成改进行动
- 输入契约：`manifests/workflow-contracts/ben.json#ben.annual-survey@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.annual-survey@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：开放题经脱敏聚合

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dimension、score、n、verbatim_theme 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 开放题经脱敏聚合；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 flex-benefit 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：开放题经脱敏聚合；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-annual-survey-INPUT-REQUIRED` | invariant | all_required(dimension,score,n,verbatim_theme) | active |
| `ben-annual-survey-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-annual-survey-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-annual-survey-DOMAIN-RULE` | domain_rule | 开放题经脱敏聚合 | active |
| `ben-annual-survey-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-annual-survey-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-annual-survey-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-annual-survey-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-annual-survey-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `ben-annual-survey-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-annual-survey-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-annual-survey-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-annual-survey-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-annual-survey-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-annual-survey-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-annual-survey-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-annual-survey-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-annual-survey-ACCEPT-1` | domain_rule | 开放题经脱敏聚合 | active |




## 参保与弹性福利

让参保、积分和资格规则透明可执行

### 方案投保/变更审批

- 工作流：`ben.plan-enroll@1.0.0`
- 责任角色：福利负责人
- 频率：按参保事件
- 结果：资格、生效日、费用和家属信息合规
- 输入契约：`manifests/workflow-contracts/ben.json#ben.plan-enroll@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.plan-enroll@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：家属信息仅掩码

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、plan、effective_date、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 家属信息仅掩码；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 plan-compare 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：家属信息仅掩码；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-plan-enroll-INPUT-REQUIRED` | invariant | all_required(employee_masked,plan,effective_date,approver) | active |
| `ben-plan-enroll-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-plan-enroll-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-plan-enroll-DOMAIN-RULE` | domain_rule | 家属信息仅掩码 | active |
| `ben-plan-enroll-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-plan-enroll-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-plan-enroll-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-plan-enroll-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-plan-enroll-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `ben-plan-enroll-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `ben-plan-enroll-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-plan-enroll-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-plan-enroll-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-plan-enroll-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-plan-enroll-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-plan-enroll-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-plan-enroll-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-plan-enroll-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-plan-enroll-ACCEPT-1` | domain_rule | 家属信息仅掩码 | active |




### 弹性积分测算

- 工作流：`ben.points-calc@1.0.0`
- 责任角色：福利运营
- 频率：月度/年度
- 结果：额度、使用和余额守恒
- 输入契约：`manifests/workflow-contracts/ben.json#ben.points-calc@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.points-calc@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：剩余分可为负拦截

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、points_total、selected、remaining 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 剩余分可为负拦截；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 flex-benefit 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：剩余分可为负拦截；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-points-calc-INPUT-REQUIRED` | invariant | all_required(employee_masked,points_total,selected,remaining) | active |
| `ben-points-calc-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-points-calc-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-points-calc-DOMAIN-RULE` | domain_rule | 剩余分可为负拦截 | active |
| `ben-points-calc-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-points-calc-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-points-calc-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-points-calc-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-points-calc-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `ben-points-calc-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-points-calc-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-points-calc-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-points-calc-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-points-calc-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-points-calc-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-points-calc-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-points-calc-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-points-calc-ACCEPT-1` | domain_rule | 剩余分可为负拦截 | active |




## 理赔与健康聚合

让理赔服务和健康数据在隐私边界内闭环

### 体检聚合报告

- 工作流：`ben.checkup-report@1.0.0`
- 责任角色：福利/健康负责人
- 频率：年度
- 结果：只出分布、n<5 抑制、无个体健康原值
- 输入契约：`manifests/workflow-contracts/ben.json#ben.checkup-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.checkup-report@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：个体健康指标不出原值，仅建议

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、abnormal_items、followup、year 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 个体健康指标不出原值，仅建议；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 checkup-report 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：个体健康指标不出原值，仅建议；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-checkup-report-INPUT-REQUIRED` | invariant | all_required(employee_masked,abnormal_items,followup,year) | active |
| `ben-checkup-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-checkup-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-checkup-report-DOMAIN-RULE` | domain_rule | 个体健康指标不出原值，仅建议 | active |
| `ben-checkup-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-checkup-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-checkup-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-checkup-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-checkup-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `ben-checkup-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-checkup-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-checkup-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-checkup-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-checkup-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-checkup-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-checkup-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-checkup-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-checkup-report-ACCEPT-1` | domain_rule | 个体健康指标不出原值，仅建议 | active |




### 理赔协办周报

- 工作流：`ben.claim-review@1.0.0`
- 责任角色：福利运营
- 频率：每周
- 结果：时效、结案和金额区间可控
- 输入契约：`manifests/workflow-contracts/ben.json#ben.claim-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/ben.json#ben.claim-review@1.0.0/output`
- TypeDict：`manifests/typedict/ben.json`
- 验收：理赔金额仅区间

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 claim_masked、type、days、status 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 理赔金额仅区间；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 health_data、insurance_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 checkup-report 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：理赔金额仅区间；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“员工满意度、使用率与人均成本”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `ben-claim-review-INPUT-REQUIRED` | invariant | all_required(claim_masked,type,days,status) | active |
| `ben-claim-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `ben-claim-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `ben-claim-review-DOMAIN-RULE` | domain_rule | 理赔金额仅区间 | active |
| `ben-claim-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `ben-claim-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `ben-claim-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `ben-claim-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `ben-claim-review-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `ben-claim-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `ben-claim-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `ben-claim-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `ben-claim-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `ben-claim-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `ben-claim-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `ben-claim-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `ben-claim-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `ben-claim-review-ACCEPT-1` | domain_rule | 理赔金额仅区间 | active |




## 字段 TypeDict

- 字段数：61
- 契约数：6
