# PiDSH Nexus · Universal Workbench 3.0

13 个业务域的企业级工作台：**桌面壳（Tauri 2 / Rust）+ dsh 工作台插件 + 领域模型 / 工作流 / 数据契约 / 数据台账**。
本仓库是**源码包**：不携带离线依赖与安装包（体积原因，见 §6），按下方步骤可在本机完整复现，并在此基础上继续迭代。

- 主工作面：dsh 壳内「⟡ 工作台」插件，13 域驾驶舱 + 模块 / 事项 / 工作流 / 审批 / 交付物 / 成效复盘
- 桌面形态：`src-tauri/` 原生壳，启动后在本机 `127.0.0.1:3080` 拉起服务并以应用窗口打开（非浏览器标签页）
- 轻量形态：仓库自带 `app.html`（单文件、数据内联），双击即用，不需要 Node，也不需要网络

> 需求与门禁的唯一真源：`016-插件化交付增补-v3.0.md`（执行入口，优先级最高）→ `015-Universal-Workbench-通用工作台交付任务书.md`（v2.2 主干）。
> 维护者视角的目录 / 脚本 / CR 流程：`docs/README-维护者版.md`；使用者视角：`docs/README-学员版.md`。

## 1. 快速开始（零依赖）

用浏览器直接打开仓库根目录的 `app.html`（双击即可）。页面内已内联全部域模型与示例数据，`file://` 协议下可离线运行。

重新生成该文件（需要 Node ≥ 24.19）：

```bash
npm ci
npm run build:app        # 产物 app.html；构建内含域模型校验与表头一致性门禁
```

## 2. 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | **≥ 24.19 LTS**（实测 v24.21.0） | 全部生成器与校验脚本；低版本会导致部分生态包不可装 |
| npm | 随 Node 附带（实测 11.x） | 根目录依赖安装 |
| PowerShell | 7 优先，兼容 5.1 | `scripts/*.ps1`（Windows 复现链） |
| Rust + Cargo | stable | 仅构建桌面壳 `src-tauri/` 时需要 |
| Inno Setup（ISCC） | 6.x | 仅打包 Windows 安装器时需要 |

网络只在「拉取离线依赖」一步需要；之后整条构建链可断网执行。

## 3. 完整复现（Windows 首选路径）

```powershell
# 0) 根目录依赖（esbuild 等构建期工具）
npm ci

# 1) 拉取离线依赖层：npm tarball 24 个 + 便携 Node 24 + 引擎 tarball（域名白名单 + SHA256 校验）
pwsh -File scripts/download-all.ps1
node scripts/download-catalog.mjs        # 可选：目录层 155 包（文档/视频/知识图谱能力）

# 2) 安装引擎与插件（便携 Node 优先入 PATH，装 dsh + pnpm + 工作台插件到本项目 profile）
pwsh -File scripts/workbench.ps1 -Cmd install

# 3) 生成源码产物
npm run design:build      # 领域设计：13 域 / 39 模块 / 78 事项 / 78 工作流 / 契约 / TypeDict
npm run build:delivery    # 工作台插件交付服务打包（esbuild）
npm run build:app         # 单文件工作台 app.html

# 4) 组装运行时与桌面壳（可选，产物很大）
pwsh -File scripts/build-runtime-bundle.ps1     # → offline-3.0/runtime-web.zip
pwsh -File scripts/build-tauri.ps1              # → src-tauri/target/release/universal-workbench.exe

# 5) 启动（缺引擎/插件时先静默补齐，再打开桌面窗口）
pwsh -File scripts/launch.ps1
```

macOS / Linux 可用 `bash scripts/download-all.sh`、`bash scripts/workbench.sh install` 完成依赖层与安装层；桌面壳与安装器脚本见 `scripts/installer/`。
打包 Windows 安装器：`ISCC scripts/installer/win/setup.iss`（产物写入 `installer-output/`，不入库）。

## 4. 复现校验（门禁）

离线即可执行：

```bash
npm run design:verify              # 领域设计 21/21
npm run verify:deliveries          # 交付矩阵
npm run capabilities:verify        # 运行时能力矩阵
npm run verify:workflow-contracts  # 工作流输入/输出契约
npm run verify:workflow-delivery   # 工作流交付矩阵
```

需要先启动壳（拿到带 token 的 URL）后执行：

```bash
npm run verify:app                 # 壳健康 + 13 域端点 + action 路由 + 审计留痕
npm run verify:platform            # 工作流平台回归
npm run verify:shell               # 壳内模块控件清单（严格模式）
npm run verify:workbench-ui        # 工作台插件 UI 旅程
npm run verify:delivery-ui         # 交付面板 UI
```

各轮验收结论与证据：`reports/r12-acceptance-summary.md`、`reports/r12-*.json`、`progress.md`。

## 5. 迭代指引

