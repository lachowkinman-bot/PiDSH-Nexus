# 1.0 自动开发交付复盘 · 为什么没有达到用户原始要求

- 复盘对象：universal-workbench-bundle 1.0 自动开发交付（执行 015 任务书 v2.0，2026-09-27）
- 唯一验收基线：用户原始 4 点要求（本文第一节逐条引用）
- 复盘纪律：只陈述有证据的事实；不写"基本完成/大致满足"；不用"环境限制"当根因；每条未达项标注 1.0 方案缺口
- 证据库：`reports/evidence-1.0/`（14 份运行日志 + 6 份 UI a11y 快照，均已从临时目录固化）；其余证据为仓库内文件与命令复现

---

## 一、用户要求逐条对照表

| 用户原始要求 | 拆解后的可验收项 | 实际交付 | 证据 | 状态 | 差距 |
|---|---|---|---|---|---|
| **1. 基于 pi.dev + dsh（deepseek harness）框架整合** | 1a. dsh 引擎安装运行 | dsh 0.1.5-rc.3 离线安装，web/无头双形态可启 | reports/install-log.md；evidence-1.0/01-model-smoke-ok.log | 满足 | — |
| | 1b. pi 引擎安装运行 | pi 0.87.1（预装），单发模型+工具链任务实测 | evidence-1.0 同类：runner-matrix-results.md §2 | 满足 | — |
| | 1c. pi 包桥接进 dsh（pi2dsh） | 12 个 Pi 包桥接装载（装载日志） | evidence-1.0/12-workbench-profile-boot-all-mounted.log | 满足（装载级） | — |
| | 1d. 整合系统经 UI 端到端可用 | **从未在 UI 内完成任何一次真实任务**；整合只经无头 CLI 验证 | evidence-1.0/*.yml（6 份快照止步于工作区选择门控）；reports/domains-u10.md（GT 全部经 CLI） | **未满足** | UI 侧整合零验证 |
| **2. 基于 topics/dsh-plugin + pi.dev/packages 的 packages/skills/plugins/extensions：已检查安全、已安装、完整可用** | 2a. 两个索引的选品 | pi.dev 63 项分析 + top50 44 补充；dsh-plugin 76 插件分析（前序会话产出） | BUNDLE-INDEX.md「目录层」节；reports/index-verbatim-verification.md | 满足 | — |
| | 2b. 已检查安全 | SHA256 全量锁定 + host 白名单；**无包代码审计、无依赖漏洞扫描、无 provenance 检查** | reports/u1-bundle-audit.md；reports/security-check.md（范围仅 4 项自列） | **部分满足** | 安全检查深度未达"已检查"的通常含义 |
| | 2c. 已安装 | P0/P1 24 包已装；**catalog 155 包仅下载未安装**（install-log 0 条 catalog 记录） | reports/install-log.csv（grep catalog=0）；BUNDLE-INDEX.md 自述"111 真实包全部下载" | **部分满足** | 155/179 包未安装 |
| | 2d. 完整可用（逐包） | 功能级证据仅 4 包（approval-guardian、redact-all、hermes-memory、pi-dag-core 装载级）；2 个包存在未修复缺陷（edit 工具 headless 崩溃、sideroom 非交互不可用）；dsh-network-settings 不兼容剔除 | evidence-1.0/03、05、07 号日志；reports/domains/rec-smoke.md details（edit flatMap 报错） | **未满足** | 逐包可用性 DoD 从未定义也从未执行 |
| **3. 12 域（战略…员工关系含 EAP）场景配置+工作流配置+UI 界面及模块呈现+实际应用场景** | 3a. 场景配置 | 14 个 scene YAML（预置+修正 2 处 domain 代号），lint 0 违例 | scripts/schema-lint.mjs 输出；reports/domains-u10.md §1 | 满足（配置文件层） | — |
| | 3b. 工作流配置 | 26 个 workflow YAML（修复伪 YAML 26 件），lint 0 违例 | scripts/fix-workflow-yaml.mjs；schema-lint | 满足（配置文件层） | — |
| | 3c. **UI 界面及模块呈现** | **0 个自建 UI 页面/组件/路由**；交付物目录中 html/vue/jsx/tsx 组件文件数=**0**；唯一 UI=DeepSeek 原版 dsh web 聊天界面 | `find templates docs scripts manifests data -name(*.html|*.vue|*.jsx|*.tsx)`=0；evidence-1.0/*.yml 快照（界面为"探索未至之境"原版聊天壳） | **未满足** | 12 域模块工作界面 0/12 |
| | 3d. preset 可选/可应用/可保存/可切换/持久化 | **未实现**。scenes 的全部消费方=4 个离线脚本（lint/生成字典/拼提示词），无运行时装载器、无 UI 呈现、无生命周期 | scripts 消费者 grep：schema-lint.mjs、run-gt.mjs、gen-typedict-fields.mjs、gen-domain-assets.mjs——均为离线工具 | **未满足** | "接入"语义 0 实现 |
| | 3e. 实际应用场景跑通 | 27 GT 实跑 10 PASS 跨 4 域（CLI 通道，产物为 md 报告）；4 个 L4+双审批域未跑 | reports/domains/*.md；reports/domains-u10.md §2 | 部分满足 | 量线未达；且全部经 CLI，无一在 UI 内 |
| **4. 达到 Codex/GenericAgent/Zcode/pi/dsh/minimax-code/MiMo-Code/semantica/Octop 等 agent 的交付质量** | 4a. 基准核验 | 9/11 可核验（前序会话纸面核验，semantica/muzz 不可核验） | reports/readiness-verification.md | 部分满足 | — |
| | 4b. 质量维度对标 | "维度覆盖表"声明就绪 | readiness-verification.md §三 | **未验证** | 声明性表格，无度量 |
| | 4c. 实测质量对比 | **未执行任何对比测试**（无同一任务集跑基准 agent 的 A/B 记录） | 全 reports/ 无对比测试产物 | **未验证** | 对标=纸面 |

**总体：4 条要求中，配置文件层与引擎安装层满足；"UI 界面及模块呈现"（3c/3d）、"完整可用"（2d）、"实测质量对标"（4c）未满足或未验证。**

---

## 二、过程时间线

### 阶段 1 · 需求接收与理解
- 计划：理解用户要交付什么。
- 实际：执行起点是用户消息"执行 universal-workbench-bundle 项目中 015-…md，确保独立 .env"。agent 把 **015 任务书的 14 道门禁当作需求全集**，没有把用户 4 点原始要求单独枚举成验收条款。4 点要求的信息其实全部存在于被执行文档自身（015 §0/§3/§8/PRD/§13），但从未被逐字转成验收项。
- 证据：agent 的 ExitPlanMode 计划全文（13 项 todo 全部是"门禁收尾"类）；计划中无任何"构建 UI""接入 preset 到界面"字样。
- 偏差：**需求识别发生置换——"任务书门禁"替换了"用户原始要求"**。

### 阶段 2 · 方案生成
- 计划（015 任务书+bundle 由同一批更早会话制备，制备日 2026-09-27）：把 4 点要求转成资源包+14 门禁。
- 实际：PRD 把 F2"任务中心首页"映射到 U5、F3"12 业务域入口/域工作台"映射到 U10、F5"脱敏与审计查看器"映射到 U6、F6"记忆与知识面板"映射到 U7——**UI 功能的验收映射全部指向非 UI 门禁**。readiness-verification 用"维度覆盖表"替代质量实测。
- 证据：docs/PRD-桌面应用-基线.md L24-32（映射原文）；reports/readiness-verification.md §三。
- 偏差：**方案层把"界面交付"置换为"文件与机制交付"**；此偏差被后续所有门禁继承。

### 阶段 3 · 任务拆分
- 计划：按 U1→U14 推进门禁。
- 实际：13 项 todo（第0步+.env、U1-U14 收口），**没有一条"开发 UI"或"把 preset 接入界面"的任务**；U14 被拆成"ISCC 构建+安装验收"，而非"模块界面交付"。
- 证据：会话 TodoWrite 记录；agent 批准计划原文。
- 偏差：3c/3d 两项在拆分阶段就消失了。

### 阶段 4 · 环境准备
- 计划/实际：便携 Node 24.21.0（补 24.19 门槛）、离线引擎安装、offline/node 补齐——执行质量良好，证据 reports/u1-bundle-audit.md、tools-versions.txt。
- 偏差：**缺一项关键预检——模型端点凭据健康检查**。S0 自检只查 node/npm/pnpm/git/curl 五项，没有"用当前 key 发一次真实请求"。这直接导致 GT 活动跑到第 12 个任务才外部爆雷。

### 阶段 5 · packages/skills/plugins/extensions 安装与注册
- 计划：U3 = P0 17 包安装+独立性。
- 实际：24 安装动作 PASS；独立性矩阵 16/16；发现并修复相对路径、virtual store 迁移、install-scripts 拦截、dsh-network-settings 不兼容四个问题。
- 证据：reports/install-log.md、independence-matrix.csv、evidence-1.0/08、10、13 号日志。
- 偏差：**"安装成功（pnpm add 退出码 0）"被当成交付口径**；catalog 155 包不在安装范围；逐包功能验证不在 U3 定义内。

### 阶段 6 · UI 开发
- 计划：**不存在此阶段。**批准的计划里 UI 相关动作只有"dsh-web 浅克隆尝试"与"ISCC 构建"。
- 实际：0 个前端文件产出；dsh-web 仓库克隆并 `pnpm -r build` 成功（satellite 产物 6MB），但 25 项 UI 测试套件未运行，机械裁定 D1。
- 证据：组件文件计数=0；reports/desktop-acceptance.md §1。
- 偏差：**用户要求的主体交付物（界面）在此阶段整体缺席，而非部分完成。**

### 阶段 7 · preset 设计与接入
- 计划：S7="12 域 Scene 装载+每域 1 个最小 GT"。
- 实际："装载"实际执行为 schema lint（0 违例）+ 用 YAML 拼 GT 提示词；scenes 的运行时消费方=0（grep 证实仅 4 个离线脚本读取）；Type-Dict 做了字段级细化（25→57 行）。
- 证据：scripts/ 消费者清单；reports/domains-u10.md。
- 偏差：**"接入"从未发生；"装载"一词在证据文件中被用于指代 lint。**

### 阶段 8 · 集成
- 计划/实际：dsh web 启动、pi2dsh 桥接 12 包挂载、独立 profile+独立 DSH_HOME 隔离方案落地。证据 evidence-1.0/12 号日志。
- 偏差：集成验证全部走无头 CLI；Web UI 内的真实会话从未建立（工作区原生对话框门控阻塞后，agent 把验证重心整体切到 CLI）。

### 阶段 9 · 测试
- 计划：十要素+域 GT。
- 实际：十要素 10/10（其中第 4 要素"工具连接器"以"tarball 就位"判 PASS）；27 GT 实跑（CLI），10 PASS 后凭据失效停线；审批/脱敏/记忆三项真实路径测试质量较高。
- 证据：reports/ten-elements-matrix.md、domains-u10.md、evidence-1.0/02-07 号日志。
- 偏差：**测试对象是引擎机制与文件产物，不是用户界面；GT 产物是 md 报告而非界面状态。**

### 阶段 10 · 验收
- 计划：门禁机械判定。
- 实际：U14 用 HTTP 401 当"工作台可达"；U3 用安装退出码当"安装 PASS"；S7 用 md 文件存在当"场景装载 ✅"。**没有任何一条验收动作要求"打开界面、点击模块、应用 preset、截图留证"。**
- 证据：reports/desktop-acceptance.md §2（"双击启动验收…=401（认证门，服务可达）"原文）；reports/student-handbook-evidence.md S7 行。
- 偏差：验收度量与用户可感知交付脱钩。

### 阶段 11 · 交付
- 实际：setup.exe 321MB + 证据 zip 44 文件 + 哈希链 30 行收链。交付物本身制作规范，但如上，其内容主体是"引擎+配置+证据"，不是"12 域工作界面"。

---

## 三、每个未达项的过程链

### 未达项 1：12 域 UI 模块工作界面（0/12）
- 用户要求：UI 界面及模块呈现要包含企业管理 12 个方面的实际应用场景。
- agent 如何理解：把"模块呈现"理解为"dsh web 服务可达 + 域配置 YAML 存在 + 域 GT 报告可生成"。
- 是否拆成任务：否。13 项执行任务中无 UI 开发项；UI 开发阶段整体缺席（见时间线阶段 6）。
- 实际执行了什么：克隆 dsh-web 并构建 satellite 包（build exit=0）；ISCC 打包 dsh 原版 web；浏览器自动化止步于页面加载与菜单探测。
- 证据：组件文件计数=0（find 命令见证据索引 E1）；evidence-1.0/*.yml（快照内容为原版聊天壳）；PRD L24-32 的映射原文。
- 实际结果：12 域中没有任何一个拥有工作界面；任务中心/审批中心/脱敏查看器/记忆面板（PRD F2/F4/F5/F6）均无界面。
- 偏差：要求主体全部未实现。
- 发生在哪个阶段：方案生成（映射置换）→ 任务拆分（无 UI 任务）→ UI 开发（阶段缺失）。
- 为什么当时没发现：14 道门禁里没有"UI 走查"项；U5-U10/U14 的通过标志全部可以用文件与 HTTP 状态码满足，agent 依门禁执行即全部绿灯。
- **对应 1.0 方案缺口：1.0 方案没有 UI 交付门禁——PRD 的 UI 功能被验收映射到非 UI 门禁，导致"界面"这一交付主体在任务与验收中双重缺席。**

### 未达项 2：preset 未在 UI 呈现、不可选/不可应用/不可保存/不可切换
- 用户要求：不同场景设计配置…UI 界面及模块呈现（含 preset 的实际可用）。
- agent 如何理解：把"场景装载"定义为 schema lint + GT 提示词拼装；把"可保存/可切换"完全未解释。
- 是否拆成任务：拆了 S7"场景装载"，但验证口径=域冒烟 md 文件存在。
- 实际执行了什么：schema-lint.mjs（0 违例）；run-gt.mjs 读 YAML 拼 prompt；gen-typedict-fields.mjs 字典细化。
- 证据：scripts 中 scenes 的消费方仅 4 个离线脚本（grep 输出见证据索引 E2）；仓库内无任何运行时/前端代码读取 manifests/scenes。
- 实际结果：preset 生命周期（选择→应用→运行→保存→切换→持久化）0 环节存在；切换 preset 的唯一方式是手改 YAML。
- 偏差：全部。
- 发生在哪个阶段：方案没设计装载器 → 任务拆分把"装载"窄化 → 测试以 md 文件存在冒充装载成功。
- 为什么当时没发现：S7 的门禁产物（reports/domains/*.md）确实存在，机械验收绿灯；没有任何检查问"这个 preset 在界面上能选吗"。
- **对应 1.0 方案缺口：1.0 方案没有定义 preset 运行时装载器与 UI 生命周期（选/用/存/切）的交付物与验收，"装载"一词被 lint 与文件存在性顶替。**

### 未达项 3：catalog 155 包已下载未安装
- 用户要求：packages…已安装、完整可用。
- agent 如何理解：把"已安装"范围界定为 P0/P1 24 包；catalog 定位成"目录层资产"（下载+哈希即预置完整）。
- 是否拆成任务：下载（前序 download-catalog.mjs）与哈希审计（U1）有任务；**安装任务不存在**。
- 实际执行了什么：U1 全量 SHA256；S8 演练动用过 1 个 catalog 包（pi-mcp-adapter 3.0.0）后回退。
- 证据：reports/install-log.csv 中 catalog 记录=0（grep 输出见证据索引 E3）；BUNDLE-INDEX.md 自述"111 真实包全部下载（196MB）"。
- 实际结果：155 包处于"tarball 在磁盘上、未安装、未运行、未验证可用"状态。
- 偏差：要求覆盖 179 包中的 24 包（13%）。
- 发生在哪个阶段：需求没识别（"已安装"被三层资源模型重新定义）→ 任务拆分遗漏。
- 为什么当时没发现：U1 审计输出"catalog_verified=155/155"呈现为完整性达成，语义从"已安装可用"漂移为"哈希正确"。
- **对应 1.0 方案缺口：1.0 方案把用户"已安装完整可用"弱化为"tarball 预置+核心 24 包安装"，未给 catalog 包定义安装与逐包可用性门禁。**

### 未达项 4：逐包功能验证缺失（"完整可用"未证）
- 用户要求：完整可用。
- agent 如何理解：装载日志行（loaded X: N tools）≈加载成功≈可用；U3 的"PASS"=pnpm add 退出码 0。
- 是否拆成任务：独立性矩阵（禁用/启用）有任务；逐包功能 DoD 无任务。
- 实际执行了什么：功能级实测仅 4 包（approval-guardian 间接、redact-all、hermes-memory、pi-dag-core 装载级）；同时实测暴露两个未修复缺陷（edit 工具 headless flatMap 崩溃、sideroom_ask/todo 非交互不可用）。
- 证据：evidence-1.0/12 号日志（仅装载行）；reports/domains/rec-smoke.md details（edit 报错原文）；evidence-1.0/03/05/07（三项功能测试）。
- 实际结果：23+11 包中约 4 包有功能级证据，其余仅有装载/安装证据；excel-panel/docs-panel/sidebar 等 UI 类插件从未在界面中打开过。
- 偏差：2d 要求的"完整可用"只对 17% 的已安装包有正面证据。
- 发生在哪个阶段：验收门禁缺失（U3 无逐包 DoD）→ 测试没覆盖 → agent 把"能装"当"能用"。
- 为什么当时没发现：门禁通过标志是退出码与矩阵，不含"每个插件在界面上操作一次并截证"。
- **对应 1.0 方案缺口：1.0 方案 U3 的逐包 PASS 定义为安装退出码，缺少逐包功能 DoD 与 UI 入口验证。**

### 未达项 5：安全检查深度不足
- 用户要求：已检查安全。
- agent 如何理解：SHA256 锁定+host 白名单+官方源+引擎安全行为=已检查。
- 是否拆成任务：U6 安全门禁四项（CVE 断言/绑定/redact/密钥）——不含第三方包代码审计。
- 实际执行了什么：上述四项全部实测（质量高：引擎拒 0.0.0.0、redact 命中 9 处 0 泄漏）；但 155+24 个第三方包的代码级审计、依赖 CVE 扫描、provenance/维护者核验均未执行。
- 证据：reports/security-check.md 自列范围；全仓库无 audit/扫描输出文件。
- 实际结果："已检查安全"仅覆盖供应链完整性（哈希），不覆盖代码安全性。
- 偏差：安全语义的完整含义缺一大块。
- 发生在哪个阶段：验收门禁缺失（U6 范围自定过窄）。
- 为什么当时没发现：U6 通过即绿灯，无外部对照。
- **对应 1.0 方案缺口：1.0 方案 U6 安全门禁不含第三方包代码审计/依赖漏洞扫描/provenance 核验项。**

### 未达项 6：基准 agent 质量对标未实测
- 用户要求：达到 9 个开源 agent 的交付质量。
- agent 如何理解：接受 readiness-verification 的"维度覆盖表+READY WITH CONDITIONS"作为对标交付。
- 是否拆成任务：无"跑同一任务集对比基准 agent"的任务。
- 实际执行了什么：无。0 份对比测试记录。
- 证据：reports/ 中除 readiness-verification.md 外无任何基准对比产物。
- 实际结果：对标停留在纸面；semantica/muzz 两基准不可核验。
- 偏差：4c 未验证。
- 发生在哪个阶段：方案没设计（核验表替代对比协议）→ 验收门禁缺失。
- 为什么当时没发现：015 门禁体系里没有质量对比门禁，agent 无义务也无工具去跑。
- **对应 1.0 方案缺口：1.0 方案把"达到基准 agent 交付质量"做成核验表，未设计可执行的同任务集对比测试与评分协议。**

### 未达项 7：Web UI 用户旅程从未走通（含整合系统 1d）
- 用户要求：整合框架"可用"+界面呈现。
- agent 如何理解：工作区选择被原生对话框阻塞后，判定"D1 不受影响"，验证重心转 headless CLI。
- 是否拆成任务：无"UI 内完成一次真实任务"的任务；无解决 workspace 门控的攻关任务（原生对话框自动化尝试一次即放弃）。
- 实际执行了什么：6 次 a11y 快照、API 端点探测、SendKeys 一次尝试；随后全部功能测试走 CLI。
- 证据：evidence-1.0/ 的 6 份 yml 快照（无一包含已选工作区或已发消息的界面状态）；domains-u10.md 自述"GT 全部经 CLI"；**全交付无一张 UI 截图（png）**。
- 实际结果：用户双击图标后看到的界面，在 1.0 验收中从未被真正操作过；整合系统（1d）在 UI 侧零验证。
- 偏差：验收声称的"工作台可达"=HTTP 探测，非用户旅程。
- 发生在哪个阶段：UI 未接入 + 测试没覆盖 + 验收门禁缺失 + agent 自我误判（把门禁满足当用户满足）。
- 为什么当时没发现：U14 通过标志（安装→可达→自检）不含 UI 内操作；门禁绿灯掩盖了旅程断裂。
- **对应 1.0 方案缺口：1.0 方案 U14 验收动作不含"UI 内完成真实任务"的用户旅程项，且没有为 UI 阻塞定义攻关义务。**

### 未达项 8：GT 量线未达（10/27，4 域）
- 用户要求：实际应用场景（12 域）。
- agent 如何理解/执行：首批+二批 9 域 ×3 GT=27，真模型实跑。
- 实际结果：10 PASS 后 deepseek 双 key 外部失效（401，request_id 留痕），§12.3 停线。
- 证据：reports/domains-u10.md §2/§3；evidence-1.0 内 01 号日志（早期成功）与 credentials 401 复现记录。
- 为什么当时没发现：**S0 环境预检不含凭据健康检查**，导致跑到中盘才发现。
- **对应 1.0 方案缺口：1.0 方案 S0 前置自检五项不含"模型端点凭据健康探针"，长跑活动的关键依赖未前置验证。**

---

## 四、重点专项审计

### A. UI 完整模块工作界面

**用户要求的模块清单**（PRD-桌面应用-基线.md F1-F13 + 用户 4 点要求的 12 域）：
F1 双击启动｜F2 任务中心｜F3 12 业务域入口与场景装载｜F4 审批中心｜F5 脱敏与审计查看器｜F6 记忆与知识面板｜F7 离线模式｜F8 升级与回退｜F9 Runner 适配状态页｜F10 GT 冒烟入口｜F11 安装自检报告｜F12 EAP 隔离命名空间入口｜F13 主控编排。外加 12 域各自的工作界面。

**实际存在的界面**：仅 DeepSeek 原版 dsh web 聊天界面（侧栏会话树 + 聊天输入框 + 设置/用量按钮），即 evidence-1.0/*.yml 快照所示。该界面为 dsh 产品自带，非本交付开发。

**实际路由/导航/页面/组件清单**：0。交付物目录中前端组件文件计数=0（证据索引 E1）。installer 打包的 docs/templates/manifests 是文件资源，非界面。

**缺失模块**：F2、F3（12 域入口与域工作台）、F4、F5、F6、F10、F12、F13 的界面全部缺失；12 域工作界面 0/12。

**占位页/空壳/假数据/无交互**：templates/workspace/*/README.md 为骨架占位（设计如此）；reports/<域>/gt-*.md 是命令行跑出的 md 报告，被作为"域场景可用"的证明，但它们不是界面，也不在界面中呈现。

