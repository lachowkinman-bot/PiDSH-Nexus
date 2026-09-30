---
name: roi-review
domain: mkt-off
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · roi-review

## 域定位

- 域：营销（线下）MKT-OFF
- 北极星：活动投入产出比
- 领域闭环：活动立项 -> 预算/展位/物料审批 -> 现场执行 -> 线索去重移交 -> 活动 ROI 与经销商复盘

## 输入

- 数据表：dealer_agreements.csv、events.csv、materials.csv。
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
  "fields": ["event","budget_wan","actual_wan","roi","lessons","leads","dedup_pct","owner"]
}
```

## 决策与门禁

- 活动是否继续投入
- 供应商/场地是否可签约
- 物料能否对外
- 预算是否超包
- 控制：展位和物料对外前强制审批
- 控制：预算超阈值升级
- 控制：线索移交前去重和脱敏
- 控制：经销商条款按 L3 处理
- 脱敏字段：dealer_terms。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 活动 ROI
- 有效商机
- 线索移交率
- 经销商履约率

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
