# R10 · 主壳全功能门禁 + 13 域战略闭环（2026-09-30）

## 范围

本轮暂停 T1，不修改主壳左上角 `deepseek HARNESS` 品牌字标；完成主壳 11 模块的功能清单、只读与本地写验收，并把壳内 `⟡ 工作台` 升级为 PiDSH Nexus 4.0 的唯一完整业务工作面。

## 主要改动

- 新增 `manifests/shell-module-actions.json`，登记 11 模块 / 71 个动作及读写、产出、备份、门禁、外部依赖与证据要求。
- 新增主壳只读验收器 `scripts/verify-shell-modules.mjs` 和安全写验收器 `scripts/verify-shell-writes.mjs`。
- 新增 `workbench-ui-plugin/lib/platform.mjs`：用户工作区、原子写入、JSONL 审计、30 份备份、78 条 V2 工作流、LLM JSON 契约、双审批、成效和战略回写。
- 新增 `workbench-ui-plugin/lib/client-v4.js`：战略总看板、13 域工作台、6 流程向导、字段中文解释、CSV 导入、审批中心、交付、审计、运行与回退。
- 新增 `manifests/strategy-model.json`：1 个 Objective、5 个 KR、13 域北极星与来源血缘。
- REC 六个工作流改为语义技能：JD、简历解析筛选、邀约/题库、面试反馈、Offer 双审批、入职与 30/60/90 留存。
- 其余 12 域共 48 个技能文件通过 `scripts/enrich-domain-skills.mjs` 生成领域生命周戒、决策、控制、指标、LLM 契约和恢复要求。
- 用户数据改为 `%LOCALAPPDATA%\PiDSH Nexus\workspace`；模板保持只读种子，首次运行复制并按写前备份。

## 门禁结果

| 门禁 | 结果 | 证据 |
|---|---|---|
| 工作流平台（含 78 条正常路径） | 19/19 PASS，78/78 完成 | `reports/platform-verification.json` |
| 应用矩阵 | 45/45 PASS | `reports/r10-installed-app-verification.json` |
| 主壳严格清单 | 101/102，唯一外部条件项为 PR Board 未配置 GitHub；本地项全绿、未知控件 0 | `reports/r10-installed-shell-inventory.json` |
| 壳内工作台 UI 旅程 | 7/7 PASS（含 1100×700 紧凑视口） | `reports/r10-final-workbench-ui.json` |
| 第三方安全写 | 15/15 PASS | `reports/r10-installed-shell-writes.json` |
| 交付 UI 矩阵 | 23/23 PASS | `reports/delivery-ui-v4.json` |
| 13 域 × 7 格式 | 117/117 PASS，91 个产物 | `reports/delivery-matrix.json` |
| 场景/技能/工作流 lint | 42 条 GT，39 唯一，0 违规 | `reports/gt-lint.csv` |
| 数据字典/落地表 | 46 张表，0 issue | `reports/data-consistency.csv` |
| 隔离静默安装 + 原地升级 | 退出码 0，session/workspace 哨兵均保留 | 本报告“构建产物”与安装日志 |

## 安装态验证

- 隔离安装目录：`.work/r10-installed`。
- `workbench.ps1 -Cmd install` 成功；profile marker 与 runtime build-id 一致；插件版本 `4.0.0`。
- 验证过主壳加载、工作台普通流程、REC 双审批 Offer、任务板 CRUD、技能 CRUD/回收、三类用量导出。

## 构建产物

- runtime：`offline-3.0/runtime-web.zip`，546,177,307 B，SHA256 `D273C53ED1FB42FC42BB1592E3EEF6600B85E8CC0EF132F8BAF62DA5A85B4C6A`，build-id `3ef425eba252b32f4b2077a1a6ac7b62880679f2e0f9357259ba52f0ec548f58`。
- 安装器：`installer-output/UniversalWorkbench-Setup.exe`，589,395,656 B，SHA256 `80F979BB9C7CEB59C1FB8C9858B66707889C1075805D012884F8778C064B6F6B`。
- PowerShell 5.1 的 JSON/marker 写入已改为无 BOM UTF-8；最终 runtime 内的 `runtime-build.json` 与 `compatibility.json` 首字节已实测不为 `EF BB BF`。

## 外部条件项与未完成

- 主壳左上角旧品牌字标按用户要求暂停。
- PR Board 需要 `gh` 登录和仓库配置；本轮验证配置入口和未配置状态，不伪造 GitHub 成功。
- 通知远程渠道、云 Provider、真实余额查询需要用户凭据；本轮验证本地面板、配置入口和安全导出，未伪造外部送达或余额。
- 真实 LLM 调用未使用用户 Key 强制验证；使用确定性模型桩完成 78/78 正常路径，并单独验证模型不可用、敏感输出和双审批阻断。恢复有效凭据即可替换模型桩。
- REC 的 30/60/90 天与 90 天留存依赖未来真实业务数据；系统会保持 `pending`，不得提前伪造。
