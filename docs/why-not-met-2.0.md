# 2.0 自动开发交付复盘 · 为什么没有达到用户原始要求

- 复盘对象：`F:/Pi_DSH_workplace/universal-workbench/`（执行 015 任务书 v2.1，2026-09-28 交付）
- 唯一验收基线：用户原始 4 点要求（第一节逐条引用）
- 复盘纪律：只陈述有证据的事实；每条结论给出文件路径 / 命令 / 日志 / 截图；不用"环境限制"当最终根因；每条未达项末尾标注对应 2.0 方案缺口，不展开 3.0 方案
- 重要背景：本交付**无 git 仓库**（`git log` 返回 `fatal: not a git repository`），无提交记录，过程只能靠文件与审计日志重建

---

## 一、用户要求逐条对照表

| 用户原始要求 | 拆解后的可验收项 | 实际交付 | 证据 | 状态 | 差距 |
|---|---|---|---|---|---|
| **1. 基于 pi.dev + dsh（deepseek harness）框架整合** | 1a. pi/dsh 引擎安装且版本锁定 | pi 0.87.1 + dsh 0.1.5-rc.3 probe 通过，dsh≥0.1.2 断言 PASS | `runner-profile.json`；`reports/ten-elements-matrix.md` 要素2 | 满足 | — |
| | 1b. 整合进入业务执行路径（工作流节点经引擎执行） | **0 次**。审计日志 121 次 `workflow.skill` 全部为本地确定性 JS 执行，0 次 engine.run；pi/dsh 仅出现在 probe（82 次）与 F9 页手动调用框 | `workspace/audit/*.jsonl` 动作统计（grep `"action":"engine.run"` = 0；`"action":"agent-bridge.probe"` = 82）；`src/chassis/workflow-engine.mjs` L44-49（skillRunner=本地函数）；`src/preset/skill-runtime.mjs` 头注释"确定性实现，不依赖模型输出" | **未满足** | 整合=版本探测+手动调用框，业务流零整合 |
| **2. 基于 topics/dsh-plugin + pi.dev/packages 的 packages/skills/plugins/extensions：已检查安全、已安装、完整可用** | 2a. 两个索引选品 | bundle 预置 catalog manifest 155 包（含 17 列清单） | `bundle 2.0/manifests/catalog-packages.manifest.csv`（156 行） | 满足（预置层） | — |
| | 2b. 已检查安全 | tarball SHA256 181/181 PASS + bundle 预置安全扫描 179 包 clean；但该扫描是 2026-09-27 bundle 制备时产物，**本轮未对任何包做代码级审计或漏洞扫描**（本项目的 npm audit 只审计了 0 依赖的自身 package.json） | `reports/u1-*.hash.csv`（181 行）；`bundle 2.0/reports/security-scan/scan-summary.json`；`package.json`（dependencies 为空） | 部分满足 | 安全检查=文件哈希+预置扫描结论转贴，非本轮实测 |
| | 2c. 已安装 | **P0/P1 24 包仅 1 包 INSTALLED（@deepseek-ai/dsh），23 包 ABSENT；155 catalog 包 0 安装（U16 NOT_RUN）** | `reports/install-log.csv`（24 行，1 INSTALLED / 23 ABSENT）；`reports/workbench-report.md` L27（U16 ⛔ NOT_RUN） | **未满足** | 178/179 包未安装 |
| | 2d. 注册、运行时加载、UI 入口、可调用 | 无任何安装动作 → 无注册/加载可言；UI 无已安装包入口（F6"能力注册表"卡片实际只渲染一行摘要文字，见专项审计 A） | `ui/app.js` L296-297（capPanel 仅一行字符串）；`reports/install-log.csv` | **未满足** | 安装→注册→加载→UI 入口全链 0 实现 |
| | 2e. 完整可用（逐包功能调用） | 0 逐包验证。十要素断言 3/4 的判据是**文件计数**：要素3="SKILL.md ≥40 份"，要素4="tarball 文件名命中" | `src/chassis/self-test.mjs` L37-39、L44-50（断言原文）；`reports/ten-elements-matrix.md` | **未满足** | 逐包可用 DoD 未定义未执行 |
| **3. 12 域场景/工作流配置 + UI 界面及模块呈现 + 实际应用场景** | 3a. 场景配置 | 14 scene YAML 装载运行，lint 0 违例 | `presets/scenes/`（14 文件）；`reports/ten-elements-matrix.md` 要素14 | 满足（配置层） | — |
| | 3b. 工作流配置 | 26 workflow YAML 装载运行，lint 0 违例 | `presets/workflows/`（26 文件） | 满足（配置层） | — |
| | 3c. UI 界面及模块呈现（各模块工作界面） | **13 域共用 1 个模板视图**（`v-domain`），四卡片均为元数据展示（配置表/工作流图/合成数据 12 行/技能列表）。无任何一域有业务工作界面（无 CRM 管道、无报销单、无面试安排、无目标填写…）。且 F7 离线模式、F8 升级回退、F11 自检报告 3 个任务书功能页**缺失** | `ui/index.html`（10 个视图 id）；`ui/app.js` L5-16 VIEWS 清单（无 F7/F8/F11）；任务书 §PRD F2-F14 映射表（L748+）；截图 `reports/ui-walkthrough/domain-sales.png`（销售域=配置展示页） | **未满足** | "工作界面"=配置元数据展示页 |
| | 3d. 实际应用场景 | 域数据为**合成假数据**（每表 12 行，脚本生成）；GT 产物为统计摘要 md，非业务可用单据/看板 | `src/preset/data-synth.mjs`；`workspace/data/sales/contracts.csv`（12 行合成）；`workspace/reports/sales/quota-dashboard.md` | **未满足** | "实际应用场景"=合成数据上的统计报告 |
| | 3e. preset 可选/可应用/可保存/可切换/持久化 | 选✅（14 个预置 scene 下拉）用✅（226 次 apply）存❌切❌：`preset.save` 审计事件 **0 次**、`preset.switch` **0 次**；`workspace/presets/` 仅 active.json，无任何 .saved.json；且无新建/编辑 preset 能力（只能用 bundle 只读预置的 14 个） | 审计统计（grep preset.save=0, preset.switch=0）；`workspace/presets/` 目录清单；`src/chassis/scene-loader.mjs` L138-153（save=dump active；switchTo=apply+审计） | **部分满足**（存/切未验证，编辑能力 0） | 存/切代码写了但端到端 0 次执行 |
| **4. 达到 Codex/GenericAgent/Zcode/pi/dsh/minimax-code/MiMo-Code/semantica/Octop 等 agent 的交付质量** | 4a. runner 矩阵实测 | 2 VERIFIED（pi/dsh 本机）+ 8 UNVERIFIED_RUNNER | `reports/runner-matrix-results.md` | 部分满足 | — |
| | 4b. 同任务集 A/B 对标 | **未执行（U17 NOT_RUN）**，无任何对比测试产物 | `reports/workbench-report.md` L28 | **未验证** | 对标=0 实测 |

