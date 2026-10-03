# PiDSH Nexus 0.1.7 · Release Preview

本文件是 GitHub Pre-release「PiDSH Nexus 0.1.7」的随包复现说明。目标：任何人在 GitHub 下载本源码包（Source code zip/tar.gz）后，不依赖开发机私有目录，即可复现基线并继续迭代。

## 1. 版本标识

| 项 | 锁定值 | 证据 |
|---|---|---|
| 产品版本 | PiDSH Nexus 0.1.7（Release Preview） | tag `v0.1.7-preview` |
| 工程包 | universal-workbench-3.0（桌面壳 3.0.0，工作台插件 4.0.0） | `src-tauri/tauri.conf.json`、`workbench-ui-plugin/package.json` |
| DSH 引擎 | `@deepseek-ai/dsh@0.1.7-rc.2` | `manifests/packages.manifest.csv`、`tools-versions.txt` |
| 引擎 SHA256 | `5f2da7272d9485abc223e681075809a8d929697c5232ee445718e1b7e066bff8` | `016-插件化交付增补-v3.0.md` §2 |
| Node | 24.21.0（硬要求 >=24.19 LTS） | `tools-versions.txt` |
| Node zip SHA256 | `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541` | `tools-versions.txt` |
| pnpm | 10.32.1 | `tools-versions.txt` |

## 2. 发布边界：只发源码

本预发布提供 GitHub 自动生成的 **Source code (zip / tar.gz)**，不附带二进制产物。以下目录按设计不入库，可由脚本重建：

| 排除项 | 重建方式 |
|---|---|
| `offline/`、`offline-3.0/` | `scripts/download-all.ps1`（或 `.sh`）、`scripts/build-runtime-bundle.ps1` |
| `installer-output/`、`deliverables/` | `scripts/installer/` + 各构建脚本 |
| `node_modules/`、`src-tauri/target/` | `npm ci`、`cargo build` |
| `Pi_DSH_support/` | 第三方包来源目录，仅重建目录清单时需要 |

不在本预发布分发 runtime/安装器的直接原因见 `THIRD-PARTY-NOTICES.md` §8：出厂 runtime 含 AGPL-3.0、GPL-2.0 与未声明许可组件，未完成移除前不得再分发二进制。源码包本身为 Apache-2.0。

## 3. 30 秒路径（零依赖）

双击/浏览器打开仓库根目录 `app.html`：数据内联、`file://` 可用、无需 Node 与网络。

本预发布标签下 `app.html` 的 SHA256 为 `ac83e11907b5eb425890d77277abd0a33419595dfb888008c922e01e1806288a`；重建方式：

```bash
npm ci
npm run build:app
```

## 4. 源码复现（Windows，发布时实测）

环境：Windows + PowerShell 7 + Git；Node >=24.19（也可由 `download-all.ps1` 自带便携 Node）。

```powershell
# 0) 构建期依赖（联网一次；之后可断网）
npm ci

# 1) 无需 runtime profile 的四道源码门禁
npm run design:verify              # 21/21
npm run verify:deliveries          # 117/117（Office 格式转换需本机 LibreOffice）
npm run verify:workflow-contracts  # 549/549
npm run verify:workflow-delivery   # 546/546

# 2) 单文件工作台（应复现上面的 app.html 哈希）
npm run build:app
```

> `npm run capabilities:verify` 读取 `.dsh-home/profiles/web` 的已安装 runtime，全新源码包必须先完成 §5 第 1-2 步（下载层 + `workbench.ps1 -Cmd install`）才能通过；未安装时会如实报 `运行时 profile 缺少包`，不是源码缺陷。

## 5. 完整 runtime / 桌面壳重建

```powershell
# 1) 离线依赖层：24 个 npm tarball + pnpm 10.32.1 + 便携 Node 24.21.0 + dsh 0.1.7-rc.2
pwsh -File scripts/download-all.ps1
node scripts/download-catalog.mjs        # 完整 runtime 必需（155 个目录包）

# 2) 安装引擎与插件到项目内隔离 profile（.dsh-home）
pwsh -File scripts/workbench.ps1 -Cmd install
npm run capabilities:verify        # local=146 live=0 blocked=22 n/a=5 fail=0

# 3) 生成源码产物
npm run design:build
npm run build:delivery
npm run build:app

# 4) 组装运行时与桌面壳（可选，产物很大）
pwsh -File scripts/build-runtime-bundle.ps1     # -> offline-3.0/runtime-web.zip
pwsh -File scripts/build-tauri.ps1              # 需要 Rust stable

# 5) 启动（缺引擎/插件时先静默补齐）
pwsh -File scripts/launch.ps1
```

