# 知识种子 · 绩效管理（prf）

> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。

## 实体类型

- `KPI`
- `Review`
- `Cycle`
- `Calibration`

## 关系类型

- `SCORED_IN`
- `CALIBRATED_BY`
- `CASCADES_TO`

## 建图规则

- 考核结果实体 L4；校准关系记录双审批引用
- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）
- 个体级 PII 字段不入实体属性（redact_gate 前置）
- 三元组样例：

```
(<实体:属性...>)-[:<关系>]->(<实体:属性...>)
```