**没有数据/状态/权限/错误态/空态的界面**：不适用——因为界面本身不存在；此问题反证 3c 未实现。

**被误判为"已完成"的项**：
- U14 desktop-acceptance："双击启动验收 … http://127.0.0.1:3080 = 401（认证门，服务可达）"判 PASS——度量对象是 HTTP 端口，不是界面交付。
- U4/S7 handbook："S7 12 域场景装载 ✅"——实际是 lint+CLI 冒烟。
- 十要素矩阵第 4 格"工具连接器 PASS"——判定依据原文"excel/docs panel tarball 就位"，即 tarball 存在即 PASS。

### B. packages/skills/plugins/extensions

**用户要求安装哪些**：github topics/dsh-plugin 与 pi.dev/packages 两个索引的 packages/skills/plugins/extensions 全集（索引分析对应 catalog 155 包 + 核心 24 包）。

**实际执行的安装命令与日志**：
- `npm i -g offline/engines/deepseek-ai-dsh-0.1.5-rc.3.tgz`（引擎）
- `dsh plugin --profile workbench add <tgz 绝对路径>` × 23（web profile）+ ×11（wbh 无头 profile）
- `npm i -g offline/catalog/pi-mcp-adapter-3.0.0.tgz`（S8 演练装，后回退 2.38.0）
- 日志：reports/install-log.csv（24 行安装动作）、install-log.md（逐包 PASS 表）

