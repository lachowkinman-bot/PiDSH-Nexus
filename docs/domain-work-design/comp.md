# 薪酬 COMP · 工作模块与闭环设计

- 北极星：薪酬带宽、成本与保留风险
- 战略贡献：KR-TALENT、KR-CAPABILITY、KR-CONTROL
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、WORLDATWORK-TOTAL-REWARDS、ISO-30414、COSO-ERM、XBRL

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
| [ISO-30414](https://www.iso.org/standard/69338.html) | ISO 30414 Human Capital Reporting | reference-only | 人力资本指标分层、口径一致、可比较并支持内部与外部报告 |
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |
| [XBRL](https://www.xbrl.org/the-standard/what/an-introduction-to-xbrl/) | XBRL Digital Business Reporting | verified | 财务与经营指标采用可比较、计算机可读、带 taxonomy 语义的报表口径 |

## 岗位与薪酬架构

维护带宽、职级和薪酬公平基线

### 薪酬带宽偏离报告

- 工作流：`comp.band-report@1.0.0`
- 责任角色：薪酬负责人
- 频率：季度
- 结果：仅用区间口径识别偏离和公平风险
- 输入契约：`manifests/workflow-contracts/comp.json#comp.band-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.band-report@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：不出现任何个体原值

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 band、headcount、above_p75、below_p25 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 不出现任何个体原值；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 band-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：不出现任何个体原值；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-band-report-INPUT-REQUIRED` | invariant | all_required(band,headcount,above_p75,below_p25) | active |
| `comp-band-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-band-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-band-report-DOMAIN-RULE` | domain_rule | 不出现任何个体原值 | active |
| `comp-band-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-band-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-band-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-band-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-band-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `comp-band-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-band-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-band-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-band-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-band-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-band-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-band-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-band-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-band-report-ACCEPT-1` | domain_rule | 不出现任何个体原值 | active |




## 调薪方案与成本测算

让调薪依据、区间和成本约束可解释

### 调薪包成本测算

- 工作流：`comp.cost-projection@1.0.0`
- 责任角色：薪酬/财务负责人
- 频率：季度/年度
- 结果：情景、比例、成本和预算影响一致
- 输入契约：`manifests/workflow-contracts/comp.json#comp.cost-projection@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.cost-projection@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：测算不含个体原值

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 scenario、pct、cost_impact_wan、note 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 测算不含个体原值；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 payroll-recon 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：测算不含个体原值；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-cost-projection-INPUT-REQUIRED` | invariant | all_required(scenario,pct,cost_impact_wan,note) | active |
| `comp-cost-projection-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-cost-projection-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-cost-projection-DOMAIN-RULE` | domain_rule | 测算不含个体原值 | active |
| `comp-cost-projection-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-cost-projection-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-cost-projection-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-cost-projection-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-cost-projection-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `comp-cost-projection-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-cost-projection-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-cost-projection-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-cost-projection-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-cost-projection-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-cost-projection-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-cost-projection-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-cost-projection-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-cost-projection-ACCEPT-1` | domain_rule | 测算不含个体原值 | active |




### 个体调薪双审批

- 工作流：`comp.salary-adjust@1.0.0`
- 责任角色：部门负责人/HRD
- 频率：按调薪事件
- 结果：带宽、幅度、理由和双审批完整
- 输入契约：`manifests/workflow-contracts/comp.json#comp.salary-adjust@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.salary-adjust@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：个体薪酬只出区间；redact_gate 强制

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、band_from、band_to、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 个体薪酬只出区间；redact_gate 强制；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 band-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：个体薪酬只出区间；redact_gate 强制；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-salary-adjust-INPUT-REQUIRED` | invariant | all_required(employee_masked,band_from,band_to,approvals) | active |
| `comp-salary-adjust-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-salary-adjust-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-salary-adjust-DOMAIN-RULE` | domain_rule | 个体薪酬只出区间；redact_gate 强制 | active |
| `comp-salary-adjust-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-salary-adjust-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-salary-adjust-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-salary-adjust-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-salary-adjust-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `comp-salary-adjust-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `comp-salary-adjust-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-salary-adjust-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-salary-adjust-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-salary-adjust-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-salary-adjust-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-salary-adjust-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-salary-adjust-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-salary-adjust-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-salary-adjust-ACCEPT-1` | domain_rule | 个体薪酬只出区间 | active |
| `comp-salary-adjust-ACCEPT-2` | domain_rule | redact_gate 强制 | active |




## 核算、对账与队列审批

让支付、社保、个税和批量审批一致

### Payroll 对账

- 工作流：`comp.payroll-recon@1.0.0`
- 责任角色：薪酬/财务
- 频率：每月
- 结果：应发、实发、差异和项目可追溯
- 输入契约：`manifests/workflow-contracts/comp.json#comp.payroll-recon@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.payroll-recon@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：差异 >0.5% 逐项列出

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 period、headcount、gross_diff、items 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 差异 >0.5% 逐项列出；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 payroll-recon 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：差异 >0.5% 逐项列出；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-payroll-recon-INPUT-REQUIRED` | invariant | all_required(period,headcount,gross_diff,items) | active |
| `comp-payroll-recon-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-payroll-recon-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-payroll-recon-DOMAIN-RULE` | domain_rule | 差异 >0.5% 逐项列出 | active |
| `comp-payroll-recon-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-payroll-recon-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-payroll-recon-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-payroll-recon-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-payroll-recon-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `comp-payroll-recon-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-payroll-recon-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-payroll-recon-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-payroll-recon-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-payroll-recon-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-payroll-recon-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-payroll-recon-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-payroll-recon-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-payroll-recon-ACCEPT-1` | policy_threshold | 差异 >0.5% 逐项列出 | draft_requires_owner_confirmation |




### Compa-Ratio 分析

- 工作流：`comp.compa-ratio@1.0.0`
- 责任角色：薪酬负责人
- 频率：季度
- 结果：CR 分档、带宽与异常可解释
- 输入契约：`manifests/workflow-contracts/comp.json#comp.compa-ratio@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.compa-ratio@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：CR 仅区间展示（0.8–1.2 分档）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、band、cr、zone 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | CR 仅区间展示（0.8–1.2 分档）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 compa-ratio 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：CR 仅区间展示（0.8–1.2 分档）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-compa-ratio-INPUT-REQUIRED` | invariant | all_required(employee_masked,band,cr,zone) | active |
| `comp-compa-ratio-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-compa-ratio-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-compa-ratio-DOMAIN-RULE` | domain_rule | CR 仅区间展示（0.8–1.2 分档） | active |
| `comp-compa-ratio-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-compa-ratio-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-compa-ratio-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-compa-ratio-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-compa-ratio-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `comp-compa-ratio-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-compa-ratio-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-compa-ratio-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-compa-ratio-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-compa-ratio-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-compa-ratio-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-compa-ratio-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-compa-ratio-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-compa-ratio-ACCEPT-1` | policy_threshold | CR 仅区间展示（0.8–1.2 分档） | draft_requires_owner_confirmation |




### 调薪队列批量审批

- 工作流：`comp.queue-approve@1.0.0`
- 责任角色：HRD/CFO
- 频率：按批次
- 结果：批量影响、预算和授权链完整
- 输入契约：`manifests/workflow-contracts/comp.json#comp.queue-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/comp.json#comp.queue-approve@1.0.0/output`
- TypeDict：`manifests/typedict/comp.json`
- 验收：批量影响 >50 万/年 加签 CEO

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 batch、items、total_impact_wan、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 批量影响 >50 万/年 加签 CEO；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary、bank_account、id_number 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 compa-ratio 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：批量影响 >50 万/年 加签 CEO；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“薪酬带宽、成本与保留风险”并链接 KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `comp-queue-approve-INPUT-REQUIRED` | invariant | all_required(batch,items,total_impact_wan,approvals) | active |
| `comp-queue-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `comp-queue-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `comp-queue-approve-DOMAIN-RULE` | domain_rule | 批量影响 >50 万/年 加签 CEO | active |
| `comp-queue-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `comp-queue-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `comp-queue-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `comp-queue-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `comp-queue-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `comp-queue-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `comp-queue-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `comp-queue-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `comp-queue-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `comp-queue-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `comp-queue-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `comp-queue-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `comp-queue-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `comp-queue-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `comp-queue-approve-ACCEPT-1` | policy_threshold | 批量影响 >50 万/年 加签 CEO | draft_requires_owner_confirmation |




## 字段 TypeDict

- 字段数：40
- 契约数：6
