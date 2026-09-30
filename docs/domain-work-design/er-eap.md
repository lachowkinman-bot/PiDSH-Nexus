# 员工关系/EAP · 工作模块与闭环设计

- 北极星：案件闭环、留存与组织健康
- 战略贡献：KR-TALENT、KR-CAPABILITY、KR-CONTROL
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、SHRM-HR-QA、EAPA、ISO-55000

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
| [SHRM-HR-QA](https://www.shrm.org/topics-tools/tools/hr-answers) | SHRM HR Q&As | verified | HR 事项保留合规问题、角色责任、证据和可审计决策 |
| [EAPA](https://www.eapassn.org/) | Employee Assistance Professionals Association | reference-only | 员工援助以保密、自愿、临床适当转介和组织支持为原则 |
| [ISO-55000](https://www.iso.org/standard/55089.html) | ISO 55000 Asset Management | reference-only | 资产全生命周期、价值、风险和绩效闭环 |

## 员工关系案件管理

让争议、调查、调解和证据链可控

### 争议案件台账与证据

- 工作流：`er-eap.dispute-case@1.0.0`
- 责任角色：员工关系负责人
- 频率：按案件
- 结果：阶段、责任人、证据引用和下一步明确
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.dispute-case@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.dispute-case@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：证据引用指向 evidence-pack

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 case_id、type、stage、evidence_refs 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 证据引用指向 evidence-pack；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 dispute-ops 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：证据引用指向 evidence-pack；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-dispute-case-INPUT-REQUIRED` | invariant | all_required(case_id,type,stage,evidence_refs) | active |
| `er-eap-dispute-case-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-dispute-case-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-dispute-case-DOMAIN-RULE` | domain_rule | 证据引用指向 evidence-pack | active |
| `er-eap-dispute-case-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-dispute-case-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-dispute-case-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-dispute-case-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-dispute-case-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `er-eap-dispute-case-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-dispute-case-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-dispute-case-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-dispute-case-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-dispute-case-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-dispute-case-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-dispute-case-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-dispute-case-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-dispute-case-ACCEPT-1` | domain_rule | 证据引用指向 evidence-pack | active |




### 离职面谈结构化

- 工作流：`er-eap.exit-interview@1.0.0`
- 责任角色：HRBP
- 频率：按离职事件
- 结果：原因、改进项和再雇佣建议脱敏留痕
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.exit-interview@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.exit-interview@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：敏感表述经脱敏

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、reasons、improvements、rehire_flag 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 敏感表述经脱敏；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 offboarding-flow 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：敏感表述经脱敏；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-exit-interview-INPUT-REQUIRED` | invariant | all_required(employee_masked,reasons,improvements,rehire_flag) | active |
| `er-eap-exit-interview-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-exit-interview-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-exit-interview-DOMAIN-RULE` | domain_rule | 敏感表述经脱敏 | active |
| `er-eap-exit-interview-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-exit-interview-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-exit-interview-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-exit-interview-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-exit-interview-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `er-eap-exit-interview-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-exit-interview-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-exit-interview-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-exit-interview-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-exit-interview-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-exit-interview-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-exit-interview-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-exit-interview-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-exit-interview-ACCEPT-1` | domain_rule | 敏感表述经脱敏 | active |




## 离职与权限资产回收

让离职审批、交接、资产和合同终止闭环

### 离职流程与双审批

- 工作流：`er-eap.offboard-approve@1.0.0`
- 责任角色：HRD/员工关系负责人
- 频率：按离职事件
- 结果：交接、资产、权限、合同和薪酬结算完成
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.offboard-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.offboard-approve@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：交接未完成不得进入最后一步

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、last_day、handover_ok、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 交接未完成不得进入最后一步；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 offboarding-flow 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：交接未完成不得进入最后一步；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-offboard-approve-INPUT-REQUIRED` | invariant | all_required(employee_masked,last_day,handover_ok,approvals) | active |
| `er-eap-offboard-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-offboard-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-offboard-approve-DOMAIN-RULE` | domain_rule | 交接未完成不得进入最后一步 | active |
| `er-eap-offboard-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-offboard-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-offboard-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-offboard-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-offboard-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `er-eap-offboard-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `er-eap-offboard-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-offboard-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-offboard-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-offboard-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-offboard-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-offboard-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-offboard-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-offboard-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-offboard-approve-ACCEPT-1` | domain_rule | 交接未完成不得进入最后一步 | active |




## EAP 匿名支持与组织健康

在匿名、禁网和严格隐私边界下提供支持

### EAP 匿名转介

- 工作流：`er-eap.eap-referral@1.0.0`
- 责任角色：EAP 专员/主管
- 频率：按转介事件
- 结果：仅匿名编号、双审批和独立命名空间
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.eap-referral@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.eap-referral@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：输出仅匿名编号；禁网；禁入记忆层

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 anon_id、direction、approvals、sessions 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 输出仅匿名编号；禁网；禁入记忆层；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 eap-referral 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：输出仅匿名编号；禁网；禁入记忆层；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-eap-referral-INPUT-REQUIRED` | invariant | all_required(anon_id,direction,approvals,sessions) | active |
| `er-eap-eap-referral-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-eap-referral-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-eap-referral-DOMAIN-RULE` | domain_rule | 输出仅匿名编号；禁网；禁入记忆层 | active |
| `er-eap-eap-referral-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-eap-referral-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-eap-referral-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-eap-referral-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-eap-referral-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `er-eap-eap-referral-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `er-eap-eap-referral-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-eap-referral-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-eap-referral-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-eap-referral-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-eap-referral-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-eap-referral-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-eap-referral-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-eap-referral-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-eap-referral-ACCEPT-1` | domain_rule | 输出仅匿名编号 | active |
| `er-eap-eap-referral-ACCEPT-2` | domain_rule | 禁网 | active |
| `er-eap-eap-referral-ACCEPT-3` | domain_rule | 禁入记忆层 | active |




### EAP 匿名使用月报

- 工作流：`er-eap.anon-report@1.0.0`
- 责任角色：EAP 负责人
- 频率：每月
- 结果：只出聚合、n<5 抑制、无个体可识别信息
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.anon-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.anon-report@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：仅聚合数字，无任何个体字段

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 month、total_referrals、by_direction、sessions 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 仅聚合数字，无任何个体字段；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 eap-referral 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：仅聚合数字，无任何个体字段；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-anon-report-INPUT-REQUIRED` | invariant | all_required(month,total_referrals,by_direction,sessions) | active |
| `er-eap-anon-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-anon-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-anon-report-DOMAIN-RULE` | domain_rule | 仅聚合数字，无任何个体字段 | active |
| `er-eap-anon-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-anon-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-anon-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-anon-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-anon-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `er-eap-anon-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-anon-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-anon-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-anon-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-anon-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-anon-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-anon-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-anon-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-anon-report-ACCEPT-1` | domain_rule | 仅聚合数字，无任何个体字段 | active |




### 组织健康脉搏

- 工作流：`er-eap.wellbeing-check@1.0.0`
- 责任角色：员工体验负责人
- 频率：月度/季度
- 结果：维度、样本量、趋势和抑制规则完整
- 输入契约：`manifests/workflow-contracts/er-eap.json#er-eap.wellbeing-check@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/er-eap.json#er-eap.wellbeing-check@1.0.0/output`
- TypeDict：`manifests/typedict/er-eap.json`
- 验收：n<5 不出分（防反推）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dimension、score、n、trend 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | n<5 不出分（防反推）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 disciplinary_detail、eap_content、health_mental 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 eap-referral 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：n<5 不出分（防反推）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“案件闭环、留存与组织健康”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `er-eap-wellbeing-check-INPUT-REQUIRED` | invariant | all_required(dimension,score,n,trend) | active |
| `er-eap-wellbeing-check-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `er-eap-wellbeing-check-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `er-eap-wellbeing-check-DOMAIN-RULE` | domain_rule | n<5 不出分（防反推） | active |
| `er-eap-wellbeing-check-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `er-eap-wellbeing-check-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `er-eap-wellbeing-check-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `er-eap-wellbeing-check-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `er-eap-wellbeing-check-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `er-eap-wellbeing-check-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `er-eap-wellbeing-check-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `er-eap-wellbeing-check-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `er-eap-wellbeing-check-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `er-eap-wellbeing-check-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `er-eap-wellbeing-check-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `er-eap-wellbeing-check-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `er-eap-wellbeing-check-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `er-eap-wellbeing-check-ACCEPT-1` | policy_threshold | n<5 不出分（防反推） | draft_requires_owner_confirmation |




## 字段 TypeDict

- 字段数：48
- 契约数：6
