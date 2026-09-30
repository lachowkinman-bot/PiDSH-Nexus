# Preset 设计文档 · 行政管理（admin）

> 定位：`admin.procurement@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时只许细化、不许删域（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/admin.procurement.yaml`（domain=ADMIN；skills 3；policies：min_level=L3 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="admin"` 共 6 条）+ `manifests/workflows/admin.*.yaml`
> - Skills：`templates/skills-domain/admin/SKILL-*.md`；知识种子：`templates/knowledge/seeds/admin.md`；类型字典：`templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/admin/assets.csv`、`templates/workspace/data/admin/purchases.csv`
> - 业务参照（只读）：HR 智能体工作台设计文档 §3.2.25（资产/申领/用印/公告字段）、§3.3（ASSET_STATUS/NOTICE_STATUS 枚举）、§4.12（用印 4 节点）、§4.14（联动汇总表）、§7.1（种子规模）；PRD §3.8（H1-H8 行政后勤）

---

## §1 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| assets.csv | L2 | —（scene 声明 `pii_fields: []`）；表内含掩码使用人字段 `holder_masked`（工号掩码，不可还原） | 18 | 固定资产台账：资产编码/名称/使用人/位置/状态/分类/SN/购置价/归属部门/采购来源/入库日/最近事件；含 2 条离职释放后的闲置资产 |
| purchases.csv | L2 | —（scene 声明 `pii_fields: []`）；表内含供应商代号 `vendor_masked`（非真名） | 16 | 采购比价台账：同一 `request_id` 多供应商报价（三家原则）、单价/交期/中选标记/金额/预算判定/采购单状态，覆盖 GT-ADMIN-01 可验证比价 |

**清单—落地名归一化说明**（scene/Type-Dict 声明名 → 落地 CSV，校验器按"去扩展名 + 前缀"匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 asset-register.xlsx / type-dict 的 asset-register | assets.csv | L2 |
| scene `data_assets` 的 purchase-requests.xlsx / type-dict 的 purchase-requests | purchases.csv | L2 |

- 表头英文小写下划线、UTF-8、逗号分隔；两张表**均保留原始表头列且未删改**，仅追加列（追加列已逐字段写入 §1.1）。
- 每表数据行 ≥10（§15.4 校验下限），本页行数以上表为准（不含表头）。

### §1.1 字段级数据字典

**assets.csv**（表头逐字：`asset_id,asset,holder_masked,location,status,category,sn,price_yuan,dept,purchase_ref,acquired_date,last_event`）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| asset_id | string | 是 | 资产编码，唯一，格式 `AST-####`（参照 §3.2.25 code(AST-xxxx)）；原始列 |
| asset | string | 是 | 资产名称（含属性/位置备注，如"投影仪(会议室A)"）；原始列 |
| holder_masked | string | 是 | 使用人工号掩码（保留 `E`+2 位数字，其余 `***`，如 `E10***`）；共享资产固定为 `公共`；闲置/报废资产必须为 `公共`；原始列 |
| location | string | 是 | 存放位置/工位/仓库（如"A栋3层会议室A""研发部工位""行政仓库"）；原始列 |
| status | enum | 是 | 资产状态：在用 / 闲置 / 维修中 / 已报废（枚举与迁移见 §4）；原始列 |
| category | enum | 是 | 资产分类：IT设备 / 办公设备 / 办公家具 / 办公用品；追加列（对应参照 §3.2.25 cat） |
| sn | string | 否 | 设备序列号（掩码口径 `SN-XXnn***`）；追加列（对应参照 §3.2.25 sn） |
| price_yuan | number | 否 | 购置单价（元，整数）；与同 `purchase_ref` 中选报价行一致（§9 V-AD-06）；追加列（对应参照 §3.2.25 price） |
| dept | enum | 是 | 归属部门（词表：行政部/研发部/销售部/财务部/市场部/人力资源部），与 purchases.request_dept 同词表；追加列（对应参照 §3.2.25 user 的部门口径） |
| purchase_ref | string | 否 | 采购来源：取值=`purchases.item`（如"办公笔记本×20"）；历史批次/非采购入库为空；追加列 |
| acquired_date | date | 否 | 入库/入账日期（`YYYY-MM-DD`）；采购入库行=对应单据 `order_status=已入库` 的入库日；追加列 |
| last_event | string | 否 | 最近状态事件（含工单/流程号，是离职释放、报修、报废、盘点的追溯证据）；追加列 |

