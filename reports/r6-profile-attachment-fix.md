# R6 · dev profile 死链治理：`@deepseek-ai/dsh-attachment` 版本遮蔽（2026-09-29）

> 目的：用户要求"各组件都能够顺畅运行"。dev 壳（3810）此前有 4 个插件永久 pending + 每 5 秒一次的报错循环
> （boot 日志 ~106 B/s ≈ 9 MB/天）。本轮定位到**单一根因**并修掉，互锁链条整条消失。

## 1. 症状（修前实测）

| 现象 | 修前 |
|---|---|
| `pending (waiting for service...)` | **4**：`session-controller`(缺 attachments, fileUploads)、`file-upload`(缺 attachments)、`modlens`(缺 attachments)、`ui-deliverables`(缺 sessionController) |
| `failed to import` | **2**：`attachment-local`、`llm-pi-ai` |
| 报错循环 | `[dsh-task-board] session/list failed` —— 每 5s 一次，12 行/次，**106 B/s（≈9 MB/天）** |
| 连带能力 | 图片/文件上传、交付物 UI、task-board 会话复用、llm-pi-ai provider 全部不可用 |

## 2. 根因（代码级）

```
dsh-lark-bot@0.19.16（catalog 包）把 @deepseek-ai/dsh-attachment@0.1.0-rc.8 声明为普通依赖
   ↓ pnpm（nodeLinker: hoisted, autoInstallPeers: false）
profile 根 node_modules/@deepseek-ai/dsh-attachment 被提升为 0.1.0-rc.8（旧）
   ↓ 引擎自带的 dsh-attachment-local@0.1.7-rc.2 / dsh-llm-pi-ai@0.1.7-rc.2 从根解析
0.1.0-rc.8 缺 ImageVariantId / requestImageDimensions 导出 → ESM link 期失败
   ↓
attachments 服务未注册 → session-controller/file-upload/modlens 永久 pending → ui-deliverables 再 pending
   ↓
dsh-task-board 每 5s 轮询 session/list → gateway/service-unavailable → 报错循环
```

同链路第二处潜伏不同版：`@deepseek-ai/dsh-sdk-protocol` profile 0.1.1-rc.2 vs 引擎 0.1.7-rc.2（一并钉齐）。

## 3. 处置（改动最小、可回滚）

在 `.dsh-home/profiles/web/pnpm-workspace.yaml` 的 `overrides:` 追加两枚（与既有 `@deepseek-ai/dsh*` 钉版同一处方）：

```yaml
  "@deepseek-ai/dsh-attachment": "0.1.7-rc.2"
  "@deepseek-ai/dsh-sdk-protocol": "0.1.7-rc.2"
```

然后 `dsh plugin --profile web install`（pnpm install，29.7s，downloaded 3 / added 76）。

**改前备份**：`.work/profile-backup-r6/{package.json,pnpm-lock.yaml,pnpm-workspace.yaml}.bak`（一键可回滚）。
**不需要**移除 `dsh-lark-bot`——它是 profile 里唯一引入 `dsh-attachment` 的包，删了会变成 `Cannot find module`，attachments 依旧死。

## 4. 修后实测（同一 shell，重启取证）

| 指标 | 修前 | 修后 |
|---|---|---|
| `pending` | 4 | **0** |
| `failed to import` | 2 | **0** |
| `crash` / `EADDRINUSE` | 0 / 0 | 0 / 0 |
| `loaded` | 76 | 76（不变） |
| task-board `session/list failed` | ~6 次/分 | **0** |
| boot 日志增长 | 106 B/s | **0 B / 10s** |
| `dsh-lark-bot` | 装载 | 仍装载（打印其飞书凭据向导，非报错） |
| `/workbench/api/app-page` | 200 | **200 / 398,440 B** |
| `verify-app.mjs --base 3810` | 41/41 | **41/41**（无回归） |
| 版本 | root dsh-attachment 0.1.0-rc.8 / sdk-protocol 0.1.1-rc.2 | **0.1.7-rc.2 / 0.1.7-rc.2** |

预存的 6 条 `failed to mount @agimon-ai/doompi-*` 等警告**修前修后同为 6 条**（属 pi2dsh 的逐扩展错误隔离，与本修复无关，未放大）。

**新日志**：`reports/boot-log-r6-overrides.txt`；回归截图 `reports/ui-walkthrough/r6-dev-shell-panel-after-override.png`。

## 5. 边界（不夸大）

- 该修复针对 **dev profile**（U16 装的 catalog 包引入的问题）。**全新安装的产品 profile（只装 P0/P1）本就没有这条链**——
  产品实例实测 `pending 0 / failed-to-import 0`（见 `reports/desktop-acceptance.md` §5）。
- `dsh-lark-bot` 现按 0.1.7-rc.2 解析 `dsh-attachment`（其声明是 0.1.0-rc.8）。该包在两种版本下均能装载，
  但**其运行时功能未做业务级回归**（需要飞书凭据）——如实登记为未验证面。
- 本轮**未**动 `disabled-packages.md` 里的 11 个冲突包台账。