1. **生成物一律由脚本产出，不要手改。** `manifests/domain-work-design/`、`manifests/workflow-contracts/`、`manifests/typedict/`、`docs/domain-work-design/` 会被 `npm run design:build` 覆盖。
2. **改领域结构**：先改 `scripts/build-domain-work-design.mjs` 的模块映射与环节标准，再 `npm run design:build && npm run design:verify`（要求 78/78 精确覆盖）。
3. **改工作台界面**：改 `workbench-ui-plugin/src/`，跑 `npm run build:delivery`，再用 `npm run verify:workbench-ui` 回归。
4. **改单文件工作台**：改 `src/app.js` / `src/theme.css`，跑 `npm run build:app`（构建期拦截语法错误与表头漂移）。
5. **改桌面壳**：改 `src-tauri/src/main.rs` 与 `src-tauri/tauri.conf.json`，用 `pwsh -File scripts/build-tauri.ps1` 验证。
6. **升级依赖**：先核验 `manifests/versions-lock.txt` 与 `tools-versions.txt`，再按 `scripts/download-all.ps1` 的白名单同步更新 SHA256。

术语与领域边界见 `CONTEXT.md`、`docs/adr/`、`docs/domain-design/GRILL-DECISIONS.md`；沿用既有术语能避免生成器校验失败。

## 6. 仓库不含什么（按设计排除，均可重建）

| 排除项 | 体积量级 | 重建方式 |
|---|---|---|
| `offline/`、`offline-3.0/` | 数百 MB | `scripts/download-all.ps1` / `download-all.sh`、`scripts/build-runtime-bundle.ps1` |
| `installer-output/`、`deliverables/` | 数百 MB | `scripts/installer/win/setup.iss`、`scripts/installer/mac/build_dmg.sh` |
| `node_modules/`、`src-tauri/target/`、`src-tauri/gen/` | 数百 MB | `npm ci`、`cargo build` |
| `Pi_DSH_support/` | 7 GB+ / 18 万文件 | 第三方包来源目录；仅重建目录清单时需要 |
| `.env` | — | 复制 `.env.example` 并注入真实值；**禁止提交真实密钥** |

## 7. 目录速览

```
src/                      单文件工作台源码（app.js / theme.css）
src-tauri/                Tauri 2 桌面壳（Rust）
workbench-ui-plugin/      dsh client-ui 插件（13 域面板 + 平台路由 + 交付服务）
manifests/                领域模型、工作流、契约、TypeDict、清单、版本锁定
templates/                13 域数据台账 CSV、技能、workspace 骨架
scripts/                  生成器 + 门禁校验 + 下载 / 安装 / 构建总控
docs/                     PRD、ADR、领域设计、复盘、双版 README
reports/                  各轮门禁证据与验收结论
lifecycle/                领域生命周期工具（Python）
```

## 8. 配置与安全

- 复制 `.env.example` 为 `.env`，填入 `DEEPSEEK_API_KEY` / `OPENAI_BASE_URL` / `WORKBENCH_PROBE_MODEL`；`.env` 已在 `.gitignore` 中。
- 未配置凭据时，涉及模型的工作流按设计进入显式 `blocked_model` 阻塞并保留断点，不伪造成功。
- 审批签名基于本地操作者注册表 + HMAC；审批人、角色与密钥留存在本机 `DSH_HOME`，不入库。
- 业务数据默认落在 `%LOCALAPPDATA%\PiDSH Nexus\workspace`；`templates/` 为只读骨架。

## 9. 已知边界

- Windows 为第一优先平台：桌面壳与安装器脚本在 Windows 上完成实测；macOS 安装器脚本存在但未在本仓库验收。
- `reports/` 中的安装态证据是本机快照，路径与哈希在重建后必然变化。
- 真实 LLM 与第三方云服务在本轮以「显式阻塞 / 模型桩」方式验收，未宣称真实凭据联调通过。
- 10-Runner 适配矩阵中部分 Runner（minimax / 豆包工作 / Trae Work / Kimi code）未公开核验，见 `runner-profile.json`。
- 许可：本项目自有代码采用 Apache-2.0；随附第三方代码 / 资产与出厂运行时中 copyleft 插件的再分发注意事项见 §10。

## 10. 许可

- 本项目自有代码（`src/`、`src-tauri/`、`workbench-ui-plugin/`、`scripts/`、`manifests/`、`templates/`、`docs/`、`reports/`、`lifecycle/`）采用 **Apache License 2.0**，全文见 [`LICENSE`](LICENSE)，署名见 [`NOTICE`](NOTICE)。
- 随附第三方代码与素材（dsh-ppt deck-core = MIT、Noto Sans CJK = SIL OFL 1.1）、构建期依赖、Rust crates（含 5 个 MPL-2.0）、以及离线插件层的完整许可清单与义务，见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。
- 本仓库本身不分发 `offline/` 与 `Pi_DSH_support/` 内容，克隆本仓库不会触发第三方 copyleft 义务；但**由本仓库脚本生成的运行时包与安装器属于聚合分发物**，其中出厂集含 AGPL-3.0（`dsh-lark-bot`）、GPL-2.0（`dsh-pocket`）与一个未声明许可的插件，再分发前必须先按 `THIRD-PARTY-NOTICES.md` §7.1 / §8 处置。
