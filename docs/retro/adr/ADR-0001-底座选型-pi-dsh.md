# ADR-0001 · 底座选 pi + dsh（而非单一框架或自研编排）

- **状态**：已采纳（as-built）｜**决策日**：2026-09-27｜**模块**：M1/M8
- **证据**：会话 `sess_ba129a7d`(09-27 07:02)、`sess_8ca501ae`(09-27 07:48 / 13:14 / 13:46)；`~/.zcode/cli/memories/projects/hr_ai-*/memory/workbench-plans-evaluation.md`；memory `pi-dsh-eval-2026-09.md`；`015` L48

## 背景
用户要交付"通用 Agent 工作台桌面版"，需先定底座。当时评估了三类候选（DSH 生态 / Pi 生态 / MultiAgents 编排方案），且要能"发给任一 Agent 即可执行"。评估维度：可行性、实操性、预备材料充分+必要、交付质量。

## 决策
**pi + dsh 双底座**：pi（0.87.1）作模型执行引擎，dsh（0.1.7-rc.2）作壳与插件宿主；工作台以 dsh client-ui 插件形态植入壳内。一票否决项随之确定：① dsh 必须 ≥0.1.2（CVE）；② 全部依赖锁版本；③ Web UI 端口绝不暴露公网。

## 被否决的方案
| 方案 | 否决理由（原文依据） |
|---|---|
| **纯 Pi 路线** | 工程质量最高但当时"版本周更 + 高频 breaking（0.84.0 换 Session API）"，且 Gondolin 微 VM 与 pi-google-services **不支持 Windows**，Office 生成需自建 → 定位**长期储备**，本期不选 |
| **MultiAgents 编排（工作台搭建方案）** | 立论"Codex 无原生 subagent"**已过时**（约 2026-03 GA）；多智能体编排实证风险：Anthropic 官方承认 **~15× token 放大**、每 subagent 重复 ~30k 系统提示、NeurIPS 2025 约 79% 失败源于规约错位 → 备选、需大改 |
| **011-workbuddy 主干** | ①首道门禁就卡死在 npm E404；②PS `try/catch` 假成功；③"30 GT 100% PASS"门槛必然导致卡死或造假 |
| **011-01 minimax 版** | 21/22 个行业包名**虚构** → "唯一必然失败，禁止外发" |
| **doubaowork** | 5 处强制人工等待，无法自治 |
| **自研微编排器（acp-bridge / hive 等）** | 与时间盒错配，且无生态支撑 |

## 后果
- 底座共识使"资源包 + 任务书"可分发给任意 Runner（10 Runner 兼容矩阵，4 行不核验、不写能力承诺）。
- 代价：**dsh 处于 developer preview**、破坏性变更频繁 → 必须重锁版本（见 ADR-0003）并维护 overrides 解药（见 ADR-0013）。
- 代价：pi/dsh 的**界面定制能力**成为后续形态决策的前提（见 ADR-0002）。
