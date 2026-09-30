# 财务 FIN · 工作模块与闭环设计

- 北极星：确认收入与预算执行质量
- 战略贡献：KR-REV
- 数据级别：L4
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、XBRL、COSO-ERM

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
| [XBRL](https://www.xbrl.org/the-standard/what/an-introduction-to-xbrl/) | XBRL Digital Business Reporting | verified | 财务与经营指标采用可比较、计算机可读、带 taxonomy 语义的报表口径 |
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |

## 预算与经营计划

让预算、收入和成本口径一致并支持调整

### 预算调整审批

- 工作流：`fin.budget-review@1.0.0`
- 责任角色：财务负责人/部门负责人
- 频率：月度/季度
- 结果：预算变化有理由、影响和审批链
- 输入契约：`manifests/workflow-contracts/fin.json#fin.budget-review@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.budget-review@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：超包 10% 加签 CFO

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 dept、budget_wan、delta_wan、reason 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 超包 10% 加签 CFO；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 budget-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：超包 10% 加签 CFO；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-budget-review-INPUT-REQUIRED` | invariant | all_required(dept,budget_wan,delta_wan,reason) | active |
| `fin-budget-review-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-budget-review-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-budget-review-DOMAIN-RULE` | domain_rule | 超包 10% 加签 CFO | active |
| `fin-budget-review-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-budget-review-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-budget-review-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-budget-review-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-budget-review-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `fin-budget-review-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `fin-budget-review-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-budget-review-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-budget-review-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-budget-review-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-budget-review-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-budget-review-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-budget-review-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-budget-review-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-budget-review-ACCEPT-1` | policy_threshold | 超包 10% 加签 CFO | draft_requires_owner_confirmation |

**跨域副作用**

- strategy.budget.commitment → strat（键：initiative_key，失败：retain_outbox_and_retry）

### 月度经营报告

- 工作流：`fin.monthly-report@1.0.0`
- 责任角色：财务负责人
- 频率：每月
- 结果：收入、成本、净额自洽且可追溯
- 输入契约：`manifests/workflow-contracts/fin.json#fin.monthly-report@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.monthly-report@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：财报数字 A 级可溯（凭证级）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 period、revenue_wan、cost_wan、net_wan 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 财报数字 A 级可溯（凭证级）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 budget-analysis 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：财报数字 A 级可溯（凭证级）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-monthly-report-INPUT-REQUIRED` | invariant | all_required(period,revenue_wan,cost_wan,net_wan) | active |
| `fin-monthly-report-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-monthly-report-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-monthly-report-DOMAIN-RULE` | domain_rule | 财报数字 A 级可溯（凭证级） | active |
| `fin-monthly-report-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-monthly-report-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-monthly-report-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-monthly-report-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-monthly-report-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `fin-monthly-report-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-monthly-report-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-monthly-report-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-monthly-report-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-monthly-report-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-monthly-report-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-monthly-report-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-monthly-report-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-monthly-report-ACCEPT-1` | domain_rule | 财报数字 A 级可溯（凭证级） | active |




## 交易与费用控制

用三单匹配和审批控制费用与发票风险

### 发票要素与疑点校验

- 工作流：`fin.invoice-check@1.0.0`
- 责任角色：财务专员
- 频率：按发票批次
- 结果：税号、抬头、金额、连号和关联单一致
- 输入契约：`manifests/workflow-contracts/fin.json#fin.invoice-check@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.invoice-check@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：连号/抬头不一致直接 FAIL

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 invoice_no、amount_yuan、checks、result 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 连号/抬头不一致直接 FAIL；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 invoice-check 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：连号/抬头不一致直接 FAIL；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-invoice-check-INPUT-REQUIRED` | invariant | all_required(invoice_no,amount_yuan,checks,result) | active |
| `fin-invoice-check-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-invoice-check-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-invoice-check-DOMAIN-RULE` | domain_rule | 连号/抬头不一致直接 FAIL | active |
| `fin-invoice-check-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-invoice-check-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-invoice-check-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-invoice-check-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-invoice-check-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `fin-invoice-check-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-invoice-check-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-invoice-check-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-invoice-check-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-invoice-check-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-invoice-check-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-invoice-check-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-invoice-check-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-invoice-check-ACCEPT-1` | domain_rule | 连号/抬头不一致直接 FAIL | active |




### 报销预审与审批

- 工作流：`fin.expense-approve@1.0.0`
- 责任角色：财务/部门负责人
- 频率：按报销单
- 结果：费用合规、预算充足且审批级别正确
- 输入契约：`manifests/workflow-contracts/fin.json#fin.expense-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.expense-approve@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：L4 必须双审批；审批单与产物一致

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 expense_id、amount_yuan、level、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | L4 必须双审批；审批单与产物一致；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 expense-precheck 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：L4 必须双审批；审批单与产物一致；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L4；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-expense-approve-INPUT-REQUIRED` | invariant | all_required(expense_id,amount_yuan,level,approvals) | active |
| `fin-expense-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-expense-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-expense-approve-DOMAIN-RULE` | domain_rule | L4 必须双审批；审批单与产物一致 | active |
| `fin-expense-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-expense-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-expense-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-expense-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-expense-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `fin-expense-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `fin-expense-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-expense-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-expense-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-expense-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-expense-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-expense-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-expense-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-expense-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-expense-approve-ACCEPT-1` | policy_threshold | L4 必须双审批 | draft_requires_owner_confirmation |
| `fin-expense-approve-ACCEPT-2` | domain_rule | 审批单与产物一致 | active |




## 资金与合规抽审

让现金流、抽样审计和整改闭环

### 周现金流简报

- 工作流：`fin.cashflow-week@1.0.0`
- 责任角色：资金负责人
- 频率：每周
- 结果：流入、流出与余额勾稽且异常可解释
- 输入契约：`manifests/workflow-contracts/fin.json#fin.cashflow-week@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.cashflow-week@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：银行账户字段 L4 只出汇总

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 week、in_wan、out_wan、balance_wan 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 银行账户字段 L4 只出汇总；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 invoice-check 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：银行账户字段 L4 只出汇总；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-cashflow-week-INPUT-REQUIRED` | invariant | all_required(week,in_wan,out_wan,balance_wan) | active |
| `fin-cashflow-week-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-cashflow-week-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-cashflow-week-DOMAIN-RULE` | domain_rule | 银行账户字段 L4 只出汇总 | active |
| `fin-cashflow-week-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-cashflow-week-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-cashflow-week-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-cashflow-week-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-cashflow-week-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `fin-cashflow-week-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-cashflow-week-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-cashflow-week-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-cashflow-week-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-cashflow-week-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-cashflow-week-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-cashflow-week-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-cashflow-week-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-cashflow-week-ACCEPT-1` | policy_threshold | 银行账户字段 L4 只出汇总 | draft_requires_owner_confirmation |




### 报销抽审

- 工作流：`fin.reimburse-audit@1.0.0`
- 责任角色：内控负责人
- 频率：月度
- 结果：抽样比例、问题率和整改动作达到标准
- 输入契约：`manifests/workflow-contracts/fin.json#fin.reimburse-audit@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/fin.json#fin.reimburse-audit@1.0.0/output`
- TypeDict：`manifests/typedict/fin.json`
- 验收：抽样比例 ≥10%

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 sample_size、issues、issue_rate、actions 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 抽样比例 ≥10%；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 bank_account、invoice_taxid 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 expense-precheck 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：抽样比例 ≥10%；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“确认收入与预算执行质量”并链接 KR-REV；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `fin-reimburse-audit-INPUT-REQUIRED` | invariant | all_required(sample_size,issues,issue_rate,actions) | active |
| `fin-reimburse-audit-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `fin-reimburse-audit-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `fin-reimburse-audit-DOMAIN-RULE` | domain_rule | 抽样比例 ≥10% | active |
| `fin-reimburse-audit-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `fin-reimburse-audit-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `fin-reimburse-audit-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `fin-reimburse-audit-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `fin-reimburse-audit-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `fin-reimburse-audit-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `fin-reimburse-audit-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `fin-reimburse-audit-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `fin-reimburse-audit-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `fin-reimburse-audit-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `fin-reimburse-audit-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `fin-reimburse-audit-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `fin-reimburse-audit-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `fin-reimburse-audit-ACCEPT-1` | policy_threshold | 抽样比例 ≥10% | draft_requires_owner_confirmation |




## 字段 TypeDict

- 字段数：73
- 契约数：6