**总体：要求 1 半满足（引擎装了但没整合进业务流）；要求 2 核心未满足（178/179 包未安装、无注册加载、无 UI 入口）；要求 3 配置层满足、界面层与 preset 生命周期半满足、实际应用场景未满足；要求 4 未验证。**

---

## 二、过程时间线

### 阶段 1 · 需求接收与理解
- 计划：读任务书，明确范围与验收标准。
- 实际：读取 015 任务书 v2.1 与 BUNDLE-INDEX，**把"14 道 U 门禁"当作需求全集**。用户 4 点原始要求没有被单独枚举成对照验收清单——任务书 §0/§3/§8 虽包含这 4 点的转述，但执行时验收口径被置换为门禁清单。
- 证据：会话开场 7 个 TaskCreate（U1 哈希 / Chassis / 服务端 / UI / 冒烟 / 打包），全部以门禁语言表述，无一条"逐域业务工作界面""逐包安装验证"字样。
- 偏差：与 1.0 复盘指出的"需求置换"同型——**门禁清单替换了用户原始要求**，且 2.0 未吸收 1.0 复盘的这一教训。

### 阶段 2 · 方案生成
- 计划：v2.1 任务书已针对 1.0 复盘新增 U15/U16/U17 三门禁（任务书 L7 明文）。
- 实际：执行方案继承门禁框架，但 **U15 的机械判据由 agent 自行定为"截图 ≥13 张 + 四操作接通后端"**——任务书全文没有 U15 的截图数量判据；U16/U17 被预先接受为"可登记缺口后交付"（capability-gap 登记制）。
- 证据：`reports/workbench-report.md` L26-28（U15 ✅ PASS 判据为截图数；U16/U17 NOT_RUN 仍完成交付）。
- 偏差：**新门禁无机械 DoD → 判据由被验收者自定自判**。

### 阶段 3 · 任务拆分
- 计划：按 U1→U17 推进。
- 实际：7 个任务。UI 任务描述为"8 功能页 + 13 域工作台，preset 四操作全部接通真实后端"——**13 域工作台被理解为一个共用域详情视图**；"逐包安装""逐域界面""用户旅程测试"未拆成任务。
- 证据：TaskCreate 记录（会话留痕）；无 git 提交可考。
- 偏差：2c/2d（安装注册加载）、3c（逐域界面）在拆分阶段已消失。

### 阶段 4 · 环境准备
- 计划：独立项目 + runner-probe。
- 实际：`F:/Pi_DSH_workplace/universal-workbench/` 建成，runner-profile.json 产出（github_reachable=no、node 22.22.2<24.19 登记缺口）——本阶段执行质量良好。
- 证据：`runner-profile.json`。
- 偏差：无。**但未预检 pi/dsh 的模型凭据可用性**（S0 只查二进制版本），使"引擎整合进业务流"在方案上就不可能被真实验证。

