# Universal Workbench 4.0 Progress

## 2026-10-02

- [x] 锁定目标：Windows 10/11 x64，运行复现、开发复现、插件按需选择、升级回滚和证据完整性。
- [x] 锁定四层资源边界：runtime、source、agent、support-source。
- [x] 确认 `Pi_DSH_support` 为离线可选资源源材料，不默认全量安装。
- [x] 复制 3.0 核心源码和运行资源到 4.0 独立目录。
- [x] 复制原始方案顶层文档到 `inputs/original-scheme/`。
- [x] 完成 `Pi_DSH_support` 归档：182,635 文件、5,251,642,717 bytes，7z 测试通过。
- [x] 完成用户自选模型适配器、L0/L1/L2 能力契约和 OpenAI-compatible 模拟测试。
- [x] 完成初始化、验证、打包、恢复、插件选择和证据汇总脚本。
- [x] 生成 input BOM、plugin catalog、SBOM、四层发布 BOM 和 SHA256。
- [x] 实测离线初始化成功。
- [x] 实测 app-page HTTP 200、405,785 bytes。
- [x] 实测 `4.0.0-dev4` 恢复到独立目录后通过静态验证、离线初始化和 app-page 200。
- [x] 生成候选 `4.0.0-dev6`；runtime/support 与已验证的 dev4 一致，仅更新文档和证据。
- [x] 完成默认空选择的 `selection.lock` 和依赖验证。
- [ ] 未运行真实模型探测和工作流。
- [ ] 未运行 Windows 10/11 clean VM 完整矩阵。
- [ ] 未运行完整升级回滚和开发重建。

## 2026-10-11 · DSH 引擎升级 0.1.7-rc.2 → 0.2.0-rc.2

### M0 基线（4.0；QA 数据根 = 沙箱可写目录 uw4-qa，因沙箱禁写 %LOCALAPPDATA%）
- [x] 3.0 仓库建分支 `upgrade/dsh-0.2.0-rc.2`（基线 master `6ba773a`，工作区干净）。
- [x] `4.0-verify` ok=true（31/31 含 init；首跑 FAIL 的 runtime:init-exit 系沙箱写权限，换可写数据根后 PASS）。
- [x] `design:verify` 21/21；`verify:workflow-contracts` 549/549；`verify:workflow-delivery` 546/546。
- [x] `verify:deliveries` 117/117（须沙箱外执行 soffice；沙箱内 13 个 Office 转换 EPERM 属环境限制，已定性）。

### M1 工件获取与锁定
- [x] `offline/engines/deepseek-ai-dsh-0.2.0-rc.2.tgz`（npm 官方，sha256 `bd27847c…`；与 anywhere vendor 副本内容等价、仅 2 条依赖行序不同，见 `offline/engines/SHA256SUMS.txt`）。
- [x] 补丁：`gen-runtime-manifest.mjs` DSH_VERSION=0.2.0-rc.2；`download-all.ps1` 引擎行；`workbench.ps1/sh` 断言改 0.2 线；`workbench-ui-plugin` engines/peer=`>=0.1.7-rc.2 <0.3.0-0`；`runtime-bundles.json` builtin 版本。
- [x] `GEN_OK bundles=57 deps=63 shippedNotLoaded=7`；overrides：dsh-attachment/dsh-sdk-protocol=0.2.0-rc.2。
- [x] vendor `tools/dsh-upgrade-skill/`（skills 141 文件 1.57 MB + LICENSE + PROVENANCE）。

### M2 审计（进行中）
- [ ] dsh-upgrade-audit：0.2.0-rc.1→0.2.0-rc.2 边（未成卡边）
- [ ] plan-migration 触点扫描（workbench-ui-plugin）
- [ ] peer 审计矩阵（产品集 63 依赖）
- [ ] ADR-0016

