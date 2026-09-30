{
 "workflow": "comp.queue-approve@1.0.0",
 "engine": "pi",
 "fallback": false,
 "deliverable": {
  "file": "comp/comp-queue-approve-2026-09-29T05-24-38.json",
  "path": "templates/workspace/deliverables/comp/comp-queue-approve-2026-09-29T05-24-38.json"
 },
 "spec": {
  "file": "queue-approve-<ts>.json",
  "format": "json",
  "fields": [
   "batch",
   "items",
   "total_impact_wan",
   "approvals"
  ],
  "acceptance": "批量影响 >50 万/年 加签 CEO"
 }
}