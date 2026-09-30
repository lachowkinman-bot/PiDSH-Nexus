# Pi_DSH_support 目录体检与选型报告

扫描时间：2026-09-30T02:18:02.319Z　包总数：**687**（dsh-plugins + pi-packages）

> 机械筛只回答「是否具备离线装载的最低条件」；进入 runtime 仍需启动验证 + 功能验证（AGENTS.md 硬规则）。

## 分类统计

| 分类 | 含义 | 数量 |
|---|---|---|
| READY_DIST | 自带 dist/lib 且无风险脚本/原生依赖，可离线装载 | 93 |
| READY_SOURCE | 源码直载（无构建产物但无依赖），可离线装载 | 33 |
| BUILD_REQUIRED | 有依赖但无构建产物，需先构建 | 130 |
| NEEDS_SCRIPT_AUDIT | 含 pre/install/postinstall/prepare 脚本，须逐条审计 | 183 |
| NEEDS_NATIVE_AUDIT | 依赖原生二进制（node-pty/onnxruntime/sharp 等） | 23 |
| SOURCE_ONLY | 私有源码包且无构建产物 | 16 |
| PI_PACKAGE | pi 侧包（非 dsh 插件形态） | 209 |
| INVALID | package.json 缺 name | 0 |

许可字段缺失：25 个（进 runtime 前必须补齐许可结论）。

## 候选 Top 40（可离线装载池，按交付价值打分）

| # | 包 | 版本 | 分类 | 许可 | 依赖 | 体积MB | 价值分 |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-files` | 0.5.3 | READY_DIST | MIT | 9 | 0.59 | 27 |
| 2 | `dsh-secure-audit` | 0.2.10 | READY_DIST | MIT | 0 | 0.34 | 22 |
| 3 | `dsh-mask` | 0.2.15 | READY_DIST | Apache-2.0 | 1 | 0.36 | 15 |
| 4 | `dsh-context-doctor` | 0.7.2 | READY_DIST | BSD-3-Clause | 0 | 1.21 | 12 |
| 5 | `dsh-memento` | 0.5.18 | READY_DIST | Apache-2.0 | 0 | 1.02 | 12 |
| 6 | `dsh-ppt` | 0.5.1 | READY_DIST | MIT | 0 | 0.27 | 12 |
| 7 | `dsh-chatgpt-bridge` | 0.5.1 | READY_DIST | MIT | 7 | 2.41 | 11 |
| 8 | `dsh-evolve` | 0.8.0 | READY_DIST | MIT | 2 | 1.89 | 11 |
| 9 | `dsh-plugin-anydoc` | 0.1.0 | READY_DIST | — | 1 | 0.04 | 11 |
| 10 | `billion-context` | 0.1.171 | READY_DIST | MIT | 1 | 94.16 | 11 |
| 11 | `dsh-echocat-skill-panel` | 5.1.3 | READY_DIST | MIT | 0 | 5.19 | 9 |
| 12 | `dsh-quality-review` | 0.1.0 | READY_DIST | MIT | 0 | 0.1 | 9 |
| 13 | `whale-persona` | 0.17.1 | READY_SOURCE | MIT | 0 | 1.73 | 9 |
| 14 | `@a9i5k4/dsh-auto-memory` | 3.2.2 | READY_DIST | BSD-3-Clause | 0 | 195.86 | 8 |
| 15 | `dsh-livechat` | 0.6.2 | READY_DIST | MIT | 0 | 2.66 | 7 |
| 16 | `dsh-telegram-channel` | 0.3.5 | READY_DIST | MIT | 1 | 0.94 | 7 |
| 17 | `@dsh-external/dsh-automation` | 0.1.7 | READY_DIST | MIT | 2 | 4.6 | 6 |
| 18 | `@ggboy123/dsh-paper-reader` | 1.1.1 | READY_DIST | MIT | 3 | 10.88 | 6 |
| 19 | `dsh-pdf-reader` | 0.2.0 | READY_DIST | MIT | 0 | 0.05 | 6 |
| 20 | `dsh-knit` | 0.13.1 | READY_SOURCE | MIT | 0 | 2.58 | 5 |
| 21 | `@noob-stupid/dsh-plugin-console` | 0.5.31 | READY_DIST | MIT | 0 | 4.23 | 5 |
| 22 | `@huanlin/dsh-plugin-mineru` | 0.4.0 | READY_DIST | AGPL-3.0 | 1 | 0.43 | 5 |
| 23 | `@mengyuly/dsh-ponytail` | 0.3.3 | READY_DIST | MIT | 0 | 0.27 | 5 |
| 24 | `dsh-undo-savepoint` | 0.4.9 | READY_DIST | MIT | 0 | 1.7 | 5 |
| 25 | `dsh-whale-report` | 0.6.1 | READY_DIST | MIT | 2 | 4.57 | 5 |
| 26 | `dsh-remote` | 0.8.23 | READY_DIST | MIT | 3 | 1.32 | 5 |
| 27 | `dsh-plugin-continuity` | 0.5.6 | READY_SOURCE | MIT | 0 | 0.95 | 4 |
| 28 | `dsh-appshots` | 0.1.8 | READY_DIST | MIT | 0 | 0.29 | 4 |
| 29 | `@dsh-external/dsh-diff-viewer` | 0.2.0 | READY_DIST | BSD-3-Clause | 4 | 0.96 | 4 |
| 30 | `dsh-layered-memory` | 0.11.0 | READY_DIST | MIT | 4 | 7.59 | 4 |
| 31 | `dsh-loop-continue` | 0.2.0 | READY_DIST | MIT | 1 | 0.19 | 4 |
| 32 | `dsh-memory-eternal` | 0.7.0 | READY_DIST | MIT | 1 | 10.65 | 4 |
| 33 | `dsh-outlook` | 2.11.0 | READY_DIST | MIT | 0 | 0.13 | 4 |
| 34 | `dsh-qa-skills` | 0.9.0 | READY_SOURCE | MIT | 0 | 2.13 | 4 |
| 35 | `dsh-git-memory` | 0.9.3 | READY_SOURCE | MIT | 0 | 0.95 | 4 |
| 36 | `@nanmicoder/dsh-agent-teams` | 0.1.22-rc.1 | READY_DIST | MIT | 0 | 17.25 | 3 |
| 37 | `dsh-atomgit` | 0.1.0 | READY_DIST | MulanPSL-2.0 | 0 | 0.08 | 3 |
| 38 | `dsh-cost-meter` | 1.7.44 | READY_DIST | MIT | 1 | 11.57 | 3 |
| 39 | `@deepseek-ai/dsh-deepresearch` | 0.2.2 | READY_DIST | BSD-3-Clause | 5 | 2 | 3 |
| 40 | `dsh-notifier` | 0.13.1 | READY_SOURCE | MIT | 0 | 13.88 | 3 |

## 已进入 runtime 的 Pi_DSH_support 包（本轮之前已集成，需回归验证）

| 包 | 用途 | 当前状态 |
|---|---|---|
| `@a9i5k4/dsh-auto-memory` | 会话自动记忆 | 已写入 `manifests/runtime-web.package.json` |
| `@weibaohui/skills-management` | 技能中心管理 | 同上 |
| `@omdsh-dev/dsh-plugin-check` | 插件体检 | 同上 |
| `@weibaohui/dsh-kb` | 知识库 | 同上 |

完整明细见 `reports/support-catalog-scan.csv` 与 `.json`。
