# HANDOFF · PiDSH Nexus（universal-workbench-3.0）· R9 → 下一个 session

生成时间：2026-09-30 12:05（Asia/Shanghai，China Standard Time）
仓库：`F:\Pi_DSH_workplace\universal-workbench-3.0`（已 git init；当前 HEAD `10059d9`，R9 验收提交为 `50f61b6`，工作树干净）
本文件是**唯一权威交接入口**：新 session 先读本文件 → 再按"关键文件索引"按需读仓库内报告，不要重读历史全量对话。

---

## 0. 30 秒定位

- **项目性质**：Windows 单机交付型桌面应用/集成仓库（非公共库）。产品名 **PiDSH Nexus**，形态 = Tauri 2 原生窗口 + 系统 WebView2 + 本机 DSH 引擎（`@deepseek-ai/dsh@0.1.7-rc.2`）+ 工作台插件（13 域驾驶舱、全格式交付、78 条工作流）。
- **产品入口**：桌面快捷方式 `PiDSH Nexus` → `%LOCALAPPDATA%\Programs\UniversalWorkbench\UniversalWorkbench.exe`；启动器会自检并（必要时）从随包 runtime 刷新 profile，然后打开 `http://127.0.0.1:3080-3090/`。
- **当前交付物**：`installer-output/UniversalWorkbench-Setup.exe` = 589,253,195 B / SHA256 `1B20800997CE0D9593C906B136C30B937A11979E553FC6BC27F0ECF68B414F26`；随包 runtime `offline-3.0/runtime-web.zip` = 546,149,331 B / build-id `db5eb8a081e65a9b62d3855078f0f7d34e51893f00f54e78eaeab0780c782d97`。
- **上一版（回滚用）**：`installer-output/UniversalWorkbench-Setup-r8-prev.exe`（473,824,650 B）。

## 1. 当前状态（均已实测，不是"应该"）

| 维度 | 事实 | 证据位置 |
|---|---|---|
| 安装态 profile | **59 bundle** 加载（+5 随包不加载），marker == 安装包 build-id | `%LOCALAPPDATA%\Programs\UniversalWorkbench\.dsh-home\profiles\web\{package.json,runtime-build.json}` |
| 用户数据 | sessions / `.credentials.yaml` / storages / templates 全部保留 | `reports/r9-install-before.json` 对照 |
| 自动备份 | `.dsh-home.pre-r9-20260930-032659`（原始 3-bundle）、`.dsh-home.pre-r9-20260930-035019`（60-bundle 中间态） | 安装目录 |
| 模块 | 插件 / 通知与控制 / 任务看板 / 技能中心 / 记忆系统 / 工作台 / PR Board / 用量÷余额 全部可见 | `reports/r9-ui-verify-installed.json`、`reports/ui-walkthrough/r9-01-shell-home.png` |
| 内测声明 | **不再出现**（出厂预置 `welcomeNoticeVersion`） | 同上（`modal=false`） |
| 工作台 | 壳内 `⟡ 工作台` 面板可开，标题 `⟡ PiDSH Nexus · 全能工作台`；API `workflows/app-page/artifacts` 均 200 | `r9-02-workbench-panel.png` |
| 快捷方式 | 桌面 + 开始菜单各只剩 `PiDSH Nexus`（旧 `Universal Workbench.lnk` 已由 `[InstallDelete]` 清理） | 实测解析 lnk |
| 综合报告 | R9 全量验收记录 | `reports/r9-desktop-refresh.md`、`progress.md` §九 |

## 2. 下一 session 的任务队列（按优先级，含判据）

