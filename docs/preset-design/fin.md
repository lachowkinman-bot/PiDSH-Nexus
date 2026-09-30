# Preset 设计文档 · 财务管理（fin）

> 定位：`fin.expense-approve@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/fin.expense-approve.yaml`（scene_id `fin.expense-approve@1.0.0`、domain `FIN`；required_capabilities 3；skills 3；policies：min_level=L4 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="fin"` 共 6 条）+ `manifests/workflows/fin.*.yaml`
> - Skills：`templates/skills-domain/fin/SKILL-*.md`（含意图路由 `SKILL-cockpit-intent.md`）；知识种子 `templates/knowledge/seeds/fin.md`；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/fin/budget.csv`、`expenses.csv`、`revenue_ledger.csv`、`invoices.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2（字段级字典写法）、§3.3（状态枚举）、§4（工作流规格＋校验联动）、§7.1（种子规模）、§8.2（字段校验规范）、§8.3（枚举与状态迁移规范）；PRD §4.2（敏感字段脱敏强制）
>
> **数据基线日 = 2026-09-29**（报告期 `2026-09`，对比期 `2026-08`；全部为合成数据，非真实经营数据）。

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| expenses.csv | L3 | invoice_taxid（PII 由关联表 `invoices.csv` 的 `seller_taxid` / `buyer_taxid` 承载；本表 `applicant_masked` 为不可还原掩码） | 29 | 费用/报销凭证明细（金额单位**元**）：原 6 列（单号/申请人掩码/金额/事由/审批级别/状态）+ 追加 6 列（部门/部门码/科目/期间/发票号/支付日）；覆盖 2026-08、2026-09 两期 × 6 部门，是 **cost 口径**的凭证级来源 |
| invoices.csv | L3 | seller_taxid, buyer_taxid | 19 | 发票要素台账（金额单位**元**）：发票号码/代码/开票日/销方名称与税号/购买方抬头与税号/不含税金额/税额/价税合计/关联报销单/校验结论/疑点类型；承载 scene 声明的 `invoice_taxid`，是 GT-FIN-03 的判定依据 |
| budget.csv | L2 | —（scene 声明 `pii_fields: []`） | 12 | 部门月度预算执行与经营损益汇总（金额单位**万元**，2 位小数）：原 5 列（部门/预算/已用/剩余/期间）+ 追加 6 列（部门码/期间类型/**收入**/**净额**/责任人/更新时间）；6 部门 × 2 期，是 **revenue/cost/net 口径**的汇总来源 |
| revenue_ledger.csv | L3 | customer_masked（掩码，不可还原） | 15 | 收入凭证明细（金额单位**元**）：收入单号/期间/部门/客户掩码/合同号/不含税金额/税率/税额/价税合计/发票号/确认日/状态；**非 scene 数据资产**（本域扩展表，供 GT-FIN-02 收入侧取证），级别保守继承销售侧合同口径 L3 |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按"去扩展名 + 前缀"匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 expense-claims.xlsx / type-dict 的 `fin, expense-claims, table, L3, invoice_taxid` | expenses.csv（费用主表）+ invoices.csv（发票子表，`invoice_taxid` 落地列） | L3 |
| scene `data_assets` 的 budget-master.xlsx / type-dict 的 `fin, budget-master, table, L2, none` | budget.csv | L2 |
| （无 scene 声明；GT-FIN-02 收入侧取证需要） | revenue_ledger.csv | L3（保守继承） |

- 表头英文小写下划线、UTF-8、逗号分隔、字段内不使用英文逗号；**金额单位写进列名**（`*_yuan` = 元、`*_wan` = 万元），无单位歧义。
- `expenses.csv` 原 6 列、`budget.csv` 原 5 列的**列名与列序均未删改**，仅追加列（追加列已逐字段写入 §1.1）；原 5 条 expenses 行（EXP-8812~EXP-8816）的既有取值逐字保留。
- 每表数据行 ≥10（§15.4 校验下限），本页行数以上表为准（不含表头）。
- **口径恒等式**（由数据保证，§9 V-FIN-07 逐项校验）：`Σexpenses.amount_yuan(部门,期间) / 10000 ≡ budget.used_wan`；`Σrevenue_ledger.amount_yuan(部门,期间) / 10000 ≡ budget.revenue_wan`；`budget_wan − used_wan ≡ remain_wan`；`net_wan ≡ revenue_wan − used_wan`。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`（不写英文逗号，避免破坏 CSV 分隔）。

#### 1.1.1 expenses.csv（12 列 = 原生 6 列 + 追加 6 列，29 行）

