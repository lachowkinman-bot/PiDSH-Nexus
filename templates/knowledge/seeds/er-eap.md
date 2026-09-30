# 知识种子 · 员工关系/EAP（er-eap）

> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。

## 实体类型

- `Case`
- `Offboarding`
- `Referral(anonymous)`
- `Resource`

## 关系类型

- `TRIGGERS`
- `REFERS_TO`
- `APPROVED_BY`

## 建图规则

- EAP 子图独立命名空间：匿名节点 + 禁跨域边 + 双审批引用
- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）
- 个体级 PII 字段不入实体属性（redact_gate 前置）
- 三元组样例：

```
(<实体:属性...>)-[:<关系>]->(<实体:属性...>)
```
