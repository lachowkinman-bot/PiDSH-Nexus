---
name: eap-referral
domain: er-eap
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · eap-referral

## 域定位

- 域：员工关系/EAP
- 北极星：案件闭环、留存与组织健康
- 领域闭环：案件/匿名转介受理 -> 风险评估与分级 -> 双审批 -> 调查/调解/转介 -> 结案 -> 离职/争议/组织健康复盘

## 输入

- 数据表：eap_referrals.csv、er_cases.csv。
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
  "fields": ["anon_id","direction","approvals","sessions","month","total_referrals","by_direction","dimension","score","n","trend"]
}
```

## 决策与门禁

- 是否受理和升级
- 转介方向是否适当
- 离职/处分是否生效
- 证据与隐私边界是否满足
- 控制：EAP 只处理匿名编号
- 控制：禁网、禁记忆层、独立命名空间
- 控制：双审批不可绕过
- 控制：n<5 不出分
- 脱敏字段：disciplinary_detail、eap_content、health_mental。
- 记忆层策略：{"pii_allowed":false,"exclude":["graph-memory","pi-hermes-memory"]}。

## 成功指标

- 案件闭环率
- 争议升级率
- 匿名转介完成率
- 组织健康脉搏

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
