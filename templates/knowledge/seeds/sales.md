# 知识种子 · 销售管理（sales）

> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。

## 实体类型

- `Account`
- `Quote`
- `Contract`
- `Region`

## 关系类型

- `QUOTE_FOR`
- `SIGN_WITH`
- `DISCOUNT_NEEDS`

## 建图规则

- 折扣阈值规则作为图规则节点，触发审批路径
- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）
- 个体级 PII 字段不入实体属性（redact_gate 前置）
- 三元组样例：

```
(<实体:属性...>)-[:<关系>]->(<实体:属性...>)
```
