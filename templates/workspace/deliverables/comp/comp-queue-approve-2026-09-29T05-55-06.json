{
 "domain": "comp",
 "kind": "comp-queue-approve",
 "created_at": "2026-09-29T05:55:06.894Z",
 "workflow": "comp.queue-approve@1.0.0",
 "description": "调薪队列批量审批（HRD+CFO）",
 "fields": {},
 "deliverable_spec": {
  "file": "queue-approve-<ts>.json",
  "format": "json",
  "fields": [
   "batch",
   "items",
   "total_impact_wan",
   "approvals"
  ],
  "acceptance": "批量影响 >50 万/年 加签 CEO"
 },
 "engine": {
  "name": "pi",
  "fallback": false,
  "output": "## 结论：无法执行 — 目标技能与工作流在本环境中不存在\n\n我按名称和常见路径做了穷尽式探测，全部落空：\n\n**1. `compa-ratio` 技能未注册**\n- 用户级技能目录（`C:\\Users\\Kinman\\.agents\\skills`）的完整清单里没有 `compa-ratio`，也没有 HR/薪酬类的同名条目\n- 项目级候选位置均不存在：`.pi/skills/`、`.pi/prompts/`、`.agents/skills/`、`.claude/skills/`、`commands/`、`skills/`、根目录 `SKILL.md`\n\n**2. 工作流 `comp.queue-approve@1.0.0` 无定义文件**\n探测过的路径全部 ENOENT：\n```\nflows/comp.queue-approve@1.0.0.yaml\nworkflows/comp.queue-approve@1.0.0.yaml\nworkflows/comp.queue-approve/1.0.0/workflow.json\ncatalog/comp.queue-approve@1.0.0.json\nworkbench/flows/comp.queue-approve/1.0.0/workflow.json\nsrc/flows/comp.queue-approve@1.0.0.ts\n```\n`package.json` / `package-lock.json` 是唯一存在的文件：\n\n**3. `F:/Pi_DSH_workplace/universal-workbench-3.0` 实际是个空脚手架**\n```json\n{ \"dependencies\": { \"playwright-core\": \"^1.63.0\" } }\n```\n除 `package.json`、`package-lock.json`、`node_modules/playwright-core` 外无任何源码、配置或流程定义。\n\n**4. 能力缺口（即使定义存在也执行不了）**\n- 本会话只有 `read` / `write` 两个工具：无 shell、无目录列举、无浏览器驱动，而该工作流显然依赖 Playwright 做 Web 端批量审批操作\n- 因此我既无法枚举目录去\"找到\"技能，也无法实际唤起审批队列\n\n## 需要你补充任一项\n\n1. **技能/工作流文件的绝对路径** — 我无法列举目录，只能按精确路径读取；给我路径我立刻读并执行\n2. **或直接提供输入数据**：调薪队列（员工、现薪、Compa-Ratio、建议调薪额、部门/预算池）、审批策略（HRD/CFO 双签阈值、超限规则、预算约束）\n3. **或确认这项工作要不要落到本仓库**：我可以按 `comp.queue-approve@1.0.0` 的规格，把技能定义 + 工作流定义（YAML/JSON + Playwright 执行器骨架）直接写进 `universal-workbench-3.0`\n\n## 两点必须先说明\n\n- **没有执行就等于没有批准。** 我不会在没有真实队列数据和审批策略的情况下\"模拟\"一次 HRD+CFO 批量审批并输出结论——那会产生一个看起来完成、实际不存在的审批记录。\n- **批量调薪审批是不可逆的高影响动作。** 即便工具齐备，也需要你明确授权范围（可审批额度上限、是否允许自动通过、超限如何处理），我才会执行写操作。\n\n告诉我路径或数据，我马上继续。"
 },
 "data_snapshot": [
  {
   "table": "adjust_queue",
   "rows": 4
  },
  {
   "table": "bands",
   "rows": 5
  }
 ]
}