### M3 引擎与运行时（进行中）
- [x] 便携 Node 全局引擎 0.2.0-rc.2（`dsh --version` = 0.2.0-rc.2；嵌套闭包 287 包）。
- [x] `.work/runtime-web` 重建（0.2.0-rc.2 + 63 插件；bundles=56、shippedNotLoaded=8）+ `offline-3.0/runtime-web.zip`（build-id `79f09863…`）。
- [x] QA 数据根 `uw4-qa02` 冷启动：`dsh web:` 就绪；禁用行 0、failed-to-import 0、pending 0、激活错误 0。
- [x] 就地升级合并修复：welcomeNoticeVersion upsert=2026-09-28.1；豁免表数组并集；UTF-8 无 BOM 读写（PS 5.1 编码陷阱）；修复后复验通过。

### M4 门禁（进行中）
- [x] peer 审计：62 插件、23 条精确版本豁免（`templates/runtime/compatibility.json`）。
- [x] dsh-artifacts 处置：随包分发、默认不加载（原因与重评条件入清单与 ADR-0017）。
- [x] 工作台 UI v4 门禁 **10/10**（两条旅程含真实模型、artifacts=9、1100×700、控制台无页面错误）。
- [x] capabilities 重生成 + verify：**FAIL=0**（145 local/ready、20 BLOCKED_EXTERNAL、8 N/A、0 fail）。
- [x] H6 模型探测（L0/L1，79 tokens）；H7 真实工作流（504 tokens + 审计行）。
- [x] 全舰队七类触点扫描（3287 文件 / 11832 启发式命中，登记为库存）。
- [x] 壳严格门禁 101/102 → 登记 0.2 新控件「显示/隐藏代码工作视图」后复跑中。
- [x] 模型截断修复：maxOutputTokens 2048→8192（JSON 截断曾致 blocked_model）。
- [x] 4.0-verify 全量复跑（qa02）：**ok=true（31/31）**；安全扫描对 vendored 技能假夹具加白名单后恢复 PASS。
- [x] vision-toolkit 重评：维持停用（调用已移除的 `ctx.settings.register`；元数据 `<0.2.0`）→ `reports/upgrade-0.2.0-rc.2/vision-toolkit-reeval.md`。
- [x] H9 回滚演练：0.1.7 保留 profile 以自带引擎启动（401 + 工作台页 200），证据归档。
- [x] M5 安装器重建与安装态验收：Tauri exe 重建（`06B17DF8…`）→ ISCC 打包 → 静默就地安装 → `{app}\.dsh-home` 刷新到 build `507f1c22` → 按应用真实契约（profile 内引擎 + `UNIVERSAL_WORKBENCH_ROOT`）启动 → **安装态 UI 旅程 10/10**、pluginload 全 0。
- [x] 安装态验收发现并修复四处：① `tools/` 未入包（引擎运行器缺失→MODEL_UNAVAILABLE）；② `config` 示例未入包；③ Tauri/launcher 需 profile 内引擎优先（残留 0.1.7 全局引擎会引导 0.2 profile 失败，实测 61 pending）；④ 新编译安装器须以唯一文件名运行（同路径首跑执行旧二进制）。
- [ ] M6：3.0 回填（两批提交 f754347 / 375abe7 已推送）→ 合并 master / release-preview / tag（进行中）

## 2026-10-11 · 4.0.0-dev8 集成层（三项目可见入口 + 自定义工作台）

目标：把 recon 报告的三个参考项目做成应用内可见入口（自定义工作台 / 升级与兼容 / 集成中心），
自定义工作台走「草稿 → 校验 → 预览 → 合入包」闭环；正式生效必须过门禁并重打包。

### M1 草稿管线（scripts/custom + workbench-ui-plugin/lib/custom-drafts.mjs）
- [x] `custom-drafts.mjs`：草稿存储（数据根 `workspace/custom/**`）、资产契约白名单、
      生成物守卫、staging 物化（manifests/templates/docs/src/scripts/workbench-ui-plugin/assets + node_modules junction）、
      `<域>.workflows.json` 注入、两级校验（域级必须 / 快检基线 / 重型基线后台）、预览构建、合入包与 apply-draft。
