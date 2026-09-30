# 追溯性 PRD · Universal Workbench 3.0（通用工作台·桌面版）

> **文档性质**：事后追溯（retrospective）。立项文档是 `015-…任务书.md`（v2.2，951 行）与 `016-插件化交付增补-v3.0.md`；本文记录**实际建成态 + 每模块的决策背景 + 被否决方案**，供接手者理解"为什么长成这样"。
> **取证**：47 个会话转录（`db.sqlite`）+ 项目书面记录 + 项目记忆。Git 历史**不存在**（无 `.git`）——见 `README.md` §1。
> **状态**：截至 2026-09-29 第六轮。**U19 交付阻断仍生效**（U3/U16/U17 未 PASS），本文不构成交付宣告。

---

## 1. 产品定位与形态（建成态）

| 维度 | 建成态 |
|---|---|
| 一句话 | 给非工程角色（HR/财务/销售/行政）的**单机全能 Agent 工作台**：13 个业务域、140 页应用、离线可装、双击可用、审批与脱敏内建 |
| 底座 | **pi 0.87.1 + dsh 0.1.7-rc.2**（`016 §2` 重锁）＋项目内便携 Node v24.21.0（`tools-versions.txt`） |
| 交付形态 | **dsh client-ui 插件**（`@workbench/client-ui`）＋**独立单页应用** `app.html`（398,440 B，13 域 / 140 页）＋ Windows 每用户安装包 |
| 桌面入口 | 桌面/开始菜单快捷方式 → `scripts/launch.ps1` → 起 dsh（仅 `127.0.0.1:3080`）→ **Edge/Chrome `--app=` 无地址栏窗口** |
| 运行边界 | 仅 127.0.0.1；无公网暴露；无自动更新通道；多用户/移动端为**非目标**（`docs/PRD-桌面应用-基线.md` §4） |
| 门禁状态 | U1/U2/U6/U10/U15/U18 PASS；U3/U16/U17 PARTIAL（U17 未成立）；U4/U7/U8/U9/U11/U12/U13 NOT_RUN；**U19 → 只出阶段报告** |

## 2. 模块级：建成需求 / 决策背景 / 被否决方案

> 标注约定：`【用户否决】`＝用户明确拒绝过的方案；`⚠️更正`＝该模块的旧结论已失效。

### M1 资源包与包清单
- **建成需求**：三层资源边界——**预置层**（核心 P0/P1 tarball + 便携 Node，零下载）／**自制层**（域设计文档、PRD、CR checklist，零生成，只定制）／**缺口层**（扩展位 + `capability-gap.md` 登记，明示"无现成包"）。清单唯一真源 `manifests/packages.manifest.csv`（55 行）+ `catalog-packages.manifest.csv`（155 行）。
- **决策背景**：用户要求"任务书必须已包含现成全部资源，发给任一 Agent 即可"；但行业 MCP/ERP/HRIS 连接器在企业侧不存在统一现成包（前车之鉴：某版方案 21/22 个行业包是虚构的）。
- **被否决**：`【用户否决】`"只筛 24 个精选包"（用户：「5000 多个 pi packages 和 10000 多个 dsh-plugin 只筛选出 24 个？？不够全面」）→ 扩到 **1006 条**（pi 602 / DSH 404）；否决"字面所有包现成"；否决**第三方插件市场站作来源**（"indexed ≠ verified"）；否决 28 个不存在的包（`catalog-fake-packages.md`）。
- **证据**：`015` §3、`reports/catalog-fake-packages.md`、`reports/disabled-packages.md`、会话 `sess_babee05a` 09-28 18:41。

### M2 脚本总控（"四件套"）
- **建成需求**：`workbench.ps1|.sh` 六子命令 `fetch|install|verify|repair|report|package`，双平台；PowerShell native **成败只认 `$LASTEXITCODE`**；哈希三级回退且**空哈希=失败**；下载仅 http/https + host 白名单 + 拒绝回环/私有/保留地址。
- **决策背景**：1.0/2.0 都栽在"静默假成功"（PS `try/catch` 对 native 命令恒成功）。
- **被否决**：否决 **`try/catch` 判 native 成败**；否决**单一 `npm root -g` 判安装**（2.0 据此得出"1/24"的错误结论 → 改三源交叉探测）。
- **证据**：`015` §5、`reports/u2-script-compliance.md`。