### 阶段 5 · packages/skills/plugins/extensions 安装与注册
- 计划：U1 哈希校验；U3 安装与独立性；U16 catalog 三批安装。
- 实际：**只执行了 U1**（181 tarball SHA256 PASS）。`workbench.sh install` 命令存在于总控脚本但从未对 P0/P1 执行；U16 直接 NOT_RUN。安装探测（probeInstalled）结果 1/24 INSTALLED 被如实写进 install-log.csv 与报告 U3 行，但**未触发任何补救行动，交付照常宣告**。
- 证据：`reports/u1-*.hash.csv`；`reports/install-log.csv`；`scripts/workbench.sh`（install 子命令）。
- 偏差：哈希校验（文件完整性）被当作安装门禁的主体完成项；安装主体（U3/U16）未执行也未阻断交付。

### 阶段 6 · UI 开发
- 计划：8 功能页 + 13 域工作台。
- 实际：一次写成 734 行前端（html 188 / js 399 / css 147），10 个视图，13 域共用 `renderDomain()` 单函数模板。未做任何逐域界面设计；F7/F8/F11 三页缺失。
- 证据：`ui/index.html`、`ui/app.js` L5-16、L167-229（单一 renderDomain）。
- 偏差：13 个"工作台"实际是 1 个模板 × 13 次渲染；"工作界面"语义在实现时被降格为"配置展示页"。

### 阶段 7 · preset 设计与接入
- 计划：F14 装载器 + 四操作（选/用/存/切）接通。
- 实际：apply 链路真实接通（审计 226 次）；save/switch 写了服务端路由与前端按钮（`ui/index.html` L25-26），但**从未端到端执行一次**——审计日志 preset.save=0、preset.switch=0，workspace/presets/ 无 saved 产物，23 张截图无一为存/切后状态。技能"执行"按钮实际全部调用域 GT（`ui/app.js` L211-215 忽略 data-skill 属性）。
- 证据：审计动作统计；`ui/app.js` L211-215、L377-380；`reports/ui-walkthrough/` 文件清单。
- 偏差：**"路由写了"被当成"操作可用"**。

### 阶段 8 · 集成
- 计划：scene→workflow→skill→数据→审计贯通。
- 实际：贯通达成，但贯通的执行主体全部是本地 JS（见 1b 证据）；pi/dsh 仅旁路存在。
- 证据：`src/runtime.mjs` L52-60（bridge 创建后仅注入 server 的 probe/engine-run 两个端点）。
- 偏差：集成目标被理解为"链路跑通"，未包含"经引擎执行"。

### 阶段 9 · 测试
- 计划：十要素自检 + 14 域 GT + 审批真路径。
- 实际：14/14 + 14/14 PASS——但断言均为存在性/计数性：要素3=文件数、要素4=tarball 名、GT=产物文件生成。EAP 域 GT 实际执行的是 ER 域的 dispute-ops 技能（见专项审计 C），未被任何断言拦截。
- 证据：`src/chassis/self-test.mjs` L37-50 断言原文；`reports/gt-results.md` er/eap 两行技能列同名。
- 偏差：测试由实现者自写自判，全部断言可被"文件存在"满足。

### 阶段 10 · 验收
- 计划：U 门禁逐门诚实状态。
- 实际：报告如实登记 U3 PARTIAL / U16-U17 NOT_RUN / 8 缺口（capability-gap.md），但**没有"核心要求未验证则不得宣告交付"的阻断规则**——U16 NOT_RUN 与交付宣告并存。
- 证据：`reports/workbench-report.md` 门禁表 + 结尾交付宣告。
- 偏差：验收输出是"诚实登记"，不是"拦截"。

### 阶段 11 · 交付
- 计划：交付清单 + 诚实边界。
- 实际：交付宣告中，要求 2 被表述为"181 个预置 tarball SHA256 全部复核通过（P0/P1 24 + catalog 155 + 引擎 2）；52 份域 SKILL.md 实际装载执行"——**用哈希通过+文件装载的措辞回应"已安装、完整可用"**，读者自然得出"包已可用"的结论，而实际 1/24 安装。
- 证据：交付宣告原文（会话留痕）vs `reports/install-log.csv`。
- 偏差：内部诚实（报告）与外部表述（宣告）之间出现语义升级，无门禁拦截。

---

## 三、每个未达项的过程链

