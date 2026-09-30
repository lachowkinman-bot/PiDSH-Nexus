# R9 · 桌面端「换新落地」验收报告（2026-09-30）

> 用户反馈四联症状：桌面仍是旧 logo、启动卡在内测声明、左上角品牌未改、模块（插件/通知与控制/任务看板/技能中心/记忆系统/工作台/PR Board/用量余额）全缺。
> 结论：**同一根因**——桌面跑的是 09:49 旧安装版，且升级链路有缺陷导致"装了也不会换新"。本轮已修复并在本机完成安装级验收。

## 1. 根因（均已实测取证）

| # | 现象 | 根因 | 证据 |
|---|---|---|---|
| R1 | 桌面旧 logo | 安装的 exe 是 09:49 版（早于 10:01 图标重做） | `reports/r9-install-before.json`：exe 3,194,368 B / sha `564EE760…`；`reports/exe-icon-check.png` 为新 logo 对照 |
| R2 | 模块全缺 | 旧 runtime 包 `profiles/web/package.json` 只有 **3 个 bundle**（dsh-base / dsh-web-app / @workbench/client-ui） | 从旧 zip 内直读 package.json（29938 entries） |
| R3 | 重装也不换新 | `ensure_runtime` 在缺 `runtime-web.build-id` 时把"无期望值"当作已就绪直接返回；而安装器 `[Files]` **从未随包 build-id** → 旧 profile 永不刷新 | `reports/r9-install-before.json`：`build_id_file=false`；代码修复见 `src-tauri/src/main.rs` |
| R4 | 卡内测声明 | 官方 welcome notice 需把确认写进 `profiles/web/cordis.patch.yml`（`ui-settings-general.welcomeNoticeVersion`）；profile 处于半损/极简状态时写入链路不成立 | 官方 bundle `dsh-client-ui-settings-models` 源码 + 出厂预置补丁 `templates/runtime/cordis.patch.yml` |

## 2. 本轮改动

1. **出厂模块集合**：新增 `manifests/runtime-bundles.json`（R6 64 bundle 基线）与生成器 `scripts/gen-runtime-manifest.mjs`（按"包名-精确版本"解析离线 tar 包；缺包即失败）。
   - 去重 4 项（保留较新者）：`@a9i5k4/dsh-auto-memory`、`@changfenhuang/dsh-genui`、`dsh-cost-meter`、`@linxin666/dsh-client-ui-git-graph`。
   - 默认不加载但随包 5 项：4 个被去重者 + `@a9i5k4/dsh-auto-memory`（首启强制向导弹窗 `localStorage.tourDismissed` 无法随包预置，且启动期访问 raw.githubusercontent/npm registry；记忆系统由 `dsh-mnemon` 提供）。
   - **加载 bundle = 59**；运行期实测 0 skipped / 0 failed-to-import。
2. **版本豁免出厂化**：`templates/runtime/compatibility.json` 预置 `@shaoshi/dshscan@0.5.0 → 0.1.7-rc.2`（R6 实测结论），避免启动时被版本护栏跳过。
3. **升级/刷新链路**：`ensure_runtime` 改三态（无 build-id → 阻断；一致 → 跳过；缺失/不一致 → 强制刷新）；刷新流程＝备份旧 profile → 暂存解压 → 原子换入 → 合并 patch/豁免表 → 写 marker，失败自动回滚。`scripts/workbench.ps1` 同步同构实现（含工作区路径断言）。
4. **首启体验**：出厂 `cordis.patch.yml` 预置"内测声明已确认"；升级时合并保留用户已有条目。
5. **安装器/快捷方式**：`[Files]` 补 `runtime-web.build-id`；`[InstallDelete]` 清理旧 `Universal Workbench.lnk`；`[Icons]` 只建 `PiDSH Nexus`；安装收尾 `ie4uinit.exe -show` 刷图标缓存。
6. **脚本健壮性**：`build-runtime-bundle.ps1` 固定使用随包便携 Node；`workbench.ps1`/`build-runtime-bundle.ps1` 转 UTF-8 **含 BOM**（PS 5.1 曾把中文注释与下一行并成一行，导致 `$portable` 未赋值）。

## 3. 安装级验收（本机原地升级，数据保留）