- [x] 流程修正（实测）：注入必须先于 gen-domain-model；build-app 需预建 preview 目录；delivery 矩阵需 assets/。
- [x] 关键事实固化：`design:verify` 为 13 域 / 39 模块 / 78 工作流闭集断言 → 新增域登记 `baseline_pending` 缺口清单（不静默放行）。
- [x] CLI：`scripts/custom/verify-draft.mjs`（--full 后台重检）、`apply-draft.mjs`（默认 dry-run，--yes 写入并备份）。

### M2 夹具（scripts/custom/fixtures + verify-fixtures.mjs）
- [x] 正例①：rec 新增台账表 + Type-Dict 行 → 域级 + 快检基线全绿。
- [x] 正例②：全新自定义域 cust-learning → 域级全绿 + 基线缺口如实登记。
- [x] 反例：未脱敏 PII / 技能无覆盖 / 改写生成物 → 全部被拦下并给出机器可读缺口。
- [x] `CUSTOM_FIXTURES PASS 5/5`（证据：reports/custom/fixtures.json）。

### M3 应用入口（面板 + 独立应用）
- [x] 壳内面板：nav 新增 自定义工作台 / 升级与兼容 / 集成中心；域清单改为 `/domains-index` 动态驱动（自定义域徽标）；
      补回「打开独立驾驶舱 ↗」；定制闭环（建草稿/复制指令/开始定制会话/校验/完整门禁/预览/导出合入包）。
