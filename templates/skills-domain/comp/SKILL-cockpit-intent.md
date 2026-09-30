---
name: comp-intent
domain: comp
version: 2.0.0
llm: required
---
# 意图路由 · 薪酬 COMP

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 调薪审批（双审批 + redact_gate） -> `comp.salary-adjust@1.0.0`
- 带宽偏离报告（区间口径） -> `comp.band-report@1.0.0`
- payroll 对账（应发 vs 实发） -> `comp.payroll-recon@1.0.0`
- CR 指数报告（人/带宽） -> `comp.compa-ratio@1.0.0`
- 调薪队列批量审批（HRD+CFO） -> `comp.queue-approve@1.0.0`
- 调薪包成本测算（区间口径） -> `comp.cost-projection@1.0.0`
