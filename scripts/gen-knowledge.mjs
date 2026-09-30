#!/usr/bin/env node
// gen-knowledge.mjs — Knowledge Graphs 层生成器（015 目录扩展：完整 KG 资产）
// 产出：templates/knowledge/{graph-memory.config.yaml, README.md, seeds/<13域>.md, injection-corpus/3 份脱敏语料}
// 用法：node scripts/gen-knowledge.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
let n = 0;
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); n++; };

// —— 每域 KG 种子：实体类型 / 关系类型 / 关键规则（与 Type-Dict 对齐）——
const K = [
  ['strat', '战略管理', ['Objective', 'KeyResult', 'Quarter', 'Dept', 'Risk'], ['HAS_KR', 'BELONGS_TO_DEPT', 'MITIGATES'], '战略解码以年度目标为根实体；合并薪酬盘点数据只建 L4 隔离子图'],
  ['mkt', '营销管理', ['Campaign', 'Channel', 'Lead', 'Content', 'Dealer'], ['RUNS_ON', 'GENERATES_LEAD', 'COMPLIANCE_CHECK'], '线索 PII 不入图谱实体属性，只保留匿名 ID'],
  ['sales', '销售管理', ['Account', 'Quote', 'Contract', 'Region'], ['QUOTE_FOR', 'SIGN_WITH', 'DISCOUNT_NEEDS'], '折扣阈值规则作为图规则节点，触发审批路径'],
  ['fin', '财务管理', ['Expense', 'Budget', 'Invoice', 'Dept'], ['CHARGES_TO', 'EXCEEDS_BUDGET', 'VALIDATED_BY'], '超预算关系触发强审批；银行账户字段禁入图'],
  ['rec', '招聘管理', ['Position', 'Candidate', 'Interview', 'Channel'], ['APPLIES_TO', 'INTERVIEWED_IN', 'SOURCED_FROM'], '候选人实体只存匿名 ID + 技能/阶段属性'],
  ['trn', '培训管理', ['Course', 'Employee(anonymous)', 'Certificate', 'Window'], ['ENROLLED_IN', 'CERTIFIES', 'EXPIRES_BEFORE'], '资质到期边是排班拦截的图查询入口'],
  ['prf', '绩效管理', ['KPI', 'Review', 'Cycle', 'Calibration'], ['SCORED_IN', 'CALIBRATED_BY', 'CASCADES_TO'], '考核结果实体 L4；校准关系记录双审批引用'],
  ['comp', '薪酬管理', ['Band', 'SalaryStructure(anonymous)', 'Proposal'], ['WITHIN_BAND', 'DEVIATES_FROM', 'APPROVED_BY'], '个体薪酬不入图；只建带宽/偏离/审批关系'],
  ['ben', '福利设计', ['Plan', 'Vendor', 'Benefit', 'Enrollment(anonymous)'], ['OFFERED_BY', 'COMPARES_TO', 'COVERS'], '健康数据不入图，仅聚合统计节点'],
  ['admin', '行政管理', ['PurchaseRequest', 'Supplier', 'Asset', 'SealRequest'], ['REQUESTS', 'SUPPLIES', 'REQUIRES_SEAL'], '用印关系节点强制挂接 HITL 审批引用'],
  ['cmp', '合规管理', ['Policy', 'Requirement', 'Evidence', 'Audit'], ['IMPLEMENTS', 'EVIDENCED_BY', 'AUDITED_IN'], '证据链五级边：Requirement→Implementation→Test→Evidence→Release'],
  ['er-eap', '员工关系/EAP', ['Case', 'Offboarding', 'Referral(anonymous)', 'Resource'], ['TRIGGERS', 'REFERS_TO', 'APPROVED_BY'], 'EAP 子图独立命名空间：匿名节点 + 禁跨域边 + 双审批引用'],
  ['base', '通用底座', ['Workspace', 'Skill', 'Tool', 'Approval', 'Artifact'], ['USES', 'PRODUCES', 'REQUIRES_APPROVAL'], 'Chassis 级实体与跨域关系骨架；所有域子图挂接于此'],
];