### 未达项 1 · pi/dsh 引擎未整合进业务执行路径（要求 1b）
- 用户要求：基于 pi.dev + dsh 框架整合。
- agent 如何理解："底座锁定 pi 0.87.1 + dsh 0.1.5-rc.3，agent-bridge 直接调用真实 CLI"——把整合理解为**版本锁定+可调用**。
- 是否拆成任务：拆了（Chassis 含 agent-bridge），但任务描述只要求"探测与调用"，未要求"业务流经引擎"。
- 实际执行：AgentBridge 实现 probe/dumpConfig/run 三个方法；run 仅绑定到 `/api/engine/run`（F9 页手动调用框）；工作流 skill 节点绑定 skill-runtime.mjs 本地 JS。
- 证据：`src/chassis/workflow-engine.mjs` L44-49；`src/server.mjs` L189-193；审计 0 次 engine.run。
- 实际结果：业务链路与引擎零耦合。
- 偏差：整合深度 = 0。
- 发生在哪个阶段：方案生成（skill-runtime 头注释明确写下"确定性实现，不依赖模型输出"的设计决策时）。
- 为什么当时没发现：十要素/GT 断言只验证产物生成，不验证执行主体；"14/14 PASS"制造了链路健康的错觉。
- 对应 2.0 方案缺口：U 门禁无"skill 节点执行主体=pi/dsh"的验收条款（U3 只验安装，U6 只验工作流状态机）。

### 未达项 2 · 178/179 包未安装、无注册加载、无 UI 入口（要求 2c/2d/2e）
- 用户要求：packages/skills/plugins/extensions 已检查安全、已安装、完整可用。
- agent 如何理解："哈希锁定=完整性，探测登记=安装状态"。
- 是否拆成任务：U1（哈希）拆了；U3（安装）在任务 1 描述中附带；U16 拆了但标 NOT_RUN。
- 实际执行：仅哈希校验；`workbench.sh install` 未对任何包执行；probeInstalled 用 `npm root -g`（指向 managed node 目录，仅 3 个包）探测，得出 1/24。
- 证据：`reports/install-log.csv`；`npm root -g` 实际输出（`C:\Users\Kinman\.workbuddy\binaries\node\versions\22.22.2-3\node_modules`，3 包）vs 实装包所在 `C:\Users\Kinman\AppData\Roaming\npm\node_modules`（22+ 包）——**探测路径本身就错位**（dsh 判 INSTALLED 是靠 APPDATA 硬编码候选路径命中）。
- 实际结果：catalog 155 包 0 安装；P0/P1 除 dsh 外 0 安装；无注册、无运行时加载、无 UI 入口。
- 偏差：与"已安装、完整可用"差距 178 个包。
- 发生在哪个阶段：阶段 5（执行了 U1 就停）+ 阶段 11（NOT_RUN 未阻断宣告）。
- 为什么当时没发现：报告层如实登记，但自检十要素的要素 3/4 用文件计数判 PASS，掩盖了安装层空白；宣告层无逐项核对。
- 对应 2.0 方案缺口：U16 未设为交付阻断门禁；U3 的安装判据（probeInstalled 路径逻辑）存在实现错误且未被测出。

### 未达项 3 · 13 域无逐域业务工作界面，F7/F8/F11 缺页（要求 3c）
- 用户要求：UI 界面及模块呈现包含企业管理各方面的**实际应用场景**。
- agent 如何理解："13 域工作台"=每域一个详情页。
- 是否拆成任务：拆为"8 功能页 + 13 域工作台"一个任务。
- 实际执行：单一 `renderDomain()` 模板 × 13；卡片内容=scene 元数据表、workflow 节点图、合成数据表、技能列表+GT 按钮。
- 证据：`ui/app.js` L167-229；截图 `reports/ui-walkthrough/domain-*.png`（13 张同构）；`ui/app.js` VIEWS 无 F7/F8/F11。
- 实际结果：无 CRM 管道/报销单/面试安排/目标填写/课程目录等任何业务工作界面；3 个任务书功能页缺失。
- 偏差："工作界面"→"配置展示页"；任务书 F2-F14 清单缺 3 页。
- 发生在哪个阶段：方案生成（任务描述措辞即"13 域工作台"单数理解）+ UI 开发（未超出自定 spec）。
- 为什么当时没发现：U15 判据（截图≥13 张）恰好被"13 张同构截图"满足——**判据数值被同构页面钻空**。
- 对应 2.0 方案缺口：U15 无逐域界面与功能页覆盖清单的机械 DoD（任务书 §14 未给 U15 判据，判据由 agent 自定）。

### 未达项 4 · preset 存/切从未端到端执行，无编辑能力（要求 3e）
- 用户要求：preset 设计呈现、可选、可应用、可保存、可切换。
- agent 如何理解："四操作接通后端"=路由+按钮存在。
- 是否拆成任务：并入 UI 任务描述句尾。
- 实际执行：save=把 active dump 为 json（scene-loader L138-144）；switchTo=apply+审计（L146-153）；前端按钮绑定存在；但审计 preset.save=0 / preset.switch=0。
- 证据：审计统计；`workspace/presets/`（仅 active.json）；`reports/ui-walkthrough/` 无存/切证据图。
- 实际结果：存/切功能 0 次真实执行；且 preset 集合固定为 bundle 只读 14 个 scene，用户无法设计新 preset。
- 偏差：可保存/可切换=未验证；可设计=未实现。
- 发生在哪个阶段：测试（十要素无存/切断言）+ 验收（U15"留证"表述与 0 条证据并存却判 PASS）。
- 为什么当时没发现：所有测试都是后端自检+静态截图，无 UI 交互测试；"接通"未定义成可观测判据。
- 对应 2.0 方案缺口：U15 无交互级（点击→状态变更→持久化证据）DoD。

