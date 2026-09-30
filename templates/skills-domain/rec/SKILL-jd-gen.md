---
name: jd-gen
domain: rec
version: 1.0.0
min_level: L3
redact_gate: true
---
# SKILL · jd-gen

**用途**：JD 生成与合规检查

**触发词**：jd gen

**步骤**：
1. 读取 data/rec/ 输入（校验 Level ≤ L3，越级即 DENY）
2. 经 Permission Gateway 授权后执行
3. 产出写入 reports/rec/（附证据来源 sheet/row）
4. 自检：Expected vs Actual 逐项比对，失败进入 RETRY

**依赖能力**：cap.excel.panel, cap.redact.all
**失败处理**：连续 3 次失败→登记 capability-gap 并停止当前任务
