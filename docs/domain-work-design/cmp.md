# 合规 CMP · 工作模块与闭环设计

- 北极星：合规率、风险闭环与审计发现
- 战略贡献：KR-CONTROL
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、COSO-ERM、XBRL

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
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |
| [XBRL](https://www.xbrl.org/the-standard/what/an-introduction-to-xbrl/) | XBRL Digital Business Reporting | verified | 财务与经营指标采用可比较、计算机可读、带 taxonomy 语义的报表口径 |

## 制度与培训合规

把法律/制度要求映射为检查项和整改动作

### 制度审查 Checklist

- 工作流：`cmp.policy-review@1.0.0`
- 责任角色：合规负责人
- 频率：季度/按制度变更
- 结果：法律依据、检查项、证据和整改期限完整
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.policy-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.policy-review@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：Requirement→Release 链完整

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 policy、items、pass_rate、gaps 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | Requirement→Release 链完整；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 policy-checklist 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：Requirement→Release 链完整；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-policy-review-INPUT-REQUIRED` | invariant | all_required(policy,items,pass_rate,gaps) | active |
| `cmp-policy-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-policy-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-policy-review-DOMAIN-RULE` | domain_rule | Requirement→Release 链完整 | active |
| `cmp-policy-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-policy-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-policy-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-policy-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-policy-review-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `cmp-policy-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-policy-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-policy-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-policy-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-policy-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-policy-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-policy-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-policy-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-policy-review-ACCEPT-1` | domain_rule | Requirement→Release 链完整 | active |




### 合规培训完成度核查

- 工作流：`cmp.training-check@1.0.0`
- 责任角色：合规/培训负责人
- 频率：月度/季度
- 结果：必修覆盖、完成率和缺口部门可追踪
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.training-check@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.training-check@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：必修未完成 >5% 上报管理层

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dept、required、completed、rate 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 必修未完成 >5% 上报管理层；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 pipia-list 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：必修未完成 >5% 上报管理层；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-training-check-INPUT-REQUIRED` | invariant | all_required(dept,required,completed,rate) | active |
| `cmp-training-check-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-training-check-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-training-check-DOMAIN-RULE` | domain_rule | 必修未完成 >5% 上报管理层 | active |
| `cmp-training-check-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-training-check-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-training-check-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-training-check-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-training-check-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `cmp-training-check-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-training-check-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-training-check-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-training-check-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-training-check-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-training-check-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-training-check-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-training-check-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-training-check-ACCEPT-1` | policy_threshold | 必修未完成 >5% 上报管理层 | draft_requires_owner_confirmation |




## 隐私、AI 与证据

让 PIPIA、风险处置和证据包可验证

### PIPIA 评审

- 工作流：`cmp.pipia-review@1.0.0`
- 责任角色：隐私负责人
- 频率：按新流程/产品
- 结果：处理目的、法律依据、风险和控制措施完整
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.pipia-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.pipia-review@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：高风险 residual 未降级不得上线

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 process、risk_level、residual、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 高风险 residual 未降级不得上线；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 pipia-list 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：高风险 residual 未降级不得上线；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-pipia-review-INPUT-REQUIRED` | invariant | all_required(process,risk_level,residual,approvals) | active |
| `cmp-pipia-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-pipia-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-pipia-review-DOMAIN-RULE` | domain_rule | 高风险 residual 未降级不得上线 | active |
| `cmp-pipia-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-pipia-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-pipia-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-pipia-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-pipia-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `cmp-pipia-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `cmp-pipia-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-pipia-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-pipia-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-pipia-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-pipia-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-pipia-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-pipia-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-pipia-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-pipia-review-ACCEPT-1` | domain_rule | 高风险 residual 未降级不得上线 | active |




### 审计级证据打包

- 工作流：`cmp.evidence-pack@1.0.0`
- 责任角色：合规审计负责人
- 频率：按案件/审计
- 结果：证据引用、哈希、时间戳和封存链完整
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.evidence-pack@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.evidence-pack@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：打包后不可增删（append-only）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 case、evidence_items、hashes、packaged_at 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 打包后不可增删（append-only）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 evidence-pack 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：打包后不可增删（append-only）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-evidence-pack-INPUT-REQUIRED` | invariant | all_required(case,evidence_items,hashes,packaged_at) | active |
| `cmp-evidence-pack-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-evidence-pack-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-evidence-pack-DOMAIN-RULE` | domain_rule | 打包后不可增删（append-only） | active |
| `cmp-evidence-pack-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-evidence-pack-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-evidence-pack-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-evidence-pack-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-evidence-pack-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `cmp-evidence-pack-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `cmp-evidence-pack-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-evidence-pack-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-evidence-pack-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-evidence-pack-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-evidence-pack-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-evidence-pack-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-evidence-pack-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-evidence-pack-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-evidence-pack-ACCEPT-1` | domain_rule | 打包后不可增删（append-only） | active |




## 审计与监管报送

让留痕覆盖率、整改和监管截止日闭环

### 审计留痕月报

- 工作流：`cmp.audit-trail@1.0.0`
- 责任角色：内审负责人
- 频率：每月
- 结果：覆盖率、缺口、责任人和整改期限明确
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.audit-trail@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.audit-trail@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：关键动作覆盖率 ≥95%

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 scope、events、coverage_pct、gaps 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 关键动作覆盖率 ≥95%；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 policy-checklist 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：关键动作覆盖率 ≥95%；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-audit-trail-INPUT-REQUIRED` | invariant | all_required(scope,events,coverage_pct,gaps) | active |
| `cmp-audit-trail-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-audit-trail-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-audit-trail-DOMAIN-RULE` | domain_rule | 关键动作覆盖率 ≥95% | active |
| `cmp-audit-trail-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-audit-trail-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-audit-trail-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-audit-trail-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-audit-trail-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `cmp-audit-trail-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-audit-trail-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-audit-trail-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-audit-trail-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-audit-trail-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-audit-trail-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-audit-trail-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-audit-trail-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-audit-trail-ACCEPT-1` | policy_threshold | 关键动作覆盖率 ≥95% | draft_requires_owner_confirmation |




### 监管报送清单

- 工作流：`cmp.reg-filing@1.0.0`
- 责任角色：合规申报负责人
- 频率：按监管周期
- 结果：主体、材料、截止日和状态完整
- 输入契约：`manifests/workflow-contracts/cmp.json#cmp.reg-filing@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/cmp.json#cmp.reg-filing@1.0.0/output`
- TypeDict：`manifests/typedict/cmp.json`
- 验收：7 天内到期必须置顶

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 filing、authority、deadline、days_left 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 7 天内到期必须置顶；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 audit_working_papers 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 evidence-pack 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：7 天内到期必须置顶；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合规率、风险闭环与审计发现”并链接 KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `cmp-reg-filing-INPUT-REQUIRED` | invariant | all_required(filing,authority,deadline,days_left) | active |
| `cmp-reg-filing-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `cmp-reg-filing-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `cmp-reg-filing-DOMAIN-RULE` | domain_rule | 7 天内到期必须置顶 | active |
| `cmp-reg-filing-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `cmp-reg-filing-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `cmp-reg-filing-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `cmp-reg-filing-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `cmp-reg-filing-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `cmp-reg-filing-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `cmp-reg-filing-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `cmp-reg-filing-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `cmp-reg-filing-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `cmp-reg-filing-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `cmp-reg-filing-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `cmp-reg-filing-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `cmp-reg-filing-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `cmp-reg-filing-ACCEPT-1` | policy_threshold | 7 天内到期必须置顶 | draft_requires_owner_confirmation |




## 字段 TypeDict

- 字段数：55
- 契约数：6