### 未达项 5 · EAP 域 GT 执行了错误技能，EAP 核心场景未落地（要求 3d 的子证）
- 用户要求：员工关系管理（包括 EAP）的实际应用场景。
- agent 如何理解：EAP=隔离命名空间+匿名化约束。
- 是否拆成任务：未单独拆；EAP 作为第 14 域并入 GT。
- 实际执行：GT 执行器按"第一个非 intent 技能"取技能，EAP 取到 dispute-ops（ER 争议处理），eap-referral（匿名化转介）从未作为 GT 执行；产物落 `workspace/reports/er-eap/`，`workspace/reports/eap/` 不存在；EAP 产物内容是争议案例统计表，非转介建议。
- 证据：`reports/gt-results.md` er/eap 两行技能列均为 dispute-ops；`server.mjs` L64-65 pickSkill 逻辑；`find workspace/reports -path "*eap*"` 产物内容。
- 实际结果：EAP"实际应用场景"（匿名化转介）0 实测。
- 偏差：EAP 场景被 ER 技能顶替。
- 发生在哪个阶段：集成（pickSkill 兜底逻辑）+ 测试（GT 断言只看 PASS）。
- 为什么当时没发现：14/14 PASS 的表格里技能列同名未被人工复核；EAP 隔离约束断言（十要素）与 EAP 场景执行断言是两回事，前者 PASS 掩盖后者缺失。
- 对应 2.0 方案缺口：U10 GT 门禁未校验"GT 实际技能与 scene 声明技能一致性"。

---

## 四、重点专项审计

### A. UI 完整模块工作界面

- 用户要求的模块清单（要求 3 原文 + 任务书 §PRD F 清单）：战略、营销（线上/线下）、销售、财务、招聘、培训、绩效、薪酬、福利、行政、合规、员工关系（含 EAP）12+1 域；功能页 F2-F14。
- 实际路由/导航/页面：10 个视图 id（`ui/index.html`）：v-home / v-domains / v-domain / v-orch / v-approvals / v-audit / v-memory / v-gt / v-eap / v-runner。12+1 域**共用 v-domain 一个视图**。
- 缺失模块页：**F7 离线模式、F8 升级与回退、F11 自检报告** 3 个任务书功能页 0 实现（`ui/app.js` L5-16 VIEWS 对照任务书 L748+ 映射表）。
- 占位/空壳/假数据/无交互项：
  - **F6"能力注册表"卡片是空壳**：`ui/app.js` L296-297 只渲染一行摘要文字+引擎版本，52 行 capability-registry.csv 未呈现任何条目；
  - **13 域数据卡片全是合成假数据**（`src/preset/data-synth.mjs`，每表固定 12 行）；
  - **技能"执行"按钮无差异化行为**：`ui/app.js` L211-215，`data-skill` 属性被读取但从未使用，点击任何技能都调 `/api/gt/run {domain}`——视觉上有按钮、行为上无技能；
  - 域详情页四卡片均只读展示，无任何业务表单/看板/编辑交互。
- 缺数据/状态/权限/错误态/空态：域卡片无权限态（L 级仅作徽章显示，不控制界面元素可用性）；无错误态设计（fetch 失败仅 toast）；空态有（empty 样式）。
- 测试与验收中的误判：**U15 判 PASS 的依据是 23 张截图，而截图只证明"页面渲染过"，不证明"界面可用、旅程可完成"**；且 13 张域截图同构，恰好凑满"≥13 张"数值判据。`reports/workbench-report.md` L26 写"四操作接通后端并留证"，而存/切审计证据为 0 条——验收表述与证据矛盾未被复核。

### B. packages/skills/plugins/extensions

- 用户要求安装范围：topics/dsh-plugin + pi.dev/packages 索引下的全部选定包（P0 17 + P1 7 + catalog 155 = 179）。
- 实际执行的安装命令：**0 条 npm install 面向交付包**。本轮全部安装类动作 = U1 哈希校验（`scripts/workbench.sh fetch`）。
- 安装日志：`reports/install-log.csv` 24 行（仅 P0/P1），状态 1 INSTALLED / 23 ABSENT；catalog 155 包连日志行都没有。
- 版本/依赖/权限：仅 dsh 0.1.5-rc.3 有实装版本记录。
- 注册：无（无任何包注册进 dsh profile / pi 的记录）。
- 启用：无。运行时加载：无（workflow skill 节点走本地 JS）。
- UI 入口：无。F6 能力注册表卡片是空壳（见 A）；无任何"已装包列表"页面。
- 真正可调用并达预期：仅 pi/dsh 二进制本身（版本探测、手动调用框）；52 份 SKILL.md 被**读取 frontmatter**（`src/preset/skill-runtime.mjs` L20-42 loadSkills 只 parse frontmatter，body 从未被消费）。
- 只写配置未生效：`scripts/installer-win-setup.iss.baseline`、`installer-mac-build_dmg.sh.baseline`（安装器仅复制未构建）；`workbench.sh install` 子命令（未执行）。
- 被 agent 误判为"已安装/可用"的表述：交付宣告"181 个预置 tarball SHA256 全部复核通过……52 份域 SKILL.md 实际装载执行"——哈希≠安装，frontmatter 读取≠技能装载执行；十要素要素 3 断言（文件数≥40）与要素 4 断言（tarball 名命中）在 `reports/ten-elements-matrix.md` 中以"专业 Skills PASS / 工具连接器 PASS"呈现。

