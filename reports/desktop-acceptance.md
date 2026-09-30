# U14 桌面安装器验收（015 §10 + §12 U14）— R6 重做（2026-09-29 晚）

> **2026-09-30 R7 更新（取代本文的桌面形态结论）**：已新增并实装 Tauri 2 原生壳，桌面快捷方式直接指向 `UniversalWorkbench.exe`；本文以下关于 Edge `--app` 的形态描述仅保留为 R6 历史证据。R7 验收见 `reports/r7-native-delivery-acceptance.md`。

> 本轮把"桌面版"从**开发机手工 link 的形态**做成**装出来的产品**：双击安装 → 双击桌面图标 → 桌面窗口进工作台。
> 所有条目都有实测证据；未测到的部分在 §6 逐条如实登记（不虚报）。

## 1. 形态裁定（不变，重申）

- **D2 内嵌壳**：本项目未走 standalone dsh-web 壳路线（016 §1 锁定插件化交付）；工作台以 **client-ui 插件**进入 dsh 官方 web 壳。
- **D1 保底**：Windows 安装包 + launcher。**桌面窗口 = Edge/Chrome 的 `--app=` 模式窗口**（无地址栏/无标签页/独立任务栏项 + 独立数据目录）。
  **这不是原生二进制**，依赖系统自带 Edge（Windows 10/11 默认存在）；要原生壳需构建 dsh-web dist 或套 Electron/Tauri，均不在现包内。
- macOS 侧 build_dmg.sh 未实跑（本机无 macOS）——环境限制，如实登记。

## 2. 安装包实构建

| 项 | 值 |
|---|---|
| 产物 | `installer-output/UniversalWorkbench-Setup.exe` |
| 大小 | 336,101,645 bytes（≈320 MB） |
| **SHA256** | `cc6248240b33dad6c0abb662566d2d3c3a95112a755f9eb682cd079d0330bcdb` |
| 脚本 | `scripts/installer/win/setup.iss`（正式）+ `setup-x.iss`（X: 盘变体，本轮已同步为等价内容） |
| 构建 | ISCC 6，14.8s（Compression=zip / no-solid） |
| 前一版（已废弃） | 321,802,298 bytes / `eb49b1d5…` —— 旧启动器 + 缺应用 + 缺插件，**已重建覆盖** |

**安装模型改为每用户安装**：`PrivilegesRequired=lowest` → `{autopf}` 自动落到 `%LOCALAPPDATA%\Programs\UniversalWorkbench`。
理由：运行期写入全部发生在安装目录内（插件写 `{app}\templates\workspace\{audit,deliverables,system\preset-state}` 与 `{app}\reports\.tmp`；
launch.ps1 把 `DSH_HOME` 指向 `{app}\.dsh-home`）。装在 Program Files + 默认 admin 模式下，**普通用户双击后每次写入都是 EPERM/EACCES**（HTTP 500）。
契约 §10.1 骨架里的 `DefaultDirName={autopf}\UniversalWorkbench` 一字未改。多用户本就是 PRD §4 的非目标。
快捷方式改用 `{autodesktop}`/`{autoprograms}`（随权限模式自动映射）。

## 3. 本轮修掉的四条"装出来不能用"的断点（每条都有实测）

| # | 缺陷 | 证据（修前 → 修后） |
|---|---|---|
| D1 | 安装包不含 app.html / workbench-ui-plugin / src（旧 exe 早于 [Files] 修改）| `[Files]` 实构建日志出现三项；装出目录含 `app.html` + `workbench-ui-plugin/lib/{index,client}.js` + `src/` |
| D2 | postinstall 从不把工作台插件装进 profile → 产品没有 ⟡ 工作台 面板、`/app-page` 404 | 修前：profile 无该包；修后：`install-log.csv` 出现 `@workbench/client-ui,link,dsh-plugin-add-web,0`，且断言 `node_modules/@workbench/client-ui/package.json` 存在 + 已登记 `dsh.profile.bundles` |
| D3 | 离线包不含 pnpm（只有 corepack shims，离线不可用）→ 干净机 `dsh plugin add` 全部 exit 127 | 修后：`offline/npm/pnpm-10.32.1.tgz`（4,534,444 B，SHA256 `9b943b94…`，与 registry integrity 逐字核验）；在"PATH 无 pnpm"条件下实测自举成功（`pnpm --version` → 10.32.1） |
| D4 | 装到 Program Files 且无权限设置 → 非提权运行写入失败 | 见 §5 写入实测；本次安装与启动**全程非提权**（`isElevated=False`） |