### M3 Windows 安装器
- **建成需求**：Inno Setup 6 实构建；**每用户安装**（`PrivilegesRequired=lowest` → `%LOCALAPPDATA%\Programs\UniversalWorkbench`，免 UAC）；`[Files]` **显式列举** Node 工具链；postinstall 离线装引擎 + pnpm 自举 + 24 个包 + 工作台插件；快捷方式 `{autodesktop}`/`{autoprograms}`；`[Run]` 带 `WorkingDir:{app}`；卸载保留运行期数据。
- **决策背景**：装出的产品原本**完全不可用**——运行期写入全在安装目录内（插件写 audit/deliverables/preset-state，`DSH_HOME` 也指向 `{app}`），装到 Program Files 后非提权双击必然 EPERM/EACCES。
- **被否决**：`【用户否决】`（间接，用户要求"桌面版要能用"）→ 否决"Program Files + 手工加 ACL"（提权面/升级覆盖风险）与"Program Files + 数据全部外置"（需改插件取数根，风险高、收益低）；**否决 `Excludes:"node_modules"`**（把 npm 本体排掉）与 **`Excludes:"node_modules\@*"`**（连 npm 自己的 `@npmcli/@isaacs/@sigstore` 一起排掉，实装 npm 内部依赖 113 vs 118 → `cjs/loader` 报错）——两次都实测炸过，最终改显式列举；否决"假设目标机已有 pnpm"（→ 随包 `pnpm-10.32.1.tgz` + 第 0 步自举）。
- **⚠️更正**：旧 Setup.exe（321,802,298 B / `eb49b1d5…`）**已废弃**（旧启动器 + 缺应用 + 缺插件）；现版 **336,101,645 B / SHA256 `cc624824…bcdb`**（此前 335,596,565 B 的记法是上一轮构建字节数，已更正）。
- **证据**：`reports/desktop-acceptance.md`、`scripts/installer/win/setup.iss`（+`setup-x.iss` 必须同步）、`.work/iss-exclude-test/`（探针）。

### M4 桌面启动器
- **建成需求**：`scripts/launch.ps1` —— 便携 Node/DSH 入 PATH → **自愈**（引擎或插件缺失则先静默跑一次离线 install）→ 起 dsh（仅 127.0.0.1:3080）→ 轮询 `/workbench/api/app-page` 就绪（15×2s）→ Edge/Chrome `--app=` 窗口（独立 profile）→ 兜底默认浏览器；失败给 `ERR-INST-002` 指引。
- **决策背景**：用户明确「**要使用桌面版，而非网页版**」。原实现 `Start-Process "http://…"` 是**开浏览器标签页**，与形态要求不符。
- **被否决**：`【用户否决】`网页版/浏览器标签页形态；否决 `npx -y --package @deepseek-ai/dsh`（联网拉取，违反离线契约）；否决"静默安装跳过 postinstall 就让产品坏着"（→ 自愈补齐）。
- **证据**：`scripts/launch.ps1`、会话 `sess_630e78a2` 09-29 18:11（用户指令）、`reports/desktop-acceptance.md` §5（字面双击实测）。

