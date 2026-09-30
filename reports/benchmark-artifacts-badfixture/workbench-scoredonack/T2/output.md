{
 "domain": "comp",
 "kind": "comp-salary-adjust",
 "created_at": "2026-09-29T05:38:19.139Z",
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
  "output": "我无法开始执行 —— **目标技能与工作流定义在本机不存在**。已核实如下。\n\n## 已检索位置（均无结果）\n\n**工作区 `F:/Pi_DSH_workplace/universal-workbench-3.0`**\n- 实际内容仅有：`package.json`、`package-lock.json`、`node_modules/playwright-core`、`.npmrc`\n- 无 `README.md` / `AGENTS.md` / `CLAUDE.md` / `.pi/` / `skills/` / `workflows/` / `.agents/` / `.git/`\n- 无 `band-analysis/SKILL.md`，无 `comp.salary-adjust@1.0.0` 任何形式（`.md`/目录/`SKILL.md`）\n\n**全局技能与 pi 配置位置**\n- `C:\\Users\\Kinman\\.agents\\skills\\band-analysis\\SKILL.md` → 不存在，且该技能**未出现在本会话已加载的技能清单中**（清单里没有任何 compensation / band-analysis / 调薪相关技能）\n- `C:\\Users\\Kinman\\.pi\\agent\\skills\\...`、`C:\\Users\\Kinman\\.agents\\workflows\\...`、项目及祖先目录 `.agents/skills/...` → 均不存在\n\n## 结论\n\n- `band-analysis` 不是当前已安装/可发现的技能，`comp.salary-adjust@1.0.0` 也不是可发现的工作流。\n- 该任务属于「调薪审批（双审批 + redact_gate）」这类敏感 HR/薪酬流程，**在没有真实定义的情况下我不能凭猜测执行**：谁有审批权、redact 规则（哪些字段/PII 必须遮蔽）、双审批的先后与门槛、审计留痕要求，都决定结果是否合规。编造一份审批记录或脱敏结果会直接违反该流程的设立目的。\n\n## 需要你提供其一\n\n1. **技能路径**：`band-analysis/SKILL.md` 的实际位置（或直接贴出内容）；或\n2. **工作流规格**：`comp.salary-adjust@1.0.0` 的定义文件（YAML/JSON/MD 均可）；或\n3. 若该技能**尚待编写**：确认后我可以在 `F:/Pi_DSH_workplace/universal-workbench-3.0/.agents/skills/band-analysis/SKILL.md` 落地该技能，并配套 `comp.salary-adjust@1.0.0` 工作流规格（含双审批状态机 + redact_gate 字段规则）。\n\n另：本次会话仅暴露 `read`/`write` 两个工具，**无 shell/浏览器执行能力**；若该工作流依赖脚本或 Playwright 运行环境，请一并说明其入口命令。"
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