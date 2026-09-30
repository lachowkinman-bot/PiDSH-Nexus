# 战略 STRAT · 工作模块与闭环设计

- 北极星：战略目标达成率
- 战略贡献：KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、COSO-ERM、ISO-30414、XBRL

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
| [ISO-30414](https://www.iso.org/standard/69338.html) | ISO 30414 Human Capital Reporting | reference-only | 人力资本指标分层、口径一致、可比较并支持内部与外部报告 |
| [XBRL](https://www.xbrl.org/the-standard/what/an-introduction-to-xbrl/) | XBRL Digital Business Reporting | verified | 财务与经营指标采用可比较、计算机可读、带 taxonomy 语义的报表口径 |

## 战略制定与解码

形成可量化目标、竞争判断和组织能力假设

### 战略目标与 KR 定版

- 工作流：`strat.okr-set@1.0.0`
- 责任角色：战略负责人
- 频率：季度
- 结果：把战略意图转为可度量、可归责的关键结果
- 输入契约：`manifests/workflow-contracts/strat.json#strat.okr-set@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.okr-set@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：每条 KR 必须可量化（progress_pct 数值）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 objective、kr_list、quarter、owner 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 每条 KR 必须可量化（progress_pct 数值）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 strategy-decode 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：每条 KR 必须可量化（progress_pct 数值）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-okr-set-INPUT-REQUIRED` | invariant | all_required(objective,kr_list,quarter,owner) | active |
| `strategy-okr-set-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-okr-set-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-okr-set-DOMAIN-RULE` | domain_rule | 每条 KR 必须可量化（progress_pct 数值） | active |
| `strategy-okr-set-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-okr-set-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-okr-set-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-okr-set-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-okr-set-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `strategy-okr-set-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-okr-set-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-okr-set-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-okr-set-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-okr-set-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-okr-set-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-okr-set-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-okr-set-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-okr-set-ACCEPT-1` | domain_rule | 每条 KR 必须可量化（progress_pct 数值） | active |




### 竞争态势与应对

- 工作流：`strat.competitor-brief@1.0.0`
- 责任角色：战略研究负责人
- 频率：月度/事件触达
- 结果：形成面向管理层的竞争判断和应对建议
- 输入契约：`manifests/workflow-contracts/strat.json#strat.competitor-brief@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.competitor-brief@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：外部检索内容必须经脱敏摘要（禁原文外发）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 competitor、move_type、impact、our_response 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 外部检索内容必须经脱敏摘要（禁原文外发）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 competitor-watch 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：外部检索内容必须经脱敏摘要（禁原文外发）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-competitor-brief-INPUT-REQUIRED` | invariant | all_required(competitor,move_type,impact,our_response) | active |
| `strategy-competitor-brief-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-competitor-brief-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-competitor-brief-DOMAIN-RULE` | domain_rule | 外部检索内容必须经脱敏摘要（禁原文外发） | active |
| `strategy-competitor-brief-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-competitor-brief-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-competitor-brief-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-competitor-brief-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-competitor-brief-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `strategy-competitor-brief-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-competitor-brief-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-competitor-brief-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-competitor-brief-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-competitor-brief-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-competitor-brief-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-competitor-brief-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-competitor-brief-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-competitor-brief-ACCEPT-1` | domain_rule | 外部检索内容必须经脱敏摘要（禁原文外发） | active |




## 经营监控与组织协同

把目标转成周度经营动作和组织能力决策

### 经营周报与偏差归因

- 工作流：`strat.weekly-report@1.0.0`
- 责任角色：经营分析负责人
- 频率：每周
- 结果：解释收入、订单与风险偏差并形成动作
- 输入契约：`manifests/workflow-contracts/strat.json#strat.weekly-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.weekly-report@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：数字可追溯到 data/strat/weekly.csv 行级

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 week、revenue_wan、orders、risks、next_actions 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 数字可追溯到 data/strat/weekly.csv 行级；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 biz-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：数字可追溯到 data/strat/weekly.csv 行级；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-weekly-report-INPUT-REQUIRED` | invariant | all_required(week,revenue_wan,orders,risks,next_actions) | active |
| `strategy-weekly-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-weekly-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-weekly-report-DOMAIN-RULE` | domain_rule | 数字可追溯到 data/strat/weekly.csv 行级 | active |
| `strategy-weekly-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-weekly-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-weekly-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-weekly-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-weekly-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `strategy-weekly-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-weekly-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-weekly-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-weekly-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-weekly-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-weekly-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-weekly-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-weekly-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-weekly-report-ACCEPT-1` | domain_rule | 数字可追溯到 data/strat/weekly.csv 行级 | active |




### 关键岗位与继任盘点

- 工作流：`strat.org-inventory@1.0.0`
- 责任角色：组织发展负责人
- 频率：季度
- 结果：识别关键岗位缺口、继任风险和优先行动
- 输入契约：`manifests/workflow-contracts/strat.json#strat.org-inventory@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.org-inventory@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：人员字段一律掩码（Type-Dict L4 口径）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 position、incumbent_masked、successor_masked、risk_level 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 人员字段一律掩码（Type-Dict L4 口径）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 biz-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：人员字段一律掩码（Type-Dict L4 口径）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-org-inventory-INPUT-REQUIRED` | invariant | all_required(position,incumbent_masked,successor_masked,risk_level) | active |
| `strategy-org-inventory-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-org-inventory-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-org-inventory-DOMAIN-RULE` | domain_rule | 人员字段一律掩码（Type-Dict L4 口径） | active |
| `strategy-org-inventory-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-org-inventory-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-org-inventory-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-org-inventory-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-org-inventory-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `strategy-org-inventory-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-org-inventory-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-org-inventory-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-org-inventory-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-org-inventory-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-org-inventory-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-org-inventory-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-org-inventory-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-org-inventory-ACCEPT-1` | policy_threshold | 人员字段一律掩码（Type-Dict L4 口径） | draft_requires_owner_confirmation |




## 战略复盘与关账

以证据复盘目标达成并授权资源调整

### 季度战略复盘

- 工作流：`strat.quarterly-review@1.0.0`
- 责任角色：总经理办公室
- 频率：季度
- 结果：评估目标达成、风险和下一周期举措
- 输入契约：`manifests/workflow-contracts/strat.json#strat.quarterly-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.quarterly-review@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：合并薪酬盘点仅区间口径；双审批通过方可归档

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 period、okr_reached、comp_review_flag、decision 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 合并薪酬盘点仅区间口径；双审批通过方可归档；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 strategy-decode 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：合并薪酬盘点仅区间口径；双审批通过方可归档；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-quarterly-review-INPUT-REQUIRED` | invariant | all_required(period,okr_reached,comp_review_flag,decision) | active |
| `strategy-quarterly-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-quarterly-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-quarterly-review-DOMAIN-RULE` | domain_rule | 合并薪酬盘点仅区间口径；双审批通过方可归档 | active |
| `strategy-quarterly-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-quarterly-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-quarterly-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-quarterly-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-quarterly-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `strategy-quarterly-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `strategy-quarterly-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-quarterly-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-quarterly-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-quarterly-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-quarterly-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-quarterly-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-quarterly-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-quarterly-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-quarterly-review-ACCEPT-1` | domain_rule | 合并薪酬盘点仅区间口径 | active |
| `strategy-quarterly-review-ACCEPT-2` | domain_rule | 双审批通过方可归档 | active |




### 季度关账与调薪包决议

- 工作流：`strat.quarter-close@1.0.0`
- 责任角色：CFO/HRD
- 频率：季度
- 结果：完成经营关账并触发预算/薪酬联动
- 输入契约：`manifests/workflow-contracts/strat.json#strat.quarter-close@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/strat.json#strat.quarter-close@1.0.0/output`
- TypeDict：`manifests/typedict/strat.json`
- 验收：调薪包触发 COMP 域双审批联动

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 period、highlights、comp_package_flag、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 调薪包触发 COMP 域双审批联动；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 salary_merged、ma_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 strategy-decode 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：调薪包触发 COMP 域双审批联动；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“战略目标达成率”并链接 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `strategy-quarter-close-INPUT-REQUIRED` | invariant | all_required(period,highlights,comp_package_flag,approvals) | active |
| `strategy-quarter-close-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `strategy-quarter-close-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `strategy-quarter-close-DOMAIN-RULE` | domain_rule | 调薪包触发 COMP 域双审批联动 | active |
| `strategy-quarter-close-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `strategy-quarter-close-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `strategy-quarter-close-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `strategy-quarter-close-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `strategy-quarter-close-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `strategy-quarter-close-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `strategy-quarter-close-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `strategy-quarter-close-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `strategy-quarter-close-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `strategy-quarter-close-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `strategy-quarter-close-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `strategy-quarter-close-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `strategy-quarter-close-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `strategy-quarter-close-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `strategy-quarter-close-ACCEPT-1` | domain_rule | 调薪包触发 COMP 域双审批联动 | active |




## 字段 TypeDict

- 字段数：55
- 契约数：6