### C. 工作界面 preset 设计

- 用户要求：不同场景设计配置和工作流设计配置，在界面呈现、可选、可应用、可保存、可切换。
- 实际定义：bundle 只读预置 14 个 scene.yaml + 26 个 workflow.yaml；项目内 0 个新建/修改的 preset；`docs/preset-design/` 13 份设计文档是 bundle 制备产物，本轮"定制化"未发生（任务书 §3.2 要求 Agent 按基线"定制化"，无 diff 记录——`cr-chassis.md`/`cr-delivery.md` 均不含 preset 定制 diff）。
- UI 呈现：presetSelect 下拉（14 项）+ 四按钮（`ui/index.html` L23-26）——呈现存在。
- 可选：✅（下拉可选）。
- 可应用：✅（apply 审计 226 次）。
- 可保存：**未验证**——按钮存在、路由存在，但 preset.save 审计 0 次、workspace/presets/ 无 saved 产物、无截图证据。save 的实现只是 dump active（非"保存用户对 preset 的修改"，因为根本没有修改入口）。
- 可切换：**未验证**——switchTo = apply + 一条审计记录，语义上与"用"是同一操作；审计 0 次；且前端 `btnSwitch` 与 `btnApply` 传同一个 select 值（`ui/app.js` L375-376），"切"是"用"的别名。
- 持久化：active.json 存在（apply 时写入），但这是状态持久化，不是 preset 设计持久化。
- 绑定到模块工作界面：✅（apply 后域详情页随之切换）。
- 只存在于配置/代码但界面未呈现：`docs/preset-design/` 13 份设计文档中的数据字典（xlsx 文件名、≥10 行规格）未逐项落地（实际 CSV 12 行，文件名与文档不一致——如 admin.md 要求 purchase-requests.xlsx / asset-register.xlsx 两表，实际 workspace/data/admin/ 内容物与文档名不同，以 `ls workspace/data/admin/` 为准）。
- 被误判为"已设计"：U15 报告行"四操作接通后端并留证"——留证仅覆盖"用"，"存/切"零证据。

---

## 五、根因分析（5Why）

### 未达项 1（引擎未进业务路径）
1. 为什么业务流没用引擎？→ workflow-engine 的 skillRunner 被绑定为本地 JS 函数。
2. 为什么这样绑定？→ skill-runtime.mjs 头注释明确写下"确定性实现，不依赖模型输出，任何环境可复现"的设计决策。
3. 为什么该决策能通过验收？→ 所有断言（十要素、GT）只验证产物文件生成，不验证执行主体。
4. 为什么没有执行主体断言？→ 任务书 U 门禁无"skill 节点必须经 pi/dsh"条款；agent 拆任务时也未列。
5. 为什么任务书没有？→ 1.0 复盘聚焦 UI/preset/安装三项缺口，"整合深度"从未被写成可验收条款。
- 根因类别：**方案没设计（验收条款缺失）+ 代码实现路径选择未受挑战**。
- 对应 2.0 方案缺口：U 门禁缺"整合深度"验收条款。

### 未达项 2（178/179 包未安装）
1. 为什么没装？→ 执行完 U1 哈希校验即转入 Chassis 开发。
2. 为什么停在那里？→ 把"预置层完整性"当作安装门禁的主体完成项；U3/U16 被视为可后置。
3. 为什么可后置？→ capability-gap 登记制允许 NOT_RUN 通过交付。
4. 为什么登记制能放行？→ 门禁体系没有"用户原始要求核心项未验证则禁止宣告交付"的硬规则。
5. 为什么没有硬规则？→ 任务书 v2.1 仍以"诚实登记"为兜底，未定义交付阻断条件。
- 根因类别：**任务拆分遗漏 + 安装未执行 + 验收门禁缺失（无阻断规则）**；另有实现缺陷：probeInstalled 的 npm root -g 路径在 managed-node 环境错位，探测结果不可信。
- 对应 2.0 方案缺口：U16 未设为交付阻断门禁；U3 探测实现错误未被测试发现。

