---
name: interview-design
domain: rec
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · 面试安排、针对性题库与评分卡

## 用途

根据岗位标准、简历证据和已确认的待考察项，设计结构化面试流程、针对性问题、追问路径和统一评分卡。

## 输入

- 候选人的技能与经历证据卡。
- 岗位能力模型和面试轮次。
- 面试官角色、可用时间和地点/视频方式。
- 历史面试评分与用人经理关注项。

## LLM 任务

1. 将岗位能力映射到各轮次，明确主考能力、证据来源和不得重复考察的内容。
2. 为每项能力生成行为面试题、情境题或案例题，并给出追问、满分锚点和扣分锚点。
3. 检测面试官时间冲突、同时候选人冲突和缺少评分维度。
4. 输出候选人与面试官的脱敏日程、题库和评分卡。

## 输出契约

```json
{
  "candidate_masked": "string",
  "round": "first|second|final",
  "slot": "YYYY-MM-DD HH:mm",
  "interviewers": ["masked-name"],
  "competencies": [{"name": "string", "evidence": ["string"], "questions": ["string"], "rubric": [{"level": 1, "anchor": "string"}]}],
  "conflicts": [{"type": "string", "detail": "string"}],
  "scorecard_id": "string",
  "evidence_refs": ["workspace:data/rec/interviews.csv#row"]
}
```

## 门禁

- 问题不得涉及婚育、年龄、健康、宗教、民族等受保护属性。
- 冲突未解决时不得标记“安排完成”。
- 题库必须与岗位能力一一对应，不得复制与岗位无关的通用问题充数。

## 质量检查

- 每个能力至少一道主问题、一个追问和可执行评分锚点。
- 面试官同时段冲突必须显式列出并提供备选时段。
