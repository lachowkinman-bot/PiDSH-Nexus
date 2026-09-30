# 行政 ADMIN · 工作模块与闭环设计

- 北极星：资产利用、采购节约与服务 SLA
- 战略贡献：KR-REV、KR-CONTROL
- 数据级别：L3
- 基准：BPMN20、JSONSCHEMA202012、OPENAPI321、TABLESCHEMA1、OPENLINEAGE153、GREATEXPECTATIONS、NIST-PRIVACY、NIST-AI-RMF、ISO-55000、COSO-ERM、ISO-41001

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
| [ISO-55000](https://www.iso.org/standard/55089.html) | ISO 55000 Asset Management | reference-only | 资产全生命周期、价值、风险和绩效闭环 |
| [COSO-ERM](https://www.coso.org/enterprise-risk-management) | COSO Enterprise Risk Management | verified | 风险与战略、绩效和决策连接，不以风险清单替代战略结果 |
| [ISO-41001](https://www.iso.org/standard/68021.html) | ISO 41001 Facility Management | reference-only | 设施管理以组织目标、服务水平、资源和持续改进为主线 |

## 采购与供应商管理

用三家比价、预算和入库闭环控制成本

### 供应商比价

- 工作流：`admin.vendor-price@1.0.0`
- 责任角色：采购负责人
- 频率：按采购申请
- 结果：报价、最低价、预算和选择理由一致
- 输入契约：`manifests/workflow-contracts/admin.json#admin.vendor-price@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.vendor-price@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：不足三家须说明理由

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 item、quotes、lowest、chosen 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 不足三家须说明理由；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 purchase-compare 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：不足三家须说明理由；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-vendor-price-INPUT-REQUIRED` | invariant | all_required(item,quotes,lowest,chosen) | active |
| `admin-vendor-price-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-vendor-price-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-vendor-price-DOMAIN-RULE` | domain_rule | 不足三家须说明理由 | active |
| `admin-vendor-price-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-vendor-price-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-vendor-price-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-vendor-price-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-vendor-price-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `admin-vendor-price-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-vendor-price-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-vendor-price-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-vendor-price-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-vendor-price-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-vendor-price-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-vendor-price-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-vendor-price-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-vendor-price-ACCEPT-1` | domain_rule | 不足三家须说明理由 | active |




### 采购审批

- 工作流：`admin.purchase-approve@1.0.0`
- 责任角色：行政/财务负责人
- 频率：按采购申请
- 结果：预算、数量和授权链完整
- 输入契约：`manifests/workflow-contracts/admin.json#admin.purchase-approve@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.purchase-approve@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：预算不足直接阻断；用印强制人工

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 item、qty、amount_wan、budget_ok、approvals 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 预算不足直接阻断；用印强制人工；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 purchase-compare 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：预算不足直接阻断；用印强制人工；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-purchase-approve-INPUT-REQUIRED` | invariant | all_required(item,qty,amount_wan,budget_ok,approvals) | active |
| `admin-purchase-approve-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-purchase-approve-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-purchase-approve-DOMAIN-RULE` | domain_rule | 预算不足直接阻断；用印强制人工 | active |
| `admin-purchase-approve-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-purchase-approve-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-purchase-approve-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-purchase-approve-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-purchase-approve-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `admin-purchase-approve-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `admin-purchase-approve-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-purchase-approve-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-purchase-approve-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-purchase-approve-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-purchase-approve-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-purchase-approve-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-purchase-approve-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-purchase-approve-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-purchase-approve-ACCEPT-1` | domain_rule | 预算不足直接阻断 | active |
| `admin-purchase-approve-ACCEPT-2` | domain_rule | 用印强制人工 | active |




### 用品下单

- 工作流：`admin.supply-order@1.0.0`
- 责任角色：行政专员
- 频率：按补货批次
- 结果：引用比价结果并正确登记数量和金额
- 输入契约：`manifests/workflow-contracts/admin.json#admin.supply-order@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.supply-order@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：必须引用比价结论（最低价或说明）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 item、vendor_masked、qty、amount_yuan 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 必须引用比价结论（最低价或说明）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 asset-inventory 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：必须引用比价结论（最低价或说明）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-supply-order-INPUT-REQUIRED` | invariant | all_required(item,vendor_masked,qty,amount_yuan) | active |
| `admin-supply-order-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-supply-order-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-supply-order-DOMAIN-RULE` | domain_rule | 必须引用比价结论（最低价或说明） | active |
| `admin-supply-order-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-supply-order-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-supply-order-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-supply-order-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-supply-order-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `admin-supply-order-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-supply-order-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-supply-order-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-supply-order-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-supply-order-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-supply-order-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-supply-order-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-supply-order-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-supply-order-ACCEPT-1` | domain_rule | 必须引用比价结论（最低价或说明） | active |




## 资产全生命周期

让采购、分配、盘点、维修和报废闭环

### 资产盘点与差异处理

- 工作流：`admin.asset-inventory@1.0.0`
- 责任角色：资产管理员
- 频率：季度/年度
- 结果：账实一致、使用人和状态可追溯
- 输入契约：`manifests/workflow-contracts/admin.json#admin.asset-inventory@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.asset-inventory@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：与 assets.csv 勾稽

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 asset_id、status、holder_masked、location 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 与 assets.csv 勾稽；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 asset-inventory 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：与 assets.csv 勾稽；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-asset-inventory-INPUT-REQUIRED` | invariant | all_required(asset_id,status,holder_masked,location) | active |
| `admin-asset-inventory-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-asset-inventory-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-asset-inventory-DOMAIN-RULE` | domain_rule | 与 assets.csv 勾稽 | active |
| `admin-asset-inventory-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-asset-inventory-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-asset-inventory-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-asset-inventory-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-asset-inventory-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `admin-asset-inventory-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-asset-inventory-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-asset-inventory-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-asset-inventory-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-asset-inventory-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-asset-inventory-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-asset-inventory-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-asset-inventory-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-asset-inventory-ACCEPT-1` | domain_rule | 与 assets.csv 勾稽 | active |




## 用印与会议服务

让高风险动作留痕、会议决议可跟踪

### 用印申请

- 工作流：`admin.seal-request@1.0.0`
- 责任角色：印章管理员
- 频率：按用印事件
- 结果：用印材料、次数和保管人确认完整
- 输入契约：`manifests/workflow-contracts/admin.json#admin.seal-request@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.seal-request@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：用印禁自动放行（必须人工确认）

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 doc、seal_type、copies、keeper_confirm 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 用印禁自动放行（必须人工确认）；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 meeting-minutes 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：用印禁自动放行（必须人工确认）；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 人工审批 | human_approval | 审批等级 L3；双审批必须两个不同角色和两个不同操作者；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。 | distinct_identity_role_and_operator |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-seal-request-INPUT-REQUIRED` | invariant | all_required(doc,seal_type,copies,keeper_confirm) | active |
| `admin-seal-request-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-seal-request-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-seal-request-DOMAIN-RULE` | domain_rule | 用印禁自动放行（必须人工确认） | active |
| `admin-seal-request-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-seal-request-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-seal-request-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-seal-request-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-seal-request-APPROVAL-IDENTITY` | invariant | distinct(operator_id, role) == 2 && all_registered_and_authorized | active |
| `admin-seal-request-APPROVAL-BINDING` | invariant | hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash | active |
| `admin-seal-request-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-seal-request-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-seal-request-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-seal-request-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-seal-request-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-seal-request-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-seal-request-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-seal-request-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-seal-request-ACCEPT-1` | domain_rule | 用印禁自动放行（必须人工确认） | active |




### 会议纪要与待办

- 工作流：`admin.meeting-minutes@1.0.0`
- 责任角色：行政/会议秘书
- 频率：按会议
- 结果：决议、责任人、期限和状态明确
- 输入契约：`manifests/workflow-contracts/admin.json#admin.meeting-minutes@1.0.0/input`
- 输出契约：`manifests/workflow-contracts/admin.json#admin.meeting-minutes@1.0.0/output`
- TypeDict：`manifests/typedict/admin.json`
- 验收：待办必须带责任人与期限

| 环节 | 类型 | 标准 | 门禁 |
|---|---|---|---|
| 业务输入与资料接收 | data_intake | 必填字段 meeting、decisions、todos、owners 完整；来源、上传文件、数据版本和文件哈希可追溯。 | required_fields_and_upload_safety |
| 结构与业务规则校验 | rule_gate | 待办必须带责任人与期限；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。；脱敏字段 seal_record、procurement_price 只能以掩码或区间形式进入后续阶段。 | typedict_and_domain_rules |
| LLM 结构化分析与生成 | llm_task | 使用技能 meeting-minutes 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。 | schema_citation_pii_model_availability |
| 质量、证据与一致性复核 | quality_gate | 业务验收：待办必须带责任人与期限；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。 | Great-Expectations-style_assertions |
| 免人工审批声明 | no_human_approval | 仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。 | no_external_or_irreversible_action |
| 业务落盘与交付物生成 | writeback_and_delivery | 写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。 | backup_atomic_write_and_format_validation |
| 成效与质量评估 | outcome_evaluation | 回写域北极星“资产利用、采购节约与服务 SLA”并链接 KR-REV、KR-CONTROL；结果可下钻到实例、源表和产物，未成熟结果保持 pending。 | metric_lineage_and_data_freshness |
| 战略回写与下一周期行动 | strategy_writeback | 按 KR 权重回写 KR-REV、KR-CONTROL，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。 | strategy_versioned_contribution |

**业务规则**

| 规则 | 类型 | 表达式 | 状态 |
|---|---|---|---|
| `admin-meeting-minutes-INPUT-REQUIRED` | invariant | all_required(meeting,decisions,todos,owners) | active |
| `admin-meeting-minutes-SOURCE-TRACEABLE` | invariant | source_refs.length >= 1 && file_hashes.valid | active |
| `admin-meeting-minutes-TYPEDICT` | invariant | types_enums_ranges_units_keys_valid | active |
| `admin-meeting-minutes-DOMAIN-RULE` | domain_rule | 待办必须带责任人与期限 | active |
| `admin-meeting-minutes-LLM-SCHEMA` | invariant | model_output.matches(workflow_output_schema) | active |
| `admin-meeting-minutes-LLM-EVIDENCE` | invariant | findings.every(has_evidence_ref) && confidence in [0,1] | active |
| `admin-meeting-minutes-LLM-PII` | policy | pii_scan(model_input, model_output, logs, memory, deliverables) == clean | invariant |
| `admin-meeting-minutes-QUALITY-EVIDENCE` | invariant | evidence_refs.every(resolvable) | active |
| `admin-meeting-minutes-NO-APPROVAL-POLICY` | invariant | no_external_send && no_effective_change && no_high_risk_individual_data | active |
| `admin-meeting-minutes-QUALITY-CONSISTENCY` | invariant | amounts_quantities_rates_funnel_reconcile | active |
| `admin-meeting-minutes-DELIVERY-MANIFEST` | invariant | artifact_manifest.complete && artifacts.every(has_sha256) | active |
| `admin-meeting-minutes-DELIVERY-FORMATS` | invariant | formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok | active |
| `admin-meeting-minutes-DELIVERY-HASH` | invariant | sha256_before == sha256_after | active |
| `admin-meeting-minutes-OUTCOME-LINEAGE` | invariant | metric_snapshot.has_instance_source_and_artifact_refs | active |
| `admin-meeting-minutes-OUTCOME-FRESHNESS` | invariant | outcome_data_date <= now && maturity_policy_satisfied | active |
| `admin-meeting-minutes-STRATEGY-WRITEBACK` | invariant | contribution_references_metric_snapshot_and_data_version | active |
| `admin-meeting-minutes-STRATEGY-VARIANCE` | invariant | variance_reason && next_period_actions.length >= 1 | active |
| `admin-meeting-minutes-ACCEPT-1` | domain_rule | 待办必须带责任人与期限 | active |




## 字段 TypeDict

- 字段数：50
- 契约数：6
