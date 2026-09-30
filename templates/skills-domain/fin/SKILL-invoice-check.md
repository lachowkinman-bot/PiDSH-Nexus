---
name: invoice-check
domain: fin
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · invoice-check

## 域定位

- 域：财务 FIN
- 北极星：确认收入与预算执行质量
- 领域闭环：预算与凭证输入 -> 发票/报销三单匹配 -> 预算和税务校验 -> 审批支付/入账 -> 月报/现金流/预算复盘

## 输入

- 数据表：budget.csv、expenses.csv、invoices.csv、revenue_ledger.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-REV。

## LLM 任务

1. 读取并校验输入字段、枚举、引用完整性和单位口径；缺失或冲突字段标记为 `unknown`，不得猜测。
2. 对本域关键对象执行结构化分析、计算、风险识别、方案比较或文档生成。
3. 输出结论必须引用源数据行、用户输入字段或上游产物；每个建议必须说明预期结果、责任角色和验证指标。
4. 对需要人工决策的事项生成审批摘要，不替代审批人做决定。
5. 在工作流完成后回写域指标、质量和战略贡献证据。

## 输出契约

```json
{
  "summary": "string",
  "findings": [{"id": "string", "title": "string", "detail": "string", "severity": "info|warning|critical", "evidence_refs": ["string"]}],
  "recommendations": [{"id": "string", "title": "string", "detail": "string", "owner": "string", "due": "string"}],
  "confidence": 0,
  "evidence_refs": ["string"],
  "redactions": ["string"],
  "fields": ["invoice_no","amount_yuan","checks","result","week","in_wan","out_wan","balance_wan"]
}
```

## 决策与门禁

- 费用是否合规可报
- 预算是否充足
- 发票和税务是否异常
- 收入确认与现金流风险
- 控制：金额、税号、抬头和连号强制校验
- 控制：超预算和阈值审批
- 控制：银行账户与发票税号脱敏
- 控制：财报数字必须凭证级追溯
- 脱敏字段：bank_account、invoice_taxid。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 确认收入
- 净额
- 预算执行率
- 现金流余额

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
