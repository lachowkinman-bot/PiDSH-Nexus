# HANDOFF · PiDSH Nexus R11 · 13 域模块/事项/工作流/契约

生成时间：2026-09-30 16:12（Asia/Shanghai）
仓库：`F:\Pi_DSH_workplace\universal-workbench-3.0`
当前 HEAD：`620f6c6 fix(r10): 去除 runtime JSON BOM 并修复真实安装启动`
工作树：**有未提交的 R11 改动**，尚未做最终 commit。

## 本轮目标

用户要求在 13 个工作域中继续细分：

`工作域 -> 工作模块 -> 完整工作事项 -> 对应工作流 -> 从输入到输出的全流程 -> 每个环节标准 -> Schema/TypeDict/字典/数据血缘闭环`

并明确要求用 `grill-me` 方法结合互联网标杆/GitHub 优秀实践打磨。

## 已完成

- 读取并执行了 `grill-me → grilling → domain-modeling` 的设计盘问路径。
- 新增 `CONTEXT.md`、`docs/domain-design/GRILL-DECISIONS.md`、`docs/adr/ADR-0015-work-module-hierarchy-and-contracts.md`。
- 新增 `scripts/build-domain-work-design.mjs`，生成：
  - 13 域
  - 39 个工作模块
  - 78 个工作事项
  - 78 个唯一工作流映射
  - 78 份输入/输出 JSON Schema 契约
  - 737 个字段级 TypeDict 条目
  - 13 份人类可读领域设计文档
- 新增 `manifests/domain-work-design/*.json`、`manifests/workflow-contracts/*.json`、`manifests/typedict/*.json`、`manifests/schema/*.json`。
- 新增 `templates/Type-Dict/field-type-dict.csv`。
- 新增 `manifests/benchmark-sources.json`，记录 BPMN、JSON Schema、OpenAPI、Frictionless Table Schema、OpenLineage、Great Expectations、HR Open、Schema.org、xAPI、XBRL、NIST、COSO、WorldatWork、SHRM、Google Search Essentials、OpenActive、ISO/EAPA 等来源。
- 工作台后端新增 `GET /workbench/api/domain-work-design`，运行时可选择按 domain 查询。
- 运行时 Stage 已改为优先读取领域设计中的 7+ 环节与标准，找不到模块/事项设计即失败。
- 壳内 `client-v4.js` 已改为展示模块、事项、责任角色、频率、环节标准、失败处理、输入/输出 Schema 和 TypeDict 引用。

## 已验证

- `node scripts/build-domain-work-design.mjs`：13 域 / 39 模块 / 78 事项 / 78 工作流 / 737 字段 / 78 契约。
- `node scripts/verify-domain-work-design.mjs`：**13/13 PASS**。
- `node scripts/verify-workflow-platform.mjs`：**19/19 PASS**，78/78 正常路径；审批、模型阻断、敏感输出、恢复、导入通过。
- 开发隔离实例 `node scripts/verify-workbench-ui-v4.mjs`：**8/8 PASS**，包含模块层级和 1100×700 视口。

## 尚未完成

1. **最终安装态层级 UI 复验尚未执行**。最终 runtime/安装器已重建并刷新真实安装 profile，但交接发生时没有重新启动并跑安装态 UI。
2. R11 改动尚未 commit。
3. 还没有把最终安装器升级后的真实应用重新打开做一次人工截图/点击确认。

## 当前构建产物

- runtime：`offline-3.0/runtime-web.zip`
  - 546,178,457 B
  - SHA256 `C54FEB07B6F31479096220FE95095714B3962353B2FB4C1628640F5A9407CB93`
  - build-id `3eb5f169686c6ddac7badd22456a14e0b70a6ebf5cd0114ba85f0b5ff6676c40`
- installer：`installer-output/UniversalWorkbench-Setup.exe`
  - 589,641,451 B
  - SHA256 `84C01DE461FB7B7F64491B8E8E19FCEECFD3C17CB1F081FD82B4A3827B3CE4EA`
- 真实安装目录：`%LOCALAPPDATA%\Programs\UniversalWorkbench`
  - profile marker 已为 `3eb5f169…`
  - `@workbench/client-ui@4.0.0`
  - `manifests\domain-work-design\index.json` 已存在

## 下一步（按顺序）

1. 启动真实安装或隔离 QA 服务，取得带 token 的 URL。
2. 运行：

```powershell
node scripts/design:verify
node scripts/verify-workbench-ui-v4.mjs "<url>" reports/r11-final-workbench-ui.json
node scripts/verify-shell-modules.mjs --url "<url>" --strict --out reports/r11-final-shell.json
```

3. 查看 `reports/ui-walkthrough/v4/rec-domain.png`，确认模块、事项、环节标准、Schema/TypeDict 引用可见。
4. 如 UI 没有问题：

```powershell
git add -A
git commit -m "feat(r11): 13域模块事项工作流与数据契约闭环"
```

5. 更新 `progress.md` 的 R11 状态和最终 commit hash。
6. 若 UI 有问题，先按 `systematic-debugging` 定位，不要直接改生成物；应改 `scripts/build-domain-work-design.mjs` 或 `client-v4.js` 后重新生成、验证。

## 运行的进程

交接时未发现 PiDSH Nexus、3080、3091、3092、3093、3094 监听进程。真实安装 profile 已刷新，但没有常驻服务。

## 硬约束与风险

- `manifests/domain-work-design`、`workflow-contracts`、`typedict`、`docs/domain-work-design` 都是生成物；手工修改会被 `design:build` 覆盖。
- 新增/改名工作流必须同步更新 `scripts/build-domain-work-design.mjs` 的模块映射；`design:verify` 要求 78/78 精确覆盖。
- 没有人工审批的流程必须显式 `no_human_approval`，不能把缺失审批当成默认通过。
- LLM 输出必须符合 JSON Schema、带证据引用、confidence 和 redaction；失败保持 `blocked_model`。
- EAP、薪酬、健康、招聘 PII 不得进入记忆层或未脱敏交付物。
- 真实安装目录已经原地升级，但最终 R11 commit 尚未产生；不要把未提交状态当成已归档。

## 建议 skills

- `grilling` / `grill-with-docs`：后续增加工作模块或调整事项边界时继续盘问。
- `domain-modeling`：维护 `CONTEXT.md`、术语、ADR 和领域边界。
- `research-ops` / `source-driven-development`：新增外部标杆时必须给 URL、来源状态和采纳模式。
- `verification-before-completion`：最终安装态 UI、主壳和契约验证全部完成后才能宣告完成。
- `systematic-debugging`：如果安装态模块层级或契约渲染异常，先做证据定位。
- `handoff`：上下文再次接近阈值时继续更新本文件。

## 关键文件索引

- `CONTEXT.md`
- `docs/domain-design/GRILL-DECISIONS.md`
- `docs/adr/ADR-0015-work-module-hierarchy-and-contracts.md`
- `manifests/domain-work-design/index.json`
- `manifests/benchmark-sources.json`
- `manifests/workflow-contracts/*.json`
- `manifests/typedict/*.json`
- `manifests/schema/*.schema.json`
- `templates/Type-Dict/field-type-dict.csv`
- `scripts/build-domain-work-design.mjs`
- `scripts/verify-domain-work-design.mjs`
- `workbench-ui-plugin/lib/client-v4.js`
- `workbench-ui-plugin/lib/platform.mjs`
- `workbench-ui-plugin/lib/index.js`
- `reports/r11-domain-work-design.md`
- `reports/domain-work-design-validation.json`