### T1（最高优先）主壳左上角字标：`deepseek HARNESS` → `PiDSH Nexus`
- **现象**：安装态主壳侧栏左上角仍显示官方 `deepseek HARNESS` 字标；用户明确要求替换。
- **已知事实**：该字标由 `@deepseek-ai/dsh-client-ui-brand-official` 渲染；`sidebar.brand.*` 槽位语义是"声明即独占"（官方先声明，外部插件抢不到）；页面 `innerText` 里**看不到**该字标（它是 SVG wordmark），只能靠截图/区域探针判断。
- **已试且无效（勿重复）**：
  1. `profiles/web/cordis.patch.yml` 加 `- id: "@deepseek-ai/dsh-client-ui-brand-official"` + `disabled: true`；
  2. 把 `@workbench/client-ui` 挪到 `dsh.profile.bundles` 末尾抢注册顺序；
  3. 在自有客户端插件里做 DOM 幂等替换（含"只在左上角区域扫描最内层节点"版本）。
- **关键坑（务必先记住）**：主壳实际加载的是 **`…\.dsh-home\profiles\web\node_modules\@workbench\client-ui\lib\client.js`**，不是安装根目录的 `workbench-ui-plugin\lib\client.js`；改错位置不会生效。
- **下一步（按序尝试，每步都要截图/区域探针取证）**：
  a. 找 **客户端插件构建/缓存产物**：主壳 asset 形如 `/assets/index-*.js`；确认它由哪个包生成、是否有缓存目录与缓存失效键（决定"自有客户端代码能否注入"）；
  b. 若无缓存机制 → 在 `scripts/build-runtime-bundle.ps1` 里对官方品牌**构建期产物**做替换（`OfficialBrandName` / `BrandWordmark` 调用点），并把被改文件纳入 build-id 指纹（`$buildFiles`）；
  c. 兜底：保留官方字标，仅窗口标题/任务栏/安装器用 PiDSH Nexus（用户已表达不满，非首选）。
- **验收判据**：`node scripts/probe-r9-brand.mjs <url-with-token>` 输出 `BRAND_PROBE pids=true legacy=false`，且 `reports/ui-walkthrough/r9-03-brand-region.png` 肉眼为新品牌。

### T2 runtime 体积裁剪（用户已接受当前体积，但列为优化项）
- 现状：runtime zip 546 MB / 安装包 589 MB / 装后 ~5.4 GB。大头：`onnxruntime-node` 208 MB、`@deepseek-ai` 238 MB、`react-icons` 84 MB、`mermaid` 80 MB、`@huggingface` 66 MB，另有 `sharp`/`better-sqlite3` 等本地原生件。
- 下一步：先出**依赖占用报表**（按包统计 + 是否被 59 个 bundle 真正 import），再按"未被 import 的直接剔除 / 仅平台无关目录裁剪（darwin/linux 二进制）"两类处置；**任何裁剪都要重跑 T3 门禁**。
- 判据：runtime ≤ 260 MB 且 T3 全绿。

### T3 回归门禁（每次改动后必跑）
- `node scripts/verify-app.mjs --base <port>` → 目标 **45/45**（注意：脚本批量 fetch 会被 DSH 壳护栏掐断成 `http=0`，必须对着**有浏览器会话的安装实例**或降速跑；历史证据 `reports/app-verification-installed-r7.json`）。
- `node scripts/verify-delivery-matrix.mjs` → 目标 **117/117**；`node scripts/verify-delivery-ui.mjs` → 目标 **23/23**。
- `node scripts/verify-r9-ui.mjs <url-with-token>` → 目标 `R9_UI PASS`（品牌/无内测声明/8-8 模块）。
- 证据写 `reports/`，然后**立即 commit**（见 §5 纪律）。

### T4 已知降级项（非阻塞，按需处理）
- `dsh-task-board`：`session/list` 定义被网关收回 → 名册自动发现关闭（面板可用）。
- 首启两条一次性提示：`dsh-better-sidebar`（简化侧栏建议）、`@ychris12138/dsh-usage-stats`（额度横条建议）。若要出厂静默，需分别定位其持久化键后再预置。
- `bili-native-dsh` 代理子进程启动失败 → 探测流量直连（提示非阻塞）。

