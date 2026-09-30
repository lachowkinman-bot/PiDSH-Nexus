---
name: mkt-on-intent
domain: mkt-on
version: 2.0.0
llm: required
---
# 意图路由 · 营销（线上）MKT-ON

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 内容发布审批（L4 强审批 + 脱敏） -> `mkt-on.publish-approve@1.0.0`
- 投放周报（渠道×ROI） -> `mkt-on.campaign-report@1.0.0`
- 内容日历排期（两周滚动） -> `mkt-on.content-calendar@1.0.0`
- 线索漏斗周报（阶段转化） -> `mkt-on.lead-funnel@1.0.0`
- SEO 诊断（收录/关键词） -> `mkt-on.seo-audit@1.0.0`
- 投放加预算审批（阈值触发） -> `mkt-on.ad-spend-review@1.0.0`
