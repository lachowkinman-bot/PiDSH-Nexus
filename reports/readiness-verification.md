# 方案就绪度逐字核验报告（2026-09-27）

> 核验问题：目录下方案（015 任务书 v2.0 + universal-workbench-bundle）是否已可交由 Agent（pi / codex / claude code / zcode / dsh / minimax / 豆包工作 / Trae Work / Kimi code / opencode）基于 pi + dsh 设计并交付高质量全能 Agent 工作台桌面应用，并达到 11 个开源 agent 的交付质量水平。

## 一、基准 agent 核验（11/11 逐字核验，复现：npm view + GitHub search）

| 基准 | 核验结果 | 证据 |
|---|---|---|
| Codex（开源版） | ✅ 真实：@openai/codex@0.157.1 | npm registry |
| pi | ✅ 真实：@earendil-works/pi-coding-agent@0.87.1，109.6k★ | npm + github.com/earendil-works/pi |
| deepseek harness | ✅ 真实：@deepseek-ai/dsh@0.1.5-rc.3，237k★ | npm + github topics 快照 |
| Zcode | ✅ 真实（本机 runner-probe 实测探测出 CLI） | runner-profile.json |
| GenericAgent | ✅ 真实：lsdefine/GenericAgent **14,257★**（自进化技能树，3.3K 行种子） | GitHub search |
| multica | ✅ 真实：multica-ai/multica **51,406★**（人机协作开源可自托管） | GitHub search |
| Octop | ✅ 真实：TencentCloud/Octop **5,152★**（多用户多 agent 自托管助手） | GitHub search |
| minimax-code | ⚠️ 生态真实：MiniMax-AI/MiniMax-M2 2,602★（npm 未分发产品本体） | GitHub search |
| MiMo-Code | ⚠️ 生态真实：小米 MiMo；第三方 CLI raaaaap/mimo-code 14★ | GitHub search |
| semantica | ❌ 无法核验为 agent（npm 无 / GitHub 无 agent 级仓库命中） | — |
| muzz | ❌ 无法核验为 agent（命中均为 React 组件/prompt 注入框架） | — |

> V8 结论：质量对标基准中 9 个可引用、2 个（semantica/muzz）**在本轮免登录渠道下无法核验**——若持有出处请补充链接，否则对标表以 9 个为准，不得宣称 11/11。

## 二、方案就绪度对账（015 §12 门禁 × 实跑证据）

| 门禁 | 状态 | 证据 |
|---|---|---|
| U1 资源预置完整性 | ✅ 实跑通过 | 24 核心 + 155 目录 tarball（SHA256）、断网校验、fetch 55 行 resolved |
| U2 脚本合规 | ✅ 双平台实跑 | bash fetch + PS5.1 fetch/verify/report（BOM 缺陷实跑发现并修复） |
| U3 安装与独立性 | ⏳ 待执行 | install 子命令与逐包测试脚本就绪（本机未装 dsh 运行时） |
| U4 指令集实跑 | ⏳ 部分实跑 | R/S0/S2/S6 骨架已跑；S0-S10 全量双平台实跑为执行项 |
| U5 十要素 | ⏳ 骨架就绪 | verify 命令产出矩阵，冒烟回填 TODO |
| U6 安全 | ✅ 机制内置 | 版本锁 ≥0.1.2（CVE-2026-82533）、host 白名单、redact_gate |
| U7 记忆与知识 | ✅ KG 层完备 | 13 种子 + 图谱配置 + 注入语料 + 11 个 KG 包（graph-memory/vault-mind/llm-wiki/billion/MemOS 系） |
| U8 文档质量 | ✅ 体系闭合 | 缺陷清零 22 类 + CR 五类 checklist + V1-V8 一票否决 |
| U9 交付打包 | ⏳ 就绪待跑 | report/package 子命令 |
| U10 场景与工作流 | ✅ 资产完备 | 14 Scene / 26 工作流 / 52 技能 / 13 设计文档 / Type-Dict |
| U11 学员件实测 | ⏳ 待执行 | 指令集与实测留痕模板就绪 |
| U12 防断供演练 | ⏳ 待执行 | 机制 + gap 登记链路就绪（28+1 假包已实证登记） |
| U13 Runner 兼容 | ✅ 探测实跑 | runner-probe 实测产出 profile；10 行矩阵；全链实跑待执行（9 个 UNVERIFIED 如实标注） |
| U14 桌面安装器 | ⏳ 基线就绪 | setup.iss / build_dmg.sh / launch.ps1；另有两个新桌面候选（anywhere-labs/dsh-desktop 29.1k★、dataelement/dsh-desktop 9.7k★） |

## 三、对标 11 agent 交付质量的维度覆盖

| 质量维度（这些 agent 的共性能力） | 本方案的对应物 | 就绪 |
|---|---|---|
| 多 agent 编排 | pi-agents/pi-subagents/@tintinweb 子代理 + pi-dag-core DAG + skills-cockpit Chief of Staff + 26 工作流 | ✅ |
| 权限/沙箱 | pi-approval-guardian + @mutmutco 多级审批 + @gotgenes/pi-permission-system（目录层）+ cc-safety-net | ✅ |
| 记忆/知识图谱 | graph-memory 主图 + pi-vault-mind/llm-wiki/billion-context + 13 域种子 + 注入语料 | ✅ |
| 文档/视频交付 | 8 格式矩阵（pptx/xlsx/docx/html/md/pdf/chart/video）+ dsh-ppt/office-tools/univer-office | ✅ |
| 桌面 UI | dsh-web 8k★ + dsh-desktop 29.1k★/9.7k★ 双候选（U14 机械裁定） | ✅ |
| 可观测 | pi-stats-footer + langfuse/langsmith/raindrop 扩展（目录层） | ✅ |
| 供应链治理 | 版本锁 + SHA256 + 哈希链取证 + 29 假包反证档案 | ✅ |

## 四、判定

**READY WITH CONDITIONS（可发出）**——方案与资源包已达到"可交由 10 个 Agent 执行"的就绪态；对标 9 个可核验 agent 的质量维度全部有对应物且资源预置到位。

**发出前必须知道的三个条件**：
1. U3/U4/U10-U14 六道门禁属**执行期工作**（安装/桌面构建/双平台全量实跑/防断供演练）——交付质量由门禁机械保证，不由本报告声明；任何"未跑即交付"触发 V1。
2. 10 Runner 中 9 个为 UNVERIFIED（仅 pi/dsh 深度核验）——矩阵照发，实测后回填；semantica/muzz 两个基准不可引用（V8）。
3. pi-vault-mind 需 Node ≥24.19：建议把 versions-lock 的 Node 基线从 22.19 改为 **24.19 LTS**（或接受该包降级为可选）——二选一，发出前定死。