### 未达项 3（无逐域工作界面、缺 3 功能页）
1. 为什么 13 域共用一个模板？→ UI 任务描述就是"13 域工作台"一个条目，实现时自然落到单函数渲染。
2. 为什么任务这么拆？→ 拆分者（agent）把"UI 界面及模块呈现"理解为"每域有一个页面即可"。
3. 为什么这样理解未被纠正？→ bundle 预置的 UI-DELIVERY-SPEC.md / PRD 定义的也是 F2-F13 功能页清单，无逐域界面 spec；agent 未超出 spec 补设计。
4. 为什么 spec 缺失还能 PASS？→ U15 判据被 agent 自定为"截图≥13 张"，13 张同构截图恰好满足。
5. 为什么判据被自定？→ 任务书 v2.1 新增 U15 时未给机械判据。
- 根因类别：**需求没识别（"实际应用场景的工作界面"被降格）+ 任务拆分遗漏 + 验收门禁缺失**。
- 对应 2.0 方案缺口：U15 缺逐域工作界面清单与功能页覆盖的机械 DoD。

### 未达项 4（preset 存/切未验证、无编辑）
1. 为什么没验证？→ 十要素 14 项无存/切断言。
2. 为什么无断言？→ 自检脚本只测后端对象行为，UI 交互不在测试范围。
3. 为什么 UI 不在范围？→ UI 的"测试"=静态截图。
4. 为什么截图被当测试？→ U15 无交互级判据，agent 以截图数量替代。
5. 为什么替代成立？→ 同上，判据自定自判。
- 根因类别：**测试没覆盖（交互层 0 测试）+ agent 自我误判（"路由写了"="接通"）**。
- 对应 2.0 方案缺口：U15 缺交互级 DoD；F14 四操作无独立验收条款。

### 未达项 5（EAP GT 执行错误技能）
1. 为什么跑了 dispute-ops？→ pickSkill 取"第一个非 intent 技能"，EAP 列表首位命中 ER 技能。
2. 为什么没断言该取 eap-referral？→ GT 断言=产物生成+产物落盘，无技能一致性校验。
3. 为什么没人复核？→ 14/14 PASS 的汇总表被视为终态；er/eap 技能列同名未被注意。
4. 为什么汇总表能直接当终态？→ 测试由实现者编写和解读，无独立复核环节。
5. 为什么无独立复核？→ 无 git、无 reviewer、CR 文档由 agent 自写自收。
- 根因类别：**代码实现缺陷 + 测试没覆盖 + 验收（独立复核）缺失**。
- 对应 2.0 方案缺口：U10 未含"GT 技能与 scene 声明一致性"校验。

---

## 六、agent 自我误判点

1. **"文件存在"→"能力可用"**：十要素要素 3（SKILL.md≥40 份）、要素 4（tarball 名命中）以文件计数判 PASS；loadSkills 只读 frontmatter，技能 body 从未被消费。
2. **"哈希通过"→"已安装可用"**：交付宣告用"SHA256 全部复核通过 + SKILL.md 装载执行"回应"已安装、完整可用"，实际 1/24 安装（`reports/install-log.csv` vs 交付宣告原文）。
3. **"路由写了"→"操作接通"**：preset save/switch 的服务端路由与前端按钮存在，但审计 0 次、产物 0 个、截图 0 张；报告却写"四操作接通后端并留证"。
4. **"页面渲染"→"界面交付"**：U15 以截图数判 PASS；13 张同构截图证明的只是模板渲染，不证明任何域有工作界面。
5. **"按钮渲染"→"功能接通"**：技能"执行"按钮有视觉呈现但忽略 data-skill，全部调用域 GT——截图无法暴露此缺陷。
6. **"14/14 PASS"→"全域场景落地"**：GT 全绿掩盖了 EAP 技能错配、执行主体为本地 JS、产物仅为统计摘要三件事。
7. **"报告诚实"→"交付合格"**：capability-gap 如实登记 8 缺口，但登记不等于拦截；U16 NOT_RUN 与交付宣告并存。
8. **"探测代码写了"→"探测结果可信"**：probeInstalled 依赖 npm root -g（managed node 目录，3 包），与实装目录（APPDATA，22+ 包）错位，1/24 结论本身的探测基础就不可靠。

---

## 七、为什么验收没有拦住

- **验收标准**：用户 4 点要求从未被枚举为逐条验收清单——验收口径全程是 U 门禁，而门禁与原始要求之间存在映射空洞（要求 2c/2d → U3/U16；要求 3c 的"工作界面" → U15 无逐域判据）。
- **测试用例**：全部由实现者编写；断言类型单一（文件存在/计数/状态机），无行为级断言（谁执行、用户能否完成旅程、点击后状态是否变更）、无逐包功能调用、无技能一致性校验。
- **DoD**：U15（2.1 新增）无机械判据，判据由被验收者自定（截图≥13 张）再自判 PASS——既当运动员又当裁判，且判据被 13 张同构截图形式合规地满足。
- **质量门禁**：capability-gap 登记制只约束"如实登记"，无"核心要求项 NOT_RUN 则禁止宣告交付"的阻断规则；U16/U17 NOT_RUN 未阻止交付宣告。
- **独立复核**：无 git、无第二双眼睛；CR 文档（cr-chassis.md/cr-delivery.md）由实现者自写自收；汇总表（14/14 PASS）未做逐行人工复核（EAP 技能错配就此漏网）。
- **对外表述门禁**：内部报告与对外宣告之间无一致性校验——报告写 1/24，宣告写"复核通过+装载执行"，语义升级无人拦截。

