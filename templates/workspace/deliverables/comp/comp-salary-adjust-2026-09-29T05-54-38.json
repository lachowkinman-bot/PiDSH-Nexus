{
 "domain": "comp",
 "kind": "comp-salary-adjust",
 "created_at": "2026-09-29T05:54:38.198Z",
 "workflow": "comp.salary-adjust@1.0.0",
 "description": "调薪审批（双审批 + redact_gate）",
 "fields": {},
 "deliverable_spec": {
  "file": "salary-adjust-<ts>.json",
  "format": "json",
  "fields": [
   "employee_masked",
   "band_from",
   "band_to",
   "approvals"
  ],
  "acceptance": "个体薪酬只出区间；redact_gate 强制"
 },
 "engine": {
  "name": "pi",
  "fallback": false,
  "output": "执行前我先定位了技能与工作流定义，但没有找到。工作区实际内容如下（已逐个探测，均为 `ENOENT`，仅以下存在）：\n\n- `F:/Pi_DSH_workplace/universal-workbench-3.0/package.json`\n- `F:/Pi_DSH_workplace/universal-workbench-3.0/package-lock.json`\n- `F:/Pi_DSH_workplace/universal-workbench-3.0/node_modules/playwright-core/`（唯一依赖，v1.63.0）\n\n不存在的关键路径（节选）：\n- `skills/band-analysis/SKILL.md`、`skills/band-analysis.md`、`.pi/skills/...`、`.agents/skills/...`、`.claude/skills/...`\n- `workflows/comp.salary-adjust@1.0.0.{yaml,json}` 及 `workflows/comp.salary-adjust.{yaml,json}`\n- 用户级：`C:/Users/Kinman/.agents/skills/band-analysis/...`（该技能未出现在已加载技能清单中，已确认）\n- 项目非 git 仓库（`.git` 不存在），无配置/环境文件\n\n即：工作区目前只有一个空的 Playwright 依赖骨架，**不存在 `band-analysis` 技能定义，也不存在 `comp.salary-adjust@1.0.0` 工作流定义**，因此无法“执行”它。另外当前可用工具只有 `read` / `write`，没有 shell，无法真正运行工作流。\n\n请提供其一，我即可继续：\n\n1. **定义文件路径**：`band-analysis` 技能与该工作流（含 `redact_gate`、双审批节点）的所在目录/文件；或\n2. **入口地址**：若工作流是通过 Universal Workbench 的 Web UI 执行，请给出 URL 与登录/启动方式（仓库里有 playwright-core，暗示是浏览器驱动执行）；或\n3. **原始规格**：调薪审批的输入样例（员工薪资、band 区间、审批人、脱敏规则），我可以据此**从零实现并写入** `comp.salary-adjust@1.0.0`（band 分析 → redact_gate 脱敏 → 一级/二级审批 → 审计留痕）。\n\n告诉我走哪条路径，我马上开始。"
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