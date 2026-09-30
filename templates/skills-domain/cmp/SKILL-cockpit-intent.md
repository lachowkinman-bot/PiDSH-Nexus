---
name: cmp-intent
domain: cmp
version: 2.0.0
llm: required
---
# 意图路由 · 合规 CMP

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 制度审查 checklist（逐条比对） -> `cmp.policy-review@1.0.0`
- 证据打包（append-only 对齐） -> `cmp.evidence-pack@1.0.0`
- PIPIA 评审（高风险处理） -> `cmp.pipia-review@1.0.0`
- 审计留痕月报（覆盖率） -> `cmp.audit-trail@1.0.0`
- 合规培训完成度核查 -> `cmp.training-check@1.0.0`
- 监管报送清单与截止提醒 -> `cmp.reg-filing@1.0.0`
