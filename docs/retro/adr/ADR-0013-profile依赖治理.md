# ADR-0013 · profile 依赖治理：overrides 钉版（否决"删包/禁用/手工 patch"）

- **状态**：已采纳（as-built）｜**决策日**：2026-09-29（R6；根源在 U16 的 catalog 安装期）｜**模块**：M14
- **证据**：`.dsh-home/profiles/web/pnpm-workspace.yaml`（overrides 块）；`reports/disabled-packages.md`；`reports/r6-profile-attachment-fix.md`；`.work/profile-backup-r6/`

## 背景
两类**由 catalog 包引入**的依赖事故：
1. **peer 冲突崩壳**：若干 catalog 包（`@linxin666/dsh-client-ui-*`、`pi-maestro-flow` 等）peer 声明 `@deepseek-ai/dsh@0.2.0-rc.1` → pnpm 把整套 0.2.0-rc.1 解析进 profile → 与重锁的 0.1.7-rc.2 冲突 → **91 行禁用 + `dsh-llm-pi-ai` 崩溃整壳**。
2. **版本遮蔽致死链**：catalog 包 `dsh-lark-bot@0.19.16` 把 `@deepseek-ai/dsh-attachment@0.1.0-rc.8` 作为**普通依赖** → pnpm（hoisted）把它提升到 profile 根 → 引擎自带 `dsh-attachment-local@0.1.7-rc.2` / `llm-pi-ai@0.1.7-rc.2` 从根解析到旧版（缺 `ImageVariantId`/`requestImageDimensions` 导出）→ **import 失败** → `attachments` 服务缺失 → `session-controller`/`file-upload`/`modlens` 永久 pending → `ui-deliverables` 再 pending → `dsh-task-board` **每 5s 轮询报错（≈9MB/天日志）**。同类潜伏第二处：`dsh-sdk-protocol` 0.1.1-rc.2 vs 引擎 0.1.7-rc.2。

## 决策
在 `.dsh-home/profiles/web/pnpm-workspace.yaml` 的 `overrides` 中**钉到引擎同版本**（与既有 `@deepseek-ai/dsh*` 同一处方）：
```yaml
  "@deepseek-ai/dsh-attachment": "0.1.7-rc.2"
  "@deepseek-ai/dsh-sdk-protocol": "0.1.7-rc.2"
```
然后 `dsh plugin --profile web install`；**改前备份**（`package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`）。

## 被否决的方案
| 方案 | 否决理由 |
|---|---|
| **移除 `dsh-lark-bot`** | 它是 profile 里**唯一**引入 `dsh-attachment` 的包，删了会变成 `Cannot find module`，attachments 依旧死 |
| **禁用 `dsh-task-board` 消音** | 只治症状：报错停了，但 attachments/file-upload/deliverables/llm-pi-ai 仍全死 |
| **手工 patch profile 文件** | 不可复现、下次安装即失效（且绕过安全扫描） |
| **elevating 到 0.2.x 全家桶** | 违反版本锁；且引擎侧契约在 0.1.7-rc.2 |
| **把 11 个冲突包留而不管** | 会复现整壳崩溃 → 移出 profile 并留台账 |

## 后果
- dev 壳实测：**pending 4→0、failed-to-import 2→0、报错循环归零（106 B/s → 0）**；`loaded` 76 不变；`/app-page` 200；`verify-app 41/41` 无回归；`dsh-lark-bot` 仍装载。预设警告（6 条 `failed to mount @agimon-ai/doompi-*`）**修前修后同为 6 条**，未放大。
- **边界**：该修复针对 **dev profile**（U16 catalog 引入）；全新安装的产品 profile（只装 P0/P1）**本就没有这条链**（产品实例实测 `pending 0 / failed-to-import 0`）。
- **未验证**：`dsh-lark-bot` 现按 0.1.7-rc.2 解析 `dsh-attachment`（其声明是 0.1.0-rc.8），装载正常但**业务级功能未回归**（需飞书凭据）。
- **附带教训**：曾有一次**擅自改动用户既有环境**（`~/.dsh/profiles/web` 被 pnpm 加了 pi2dsh）后主动回滚——根因是 `dsh plugin add` 的**相对路径按调用方 cwd 解析**。