**purchases.csv**（表头逐字：`item,vendor_masked,unit_price_yuan,lead_days,selected,request_id,request_dept,qty,amount_yuan,budget_ok,quote_date,order_status,note`）

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| item | string | 是 | 采购项，格式"名称×数量"（如"办公笔记本×20"），同组比价各行一致；原始列 |
| vendor_masked | string | 是 | 供应商代号（供应商A/B/C/D，真名受 redact_gate 约束不外发）；原始列 |
| unit_price_yuan | number | 是 | 该供应商单价（元，整数）；原始列（属 procurement_price 脱敏域） |
| lead_days | number | 是 | 交付周期（自然日）；原始列 |
| selected | enum | 是 | 中选标记：No / Yes(最低价) / Yes(单一来源)；同一 `request_id` 恰一行 Yes；原始列 |
| request_id | string | 是 | 采购申请单号（如 `PR-2026-Q3-001`），同一单号的多行构成一组可验证比价；追加列 |
| request_dept | enum | 是 | 申请部门（与 assets.dept 同词表）；追加列 |
| qty | number | 是 | 数量（与 item 中"×数量"一致）；追加列 |
| amount_yuan | number | 是 | 该报价总额 = qty × unit_price_yuan（元，整数）；追加列 |
| budget_ok | enum | 是 | 部门预算是否足额：Yes / No；No 触发审批阻断（§9 V-AD-04）；追加列 |
| quote_date | date | 是 | 报价日期（`YYYY-MM-DD`）；追加列 |
| order_status | enum | 是 | 采购单状态：草稿 / 待审批 / 已批准 / 已驳回 / 已入库（迁移见 §4）；追加列 |
| note | string | 否 | 说明（中选理由/单一来源说明/驳回原因/入库日），字段内不使用英文逗号；追加列 |

---

