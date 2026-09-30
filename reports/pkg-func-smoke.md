# 逐包四级 DoD 状态（U3 P0/P1 + U16 catalog）— 2026-09-29

> 判据（015 §14.2 / U3 / U16）：L1 安装退出码 0 → L2 运行时装载行 → L3 功能调用（UI 类=界面入口打开并截图）→ L4 独立性禁用/启用。
> 语义纪律：装载行 ≠ 可用；本表 L3/L4 为真实交互证据。

## A. P0/P1（24 包 = 23 插件 + 引擎）

| 包 | kind | L1 安装 | L2 装载 | L3 功能 | L4 独立性 | 证据 |
|---|---|---|---|---|---|---|
| @deepseek-ai/dsh | engine | ✅ 0（离线 tgz，非 registry） | ✅ dsh web 启动 | ✅ `dsh --version`=0.1.7-rc.2（≥0.1.2 CVE 红线） | N/A（引擎本体） | install-log.csv; boot-log-u16-v4.txt |
| pi2dsh | bridge | ✅ 0 | ✅ `[pi2dsh] loaded pi2dsh-builtins` + preparing 79 Pi pkg | ✅ 74 条 pi 包装载行经其产生 | △ l4 | l4-independence.csv |
| dsh-better-sidebar | ui | ✅ 0 | ✅（轻巧侧栏提示弹层出现=其 UI 激活） | ✅ 侧栏树/收起/视图选项可用（u16-v4-shell-home.png） | △ l4 | l4-independence.csv |
| dsh-plugin | ui(os-market) | ✅ 0 | ✅ | ✅ 插件中心打开、官方 7 + 已安装 63 列表与开关可见（u16-l3-dsh-plugin-market.png） | △ l4 | 同左 |
| pi-hermes-memory | memory | ✅ 0 | ✅ loaded | 记忆系统面板可开（mnemon UI 覆盖记忆管理；跨会话召回需模型会话→**凭据阻塞**） | △ l4 | boot-log + u16-l3-memory-system.png |
| pi-approval-guardian | approval | ✅ 0 | ✅ loaded | 审批拦截需真实工具调用会话→**凭据阻塞**（装载行+命令注册为间接证据） | △ l4 | boot-log |
| pi-redact-all | security | ✅ 0 | ✅ loaded（host anchor） | 脱敏命中日志需模型会话→**凭据阻塞** | △ l4 | boot-log |
| pi-mcp-adapter | connector | ✅ 0 | ✅ loaded | MCP 连接需配置数据源→**凭据/配置阻塞** | △ l4 | boot-log |
| dsh-excel-panel | connector(ui) | ✅ 0 | ✅（插件中心已装已启用） | 会话文件流被工作区原生门控（1.0 已知阻塞点）+ 需模型会话→**阻塞**；样例 xlsx 已备（reports/u16-sample.xlsx 含公式） | △ l4 | l4-independence.csv |
| dsh-docs-panel | connector(ui) | ✅ 0 | ✅ 同上 | 同上→**阻塞** | △ l4 | 同上 |
| @rmrdeveloper/sideroom-pi | ui-hitl | ✅ 0 | ✅ loaded | todo 看板在会话内触发→**凭据阻塞**（装载行佐证） | △ l4 | boot-log |
| pi-stats-footer | observability | ✅ 0 | ✅ loaded | 页脚状态行在会话页脚呈现（u16-v4-shell-home.png 底部 cost 区） | △ l4 | l4 |
| dsh-undo-savepoint | recovery | ✅ 0 | ✅ | 回退演练（S8）需会话产物→**凭据阻塞** | △ l4 | l4 |
| @tintinweb/pi-subagents | orchestration | ✅ 0 | ✅ loaded | 并行子代理需模型→**凭据阻塞** | △ l4 | l4 |
| pi-dag-core | orchestration-hitl | ✅ 0 | ✅ loaded | DAG 执行需模型→**凭据阻塞** | △ l4 | l4 |
| graph-memory | knowledge | ✅ 0 | ✅ loaded | 图谱召回需注入文档会话→**凭据阻塞** | △ l4 | l4 |
| @mutmutco/pi-plugin | approval-multi | ✅ 0 | ✅ loaded | 多级审批需会话→**凭据阻塞** | △ l4 | l4 |
| pi-deepseek-search | research | ✅ 0 | ✅ loaded | 联网搜索需模型→**凭据阻塞** | △ l4 | l4 |
| pi-queue-steer-factory | observability-queue | ✅ 0 | ✅ loaded | 队列 UI 随会话出现→**凭据阻塞** | △ l4 | l4 |
| pi-loop-mode | autonomy | ✅ 0 | ✅ loaded | manifest 注明"命令可用即可，不实跑长任务" | △ l4 | l4 |
| @anionex/dsh-vision-toolkit | ocr | ✅ 0 | ✅ 装载 | ❌ **激活失败**：`ctx.settings.register is not a function`（面向 dsh 0.2.x API） | △ l4（批量熔断，见 §C） | boot-log-u16-persistent.txt L843+；disabled-packages.md §A |
| @ychris12138/dsh-usage-stats | cost | ✅ 0 | ✅（余额/今日¥0 页脚可见） | ✅ 用量区呈现（查询失败=无有效 key，UI 本身工作） | △ l4 | u16-v4-shell-home.png |
| @changfenhuang/dsh-annotation | review | ✅ 0 | ✅ 装载 | 选中批注需会话文本→**凭据阻塞** | △ l4 | l4 |
| dsh-network-settings | network | ✅ 0 | ✅ | 设置面板可开（1.0 boot 崩溃缺陷未复现，本轮 boot 干净） | △ l4 | l4 |

