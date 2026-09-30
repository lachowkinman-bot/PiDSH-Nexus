# 绩效 PRF · 工作模块与闭环设计

- 北极星：目标达成率与校准质量
- 战略贡献：KR-REV、KR-CAPABILITY
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、ISO-30414、SHRM-HR-QA、XAPI、COSO-ERM

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
| [ISO-30414](https://www.iso.org/standard/69338.html) | ISO 30414 Human Capital Reporting | reference-only | 人力资本指标分层、口径一致、可比较并支持内部与外部报告 |
| [SHRM-HR-QA](https://www.shrm.org/topics-tools/tools/hr-answers) | SHRM HR Q&As | verified | HR 事项保留合规问题、角色责任、证据和可审计决策 |
| [XAPI](https://github.com/adlnet/xAPI-Spec) | Experience API (xAPI) | verified | 学习经历使用 Actor → Verb → Object 及 Result/Context 记录 |
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |

## 目标与 KPI 系统

让战略目标分解到部门和个人并可追踪

### 目标分解报告

- 工作流：`prf.cascade-report@1.0.0`
- 责任角色：绩效负责人
- 频率：季度
- 结果：目标层级、权重和责任人完整
- 输入契约：`manifests/workflow-contracts/prf.json#prf.cascade-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.cascade-report@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：权重合计必须 = 100%

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 level、owner_masked、goal、weight 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 权重合计必须 = 100%；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 goal-cascade 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：权重合计必须 = 100%；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-cascade-report-INPUT-REQUIRED` | invariant | all_required(level,owner_masked,goal,weight) | active |
| `prf-cascade-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-cascade-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-cascade-report-DOMAIN-RULE` | domain_rule | 权重合计必须 = 100% | active |
| `prf-cascade-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-cascade-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-cascade-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-cascade-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-cascade-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `prf-cascade-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-cascade-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-cascade-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-cascade-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-cascade-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-cascade-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-cascade-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-cascade-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-cascade-report-ACCEPT-1` | policy_threshold | 权重合计必须 = 100% | draft_requires_owner_confirmation |




### KPI 跟踪与预警

- 工作流：`prf.kpi-tracking@1.0.0`
- 责任角色：部门负责人/绩效运营
- 频率：月度
- 结果：实际、目标、权重和风险一致
- 输入契约：`manifests/workflow-contracts/prf.json#prf.kpi-tracking@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.kpi-tracking@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：数据可追溯 kpi.csv

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 kpi、target、actual、rate 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 数据可追溯 kpi.csv；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 kpi-track 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：数据可追溯 kpi.csv；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-kpi-tracking-INPUT-REQUIRED` | invariant | all_required(kpi,target,actual,rate) | active |
| `prf-kpi-tracking-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-kpi-tracking-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-kpi-tracking-DOMAIN-RULE` | domain_rule | 数据可追溯 kpi.csv | active |
| `prf-kpi-tracking-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-kpi-tracking-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-kpi-tracking-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-kpi-tracking-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-kpi-tracking-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `prf-kpi-tracking-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-kpi-tracking-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-kpi-tracking-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-kpi-tracking-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-kpi-tracking-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-kpi-tracking-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-kpi-tracking-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-kpi-tracking-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-kpi-tracking-ACCEPT-1` | domain_rule | 数据可追溯 kpi.csv | active |




## 考核与反馈周期

让周期、证据、沟通和改进动作闭环

### 考核周期发起

- 工作流：`prf.review-cycle@1.0.0`
- 责任角色：绩效运营
- 频率：季度/年度
- 结果：模板、目标、期限和全员覆盖完整
- 输入契约：`manifests/workflow-contracts/prf.json#prf.review-cycle@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.review-cycle@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：全员覆盖校验（无遗漏人）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 cycle、template、targets、deadline 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 全员覆盖校验（无遗漏人）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 kpi-track 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：全员覆盖校验（无遗漏人）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-review-cycle-INPUT-REQUIRED` | invariant | all_required(cycle,template,targets,deadline) | active |
| `prf-review-cycle-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-review-cycle-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-review-cycle-DOMAIN-RULE` | domain_rule | 全员覆盖校验（无遗漏人） | active |
| `prf-review-cycle-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-review-cycle-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-review-cycle-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-review-cycle-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-review-cycle-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `prf-review-cycle-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-review-cycle-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-review-cycle-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-review-cycle-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-review-cycle-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-review-cycle-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-review-cycle-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-review-cycle-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-review-cycle-ACCEPT-1` | domain_rule | 全员覆盖校验（无遗漏人） | active |




### 一对一沟通纪要

- 工作流：`prf.one-on-one@1.0.0`
- 责任角色：直属经理
- 频率：月度
- 结果：主题、行动项、责任人和下次时间明确
- 输入契约：`manifests/workflow-contracts/prf.json#prf.one-on-one@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.one-on-one@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：纪要默认不入记忆层

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、topics、actions、next_date 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 纪要默认不入记忆层；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 goal-cascade 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：纪要默认不入记忆层；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-one-on-one-INPUT-REQUIRED` | invariant | all_required(employee_masked,topics,actions,next_date) | active |
| `prf-one-on-one-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-one-on-one-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-one-on-one-DOMAIN-RULE` | domain_rule | 纪要默认不入记忆层 | active |
| `prf-one-on-one-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-one-on-one-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-one-on-one-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-one-on-one-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-one-on-one-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `prf-one-on-one-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-one-on-one-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-one-on-one-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-one-on-one-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-one-on-one-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-one-on-one-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-one-on-one-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-one-on-one-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-one-on-one-ACCEPT-1` | domain_rule | 纪要默认不入记忆层 | active |




## 校准与分布治理

用双审批和分布证据保证公平可解释

### 绩效校准双审批

- 工作流：`prf.calibration-approve@1.0.0`
- 责任角色：HRD/业务负责人
- 频率：季度/年度
- 结果：等级证据、分歧和审批意见完整
- 输入契约：`manifests/workflow-contracts/prf.json#prf.calibration-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.calibration-approve@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：校准纪要禁入记忆层

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 employee_masked、manager_grade、calibrated_grade、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 校准纪要禁入记忆层；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 calibration-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：校准纪要禁入记忆层；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-calibration-approve-INPUT-REQUIRED` | invariant | all_required(employee_masked,manager_grade,calibrated_grade,approvals) | active |
| `prf-calibration-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-calibration-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-calibration-approve-DOMAIN-RULE` | domain_rule | 校准纪要禁入记忆层 | active |
| `prf-calibration-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-calibration-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-calibration-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-calibration-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-calibration-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `prf-calibration-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `prf-calibration-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-calibration-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-calibration-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-calibration-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-calibration-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-calibration-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-calibration-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-calibration-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-calibration-approve-ACCEPT-1` | domain_rule | 校准纪要禁入记忆层 | active |

**跨域副作用**

- comp.adjustment.candidate → comp（键：person_key，失败：retain_outbox_and_retry）

### 等级分布分析

- 工作流：`prf.grade-distribution@1.0.0`
- 责任角色：绩效负责人
- 频率：季度/年度
- 结果：分布、目标和异常偏差可解释
- 输入契约：`manifests/workflow-contracts/prf.json#prf.grade-distribution@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/prf.json#prf.grade-distribution@1.0.0/output`
- TypeDict：`manifests/typedict/prf.json`
- 验收：偏离强制分布线 >5pct 标红

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 grade、count、pct、target_pct 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 偏离强制分布线 >5pct 标红；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 review_score、review_note 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 calibration-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：偏离强制分布线 >5pct 标红；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“目标达成率与校准质量”并链接 KR-REV、KR-CAPABILITY；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CAPABILITY，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `prf-grade-distribution-INPUT-REQUIRED` | invariant | all_required(grade,count,pct,target_pct) | active |
| `prf-grade-distribution-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `prf-grade-distribution-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `prf-grade-distribution-DOMAIN-RULE` | domain_rule | 偏离强制分布线 >5pct 标红 | active |
| `prf-grade-distribution-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `prf-grade-distribution-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `prf-grade-distribution-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `prf-grade-distribution-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `prf-grade-distribution-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `prf-grade-distribution-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `prf-grade-distribution-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `prf-grade-distribution-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `prf-grade-distribution-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `prf-grade-distribution-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `prf-grade-distribution-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `prf-grade-distribution-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `prf-grade-distribution-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `prf-grade-distribution-ACCEPT-1` | policy_threshold | 偏离强制分布线 >5pct 标红 | draft_requires_owner_confirmation |




## 字段 TypeDict

- 字段数：44
- 契约数：6
