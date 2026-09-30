---
name: admin-intent
domain: admin
version: 2.0.0
llm: required
---
# 意图路由 · 行政 ADMIN

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

- 采购审批（DAG + 预算校验） -> `admin.purchase-approve@1.0.0`
- 用印申请（强制人工放行） -> `admin.seal-request@1.0.0`
- 资产盘点（在用/维修/闲置） -> `admin.asset-inventory@1.0.0`
- 会议纪要（决议/待办/责任人） -> `admin.meeting-minutes@1.0.0`
- 办公用品下单（比价后） -> `admin.supply-order@1.0.0`
- 供应商比价报告（三家原则） -> `admin.vendor-price@1.0.0`
