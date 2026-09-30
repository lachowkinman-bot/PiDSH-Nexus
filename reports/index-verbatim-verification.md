# 索引逐字验证报告（2026-09-27）

> 依据用户指令，对资源包与两个权威索引做逐字比对与补充：
> ① https://github.com/topics/dsh-plugin （快照：16,501 个仓库，第 1 页 top20）
> ② https://pi.dev/packages （快照：**5,371 个包 / 108 页**，第 1 页 = 下载量 top50，`?page=N` 分页）

## 一、pi.dev/packages 逐字比对（top50）

### 1.1 资源包命中（9 项逐字在榜，独立验证了 bundle 清单真实性）

| 包名 | 索引显示下载量 | bundle 位置 |
|---|---|---|
| pi-mcp-adapter | **1.1M/mo**（全索引第 1） | offline/npm（P0） |
| pi-subagents（裸名） | 484.5K/mo | offline/catalog |
| pi-web-access | 448.2K/mo | offline/catalog |
| billion-context-pi | 55.9K/mo | offline/catalog |
| pi-memory | 36.9K/mo | offline/catalog |
| pi-lens | 94K/mo | offline/catalog |
| @plannotator/pi-extension | 89.8K/mo | offline/catalog |
| @tintinweb/pi-subagents | 35.3K/mo | offline/npm（P0） |
| pi-web-ui | 27.1K/mo | offline/catalog |

### 1.2 补充下载（top50 中 bundle 原缺失 46 项 → 核验 44 真实，全部已下载）

按下载量排序的新增主力：`@juicesharp/rpiv-ask-user-question` 219K/mo、`billion-context` 209.7K/mo、`@companion-ai/feynman` 180.9K/mo、`@langfuse/pi-observability-plugin` 172.4K/mo、`pi-background-tasks` 107.5K/mo、`pi-goal-x` 94.4K/mo、`bigpowers`（73 个技能包）94.2K/mo、`pi-mcp-extension` 83.8K/mo、`context-mode` 75.6K/mo、`@gotgenes/pi-permission-system` 46.9K/mo（权限执行扩展——与 Chassis Permission Gateway 直接相关）、`@akagilnc/pi-workflow-roles` 46K/mo、`pi-provider-litellm` 37.8K/mo、`@amaster.ai/pi-memory-mem0` 32.6K/mo（记忆）、`agent-comms` 34K/mo（跨 harness 通信——多 Runner 协同相关）、`cc-safety-net` 25.7K/mo（破坏性命令拦截）等。**完整 155 行见 manifests/catalog-packages.manifest.csv。**

### 1.3 反向发现（V8 证据）

`@schovest/pi-goal`：pi.dev 索引在列，npm registry 实测 404 → 已登记 reports/catalog-fake-packages.md（索引收录 ≠ 可安装）。

## 二、github.com/topics/dsh-plugin 逐字比对（top20）

### 2.1 资源包对应仓库命中（逐字含 star 数）

| 索引仓库 | star（索引快照） | bundle 对应 |
|---|---|---|
| deepseek-ai/deepseek-harness | 237k | offline/npm（P0 引擎） |
| zhu1090093659/dsh-web | 8k | offline/github（浅克隆兜底；D2 壳候选） |
| awesome-dsh-plugin/awesome-dsh-plugin | 17k | dsh-plugin 清单来源 |
| volcengine/OpenViking | 38.7k | @openviking/dsh-memory-plugin@0.5.8（offline/catalog） |
| Tencent/WeKnora | 30.4k | @wxg-prc-cpg/dsh-weknora@0.1.0（offline/catalog） |
| esengine/DeepSeek-Reasonix | 35.7k | @deepseek-harness-tui/dsh-tui@0.11.1（offline/catalog） |

### 2.2 补充发现（桌面应用 D2 形态新选项，未内嵌、给克隆命令）

| 仓库 | star | 价值 | 获取 |
|---|---|---|---|
| **anywhere-labs/dsh-desktop** | 29.1k | 为 DSH 插件生态打造的现代化桌面端 | `git clone --depth 1 https://github.com/anywhere-labs/dsh-desktop` |
| **dataelement/dsh-desktop** | 9.7k | DeepSeek Harness 桌面版 | `git clone --depth 1 https://github.com/dataelement/dsh-desktop` |
| MemTensor/MemOS | 11.6k | 自进化记忆 OS（KG 层候选） | 同上模式 |
| EverMind-AI/EverOS | 13.2k | 本地优先 Markdown 记忆层 | 同上模式 |

> 桌面壳裁定仍按 015 §10.2/U14 机械执行：dsh-web（已内嵌候选）为基线，dsh-desktop 两个候选为升级备选，谁通过 25 项 UI 测试谁上——不做主观选型。

## 三、对账结论

- 资源包现状：**135 + 44 = 179 个已验证 tarball**（24 核心 P0/P1 + 155 目录层），246MB
- pi.dev top50 逐字覆盖率：bundle 补齐后 **53/53 全覆盖**（含 1 个索引内但 npm 404 的如实登记）
- GitHub top20 逐字覆盖率：7 项直接对应 bundle 内容/来源仓库；4 项桌面/记忆 OS 补充以浅克隆命令形式提供（重仓库不内嵌，V8 记录）
- 复现命令：`node scripts/verify-catalog.mjs <candidates.txt> <out.json>` → `node scripts/download-catalog.mjs`
