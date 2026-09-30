---
name: payroll-recon
domain: comp
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · payroll-recon

## 域定位

- 域：薪酬 COMP
- 北极星：薪酬带宽、成本与保留风险
- 领域闭环：岗位与带宽维护 -> 提案/晋级/绩效触发 -> 成本测算 -> 双审批 -> 生效 -> 薪酬对账和预算复盘

## 输入

- 数据表：adjust_queue.csv、bands.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-TALENT、KR-CAPABILITY、KR-CONTROL。

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
  "fields": ["period","headcount","gross_diff","items","scenario","pct","cost_impact_wan","note"]
}
```

## 决策与门禁

- 定薪是否在带宽
- 调薪包是否可承担
- 是否产生公平性风险
- 何时生效和回溯
- 控制：个体薪酬不落明文
- 控制：带宽和成本可追溯
- 控制：批量调薪双审批
- 控制：社保/公积金/个税公式固定版本
- 脱敏字段：salary、bank_account、id_number。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- Compa-Ratio
- 薪酬成本
- 带宽偏离
- 关键人才留存

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