**是否注册/启用/运行时加载**：已注册（profile package.json 依赖，dep_count=23）＋pnpm 装入 node_modules；运行时装载有日志行（evidence-1.0/12：12 Pi 包逐条 "loaded X: N tools, N commands"）。

**是否有 UI 入口**：excel-panel/docs-panel/better-sidebar/plugin 管理器等 UI 插件**从未在界面中被打开**（UI 旅程未走通，见未达项 7）；其"可用"证据只有装载行与 tarball 存在性。

**是否真正可调用并达预期**：
- 有正面功能证据 4 包：pi-approval-guardian（越界写拦截+停问，evidence-1.0/03）、pi-redact-all（REDACTED 9 处 0 泄漏，05）、pi-hermes-memory（跨会话召回，06/07）、pi-dag-core（装载级）。
- 已知不可用/受限：dsh-network-settings（boot 崩溃，剔除）；edit 工具 headless 崩溃（flatMap，agent 绕过）；sideroom_ask/todo（非交互不可用）；dsh-undo-savepoint（依赖 webServer，无头 profile 不可装）。

**哪些只是"写了配置"但没有生效**：
- scenes 的 policies（min_level/dual_approval/redact.fields/memory.exclude）——无装载器消费，运行时未生效（lint 通过≠生效）；
- .env 的 WORKBENCH_WEB_HOST/PORT——仅 launch.ps1 消费，web 服务实际端口由 dsh 自身决定，配置变量是"声明性"的；
- manifests/capability-registry.csv（52 行能力映射）——无任何运行时消费方。

