---
name: funnel-analysis
domain: rec
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · funnel-analysis

## 用途

分析渠道、筛选、面试、Offer、入职和 90 天留存漏斗，定位转化瓶颈、渠道质量、招聘周期与成本问题。

## 输入

- `candidates.csv`、`interviews.csv`、`funnel.csv`。
- 周期、部门、岗位和渠道筛选条件。
- 岗位编制、招聘周期目标和 90 天留存目标。

## 分析要求

1. 使用同一口径输出投递、初筛、面试、Offer、入职和 90 天留存数量。
2. 同时计算段间转化率和以投递为基期的累计转化率，禁止混用。
3. 按渠道、岗位、部门和周次拆分，标注样本量不足的结论。
4. 识别瓶颈，并给出可执行动作、负责人建议和验证指标。
5. 回写 `KR-TALENT`：入职人数、招聘周期、Offer 接受率、入职后 90 天留存。

## 输出契约

```json
{
  "period": "string",
  "funnel": [{"stage": "string", "count": 0, "stage_conversion_pct": 0, "cumulative_conversion_pct": 0}],
  "by_source": [{"source": "string", "applications": 0, "hires": 0, "retained_90d": 0, "quality_score": 0}],
  "bottlenecks": [{"stage": "string", "evidence_refs": ["string"], "recommendation": "string"}],
  "metrics": {"time_to_fill_days": 0, "offer_acceptance_pct": 0, "quality_of_hire": 0},
  "confidence": 0
}
```

## 质量检查

- 后一阶段人数不得大于前一阶段。
- 所有百分比可复算，所有瓶颈可下钻到源行。
- 样本量不足时给出置信度，不输出确定性结论。