表头逐字：`expense_id,applicant_masked,amount_yuan,reason,level,status,dept,dept_code,gl_account,period,invoice_no,paid_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| expense_id | string | 是 | 报销/费用单号，唯一主键，格式 `EXP-####`（EXP-8812~EXP-8840 连续编号）；原始列 |
| applicant_masked | string | 是 | 申请人掩码（姓 + `****`，如 `周****`），掩码前值不入库、不出域、不入记忆层；原始列（对应 redact 口径） |
| amount_yuan | number | 是 | 单笔金额（**元**，整数）；与 `invoices.total_yuan` 的比对见 §9 V-FIN-02；原始列 |
| reason | string | 是 | 事由（科目化描述，含期间批次），用于科目归类与异常解释；原始列 |
| level | enum | 是 | 审批级别 L1 / L2 / L3 / L4，按"科目基准级别 + 金额升级"复合判定（规则见 §5 与 §9 V-FIN-05）；原始列 |
| status | enum | 是 | 报销单状态：待预审 / 待审批 / 双审批中 / 已批准 / 已驳回 / 已报销（迁移见 §4.1）；原始列 |
| dept | enum | 是 | 归属部门（词表：销售部/市场部/研发部/行政部/人力资源部/财务部），与 `budget.dept` 同词表；追加列 |
| dept_code | enum | 是 | 部门码 SL / MK / RD / AD / HR / FN（对齐 `budget.dept_code`，用于跨表连接）；追加列 |
| gl_account | enum | 是 | 费用科目：差旅费 / 交通费 / 办公费 / 设备采购 / 市场推广费 / 广告投放费 / 云资源费 / 外包服务费 / 项目直接成本 / 房租物业费 / 招聘服务费 / 员工活动费 / 审计咨询费 / 银行手续费；决定科目基准审批级别；追加列 |
| period | string | 是 | 归属期间 `YYYY-MM`（2026-08 / 2026-09），是预算执行月报的过滤键；追加列 |
| invoice_no | string | 否 | 关联发票号 `INV-YYYY-MM######`；在 `invoices.csv` 中命中即为已归档，未命中按 §9 V-FIN-08 列"待补件"；追加列 |
| paid_at | date | 否 | 支付/报销到账日 `YYYY-MM-DD`；在途行（待预审/待审批/双审批中）为 `-`，是现金流出与状态机的证据字段；追加列 |

#### 1.1.2 invoices.csv（13 列，19 行）

表头逐字：`invoice_no,invoice_code,invoice_date,seller_name,seller_taxid,buyer_title,buyer_taxid,amount_yuan,tax_yuan,total_yuan,expense_id,check_result,issue_type`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| invoice_no | string | 是 | 发票号码（本 preset 用 `INV-YYYY-MM######` 可读化编号，唯一主键；连号判定按号段尾部递增，见 §9 V-FIN-03） |
| invoice_code | string | 是 | 发票代码（12 位数字，如 `031002000211`）；同代码 + 同销方 + 号码连续 = 连号 |
| invoice_date | string | 是 | 开票日期 `YYYY-MM-DD`；晚于 `expenses.paid_at` 记跨期发票疑点 |
| seller_name | string | 是 | 销方名称（合成主体，非真实企业） |
| seller_taxid | string | 是 | 销方纳税人识别号（PII / 敏感标识）。合规值 18 位；样例含 1 条 17 位异常（`91310115MA1K3QY44`，见 V-FIN-01） |
| buyer_title | string | 是 | 购买方抬头，必须等于主体登记名称 `星桥科技（上海）有限公司`，否则 FAIL（V-FIN-04） |
| buyer_taxid | string | 是 | 购买方税号，主体唯一值 `91310115MA1K3QX09T`；与抬头一并构成"主体一致性"证据 |
| amount_yuan | number | 是 | 不含税金额（**元**，2 位小数） |
| tax_yuan | number | 是 | 税额（**元**，2 位小数）；`amount_yuan + tax_yuan ≡ total_yuan`（V-FIN-02） |
| total_yuan | number | 是 | 价税合计（**元**，2 位小数）；与 `expenses.amount_yuan` 一致（差异即"金额不符"FAIL） |
| expense_id | ref | 是 | → `expenses.expense_id` 外键，禁止孤儿行（V-FIN-08） |
| check_result | enum | 是 | 校验结论：通过 / 疑点 / FAIL（映射发票状态机见 §4.2） |
| issue_type | string | 否 | 疑点/失败类型：连号 / 抬头不一致 / 金额不符 / 税号格式异常 / 跨期发票；`通过` 行为 `-` |

#### 1.1.3 budget.csv（11 列 = 原生 5 列 + 追加 6 列，12 行）

