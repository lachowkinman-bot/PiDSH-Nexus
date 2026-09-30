---
name: flex-benefit
domain: ben
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · flex-benefit

## 域定位

- 域：福利 BEN
- 北极星：员工满意度、使用率与人均成本
- 领域闭环：福利策略 -> 供应商/方案比选 -> 参保和积分配置 -> 使用/理赔协办 -> 满意度 -> 成本与留存复盘

## 输入

- 数据表：checkup_distribution.csv、plans.csv、usage.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-TALENT、KR-CAPABILITY。

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
  "fields": ["employee_masked","points_total","selected","remaining","dimension","score","n","verbatim_theme"]
}
```

## 决策与门禁

- 方案是否入选
- 积分额度是否可持续
- 理赔/参保变更是否合规
- 福利投入是否有效
- 控制：健康数据只出聚合且 n<5 抑制
- 控制：心理支持内容转 EAP 匿名流程
- 控制：个人理赔金额只出区间
- 控制：供应商实名按掩码处理
- 脱敏字段：health_data、insurance_id。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 福利使用率
- 员工满意度
- 人均福利成本
- 理赔时效

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