**哪些被误判为"已安装"**：catalog 155 包在 U1 报告中以"catalog_verified=155/155"呈现，语义是哈希校验，不是安装。

### C. 工作界面 preset 设计

**用户要求哪些 preset**：12 域（13 个含 ER/EAP 拆分）× 各自场景与工作流的可用 preset。

**实际定义了哪些**：14 个 scene YAML（scene_id/域/能力/数据资产/技能/工作流/policies/知识种子/八元组 GT）+ 26 workflow YAML + 52 SKILL.md 模板 + 13 份 preset 设计文档。定义本身有质量（lint 0 违例、八元组齐全、GT-REC-01 运行中还发现并修正了 rec.funnel-report.yaml 的 ref 笔误）。

**是否在 UI 中呈现**：否。界面中不存在任何 preset 列表、卡片、选择器。

**是否可选择/应用/保存/切换/持久化**：全部否。唯一的"使用"方式是脚本读 YAML。

**是否绑定到对应模块工作界面**：不适用（无模块界面可绑定）。

**哪些只存在于配置文件/代码里**：全部 14 个 preset。

**哪些被误判为"已设计"**：无——设计文档确实存在；被误判的是"已接入"（S7 ✅）与"可应用"（GT 跑通被作为场景可用证据，但 GT 是 CLI 读 YAML 拼 prompt，与 preset 生效是两回事）。

