{
 "domain": "strat",
 "kind": "strat-weekly-report",
 "created_at": "2026-09-29T05:43:16.838Z",
 "workflow": "strat.weekly-report@1.0.0",
 "description": "经营周报（收入/订单/风险三段）",
 "fields": {},
 "deliverable_spec": {
  "file": "weekly-report-<ts>.json",
  "format": "json",
  "fields": [
   "week",
   "revenue_wan",
   "orders",
   "risks",
   "next_actions"
  ],
  "acceptance": "数字可追溯到 data/strat/weekly.csv 行级"
 },
 "engine": {
  "name": "pi",
  "fallback": false,
  "output": "**无法执行** —— `biz-analysis` 技能与 `strat.weekly-report@1.0.0` 工作流在本机并未安装或发现，且项目内没有任何经营数据。我不会凭猜测编造收入/订单/风险数字。\n\n已核查（均不存在，ENOENT）：\n\n| 位置 | 结果 |\n|---|---|\n| `F:/Pi_DSH_workplace/universal-workbench-3.0/` | 仅 `package.json` + `node_modules/playwright-core`；无 `skills/`、`workflows/`、`data/`、`inputs/`、`.pi/`、`.agents/` |\n| `…/universal-workbench-3.0/scripts/` | 目录存在但无可识别的入口（`index.js`、`run.js`、`registry.json` 等均无） |\n| `C:\\Users\\Kinman\\.agents\\skills\\biz-analysis\\SKILL.md` | 不存在（该目录下无 biz-analysis） |\n| `C:\\Users\\Kinman\\.pi\\skills\\`、`C:\\Users\\Kinman\\.pi\\settings.json` | 不存在 |\n| `F:\\Pi_DSH_workplace\\.agents\\skills\\`、`F:\\.agents\\skills\\` | 不存在 |\n| Pi 文档 | 无 \"workflow\" 概念（只有 skills/packages/prompts），`strat.weekly-report@1.0.0` 不是 Pi 原生工作流 |\n\n另外：本会话可用工具只有 `read` / `write`，**没有 bash/网络/数据库访问**，因此即便给出口径，我也无法自行拉取收入、订单与风险数据。\n\n请二选一：\n\n1. **补齐输入**，然后我直接产出三段式周报：\n   - `biz-analysis` 的 `SKILL.md`（或契约：指标定义、阈值、输出格式）\n   - 数据来源：本地文件路径，或粘贴的数据（收入、订单、风险三张表/CSV/JSON）\n   - 报告期（如 2026-W28）与口径（含税/币种、同环比基准、风险分级规则）\n2. **先搭骨架**：我按 `strat.weekly-report@1.0.0` 的语义，在项目下创建 `skills/biz-analysis/SKILL.md` + `data/` 约定 + 周报模板（收入 / 订单 / 风险三段 + 结构化 JSON 输出），你确认口径后再填数。\n\n要哪种？如果选 2，告诉我报告期和风险分级口径即可。"
 },
 "data_snapshot": [
  {
   "table": "okr",
   "rows": 5
  },
  {
   "table": "weekly",
   "rows": 4
  }
 ]
}