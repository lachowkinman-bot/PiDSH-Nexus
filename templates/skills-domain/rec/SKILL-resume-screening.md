---
name: resume-screening
domain: rec
version: 2.0.0
min_level: L3
redact_gate: true
llm: required
---
# SKILL · 简历解析、真实性校验与岗位匹配

## 用途

把用户上传的 PDF、DOCX、TXT 或粘贴文本解析为统一的候选人证据卡，完成格式、完整性和岗位匹配评价，输出可供人工复核的短名单。不得直接自动淘汰候选人。

## 输入

- 岗位需求：`position`、职责、必备条件、加分条件、地点、招聘批次。
- 简历原件或文本；文件类型、页数、哈希和上传时间。
- 岗位薪酬带 `comp/bands.csv`、组织与用工约束。

## LLM 任务

1. 识别教育、经历、项目、技能、证书和时间线，不推断性别、民族、婚育、健康、宗教等敏感属性。
2. 校验时间线冲突、缺失字段、无法解析内容、疑似夸大或与岗位无关的信息，并给出证据页码或原文片段。
3. 对必备条件逐项做 `met / partial / not_met / unknown` 判定，不得把 unknown 当作通过或淘汰。
4. 按岗位评价 rubric 输出 0-100 分、置信度、优势、风险、待确认问题和建议追问。
5. 只生成候选短名单和复核建议，最终外发仍需 `rec.resume-forward` 双审批。

## 输出契约

```json
{
  "candidate_masked": "string",
  "position": "string",
  "parse_status": "complete|partial|failed",
  "evidence_refs": ["file:page-or-section"],
  "criteria": [{"criterion": "string", "result": "met|partial|not_met|unknown", "evidence": "string"}],
  "match_score": 0,
  "confidence": 0,
  "strengths": ["string"],
  "risks": ["string"],
  "questions": ["string"],
  "recommendation": "advance|hold|manual_review",
  "redactions": ["candidate_phone", "candidate_idcard"]
}
```

## 门禁

- 简历不得写入记忆层，不得向公网模型发送未脱敏联系方式或身份证号。
- 所有评分必须有证据引用；无岗位必备条件或无法解析时不得给确定通过结论。
- 招聘歧视、健康、婚育和家庭信息不得作为评价维度。

## 质量检查

- 必备条件逐项覆盖，风险与优势均有来源。
- `score` 与 `recommendation` 不得互相矛盾；不一致时返回人工复核。
- 模型失败时保留解析中间态并置 `blocked_model`，不得生成正式面试或外发结果。
