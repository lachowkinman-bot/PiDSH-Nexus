---
name: evidence-pack
domain: cmp
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · evidence-pack

## 域定位

- 域：合规 CMP
- 北极星：合规率、风险闭环与审计发现
- 领域闭环：法规/制度输入 -> 风险识别与控制映射 -> PIPIA -> 整改 -> 证据封存 -> 审计和培训复盘

## 输入

- 数据表：pipia.csv、policy_checklist.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-CONTROL。

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
  "fields": ["case","evidence_items","hashes","packaged_at","filing","authority","deadline","days_left"]
}
```

## 决策与门禁

- 是否允许上线/处理数据
- 风险是否可接受
- 整改是否关闭
- 是否触发外部申报
- 控制：法律依据和证据引用必备
- 控制：高风险未降级禁止上线
- 控制：证据包 append-only
- 控制：审计留痕和双审批
- 脱敏字段：audit_working_papers。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 合规率
- 风险闭环率
- 审计留痕覆盖率
- 整改及时率

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
