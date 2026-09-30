{
 "workflow": "strat.weekly-report@1.0.0",
 "engine": "pi",
 "fallback": false,
 "deliverable": {
  "file": "strat/strat-weekly-report-2026-09-29T05-25-30.json",
  "path": "templates/workspace/deliverables/strat/strat-weekly-report-2026-09-29T05-25-30.json"
 },
 "spec": {
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
 }
}