- [x] 独立 app.html：侧边栏三个入口 + 预览横幅（未固化）+ file:// 降级；集成中心/升级快照烘焙进构建。
- [x] 服务端路由 11 条（domains-index / upgrade-status / integration-status / custom/* / app-page?draft=）。
- [x] 清单：`manifests/integration-status.json`（3 项目 14 条采纳项）；shell 动作 +4（含独立驾驶舱链接，严格门禁控件登记）。

### M4 门禁（进行中）
- [x] 壳严格门禁：`SHELL_VERIFY PASS 106/106 unknown=0`（reports/shell-audit/dev8-strict.json）。
- [x] 重型基线（staging，正例①）：workflow-contracts exit=0（149s）；workflow-delivery 首次失败系 staging 缺 assets/（已修）。
- [ ] UI v4 门禁（19 旅程）复跑（后台重检争用 CPU 导致审批旅程超时一次，重跑中）。
- [ ] 4.0-verify / capabilities / verify:app / verify:deliveries 全量复跑。
- [ ] 安装器重打包 + 安装态验收（M5）。

## 2026-10-11 · 4.0.0-dev9 工作台运行时装上即用

目标：把自定义工作台升级为 dataelement 式运行时装上即用（会话设计 → 校验 → 安装 → 侧边栏即时可用），
修复独立驾驶舱"点不动"，把集成中心改造为工作台市场，并补齐真实数据接口。

### M1 运行时工作台层
- [x] `lib/runtime-workbenches.mjs`：安装物落 `workspace/custom/installed/<id>/`（install.json + assets + generated），
      安装前置=域级校验；变更内置域走 overlay（不改 78 工作流闭集）；卸载保留数据、停用隐藏入口。
- [x] 通用设计生成器 `scripts/custom/build-runtime-design.mjs` + `verify-runtime-design.mjs`：
      新增域生成最小可用设计（模块/事项/阶段由工作流节点派生），保证工作流向导/实例/审批/交付全链路可加载。
- [x] 平台解析器合并（先叠加层后内置）：workflowIndex / domainModel / design / 已知域校验；
      delivery-service 对未登记域回退默认交付 profile（src 修改并重建 bundle）。
- [x] `install-workbench` 工具/路由、随包样例 `samples/workbenches/cust-learning` 与 `manifests/workbench-catalog.json`。

### M2 会话通道与市场页
- [x] 工作台工具集（11 个 `workbench_*` 工具）+「工作台设计师」技能（`ctx.skills.registerProvider`，技能中心可见）。
- [x] 面板：nav 重排为 战略总看板 / 13 域工作台 / **工作台市场** / 自定义工作台 / 升级与兼容 / …；
      MarketView（已安装管理 / 本地目录 / 数据导入 / 数据源 / 关于）+ 已安装工作台侧边栏一级入口（⧉ 名称）。
- [x] 独立应用：市场页 + 实时读服务端数据（种子仅 file:// 回退）+ 台账只读徽标 + 严格导入入口。

### M3 驾驶舱修复
- [x] 根因：wry 无 `on_new_window` 时对 `window.open` 直接 `SetHandled(true)` 丢弃（WebView2）。
- [x] Tauri 主窗口接管新窗口（应用内新窗口 + 日志证据）；前端弹窗被拦时同窗口导航兜底（门禁旅程覆盖）。

### M4 数据面
- [x] `lib/data-plane.mjs`：导入（严格表头 / 列映射 + 预览）、XLSX（exceljs 解析）、备份 + `data.import` 审计 + 数据版本；
      外部只读数据源骨架（file/http 探测与刷新，sql 预留 not-implemented；凭据只引用环境变量名）。

### M5 门禁与交付（全绿）
- [x] CUSTOM_FIXTURES 10/10；UI v4 28/28（开发壳）、安装态 27/28（唯一失败=第三方槽位崩溃，已证实无关）；
      shell strict 107/107；APP_VERIFY 45/45；4.0-verify ok；capabilities fail=0；design:verify 21/21；contracts 549/549；delivery 546/546。
- [x] 安装包 `UniversalWorkbench-Setup-4.0.0-dev9.exe`（sha256 `3AB675BC…`）静默安装 `exit=0`（/LOG 固化）；
      安装态复验：市场入口/侧边栏工作台入口/样例运行时装订/导入落盘/兜底导航全部通过。
- [x] 证据归档 `reports/workbench-runtime-dev9/`（含 README 逐条对应 5 个用户可见问题）。
- [x] 残留登记：`conversation.input.left` React #130（第三方）、dsh-sonarqube/sentry 无凭据报错；`install exit=5` 未复现（带日志重跑 exit=0）。
- [x] 复核发现并修复：宿主要求工具 `output.render`，11 个工作台工具此前在 register 处静默失败 → 补齐 render +
      失败审计；开发壳与安装态审计确认 12 个 `tool.register ok=true` + `skill.register:workbench-designer ok=true`。
- [x] `install exit=5` 根因复现并固化（`/LOG`）：强制结束应用遗留 `{app}` 下 dsh 子进程占用文件，RestartManager 在静默模式默认 Abort；
      清理遗留 node 后同一安装包 exit=0。最终安装包 sha256 `341779D9…`（594,377,279 B），安装态 UI 27/28、APP_VERIFY 45/45。

## 2026-10-11 · 4.0.0-dev10 工作台市场 v2（对齐 dataelement 源码设计）

- [x] 目录协议 v2：`workbench-catalog.mjs`（校验/缓存/stale/force）+ `manifests/workbench-catalog.json` v2 + `workspace/config/market-sources.json`（默认仅本地）；检查更新 + 禁止降级。
- [x] 状态账本：`workbench-state.mjs`（revision 409 + 全套不变量）；路由 /custom/state、/custom/notes、/custom/session-binding；已安装自动并入 added。
- [x] 包 v2 + 双包：`workbench-package.mjs`（校验/.tgz 读写/导出/登记）+ `check-workbench-package.mjs`；`plugin-packages.mjs`（CLI 探测 → dsh plugin add/remove → 重启提示 → market-installs.json）。
- [x] install.json v1→v2 自动迁移；样例包升 v2（真实截图）；市场/向导/工作台模式 UI（三页签/卡片轮播放大/收藏/更新/确认弹窗/主开关/顶部切换器/笔记）。
- [x] 门禁：UI v4 34/34（开发壳）、安装态 33/34（唯一失败=第三方 conversation.input.left #130）、shell strict 107/107、APP_VERIFY 45/45、4.0-verify ok。
- [x] 安装包 `UniversalWorkbench-Setup-4.0.0-dev10.exe`（sha256 `8A91CEE0…`）静默安装 exit=0；证据 `reports/workbench-market-dev10/`（含未跑项登记）。
- [ ] 遗留：目录/状态/包的新夹具未补；插件包"重启后加载"未做整链 UI 验证；SPA 市场为轻量对齐；远程源未联调。
