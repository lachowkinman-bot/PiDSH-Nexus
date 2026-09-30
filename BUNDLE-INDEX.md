# BUNDLE-INDEX · universal-workbench-bundle 资源总索引

> 依据《015-Universal-Workbench-通用工作台交付任务书.md》（v2.0）§3.2 制备。制备日：2026-09-27。
> 三层边界：**预置层**（本包已含，零下载）/ **自制层**（本包已含，Agent 只定制）/ **缺口层**（扩展位 + 降级预案）。

## 快速开始

| 你想做什么 | 命令 |
|---|---|
| 补齐/重下预置层（Windows pwsh） | `pwsh -File scripts/download-all.ps1` |
| 补齐/重下预置层（macOS terminal） | `bash scripts/download-all.sh` |
| 校验预置层完整性（断网可跑） | `bash scripts/workbench.sh fetch` 或 `pwsh -File scripts/workbench.ps1 -Cmd fetch` |
| 安装 P0/P1 | `pwsh -File scripts/workbench.ps1 -Cmd install` / `bash scripts/workbench.sh install` |
| 探测当前 Runner | `bash scripts/runner-probe.sh` / `powershell -File scripts/runner-probe.ps1` |
| 构建桌面安装包（U14） | `iscc scripts/installer/win/setup.iss` / `bash scripts/installer/mac/build_dmg.sh` |

## 资产清单

| 层 | 资产 | 数量 | 位置 |
|---|---|---|---|
| 预置层 | npm tarball（P0=17 + P1=7，SHA256 锁定） | 24 | offline/npm/ |
| 预置层 | Node 24 LTS 安装器（latest-v24.x=v24.21.0，满足 pi-vault-mind engines≥24.19；msi/pkg 经 download-all 获取并校验） | 2-3 | offline/node/ |
| 预置层 | dsh-web 源码（浅克隆，人工可选；zip 实测 452MB 不内嵌） | 1 repo | offline/github/ |
| 自制层 | 包清单（P0=17/P1=7/P2=31，17 列） | 55 行 | manifests/packages.manifest.csv |
| 自制层 | 能力注册表 | 46 行 | manifests/capability-registry.csv |
| 自制层 | 哈希链取证种子（无 git Runner 用） | 1 | manifests/tag-manifest.csv |
| 自制层 | 业务域 Scene YAML | 14 | manifests/scenes/ |
| 自制层 | 工作流 YAML | 26 | manifests/workflows/ |
| 自制层 | 业务域技能模板（每域 4 个 SKILL.md） | 52 | templates/skills-domain/ |
| 自制层 | Type-Dict 数据字典 | 1 | templates/Type-Dict/type-dict.csv |
| 自制层 | 工作区 16 子目录骨架 + preset 层目录 | — | templates/workspace/ |
| 自制层 | PRD 基线版 | 1 | docs/PRD-桌面应用-基线.md |
| 自制层 | Code Review checklist（五类） | 1 | docs/CR-checklist.md |
| 自制层 | README 学员版 / 维护者版 | 2 | docs/ |
| 自制层 | preset 设计文档（每域 1 份） | 13 | docs/preset-design/ |
| 自制层 | 三件套（工作建模/交接规范/30 天计划） | 3 | docs/ |
| 自制层 | 总控/探测/下载/安装器/启动脚本 | 11 | scripts/ |
| 缺口层 | 行业扩展位（capability id，无现成包） | 7 | manifest P2 + capability-gap.md |
| **目录层** | 两份分析报告推荐包（npm 实测 111 真，2026-09-27） | 111 | offline/catalog/ + manifests/catalog-packages.manifest.csv |
| **目录层·索引补充** | pi.dev 下载榜 top50 缺失项（npm 实测 44 真，逐字验证 2026-09-27） | 44 | offline/catalog/（并入 catalog CSV，共 155 行） |
| **目录层·验证报告** | 两权威索引逐字比对（github topics 16,501 仓 / pi.dev 5,371 包） | 1 | reports/index-verbatim-verification.md |
| **就绪度核验** | 11 基准 agent 核验（9 真/2 不可核验）+ U1-U14 对账 + 判定 READY WITH CONDITIONS | 1 | reports/readiness-verification.md |
| **v2.1 复盘增补** | 八缺口→U15/U16/U17 + F14 装载器（--self-test 通过）+ 语义禁令 + 对账台账 | — | 015 §14/§12 + docs/UI-DELIVERY-SPEC.md + docs/benchmark-comparison-protocol.md + docs/1.0-gapfix-ledger.md + docs/why-not-met-1.0.md |
| **v2.1 补全·UI 骨架** | 8 功能页 + 13 域工作台基线（TODO(U15) 实装点） | 22 | templates/ui/ + scripts/gen-ui-skeletons.mjs |
| **v2.1 补全·安全扫描** | 179 包 OSV 漏洞扫描（0 高危 0 错误实测） | 2 | scripts/security-scan.mjs + reports/security-scan/ |
| **v2.1 补全·逐包 DoD** | 24 核心包四级 DoD 定义 + 编排器 | 2 | manifests/pkg-smoke-definitions.csv + scripts/pkg-func-smoke.mjs |
| **v2.1 补全·对标** | 基准任务集 10 条 + rubric 评分器 | 2 | manifests/benchmark-tasks.csv + scripts/benchmark-score.mjs |
| **v2.1 补全·批次/台账/探针** | catalog 三批安装 155 行 + 1.0 四缺陷台账 + .env.example + ui-walkthrough 目录 | 4 | manifests/catalog-install-batches.csv、reports/pkg-defect-ledger.csv、.env.example、reports/ui-walkthrough/ |
| **v2.2 复盘增补** | 2.0 复盘八缺口→U18 整合深度/U19 交付宣告一致性（BLOCKING）+ U16 升级阻断 + U15 机械判据（逐域差异化清单）+ U10 技能一致性 + U3 三源探测 + U6 新鲜度 + S0 凭据探针强制 | 6 | 015 §15/§12（U1-U19）、docs/2.0-gapfix-ledger.md、docs/delivery-announcement-checklist.md、docs/why-not-met-2.0.md、scripts/install-probe.mjs、scripts/engine-skill-runner.mjs、scripts/data-consistency-check.mjs、manifests/domain-ui-checklist.csv |
| **引擎锁定** | pi 0.87.1 + dsh 0.1.5-rc.3 离线 tarball + SHA256 锁定 | 2 | offline/engines/ + manifests/versions-lock.txt |
| **兼容性筛选** | 文档/视频 12 包 vs 锁定版本（engines/peerDeps 逐项） | 12 | manifests/compat-screening.csv |
| **交付矩阵** | pptx/xlsx/docx/html/md/pdf/video/chart → 包→备选→系统工具→冒烟命令 | 8 | manifests/doc-delivery.matrix.csv |
| **终端指令** | 双平台手动下载/锁定/安装/交付冒烟逐字命令 | 1 | docs/terminal-commands.md |
| **KG 层** | 13 域知识种子 + graph-memory 配置 + 注入语料 + KG 手册 | 18 | templates/knowledge/ |
| 目录层 | 假包证据（28 个报告推荐但 npm 不存在，含 pi-mentis） | 1 | reports/catalog-fake-packages.md |

