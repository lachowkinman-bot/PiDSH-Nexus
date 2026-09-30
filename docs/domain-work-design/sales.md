# 销售 SALES · 工作模块与闭环设计

- 北极星：有效管道与赢单收入
- 战略贡献：KR-PIPE、KR-REV
- 数据级别：L3
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、SCHEMA-ORDER、XBRL

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
| [SCHEMA-ORDER](https://schema.org/Order) | Schema.org Order | verified | 报价、订单、发票、折扣、付款状态和交付关系采用可互操作概念 |
| [XBRL](https://www.xbrl.org/the-standard/what/an-introduction-to-xbrl/) | XBRL Digital Business Reporting | verified | 财务与经营指标采用可比较、计算机可读、带 taxonomy 语义的报表口径 |

## 目标与管道规划

把区域目标转为个人目标和健康管道结构

### 销售目标分解

- 工作流：`sales.target-split@1.0.0`
- 责任角色：销售运营负责人
- 频率：季度
- 结果：目标分解守恒且责任人和区域一致
- 输入契约：`manifests/workflow-contracts/sales.json#sales.target-split@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.target-split@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：合计必须等于区目标

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 region、owner_masked、target_wan、quarter 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 合计必须等于区目标；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 quota-dashboard 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：合计必须等于区目标；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-target-split-INPUT-REQUIRED` | invariant | all_required(region,owner_masked,target_wan,quarter) | active |
| `sales-target-split-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-target-split-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-target-split-DOMAIN-RULE` | domain_rule | 合计必须等于区目标 | active |
| `sales-target-split-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-target-split-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-target-split-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-target-split-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-target-split-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `sales-target-split-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-target-split-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-target-split-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-target-split-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-target-split-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-target-split-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-target-split-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-target-split-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-target-split-ACCEPT-1` | domain_rule | 合计必须等于区目标 | active |




### 管道健康与预测

- 工作流：`sales.pipeline-report@1.0.0`
- 责任角色：销售负责人
- 频率：每周
- 结果：按阶段、金额和概率识别管道风险
- 输入契约：`manifests/workflow-contracts/sales.json#sales.pipeline-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.pipeline-report@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：金额单位万元，可追溯 pipeline.csv

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 stage、count、amount_k、week 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 金额单位万元，可追溯 pipeline.csv；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 quota-dashboard 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：金额单位万元，可追溯 pipeline.csv；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-pipeline-report-INPUT-REQUIRED` | invariant | all_required(stage,count,amount_k,week) | active |
| `sales-pipeline-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-pipeline-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-pipeline-report-DOMAIN-RULE` | domain_rule | 金额单位万元，可追溯 pipeline.csv | active |
| `sales-pipeline-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-pipeline-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-pipeline-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-pipeline-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-pipeline-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `sales-pipeline-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-pipeline-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-pipeline-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-pipeline-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-pipeline-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-pipeline-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-pipeline-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-pipeline-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-pipeline-report-ACCEPT-1` | domain_rule | 金额单位万元，可追溯 pipeline.csv | active |




## 报价与成交执行

以成本、折扣和客户价值约束推进交易

### 报价测算

- 工作流：`sales.quote-calc@1.0.0`
- 责任角色：销售代表/销售运营
- 频率：按商机
- 结果：规格、数量、底价和折扣计算一致
- 输入契约：`manifests/workflow-contracts/sales.json#sales.quote-calc@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.quote-calc@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：低于底价必须转 quote-approve

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 customer_masked、items、discount_pct、total_wan 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 低于底价必须转 quote-approve；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 quote-calc 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：低于底价必须转 quote-approve；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-quote-calc-INPUT-REQUIRED` | invariant | all_required(customer_masked,items,discount_pct,total_wan) | active |
| `sales-quote-calc-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-quote-calc-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-quote-calc-DOMAIN-RULE` | domain_rule | 低于底价必须转 quote-approve | active |
| `sales-quote-calc-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-quote-calc-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-quote-calc-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-quote-calc-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-quote-calc-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `sales-quote-calc-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-quote-calc-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-quote-calc-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-quote-calc-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-quote-calc-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-quote-calc-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-quote-calc-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-quote-calc-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-quote-calc-ACCEPT-1` | domain_rule | 低于底价必须转 quote-approve | active |




### 报价审批

- 工作流：`sales.quote-approve@1.0.0`
- 责任角色：销售负责人/CFO
- 频率：按报价事件
- 结果：折扣和风险触发正确审批路径
- 输入契约：`manifests/workflow-contracts/sales.json#sales.quote-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.quote-approve@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：折扣 ≥10% 双审批；≥15% 加签 CFO

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 quote_id、total_wan、discount_pct、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 折扣 ≥10% 双审批；≥15% 加签 CFO；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 quote-calc 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：折扣 ≥10% 双审批；≥15% 加签 CFO；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-quote-approve-INPUT-REQUIRED` | invariant | all_required(quote_id,total_wan,discount_pct,approvals) | active |
| `sales-quote-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-quote-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-quote-approve-DOMAIN-RULE` | domain_rule | 折扣 ≥10% 双审批；≥15% 加签 CFO | active |
| `sales-quote-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-quote-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-quote-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-quote-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-quote-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `sales-quote-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `sales-quote-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-quote-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-quote-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-quote-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-quote-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-quote-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-quote-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-quote-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-quote-approve-ACCEPT-1` | policy_threshold | 折扣 ≥10% 双审批 | draft_requires_owner_confirmation |
| `sales-quote-approve-ACCEPT-2` | policy_threshold | ≥15% 加签 CFO | draft_requires_owner_confirmation |




## 合同、收入与复盘

让条款风险、收入确认和打法沉淀闭环

### 合同条款评审

- 工作流：`sales.contract-review@1.0.0`
- 责任角色：法务/财务/销售负责人
- 频率：按合同
- 结果：回款、责任和法律风险经过会签
- 输入契约：`manifests/workflow-contracts/sales.json#sales.contract-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.contract-review@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：回款条款偏离标准必须双审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 contract_no、terms_risk、payment_terms、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 回款条款偏离标准必须双审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 win-review 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：回款条款偏离标准必须双审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-contract-review-INPUT-REQUIRED` | invariant | all_required(contract_no,terms_risk,payment_terms,approvals) | active |
| `sales-contract-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-contract-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-contract-review-DOMAIN-RULE` | domain_rule | 回款条款偏离标准必须双审批 | active |
| `sales-contract-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-contract-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-contract-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-contract-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-contract-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `sales-contract-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `sales-contract-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-contract-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-contract-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-contract-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-contract-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-contract-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-contract-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-contract-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-contract-review-ACCEPT-1` | domain_rule | 回款条款偏离标准必须双审批 | active |

**跨域副作用**

- finance.revenue.recognition → fin（键：contract_key，失败：retain_outbox_and_retry）

### 赢单/输单复盘

- 工作流：`sales.win-review@1.0.0`
- 责任角色：销售负责人
- 频率：月度/按关键商机
- 结果：形成可复用打法、产品反馈和管道改进
- 输入契约：`manifests/workflow-contracts/sales.json#sales.win-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/sales.json#sales.win-review@1.0.0/output`
- TypeDict：`manifests/typedict/sales.json`
- 验收：结论可追溯到商机记录

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 opportunity、amount_k、win_factors、playbook_update 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 结论可追溯到商机记录；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 customer_contract、discount_floor 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 win-review 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：结论可追溯到商机记录；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“有效管道与赢单收入”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `sales-win-review-INPUT-REQUIRED` | invariant | all_required(opportunity,amount_k,win_factors,playbook_update) | active |
| `sales-win-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `sales-win-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `sales-win-review-DOMAIN-RULE` | domain_rule | 结论可追溯到商机记录 | active |
| `sales-win-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `sales-win-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `sales-win-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `sales-win-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `sales-win-review-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `sales-win-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `sales-win-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `sales-win-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `sales-win-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `sales-win-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `sales-win-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `sales-win-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `sales-win-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `sales-win-review-ACCEPT-1` | domain_rule | 结论可追溯到商机记录 | active |




## 字段 TypeDict

- 字段数：64
- 契约数：6
