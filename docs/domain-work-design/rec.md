# 招聘 REC · 工作模块与闭环设计

- 北极星：招聘质量、速度与 90 天留存
- 战略贡献：KR-TALENT、KR-CAPABILITY
- 数据级别：L3
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、HR-OPEN、SCHEMA-JOBPOSTING

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
| [HR-OPEN](https://www.hropenstandards.org/) | HR Open Standards | verified | 人才、岗位、技能、雇佣和 HR 数据交换使用标准词汇与可互操作结构 |
| [SCHEMA-JOBPOSTING](https://schema.org/JobPosting) | Schema.org JobPosting | verified | 岗位、地点、雇佣类型、薪酬、福利、技能和申请入口采用公开字段语义 |

## 需求与招聘标准

把战略和组织缺口转成岗位标准与招聘节奏

### JD 与岗位能力模型

- 工作流：`rec.jd-draft@1.0.0`
- 责任角色：招聘负责人/用人经理
- 频率：按岗位需求
- 结果：岗位职责、能力、薪酬带和评价口径一致
- 输入契约：`manifests/workflow-contracts/rec.json#rec.jd-draft@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.jd-draft@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：薪酬带引用 comp.bands；能力项与岗位 KR 对应

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 position、mission、requirements、competencies、band、locale 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 薪酬带引用 comp.bands；能力项与岗位 KR 对应；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 jd-gen 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：薪酬带引用 comp.bands；能力项与岗位 KR 对应；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-jd-draft-INPUT-REQUIRED` | invariant | all_required(position,mission,requirements,competencies,band,locale) | active |
| `rec-jd-draft-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-jd-draft-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-jd-draft-DOMAIN-RULE` | domain_rule | 薪酬带引用 comp.bands；能力项与岗位 KR 对应 | active |
| `rec-jd-draft-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-jd-draft-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-jd-draft-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-jd-draft-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-jd-draft-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `rec-jd-draft-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-jd-draft-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-jd-draft-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-jd-draft-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-jd-draft-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-jd-draft-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-jd-draft-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-jd-draft-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-jd-draft-ACCEPT-1` | domain_rule | 薪酬带引用 comp.bands | active |
| `rec-jd-draft-ACCEPT-2` | domain_rule | 能力项与岗位 KR 对应 | active |




### 招聘漏斗与留存复盘

- 工作流：`rec.funnel-weekly@1.0.0`
- 责任角色：招聘负责人
- 频率：每周/每月
- 结果：按渠道和阶段优化质量、速度与 90 天留存
- 输入契约：`manifests/workflow-contracts/rec.json#rec.funnel-weekly@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.funnel-weekly@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：阶段人数守恒；候选人 PII 仅掩码

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 week、stage、count、conversion_pct、source 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 阶段人数守恒；候选人 PII 仅掩码；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 funnel-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：阶段人数守恒；候选人 PII 仅掩码；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-funnel-weekly-INPUT-REQUIRED` | invariant | all_required(week,stage,count,conversion_pct,source) | active |
| `rec-funnel-weekly-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-funnel-weekly-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-funnel-weekly-DOMAIN-RULE` | domain_rule | 阶段人数守恒；候选人 PII 仅掩码 | active |
| `rec-funnel-weekly-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-funnel-weekly-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-funnel-weekly-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-funnel-weekly-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-funnel-weekly-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `rec-funnel-weekly-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-funnel-weekly-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-funnel-weekly-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-funnel-weekly-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-funnel-weekly-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-funnel-weekly-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-funnel-weekly-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-funnel-weekly-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-funnel-weekly-ACCEPT-1` | domain_rule | 阶段人数守恒 | active |
| `rec-funnel-weekly-ACCEPT-2` | domain_rule | 候选人 PII 仅掩码 | active |




## 筛选与面试运营

用证据完成筛选、邀约和结构化面试

### 简历解析、筛选与外发

- 工作流：`rec.resume-forward@1.0.0`
- 责任角色：招聘专员
- 频率：按候选人批次
- 结果：证据、匹配、脱敏和外发审批完整
- 输入契约：`manifests/workflow-contracts/rec.json#rec.resume-forward@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.resume-forward@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：未脱敏外发 = 一票否决；每项评价必须有证据

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 candidate_masked、position、target、resume_evidence、criteria_results、match_score、redact_fields、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 未脱敏外发 = 一票否决；每项评价必须有证据；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 resume-screening 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：未脱敏外发 = 一票否决；每项评价必须有证据；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-resume-forward-INPUT-REQUIRED` | invariant | all_required(candidate_masked,position,target,resume_evidence,criteria_results,match_score,redact_fields,approver) | active |
| `rec-resume-forward-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-resume-forward-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-resume-forward-DOMAIN-RULE` | domain_rule | 未脱敏外发 = 一票否决；每项评价必须有证据 | active |
| `rec-resume-forward-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-resume-forward-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-resume-forward-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-resume-forward-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-resume-forward-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `rec-resume-forward-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `rec-resume-forward-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-resume-forward-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-resume-forward-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-resume-forward-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-resume-forward-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-resume-forward-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-resume-forward-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-resume-forward-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-resume-forward-ACCEPT-1` | domain_rule | 未脱敏外发 = 一票否决 | active |
| `rec-resume-forward-ACCEPT-2` | domain_rule | 每项评价必须有证据 | active |




### 面试安排、题库与评分卡

- 工作流：`rec.interview-schedule@1.0.0`
- 责任角色：招聘专员/面试官
- 频率：按面试批次
- 结果：能力覆盖、无冲突、评分锚点明确
- 输入契约：`manifests/workflow-contracts/rec.json#rec.interview-schedule@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.interview-schedule@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：面试官冲突须标红；题库覆盖全部能力项

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 candidate_masked、slot、interviewers、mode、question_bank_id、scorecard_id、conflicts 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 面试官冲突须标红；题库覆盖全部能力项；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 interview-design 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：面试官冲突须标红；题库覆盖全部能力项；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-interview-schedule-INPUT-REQUIRED` | invariant | all_required(candidate_masked,slot,interviewers,mode,question_bank_id,scorecard_id,conflicts) | active |
| `rec-interview-schedule-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-interview-schedule-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-interview-schedule-DOMAIN-RULE` | domain_rule | 面试官冲突须标红；题库覆盖全部能力项 | active |
| `rec-interview-schedule-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-interview-schedule-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-interview-schedule-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-interview-schedule-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-interview-schedule-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `rec-interview-schedule-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-interview-schedule-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-interview-schedule-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-interview-schedule-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-interview-schedule-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-interview-schedule-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-interview-schedule-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-interview-schedule-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-interview-schedule-ACCEPT-1` | domain_rule | 面试官冲突须标红 | active |
| `rec-interview-schedule-ACCEPT-2` | domain_rule | 题库覆盖全部能力项 | active |




## 录用、入职与成效

让面试反馈、Offer、入职和成效闭环

### 面试反馈综合与 Offer 双审批

- 工作流：`rec.offer-approve@1.0.0`
- 责任角色：用人经理/HRD
- 频率：按候选人
- 结果：录用证据充分、薪酬合规、双审批完成
- 输入契约：`manifests/workflow-contracts/rec.json#rec.offer-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.offer-approve@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：缺少用户面试反馈不得终审；超 P75 必须双审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 candidate_masked、position、feedback_summary、interview_scores、risk_flags、offer_band、proposed_range、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 缺少用户面试反馈不得终审；超 P75 必须双审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 offer-evaluation 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：缺少用户面试反馈不得终审；超 P75 必须双审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-offer-approve-INPUT-REQUIRED` | invariant | all_required(candidate_masked,position,feedback_summary,interview_scores,risk_flags,offer_band,proposed_range,approvals) | active |
| `rec-offer-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-offer-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-offer-approve-DOMAIN-RULE` | domain_rule | 缺少用户面试反馈不得终审；超 P75 必须双审批 | active |
| `rec-offer-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-offer-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-offer-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-offer-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-offer-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `rec-offer-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `rec-offer-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-offer-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-offer-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-offer-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-offer-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-offer-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-offer-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-offer-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-offer-approve-ACCEPT-1` | domain_rule | 缺少用户面试反馈不得终审 | active |
| `rec-offer-approve-ACCEPT-2` | policy_threshold | 超 P75 必须双审批 | draft_requires_owner_confirmation |




### 入职任务与 30/60/90 天成效

- 工作流：`rec.onboarding-check@1.0.0`
- 责任角色：HRBP/用人经理
- 频率：按入职批次
- 结果：阻断项完成且招聘质量回写战略指标
- 输入契约：`manifests/workflow-contracts/rec.json#rec.onboarding-check@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/rec.json#rec.onboarding-check@1.0.0/output`
- TypeDict：`manifests/typedict/rec.json`
- 验收：阻断项完成；未到 90 天不得伪造留存结果

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 candidate_masked、start_date、item、owner、due、status、goals_30_60_90、retention_90d 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 阻断项完成；未到 90 天不得伪造留存结果；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 candidate_phone、candidate_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 onboarding-plan 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：阻断项完成；未到 90 天不得伪造留存结果；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“招聘质量、速度与 90 天留存”并链接 KR-TALENT、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `rec-onboarding-check-INPUT-REQUIRED` | invariant | all_required(candidate_masked,start_date,item,owner,due,status,goals_30_60_90,retention_90d) | active |
| `rec-onboarding-check-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `rec-onboarding-check-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `rec-onboarding-check-DOMAIN-RULE` | domain_rule | 阻断项完成；未到 90 天不得伪造留存结果 | active |
| `rec-onboarding-check-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `rec-onboarding-check-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `rec-onboarding-check-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `rec-onboarding-check-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `rec-onboarding-check-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `rec-onboarding-check-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `rec-onboarding-check-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `rec-onboarding-check-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `rec-onboarding-check-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `rec-onboarding-check-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `rec-onboarding-check-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `rec-onboarding-check-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `rec-onboarding-check-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `rec-onboarding-check-ACCEPT-1` | domain_rule | 阻断项完成 | active |
| `rec-onboarding-check-ACCEPT-2` | policy_threshold | 未到 90 天不得伪造留存结果 | draft_requires_owner_confirmation |

**跨域副作用**

- training.onboarding.plan → trn（键：person_key，失败：retain_outbox_and_retry）
- performance.onboarding.goals → prf（键：person_key，失败：retain_outbox_and_retry）
- admin.onboarding.equipment → admin（键：person_key，失败：retain_outbox_and_retry）

## 字段 TypeDict

- 字段数：72
- 契约数：6
