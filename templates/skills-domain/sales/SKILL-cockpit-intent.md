---
name: sales-intent
domain: sales
version: 2.0.0
llm: required
---
# 意图路由 · 销售 SALES

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 报价审批（DAG + 折扣阈值） -> `sales.quote-approve@1.0.0`
- 赢单复盘（打法沉淀） -> `sales.win-review@1.0.0`
- 报价测算（规格×数量×折扣） -> `sales.quote-calc@1.0.0`
- 管道周报（阶段×金额） -> `sales.pipeline-report@1.0.0`
- 合同评审（法务/财务会签） -> `sales.contract-review@1.0.0`
- 销售目标分解（区→人） -> `sales.target-split@1.0.0`
