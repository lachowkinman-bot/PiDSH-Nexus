---
name: offer-evaluation
domain: rec
version: 2.0.0
min_level: L4
redact_gate: true
llm: required
---
# SKILL · 面试反馈综合、Offer 建议与双审批

## 用途

汇总用户提交的各轮面试数据和结构化反馈，识别证据冲突与风险，结合薪酬带形成 Offer 建议和草稿。未经人工角色签名审批，不得标记为可发送或生效。

## 输入

- 候选人与岗位信息。
- 各轮面试评分、评语、证据和面试官角色。
- 薪酬带、预算、编制和入职日期。
- 用户提交的风险说明、特批理由或候选人的期望范围。

## LLM 任务

1. 对每个能力汇总各轮证据，输出一致、分歧、待确认和证据不足项。
2. 给出总评分、置信度和 Hire / Hold / No-hire 建议；证据冲突时必须建议补面或人工裁决。
3. 根据薪酬带生成区间内 Offer 建议，识别是否超过 P75、预算不足或与其他岗位不平衡。
4. 生成 Offer 草稿、定制化沟通要点和入职前待办。
5. 输出双审批所需的数据版本、证据摘要和风险项；不得自行批准或自称已发送。

## 输出契约

```json
{
  "candidate_masked": "string",
  "position": "string",
  "feedback_summary": [{"competency": "string", "verdict": "consistent|divergent|insufficient", "evidence_refs": ["string"]}],
  "overall_recommendation": "hire|hold|no_hire",
  "confidence": 0,
  "offer_band": {"p25": 0, "p50": 0, "p75": 0, "proposed_range": ["min", "max"]},
  "risk_flags": ["string"],
  "draft_offer": "string",
  "approval_requirements": [{"role": "string", "reason": "string"}],
  "status": "draft|approval_required"
}
```

## 门禁

- 未取得用户提交的面试反馈时不得生成最终录用建议。
- 超过 P75、预算不足或证据冲突必须阻断自动通过并进入双审批。
- 审批记录必须包含角色、操作者签名、意见、数据版本和产物哈希。
- Offer 草稿不得包含未脱敏的个人信息或未经批准的口头承诺。

## 质量检查

- 每个结论可定位到面试反馈或岗位标准。
- 草稿、审批单、薪酬带和最终交付物字段一致。
- 模型不可用时保留草稿并阻断 Offer 发送。
