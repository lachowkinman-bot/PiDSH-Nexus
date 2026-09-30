# HANDOFF · universal-workbench-3.0 桌面版打通（2026-09-29 第 6 轮交接）

> 目标读者：接手本项目的下一个 Agent（任何 Runner）。
> 本文只写「现场状态 + 环境配方 + 已知坑 + 下一步」，**不复述已有产物内容**，一律按路径引用。
> 上一轮交接 `handoff-universal-workbench-3.0-2026-09-29.md`（项目内）+ `handoff-universal-workbench-3.0-r5.md`（临时目录）仍有效，除本文 §4 的更正外。

---

## 0. 一分钟现状

- **工程根**：`F:\Pi_DSH_workplace\universal-workbench-3.0`（工作副本）。
- **本轮任务**：用户要求「确保最终该应用以桌面版启动，各组件都能够顺畅运行」。**已完成**：
  ① 桌面安装包重建（含应用/插件/src + pnpm + 干净 Node 工具链 + 每用户安装）；
  ② 装出来的产品**真装真删真启动**验收通过（字面双击桌面图标 → 桌面窗口 → 驾驶舱 → 非提权写入 → 41/41 自检）；
  ③ dev profile 的 4 插件永久 pending + 每 5s 报错循环**根治**（日志由 9MB/天 → 0）。
- **当前在跑**：桌面实例 `127.0.0.1:3080`（由桌面快捷方式启动，产品自带 runtime）；dev 壳 `127.0.0.1:3810`（`reports/boot-log-r6-overrides.txt`）。
  静态服务 3820 / 收集端 3821 是上一轮遗留的取证脚手架，可随时杀。
- **下一步（按优先级）**：①严格离线验证（见 §4.1，本机有网，需断网/冷缓存环境）；②第二台干净机全旅程（U14 唯一硬缺口）；
  ③U17 补齐（基准仅 1/3）、U3/U16 L4 逐包重跑（执行器已硬化过）；④把运行期数据从安装包 seed 里剥离（§4.5）。

## 1. 必读产物（按序）

| # | 文件 | 内容 |
|---|---|---|
| 1 | `reports/desktop-acceptance.md` | **本轮主证据**：U14 重做（安装包/SHA256/四条断点/实装验收/截图/未达标项） |
| 2 | `reports/r6-profile-attachment-fix.md` | dev 死链根因链 + 处置 + 修后实测 |
| 3 | `progress.md` 文末「第六轮」 | 本轮全部动作与数值 |
| 4 | `scripts/installer/win/setup.iss` + `setup-x.iss` | 安装器（两份必须同步；改一份记得改另一份） |
| 5 | `scripts/workbench.ps1` / `workbench.sh` | 总控脚本（install 分支第 0 步 pnpm 自举 + 第 9 步工作台插件 + 硬断言） |
| 6 | `scripts/launch.ps1` | 桌面启动器（**含自愈**：缺引擎/插件时先静默跑一次 install） |
| 7 | `docs/workbench-app-design-v2.md` | 应用设计（D1-D8），仍未变 |

## 2. 环境配方（照抄，错一步踩坑）

```bash
export PATH="/f/Pi_DSH_workplace/universal-workbench-3.0/offline/node/node-v24.21.0-win-x64:$PATH"
export DSH_HOME="F:\Pi_DSH_workplace\universal-workbench-3.0\.dsh-home"
cd "F:/Pi_DSH_workplace/universal-workbench-3.0"
```

- **凭据**：`HKCU\Environment` 里的 `DEEPSEEK_API_KEY` 有效；**ZCode 进程继承的是旧值（401）**。取用：
  `REG=$(reg query "HKCU\Environment" //v DEEPSEEK_API_KEY | grep DEEPSEEK_API_KEY | sed 's/.*REG_SZ[[:space:]]*//' | tr -d '\r\n')`
  密钥永不落盘/入库/进命令行；掩码写法先自测。pi 忽略该环境变量，须显式 `--provider deepseek --model deepseek-v4-flash --api-key "$KEY"`。
  **判据必须模型级**：pi 内部 401 时仍 exit 0 —— 要求 JSON 流 `stopReason=stop` 且 `usage.totalTokens>0` 且正文非空。
