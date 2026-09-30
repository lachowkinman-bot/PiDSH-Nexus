---
name: rec-intent
domain: rec
version: 2.0.0
llm: required
---
# 意图路由 · 招聘管理

把用户自然语言意图路由到本域技能/工作流；跨域意图交 Chief of Staff（cap.orchestration.chief）。

| 意图 | 路由 |
|---|---|
| JD 起草、岗位能力模型 | workflows/rec.jd-draft.yaml |
| 简历解析、校验、筛选评价 | workflows/rec.resume-forward.yaml |
| 邀约、针对性面试题库与安排 | workflows/rec.interview-schedule.yaml |
| 面试反馈、Offer 建议与审批 | workflows/rec.offer-approve.yaml |
| 入职任务、30/60/90 天成效 | workflows/rec.onboarding-check.yaml |
| 渠道与留存漏斗复盘 | workflows/rec.funnel-weekly.yaml |
