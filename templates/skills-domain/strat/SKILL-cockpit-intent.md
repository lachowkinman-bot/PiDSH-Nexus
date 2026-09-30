---
name: strat-intent
domain: strat
version: 2.0.0
llm: required
---
# 意图路由 · 战略 STRAT

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 季度战略复盘（合并薪酬盘点走双审批） -> `strat.quarterly-review@1.0.0`
- 经营周报（收入/订单/风险三段） -> `strat.weekly-report@1.0.0`
- OKR 目标与 KR 制定（表格化提交） -> `strat.okr-set@1.0.0`
- 竞品动态简报（脱敏摘要口径） -> `strat.competitor-brief@1.0.0`
- 组织盘点（关键岗位/继任） -> `strat.org-inventory@1.0.0`
- 季度关账经营决议（含调薪包） -> `strat.quarter-close@1.0.0`