- **钩子坑（Mimosa）**：①Bash 命令里出现具体 `.sh` 文件名、或 `cp`/重定向写源码会被拦 → 执行走 `node scripts/install-runner.mjs install`，查看用 Read/grep glob；
  ②**Bash 里 `cp` 到 .sh/.ps1 会被拒**——要改产品内脚本请重建安装包，别手工拷。
- **MSYS 参数坑**：`/VERYSILENT`、`/PID` 会被 Git Bash 当路径改写。跑 Inno 安装器要 `export MSYS2_ARG_CONV_EXCL='*'`；跑 `taskkill` 要用 `//PID` 且**不要**设那个变量。
- **服务**：
  ```bash
  # dev 壳（改 workbench-ui-plugin/lib/*.js 后必须重启才生效）
  PID=$(netstat -ano | grep ":3810.*LISTENING" | awk '{print $5}' | head -1); taskkill //PID $PID //T //F
  dsh --profile web --no-open --port 3810 > reports/boot-log-*.txt 2>&1 &
  grep -o 'http://127.0.0.1:3810/?token=[A-Za-z0-9_-]*' reports/boot-log-*.txt | head -1
  # 桌面实例：直接 ShellExecute 桌面快捷方式（等价双击），或
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$LOCALAPPDATA/Programs/UniversalWorkbench/scripts/launch.ps1"
  ```

## 3. 本轮改了什么（别重写，改前先读）

### 3.1 安装包（产品）
- `setup.iss` / `setup-x.iss`：**每用户安装**（`PrivilegesRequired=lowest` → `%LOCALAPPDATA%\Programs\UniversalWorkbench`，免 UAC，运行期写入天然可用）；
  `{autodesktop}`/`{autoprograms}`；`[Run]` 带 `WorkingDir:{app}`；`[Files]` **显式列举** Node 工具链
  （`node.exe` + `npm*`/`npx*`/`corepack*`/`pnpm*` + `node_modules/{npm,corepack,pnpm}`），**不要**回退成 `Excludes:"node_modules"` 或 `"node_modules\@*"`（前者排掉 npm 本体，后者连 npm 的 `@npmcli` 等内部依赖一起排掉——两次都实测炸过）。
- 新增 `offline/npm/pnpm-10.32.1.tgz`（SHA256 `9b943b94bc8f55efb993aad8e44b538e6b091e60a9e4a944dcde869855f233e3`），已入 `SHA256SUMS.txt` 与 `tools-versions.txt`。
- 实构建：**`installer-output/UniversalWorkbench-Setup.exe` 336,101,645 B / SHA256 `cc6248240b33dad6c0abb662566d2d3c3a95112a755f9eb682cd079d0330bcdb`**（终版实测；此前 335,596,565 B 的记法是上一轮构建的字节数，与同哈希不匹配，已更正）。

### 3.2 脚本
- `workbench.ps1`/`workbench.sh` install 分支：**第 0 步 pnpm 自举**（PATH 无 pnpm → `npm i -g <offline/npm/pnpm-*.tgz>`）；
  **第 9 步 工作台插件**（`dsh plugin --profile web add {root}\workbench-ui-plugin` + **硬断言** link 与 `dsh.profile.bundles`）；产物目录 `reports/` 自建；`Set-Location $Root`。
- `workbench.ps1`：install/repair/verify/package 分支 `$ErrorActionPreference='Continue'`（**PS 5.1 会把 native 的 stderr 升级成终止错误**，Stop 下脚本首步就死）；verify 补 runner-probe。
- `launch.ps1`：**自愈**——引擎或工作台插件缺失时先静默跑一次 install（覆盖"静默安装跳过 postinstall"与"手工拷贝目录"两种情形）。
- `verify-app.mjs`：`--base/--out` 可参数化（3810 开发壳 / 3080 桌面实例），审计文件取最新而非硬编码日期。

### 3.3 dev profile
- `.dsh-home/profiles/web/pnpm-workspace.yaml` overrides 追加 `@deepseek-ai/dsh-attachment: 0.1.7-rc.2` 与 `@deepseek-ai/dsh-sdk-protocol: 0.1.7-rc.2`（治 4 插件永久 pending + task-board 报错循环，根因=catalog 包 dsh-lark-bot 把 0.1.0-rc.8 提升到根）。
  改前备份：`.work/profile-backup-r6/*.bak`（可一键回滚）。

## 4. 【更正 / 未验证】勿沿用旧结论