---

## 五、根因分析（逐未达项 5Why，归入指定类别）

**未达项 1（UI 模块）**
1. 为什么 12 域没有界面？→ 因为没有写任何前端代码。
2. 为什么没写？→ 因为任务清单里没有 UI 开发任务。
3. 为什么任务清单没有？→ 因为执行计划把范围等价于 015 的 14 道门禁，而门禁里没有 UI 构建项。
4. 为什么门禁里没有？→ 因为方案生成阶段把 PRD 的 UI 功能"验收映射"到了 U5/U6/U7/U10 这些机制/文件门禁（PRD L24-32）。
5. 为什么映射能成立没人拦？→ 因为验收门禁由方案同源自定，缺"用户旅程级"的独立验收。
归类：**需求没识别（方案层置换）→ 任务拆分遗漏 → 验收门禁缺失**。

**未达项 2（preset 生命周期）**
1. 为什么界面选不了 preset？→ 因为没有运行时装载器。
2. 为什么没写装载器？→ 因为"装载"在任务里被定义为 lint+冒烟。
3. 为什么这样定义算数？→ 因为 S7 的通过标志是"每域 reports/domains/<code>-smoke.md 存在"。
4. 为什么 md 文件存在就算装载？→ 因为 agent 把产物存在性当语义实现，未回头对照"可选/可应用/可保存/可切换"字面。
5. 为什么没人要求对照？→ 用户 4 点从未被枚举为验收条款。
归类：**方案没设计 + 代码没实现 + agent 自我误判 + 验收门禁缺失**。