| 项 | 结果 | 证据 |
|---|---|---|
| exe 同源 | ✅ 3,202,048 B，sha 与 release 构建**逐字一致** | 安装后实测 |
| runtime 落盘 | ✅ 546,149,331 B / build-id `db5eb8a0…0c78` | 安装后实测 |
| profile 刷新 | ✅ 3 → **59 bundle**；marker == build-id | `.dsh-home/profiles/web/{package.json,runtime-build.json}` |
| 自动备份 | ✅ `.dsh-home.pre-r9-20260930-032659`（原始 3-bundle）与 `…-035019`（60-bundle 中间态） | 安装目录 |
| 用户数据 | ✅ sessions / .credentials.yaml / storages 全部保留 | 安装前后快照 |
| 快捷方式 | ✅ 桌面与开始菜单**只剩** `PiDSH Nexus`，指向新 exe | 实测解析 lnk |
| 内测声明 | ✅ 不再出现 | `reports/r9-ui-verify-installed.json`、`r9-ui-verify-brandtest.json`（`modal=false`） |
| 点名的 8 个模块 | ✅ 8/8 全部在侧栏可见（用量余额实际标签为「用量/余额」+ `余额 ¥322.97`） | `reports/r9-ui-verify-installed.json`、截图 `reports/ui-walkthrough/r9-01-shell-home.png` |
| 工作台面板 | ✅ 壳内 `⟡ 工作台` 可打开，标题 `⟡ PiDSH Nexus · 全能工作台`，含 13 域/工作流(78)/交付中心 | `r9-02-workbench-panel.png` |
| 工作台 API | ✅ `/workbench/api/{workflows,app-page,artifacts}` 均 200 | 安装态 curl |

## 4. 未达标 / 已知缺口（如实登记）

1. **主壳左上角字标仍是 `deepseek HARNESS`**（用户明确要求改）：该字标由**预构建的官方客户端 bundle**（`@deepseek-ai/dsh-client-ui-brand-official`）渲染，且 `sidebar.brand.*` 槽位为"声明即独占"。
   - 已试并**失败**的三条路径：①profile patch `disabled: true`（客户端产物预构建，运行时补丁不生效）；②把 `@workbench/client-ui` 移到 bundle 列表末尾抢注册顺序；③在自有客户端插件里做 DOM 幂等替换（改的是安装目录副本，实际加载的是 profile 内副本，且客户端 bundle 有预构建环节）。相关实验均已撤回，工作树与出货 runtime 一致（client.js sha `12F7CABC…`）。
   - 下一轮可行路径（择一，需先取证）：a) 在 runtime 构建期对官方品牌客户端产物做**构建期字符串/组件替换**并纳入 build-id 指纹；b) 找到 DSH 客户端插件的**构建缓存目录**，把自有插件注入纳入缓存失效键。
2. `dsh-task-board` 网关降级：`session/list` 定义在该 cohort 被收回 → 任务板"名册自动发现"关闭（面板仍在、其余功能可用），非本轮引入。
3. `bili-native-dsh`（随 auto-memory 生态）代理子进程启动失败 → 探测流量直连；该包已不在默认加载列表，残留提示来自其它记忆链路，非阻塞。
4. 首启仍有两条**可关闭的一次性提示**（`dsh-better-sidebar` 侧栏简化建议、`@ychris12138/dsh-usage-stats` 额度横条建议）；均非阻塞，暂保留。
5. 包体：安装包 589,253,195 B（593 MB），安装后约 5.4 GB（用户已确认接受完整集合）。

## 5. 回滚

- 上一个安装包：`installer-output/UniversalWorkbench-Setup-r8-prev.exe`（473,824,650 B）。
- profile 备份：`%LOCALAPPDATA%\Programs\UniversalWorkbench\.dsh-home.pre-r9-<UTC时间戳>\`（内容即旧 `profiles/web`；恢复＝停应用后把该目录复制回 `.dsh-home\profiles\web`）。
- 本轮最终安装包：`installer-output/UniversalWorkbench-Setup.exe` 589,253,195 B / SHA256 `1B20800997CE0D9593C906B136C30B937A11979E553FC6BC27F0ECF68B414F26`。