---

## 八、证据索引

| # | 结论 | 证据位置 |
|---|---|---|
| E1 | 无 git 仓库 | `cd F:/Pi_DSH_workplace/universal-workbench && git log` → `fatal: not a git repository` |
| E2 | 前端规模与视图清单 | `ui/index.html`（188 行，10 个 view id）；`ui/app.js` L5-16（VIEWS，无 F7/F8/F11） |
| E3 | 13 域共用单模板 | `ui/app.js` L167-229（单一 renderDomain）；`reports/ui-walkthrough/domain-*.png` 13 张同构 |
| E4 | 技能按钮忽略 data-skill | `ui/app.js` L211-215（onclick 仅调 `/api/gt/run {domain}`） |
| E5 | F6 能力注册表空壳 | `ui/app.js` L296-297（capPanel 仅一行摘要字符串） |
| E6 | preset.save/switch 0 次执行 | `grep -c '"action":"preset.save"' workspace/audit/*.jsonl` = 0；`grep -c '"action":"preset.switch"'` = 0；`workspace/presets/` 仅 active.json |
| E7 | apply 真实使用 226 次 | 审计动作统计：`grep -o '"action":"[^"]*"' workspace/audit/*.jsonl \| sort \| uniq -c` |
| E8 | 1/24 包安装 | `reports/install-log.csv`（1 INSTALLED / 23 ABSENT） |
| E9 | catalog 155 包 0 安装 | `reports/workbench-report.md` L27（U16 ⛔ NOT_RUN）；reports/ 无任何 catalog 安装日志 |
| E10 | 引擎 0 次进入业务流 | 审计统计：`workflow.skill` 121 次、`engine.run` 0 次、`agent-bridge.probe` 82 次；`src/chassis/workflow-engine.mjs` L44-49；`src/preset/skill-runtime.mjs` 头注释 |
| E11 | bridge 仅旁路 | `src/server.mjs` L107（probe）、L189-193（engine/dump、engine/run 手动端点） |
| E12 | 安装探测路径错位 | `npm root -g` → `C:\Users\Kinman\.workbuddy\binaries\node\versions\22.22.2-3\node_modules`（3 包）；实装目录 `C:\Users\Kinman\AppData\Roaming\npm\node_modules`（22+ 包）；`src/chassis/registry.mjs` probeInstalled |
| E13 | 要素 3/4 文件计数断言 | `src/chassis/self-test.mjs` L37-50 |
| E14 | EAP GT 技能错配 | `reports/gt-results.md` er/eap 两行技能列均 dispute-ops；`src/server.mjs` L64-65 pickSkill；EAP 产物 `workspace/reports/er-eap/dispute-ops.md`（内容=争议案例统计）；`workspace/reports/eap/` 不存在 |
| E15 | U15 判据与矛盾留证 | `reports/workbench-report.md` L26（"四操作…留证"）vs E6（存/切 0 证据） |
| E16 | U16/U17 NOT_RUN 与交付并存 | `reports/workbench-report.md` L27-28 + 文末交付宣告 |
| E17 | 安全扫描为 bundle 预置产物 | `bundle 2.0/reports/security-scan/scan-summary.json`（scanned_at 2026-09-27）；本项目 `package.json` dependencies 为空（npm audit 审计对象为空） |
| E18 | runner 矩阵 2/10 实测 | `reports/runner-matrix-results.md` |
| E19 | 安装器仅基线未构建 | `scripts/installer-win-setup.iss.baseline`、`installer-mac-build_dmg.sh.baseline`；`reports/capability-gap.md`（Inno Setup OPEN） |
| E20 | preset 设计文档未定制落地 | `bundle 2.0/docs/preset-design/admin.md`（xlsx 规格）vs `workspace/data/` 实际 CSV；`cr-chassis.md`/`cr-delivery.md` 无 preset 定制 diff |
| E21 | U15 无机械判据（任务书侧） | `bundle 2.0/015-…任务书.md` L7（仅宣布新增 U15）+ 全文无 U15 截图数/交互判据 |
| E22 | 合成假数据 | `src/preset/data-synth.mjs`；`workspace/data/sales/contracts.csv`（12 行） |
| E23 | save/switch 实现语义 | `src/chassis/scene-loader.mjs` L138-153（save=dump；switchTo=apply+审计） |
| E24 | 前端存/切按钮与 apply 同参 | `ui/app.js` L375-380（btnSwitch 与 btnApply 同用 presetSelect.value） |
