---
name: calibration-analysis
domain: prf
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · calibration-analysis

## 域定位

- 域：绩效 PRF
- 北极星：目标达成率与校准质量
- 领域闭环：战略目标分解 -> KPI/OKR 设定 -> 日常跟踪 -> 自评/上级评 -> 校准会 -> 结果沟通/PIP -> 分布与激励复盘

## 输入

- 数据表：calibration.csv、kpi.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-REV、KR-CAPABILITY。

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
  "fields": ["employee_masked","manager_grade","calibrated_grade","approvals","grade","count","pct","target_pct"]
}
```

## 决策与门禁

- 目标权重是否合理
- 绩效证据是否充分
- 校准等级是否公平
- 是否进入 PIP/调薪候选
- 控制：L4 评语和分数强制脱敏
- 控制：双审批后方可生效
- 控制：校准纪要禁入记忆层
- 控制：申诉必须进入员工关系闭环
- 脱敏字段：review_score、review_note。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 目标达成率
- 校准一致性
- 强分布偏差
- PIP 转化率

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