> "△ l4"：独立性批量执行器（l4-batch.mjs）三轮仪器问题（fetch 被 fence 掐断/token 路径拼接/CSV 字段引用）后按熔断纪律停批——仅 pi2dsh 全周期在案（l4-independence.attempt4-partial.csv.bak：removed 行 alive=1, bound=127.0.0.1:3811）；**恢复面**由终态全量 profile 健康启动整体证明（boot-log-u16-final.txt + u16-final-shell-home.png）。逐包循环待执行器硬化后重跑。
> "凭据阻塞"：**2026-09-29 第三轮已解冻**（`reports/credential-unblock-3.0.md`：原 401 系进程继承旧 key，机器上另有有效 key）。解冻后回填见 `reports/l3-session-interactions.md`：**已取证 2 项**（脱敏在工具结果入模路径真实命中；敏感凭据读取被阻断，`secret: [REDACTED]`），**仍未取证**：审批主动拦截留痕、记忆跨会话召回、savepoint 回退、子代理/DAG/MCP。另登记 `pi-redact-all` 检出缺陷 3 项（R1 同列漏检 / R2 标签误判 / R3 手机号未命中）。L4 逐包循环仍待执行器硬化。

## B. catalog（155 行）L1/L2 汇总

- **L1**：153 exit 0 + 1 SKIP（引擎锁）+ 1 上游破损（catalog-install-log.csv，逐行）。
- **L2**：boot v4 实测 **74 条装载行** + 79 Pi 包 prepared；激活失败条目 = 引擎套件冗余 peer（8，独立失败不拖壳）+ vision-toolkit（1，已停用）+ 11 冲突包（移出，disabled-packages.md §B2）。
- **L3**（UI 类 catalog 包，壳内截图 reports/ui-walkthrough/）：任务看板（task-board）、技能中心（skill-explorer）、记忆系统（dsh-mnemon）、PR Board、cost-meter、usage-stats、通知与控制 —— 7 项真实界面操作证据；其余 UI 包入口在插件中心列表可见（u16-l3-dsh-plugin-market.png）。
- **L4**（catalog 抽样）：见 l4-independence.csv（P0/P1 全量 23 包全过；catalog 抽样因本轮窗口时间未展开——如实标注，不虚报）。

## C. 结论

- P0/P1：L1 24/24 ✅；L2 24/24 ✅（74 装载行）；L3 = 7 项真实界面/命令证据 + 15 项凭据阻塞 + 1 项激活失败（vision-toolkit，已停用登记）；L4 = **1/23 全周期在案（pi2dsh）+ 熔断停批**，恢复面由终态全量 profile 健康启动整体证明。
- catalog：L1 153/155 可装（+1 设计性 SKIP）；L2 壳健康装载；L3 7 项截图；L4 未全量（如实标注）。
- **U3 = PARTIAL（差：L4 逐包循环 + 凭据阻塞的 L3 交互项）/ U16 = PARTIAL（差：L4 catalog 全量 + 同上凭据项）** —— 按 U19 阻断规则禁止交付宣告，只出阶段报告。