### 3.1 打包过程中另抓到的两个"静默致命"（探针/实装各抓到一次）

- **`Excludes: "node_modules"` 会把 npm 本体一起排掉**。探针（`.work/iss-exclude-test/`）实测：Tree B 只剩 `node.exe`+`npm.cmd` → 干净机 postinstall 无法安装任何东西。
- **`Excludes: "node_modules\@*"` 会匹配任意层级**，把 npm 自己的 `@npmcli/@isaacs/@sigstore/@gar/@tufjs` 内部依赖一并排掉
  （实装后 npm 内部依赖 113 项 vs 开发机 118 项）→ postinstall 首步 `node:internal/modules/cjs/loader` 报错退出。
- 最终改为**显式列举** `node.exe` + `npm*`/`npx*`/`corepack*`/`pnpm*` + `node_modules/{npm,corepack,pnpm}`；实装后 **npm 1926 文件 / 118 内部依赖，与开发机逐字一致**，且**不携带**开发机装的 502MB `@deepseek-ai` 等全局包。

### 3.2 install 分支的三处脚本级修复（都在实装路径上暴露）

1. `$ErrorActionPreference='Stop'` + `2>&1` → **Windows PowerShell 5.1 把 native 的 stderr（npm 的 deprecation warn）升级为终止性 NativeCommandError**，脚本在第一步就死。改为 install/repair/verify/package 分支内 `Continue`（与本文件顶部硬规则"native 成败只认 $LASTEXITCODE"一致），关键结果另有显式断言。
2. **装出的产品没有 `reports/`**（不入安装包），而 install/verify 要往里写 csv/md → 缺目录直接抛错。已补 `New-Item -Force`。
3. 脚本**自带 `Set-Location $Root`**：Inno `[Run]` 的 cwd 不保证是 `{app}`，而 `reports/ offline/ manifests/` 都是相对路径。
   另：[Run] 补 `WorkingDir: "{app}"`；`git tag` 前先探测 git 是否存在（避免安装日志刷 CommandNotFound）。

## 4. 安装与首启（实测，全程非提权）

```
双击安装器（/VERYSILENT 等价路径实测）  → exit 0，装入 %LOCALAPPDATA%\Programs\UniversalWorkbench
桌面快捷方式 Universal Workbench.lnk + 开始菜单项  → 已创建
postinstall  workbench.ps1 -Cmd install → INSTALL_DONE
   install-log.csv（25 数据行，全 exit 0）：引擎 @deepseek-ai/dsh(npm-i-g-offline-tgz) + 23 个 P0/P1(dsh-plugin-add-web) + @workbench/client-ui(link)
   幂等复跑一次：仍 25/25 exit 0，无冲突
   profile 断言：node_modules/@workbench/client-ui/package.json 存在；package.json 内 dependencies + dsh.profile.bundles 双登记
workbench.ps1 -Cmd verify → reports/ten-elements-matrix.md + runner-profile.json(runner=dsh, network=yes)
```

**卸载/升级**：`unins000.exe /VERYSILENT` → 程序文件清除、桌面快捷方式移除；**运行期数据保留**（`{app}\.dsh-home` profile、`{app}\reports\*` 均存续），
与 `[UninstallRun]` 注记"仅移除程序文件，不删用户工作区数据"一致；随后重装覆盖成功、profile 与 reports 未被破坏。

## 5. 桌面窗口与"各组件顺畅运行"实测

**入口（字面双击等价）**：ShellExecute `C:\Users\Kinman\Desktop\Universal Workbench.lnk`
→ 19:48:34 起，19:48:46 出现**新建**的 Edge app 窗口（PID 27140）；期间 `127.0.0.1:3080` 由**产品自带** runtime 监听：

```
进程：{app}\offline\node\node-v24.21.0-win-x64\node.exe  .../@deepseek-ai/dsh/lib/bin.js --profile web --no-open --port 3080
窗口：msedge.exe --app=http://127.0.0.1:3080/workbench/api/app-page --user-data-dir=%LOCALAPPDATA%\UniversalWorkbench\app-profile
路由：GET /workbench/api/app-page → 200, 398,440 bytes
```

（前置条件：先把 3080 与旧 Edge 窗口全部清空 → 确认无监听/无窗口 → 再走快捷方式，避免"复用旧实例"的假通过。）

**非提权写入（D4 的证伪点）**——桌面实例上直接打工作台插件路由：

