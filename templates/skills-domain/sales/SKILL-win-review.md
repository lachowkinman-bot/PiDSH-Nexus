---
name: win-review
domain: sales
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · win-review

## 域定位

- 域：销售 SALES
- 北极星：有效管道与赢单收入
- 领域闭环：线索分配 -> 商机资格评估 -> 方案报价 -> 合同条款评审 -> 赢单/交付/回款 -> 输单与打法复盘

## 输入

- 数据表：pipeline.csv、quotes.csv、targets.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-PIPE、KR-REV。

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
  "fields": ["opportunity","amount_k","win_factors","playbook_update","contract_no","terms_risk","payment_terms","approvals"]
}
```

## 决策与门禁

- 商机是否值得继续投入
- 报价折扣是否可接受
- 合同条款是否可承担
- 输单原因是否可修正
- 控制：低于底价或高折扣必须升级审批
- 控制：合同回款条款偏离必须评审
- 控制：客户敏感信息只出必要字段
- 控制：赢单与财务收入勾稽
- 脱敏字段：customer_contract、discount_floor。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 有效管道
- 赢单收入
- 赢单率
- 销售周期

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
