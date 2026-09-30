# 营销（线下）MKT-OFF · 工作模块与闭环设计

- 北极星：活动投入产出比
- 战略贡献：KR-PIPE、KR-REV
- 数据级别：L3
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、OPENACTIVE、COSO-ERM、SCHEMA-ORDER

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
| [OPENACTIVE](https://www.openactive.io/modelling-opportunity-data/) | OpenActive Modelling Opportunity Data 2.0 | verified | 活动、场地、时段、参与条件和事件状态统一建模 |
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |
| [SCHEMA-ORDER](https://schema.org/Order) | Schema.org Order | verified | 报价、订单、发票、折扣、付款状态和交付关系采用可互操作概念 |

## 活动组合与立项

选择活动组合并控制预算、场地和签约风险

### 活动策划与立项

- 工作流：`mkt-off.event-plan@1.0.0`
- 责任角色：活动负责人
- 频率：按项目
- 结果：形成目标、受众、预算、场地和排期一致方案
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.event-plan@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.event-plan@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：预算超部门季度包 20% 触发审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 event、city、budget_wan、schedule 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 预算超部门季度包 20% 触发审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 event-plan 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：预算超部门季度包 20% 触发审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-event-plan-INPUT-REQUIRED` | invariant | all_required(event,city,budget_wan,schedule) | active |
| `mkt-off-event-plan-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-event-plan-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-event-plan-DOMAIN-RULE` | domain_rule | 预算超部门季度包 20% 触发审批 | active |
| `mkt-off-event-plan-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-event-plan-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-event-plan-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-event-plan-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-event-plan-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-off-event-plan-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-event-plan-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-event-plan-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-event-plan-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-event-plan-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-event-plan-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-event-plan-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-event-plan-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-event-plan-ACCEPT-1` | policy_threshold | 预算超部门季度包 20% 触发审批 | draft_requires_owner_confirmation |




### 展位与场地签约审批

- 工作流：`mkt-off.booth-approve@1.0.0`
- 责任角色：市场负责人
- 频率：按签约事件
- 结果：在成本和日期约束下完成场地决策
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.booth-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.booth-approve@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：单场签约 >30 万双审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 venue、cost_wan、dates、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 单场签约 >30 万双审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 event-plan 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：单场签约 >30 万双审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-booth-approve-INPUT-REQUIRED` | invariant | all_required(venue,cost_wan,dates,approver) | active |
| `mkt-off-booth-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-booth-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-booth-approve-DOMAIN-RULE` | domain_rule | 单场签约 >30 万双审批 | active |
| `mkt-off-booth-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-booth-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-booth-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-booth-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-booth-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `mkt-off-booth-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `mkt-off-booth-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-booth-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-booth-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-booth-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-booth-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-booth-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-booth-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-booth-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-booth-approve-ACCEPT-1` | policy_threshold | 单场签约 >30 万双审批 | draft_requires_owner_confirmation |




## 现场执行与物料控制

确保物料合规、现场执行可控、线索可回收

### 物料合规与品牌审查

- 工作流：`mkt-off.material-review@1.0.0`
- 责任角色：品牌/法务负责人
- 频率：按物料版本
- 结果：对外物料满足法务、品牌和隐私要求
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.material-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.material-review@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：任一未过即不得外发；外发走审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 material、legal_check、brand_check、final_status 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 任一未过即不得外发；外发走审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 material-compliance 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：任一未过即不得外发；外发走审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-material-review-INPUT-REQUIRED` | invariant | all_required(material,legal_check,brand_check,final_status) | active |
| `mkt-off-material-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-material-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-material-review-DOMAIN-RULE` | domain_rule | 任一未过即不得外发；外发走审批 | active |
| `mkt-off-material-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-material-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-material-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-material-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-material-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `mkt-off-material-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `mkt-off-material-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-material-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-material-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-material-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-material-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-material-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-material-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-material-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-material-review-ACCEPT-1` | domain_rule | 任一未过即不得外发 | active |
| `mkt-off-material-review-ACCEPT-2` | domain_rule | 外发走审批 | active |




### 活动 ROI 复盘

- 工作流：`mkt-off.event-roi@1.0.0`
- 责任角色：营销运营负责人
- 频率：活动结束后
- 结果：比较预算与实际并沉淀可复制的活动经验
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.event-roi@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.event-roi@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：数字可追溯到 data/mkt-off/events.csv

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 event、budget_wan、actual_wan、roi、lessons 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 数字可追溯到 data/mkt-off/events.csv；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 roi-review 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：数字可追溯到 data/mkt-off/events.csv；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-event-roi-INPUT-REQUIRED` | invariant | all_required(event,budget_wan,actual_wan,roi,lessons) | active |
| `mkt-off-event-roi-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-event-roi-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-event-roi-DOMAIN-RULE` | domain_rule | 数字可追溯到 data/mkt-off/events.csv | active |
| `mkt-off-event-roi-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-event-roi-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-event-roi-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-event-roi-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-event-roi-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-off-event-roi-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-event-roi-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-event-roi-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-event-roi-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-event-roi-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-event-roi-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-event-roi-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-event-roi-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-event-roi-ACCEPT-1` | domain_rule | 数字可追溯到 data/mkt-off/events.csv | active |




## 渠道与线索移交

让经销商执行可衡量、线索可归因、隐私可控制

### 经销商条款执行简报

- 工作流：`mkt-off.vendor-brief@1.0.0`
- 责任角色：渠道负责人
- 频率：月度
- 结果：识别条款偏离、渠道风险和整改动作
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.vendor-brief@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.vendor-brief@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：经销商条款 L3 脱敏

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dealer_masked、terms_exec、sellthrough、risk 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 经销商条款 L3 脱敏；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 material-compliance 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：经销商条款 L3 脱敏；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-vendor-brief-INPUT-REQUIRED` | invariant | all_required(dealer_masked,terms_exec,sellthrough,risk) | active |
| `mkt-off-vendor-brief-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-vendor-brief-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-vendor-brief-DOMAIN-RULE` | domain_rule | 经销商条款 L3 脱敏 | active |
| `mkt-off-vendor-brief-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-vendor-brief-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-vendor-brief-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-vendor-brief-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-vendor-brief-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-off-vendor-brief-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-vendor-brief-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-vendor-brief-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-vendor-brief-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-vendor-brief-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-vendor-brief-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-vendor-brief-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-vendor-brief-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-vendor-brief-ACCEPT-1` | policy_threshold | 经销商条款 L3 脱敏 | draft_requires_owner_confirmation |




### 线下线索去重与移交

- 工作流：`mkt-off.lead-handoff@1.0.0`
- 责任角色：线索运营负责人
- 频率：按活动批次
- 结果：在脱敏和去重后把线索转为销售机会
- 输入契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.lead-handoff@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/mkt-off.json#mkt-off.lead-handoff@1.0.0/output`
- TypeDict：`manifests/typedict/mkt-off.json`
- 验收：移交前必须过 redact_gate

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 event、leads、dedup_pct、owner 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 移交前必须过 redact_gate；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 dealer_terms 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 roi-review 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：移交前必须过 redact_gate；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“活动投入产出比”并链接 KR-PIPE、KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-PIPE、KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `mkt-off-lead-handoff-INPUT-REQUIRED` | invariant | all_required(event,leads,dedup_pct,owner) | active |
| `mkt-off-lead-handoff-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `mkt-off-lead-handoff-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `mkt-off-lead-handoff-DOMAIN-RULE` | domain_rule | 移交前必须过 redact_gate | active |
| `mkt-off-lead-handoff-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `mkt-off-lead-handoff-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `mkt-off-lead-handoff-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `mkt-off-lead-handoff-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `mkt-off-lead-handoff-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `mkt-off-lead-handoff-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `mkt-off-lead-handoff-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `mkt-off-lead-handoff-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `mkt-off-lead-handoff-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `mkt-off-lead-handoff-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `mkt-off-lead-handoff-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `mkt-off-lead-handoff-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `mkt-off-lead-handoff-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `mkt-off-lead-handoff-ACCEPT-1` | domain_rule | 移交前必须过 redact_gate | active |

**跨域副作用**

- sales.pipeline.lead → sales（键：customer_key，失败：retain_outbox_and_retry）

## 字段 TypeDict

- 字段数：72
- 契约数：6
