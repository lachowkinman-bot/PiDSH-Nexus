---
name: mkt-off-intent
domain: mkt-off
version: 2.0.0
llm: required
---
# 意图路由 · 营销（线下）MKT-OFF

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 活动 ROI 复盘（预算 vs 实际） -> `mkt-off.event-roi@1.0.0`
- 物料合规审查（法务→品牌→归档） -> `mkt-off.material-review@1.0.0`
- 活动策划案（预算/场地/排期） -> `mkt-off.event-plan@1.0.0`
- 经销商简报（条款执行） -> `mkt-off.vendor-brief@1.0.0`
- 展位/场地签约审批 -> `mkt-off.booth-approve@1.0.0`
- 线下线索移交销售（去重+脱敏） -> `mkt-off.lead-handoff@1.0.0`