## §2 技能规格（scene skills：purchase-compare / asset-inventory / meeting-minutes）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| purchase-compare | 采购比价（≥3 供应商） | data/admin/purchases.csv（按 `request_id` 分组报价） | reports/admin/*（比价结论，引用 `selected=Yes(最低价)` 行） | L3 | 不足三家须在 `note` 说明理由（vendor-price acceptance）；结论可溯源到行；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| asset-inventory | 资产台账盘点 | data/admin/assets.csv（全量台账） | reports/admin/*（在用/闲置/维修中/已报废 明细与差异表） | L3 | 与 assets.csv 逐行勾稽（asset-inventory acceptance）；证据到行级；连续 3 次失败→登记 capability-gap |
| meeting-minutes | 会议纪要结构化 | 会议输入（本域无对应 CSV；决议证据引用 assets/purchases 行） | reports/admin/*（decisions / todos / owners） | L3 | 待办必须带责任人与期限（meeting-minutes acceptance）；连续 3 次失败→登记 capability-gap |

- 技能文件均已声明 `min_level: L3`、`redact_gate: true`，依赖能力 `cap.excel.panel, cap.redact.all`（与 scene `required_capabilities` 一致，另含 `cap.approval.single`）。
- 意图路由技能 `admin-intent`（`templates/skills-domain/admin/SKILL-cockpit-intent.md`）把自然语言意图路由到 `purchase-approve` / `seal-request` 工作流；跨域意图交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="admin"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| admin.purchase-approve@1.0.0 | n3 approval（L4，`dual: true`）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `purchase-approve-<ts>.json`：item / qty / amount_wan / budget_ok / approvals；acceptance：预算不足直接阻断；用印强制人工 | 采购审批（DAG + 预算校验）；skill=purchase-compare |
| admin.seal-request@1.0.0 | n3 approval（L4，`dual: true`）；hitl_nodes=[n3]；另有人工确认字段 keeper_confirm | `seal-request-<ts>.json`：doc / seal_type / copies / keeper_confirm；acceptance：用印禁自动放行（必须人工确认） | 用印申请（强制人工放行）；skill=meeting-minutes（scene 与 workflow 均为该 ref） |
| admin.asset-inventory@1.0.0 | 无审批节点（report；hitl_nodes 为空） | `asset-inventory-<ts>.json`：asset_id / status / holder_masked / location；acceptance：与 assets.csv 勾稽 | 资产盘点（在用/维修/闲置）；skill=asset-inventory |
| admin.meeting-minutes@1.0.0 | 无审批节点（calc；hitl_nodes 为空） | `meeting-minutes-<ts>.json`：meeting / decisions / todos / owners；acceptance：待办必须带责任人与期限 | 会议纪要（决议/待办/责任人）；skill=meeting-minutes |
| admin.supply-order@1.0.0 | 无审批节点（calc；hitl_nodes 为空）；比价结论引用为放行条件 | `supply-order-<ts>.json`：item / vendor_masked / qty / amount_yuan；acceptance：必须引用比价结论（最低价或说明） | 办公用品下单（比价后）；skill=asset-inventory |
| admin.vendor-price@1.0.0 | 无审批节点（report；hitl_nodes 为空）；结论供采购审批取证 | `vendor-price-<ts>.json`：item / quotes / lowest / chosen；acceptance：不足三家须说明理由 | 供应商比价报告（三家原则）；skill=purchase-compare |

- 6 条工作流节点链统一为：skill(n1) → [condition(n2) + approval(n3)] → tool `cap.excel.panel.write`(n4) → audit(n5)；三条 report/calc 无 n2/n3，直接 n1 → n2(tool) → n3(audit)。上表"审批落点"列对无审批工作流明示为"无审批节点"，不存在未定义字段。
- 所有产物落 `reports/admin/`，审批类另记"审批人 + 依据数据版本 + 产物哈希"审计事件；回滚均为 savepoint（tag `pre-<workflow>`）。

---

## §4 状态机

### 4.1 资产（ASSET_STATUS，参照 §3.3 枚举名：inuse/idle/repairing/scrapped）

| 枚举（CSV 落值） | 标识符 | 含义 | 台账证据 |
|---|---|---|---|
| 在用 | inuse | 已领用/公共在用 | `holder_masked` 为掩码或 `公共`，`last_event` 有领用/盘点记录 |
| 闲置 | idle | 退库/离职释放后可再分配 | `holder_masked=公共`，`last_event` 含"离职释放（流程号，使用人已清空）"或退库记录 |
| 维修中 | repairing | 报修在途 | `last_event` 含维修工单号（样例 AST-0113 / WX-2026-0916） |
| 已报废 | scrapped | 报废审批通过，账实退出 | `last_event` 含报废审批号（样例 AST-0131 / BF-2026-0905） |

迁移：

| 迁移 | 触发 | 落账副作用 |
|---|---|---|
| 在用 → 闲置 | 离职流程完成（ER 域钩子）；到期退库 | status=闲置；holder_masked 清空为"公共"；last_event 追加释放记录 |
| 闲置 → 在用 | 再分配/新领用 | status=在用；holder_masked=工号掩码；location 更新 |
| 在用 → 维修中 | 报修受理 | status=维修中；last_event 记工单号 |
| 维修中 → 在用 | 修复验收 | status=在用；last_event 记验收结果 |
| 维修中 / 闲置 → 已报废 | 报废审批通过 | status=已报废；holder_masked=公共；last_event 记审批号（不可逆） |

### 4.2 采购单（purchases.order_status）

```
草稿 → 待审批 → 已批准 → 已入库（终态）
                 ↘ 已驳回 →（补件后重提）→ 待审批
```

| 状态 | 进入条件 | 允许后继 | 证据字段 |
|---|---|---|---|
| 草稿 | 需求登记、尚未完成比价 | 待审批 | 同 `request_id` 行 <3 且 `note` 未说明单一来源时不得前进 |
| 待审批 | 比价完成（≥3 家，或已说明单一来源） | 已批准 / 已驳回 | 恰一行 `selected=Yes(...)`；`budget_ok=No` 只能走向已驳回 |
| 已批准 | 审批通过（金额阈值与双审批规则见 §5） | 已入库 / 已驳回 | `approvals ≥1`（单笔 ≥5 万元须 ≥2）；`budget_ok=Yes` |
| 已驳回 | 预算不足 / 比价不合规 / 审批驳回 | 补件后回到待审批 | `note` 必填驳回原因（样例 PR-2026-Q3-006） |
| 已入库 | 收货验收入账 | —（终态） | assets 新增行（`purchase_ref`=item、`acquired_date`=入库日、`price_yuan`=中选单价） |

### 4.3 用印（参照 §4.12 四节点流程）

```
待审批 →（部门负责人 → 行政初审 → 授权人盖章）→ 已批准 → 归档
```

| 状态 | 进入条件 | 允许后继 | 证据字段 |
|---|---|---|---|
| 待审批 | 提交申请（文件/用印类型/份数） | 已批准（或驳回后重新提交） | seal-request-n3 待办；申请单字段 doc/seal_type/copies |
| 已批准 | 四级节点通过且 `keeper_confirm=true` | 归档（终态） | `keeper_confirm=true`；audit n5（审批人+数据版本+产物哈希） |

- 流程实例状态（FLOW_STATUS：running / done / rejected / cancelled）与单据状态解耦：流程 `done` 后由 after_complete 钩子回写单据状态（不双向依赖）。
- 公告联动枚举（工作台实体，非本域 CSV）：NOTICE_STATUS = draft / published（参照 §3.3），用印完成触发的公示草稿为 draft，人工发布置 published。

---

## §5 审批链（节点-角色-双审批-金额阈值）

| 流程 | 节点链 | 审批角色 | 双审批 | 金额/条件阈值 | manifest 落点 |
|---|---|---|---|---|---|
| 采购（admin.purchase-approve） | 申请提交 → purchase-compare 比价 → 预算校验（budget_ok）→ 审批 → 入库 | 申请部门负责人 →（阈值满足时）行政负责人 + 财务负责人 | 单笔中选总额 ≥ 50,000 元：双审批；< 50,000 元：单审批（行政负责人） | 预算不足（budget_ok=No）无条件阻断；比价不足三家且无说明阻断 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 用印（admin.seal-request） | 提交申请（文件/类型/份数）→ 部门负责人审批 → 行政初审 → 授权人盖章 | 部门负责人 → 行政专员 → 印章保管人 | 任何用印均须双审批落点 + 保管人人工确认（keeper_confirm） | 无金额豁免：任何用印动作强制 HITL，禁自动放行 | n3 approval（L4 + `dual:true`）+ `keeper_confirm` 字段 |
| 领用/用品下单（admin.supply-order） | 引用比价结论 → 下单 → 领用登记 | 资产/用品管理员（登记人） | 无审批节点；聚合金额 ≥ 50,000 元转采购审批（上表第一行，走 L4 双审批） | 必须引用 `selected=Yes(最低价)` 或说明理由 | 无 approval 节点（calc，hitl_nodes 为空） |

- 场景基线 `policies.permission.dual_approval=false`、`min_level=L3` 为**域默认**；上表两条 approve 工作流在流程级升格为 L4 双审批（与 workflow YAML 一致），规则单调加严、不放松。
- 50,000 元为本文档细化阈值（manifest 未写死数值）；定制时必须与 scene/workflow 配置保持同一数值并只允许加严。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| ER 离职流程完成（er-eap.offboard-approve done） | 名下资产释放：assets.status 置 `闲置`、`holder_masked` 清空为 `公共`、`last_event` 追加"离职释放（流程号，使用人已清空）" | assets.csv：status / holder_masked / last_event（样例 AST-0121 挂 ER-2026-0912、AST-0127 挂 ER-2026-0815） |
| 采购审批通过并入库（admin.purchase-approve done） | 资产台账新增：分配 asset_id、`price_yuan`=中选单价、`purchase_ref`=采购项、`acquired_date`=入库日 | assets.csv：purchase_ref / acquired_date / price_yuan / last_event；purchases.csv：order_status=已入库、selected=Yes(最低价) |
| 比价完成（admin.vendor-price） | 下单（admin.supply-order）必须引用最低价结论；不足三家须写明理由 | purchases.csv：request_id / selected / note；supply-order-<ts>.json：vendor_masked / qty / amount_yuan |
| 用印完成（admin.seal-request done） | ①seal_record 经 redact_gate 脱敏后归档；②需公示的用印由钩子生成公告草稿（NOTICE_STATUS=draft），人工发布置 published | seal-request-<ts>.json：keeper_confirm=true / seal_type / copies；audit n5（审批人+数据版本+产物哈希）；公告状态挂工作台实体（本 preset 不新增 CSV） |
| 会议纪要完成（admin.meeting-minutes） | 待办进入跟踪视图；逾期升级提醒；责任人/期限必填 | meeting-minutes-<ts>.json：todos / owners（含期限） |
| 资产盘点差异（admin.asset-inventory） | 账实不符转整改：报修→维修中、退库→闲置、报废审批→已报废 | asset-inventory-<ts>.json：asset_id / status / holder_masked / location 与 assets.csv 逐行勾稽 |

---

## §7 权限矩阵

- 最低数据级别：**L3**（scene `policies.permission.min_level=L3`）；双审批：域基线 `false`，流程级升格见 §5。
- 脱敏字段（redact_gate）：`seal_record`、`procurement_price`（scene `policies.redact.fields`，gate=`redact_gate`）。落地映射：purchases 的 `unit_price_yuan` / `amount_yuan` 属 `procurement_price`；用印申请与其归档记录属 `seal_record`。
- 记忆层策略（scene `policies.memory`）：`pii_allowed=false`、`exclude=[]` —— 本域 PII 一律禁入记忆层，产物只落 `reports/admin/`。

| 对象 | 级别 | 脱敏（redact_gate） | 记忆层 | 双审批 |
|---|---|---|---|---|
| assets.csv（使用人 `holder_masked`） | L2 | 使用人类字段出域/出报告一律用掩码（如 `E10***`），掩码前值永不落产物 | PII 禁入（可入仅非 PII 状态/汇总结论） | 否（域基线）；触发采购审批时按 §5 |
| purchases.csv（`unit_price_yuan` / `amount_yuan`） | L2 | `procurement_price` 命中：对外/出域仅出区间或中选结论，报价真名不外发 | PII 禁入 | 单笔 ≥5 万元：是（行政负责人+财务负责人） |
| 用印申请与归档（`seal_record`） | L3（min_level 口径） | 强制脱敏后归档，原件不出域 | 禁入 | 强制：所有用印 + 保管人人工确认 |

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-ADMIN-01 | 生成办公用品采购比价与审批单 | purchase-compare + cap.excel.panel / cap.approval.single | L3 | reports/admin/gt-01.md | data/admin/purchase-requests.xlsx → purchases.csv；data/admin/asset-register.xlsx → assets.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（按 `request_id` 行级） |
| GT-ADMIN-02 | 输出季度资产盘点差异表 | asset-inventory + cap.excel.panel | L3 | reports/admin/gt-02.md | 同上（主用 assets.csv） | 读/算/写审计事件 | 与 assets.csv 逐行勾稽，差异可溯源 |
| GT-ADMIN-03 | 生成会议纪要并跟踪待办 | meeting-minutes + cap.excel.panel | L3 | reports/admin/gt-03.md | 同上（决议/待办证据引用两表行） | 读/算/写审计事件 | 待办含责任人与期限，引用行可溯源 |

### 任务分解（scene `expected_plan` 指向本页）

**GT-ADMIN-01 采购比价与审批单**
1. 读 purchases.csv，按 `request_id` 分组，取组内 `unit_price_yuan` 最低行，校验每组 ≥3 家（不足三家必须引用 `note` 的单一来源说明）。
2. 计算中选总额 = qty × 最低单价，与 `budget_ok` 比对；`budget_ok=No` 输出"预算不足阻断"结论，不得生成通过单（样例 PR-2026-Q3-004）。
3. 生成比价对照（item / 各供应商单价与交期 / 中选与理由），逐行引用 csv。
4. 中选总额 ≥5 万元 → 标注 L4 双审批（行政负责人+财务负责人）；生成审批单字段 item / qty / amount_wan / budget_ok / approvals。
5. 落 `reports/admin/gt-01.md`；写审计（数据版本 + 产物哈希）。

**GT-ADMIN-02 季度资产盘点差异表**
1. 读 assets.csv 全量；按 `status` 分组统计（在用/闲置/维修中/已报废）并输出明细。
2. 逐行核对 `last_event` 与状态闭环：维修中未验收、闲置未再分配、已报废未清账 → 记差异。
3. 校验使用人与部门一致性（holder≠公共 时 dept 必须与 `purchase_ref` 对应采购的 `request_dept` 一致，历史批次允许空 `purchase_ref`）。
4. 输出差异表（asset_id / asset / status / holder_masked / location / dept / 差异类型 / 证据行）。

**GT-ADMIN-03 会议纪要并跟踪待办**
1. 将会议输入结构化为 decisions / todos / owners。
2. 每条待办必须带负责人与期限，否则不得输出。
3. 决议引用台账证据（如"会议椅已入库"引用 purchases.csv `order_status=已入库` 与 assets.csv AST-0122~AST-0125）。
4. 落 `reports/admin/gt-03.md`，待办进入跟踪视图。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-AD-01 资产编码唯一 | `asset_id` 非空、唯一、匹配 `^AST-\d{4}$`；追加行按序号递增 | FAIL：重复/格式错行不得入账 |
| V-AD-02 采购三家比价完整性 | 同 `request_id` 行数 ≥3 且恰一行 `selected=Yes(最低价)`；行数 <3 时 `note` 必须写明单一来源理由；行数 <3 且 `order_status ∈ {已批准, 已入库}` | FAIL：阻断审批；缺理由的单一来源转人工说明 |
| V-AD-03 金额阈值触发审批 | 单 `request_id` 中选总额（qty × 最低单价）≥50,000 元 → `approvals` ≥2（L4 双审批）；<50,000 元 → ≥1 | FAIL：未达人数不得置已批准 |
| V-AD-04 预算硬约束 | `budget_ok=No` 时 `order_status` 不得为 已批准/已入库 | FAIL：立即阻断并回退单据状态 |
| V-AD-05 使用人与部门一致性 | `holder_masked≠公共` 时 `dept` 必属部门词表；`purchase_ref` 非空时 `dept` 必须等于该采购的 `request_dept`；闲置/已报废行 `holder_masked` 必须为 `公共` | FAIL：行标记"归属不明"并转人工核对 |
| V-AD-06 金额勾稽 | `amount_yuan = qty × unit_price_yuan`（逐行）；`purchase_ref` 非空时 `assets.price_yuan` = 该采购中选行 `unit_price_yuan` | FAIL：金额不一致行不得入账 |
| V-AD-07 状态枚举合法 | `assets.status ∈ {在用, 闲置, 维修中, 已报废}`；`purchases.order_status ∈ {草稿, 待审批, 已批准, 已驳回, 已入库}` | FAIL：非法枚举值拒绝写入 |
| V-AD-08 用印人工放行 | `keeper_confirm=true` 才可置 已批准；`seal_record` / `procurement_price` 出域前必须过 redact_gate | FAIL：禁放行；redact_gate 未命中即出域＝一票否决 |
| V-AD-09 会议待办完整性 | todos 每条含 owner 与期限 | FAIL：缺项不得输出纪要 |
| V-AD-10 离职释放闭环 | `last_event` 含"离职释放"的行必须 status=闲置、holder_masked=公共、且事件含流程号 | FAIL：闭环缺失转 ER 域核对 |

---

## §10 特殊约束

1. **用印不允许任何自动化放行（强制 HITL）**——scene 尾注原文；`seal-request` 必须人工确认（`keeper_confirm=true`），并以审计 n5 记录审批人/数据版本/产物哈希；不得以"低风险用印""例行文件"为由走自动化路径。
2. **域基线 `dual_approval=false` ≠ 免审批**：两条 approve 工作流的 n3 审批节点强制在途（hitl_nodes=[n3]），condition 节点不得绕过审批直连写能力（CR-checklist 工作流类判据）。
3. **redact_gate 前置**：`procurement_price`（单价/金额）与 `seal_record` 原值不出域、不入记忆层；供应商真名以 `vendor_masked` 代号流转。
4. **数据资产边界**：本域仅 2 项数据资产（assets.csv / purchases.csv），本 preset 不新增数据文件；申领、会议室、公告、团建等实体属工作台侧或跨域（PRD H2/H3/H6/H7），仅在 §6 登记联动状态。
5. **命名差异登记（不擅自改 manifest）**：scene `knowledge_seeds` 声明 `seeds/admin/README.md`，落地种子为 `templates/knowledge/seeds/admin.md`；scene/Type-Dict 数据资产名与落地 CSV 名的归一化见 §1。两处均属声明侧与实物侧的命名差异，需在 manifest 侧修复时统一。
6. **未采纳的参照点（及原因）**：
   - 用品申领/会议室/团建/公告独立台账（参照 §3.2.25 supplyReqs 与 PRD H2/H3/H6/H7）：scene 仅声明 2 项数据资产，新增 CSV 会破坏 scene↔数据一致性；仅在 §6 以联动状态登记。
   - 资产种子规模 30–50 行（参照 §7.1）：属工作台产品级种子上限；本 preset 为冷启动样例（18 行 ≥10 行校验下限），规模扩展归生成器。
   - 资产 `serial` 等完整字段：以追加列 `sn/category/price_yuan` 对齐参照 §3.2.25 的 sn/cat/price，其余扩展字段落在工作台实体侧。
7. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需行政行业化（如校准类资产、特种设备），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
