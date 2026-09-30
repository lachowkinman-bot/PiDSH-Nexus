# 营销（线上）MKT-ON · 工作模块与闭环设计

- 北极星：合格线索与预计商机价值
- 战略贡献：KR-PIPE、KR-REV
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、GOOGLE-SEARCH-ESSENTIALS、SCHEMA-ORDER

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
| [GOOGLE-SEARCH-ESSENTIALS](https://developers.google.com/search/docs/essentials) | Google Search Essentials | verified | SEO 以技术可抓取、内容有用可靠、反垃圾和结构化数据为主线 |
| [SCHEMA-ORDER](https://schema.org/Order) | Schema.org Order | verified | 报价、订单、发票、折扣、付款状态和交付关系采用可互操作概念 |

## 内容与发布计划

建立受众、主题、渠道与发布节奏并完成品牌/隐私审批

### 内容日历与排期

- 工作流：`mkt-on.content-calendar@1.0.0`
- 责任角色：内容负责人
- 频率：双周滚动
- 结果：形成无冲突、可执行、可审批的内容计划
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.content-calendar@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.content-calendar@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：排期冲突（同日同渠道）须标红

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 date、channel、title、status 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 排期冲突（同日同渠道）须标红；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 content-gen 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：排期冲突（同日同渠道）须标红；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-content-calendar-INPUT-REQUIRED` | invariant | all_required(date,channel,title,status) | active |
| `mkt-on-content-calendar-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-content-calendar-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-content-calendar-DOMAIN-RULE` | domain_rule | 排期冲突（同日同渠道）须标红 | active |
| `mkt-on-content-calendar-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-content-calendar-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-content-calendar-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-content-calendar-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-content-calendar-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-on-content-calendar-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-content-calendar-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-content-calendar-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-content-calendar-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-content-calendar-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-content-calendar-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-content-calendar-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-content-calendar-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-content-calendar-ACCEPT-1` | domain_rule | 排期冲突（同日同渠道）须标红 | active |




### 内容发布审批

- 工作流：`mkt-on.publish-approve@1.0.0`
- 责任角色：品牌负责人
- 频率：按发布批次
- 结果：确保对外内容通过品牌、法务与隐私门禁
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.publish-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.publish-approve@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：含 PII 的素材必须 redact 后才可发布

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 title、channel、publish_at、pii_check、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 含 PII 的素材必须 redact 后才可发布；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 content-gen 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：含 PII 的素材必须 redact 后才可发布；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-publish-approve-INPUT-REQUIRED` | invariant | all_required(title,channel,publish_at,pii_check,approver) | active |
| `mkt-on-publish-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-publish-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-publish-approve-DOMAIN-RULE` | domain_rule | 含 PII 的素材必须 redact 后才可发布 | active |
| `mkt-on-publish-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-publish-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-publish-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-publish-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-publish-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `mkt-on-publish-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `mkt-on-publish-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-publish-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-publish-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-publish-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-publish-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-publish-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-publish-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-publish-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-publish-approve-ACCEPT-1` | domain_rule | 含 PII 的素材必须 redact 后才可发布 | active |




## 付费增长与预算控制

用可追溯归因管理渠道预算和 ROI

### 投放周报与渠道 ROI

- 工作流：`mkt-on.campaign-report@1.0.0`
- 责任角色：增长负责人
- 频率：每周
- 结果：识别渠道效率、浪费和预算迁移建议
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.campaign-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.campaign-report@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：ROI 数字可追溯到 data/mkt-on/leads.csv

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 channel、spend_wan、leads、roi、week 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | ROI 数字可追溯到 data/mkt-on/leads.csv；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 ad-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：ROI 数字可追溯到 data/mkt-on/leads.csv；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-campaign-report-INPUT-REQUIRED` | invariant | all_required(channel,spend_wan,leads,roi,week) | active |
| `mkt-on-campaign-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-campaign-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-campaign-report-DOMAIN-RULE` | domain_rule | ROI 数字可追溯到 data/mkt-on/leads.csv | active |
| `mkt-on-campaign-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-campaign-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-campaign-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-campaign-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-campaign-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-on-campaign-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-campaign-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-campaign-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-campaign-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-campaign-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-campaign-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-campaign-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-campaign-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-campaign-report-ACCEPT-1` | domain_rule | ROI 数字可追溯到 data/mkt-on/leads.csv | active |




### 投放加预算审批

- 工作流：`mkt-on.ad-spend-review@1.0.0`
- 责任角色：市场负责人
- 频率：按预算事件
- 结果：在阈值与预期 ROI 约束下调整预算
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.ad-spend-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.ad-spend-review@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：单周加预算 >10 万触发双审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 channel、current_spend_wan、increment_wan、expected_roi 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 单周加预算 >10 万触发双审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 ad-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：单周加预算 >10 万触发双审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-ad-spend-review-INPUT-REQUIRED` | invariant | all_required(channel,current_spend_wan,increment_wan,expected_roi) | active |
| `mkt-on-ad-spend-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-ad-spend-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-ad-spend-review-DOMAIN-RULE` | domain_rule | 单周加预算 >10 万触发双审批 | active |
| `mkt-on-ad-spend-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-ad-spend-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-ad-spend-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-ad-spend-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-ad-spend-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `mkt-on-ad-spend-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `mkt-on-ad-spend-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-ad-spend-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-ad-spend-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-ad-spend-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-ad-spend-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-ad-spend-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-ad-spend-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-ad-spend-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-ad-spend-review-ACCEPT-1` | policy_threshold | 单周加预算 >10 万触发双审批 | draft_requires_owner_confirmation |




## 线索质量与自然增长

把自然流量和线索质量接回销售管道

### 线索漏斗与质量分析

- 工作流：`mkt-on.lead-funnel@1.0.0`
- 责任角色：营销运营负责人
- 频率：每周
- 结果：按来源和阶段识别合格线索瓶颈
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.lead-funnel@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.lead-funnel@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：线索手机号/邮箱仅掩码口径

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 stage、count、conversion_pct、week 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 线索手机号/邮箱仅掩码口径；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 seo-audit 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：线索手机号/邮箱仅掩码口径；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-lead-funnel-INPUT-REQUIRED` | invariant | all_required(stage,count,conversion_pct,week) | active |
| `mkt-on-lead-funnel-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-lead-funnel-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-lead-funnel-DOMAIN-RULE` | domain_rule | 线索手机号/邮箱仅掩码口径 | active |
| `mkt-on-lead-funnel-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-lead-funnel-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-lead-funnel-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-lead-funnel-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-lead-funnel-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-on-lead-funnel-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-lead-funnel-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-lead-funnel-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-lead-funnel-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-lead-funnel-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-lead-funnel-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-lead-funnel-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-lead-funnel-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-lead-funnel-ACCEPT-1` | domain_rule | 线索手机号/邮箱仅掩码口径 | active |




### SEO 技术与内容诊断

- 工作流：`mkt-on.seo-audit@1.0.0`
- 责任角色：SEO 负责人
- 频率：月度/版本发布
- 结果：形成抓取、索引、内容和结构化数据修复清单
- 输入契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.seo-audit@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-on.json#mkt-on.seo-audit@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-on.json`
- 验收：外部抓取仅摘要，禁整站镜像

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 page、keywords、rank、issue 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 外部抓取仅摘要，禁整站镜像；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 lead_phone、lead_idcard 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 seo-audit 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：外部抓取仅摘要，禁整站镜像；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“合格线索与预计商机价值”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-on-seo-audit-INPUT-REQUIRED` | invariant | all_required(page,keywords,rank,issue) | active |
| `mkt-on-seo-audit-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-on-seo-audit-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-on-seo-audit-DOMAIN-RULE` | domain_rule | 外部抓取仅摘要，禁整站镜像 | active |
| `mkt-on-seo-audit-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-on-seo-audit-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-on-seo-audit-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-on-seo-audit-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-on-seo-audit-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-on-seo-audit-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-on-seo-audit-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-on-seo-audit-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-on-seo-audit-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-on-seo-audit-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-on-seo-audit-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-on-seo-audit-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-on-seo-audit-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-on-seo-audit-ACCEPT-1` | domain_rule | 外部抓取仅摘要，禁整站镜像 | active |




## 字段 TypeDict

- 字段数：52
- 契约数：6
