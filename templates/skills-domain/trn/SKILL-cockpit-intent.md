---
name: trn-intent
domain: trn
version: 2.0.0
llm: required
---
# 意图路由 · 培训 TRN

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 培训计划审批（预算/学时） -> `trn.plan-approve@1.0.0`
- 学时统计（人/部门口径） -> `trn.hours-report@1.0.0`
- 排期（讲师/场地冲突检测） -> `trn.course-schedule@1.0.0`
- 资质到期提醒（特种作业/证书） -> `trn.cert-expiry@1.0.0`
- 证书复审/换证审批 -> `trn.cert-renew@1.0.0`
- 报名确认（名额/前置课校验） -> `trn.enroll-approve@1.0.0`