表头逐字：`dept,budget_wan,used_wan,remain_wan,period,dept_code,period_type,revenue_wan,net_wan,owner,updated_at`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| dept | enum | 是 | 部门（6 部门词表，与 expenses.dept 一致）；原始列 |
| budget_wan | number | 是 | 当期预算包（**万元**，2 位小数）；原始列 |
| used_wan | number | 是 | 当期预算执行数（**万元**，2 位小数）＝成本口径 `cost_wan`；恒等于该部门该期 expenses 明细合计（含在途、不含已驳回），原始列 |
| remain_wan | number | 是 | 预算余额 ＝ `budget_wan − used_wan`（余额不足拦截见 V-FIN-06）；原始列 |
| period | string | 是 | 期间 `YYYY-MM`（2026-08 / 2026-09）；原始列（原为季度标签 `Q4`，本版按**月度**口径落地以对齐 `fin.monthly-report` 报告期，属口径修正而非列变更） |
| dept_code | enum | 是 | 部门码 SL / MK / RD / AD / HR / FN；追加列 |
| period_type | enum | 是 | 期间类型：月度（本域仅月度；季度包由 `fin.budget-review` 审议后按月度落地）；追加列 |
| revenue_wan | number | 是 | 当期确认收入（**万元**，2 位小数）；恒等于 `Σrevenue_ledger.amount_yuan(部门,期间)/10000`；**GT-FIN-02 必填字段 revenue_wan 的汇总来源**；追加列 |
| net_wan | number | 是 | 当期净额（**万元**，2 位小数）＝ `revenue_wan − used_wan`（成本中心为负值，属预期）；**GT-FIN-02 必填字段 net_wan 的汇总来源**；追加列 |
| owner | string | 是 | 部门预算责任人（掩码名，如 `周****`）；追加列 |
| updated_at | date | 是 | 数据版本时间戳 `YYYY-MM-DD`，审计"依据数据版本"取该值；追加列 |

#### 1.1.4 revenue_ledger.csv（13 列，15 行）

表头逐字：`revenue_id,period,dept,dept_code,customer_masked,contract_no,amount_yuan,tax_rate,tax_yuan,total_yuan,invoice_no,recognize_date,status`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| revenue_id | string | 是 | 收入确认单号 `R-YYYYMM-###`，唯一主键 |
| period | string | 是 | 归属期间 `YYYY-MM`，与 budget.period 同域 |
| dept | enum | 是 | 收入归属部门（仅销售部/市场部/研发部有收入；行政部/人力资源部/财务部为成本中心，其 revenue_wan=0.00） |
| dept_code | enum | 是 | 部门码，与 budget.dept_code 一致 |
| customer_masked | string | 是 | 客户名称掩码（如 `华****科技有限公司`），不可还原；真名受 redact_gate 约束 |
| contract_no | string | 是 | 销售合同号 `HT-YYYY-####`，供跨域（sales）取证 |
| amount_yuan | number | 是 | 不含税收入（**元**，整数），收入口径凭证级来源 |
| tax_rate | number | 是 | 税率（小数，本域取 0.06） |
| tax_yuan | number | 是 | 销项税额（**元**）＝ `round(amount_yuan × tax_rate)` |
| total_yuan | number | 是 | 价税合计（**元**）＝ `amount_yuan + tax_yuan` |
| invoice_no | string | 是 | 开票号 `INV-YYYY-MM####`（收入侧发票，与费用侧 `invoices.csv` 号段不重叠） |
| recognize_date | date | 是 | 收入确认日 `YYYY-MM-DD`（权责发生时点） |
| status | enum | 是 | 收款状态：已确认 / 已开票 / 已回款（迁移顺序不可逆） |

---

