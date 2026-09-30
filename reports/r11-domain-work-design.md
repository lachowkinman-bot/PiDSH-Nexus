# R11 · 13 域模块、事项、工作流与数据契约闭环

## 结果

- 13 个域、39 个工作模块、78 个工作事项、78 个唯一工作流，一一对应。
- 737 个字段进入字段级 TypeDict，78 份输入/输出 JSON Schema 契约。
- 每条工作流至少 7 个环节，含输入、规则校验、LLM、质量门、审批策略、业务落盘与交付、成效评估、战略回写。
- 13 域均生成人类可读设计文档，并引用公开标准或优秀开源实践。
- 验证结果：`DOMAIN_WORK_DESIGN PASS 13/13`，工作流覆盖率 `78/78`，未知/重复映射均为 0。

## 核心文件

- 模块与事项真源：`manifests/domain-work-design/*.json`
- 输入/输出契约：`manifests/workflow-contracts/*.json`
- 字段级 TypeDict：`manifests/typedict/*.json`、`templates/Type-Dict/field-type-dict.csv`
- 校验 Schema：`manifests/schema/*.schema.json`
- 领域设计文档：`docs/domain-work-design/*.md`
- 盘问决策：`docs/domain-design/GRILL-DECISIONS.md`
- 领域模型 ADR：`docs/adr/ADR-0015-work-module-hierarchy-and-contracts.md`
- 外部标杆：`manifests/benchmark-sources.json`

## 外部标杆

采用的公开基准包括：

- OMG BPMN 2.0：流程、网关、人工任务与事件显式建模。
- JSON Schema 2020-12：输入、LLM 输出、审批和交付清单结构校验。
- OpenAPI 3.2.1：工作流平台接口及消息模型描述。
- Frictionless Table Schema：CSV 字段、类型、格式、主键和外键约束。
- OpenLineage：Job/Run/Dataset 血缘及运行状态事件。
- Great Expectations：把数据质量规则变成可重复执行的 Expectations。
- HR Open Standards、Schema.org JobPosting、Schema.org Order：人才、岗位、订单、报价等互操作语义。
- xAPI：学习经历的 Actor/Verb/Object/Result/Context 结构。
- XBRL：财务和经营数据 taxonomy 与可比较口径。
- NIST Privacy Framework、NIST AI RMF、COSO ERM：隐私、AI 风险和战略风险管理。
- WorldatWork Total Rewards、SHRM HR Q&A：薪酬福利和 HR 事项的责任与合规意识。
- Google Search Essentials、OpenActive：SEO 和活动机会数据建模。
- ISO 30414、ISO 55000、ISO 41001、EAPA：人力资本、资产、设施和员工援助标准引用。

## 验证

- `node scripts/design:build`：生成 13 域设计、78 份契约和 TypeDict。
- `node scripts/design:verify`：13/13 PASS。
- `node scripts/verify-workflow-platform.mjs`：19/19 PASS，78/78 正常路径，双审批、模型阻断、敏感输出、恢复和导入均通过。
- `node scripts/verify-workbench-ui-v4.mjs`：8/8 PASS，已验证模块、事项、环节标准、契约展示及 1100×700 视口。

## 设计边界

- 模块、事项、契约和 TypeDict 是生成物；手工修改生成文件会在下一次 `design:build` 被覆盖。
- 新增、删除或改名工作流时，必须先更新 `scripts/build-domain-work-design.mjs` 的域模块映射；`design:verify` 会拒绝不完整或重复的覆盖。
- 无人工审批的流程必须显式标记为 `no_human_approval`，不能把审批缺失当成默认通过。