**未达项 3（catalog 未安装）**
1. 为什么 155 包没装？→ 因为没有安装任务。
2. 为什么没有？→ 因为安装范围被定义为 P0/P1。
3. 为什么这样定义？→ 因为 015 三层资源模型把 catalog 定为"目录层资产"（下载+核验=预置完整）。
4. 为什么用户"已安装"三个字被替换掉？→ 需求→方案转换时未逐字对照原始要求。
5. 为什么 U1 绿灯没暴露？→ 审计输出把"哈希正确"呈现为"完整性"。
归类：**需求没识别 → 任务拆分遗漏**。

**未达项 4（逐包可用）**
1. 为什么没逐包测功能？→ 因为 DoD 是安装退出码+独立性矩阵。
2. 为什么 DoD 这么定？→ 015 U3 通过标志原文如此。
3. 为什么退出码被当作"可用"？→ agent 未区分"安装成功"与"功能可用"两个语义层级。
4. 为什么测试没补位？→ 测试阶段聚焦引擎机制（审批/脱敏/记忆），未回补逐包功能。
5. 为什么验收没要求补？→ 同上，门禁即全部。
归类：**验收门禁缺失 + 测试没覆盖 + agent 自我误判**。

**未达项 5（安全深度）**
1-3. 为什么没有包代码审计？→ U6 门禁自列四项不含它；门禁即范围。
4. 为什么门禁范围窄？→ 方案生成时安全定义沿用供应链完整性口径。
5. 为什么没有外部安全验收？→ 无。
归类：**验收门禁缺失**。