## §2 技能规格（scene skills：expense-precheck / budget-analysis / invoice-check）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| expense-precheck | 报销单预审（预算/标准/发票要素） | data/fin/expenses.csv、invoices.csv、budget.csv | reports/fin/*（异常清单，逐行引用凭证） | L4 | 每笔结论必须附 `expense_id` + 命中规则；预算余额不足不得放行（V-FIN-06）；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| budget-analysis | 预算执行与月度损益分析 | data/fin/budget.csv、expenses.csv、revenue_ledger.csv | reports/fin/*（部门执行表 + 月度财报字段） | L4 | 四个必填字段必须给出 (文件, 行, 列) 级证据链（A 级可溯，V-FIN-09）；数字不得外推、不得倒轧；连续 3 次失败→登记 capability-gap |
| invoice-check | 发票要素校验（税号/金额/连号） | data/fin/invoices.csv、expenses.csv | reports/fin/*（疑点清单 + FAIL 清单） | L4 | 连号、抬头不一致直接 FAIL（workflow acceptance）；`invoice_taxid` 出域前必过 redact_gate（V-FIN-10）；连续 3 次失败→登记 capability-gap |

- 三个技能文件均声明 `min_level: L4`、`redact_gate: true`，依赖能力 `cap.excel.panel`、`cap.redact.all`（与 scene `required_capabilities` 一致，另含 `cap.approval.single`）。
- 意图路由技能 `fin-intent`（`templates/skills-domain/fin/SKILL-cockpit-intent.md`）把自然语言意图路由到 `expense-approve` / `monthly-report` 工作流；跨域意图（如"调薪成本影响"）交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="fin"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| fin.expense-approve@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `expense-approve-<ts>.json`：expense_id / amount_yuan / level / approvals；acceptance：L4 必须双审批；审批单与产物一致 | 报销审批（强审批）；skill=expense-precheck；落 `reports/fin/`，审计记"审批人 + 依据数据版本 + 产物哈希"；rollback=savepoint `pre-expense-approve` |
| fin.monthly-report@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `monthly-report-<ts>.json`：**period / revenue_wan / cost_wan / net_wan**；acceptance：财报数字 A 级可溯（凭证级） | 部门预算执行月报（分级出数）；skill=budget-analysis；**必填四字段的数据来源见下方"字段→表列"映射**；rollback=savepoint `pre-monthly-report` |
| fin.budget-review@1.0.0 | n3 approval（**L4，`dual: true`**）；hitl_nodes=[n3] | `budget-review-<ts>.json`：dept / budget_wan / delta_wan / reason；acceptance：超包 10% 加签 CFO | 预算调整审批（部门季度包按月度落地）；skill=budget-analysis；rollback=savepoint `pre-budget-review` |
| fin.invoice-check@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空）；FAIL 行转人工复核 | `invoice-check-<ts>.json`：invoice_no / amount_yuan / checks / result；acceptance：连号/抬头不一致直接 FAIL | 发票要素校验（税号/金额/连号）；skill=invoice-check；审计记"输入参数 + 结果快照" |
| fin.reimburse-audit@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `reimburse-audit-<ts>.json`：sample_size / issues / issue_rate / actions；acceptance：抽样比例 ≥10% | 报销抽审（合规抽样）；skill=expense-precheck；`sample_size ≥ ceil(29×10%) = 3`，本域凭证池 29 行 |
| fin.cashflow-week@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `cashflow-week-<ts>.json`：week / in_wan / out_wan / balance_wan；acceptance：银行账户字段 L4 只出汇总 | 周现金流简报（进/出/余）；skill=invoice-check；**只出汇总，禁出现银行账户明细**（§10） |

- 节点链：approve 类为 skill(n1) → condition(n2) → approval(n3) → tool `cap.excel.panel.write`(n4) → audit(n5)；report/calc 类为 skill(n1) → tool(n2) → audit(n3)。上表"审批落点"列对无审批工作流明示为"无审批节点"，**不存在 `undefined`**。
- **GT-FIN-02 必填字段 → 表列映射**（不依赖任何外部数据，全部可从本域 4 张表取值）：

| 交付字段 | 汇总来源（万元） | 凭证级来源（元） | 取数示例（报告期 2026-09） |
|---|---|---|---|
| period | budget.csv.`period` | revenue_ledger.`period` / expenses.`period` | 取既有期间值 `2026-09`（不得由时序戳臆造） |
| revenue_wan | budget.csv 6 行 `revenue_wan` 求和 | revenue_ledger.`amount_yuan` 按期间求和 ÷10000 | 7,600,000+1,800,000+2,400,000 = 11,800,000 元 → **1180.00** 万元 |
| cost_wan | budget.csv 6 行 `used_wan` 求和（≡ cost 口径） | expenses.`amount_yuan` 按期间求和 ÷10000 | 2,680,000+1,960,000+3,420,000+960,000+840,000+760,000 = 10,620,000 元 → **1062.00** 万元 |
| net_wan | budget.csv 6 行 `net_wan` 求和（＝ revenue_wan − cost_wan） | 上式两者之差 | 1180.00 − 1062.00 = **118.00** 万元 |

- 对比期 2026-08 同法可取：revenue_wan 1020.00 / cost_wan 986.00 / net_wan 34.00，供月报环比与异动归因。

---

## §4 状态机

### 4.1 报销单（expenses.status）

```
待预审 →（预审通过）→ 待审批 →（审批通过）→ 已批准 →（支付/报销到账）→ 已报销（终态）
                          ↘（审批驳回）→ 已驳回 →（补件后重提）→ 待预审
待审批/已批准 ──（L4 或金额 ≥5 万元）──→ 双审批中 →（双人通过）→ 已批准
```

| 状态（CSV 落值） | 标识符 | 等价口径 | 允许后继 | 证据字段 |
|---|---|---|---|---|
| 待预审 | pending_precheck | 待预审 | 待审批 / 已驳回 | `expense_id` 已分配、`invoices.check_result` 未定 |
| 待审批 | pending_approval | 待审批 | 双审批中 / 已批准 / 已驳回 | `paid_at` 为空；命中审批级别 L1–L3 单审批 |
| 双审批中 | pending_dual | 双审批中 | 已批准 / 已驳回 | 命中 L4 或金额 ≥5 万元；`approvals` 计数 1/2 |
| 已批准 | approved | **已通过** | 已报销 | 审批人 + 依据数据版本 + 产物哈希（workflow n5 audit） |
| 已驳回 | rejected | 已驳回 | 待预审（补件重提） | 驳回原因必填；**本期快照 0 行**，以保证 `Σexpenses ≡ used_wan` 恒等（见 §9 V-FIN-07） |
| 已报销 | reimbursed | **已支付 / 已报销** | —（终态） | `paid_at` 必填；支付即计入 `used_wan` 与周现金流 `out_wan` |

- 迁移只经唯一函数 `setStatus(entity, to, by)` 并写操作日志（参照 §8.3）；流程实例状态（running/done/rejected/cancelled）与单据状态**解耦**：流程 done 后由 after_complete 钩子回写单据。
- 本快照分布（29 行）：已报销 25 / 双审批中 2 / 待审批 1 / 已批准 1；样例：EXP-8824（行政部，319,180 元，双审批中，超剩余预算）、EXP-8813（研发部，15,600 元，待审批）。

### 4.2 发票（invoices.check_result，INVOICE_STATUS）

| 状态 | 落地取值 | 进入条件 | 允许后继 |
|---|---|---|---|
| 待校验 | （尚未写入台账行） | 报销单提交、发票未归档 | 已核验 / 疑点 |
| 已核验 | `通过` | 号码/代码/税号/抬头/金额/税额全部合规 | —（终态） |
| 疑点 | `疑点` | 单一要素可疑但非硬伤（税号位数异常、跨期发票） | 人工复核后 → 已核验 / 转 FAIL 流程 |
| （强制不通过） | `FAIL` | **连号**、**抬头不一致**、金额不符（workflow acceptance 原文"连号/抬头不一致直接 FAIL"） | 不得自动放行；退回报销单并记 `已驳回` |

- 本快照分布（19 行）：通过 13 / 疑点 2 / FAIL 4；FAIL 样例：EXP-8813（抬头 `星桥科技（北京）有限公司` 与主体不符）、EXP-8823（价税合计 620,000 元 vs 报销单 640,000 元）、EXP-8814 与 EXP-8816（同销方同日连号 `INV-2026-090107` / `INV-2026-090108`）。
- 发票状态与报销单状态解耦：发票 FAIL 是报销单走向 `已驳回` 的触发条件之一，但两表状态各自落值、互不双写。

### 4.3 预算包（budget.period / fin.budget-review）

```
月度执行（period=YYYY-MM，used_wan 随凭证回写）
  → 累计超包 ≥10% → 触发 fin.budget-review（L4 双审批 + CFO 加签）
  → 调整通过 → 新预算包版本（budget_wan/delta_wan 落 budget-review-<ts>.json）并回写下一期 budget.csv
```

| 状态 | 判定 | 证据字段 |
|---|---|---|
| 执行正常 | `used_wan / budget_wan < 90%` | budget.csv：used_wan / budget_wan |
| 接近超包 | `80% ≤ 执行率 < 100%` 预警 | budget.csv：remain_wan（如 2026-09 市场部 remain 14.00 万元） |
| 余额不足 | 单笔在途金额 > `remain_wan × 10000` | expenses：amount_yuan / status；budget：remain_wan（样例 EXP-8824） |
| 超包待审 | 累计执行率 ≥100% 或调整幅度 > 包 10% | budget-review-<ts>.json：dept / budget_wan / delta_wan / reason |

---

## §5 审批链（节点-角色-双审批-金额阈值）

| 流程 | 节点链 | 审批角色 | 双审批 | 金额/条件阈值 | manifest 落点 |
|---|---|---|---|---|---|
| 报销（fin.expense-approve） | 提交 → expense-precheck 预审 → 条件判定 → L4 审批 → 写产物 → 审计 | 部门负责人 → 财务负责人 →（大额）CFO | **是**（`dual:true`，任意金额均双人） | 域基线：全部 L4 双审批；加签细化：≥5 万元加签财务负责人；≥50 万元加签 CFO；≥部门 `remain_wan` 先转 `fin.budget-review` 或驳回 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 预算调整（fin.budget-review） | 预算分析 → 条件判定 → L4 审批 → 写产物 → 审计 | 部门负责人 + 财务负责人 →（超包）CFO | **是**（`dual:true`） | acceptance 原文"超包 10% 加签 CFO"：`|delta_wan| > budget_wan × 10%` 必须 CFO 加签 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 月度财报（fin.monthly-report） | 取数 → 汇总 → 写产物 → 审计 | 无审批（分级出数） | 否 | 分级别口径：公司级汇总可对 L4 输出；部门明细仅在 L4 命名空间内 | 无 approval 节点（kind=report） |
| 付款/现金流（fin.cashflow-week） | 取数 → 汇总 → 写产物 → 审计 | 无审批（只出汇总） | 否 | 银行账户字段一律不得出现在产物中（只出 in/out/balance 汇总） | 无 approval 节点（kind=report） |

- 场景基线 `policies.permission.min_level=L4`、`dual_approval=false` 为**域默认**；两条 approve 工作流在流程级升格为 L4 双审批（与 workflow YAML 一致），规则**单调加严、不放松**。
- 审批级别（`expenses.level`）判定规则（本文档细化，manifest 未写死数值）：**取"科目基准级别"与"金额升级规则"二者较高者**——基准：办公费/交通费=L1，差旅费/员工活动费=L2，设备采购/云资源费/外包服务费/房租物业费/招聘服务费/审计咨询费/银行手续费=L3，市场推广费/广告投放费/项目直接成本=L4；金额升级：≥5 万元不低于 L3，≥30 万元为 L4。
- 5 万元 / 30 万元 / 50 万元为本文档细化阈值；定制时必须与 scene/workflow 配置保持同一口径并只允许加严。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，不得绕过 §5 审批链。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 报销审批通过并支付（fin.expense-approve done） | ①`used_wan` 按部门/期间回写执行数；②发票行状态回写；③支付金额进入当周现金流 `out_wan` | expenses：expense_id / dept / period / amount_yuan / status=已报销 / paid_at；budget：used_wan / remain_wan；cashflow-week-<ts>.json：out_wan |
| 报销单含"薪酬代垫"科目（本域约定 `gl_account` 扩展值） | **不联动薪酬主数据**：报销为费用结算，不改变薪酬口径；仅向 comp 域发起对账请求（对私打款与工资条不重复计列） | expenses：gl_account / amount_yuan / applicant_masked；对账结论落 reports/fin/*，不写 comp 台账 |
| 月度财报出数（fin.monthly-report done） | 供 strat 域经营分析引用：公司级 revenue/cost/net 与部门执行率作为 `strat.weekly-report` / `strat.quarter-close` 的财务输入；仅出汇总，不出明细 | budget.csv：period / revenue_wan / used_wan / net_wan；monthly-report-<ts>.json：四必填字段 + 证据行号 |
| comp 调薪审批通过（comp.salary-adjust done） | 人力成本上升须在 fin 域**登记**为成本增量（保守：只登记、不自动改预算）；若导致部门超包 ≥10% 则转 `fin.budget-review` | comp.adjust_queue：employee_masked / proposed_band / status；budget-review-<ts>.json：dept / delta_wan / reason |
| admin 采购入库（admin.purchase-approve done，order_status=已入库） | 采购支出按部门/科目落 `expenses`（`gl_account`=设备采购/办公费），与资产台账形成"预算—采购—资产"三向勾稽 | admin/purchases.csv：request_id / request_dept / amount_yuan / order_status；fin/expenses.csv：dept / gl_account / amount_yuan / period |
| 发票 FAIL 或税号异常（fin.invoice-check） | 金额 ≥50 万元或涉及主体抬头不实 → 触发 cmp 域留痕（`cmp.audit-trail`）；同时该报销单不得置已批准 | invoices：invoice_no / check_result=FAIL / issue_type / total_yuan；expenses：status（回退待预审） |

---

## §7 权限矩阵

- 最低数据级别：**L4**（scene `policies.permission.min_level=L4`，越级读取即 DENY）；双审批：域基线 `dual_approval=false`，流程级升格见 §5（两条 approve 工作流均为真）。
- 脱敏字段（redact_gate，gate=`redact_gate`）：`bank_account`、`invoice_taxid`。落地映射：`invoice_taxid` → `invoices.seller_taxid` / `invoices.buyer_taxid`；`bank_account` 本域**未落任何明细列**（只以周现金流汇总口径出现）。
- 记忆层策略（scene `policies.memory`）：`pii_allowed=false`、`exclude=[]` —— 本域 PII 一律禁入记忆层，产物只落 `reports/fin/` 与 `templates/workspace/deliverables/fin/`。

| 对象 | 级别 | 脱敏（redact_gate） | 记忆层 | 双审批 |
|---|---|---|---|---|
| expenses.csv（`applicant_masked`） | L3 | 申请人一律掩码（`周****`），掩码前值永不落产物；报告只引用 `expense_id` | PII 禁入（仅可入状态/汇总结论） | 报销审批：是（L4 双审批，§5） |
| invoices.csv（`seller_taxid` / `buyer_taxid`） | L3 | `invoice_taxid` 命中：出域/入报告仅出"税号是否合规"的结论与掩码形态，禁出完整税号 | 禁入 | 发票 FAIL 不得自动放行（人工复核） |
| budget.csv（收入/成本/净额） | L2 | 无 PII；财报数字出报告必须带 (文件,行,列) 证据，禁只出结论 | 允许非 PII 汇总入记忆层 | 预算调整：是（超包 10% 加签 CFO） |
| revenue_ledger.csv（`customer_masked` / `contract_no`） | L3 | 客户名掩码；合同号仅在 L4 命名空间内引用 | 禁入 | 否（只读取证） |
| 银行账户（无落地列） | L4 | **禁入任何输出**（scene 尾注原文），仅以 `in_wan/out_wan/balance_wan` 汇总出现 | 禁入 | 否 |

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-FIN-01 | 预审 10 张报销单并输出异常清单 | expense-precheck + cap.excel.panel / cap.approval.single | L4 | reports/fin/gt-01.md | data/fin/expense-claims.xlsx → expenses.csv + invoices.csv；budget-master.xlsx → budget.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 `expense_id`） |
| GT-FIN-02 | 生成部门预算执行月报 | budget-analysis + cap.excel.panel / cap.approval.single | L4 | reports/fin/gt-02.md | 同上（主用 budget.csv，收入侧取证 revenue_ledger.csv） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（财报数字 A 级可溯，凭证级） |
| GT-FIN-03 | 发票要素校验并标记疑点 | invoice-check + cap.excel.panel / cap.approval.single | L4 | reports/fin/gt-03.md | 同上（主用 invoices.csv） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 `invoice_no`） |

### 任务分解（scene `expected_plan` 指向本页）

**GT-FIN-01 报销单预审与异常清单**
1. 读 expenses.csv 全量 29 行，按 `dept` + `period` 关联 budget.csv 的 `remain_wan`，逐笔校验：单笔 `amount_yuan > remain_wan × 10000` → **预算余额不足拦截**（样例 EXP-8824，行政部 319,180 元 > 40,000 元）。
2. 关联 invoices.csv：`expense_id` 无命中 → "发票未归档/待补件"；`check_result ≠ 通过` → 携带 `issue_type` 入异常清单（连号 / 抬头不一致 / 金额不符 / 税号格式异常 / 跨期发票）。
3. 校验审批级别与金额阈值一致（§5 复合规则）；在途行（待审批/双审批中）标注关键路径与停留期。
4. 输出异常清单：expense_id / dept / amount_yuan / 异常类型 / 命中规则号 / 证据行；落 `reports/fin/gt-01.md`；写审计（数据版本 + 产物哈希）。

**GT-FIN-02 部门预算执行月报（四必填字段可满足）**
1. 取报告期：`budget.period = 2026-09` 且 `period_type=月度`（**不得用时序戳臆造期间**；U10 曾因源数据 `period=Q4` 与报告期冲突而降级，本版已按月口径对齐）。
2. `cost_wan` = Σ`budget.used_wan`(2026-09) = 1062.00；交叉校验 Σ`expenses.amount_yuan`(period=2026-09) = 10,620,000 元 ÷10000 = 1062.00（**双向勾稽一致才可出数**）。
3. `revenue_wan` = Σ`budget.revenue_wan`(2026-09) = 1180.00；交叉校验 Σ`revenue_ledger.amount_yuan`(period=2026-09) = 11,800,000 元 ÷10000 = 1180.00。
4. `net_wan` = `revenue_wan − cost_wan` = 118.00（与 Σ`budget.net_wan` 一致）。
5. 输出部门执行表（6 部门：预算/执行/剩余/执行率/收入/净额，含 2026-08 环比），逐单元格标注证据 (文件, 行, 列)；落 `reports/fin/gt-02.md`；写审计。
6. 出数红线：四个字段任一取不到真实值时必须显式报缺口，**禁用占位值或倒轧**；本域数据下四字段均可取值，不得再以"无收入口径"为由置 null。

**GT-FIN-03 发票要素校验与疑点标记**
1. 逐行校验发票要素：`invoice_no` 唯一、`invoice_code` 12 位数字、`seller_taxid` 与 `buyer_taxid` 18 位、`buyer_title` = 主体登记名、`amount_yuan + tax_yuan = total_yuan`。
2. 连号检测：同 `seller_name` + 同 `invoice_code` + 号码尾段连续 → **直接 FAIL**（样例 INV-2026-090107 / INV-2026-090108）。
3. 抬头一致性：`buyer_title` 与主体不符 → **直接 FAIL**（样例 EXP-8813 对应发票）。
4. 金额一致性：`total_yuan ≠ expenses.amount_yuan` → FAIL（样例 EXP-8823：620,000 vs 640,000）。
5. 疑点标记：税号位数异常、开票日晚于支付日等转"疑点"人工复核；输出 checks 明细与 result；落 `reports/fin/gt-03.md`；写审计。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-FIN-01 发票要素完整性 | `invoice_no` / `invoice_code` / `invoice_date` / `seller_name` / `seller_taxid` / `buyer_title` / `buyer_taxid` / `amount_yuan` 非空；`invoice_code` 为 12 位数字；税号 18 位（本表 1 条 17 位为**故意注入样例**） | FAIL：要素缺失或格式非法不得入账；税号位数异常转人工复核 |
| V-FIN-02 价税恒等与三流一致 | 逐行 `amount_yuan + tax_yuan = total_yuan`；且 `total_yuan = expenses.amount_yuan`（同 `expense_id`） | FAIL：金额不符行不得置已批准（样例 EXP-8823） |
| V-FIN-03 连号检测 | 同销方 + 同发票代码 + 号码连续 → **直接 FAIL**（workflow acceptance 原文） | FAIL：禁止自动放行，退回报销单并记疑点（样例 INV-2026-090107/090108） |
| V-FIN-04 抬头与主体一致性 | `buyer_title` = `星桥科技（上海）有限公司` 且 `buyer_taxid` = `91310115MA1K3QX09T` | FAIL：抬头不一致一票否决（样例 EXP-8813） |
| V-FIN-05 金额阈值与审批级别 | `level` = max(科目基准级别, 金额升级规则)（§5）；金额 ≥5 万元须 `approvals ≥2`；≥30 万元必须 L4；≥50 万元加签 CFO | FAIL：级别低于规则或双审批人数不足，不得置已批准 |
| V-FIN-06 预算余额不足拦截 | 在途报销单 `amount_yuan > remain_wan × 10000` → 拦截（不许透支）；`remain_wan < 0` 即负余额为非法 | FAIL：立即阻断并转 `fin.budget-review`（样例 EXP-8824，行政部剩余 4.00 万元） |
| V-FIN-07 四表勾稽 | `Σexpenses.amount_yuan(部门,期间)/10000 = budget.used_wan`；`Σrevenue_ledger.amount_yuan(部门,期间)/10000 = budget.revenue_wan`；`budget_wan − used_wan = remain_wan`；`net_wan = revenue_wan − used_wan`；全表等式在 2026-08 / 2026-09 两期均成立 | FAIL：任一等式不成立即拒绝出数，先修数据再出报告 |
| V-FIN-08 外键与发票归档完整性 | `invoices.expense_id` ∈ `expenses.expense_id`（禁孤儿行）；`expenses.invoice_no` 未在 invoices.csv 命中时，必须在报告中列为"发票未归档/待补件"（本快照 29 张凭证中 19 张已归档、10 张待补件） | FAIL：孤儿行拒绝写入；未归档项漏报视为报告不合格 |
| V-FIN-09 财报数字 A 级可溯 | `monthly-report` 四必填字段每个值必须给出 (文件, 行, 列) 证据；成本与收入须同时给出汇总层与凭证层两个来源且相互吻合 | FAIL：无证据链或仅单一来源 → 判定 B 级并显式声明缺口，不得标注 A 级 |
| V-FIN-10 脱敏与边界 | `bank_account` 禁入任何输出（只出汇总）；`invoice_taxid` 出域前必过 `redact_gate`（只出合规结论/掩码）；`applicant_masked` 不得还原 | FAIL：任一违规即一票否决（redact_gate 未命中即出域） |
| V-FIN-11 状态迁移合法 | `expenses.status` ∈ {待预审, 待审批, 双审批中, 已批准, 已驳回, 已报销}；`invoices.check_result` ∈ {通过, 疑点, FAIL}；迁移只经唯一函数并写操作日志 | FAIL：非法枚举值拒绝写入；跳级迁移回退并记审计 |

---

## §10 特殊约束

1. **财报数字必须 A 级证据可溯（到 sheet/row）**——scene 尾注原文。`fin.monthly-report` 的 period / revenue_wan / cost_wan / net_wan 四必填字段须同时给出"汇总层（budget.csv 行）+ 凭证层（expenses.csv / revenue_ledger.csv 行）"两级证据且相互吻合（V-FIN-07/V-FIN-09）；禁用占位值、禁用倒轧、禁用外部常识补数。
2. **银行账户 L4 禁入任何输出**——scene 尾注原文。本域**不落任何银行账户明细列**，`fin.cashflow-week` 只出 `in_wan / out_wan / balance_wan` 汇总；`bank_account` 为该硬约束下的显式不落地字段。
3. **域基线 `dual_approval=false` ≠ 免审批**：两条 approve 工作流（fin.expense-approve、fin.budget-review）的 n3 审批节点强制在途（hitl_nodes=[n3]），condition 节点不得绕过审批直连写能力；发票 FAIL 与连号/抬头不一致一律**不得自动放行**。
4. **数据口径修正登记**：原 `budget.csv` 的 `period` 为季度标签 `Q4`，与 `fin.monthly-report` 的报告期（月度）冲突（U10 实跑已作为 HIGH 关注项记录）。本版把落地数据改为**月度口径**（`period=2026-08/2026-09`，`period_type=月度`），列名与列序未改；期间的"季度包"语义由 `fin.budget-review` 按月审议落地。属**数据口径修正，非 scene/manifest 改动**。
5. **GT-FIN-02 的上游缺口已闭合**：本域原有种子数据仅有费用（报销）口径，缺收入与成本口径，导致 `revenue_wan` / `net_wan` 无凭证来源而置 null（模型拒绝编造财报数字，行为正确）。本版落地 `revenue_ledger.csv`（收入凭证 15 行）并在 `budget.csv` 追加 `revenue_wan` / `net_wan` 汇总列，四必填字段均可在本域数据内取到真实值；模型不得再以"无收入来源"为由降级出数。
6. **命名差异登记（不擅自改 manifest）**：scene `knowledge_seeds` 声明 `seeds/fin/README.md`，落地种子为 `templates/knowledge/seeds/fin.md`；scene/Type-Dict 数据资产名（expense-claims.xlsx / budget-master.xlsx）与落地 CSV 名的归一化见 §1。两处均属声明侧与实物侧差异，需在 manifest 侧修复时统一。
7. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `fin` 段仍只含 5 行 expenses / 5 行 budget 且 `period=Q4` 的旧快照；**重跑该脚本会覆盖本页已补齐的 4 张表**。本域数据的权威版本以本页 §1/§1.1 为准，重跑生成器后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
8. **未采纳的参照点（及原因）**：
   - 参照 §3.2.18 的工资条/薪酬核算并入本域：薪酬核算属 comp 域（`comp.payroll-recon`），本域不重复建模，仅在 §6 登记"薪酬代垫对账"联动。
   - 参照 §7.1 的产品级种子规模（如薪酬单全员×2 月 120–400 条）：本 preset 为冷启动样例（29/19/15/12 行，均 ≥10 行校验下限），规模扩展归生成器（脚本侧）。
   - 参照 §3.2 的多维预算科目树/成本中心编码体系：本 preset 只落 6 部门 × 2 期 × 14 科目的最小可用集，维度扩展留待行业 Overlay。
   - 银行账户/资金账户台账（PRD 侧资金管理）：scene 尾注明令 L4 禁入任何输出，故**故意不落地**，只以汇总口径出现。
9. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需财务行业化（如项目制核算、多币种），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
