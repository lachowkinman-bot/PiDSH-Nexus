---
name: purchase-compare
domain: admin
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · purchase-compare

## 域定位

- 域：行政 ADMIN
- 北极星：资产利用、采购节约与服务 SLA
- 领域闭环：需求申请 -> 三家比价/供应商评估 -> 审批 -> 下单/入库 -> 资产分配 -> 盘点/维修/报废 -> SLA 复盘

## 输入

- 数据表：assets.csv、purchases.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-REV、KR-CONTROL。

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
  "fields": ["item","qty","amount_wan","budget_ok","approvals","quotes","lowest","chosen"]
}
```

## 决策与门禁

- 供应商是否中选
- 采购是否在预算内
- 资产如何分配/处置
- 是否允许用印
- 控制：至少三家比价或说明例外
- 控制：用印必须人工放行
- 控制：资产与离职流程联动
- 控制：价格与供应商敏感信息受控
- 脱敏字段：seal_record、procurement_price。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 采购节约率
- 资产利用率
- 服务 SLA
- 预算执行率

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
