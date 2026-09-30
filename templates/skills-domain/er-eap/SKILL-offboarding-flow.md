---
name: offboarding-flow
domain: er-eap
version: 1.0.0
min_level: L4
redact_gate: true
---
# SKILL · offboarding-flow

**用途**：离职流程与面谈纪要（脱敏）

**触发词**：offboarding flow

**步骤**：
1. 读取 data/er-eap/ 输入（校验 Level ≤ L4，越级即 DENY）
2. 经 Permission Gateway 授权后执行
3. 产出写入 reports/er-eap/（附证据来源 sheet/row）
4. 自检：Expected vs Actual 逐项比对，失败进入 RETRY

**依赖能力**：cap.excel.panel, cap.redact.all
**失败处理**：连续 3 次失败→登记 capability-gap 并停止当前任务
