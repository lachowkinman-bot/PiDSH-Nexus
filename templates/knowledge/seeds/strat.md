# 知识种子 · 战略管理（strat）

> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。

## 实体类型

- `Objective`
- `KeyResult`
- `Quarter`
- `Dept`
- `Risk`

## 关系类型

- `HAS_KR`
- `BELONGS_TO_DEPT`
- `MITIGATES`

## 建图规则

- 战略解码以年度目标为根实体；合并薪酬盘点数据只建 L4 隔离子图
- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）
- 个体级 PII 字段不入实体属性（redact_gate 前置）
- 三元组样例：

```
(<实体:属性...>)-[:<关系>]->(<实体:属性...>)
```