### T5 历史遗留（来自更早轮次，勿当成新问题）
- U10/U17/U16-L4、L3 审批拦截与记忆跨会话召回未 PASS；`pi-redact-all` 三项检出缺陷；详见 `progress.md` 第三轮"遗留"与 `reports/u17-benchmark.md`。
- macOS/Linux 未验证；第二台干净 Windows 机未测；安装包无商业代码签名。

## 3. 已锁定的决策（不要重新讨论）

1. 品牌名 **PiDSH Nexus**；图标 = π 字形 + 数据波形 + 四色节点（源 `assets/brand/pids-nexus.svg`）。
2. 出厂模块集合 = R6 64 bundle → **去重后 59 加载 + 5 随包不加载**；去重规则："同类保留版本较新者，版本相同保留 scope 包"；被去重者仍随包，可在插件中心手动启用（`manifests/runtime-bundles.json`）。
3. `@a9i5k4/dsh-auto-memory` **默认不加载**（首启强制向导弹窗 `localStorage.dsh-auto-memory.tourDismissed` 无法随包预置 + 启动期访问 raw.githubusercontent/npm registry）；记忆系统由 `dsh-mnemon` 提供。
4. 内测声明：**出厂预置已确认**（`templates/runtime/cordis.patch.yml`）；升级时合并保留用户已有 patch 条目。
5. 升级策略：**原地升级 + 只替换 `profiles/web` + 自动备份**；sessions/storages/credentials 一律保留。
6. 快捷方式：**只留 `PiDSH Nexus`**；安装时删除旧 `Universal Workbench.lnk` 并刷图标缓存。
7. 版本豁免出厂化：`@shaoshi/dshscan@0.5.0 → 0.1.7-rc.2`（`templates/runtime/compatibility.json`）。

## 4. 硬约束与踩过的坑（每条都有事故记录）

- **沙箱**：管道式子进程（`execFileSync` 带 pipes）→ EPERM；启动 GUI/浏览器、`subst X:`、写 `%LOCALAPPDATA%` 都需 `require_escalated`。浏览器脚本用 `playwright-core` + 本机 chromium（`C:/Users/Kinman/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`）。
- **PowerShell 5.1**：`.ps1` 必须 **UTF-8 带 BOM**；无 BOM 的中文注释会被 GBK 解码吞掉换行，把下一行并进注释（曾导致 `$portable` 未赋值）。已修 `workbench.ps1` / `build-runtime-bundle.ps1`。
- **保留变量**：禁用 `$home/$profile/$env/$pshome` 之类名字当临时变量；任何 `Remove-Item -Recurse` 前先 `[IO.Path]::GetFullPath` 断言在目标目录内（历史事故：误对 `C:\Users\Kinman` 触发递归删除，沙箱逐条拒绝，未造成损失，登记在 `progress.md` §八 F）。
- **离线安装语义**：`dsh plugin add` 需要 registry（`ERR_PNPM_NO_OFFLINE_META`）且会先把既有包移进 `node_modules/.ignored` → **新插件只能构建期打包**，不能安装期加入。
- **tar 包解析**：必须"包名 **+ 精确版本**"匹配；前缀匹配曾把 `dsh-plugin` 错配成 `dsh-plugin-manager-0.1.0.tgz`，导致客户端 `dsh-plugin-manager` 激活失败、整壳白屏。
- **shell 护栏**：脚本连续 `fetch` 会被掐断（表现为 `http=0`），不是产品缺陷；单发 curl 同端点通常 200。
- **Pi_DSH_support 不入库**（7.1 GB）：从 Git 恢复后若要重打 runtime，必须先恢复该目录，因为 `manifests/runtime-web.package.json` 有 4 个 `file:` 依赖指向它。

## 5. 工作纪律（仓库 `AGENTS.md` 强制）