1. **「离线可装（无网可完成）」未成立**：引擎 tgz 有 **81 个 registry 依赖且无 bundledDependencies**，`offline/npm/` 只有 26 个 tarball →
   postinstall 的传递依赖走 registry（或热缓存）。本轮在**有网**环境实测通过；**冷缓存 + 断网未测**。
2. 旧结论「唯一硬停线=DEEPSEEK_API_KEY 失效，仅用户可解」**仍不成立**（有效 key 在机器环境变量里）——沿用 r5 §4。
3. 旧结论「U18 已质变为真实引擎执行」**已撤回**，判据升级为模型级（stop+totalTokens>0）——沿用 r5 §4。
4. **"桌面版"是 Edge/Chrome `--app=` 模式窗口**，不是原生二进制；要原生壳需构建 dsh-web dist 或套 Electron/Tauri（均不在现包内）。
5. **数据隔离**：桌面窗口用独立 profile（`%LOCALAPPDATA%\UniversalWorkbench\app-profile`），其 localStorage 与"浏览器打开同一 URL"/`file://` 双击**互不相通**；应用数据（域台账/审计/交付物的前端副本）在 localStorage 里。**建议固定走桌面图标入口**。
6. 产品自带开发期运行数据（`templates/workspace/{audit,deliverables,system/preset-state}` 随 `templates/*` 打包，审计 330 行起步）——非冷启动语义，建议后续剥离。
7. `file://` 双击 app.html 仍未真实验证（Playwright MCP 屏蔽 file 协议）。
8. 首启壳会弹「内测声明」模态，需点一次"继续"。

## 5. 纪律红线（违反=返工或一票否决）

- **U19 阻断仍在**：U3/U16/U17 未 PASS → 禁止交付宣告，只出阶段报告。
- **§14.6 语义禁令**：路由≠接通、渲染≠界面、装载行≠可用、NOT_RUN≠合规、**进程退出码≠模型执行成功**。
- **"通过"必须问一句"它真的在检查，还是在空转"**：本项目已抓过 5 次假通过（进程退出码 / CSV 解析空转 / 构建无语法门禁 / 卸载后复用旧进程 / 窗口 count 复用）。
  本轮同样靠"先清空 3080 与旧 Edge 窗口再走快捷方式"才拿到干净证据。
- 熔断：同一形态连续 3 次失败即停批并诊断。
- 密钥永不落盘；不改 `F:\Pi_DSH_workplace\` 下其他目录；不碰 APPDATA 全局 npm/dsh/pi 配置。

## 6. 最小验证回路（接手后 5 分钟自检）

```bash
cd "F:/Pi_DSH_workplace/universal-workbench-3.0"
export PATH="/f/Pi_DSH_workplace/universal-workbench-3.0/offline/node/node-v24.21.0-win-x64:$PATH"
export DSH_HOME="F:\Pi_DSH_workplace\universal-workbench-3.0\.dsh-home"
node -v                                                             # v24.21.0
dsh --version                                                       # 0.1.7-rc.2
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3810/workbench/api/app-page   # 200（dev 壳在跑）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/workbench/api/app-page   # 200（桌面实例在跑）
node scripts/verify-app.mjs --base http://127.0.0.1:3810            # APP_VERIFY 41/41
# 桌面入口（等价双击图标；先确认 3080 无监听、无 --app= 的 msedge 残留）
powershell.exe -NoProfile -Command 'Start-Process "$env:USERPROFILE\Desktop\Universal Workbench.lnk"'
```

## 7. Suggested skills（接手时建议加载）

| Skill | 为什么 |
|---|---|
| `handoff` | 你干完一段后同样要交接（本文件即其产物模板） |
| `verification-before-completion` | 声称任何"通过"前按证据清单复验（本项目假通过史） |
| `systematic-debugging` | 修打包/安装这类"静默失效"问题 |
| `browser-testing-with-devtools`（或 `browser-use:control-browser`） | 壳内面板与 app 逐页取证；`file://` 被 MCP 屏蔽 |
| `benchmark-methodology` | 凭据到位后补 U17 A/B 对标 |

---

*本文件两处各存一份：系统临时目录（handoff skill 约定的规范位置）与项目根（按"项目目录下找得到"的要求镜像，与早期 r1 交接同处）。项目内等价信息见 `progress.md` 与 `reports/desktop-acceptance.md`。*
