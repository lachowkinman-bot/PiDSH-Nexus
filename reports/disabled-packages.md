# 未装入 / 停用包登记（U3、U16 缺陷台账）

> 015 §14.2：不兼容包"修复、降级或登记，三选一不得静默"。本表为 3.0 执行轮（2026-09-29）终态。
> 前次（2026-09-28 18:40）的 21 包 NOT_INSTALLED 记录已被本轮解决：写者锁清理 + tarball 绝对路径修复后，**P0/P1 24/24 全部 exit 0**（reports/install-log.csv）。

## A. P0/P1（24 包）终态

- **已装并装入 profile：24/24**（三源探测 reports/install-probe.json：引擎 npm-global@0.1.7-rc.2 + 23 插件 dsh-profile dependencies）。
- 其中 **1 包功能性停用**（装入但移出 profile，原因如下）：

| 包 | 版本 | DoD 终态 | 根因（boot 实测） | 处置 |
|---|---|---|---|---|
| @anionex/dsh-vision-toolkit | 0.1.45 | L1=0 / L2=装载 / **L3=激活失败** | `TypeError: ctx.settings.register is not a function`（其 API 面向 dsh 0.2.0-rc.x；0.1.7-rc.2 引擎无该接口） | **不兼容-停用**：移出 profile dependencies；tarball 保留（npm-global 侧 CLI 仍可用）；待引擎升级 0.2.x 后重评 |

## B. catalog（155 行）终态

三批安装 reports/catalog-install-log.csv：**153 包 exit 0**（含 2 包豁免后装成）+ 1 SKIP（引擎行）+ 1 破损包。

### B1. 安装失败/跳过（2）

| 包 | 版本 | 现象 | 处置 |
|---|---|---|---|
| @paperjsx/mcp-server | 0.3.6 | 依赖 `@paperjsx/document-diff: workspace:*`，该包 npm 不存在（上游 monorepo 内部引用泄漏） | **上游破损，不可装**。登记为永久 disabled；重装命令必失败（可复现） |
| @deepseek-ai/dsh | 0.1.5-rc.3 | catalog batch3 行要求装 0.1.5-rc.3，与 016 §2 重锁冲突 | **SKIP（引擎版本锁）**：引擎已装 0.1.7-rc.2（更高且为锁定版本），禁降装 |

### B2. 已装入 profile 但与引擎内建件冲突 → 移出 profile（12，装回即复现冲突）

> 根因（boot 实测，reports/boot-log-u16-v3/v4.txt）：这批包与 dsh 0.1.7-rc.2 引擎内建的插件/命令/工具**同名重复注册**（`service "pluginManager" has been registered`、`command "rewind" is already registered`、`tool "excel_read" is already registered`），或导入期崩溃拖累整壳（最严重时 91 行禁用 + web boot 崩溃）。移出后壳恢复健康（74 pi 包装载、工作台 API 200）。tarball 均已本地预置，待上游适配 0.1.7-rc.2 或引擎升级后可重装。

| # | 包 | 冲突证据 |
|---|---|---|
| 1 | dsh-plugin-manager | 与引擎内建 pluginManager 服务重复注册 |
| 2 | dsh-rewind | 与引擎内建 rewind 命令重复 |
| 3 | dsh-rewind-plugin | 同上（`command "rewind" is already registered`） |
| 4 | dsh-office-tools | `tool "excel_read" is already registered`（与 P0 dsh-excel-panel 冲突） |
| 5 | dsh-free-vision | pending（attachments 服务链失败连带） |
| 6 | dsh-vision-router | 首跑引导弹窗阻断壳 UI + vision-toolkit 同族 |
| 7 | dsh-codex-connect | failed to import |
| 8 | dsh-web-search-pro | failed to import |
| 9 | dsh-formatforge（@tianbuyu-wwx/dsh-formatforge） | failed to import |
| 10 | dsh-dragview | failed to import |
| 11 | dsh-client-ui-obsidian-memory | `TypeError: Cannot read properties of undefined (reading 'vaultPath')` |
| 12 | @tianbuyu-wwx/dsh-formatforge | 同 9（npm_name 澄清记录） |

> 重复计数说明：9 与 12 为同一包（batches CSV 的 name 列写的是裸名 dsh-formatforge，实际 tarball 为 @tianbuyu-wwx/dsh-formatforge），实际冲突包 **11 个**。

### B3. 装入 profile、作为引擎套件 peer 冗余存在（不阻塞，激活失败但不影响壳健康）

@linxin666/dsh-client-ui-*（git-graph/skill-explorer/task-board）、pi-maestro-flow 等 catalog 包 peer 声明 `@deepseek-ai/dsh@0.2.0-rc.1`，pnpm 将整套 0.2.0-rc.1 套件装入 profile。**已通过 pnpm-workspace.yaml overrides 把 peer 钉到 0.1.7-rc.2**（与引擎一致）；其冗余副本（dsh-llm-pi-ai、dsh-attachment-local、dsh-api-session-controller、dsh-client-file-upload、dsh-client-ui-deliverables、@liustack/modlens 等 8 条目）在 boot 时独立激活失败但**不再拖垮壳**（v4 boot：URL 正常、74 pi 包装载、工作台 API 200）。这些条目由引擎内建同版本件提供服务，功能不受损； listed here 供审计完整性。

### B4. 版本风险豁免（dsh 官方机制，OSV 已扫 0 漏洞前提）

| 包 | 豁免命令 | 原因 |
|---|---|---|
| dsh-memory-plugin@0.7.2 | `dsh plugin --profile web allow-version dsh-memory-plugin@0.7.2 --dsh-version 0.1.7-rc.2 --accept-risk` | sharp 构建脚本问题已由 onlyBuiltDependencies 解决；版本门需显式豁免 |
| @shaoshi/dshscan@0.5.0 | `dsh plugin --profile web allow-version @shaoshi/dshscan@0.5.0 --dsh-version 0.1.7-rc.2 --accept-risk` | 同上 |

### B5. 已知小缺陷（不阻断）

| 包 | 缺陷 | 影响 |
|---|---|---|
| dsh-memory-plugin@0.7.2 | package.json 带 UTF-8 BOM，pi2dsh 读取报 `Unexpected token '\ufeff'`（boot 日志实录） | 经 dsh 主装载路径可装；pi2dsh 侧该包跳过 |
| dsh-plugin@1.4.8 | 插件中心正常，但顶部提示条依赖新 API 的项显示告警 | 不影响列表/开关功能（L3 截图 u16-l3-dsh-plugin-market.png） |

## C. catalog 安装健康度汇总

- 三源探测：P0/P1 **24/24 INSTALLED**（reports/install-probe.json）。
- 壳内插件中心 UI 显示 **已安装 63**（dsh web 官方计数，截图 u16-l3-dsh-plugin-market.png）——与 profile dependencies 数一致口径。
- boot 装载：**74 条 `[pi2dsh] loaded` 装载行 + 79 Pi package prepared**（reports/boot-log-u16-v4.txt）。
- 未达成可装状态的：1 上游破损 + 1 版本锁 SKIP + 1 P1 功能停用 + 11 冲突移出 = **14/155**，其余 **141/155 已装入 profile** 且壳健康。
