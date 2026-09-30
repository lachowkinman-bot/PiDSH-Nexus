---
name: onboarding-plan
domain: rec
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · 入职、30/60/90 天成效与质量复盘

## 用途

把 Offer 接受转化为清晰的入职任务链，并在入职后持续跟踪能力达标、业务成效和 90 天留存，回传招聘质量与战略目标。

## 输入

- Offer 状态、计划入职日、岗位、部门和直属经理。
- 账号、设备、工位、门禁、合同、培训和导师清单。
- 30/60/90 天目标、业务指标、试用期反馈和留存状态。
- 招聘来源、面试评分和岗位标准。

## LLM 任务

1. 生成责任人、到期日和验收证据明确的入职清单，标记关键依赖。
2. 根据岗位标准生成 30/60/90 天目标和评估方式。
3. 汇总试用期反馈、业务产出和留存结果，形成招聘质量评价。
4. 按来源渠道回算简历投递、筛选、面试、Offer、入职和 90 天留存漏斗。
5. 输出改进建议，并回写 `KR-TALENT`、招聘周期和渠道质量指标。

## 输出契约

```json
{
  "candidate_masked": "string",
  "start_date": "YYYY-MM-DD",
  "checklist": [{"item": "string", "owner": "string", "due": "YYYY-MM-DD", "status": "pending|done|blocked"}],
  "goals_30_60_90": [{"window": "30|60|90", "goal": "string", "measure": "string"}],
  "quality_of_hire": {"score": 0, "evidence_refs": ["string"]},
  "retention_90d": true,
  "channel_funnel": [{"source": "string", "applications": 0, "screened": 0, "interviewed": 0, "offers": 0, "hires": 0, "retained_90d": 0}],
  "strategy_metrics": ["KR-TALENT", "KR-CAPABILITY"]
}
```

## 门禁

- 未完成合同、权限、设备、培训等入职阻断项时不得标记入职完成。
- 绩效和健康相关信息不得进入未授权记忆层。
- 90 天未到不得伪造留存结果；应标记 `pending` 并给出计划复核日。

## 质量检查

- 所有清单项有责任人和到期日。
- 招聘质量结论可追溯到面试、业务反馈和留存证据。
- 渠道漏斗人数守恒，不能出现后一阶段大于前一阶段。
