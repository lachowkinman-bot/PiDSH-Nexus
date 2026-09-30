# 培训 TRN · 工作模块与闭环设计

- 北极星：能力缺口闭合与证书合规
- 战略贡献：KR-CAPABILITY、KR-CONTROL
- 数据级别：L3
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、HR-OPEN、ISO-30414、XAPI

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
| [ISO-30414](https://www.iso.org/standard/69338.html) | ISO 30414 Human Capital Reporting | reference-only | 人力资本指标分层、口径一致、可比较并支持内部与外部报告 |
| [XAPI](https://github.com/adlnet/xAPI-Spec) | Experience API (xAPI) | verified | 学习经历使用 Actor → Verb → Object 及 Result/Context 记录 |

## 能力需求与培训计划

把能力缺口转成预算、学时和课程计划

### 培训计划审批

- 工作流：`trn.plan-approve@1.0.0`
- 责任角色：培训负责人/部门负责人
- 频率：季度/年度
- 结果：课程、预算、学时与能力缺口对齐
- 输入契约：`manifests/workflow-contracts/trn.json#trn.plan-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.plan-approve@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：外部采购课程走审批

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 course、hours、budget_wan、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 外部采购课程走审批；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 course-schedule 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：外部采购课程走审批；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-plan-approve-INPUT-REQUIRED` | invariant | all_required(course,hours,budget_wan,approver) | active |
| `trn-plan-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-plan-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-plan-approve-DOMAIN-RULE` | domain_rule | 外部采购课程走审批 | active |
| `trn-plan-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-plan-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-plan-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-plan-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-plan-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `trn-plan-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `trn-plan-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-plan-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-plan-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-plan-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-plan-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-plan-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-plan-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-plan-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-plan-approve-ACCEPT-1` | domain_rule | 外部采购课程走审批 | active |




## 学习交付与报名

保证课程排期、讲师、场地和报名条件可控

### 课程排期与冲突检测

- 工作流：`trn.course-schedule@1.0.0`
- 责任角色：培训运营
- 频率：按课程批次
- 结果：讲师、场地、学员和时间不冲突
- 输入契约：`manifests/workflow-contracts/trn.json#trn.course-schedule@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.course-schedule@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：冲突自动标红并建议备选

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 course、date、trainer、room 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 冲突自动标红并建议备选；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 course-schedule 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：冲突自动标红并建议备选；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-course-schedule-INPUT-REQUIRED` | invariant | all_required(course,date,trainer,room) | active |
| `trn-course-schedule-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-course-schedule-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-course-schedule-DOMAIN-RULE` | domain_rule | 冲突自动标红并建议备选 | active |
| `trn-course-schedule-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-course-schedule-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-course-schedule-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-course-schedule-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-course-schedule-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `trn-course-schedule-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-course-schedule-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-course-schedule-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-course-schedule-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-course-schedule-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-course-schedule-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-course-schedule-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-course-schedule-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-course-schedule-ACCEPT-1` | domain_rule | 冲突自动标红并建议备选 | active |




### 报名确认

- 工作流：`trn.enroll-approve@1.0.0`
- 责任角色：培训专员
- 频率：按报名批次
- 结果：名额、前置课与资格条件满足
- 输入契约：`manifests/workflow-contracts/trn.json#trn.enroll-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.enroll-approve@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：前置课未修直接拒绝

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 course、employee_masked、prereq_ok、seats_left 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 前置课未修直接拒绝；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 course-schedule 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：前置课未修直接拒绝；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-enroll-approve-INPUT-REQUIRED` | invariant | all_required(course,employee_masked,prereq_ok,seats_left) | active |
| `trn-enroll-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-enroll-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-enroll-approve-DOMAIN-RULE` | domain_rule | 前置课未修直接拒绝 | active |
| `trn-enroll-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-enroll-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-enroll-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-enroll-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-enroll-approve-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `trn-enroll-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-enroll-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-enroll-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-enroll-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-enroll-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-enroll-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-enroll-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-enroll-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-enroll-approve-ACCEPT-1` | domain_rule | 前置课未修直接拒绝 | active |




## 证书合规与学习成效

确保资质不过期、培训有效并被业务验证

### 学时统计与补齐计划

- 工作流：`trn.hours-report@1.0.0`
- 责任角色：培训负责人
- 频率：月度
- 结果：部门、计划和完成学时可追溯
- 输入契约：`manifests/workflow-contracts/trn.json#trn.hours-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.hours-report@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：学时数字可追溯 courses.csv

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dept、planned_h、completed_h、rate 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 学时数字可追溯 courses.csv；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 hour-stats 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：学时数字可追溯 courses.csv；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-hours-report-INPUT-REQUIRED` | invariant | all_required(dept,planned_h,completed_h,rate) | active |
| `trn-hours-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-hours-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-hours-report-DOMAIN-RULE` | domain_rule | 学时数字可追溯 courses.csv | active |
| `trn-hours-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-hours-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-hours-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-hours-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-hours-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `trn-hours-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-hours-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-hours-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-hours-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-hours-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-hours-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-hours-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-hours-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-hours-report-ACCEPT-1` | domain_rule | 学时数字可追溯 courses.csv | active |




### 证书到期预警

- 工作流：`trn.cert-expiry@1.0.0`
- 责任角色：合规培训负责人
- 频率：每日/每周
- 结果：90 天预警、过期拦截和责任明确
- 输入契约：`manifests/workflow-contracts/trn.json#trn.cert-expiry@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.cert-expiry@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：90 天内到期必须列出；过期立即拦截

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 certificate、holder_masked、expire_date、days_left 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 90 天内到期必须列出；过期立即拦截；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 cert-expiry 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：90 天内到期必须列出；过期立即拦截；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-cert-expiry-INPUT-REQUIRED` | invariant | all_required(certificate,holder_masked,expire_date,days_left) | active |
| `trn-cert-expiry-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-cert-expiry-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-cert-expiry-DOMAIN-RULE` | domain_rule | 90 天内到期必须列出；过期立即拦截 | active |
| `trn-cert-expiry-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-cert-expiry-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-cert-expiry-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-cert-expiry-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-cert-expiry-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `trn-cert-expiry-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-cert-expiry-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-cert-expiry-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-cert-expiry-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-cert-expiry-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-cert-expiry-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-cert-expiry-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-cert-expiry-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-cert-expiry-ACCEPT-1` | policy_threshold | 90 天内到期必须列出 | draft_requires_owner_confirmation |
| `trn-cert-expiry-ACCEPT-2` | domain_rule | 过期立即拦截 | active |




### 证书复审与换证审批

- 工作流：`trn.cert-renew@1.0.0`
- 责任角色：合规负责人
- 频率：按证书事件
- 结果：续期证据、费用和上岗状态一致
- 输入契约：`manifests/workflow-contracts/trn.json#trn.cert-renew@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/trn.json#trn.cert-renew@1.0.0/output`
- TypeDict：`manifests/typedict/trn.json`
- 验收：岗位强依赖证书过期未续 = 上岗拦截

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 certificate、holder_masked、renew_fee、approver 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 岗位强依赖证书过期未续 = 上岗拦截；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 cert_id 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 hour-stats 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：岗位强依赖证书过期未续 = 上岗拦截；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“能力缺口闭合与证书合规”并链接 KR-CAPABILITY、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-CAPABILITY、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `trn-cert-renew-INPUT-REQUIRED` | invariant | all_required(certificate,holder_masked,renew_fee,approver) | active |
| `trn-cert-renew-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `trn-cert-renew-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `trn-cert-renew-DOMAIN-RULE` | domain_rule | 岗位强依赖证书过期未续 = 上岗拦截 | active |
| `trn-cert-renew-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `trn-cert-renew-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `trn-cert-renew-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `trn-cert-renew-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `trn-cert-renew-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `trn-cert-renew-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `trn-cert-renew-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `trn-cert-renew-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `trn-cert-renew-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `trn-cert-renew-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `trn-cert-renew-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `trn-cert-renew-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `trn-cert-renew-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `trn-cert-renew-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `trn-cert-renew-ACCEPT-1` | domain_rule | 岗位强依赖证书过期未续 = 上岗拦截 | active |




## 字段 TypeDict

- 字段数：51
- 契约数：6