## 目录层与 Knowledge Graphs（2026-09-27 扩展）

来源：`deliverables-20260903-2019`（dsh-plugin 分析：76 插件/36 技能/34 MCP）与 `deliverables-20260904-0929`（pi.dev 分析：63 项明细）。抽取 139 候选 → `node scripts/verify-catalog.mjs` 逐一 `npm view` 实测 → **111 真实包全部下载**（196MB）→ 28 个不存在已登记（含 pi-mentis，以 graph-memory + pi-vault-mind 替代）。

**KG 主力组合**：graph-memory（主图，P0）+ pi-vault-mind（向量+全文+图）+ billion-context-pi（长上下文）+ @zosmaai/pi-llm-wiki（Obsidian 摄取）+ dsh-mnemon / dsh-memory-plugin / @openviking/dsh-memory-plugin / dsh-client-ui-obsidian-memory / @a9i5k4/dsh-auto-memory（dsh 侧记忆系）+ pi-memory / pi-memento（pi 侧轻量记忆）。配置与注入流程见 `templates/knowledge/README.md`；再生成器：`node scripts/gen-knowledge.mjs`。

补拉命令（其他机器）：`node scripts/download-catalog.mjs`（幂等，读 `scripts/_catalog-verified.json`）。

## 再生成器（可复现）

```bash
node scripts/gen-manifest.mjs          # 依据 offline/npm/pkgmeta.json 重生成 manifests 三件套
node scripts/gen-domain-assets.mjs     # 重生成 scenes/workflows/preset-design/skills/Type-Dict
```

## 已知边界（诚实声明）

- 10 Runner 矩阵中 minimax/豆包工作/Trae Work/Kimi code 未公开核验（UNVERIFIED_RUNNER，U13 实测后回填）
- dsh-web 不在 npm registry；dev 分支 zip 实测 452MB → 采用 git clone --depth 1（人工可选，不阻断 U1）
- EAP 自动化仅到"匿名化转介建议"；多人协同/移动端为非目标