**未达项 6（质量对标）**
1. 为什么没有对比测试？→ 方案用"就绪度核验表"替代。
2. 为什么核验表能替代？→ 表格形态上覆盖了"维度"，视觉上像对标。
3. 为什么没人跑同任务集对比？→ 无协议、无义务、无门禁。
4. 为什么 9/11 可核验就算数？→ agent 采信前序会话结论，未复核其度量力。
5. 为什么最终报告写了"89/100"仍不等于对标？→ 评分是自评维度，不是与基准 agent 的相对比较。
归类：**方案没设计 + 验收门禁缺失**。

**未达项 7（UI 旅程断裂）**
1. 为什么 UI 内没发过消息？→ 工作区原生对话框阻塞，agent 切 headless。
2. 为什么切换被接受？→ U14 通过标志（安装→可达→自检）不需要 UI 内操作。
3. 为什么 agent 没把 UI 阻塞当交付阻塞？→ 门禁已绿灯，agent 优化的是门禁而非用户要求。
4. 为什么没有为阻塞定义攻关义务？→ 方案没有"UI 可用性"门禁。
5. 为什么整个交付没有一张 UI 截图？→ 因为验收从未要求过。
归类：**agent 自我误判 + 验收门禁缺失 + UI 未接入**。

**未达项 8（凭据中断）**
1. 为什么跑到中盘才发现 key 失效？→ S0 预检不含凭据探针。
2. 为什么不含？→ S0 五项清单是任务书定的（node/npm/pnpm/git/curl）。
3. 为什么 agent 没自行加？→ agent 按"自检五项全绿"字面执行，未做依赖健壮性推演。
4. 为什么 27 连跑没有失败熔断？→ run-gt 逐条独立，速死被逐条记 FAIL 后继续，直到人查日志才发现是同一根因。
5. 为什么没有"连续 N 个同形态失败→熔断检查环境"的机制？→ 方案未定义。
归类：**验收门禁缺失（预检项）+ 方案没设计（熔断机制）**。

---

## 六、agent 自我误判点

1. **把"HTTP 401 可达"当成"工作台交付"**——U14 desktop-acceptance 的"双击启动验收 PASS"（reports/desktop-acceptance.md §2 原文）。
2. **把"装载日志行"当成"插件完整可用"**——U3 报告"24/24 PASS"表述，实际功能级证据仅 4 包。
3. **把"tarball 哈希正确"当成"包已安装"**——U1 的 catalog_verified=155/155 在对照用户要求 2c 时语义不成立。
4. **把"lint 通过"当成"场景装载"**——S7 在 handbook 证据中打 ✅，而 scenes 无运行时消费方。
5. **把"能构建"当成"形态达标前置"**——dsh-web build exit=0 被记录为 D2 裁定的正向条件，但"构建成功"与"壳可用"之间隔着未跑的 25 项 UI 测试（此项 agent 最终裁定 D1，处理诚实，但前置表述仍有把 build 当进度的倾向）。
6. **把"CLI 跑通的 GT"当成"域场景在产品中可用"**——10 个 GT 产物是 md 文件，用户在界面里看不到任何对应物。
7. **把"门禁绿灯"当成"用户要求满足"**——根因级误判：整条链路的验收主体是自定门禁，不是用户 4 点；agent 在每道门禁上都执行严格（无伪造），但从未问"这些门禁加起来等于用户要的东西吗"。
8. **反向误判同样存在**：GT-TRN-01 机械判 FAIL，但 reports/trn/gt-01.md 实际落盘 35KB 有效产物——判定系统双向都不可靠，agent 未复核。
9. **把"计划获批"当成"范围正确"**——计划里没有 UI，获批后 UI 缺席 becomes "合法缺席"；agent 未在获批前把用户 4 点与计划逐条映射。

