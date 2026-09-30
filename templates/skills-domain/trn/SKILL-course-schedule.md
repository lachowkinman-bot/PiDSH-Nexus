---
name: course-schedule
domain: trn
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · course-schedule

## 域定位

- 域：培训 TRN
- 北极星：能力缺口闭合与证书合规
- 领域闭环：能力缺口识别 -> 培养计划 -> 课程排期 -> 报名和完成 -> 考试/证书 -> 学时与绩效成效复盘

## 输入

- 数据表：certificates.csv、courses.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-CAPABILITY、KR-CONTROL。

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
  "fields": ["course","hours","budget_wan","approver","date","trainer","room","employee_masked","prereq_ok","seats_left"]
}
```

## 决策与门禁

- 培训是否值得投入
- 候选课程是否匹配能力缺口
- 证书是否续期或拦截上岗
- 培训成效是否改善绩效
- 控制：外部课程和预算需审批
- 控制：换证审批前不得解除上岗拦截
- 控制：讲师/场地/学员冲突机检
- 控制：培训结论与绩效证据可追溯
- 脱敏字段：cert_id。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 能力缺口闭合率
- 培训通过率
- 证书合规率
- 培训 ROI

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
