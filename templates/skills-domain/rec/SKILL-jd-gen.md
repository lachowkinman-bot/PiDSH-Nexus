---
name: jd-gen
domain: rec
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · jd-gen

## 用途

根据战略目标、组织缺口、岗位职责和能力标准，生成可招聘、可评价、可合规检查的岗位说明书与 JD。

## 输入

- 岗位需求、部门、编制、职责、地点和汇报关系。
- `comp/bands.csv` 薪酬带。
- 战略 KR、组织盘点和能力缺口。

## 生成要求

1. 输出岗位使命、关键结果、职责、必备/加分条件、成功指标和评价口径。
2. 把岗位关键结果与战略目标、部门 KPI 关联。
3. 薪酬信息只引用带宽区间，不出现个体薪酬。
4. 删除年龄、性别、婚育、健康、地域歧视等不合规表述。
5. 为后续简历筛选和面试题库生成统一能力字典。

## 输出契约

```json
{
  "position": "string",
  "mission": "string",
  "key_results": ["string"],
  "competencies": [{"name": "string", "weight": 0, "must_have": true, "evidence": "string"}],
  "responsibilities": ["string"],
  "requirements": {"must": ["string"], "preferred": ["string"]},
  "band": {"p25": 0, "p50": 0, "p75": 0},
  "compliance_checks": [{"item": "string", "result": "pass|fail", "note": "string"}]
}
```

## 质量检查

- 能力项与岗位关键结果有对应关系。
- 薪酬带引用 `comp.bands`，不得自造范围。
- 合规项任一失败不得进入对外发布。