for (const [code, name, ents, rels, rule] of K) {
  w(path.join(ROOT, `templates/knowledge/seeds/${code}.md`), `# 知识种子 · ${name}（${code}）\n\n> graph-memory / pi-vault-mind 注入用种子文档。注入测试：召回 ≥80%，敏感操作 100% 触发审批（015 §8.5/U7）。\n\n## 实体类型\n\n${ents.map((e) => `- \`${e}\``).join('\n')}\n\n## 关系类型\n\n${rels.map((e) => `- \`${e}\``).join('\n')}\n\n## 建图规则\n\n- ${rule}\n- 与 templates/Type-Dict/type-dict.csv 的字段级别对齐（L1-L4）\n- 个体级 PII 字段不入实体属性（redact_gate 前置）\n- 三元组样例：\n\n\`\`\`\n(<实体:属性...>)-[:<关系>]->(<实体:属性...>)\n\`\`\`\n`);
}

w(path.join(ROOT, 'templates/knowledge/graph-memory.config.yaml'), `# graph-memory 知识图谱配置（015 KG 层基线）
provider: graph-memory            # npm v1.5.8（offline/npm 已预置）
injection:
  sources:
    - templates/knowledge/seeds/            # 13 域种子
    - templates/knowledge/injection-corpus/ # 注入测试语料（脱敏）
  chunking: { size: 512, overlap: 64 }
  entity_extraction: llm
graph:
  namespaces:
    base: { level: L1 }                     # Chassis 骨架图
    domain: { level: L2, per_domain: true } # 各域子图
    restricted: { level: L4, domains: [comp, prf, ben, er-eap] }  # L4 隔离子图
  eap:
    enabled: false                          # EAP 禁图谱（Scene policies.memory.exclude 强制）
recall_test:
  min_score: 0.8                            # 注入后召回 ≥80%
  sensitive_probe: "任何 L4 实体查询必须返回 APPROVAL_REQUIRED"
upgrade:
  compatible_with: [pi-vault-mind, dsh-mnemon, billion-context-pi, @zosmaai/pi-llm-wiki]
  note: "多引擎共存时以 graph-memory 为主图，其余为向量/长上下文补充；禁双写同一命名空间"
`);

w(path.join(ROOT, 'templates/knowledge/injection-corpus/hr-policy-sanitized.md'), `# 员工手册（脱敏样例·注入测试用）\n\n> 用途：graph-memory 注入与召回测试（U7）。合成内容，非真实制度。\n\n1. 入职：新员工 3 日内完成合同签署与账号开通。\n2. 考勤：标准工时 8 小时/日；加班需事前审批。\n3. 薪酬保密：个体薪酬属 L4 数据，任何查询走区间口径。\n4. 离职：交接清单 9 节齐全后方可结算。\n5. 用印：一律走 HITL 审批。\n`);
w(path.join(ROOT, 'templates/knowledge/injection-corpus/comp-band-sanitized.md'), `# 薪酬带宽口径（脱敏样例·注入测试用）\n\n> 合成数据。个体薪酬禁入图谱，仅带宽结构可建实体。\n\n- P4 带宽：20k-30k；P5：28k-42k；P6：38k-60k（示例口径）\n- 调薪偏离带宽 ±15% 以上需双审批\n- CR 比率健康区间 0.8-1.2\n`);
w(path.join(ROOT, 'templates/knowledge/injection-corpus/er-discipline-sanitized.md'), `# 员工关系处分口径（脱敏样例·注入测试用）\n\n> 合成数据。处分详情 L4，图谱只存流程关系。\n\n- 警告→记过→降级→解除 四级递进\n- 任何处分生效前必须多级审批（multi-approval）\n- EAP 转介与处分流程隔离；EAP 内容永不进入处分证据\n`);

w(path.join(ROOT, 'templates/knowledge/README.md'), `# Knowledge Graphs 层操作手册（015 KG 扩展）

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
`);
console.log(`knowledge layer: ${n} files`);
