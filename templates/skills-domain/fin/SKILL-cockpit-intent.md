---
name: fin-intent
domain: fin
version: 2.0.0
llm: required
---
# 意图路由 · 财务 FIN

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 报销审批（强审批） -> `fin.expense-approve@1.0.0`
- 月度财报（分级输出） -> `fin.monthly-report@1.0.0`
- 预算调整审批（部门季度包） -> `fin.budget-review@1.0.0`
- 发票校验（税号/金额/连号） -> `fin.invoice-check@1.0.0`
- 报销抽审（合规抽样） -> `fin.reimburse-audit@1.0.0`
- 周现金流简报（进/出/余） -> `fin.cashflow-week@1.0.0`
