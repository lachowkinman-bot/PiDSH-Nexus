{
 "domain": "strat",
 "kind": "strat-weekly-report",
 "created_at": "2026-09-29T05:58:23.348Z",
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
  "output": "我没有找到该技能或工作流，需要先确认信息来源。\n\n**已核查的位置（均不存在）**\n\n| 查找目标 | 结果 |\n|---|---|\n| `C:\\Users\\Kinman\\.agents\\skills\\biz-analysis\\SKILL.md` | 不存在（全局技能库中无 `biz-analysis`） |\n| `./skills/biz-analysis/SKILL.md`、`./.pi/skills/…`、`./.agents/skills/…`、`./.claude/skills/…` | 不存在 |\n| `./workflows/strat.weekly-report.md`、`./.pi/workflows/…`、`./strat.weekly-report.md` | 不存在 |\n| `./skills.json`、`./workflows.json`、`./registry.json`、`./.pi/config.json` | 不存在 |\n| 数据源 `./data/orders.csv`、`./input/orders.csv` 等 | 不存在 |\n\n`F:/Pi_DSH_workplace/universal-workbench-3.0` 目前可见的内容只有 `package.json`（依赖仅 `playwright-core`），未见技能定义、工作流定义或经营数据。\n\n另外，本次会话我只挂载了 `read` / `write` 两个工具，**没有** shell / 目录列举 / 脚本执行能力，因此无法通过 `ls`、`git`、运行 `biz-analysis` 脚本等方式自行发现或驱动该工作流。\n\n**为什么我没有直接产出周报**\n\n`strat.weekly-report@1.0.0` 是一个带版本号的工作流契约（收入 / 订单 / 风险三段），它的口径（营收定义、订单口径、风险阈值、时间窗口）必须来自工作流定义与真实数据。在没有这两样东西的情况下写出一份带具体数字的周报，等于编造经营数据——这类内容一旦被当作真实报表使用，风险远大于\"暂时交不出报告\"。所以在此停下并报告缺口。\n\n**请提供以下任一项，我立即执行**\n\n1. **技能/工作流定义**：`biz-analysis` 的 `SKILL.md` 路径，或 `strat.weekly-report@1.0.0` 的定义文件路径（可直接把内容贴给我）。\n2. **数据源**：本周与上周的收入、订单明细（CSV / JSON / 数据库导出 / API 地址均可），以及风险项来源（异常订单、退款、投诉、逾期应收等）。\n3. **口径确认**（若定义文件里没有）：统计周期（周一–周日？）、收入是否含退款/税、订单是否含取消单、币种。\n\n**拿到上述任意一项后，我会按此结构落地**\n\n```\nreports/weekly-report-<YYYY-Www>.md\n├─ 一、收入   本周/环比/同比 + 结构拆分 + 波动归因\n├─ 二、订单   单量/客单/转化 + 渠道与品类分布 + 异常单\n└─ 三、风险   风险清单（等级/影响面/责任方）+ 建议动作 + 待决策项\n```\n\n请把 `biz-analysis` 的技能文件路径或本周数据给我，我继续执行。"
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