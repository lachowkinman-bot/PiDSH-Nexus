{
 "workflow": "comp.salary-adjust@1.0.0",
 "engine": "pi",
 "fallback": false,
 "deliverable": {
  "file": "comp/comp-salary-adjust-2026-09-29T05-24-23.json",
  "path": "templates/workspace/deliverables/comp/comp-salary-adjust-2026-09-29T05-24-23.json"
 },
 "spec": {
  "file": "salary-adjust-<ts>.json",
  "format": "json",
  "fields": [
   "employee_masked",
   "band_from",
   "band_to",
   "approvals"
  ],
  "acceptance": "个体薪酬只出区间；redact_gate 强制"
 }
}