# HANDOFF — PiDSH Nexus（universal-workbench-3.0）R8 收尾 → 下一轮

> 生成时间：2026-09-30 10:35（Asia/Shanghai）　生成者：Codex（R8 轮）
> 仓库：`F:\Pi_DSH_workplace\universal-workbench-3.0`（本轮已 `git init`，见 §2 提交）
> 下一轮重点：**安装级复验 + 体积裁剪**（详见 §4）

## 1. 当前目标（用户三项要求）

1. 制定「上下文接近 90% 用 `handoff` 技能产交接文档」规则 —— **已完成**（`AGENTS.md`）。
2. 逐一检查仓库功能/组件是否顺畅运行，并择优选用 `Pi_DSH_support` 的包/插件提升 Windows 单机交付质量 —— **部分完成**（体检 687 包 + 短名单；未放行新依赖，理由见 `reports/support-adoption-3.0.md`）。
3. 重设计桌面 logo（Pi+DSH+全能工作台）并把主壳左上角 `DeepSeek Harness` 换成新品牌 —— **代码/产物已完成，UI 实机截图未取证**。

追加要求（本轮中途）：**通过验收即 git 提交**（已写入 `AGENTS.md`「验收即归档」）。

## 2. 已完成并已提交（Git）

- `bba7cb2` 基线：`.gitignore`（排除 7.1 GB `Pi_DSH_support/`、5.6 GB `.dsh-home/`、5.6 GB `.work/`、2.8 GB `offline/`、1.2 GB `src-tauri/target/` 等）+ `AGENTS.md` 两条规则 + 品牌/导航改动。
- `7f3007b` 品牌与可达性 + 安装包重建 + Pi_DSH_support 体检（972+ 文件；`reports/` 证据在库）。

## 3. 本轮取证结论（可直接引用）

| 项 | 证据 |
|---|---|
| 品牌落点 | `assets/brand/pids-nexus.svg`；`src-tauri/icons/*`；`tauri.conf.json productName=PiDSH Nexus`；窗口标题 `PiDSH Nexus · 全能工作台`；`workbench-ui-plugin/lib/client.js` 注入 `sidebar.brand.mark/name` |
| 主驾驶舱"消失"根因与修复 | 根因：`scripts/launch.ps1` 用 `--app=<…>/workbench/api/app-page` 打开的是 **13 域驾驶舱**（主壳首页才是会话/插件/技能所在）。已改为主壳 `/`；13 域页顶栏加「⟵ 主壳」回程；壳内按钮改名「打开 13 域驾驶舱」 |
| exe 图标 | `reports/exe-icon-check.png`（从 exe 抽图标 = π+波形新 logo） |
| 安装包 | `installer-output/UniversalWorkbench-Setup.exe` 473,824,650 B / SHA256 `BF44A28085DEE3786DFB6C21C2DCA2B98001375490F64BC57DCFB99D00EF5444`；图标同源 `reports/setup-icon-check.png`；ISCC 20.2 s |
| runtime 包 | `offline-3.0/runtime-web.zip` 427,014,795 B / SHA256 `80F02622557E52D7CCFC07DDEC4CDD040BDDF31363084A3F4A0A9C46278D003D`；build-id `6f8cf6b4…85c7`；解压 46,284 文件一致 |
| 隔离冷启动 | `.work/verify-support-home`（由 runtime zip 解压）`--port 3096`：`/workbench/api/workflows` 200、`/workbench/api/app-page` 200、无 crash / 无 failed-to-import |
| Pi_DSH_support 体检 | `reports/support-catalog-scan.{md,csv,json}`：687 包；READY_DIST 93 + READY_SOURCE 33 = 126 可离线装载；许可缺失 25 |

## 4. 未完成（下一轮按序做）

1. **安装级复验（最高优先）**：安装包静默装到隔离目录 → 启动 → `node scripts/verify-app.mjs --base <port>` 应回到 45/45 → `verify-delivery-matrix.mjs` 117/117 → `verify-delivery-ui.mjs` 23/23。本轮只做到产物同源核对。
2. **runtime 体积裁剪**：473.8 MB 安装包中 runtime 占 427 MB（`onnxruntime-node` 208 MB、`@deepseek-ai` 238 MB、`react-icons` 84 MB、`mermaid` 80 MB、`@huggingface` 66 MB），目标 ≤260 MB 且不丢已验证能力。
3. `dsh-context-doctor@0.7.2` / `dsh-secure-audit@0.2.10` 的功能级验证（工具实调 + 面板截图）后才可入 runtime；须联网 `npm install` 重打 runtime。
4. UI 旅程截图（Playwright 进壳）验证主壳 sidebar 品牌与新 logo，并把 13 域驾驶舱/主壳双向跳转点一遍。

## 5. 风险与坑（本轮实测）

- **离线环境 `dsh plugin add` 不可用**：pnpm 需 registry 元数据（`ERR_PNPM_NO_OFFLINE_META`），且会先把既有包移到 `node_modules/.ignored` → 只可构建期打包。
- **DSH 壳有请求护栏**：脚本批量 `fetch` 会被掐断（表现为 `http=0`），`verify-app` 因此出现假失败——需对"有浏览器会话的实例"或降速取证。
- **`Pi_DSH_support/` 不入库但 runtime 构建依赖它**（4 个 `file:` 依赖）：从 Git 恢复后须先恢复该目录才能重打 runtime。
- **沙箱限制**：管道式子进程（`execFileSync` 带 pipes）会 EPERM；`subst`、GUI 启动、静默安装需提权执行。
- ⚠️ 本轮事故（无损失）：误用保留变量 `$home` 对 `C:\Users\Kinman` 触发递归删除，沙箱逐条拒绝、抽查 6 路径完好；纪律补丁见 `progress.md` §八 F。

## 6. 运行中的服务/进程（下一轮可先清理）

- 隔离壳：`.work/verify-support-home` 上 `dsh --profile web --no-open --port 3096`（本轮结束时应关闭）。
- 另有 9/30 09:58、10:04 启动的两个 node 进程（前序轮遗留，未监听 3080-3090）。
- 端口：3080-3090 空闲；3096 被隔离壳占用。

## 7. 建议加载的 skills

- `handoff`（每轮收尾强制）、`verification-before-completion`（安装级复验取证）
- `windows-desktop-e2e`（原生窗口 + 单实例 + 快捷方式验证）
- `systematic-debugging`（若 45/45 复验仍失败）
- `code-review-and-quality`（体积裁剪后回归审查）

## 8. 关键文件索引（勿重复阅读）

- 规则：`AGENTS.md`；进度与事故：`progress.md` §八
- 支持包选型：`reports/support-adoption-3.0.md` + `reports/support-catalog-scan.md`
- 交付服务：`workbench-ui-plugin/src/delivery-service.mjs`（构建产物 `lib/delivery-service.cjs`）
- 壳内 UI/品牌：`workbench-ui-plugin/lib/client.js`；13 域应用：`src/app.js` → `app.html`（`scripts/build-app.mjs`）
- 原生壳：`src-tauri/src/main.rs`；安装器：`scripts/installer/win/setup-x.iss`（`subst X:` 构建）