### M5 工作台插件（双面 client-ui）
- **建成需求**：`@workbench/client-ui` 双面插件——Node 半面注册 `/workbench/api/*` 路由（scenes/current/domains/audit/apply/switch/save/engine-run/data/submit/workflows/workflow-run/deliverables/tools-versions/rollback-dryrun/preset-new/preset-edit/buttons/**app-page**）；浏览器半面注入 dsh 壳渲染 13 域卡 + preset 生命周期 + F7/F8/F11 面板；**同源托管 app.html**。
- **决策背景**：016 锁定插件化交付；U15 证据必须"**在 dsh 壳内**"（standalone 页面/CLI 产物/骨架页不算证据）。
- **被否决**：否决 **standalone 独立页面**路线（1.0 的 `dsh-web 自建界面` UI 0/12；2.0 单模板 ×13 域被降格为"配置展示页"）；否决**让面板"递文件"给独立应用**（http 页不能跳 `file://`）→ 改"插件自己同源托管"；`【用户否决】`**壳内面板承载 13 个独立工作台**（用户实测：「每一个工作域都不能成为独立的工作台界面…每一层都是重叠在一起的，整个面板也是挤在一起的」）→ 面板**降为入口**，但**保留**（U15/U16 证据面挂着，删掉会动摇已验收口径）。
- **⚠️更正**：曾有两处"路由存在≠接通"（`routes` 数组从未注册进宿主 → 重写为 cordis `apply(ctx)` 契约；`client.js` 有未定义函数），见 `reports/ui-walkthrough.md` 修复记录。
- **证据**：`016`、`workbench-ui-plugin/lib/*.js`、`docs/workbench-app-design-v2.md`、会话 `sess_630e78a2` 15:54。

### M6 应用 app.html（单文件 SPA）
- **建成需求**：驾驶舱 + 13 域 × (概览/台账/流程/设置) = **140 页**；两级侧边栏；表格/抽屉/步骤条/表单/校验；**真实读写 + localStorage**（键前缀 `hr_workbench_`）；角色切换（admin/hr/employee，无权限按钮不渲染）；密度开关 + 三主题；构建产物 398,440 B。
- **决策背景**：用户反馈"点开不能用/重叠/挤"→ 定性为**形态问题**（面板内联表单无后端语义、无校验、无持久化），不是样式问题。
- **被否决**：八项决策逐条否决了替代项（详见 `ADR-0006`/`ADR-0007`）——否决"继续壳内面板形态"、否决"多文件前端"（`file://` 不能 fetch）、否决"只读展示"（用户目标就是所有 action 可响应）、否决"按截图数量验收"。
- **风险未决**：`file://` 下所有副本共享同一 localStorage 域（缓解：键带构建指纹 / 导出 JSON 作权威备份）；体量上限 1.5MB。
- **证据**：`docs/workbench-app-design-v2.md`（D1-D8）、`reports/app-smoke.json`（551/551）、`reports/app-verification.json`（41/41）。

### M7 域模型（唯一真相源）
- **建成需求**：`manifests/domain-model/<域>.json`（13 个）声明表/字段/状态机/审批链/校验规则/页面清单；构建期**硬校验**（CSV 表头逐字一致、技能覆盖、工作流技能 ∈ 声明、GT 绑定、PII 未脱敏探测）；任一处漂移即**构建失败**。
- **决策背景**：此前真相源有三处（scenes / CSV / preset-design 文档）且**已漂移过**。
- **被否决**：否决"沿用三处真相源"；否决"人工核对表头"。
- **⚠️更正**：**假通过事件**——早期用 markdown 的 `|` 切分解析 CSV，导致 `columns` 恒为 1 个元素，"表头逐字核对""PII 未脱敏探测"**双双空转**。改标准 CSV 解析后仍 0 违规，但**这次是真验过**（见 `ADR-0009`）。
- **证据**：`scripts/gen-domain-model.mjs`、`reports/domain-model-validation.md`（0 违规/0 警告）。

### M8 场景/工作流/技能库
- **建成需求**：14 Scene + **78 工作流**（13 域 × 6）+ 52 SKILL.md + 13 份 preset 设计文档（211-359 行/域，合计 3,705 行，0 处 `undefined`）；`Scene/Workflow` Schema 唯一权威源；**EAP 特例**（禁联网、禁入记忆层、双审批+匿名化、独立命名空间、全量留痕）。
- **决策背景**：用户要求 13 个工作域"内容要细"；GT 必须绑定语义正确的技能。
- **被否决**：否决"30 GT × 100% PASS"不可达门槛（→ ≥25 PASS/≥6 域/每域 ≥3）；否决"行业 Overlay 首批交付"（首批 0 个）；否决**按域内序号取模轮转分配技能**（→ 78 条逐条显式语义绑定 + 3 条防漂移断言）。
- **⚠️更正**：2.0 的 **EAP GT 跑错技能**（`dispute-ops` 顶替 `eap-referral`）不是孤立笔误，是**系统性错配**（`admin.asset-inventory` 挂 `meeting-minutes` 等），3.0 根因治理。
- **证据**：`reports/u10-golden-tasks.md` §2、`docs/preset-design/`、`reports/round4-domain-completion.md`。

### M9 数据层
- **建成需求**：合成冷启动 CSV（**33 表 / 557 行**按域落盘，Type-Dict 脱敏口径），表头与域模型逐字一致；PII 列一律 `*_masked`。
- **决策背景**：不能使用真实人事数据。
- **被否决**：否决"真实数据"；否决"数据字典与落地表各写各的"（→ 46 张声明表 0 issue 的勾稽检查）。
- **未达标**：FIN 域种子数据**缺收入/净额口径** → `GT-FIN-02` 必填字段不可满足；模型**拒绝编造财报数字**并自陈缺口，该 FAIL **属实且未被豁免**。
- **证据**：`templates/workspace/data/`、`templates/Type-Dict/type-dict.csv`、`reports/data-consistency.csv`、`reports/u10-golden-tasks.md` §5。

### M10 门禁体系（U1-U19）
- **建成需求**：U1-U19 机械门禁，每条给**机械 DoD**（v2.1 的教训："新门禁无机械判据 → 判据被执行者自定自判"）；GT 执行器 `gt-runner.mjs`（lint/plan/run/report + 产物结构校验 + 审计 + 熔断）；熔断＝连续 3 个同形态失败即停并诊断。
- **决策背景**：1.0/2.0 的共同根因是"把门禁绿灯当成用户要求满足"，从未回头问"这些门禁加起来等不等于用户要的东西"。
- **被否决**：**14 条语义替换**全部判 V1（详见 `ADR-0009`）；否决"capability-gap 登记制替代拦截"（→ U19 阻断）；否决"以门禁清单替代用户要求逐字枚举"。
- **⚠️更正**：`【U18 两次更正】`见 M11；1.0 的"装载=lint / tarball 就位=可用 / HTTP 可达=工作台交付"三种语义替换**明确作废**。
- **证据**：`015` §12/§14/§15、`reports/gt-*.csv`、`reports/u10-golden-tasks.md`。

### M11 引擎整合
- **建成需求**：skill 节点执行主体必须是 **pi/dsh 真实模型调用**；`engine.run` 审计数 ≥ GT 数；本地 JS 只作断网降级且审计标 `fallback=offline`，**降级率 >50% = U18 FAIL**；三级链 `dsh exec → pi --mode json → fallback`。
- **决策背景**：2.0 实测"121 次 `workflow.skill` 全本地、`engine.run` **0 次**"——引擎从未进业务流。
- **被否决**：否决**本地确定性 JS 冒充引擎执行**（`skill-runtime.mjs` 头注释自陈"确定性实现，不依赖模型输出"）；`【用户否决】`"用纸面维度覆盖表当对标"。
- **⚠️更正（两次）**：①"U18 已质变为真实引擎执行"**撤回**——判据 `engine=pi, fallback=false` 是伪的（**pi 在内部模型 401 时仍 exit 0**）；②判据升级为**模型级**：`stopReason=stop` 且 `usage.totalTokens>0` 且正文非空，重跑后 U18 才重新成立。
- **证据**：`reports/u18-engine-integration.md`、`reports/credential-unblock-3.0.md` §36-51。

### M12 安全 / 脱敏 / 供应链
- **建成需求**：U6 三件套（全量 OSV 扫描 0 高危或豁免留痕 + provenance/维护者核验 + top20 下载量包代码抽查）；`redact_gate` 物理闸门；安全单调性 C4（`min_level` 只能增大、`redact.fields` 只能增广）；**扫描结论有新鲜度**（只可引用不可转贴）。
- **决策背景**：CVE-2026-82533（CVSS 9.4 沙箱逃逸，影响 dsh ≤0.1.1-rc.2）→ 锁 ≥0.1.2；免 Key 视觉插件默认把截图外传第三方（对 HR 数据是红线）。
- **被否决**：否决**"哈希锁定 + host 白名单 = 已检查安全"**（只覆盖供应链完整性，不覆盖代码安全性）；否决**免 Key 视觉插件**；否决**3080 暴露 0.0.0.0/局域网隧道**。
- **⚠️更正**：redact 命中曾如实登记 `BLOCKED(credential)`（"不以上游 README 或配置存在性冒充"），第三轮已补证（原值被替换为 `[REDACTED:…]`，模型侧可见）；同时**新登记 3 项上游缺陷**（同列第二行漏检、身份证被误标为 Credit Card、手机号完全未命中）。
- **证据**：`reports/security-check.md`、`reports/security-scan/scan-summary.json`（179 包 / 0 漏洞 / 0 错误）、`reports/l3-session-interactions.md`。

### M13 凭据治理
- **建成需求**：S0 强制 `credential-probe`（用当前 key 发 1 次最小真实请求，非 2xx 即**停线**）；**密钥永不落盘/入库/进命令行**（环境变量 + 子进程 env 传递，报告一律掩码）。
- **决策背景**：1.0 的环境预检只查二进制版本、不验凭据 → 带病连跑 15 个 GT 才发现 401。
- **被否决**：否决**只查版本的环境预检**；否决落盘 `.env`（KICKOFF 曾提 `.env.example`，实际探针走环境变量）。
- **⚠️更正 + 安全事件**：①"唯一硬停线=key 失效、只有用户能解决"**不成立**——机器 `HKCU\Environment` 里一直有有效 key（尾号 `2e6b`，`PROBE_OK latency=601ms`），401 的是**进程继承的旧值**；②发生过一次**密钥明文泄漏**：掩码命令写错（`sed 's/\(....\)$/****\1/'` 是"插入"而非"遮蔽"），建议轮换；③本轮挖掘转录时又发现会话库内 3 处历史 key 明文痕迹（非本项目文件）。
- **证据**：`reports/credential-unblock-3.0.md`、`scripts/credential-probe.mjs`。

### M14 profile 依赖治理
- **建成需求**：项目内独立 `DSH_HOME`（隔离，不动用户既有环境）；`pnpm-workspace.yaml` **overrides 钉 `@deepseek-ai/dsh*` → 0.1.7-rc.2**（catalog 包 peer 声明 0.2.0-rc.1 曾致 91 行禁用 + 整壳崩溃）；与引擎内建同名的 catalog 包移出 profile 并留台账（11 个）。
- **决策背景**：3.0 最严重的运行时故障——dev 壳 4 插件永久 pending + 每 5s 报错（≈9MB/天）。
- **被否决**：否决**移除 `dsh-lark-bot`**（"它是 profile 里唯一引入 `dsh-attachment` 的包，删了会变成 `Cannot find module`，attachments 依旧死"）；否决**禁用 task-board 了事**（只消音不治病）；否决**手工 patch profile**（不可复现）。
- **⚠️更正**：曾有一次"擅自改动用户既有环境"并**主动回滚**（`~/.dsh/profiles/web` 里被 pnpm 加了 pi2dsh → 撤销；根因是 `dsh plugin add` 的 cwd 相对路径语义）。
- **证据**：`reports/disabled-packages.md`、`reports/r6-profile-attachment-fix.md`、`.work/profile-backup-r6/`。

### M15 文档 / CR / 宣告层
- **建成需求**：PRD 基线、UI 交付规格（含**同构判定规则**封堵"13 张同构截图"）、CR checklist 五类、学员版/维护者版 README、交付宣告检查单（逐句对证据）。
- **被否决**：否决 **md/html 双格式维护**（只留 Markdown）；否决 **Runner 专属指令硬编码进主文档**；否决**承诺未实测的 Runner/形态能力**（10 Runner 中 9 个 UNVERIFIED → "矩阵照发、实测回填、不得宣称 10/10"）。
- **⚠️更正**：2.0 的交付宣告把"哈希复核 + 技能文件存在"说成"已安装、完整可用"——**内部诚实（报告）与外部表述（宣告）之间出现语义升级** → 3.0 由 U19 阻断 + 检查单逐句对证据。
- **证据**：`docs/UI-DELIVERY-SPEC.md`、`docs/CR-checklist.md`、`docs/delivery-announcement-checklist.md`。

### M16 复盘 / 证据层
- **建成需求**：两轮"为何未达标"复盘（各 35KB，逐条列证据）、阶段报告、54 项壳内截图、`reports/` 全量证据。
- **决策背景**：项目纪律"无证据按 0 分；每行必须引用证据路径"。
- **被否决**：否决"删除失败记录"（V 级一票否决）；否决"用 md 报告冒充 UI 呈现"。
- **⚠️更正**：1.0 的 `GT-TRN-01 机械判 FAIL` 是**反向误判**（实际落盘 35KB 有效产物）——"判定系统双向都不可靠"。
- **证据**：`docs/why-not-met-1.0.md`、`docs/why-not-met-2.0.md`、`reports/ui-walkthrough/`。

### M17 知识层
- **建成需求**：13 域知识种子 + graph-memory 配置 + 注入语料（`templates/knowledge/`，18 文件）；Type-Dict 数据字典。
- **被否决**：否决"依赖不存在/不可核验的记忆包"（`pi-mentis-memory` npm 404 → 以 `graph-memory` + `pi-vault-mind` 替代）；否决"semantica/muzz 等不可核验项进入对比集"（V8）。

### M18 审计与交付物落盘
- **建成需求**：append-only 审计 `audit-<date>.jsonl` + 交付物 JSON（`deliverables/<域>/*.json`）+ preset 运行时状态；每次动作三重效果（状态变更 / 审计追加 / 持久化）。
- **被否决**：否决"可变的审计/轨迹"（C6 append-only）；否决"每次动作只改内存"。
- **证据**：`templates/workspace/{audit,deliverables,system/preset-state}`、`reports/app-verification.json`（交付物↔审计勾稽 128/23）。

## 3. 约束目录（驱动全部决策的硬规则）

**不可变约束 C1-C8**：C1 底座 pi+dsh 禁降版｜C2 Chassis 层出现业务域词汇即违规｜C3 工具调用经 Permission Gateway（ALLOW/DENY/APPROVAL_REQUIRED）｜C4 安全单调性（只收紧）｜C5 卸载可逆｜C6 审计/Trajectory append-only｜C7 单一引用源｜C8 清单唯一真源（文档禁复制包表格）。

**一票否决 V1-V8**：伪造安装/测试/截图/日志；Mock 冒充核心能力；Chat 记录冒充 Task State；删除失败记录；未 `npm view` 就写包名；凭空编写行业包名；敏感数据外发/明文密钥入库；**引用无出处数据**。

**安全硬线**：CVE-2026-82533 → dsh ≥0.1.2（实锁 0.1.7-rc.2）；**仅 127.0.0.1**，永禁 0.0.0.0/隧道；`redact_gate`（个体级敏感数据外流前必须改写）；EAP 五条（禁网/禁记忆层/双审批+匿名/独立命名空间/全量留痕）；密钥永不落盘。

**流程纪律**：禁用 `latest`（全依赖锁版本 + SHA256）；新增包名必须 `npm view` 核实，找不到 → `capability-gap.md` 降级；熔断（连续 3 次同形态失败即停）；CR 覆盖率 100%（缺 `cr-<artifact>.md` 的门禁不算通过）；**U19 阻断**（U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → 只出阶段报告）；`docs/delivery-announcement-checklist.md` 逐句对证据。

## 4. 更正台账（引用旧文档前必读）

| # | 原结论 | 更正后 | 证据 |
|---|---|---|---|
| 1 | "凭据失效，**只有用户能提供新 key**"（唯一硬停线） | **不成立**：机器上有有效 key，401 是进程继承旧值；停线当场解除 | `reports/credential-unblock-3.0.md` |
| 2 | "**U18 已质变为真实引擎执行**"（据 `engine=pi, fallback=false`） | **撤回**：pi 内部 401 仍 exit 0，判据伪；升级模型级判据后重新取证 | 同上 §36-51 |
| 3 | "表头逐字核对 / PII 探测 已通过" | **假通过**：CSV 用 `\|` 切分致 `columns` 恒 1 元素；修后仍 0 违规但这次真验过 | r5 交接 §4、`reports/domain-model-validation.md` |
| 4 | 引擎版本锁 `0.1.5-rc.3` | **重锁 `0.1.7-rc.2`**（插件契约要求），manifest 回写并复跑 U1 | `016` §2、`progress.md` L31 |
| 5 | 1.0 语义三分："装载=lint / tarball 就位=可用 / HTTP 可达=交付" | 明确作废，扩为 **14 条语义禁令** | `015` §14.6/§15.2 |
| 6 | 1.0 "GT-TRN-01 机械判 FAIL" | **反向误判**（实际有 35KB 有效产物）→ 判定系统双向不可靠 | `docs/why-not-met-1.0.md` E7 |
| 7 | 2.0 U15 判 PASS（23 张截图） | 存/切审计 0 次、无 saved 产物 → **判据与证据矛盾** | `docs/why-not-met-2.0.md` |
| 8 | 1.0 `catalog_verified=155/155`（完整性达成） | 那是**哈希校验**，不是安装（语义漂移） | `docs/why-not-met-1.0.md` L133/L329 |
| 9 | 旧 Setup.exe（321,802,298 B / `eb49b1d5…`） | **已废弃**（旧启动器 + 缺应用 + 缺插件），已重建 | `reports/desktop-acceptance.md` |
| 10 | 插件路由"已注册" | **路由存在≠接通**（`routes` 数组从未注册）→ 改 cordis `apply(ctx)` | `reports/ui-walkthrough.md` |
| 11 | `tools-versions.txt` 的 `.tools/npm-global` prefix 表述 | 与实际不符（npm 11.x 拒绝项目 prefix，全局落便携 Node 目录） | `reports/u2-script-compliance.md` §5 |
| 12 | "壳内面板＝工作台界面" | `【用户否决】`→ 改独立单页应用，面板降为入口 | `docs/workbench-app-design-v2.md` |
| 13 | 2.0 "无 git 无法取证" | 改用 `tag-manifest.csv` 哈希链（append-only，可审计） | `015` §4.3 |
| 14 | r5 认为桌面已通（app 窗口实测） | r6 发现"装出来不能用"四条断点 + 两条静默致命 | `reports/desktop-acceptance.md` §3 |
| 15 | "离线可装（无网可完成）" | **未成立**：引擎 tgz 有 81 个 registry 依赖且无 bundled；冷缓存断网未测 | `reports/desktop-acceptance.md` §6.1 |
| 16 | 2.0 "安装探测 1/24" | 探测路径错位（`npm root -g` 指向 managed node），结论不可信 | `docs/why-not-met-2.0.md` |
| 17 | U17 首轮夹具/判分 | 占位符致裸基准超时；污染轮次归档 `benchmark-artifacts-badfixture/` | `reports/u17-benchmark.md` §5 |
| 18 | U10 判据（顶层键 / 整列非空） | 两处修订（列名语义 / 允许合法空值），三次数值均在案 | `reports/u10-golden-tasks.md` §4 |
| 19 | 2.0 交付宣告"已安装、完整可用" | 语义升级（报告 1/24 vs 宣告"复核通过"）→ U19 阻断 | `docs/why-not-met-2.0.md` |

## 5. 未达标 / 未验证项（截至第六轮，如实登记）

1. **U17 对标未成立**：基准仅实跑 1/3（pi 10/10）；工作台臂 5/10（另 5 项缺平台级夹具，**拒绝用 pi 臂冒名顶替**）；判分器 3 项缺陷未修；可比值上**工作台 3.65 < pi 4.45**。
2. **严格离线未验证**：引擎 81 个 registry 依赖 + `offline/npm/` 仅 26 tarball → postinstall 传递依赖走 registry/热缓存。
3. **第二台干净机全旅程未做**（无第二机）；**macOS 侧未构建**（无环境）。
4. **`file://` 双击 app.html 从未真实验证**（Playwright MCP 屏蔽 file 协议）。
5. **桌面形态非原生**：Edge/Chrome `--app=` 窗口（依赖系统自带 Edge）。
6. **L4 逐包独立性循环**残留仪器问题；**L3** 两项未取证（审批主动拦截留痕、记忆跨场景召回）。
7. **`pi-redact-all` 三个上游缺陷**（同列漏检/误标/手机号未命中）未上报完成。
8. **FIN 域数据口径**缺失（`GT-FIN-02` 唯一真 FAIL，未被豁免）。
9. **U4/U7/U8/U9/U11/U12/U13** 汇总类门禁未动（多处报告文件不存在）。
10. 产品自带开发期运行数据（`templates/workspace/{audit,deliverables,preset-state}` 随包），**非冷启动语义**。
11. `todo` 表两条 pending（"postinstall 装插件""重建 Setup.exe"）**实际已完成但未回写**——记录卫生问题。

## 6. 关键数字（引用时以本表 + 源路径为准）

| 事实 | 值 | 来源 |
|---|---|---|
| 引擎 dsh | 0.1.7-rc.2，SHA256 `5f2da727…ff8` | `tools-versions.txt`、`reports/u1-bundle-audit.md` |
| pi / Node / pnpm | 0.87.1 / v24.21.0（`158f7685…e541`）/ 10.32.1 | `tools-versions.txt` |
| 安装包 | **336,101,645 B**，SHA256 `cc6248240b33dad6c0abb662566d2d3c3a95112a755f9eb682cd079d0330bcdb` | `installer-output/`、`reports/desktop-acceptance.md` |
| app.html | 398,440 B，SHA256 `a94f8f3b…e946`（产品内=仓库内） | `reports/desktop-acceptance.md` §5 |
| 包总量 / 安装终态 | 179 tarball（24 核心 + 155 catalog）；P0/P1 **24/24**、catalog **153/155** + 2 豁免 | `BUNDLE-INDEX-3.0.md`、`reports/disabled-packages.md` |
| 域与资产 | 13 域 / 14 Scene / **78 工作流** / 52 SKILL.md / 33 表 557 行 | `reports/round4-domain-completion.md` |
| 应用规模 | **140 页**；冒烟 **551/551 PASS**；自检 **41/41 PASS** | `reports/app-smoke.json`、`reports/app-verification.json` |
| GT | 唯一 39 条，**PASS 39/39**，12 域全部达"每域≥3"；累计 3,724,341 tokens | `reports/u10-golden-tasks.md` |
| 安全扫描 | OSV 179 包 / 0 漏洞 / 0 错误；生命周期脚本 55/179 | `reports/security-scan/scan-summary.json` |
| dev 壳健康 | pending 4→0、failed-to-import 2→0、报错循环 106 B/s→0 | `reports/r6-profile-attachment-fix.md` |
| 基准 agent 核验 | 11 个：9 真 / 2 不可核验 | `reports/readiness-verification.md` |
| D2 壳候选（dsh-web）Git 快照 | remote `zhu1090093659/dsh-web`、branch `dev`、HEAD `c989e5a`、tag **v0.4.3**（2026-09-26）、**提交数 1（浅克隆）** | `universal-workbench-bundle 1.0/offline/github/dsh-web/.git`（见 `README.md` §1.1） |
| 清单索引源 Git 快照 | `awesome-dsh-plugin` HEAD `4fee2fc`（2026-09-27）；插件源码克隆 **286 个** | `工作台pi-dsh方案/download-scripts/{catalog,downloads}/` |