macOS / Linux：`bash scripts/download-all.sh`、`bash scripts/workbench.sh install` 可用于依赖层与安装层；桌面壳与安装器以 Windows 路径为发布验证路径（见 §7）。

## 6. 发布时验证证据

2026-10-03 在提交本预发布标签的同一源码树上实测：

| 门禁 | 结果 |
|---|---|
| 领域设计 | `21/21 PASS` |
| 交付矩阵 | `117/117 PASS`（13 项 Office 转换在 LibreOffice 可用环境下通过） |
| 运行时能力矩阵 | `PASS local=146 live=0 blocked=22 n/a=5 fail=0`（需先完成离线安装链） |
| 工作流契约 V2 | `549/549 PASS` |
| 工作流交付矩阵 | `546/546 PASS` |
| app.html 可复现性 | 重建哈希 `ac83e119…6288a`，与本标签产物逐字一致 |

完整证据落盘：`reports/domain-work-design-validation.json`、`reports/delivery-matrix.json`、`reports/r12-runtime-capabilities.json`、`reports/r12-workflow-contracts.json`、`reports/r12-workflow-delivery-matrix.json`。

### 干净源码包端到端复现（2026-10-03 实测）

在只含 Git 跟踪文件的干净检出中（无 `offline/`、`node_modules/`、`.work/`、`.dsh-home/`），按 §5 顺序执行：

| 步骤 | 结果 |
|---|---|
| `pwsh -File scripts/download-all.ps1 -SkipDshWeb` | 24 个 npm 包 + pnpm 10.32.1 + 引擎双落点 + 便携 Node 24.21.0 全部 OK |
| `node scripts/download-catalog.mjs` | 155/155 tarballs（重叠核心 5，新增 150） |
| `npm ci` | 134 包安装成功 |
| `pwsh -File scripts/workbench.ps1 -Cmd install` | `INSTALL_DONE`；`dsh --version` = `0.1.7-rc.2`；24 包 + 工作台插件全部 exit 0 |
| `pwsh -File scripts/build-runtime-bundle.ps1` | `RUNTIME_BUNDLE_OK`，该次构建 548,446,769 B，build-id `9dd6dd8e…` |
| 再次 `install` 刷新完整 profile | `INSTALL_DONE` |
| 五道门禁 | 与 §6 表一致：21/21、117/117、`local=146 … fail=0`、549/549、546/546 |

`runtime-web.zip` 的字节数与 build-id 会随 tarball 集合/时间戳变化，不承诺固定哈希；可复现的是「同一源码包 + 同一下载清单 → 门禁全绿」。

## 7. 已知限制

- 真实 LLM 与三方云服务未配置凭据：相关能力按设计进入 `blocked_external`，未宣称真实联调通过。
- 全新源码包中 `capabilities:verify` 依赖 `.dsh-home/profiles/web`；这是安装链的验收门禁，不属于免安装构建门禁。
- 主壳左上角字标 T1 仍暂停（保留上游字标），窗口/安装器/工作台面板已使用 PiDSH Nexus 品牌。
- 完整桌面 runtime 重建当前以 Windows 为验证路径；macOS/Linux 的 `download-all.sh` + `workbench.sh` 提供依赖层/安装层，但桌面壳与安装器未在本次预发布中实测。
- dsh `0.1.7-rc.2` 为锁定预发布引擎：禁止跟随 latest，禁止降级到 <=0.1.5-rc.3。
- 安全边界：服务仅监听 `127.0.0.1`；`.env` 不入库，凭据不得写入源码包。

## 8. 迭代入口

- 领域结构：`scripts/build-domain-work-design.mjs` → `npm run design:build && npm run design:verify`
- 工作台插件：`workbench-ui-plugin/src/` → `npm run build:delivery` → `npm run verify:workbench-ui`
- 单文件工作台：`src/app.js`、`src/theme.css` → `npm run build:app`
- 桌面壳：`src-tauri/src/main.rs`、`src-tauri/tauri.conf.json` → `pwsh -File scripts/build-tauri.ps1`
- 依赖升级：先同步 `manifests/versions-lock.txt`、`tools-versions.txt`，再更新 `scripts/download-all.ps1|sh` 的白名单与 SHA256

术语与领域边界见 `CONTEXT.md`、`docs/adr/`、`docs/domain-design/GRILL-DECISIONS.md`。
