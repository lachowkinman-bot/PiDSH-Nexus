# Knowledge Graphs 层操作手册（015 KG 扩展）

## 资产

| 资产 | 说明 |
|---|---|
| seeds/*.md（13 份） | 每域实体/关系/建图规则种子，注入 graph-memory |
| graph-memory.config.yaml | 图谱配置：命名空间分域、L4 隔离子图、EAP 禁用、召回测试线 |
| injection-corpus/（3 份脱敏语料） | 注入测试用合成文档（U7 召回 ≥80% + 敏感查询必触发审批） |

## KG 相关包（双生态，均已核验并预置）

| 能力 | 包 | 位置 |
|---|---|---|
| 图谱记忆（主图） | graph-memory@1.5.8 | offline/npm/（P0） |
| 向量+全文+图 | pi-vault-mind@0.16.36 | offline/catalog/ |
| 长上下文 | billion-context-pi@0.1.81 | offline/catalog/ |
| Obsidian wiki | @zosmaai/pi-llm-wiki@0.12.4 | offline/catalog/ |
| 记忆插件（dsh） | dsh-mnemon@0.5.16 / dsh-memory-plugin@0.7.2 / @openviking/dsh-memory-plugin@0.5.8 / dsh-client-ui-obsidian-memory@0.3.2 / @a9i5k4/dsh-auto-memory@3.1.7 | offline/catalog/ |
| 轻量记忆（pi） | pi-memory@0.4.2 / pi-memento@1.0.3 | offline/catalog/ |

## 注入与召回流程（S6 冒烟 + U7）

1. 复制 seeds + corpus 到 workspace/knowledge/
2. graph-memory 注入后做召回测试（种子内规则 ≥80% 命中）
3. 敏感探针：查询任一 L4 实体 → 必须返回 APPROVAL_REQUIRED
4. EAP 探针：EAP 内容查询 → 必须命中 exclude 拒绝
5. 结果写入 reports/memory-knowledge.md

## 边界

- pi-mentis（报告推荐）npm 实测不存在——V8 证据见 reports/catalog-download-failures.md；以 graph-memory + pi-vault-mind 替代
- 个体级 PII / EAP 内容永不入图（redact_gate + exclude 双闸）
