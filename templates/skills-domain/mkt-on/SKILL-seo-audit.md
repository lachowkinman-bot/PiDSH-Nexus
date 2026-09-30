---
name: seo-audit
domain: mkt-on
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · seo-audit

## 域定位

- 域：营销（线上）MKT-ON
- 北极星：合格线索与预计商机价值
- 领域闭环：受众与渠道策略 -> 内容/投放计划 -> 合规与发布审批 -> 线索获取与培育 -> ROI/内容/SEO 复盘

## 输入

- 数据表：ad_spend.csv、content_calendar.csv、leads.csv。
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
  "fields": ["stage","count","conversion_pct","week","page","keywords","rank","issue"]
}
```

## 决策与门禁

- 预算是否转向高 ROI 渠道
- 内容是否符合品牌和合规
- 线索质量是否达到销售标准
- SEO/投放优化优先级
- 控制：触达素材必须经过个人信息与品牌检查
- 控制：线索联系信息只出掩码
- 控制：广告与内容外发需审批
- 控制：归因口径不得混用
- 脱敏字段：lead_phone、lead_idcard。
- 记忆层策略：{"pii_allowed":false,"exclude":[]}。

## 成功指标

- 合格线索数
- 预计商机价值
- CAC
- 渠道 ROI

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 `blocked_model`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
