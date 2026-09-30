{
 "workflow": "rec.funnel-weekly@1.0.0",
 "engine": "pi",
 "fallback": false,
 "deliverable": {
  "file": "rec/rec-funnel-weekly-2026-09-29T05-23-38.json",
  "path": "templates/workspace/deliverables/rec/rec-funnel-weekly-2026-09-29T05-23-38.json"
 },
 "spec": {
  "file": "funnel-weekly-<ts>.json",
  "format": "json",
  "fields": [
   "stage",
   "count",
   "conversion_pct",
   "week"
  ],
  "acceptance": "候选人 PII 仅掩码"
 }
}