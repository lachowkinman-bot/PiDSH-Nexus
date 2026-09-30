---
name: er-eap-intent
domain: er-eap
version: 2.0.0
llm: required
---
# 意图路由 · 员工关系/EAP

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 离职流程（多级审批） -> `er-eap.offboard-approve@1.0.0`
- EAP 转介（双审批 + 匿名化） -> `er-eap.eap-referral@1.0.0`
- 争议处理台账（阶段/证据） -> `er-eap.dispute-case@1.0.0`
- 离职面谈纪要（结构化） -> `er-eap.exit-interview@1.0.0`
- EAP 匿名使用月报（聚合口径） -> `er-eap.anon-report@1.0.0`
- 组织健康度脉搏（匿名问卷聚合） -> `er-eap.wellbeing-check@1.0.0`