1. **验收即归档**：任何改动通过门禁且证据落 `reports/` 后**立即 commit**；未验证的中间态不得提交；提交信息写清"通过了哪项门禁"。
2. **单步记录**：每完成一小步写 `progress.md`（含失败与撤回的结论）。
3. **熔断**：同一问题连续 3 轮未通过即停止并回报，不宣告交付。
4. **上下文 90%**：按 `C:\Users\Kinman\.agents\skills\handoff\SKILL.md` 生成/更新本交接文档（写系统临时目录，不入库，剔除凭据）。
5. **不臆造结论**：改动前后都要有可复现命令 + 产物哈希/截图；"应该好了"不算证据。

## 6. 关键文件与命令索引

**代码 / 配置**
- 原生壳与刷新链路：`src-tauri/src/main.rs`（`ensure_runtime` / `refresh_runtime` / `merge_preset_patch` / `merge_compatibility`）
- 工作台插件：`workbench-ui-plugin/lib/{index.js,client.js,delivery-service.cjs}`（client.js 当前 sha `12F7CABC…`，与出货 runtime 一致）
- 13 域应用：`src/app.js` + `src/theme.css` → `app.html`（由 `scripts/build-app.mjs` 生成）
- 模块清单：`manifests/runtime-bundles.json`（64/59/5）、`manifests/runtime-web.package.json`（生成物，勿手改）
- 出厂预置：`templates/runtime/cordis.patch.yml`、`templates/runtime/compatibility.json`
- 安装器：`scripts/installer/win/setup-x.iss`（X: 变体，实构建用）；`setup.iss` 为等价非 X 版

**常用命令（均需在项目根执行）**
```powershell
node scripts/gen-runtime-manifest.mjs --sync-from-profile   # 维护模式：重算 64→59 清单
node scripts/gen-runtime-manifest.mjs                       # 由清单生成 package.json（缺包即失败）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-runtime-bundle.ps1   # 重打 runtime zip（需联网）
cargo build --release            # in src-tauri，出 exe（图标/标题随之更新）
# 安装包：先 subst X: <项目根>，再 ISCC X:\scripts\installer\win\setup-x.iss
# 安装：Start-Process installer-output\UniversalWorkbench-Setup.exe -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART'
node scripts/verify-r9-ui.mjs "<url-with-token>"            # 安装态 UI 取证
node scripts/probe-r9-brand.mjs "<url-with-token>"          # 左上角品牌区域探针（T1 判据）
```

**证据/报告**
- `reports/r9-desktop-refresh.md`（本轮验收全表）、`reports/r9-install-before.json`、`reports/r9-ui-verify-installed.json`、`reports/r9-brand-probe.json`
- `reports/ui-walkthrough/r9-01-shell-home.png`、`r9-02-workbench-panel.png`、`r9-03-brand-region.png`
- `reports/support-adoption-3.0.md` + `reports/support-catalog-scan.{md,csv,json}`（Pi_DSH_support 687 包体检与选型）
- `progress.md` §八（R8 事故与判据澄清）、§九（R9 全过程）

## 7. 建议加载的 skills

- `handoff`（每轮收尾、上下文 90% 强制）
- `systematic-debugging`（T1 品牌字标定位：先取证再改）
- `verification-before-completion`（T3 门禁与"不宣告未取证结论"）
- `windows-desktop-e2e`（原生窗口/单实例/快捷方式/图标缓存）
- `code-review-and-quality`（体积裁剪后的回归审查）
- `production-audit`（若要出对外交付版本）

## 8. 新 session 开场建议（复制即用）

> 读 `%TEMP%\handoff-pids-nexus-r9-2026-09-30.md`，按 §2 T1 修主壳左上角品牌字标；
> 先做取证（找客户端 bundle 构建/缓存机制），改完跑 §2 T3 门禁，证据落 `reports/`，然后 git commit。
> 不要重复 §2 已列出的无效尝试，也不要重开 §3 已锁定决策。
