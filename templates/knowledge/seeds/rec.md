# 知识种子 · 招聘管理（rec）

> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。

## 实体类型

- `Position`
- `Candidate`
- `Interview`
- `Channel`

## 关系类型

- `APPLIES_TO`
- `INTERVIEWED_IN`
- `SOURCED_FROM`

## 建图规则

- 候选人实体只存匿名 ID + 技能/阶段属性
- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）
- 个体级 PII 字段不入实体属性（redact_gate 前置）
- 三元组样例：

```
(<实体:属性...>)-[:<关系>]->(<实体:属性...>)
```
