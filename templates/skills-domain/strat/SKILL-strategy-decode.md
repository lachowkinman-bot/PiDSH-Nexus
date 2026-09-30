---
name: strategy-decode
domain: strat
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · strategy-decode

## 域定位

- 域：战略 STRAT
- 北极星：战略目标达成率
- 领域闭环：环境/竞品输入 -> 战略解码 -> OKR/KR 定版 -> 组织与预算分解 -> 月度滚动复盘 -> 季度关账

## 输入

- 数据表：okr.csv、weekly.csv。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：KR-REV、KR-PIPE、KR-TALENT、KR-CAPABILITY、KR-CONTROL。

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
  "fields": ["period","okr_reached","comp_review_flag","decision","objective","kr_list","quarter","owner","highlights","comp_package_flag","approvals"]
}
```

## 决策与门禁

- 目标是否仍有战略有效性
- KR 是否可量化且责任到人
- 资源与组织是否支撑目标
- 偏差是否需要调整举措或预算
- 控制：目标口径与数据来源一致
- 控制：双审批后方可关账
- 控制：薪酬话题只出区间
- 控制：决议必须有责任人、期限和复核点
- 脱敏字段：salary_merged、ma_terms。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 战略目标达成率
- KR 达成数
- 预测偏差
- 重大风险关闭率

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
