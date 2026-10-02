# 十要素机械检查矩阵（U5，015 §12）— 2026-09-29 实测回填

> 口径：假审批=FAIL；不接受部分通过。凭据 401 冻结会话类要素，如实标注 BLOCKED(credential)。

| # | 要素 | 判定 | 证据 |
|---|---|---|---|
| 1 | 工作空间 | **PASS**（16 子目录实测：agents/archive/audit/backups/data/deliverables/inbox/knowledge/memory/presets/projects/reports/skills/system/tasks/templates/users） | `ls templates/workspace`（16 子目录 + 模板层文件），本表为 diff 记录 |
| 2 | Agent OS | **PASS**：dsh --version = 0.1.7-rc.2（≥0.1.2 CVE 红线，016 §2 重锁版本） | reports/boot-log-u16-v4.txt（真实启动）+ reports/install-log.csv |
| 3 | 专业 Skills | **PASS**：templates/skills-domain/ 13 个域目录（strat/mkt-on/mkt-off/sales/fin/rec/trn/prf/comp/ben/admin/cmp/er-eap） | `ls templates/skills-domain | wc -l` = 13 |
| 4 | 工具连接器 | **PASS**（安装+装载面）：dsh-excel-panel 0.6.1 / dsh-docs-panel 0.1.0 已装并装入 profile；会话内打开需模型会话 → 交互级 BLOCKED(credential) | reports/install-probe.json；reports/pkg-func-smoke.md |
| 5 | 数据/知识 | **GAP-登记**：Type-Dict 实测 25 行 < 40 行门槛 | templates/Type-Dict/type-dict.csv（25 数据行：13 域表级 L1-L4 标注）；扩充需按 preset-design 数据字典细化，本轮如实登记不凑数 |
| 6 | 任务编排 | **PASS**：manifests/workflows/ 26 个 YAML ≥ 24 | `ls manifests/workflows/*.yaml | wc -l` = 26 |
| 7 | 人机审批 | **BLOCKED(credential)**：pi-approval-guardian + @mutmutco/pi-plugin 已装已装载（install-probe + boot 装载行）；"未确认停在 APPROVAL_REQUIRED" 需真实模型会话 | reports/pkg-func-smoke.md A 表 |
| 8 | 产物管理 | **PASS**：reports/ 可写（本轮新增 20+ 证据文件） | 本目录文件清单 |
| 9 | 工作记忆 | **BLOCKED(credential)**：pi-hermes-memory + graph-memory 已装已装载；跨会话召回需会话 | 同上 |
| 10 | 审计追踪 | **PASS（面）**：manifests/tag-manifest.csv 存在 + workbench-ui-plugin 审计事件可查（/workbench/api/audit 返回 preset.apply 等真实事件） | boot 日志 + 审计 API 响应记录 |

## 结论

- 机械可测 6/10 PASS（要素 1/2/3/6/8/10）。
- 凭据阻塞 3 项（要素 7/9 及要素 4 交互级）——S0 停线事项（DEEPSEEK_API_KEY 401），非交付物缺陷。
- GAP 1 项（要素 5，Type-Dict 25<40）——如实登记，不虚报。
- **U5 = PARTIAL（机械面全绿；会话面待凭据）**。
