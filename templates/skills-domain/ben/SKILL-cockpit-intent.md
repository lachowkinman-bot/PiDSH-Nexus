---
name: ben-intent
domain: ben
version: 2.0.0
llm: required
---
# 意图路由 · 福利 BEN

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 方案比选（DAG：商保/体检/弹性） -> `ben.vendor-compare@1.0.0`
- 体检报告聚合（脱敏） -> `ben.checkup-report@1.0.0`
- 弹性积分测算（年度额度） -> `ben.points-calc@1.0.0`
- 方案投保/变更审批 -> `ben.plan-enroll@1.0.0`
- 理赔协办周报（时效/结案） -> `ben.claim-review@1.0.0`
- 年度福利满意度调查（聚合） -> `ben.annual-survey@1.0.0`