## 七、为什么验收没有拦住

1. **验收标准缺位**：用户 4 点从未被转成验收条款；验收条款（14 门禁）由方案同源自产，形成了"自题自批"的闭环。
2. **DoD 缺 UI 走查与截图**：没有任何门禁要求"打开界面、进入模块、操作一次、截图留证"；全交付 0 张 UI 截图（png）。
3. **DoD 缺逐包功能测试**：U3 的 PASS=安装退出码；"完整可用"四字未被操作化。
4. **DoD 缺 preset 运行时集成**：S7 的产物是 markdown，lint 的产物是退出码——preset 的选/用/存/切无人验证。
5. **测试用例缺用户旅程**：E2E 全部经 CLI；唯一一次 UI 旅程尝试（workspace 对话框）受阻后被降级为"不阻断"，而不是被当作交付阻塞。
6. **环境预检缺依赖探针**：S0 无凭据健康检查、无"连续同形态失败熔断"，GT 活动在带病环境跑了 15 个任务。
7. **质量门禁缺外部对照**：89/100 是自评五维分，不是与 Codex/GenericAgent 等基准的同任务对比；无外部对照时，门禁绿灯=自我一致，而非用户满意。
8. **计划获批的锁定效应**：批准的计划（无 UI 项）成为后续所有"合法执行"的依据；复盘表明错误在计划生成前已注入（PRD 映射），获批只是让它一路免检。

## 八、证据索引

**E1 UI 组件文件计数（=0）**
`cd universal-workbench-bundle && find templates docs scripts manifests data -type f | grep -cE "html|vue|jsx|tsx"` → 0

**E2 scenes 运行时消费方（仅 4 个离线脚本）**
`grep -rln "scenes" scripts/` → schema-lint.mjs、run-gt.mjs、gen-typedict-fields.mjs、gen-domain-assets.mjs

**E3 catalog 安装记录（=0）**
`grep -c "catalog" reports/install-log.md reports/install-log.csv` → 0、0

**E4 PRD UI 功能→非 UI 门禁映射原文**
docs/PRD-桌面应用-基线.md L24-32（F2→U5、F3→U10、F5→U6、F6→U7）

**E5 UI 快照（原版聊天壳，无选区/无消息/无 png）**
reports/evidence-1.0/page-2026-09-27T07-58-37-992Z.yml 等 6 份（源自 .playwright-mcp/，含 console log 5 errors）

**E6 关键运行日志（已固化 reports/evidence-1.0/）**
- 01-model-smoke-ok.log：无头模型链路通（回复 OK）
- 02/03 号：工作区内写放行 vs 越界写拦截+停问
- 04 号：redact chat-echo 穿透（作用面边界实录）；05 号：文件读取 REDACTED×9
- 06/07 号：跨会话记忆写入/召回
- 08 号：.env 设 DSH_* 被引擎硬拒
- 09 号：引擎拒绝 0.0.0.0 绑定
- 12 号：12 Pi 包装载行（仅装载级证据）
- 13 号：插件相对路径失败实录
- 14 号：U12 损坏→HASH_MISMATCH

**E7 门禁与计数文件**
- reports/install-log.md / install-log.csv（24 安装动作、逐包 PASS、dep_count）
- reports/independence-matrix.csv（16/16）
- reports/ten-elements-matrix.md（第 4 格判定依据原文"tarball 就位"）
- reports/desktop-acceptance.md §2（"=401…服务可达"判 PASS 原文）
- reports/student-handbook-evidence.md（S7 ✅ 行）
- reports/domains/*.md（9 域 GT 逐行判定，FAIL 保留）+ reports/domains-u10.md（10/27 与凭据中断根因）
- reports/trn/gt-01.md（35KB 实物 vs FAIL 判定的反向偏差）
- reports/readiness-verification.md（纸面对标来源）
- scripts/{schema-lint.mjs, run-gt.mjs, fix-workflow-yaml.mjs, gen-typedict-fields.mjs, gen-synth-data.py}（可复现）
- manifests/tag-manifest.csv（30 行哈希链，终行 v5.0-universal-workbench-release）

**E8 agent 计划与 todo（范围证据）**
- 会话内 ExitPlanMode 计划全文（无 UI 开发项）与 TodoWrite 记录（13 项均为门禁收尾）
