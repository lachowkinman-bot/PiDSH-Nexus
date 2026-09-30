# 目录核验 · 报告推荐但 npm 不存在的包（V8 反虚构证据）

> 来源：两份分析报告（dsh-plugin 2026-09-03 / pi.dev 2026-09-04）抽取的 139 个候选，经 `scripts/verify-catalog.mjs` 逐一 `npm view` 实测（2026-09-27）。复现：`node scripts/verify-catalog.mjs scripts/_candidates.txt scripts/_catalog-verified.json`。

## 结论

- **真实存在并已下载：111 个** → offline/catalog/（106 新增 + 5 与核心 P0/P1 重叠）
- **npm 不存在（不可用）：28 个** → 如下表。任何任务书/脚本不得引用（V5/V6）

## 28 个不存在名单

| # | 包名 | 备注 |
|---|---|---|
| 1 | **pi-mentis** | pi 报告推荐（向量+全文+图），npm 实测 404 → 以 graph-memory + pi-vault-mind 替代 |
| 2 | dsh-web | 已知 E404（GitHub 源码分发，git clone --depth 1 兜底） |
| 3 | dsh-task-board | dsh-web monorepo 子包，经 @linxin666/dsh-client-ui-task-board（真实，已下载） |
| 4 | dsh-skill-explorer | 同上，经 @linxin666/dsh-client-ui-skill-explorer（真实，已下载） |
| 5 | dsh-vision-toolkit | 真实包为 @anionex/dsh-vision-toolkit（已预置 P1），裸名不存在 |
| 6 | dsh-weknora | 真实包为 @wxg-prc-cpg/dsh-weknora（已下载） |
| 7 | dsh-agent-teams | 真实包为 @nanmicoder/dsh-agent-teams（已下载） |
| 8 | dsh-auto-memory | 真实包为 @a9i5k4/dsh-auto-memory@3.1.7（已下载） |
| 9 | dsh-collaboration | 无 |
| 10 | dsh-file-mentions | 无 |
| 11 | dsh-free-web-search | 无（替代：dsh-web-search-pro 已下载） |
| 12 | dsh-git-hygiene | 无 |
| 13 | dsh-market | 无（真实：dsh-plugin-market? 未核验到；用 dsh-plugin 官方入口） |
| 14 | dsh-plans | 无 |
| 15 | dsh-plugin-man | 无（真实：dsh-plugin-manager 已下载） |
| 16 | pi-search-tools | 无（替代：pi-web-access@0.31.0 已下载） |
| 17 | dsh-todo-guard | 无 |
| 18 | dsh-toolkit | 无 |
| 19 | @atlassianlabs/jira-mcp-server | npm 无（Jira MCP 走其他分发渠道，登记扩展位） |
| 20 | @slack/mcp | npm 无（Slack MCP 走官方 pip/远端，登记扩展位） |
| 21 | @thinkdrive/google-drive-mcp | npm 无（登记扩展位） |
| 22 | pi-ch | 报告文本截断噪声 |
| 23 | pi-fe | 同上 |
| 24 | pi-go | 同上 |
| 25 | pi-ma | 同上 |
| 26 | pi-mc | 同上 |
| 27 | pi-su | 同上 |
| 28 | @scope/pkg | 文档示例占位符 |