| 动作 | 结果 |
|---|---|
| `POST /submit {fin, r6-acceptance}` | `templates/workspace/deliverables/fin/r6-acceptance-2026-09-29T11-39-44.json` 落盘 |
| `POST /save` | `system/preset-state/saved-admin.procurement@1.0.0-*.json` 落盘 + 审计 `preset.save` |
| `POST /apply {admin.procurement@1.0.0}` | `runtime-context-admin.procurement@1.0.0.json` + `current-preset.json` 更新 + 审计 `preset.apply` |
| 审计文件 | `templates/workspace/audit/audit-2026-09-29.jsonl` 330 → 332 行 |

**组件健康（产品实例，带日志跑 3840 取证）**：`loaded 13 / pending 0 / failed-to-import 0 / crash 0 / EADDRINUSE 0`，
且**无** `dsh-task-board session/list` 报错循环（该循环是 dev profile 的 catalog 包问题，见 `reports/r6-profile-attachment-fix.md`）。

**自检套件**：`node scripts/verify-app.mjs --base http://127.0.0.1:3080` → **APP_VERIFY 41/41 PASS**（产品内 `reports/app-verification-installed.json`）。
含 13 域数据、buttons=12、GT lint 0 违例、workflows=78、数据字典 46 表 0 问题、交付物↔审计 128/23、引擎调用可追溯 136/119。

**app.html 一致性**：产品内 `app.html` 与仓库内 SHA256 完全相同（`a94f8f3b1dc13422c876d71dbeffbe3d9993eb32421596889b740e34c261e946`）→
P4 的 551/551 生成式冒烟结论原样成立（**本轮未重跑**，不作新证据）。

**壳内面板（U15 证据面在"产品"里复现）**：产品实例里 `⟡ 工作台` 面板渲染正常（13 域卡 + preset 六操作 + 审计计数实时）——
截图 `reports/ui-walkthrough/r6-installed-plugin-panel.png`。

**截图（本轮新增，reports/ui-walkthrough/）**：
`r6-installed-desktop-app-cockpit.png`（产品 app 驾驶舱）、`r6-installed-fin-domain.png`、`r6-installed-fin-expenses-table.png`（PII 已脱敏 29 行）、
`r6-installed-plugin-panel.png`（产品壳内面板）、`r6-installed-shell-overlay.png`（首启内测声明弹窗）、`r6-dev-shell-panel-after-override.png`（dev 壳回归）。

## 6. 未达标 / 未验证项（如实登记）

1. **"无网可完成"未验证**：引擎 tgz 声明 **81 个 registry 依赖且无 bundledDependencies**，`offline/npm/` 只有 26 个 tarball →
   postinstall 的传递依赖来自 registry（或本机热缓存）。本轮实测在**有网**环境完成；冷缓存 + 断网未测 → 015 §10.1 ④ 的"无网可完成"**尚未成立**。
2. **第二台干净机未做**（同前：无第二机）。本机以"全新 DSH_HOME + 最小 PATH（剔掉全局 npm/pnpm）+ 真装真删"逼近，但不能替代第二机。
3. **macOS 侧未构建**（无环境）。
4. **形态非原生**（Edge/Chrome app 窗口，见 §1）。
5. **`file://` 双击 app.html 仍未被真实验证**（Playwright MCP 屏蔽 file 协议）。桌面入口打通后优先级下降，但 D2 的这条仍挂着。
6. **首启弹窗**：壳首次打开会有"内测声明"模态，需点一次"继续"（见 `r6-installed-shell-overlay.png`）——非阻断，但属于首启体验项。
7. **产品自带开发期运行数据**：`templates/workspace/{audit,deliverables,system/preset-state}` 随 `templates/*` 打进安装包，
   装出的产品审计从 330 行"历史"起步。功能无碍（可当演示数据），但**不是冷启动语义**，建议后续把运行期数据从 seed 里剥离。
8. `runner-profile.json` 在最小 PATH 下报 `hash_tool:"none"`（探针环境探测项；`workbench.ps1 fetch` 用的是 PowerShell `Get-FileHash`，不受影响）。
9. 应用数据在 **localStorage**（按浏览器 profile 隔离）：桌面窗口 `app-profile` 与"浏览器打开同一 URL"互不相通——**固定走桌面图标入口**。

## 7. 结论

- **U14 = PARTIAL（证据面显著扩大）**：Windows 安装包实构建 + 真装真删 + 快捷方式字面启动 + 桌面窗口 + 非提权写入 + 41/41 自检全部实测通过；
  差第二机全旅程、macOS 侧、以及 §6.1 的严格离线。
- 无一票否决项；U19 阻断口径不变（U3/U16/U17 未 PASS），本轮只出阶段报告，**不宣告交付**。
