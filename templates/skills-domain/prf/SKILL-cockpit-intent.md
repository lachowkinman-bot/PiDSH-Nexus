---
name: prf-intent
domain: prf
version: 2.0.0
llm: required
---
# 意图路由 · 绩效 PRF

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 绩效校准（双审批） -> `prf.calibration-approve@1.0.0`
- 目标分解报告（公司→部门→人） -> `prf.cascade-report@1.0.0`
- KPI 追踪（实际 vs 目标） -> `prf.kpi-tracking@1.0.0`
- 考核周期发起（模板下发） -> `prf.review-cycle@1.0.0`
- 一对一沟通纪要（结构化） -> `prf.one-on-one@1.0.0`
- 等级分布与强制分布比对 -> `prf.grade-distribution@1.0.0`
