# Preset 设计文档 · 绩效管理（prf）

> 基线：`manifests/scenes/prf.calibration.yaml`（scene_id `prf.calibration@1.0.0`）与 `manifests/workflows/index.json`（domain=prf，共 6 条）双向核对；数据资产落地于 `templates/workspace/data/prf/`。
> 015 §9.2 自制层基线。Agent 定制化时只许细化、不许删域（§8.3）；本域技能/工作流清单以下方 §2/§3 为准，不得增删。

## 1. 数据字典（总表）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| `templates/workspace/data/prf/kpi.csv` | L2 | — | 16 | KPI 追踪明细（7 名员工 × 1-3 项指标）。目标/实际/达成率/权重/预警状态，供 GT-PRF-01、GT-PRF-03 溯源 |
| `templates/workspace/data/prf/calibration.csv` | L4 | review_score, review_note | 16 | 绩效校准与考评结果（16 人 · 周期 Q4-2026；其中 14 人已校准、2 人在途）。供 GT-PRF-02 与强制分布校验溯源 |

**声明资产 ↔ 落地文件对照**（scene 声明 xlsx 规格，模板目录以 CSV 落地，字段口径一致）：

| scene `data_assets` 声明 | 声明级别 | 落地文件 | 落地级别 |
|---|---|---|---|
| `kpi-master.xlsx` | L2 | `data/prf/kpi.csv` | L2 |
| `review-results.xlsx` | L4 | `data/prf/calibration.csv` | L4 |

**PII 字段口径映射**（scene `redact.fields` → 实际列）：`review_score` → `calibration.csv` 的 `self_score`/`mgr_score`/`final_score`；`review_note` → `calibration.csv` 的 `delta_note`。脱敏在 `redact_gate` 前置执行，下游报告与记忆层只见脱敏值。

## 1.1 字段级数据字典

### 1.1.1 `kpi.csv`（KPI 追踪表，L2）

表头：`kpi,target,actual,rate,period,employee_masked,dept,position,weight,status`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kpi | string | 是 | 指标名（如 新签销售额(万)/客户续约率/需求交付准时率/人效指数）。同名指标可跨员工复用，靠 `employee_masked` 区分 |
| target | number | 是 | 周期目标值；百分比类指标以 92 表示 92%，金额类以万为单位（表头单位见 `kpi` 括号） |
| actual | number | 是 | 周期实际值，与 `target` 同口径 |
| rate | number | 是 | 达成率 = `actual / target × 100`，保留 1 位小数；见 §9 V8 |
| period | string | 是 | 周期简写（本批 Q4）。完整周期标识见 `calibration.csv.cycle`（Q4-2026），本季度二者一一对应 |
| employee_masked | string | 是 | 〔追加列〕员工脱敏工号 `EMP-****NN`，与 `calibration.csv.employee_masked` 同源可 join；全表为合成 ID |
| dept | string | 是 | 〔追加列〕所属部门，须与 `calibration.csv` 同一员工的 `dept` 一致 |
| position | string | 是 | 〔追加列〕岗位名（如 客户经理/后端工程师），用于目标分解到岗位（GT-PRF-03） |
| weight | number | 是 | 〔追加列〕该指标在本员工本周期内的权重（%）；同一 `employee_masked` 下 `weight` 合计必须 = 100，见 §9 V4 |
| status | string | 是 | 〔追加列〕追踪预警状态：`on_track` / `at_risk` / `behind`（词表对齐 OKR_STATUS，未新增全局枚举）；阈值见 §9 V9 |

**本表内样本自洽点**：`EMP-****84`（研发部 · 前端工程师）`需求交付准时率` 达成率 75.0 → `behind`，与 `calibration.csv` 中该员工 `delta_note=下调：交付延期` 互为佐证。

### 1.1.2 `calibration.csv`（校准与考评结果表，L4）

表头：`employee_masked,dept,manager_grade,calibrated_grade,delta_note,self_score,mgr_score,final_score,cycle,status`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| employee_masked | string | 是 | 员工脱敏工号 `EMP-****NN`；同一周期内唯一（本表 16 行 = 16 人），合成员标识 |
| dept | string | 是 | 所属部门（销售部/研发部/市场部/财务部/行政部） |
| manager_grade | enum | 已校准行必填 | 主管评分档位（S/A/B/C/D），等于 `final_score` 按 §4.3 阈值映射的结果；即在途/申诉前不得由人工直填 |
| calibrated_grade | enum | 校准后必填 | 校准会议调整后等级（S/A/B/C/D）。为强制分布（§9 V5/V6）与等级分布比对（`prf.grade-distribution`）的统计口径字段 |
| delta_note | string | 否 | 校准调整说明（= scene 的 `review_note`，脱敏字段）。`超出：*` 表示上调、`下调：*` 表示下调、`一致*` 表示维持 |
| self_score | number | 否 | 〔追加列〕员工自评 0-100，整数；= scene 的 `review_score` 之一 |
| mgr_score | number | 否 | 〔追加列〕主管评分 0-100，整数；= scene 的 `review_score` 之一 |
| final_score | number | 否 | 〔追加列〕终评 = `self_score × 20% + mgr_score × 80%`，保留 1 位（可配 30/70，见 §9 V3）；= scene 的 `review_score` 之一 |
| cycle | string | 是 | 〔追加列〕考核周期标识（Q4-2026），与 `kpi.csv.period`（Q4）对应 |
| status | enum | 是 | 〔追加列〕考评状态机当前态：`pending_self` / `pending_mgr` / `pending_confirm` / `done` / `appeal`，见 §4.1 |

**空值语义**（在途行允许空，非数据缺失）：`pending_mgr` 行的 `manager_grade`/`calibrated_grade`/`mgr_score`/`final_score` 为空；`pending_self` 行除 `employee_masked`/`dept`/`cycle`/`status` 外全空。强制分布与等级映射的统计口径为 **`calibrated_grade` 非空的行**（本批 14 行），在途行不计入分母。

**本表样本快照（校准后分布，n=14）**：

| 档位 | 人数 | 实测占比 | 强制分布线 | 偏离 | 校验结论 |
|---|---|---|---|---|---|
| S | 1 | 7.1% | 展示项 | — | 展示 |
| A 档（S+A） | 5 | 35.7% | ≤ 20% | +15.7pct | **超限 · 红色预警** |
| B | 4 | 28.6% | ≤ 40% | −11.4pct | 标红（偏离 >5pct） |
| C | 4 | 28.6% | 展示项 | — | 展示 |
| D | 1 | 7.1% | 展示项 | — | 展示 |
| 合计 | 14 | 100.0% | — | — | — |

> 该快照故意构造为「A 档超限」场景：GT-PRF-02 与 `prf.grade-distribution` 必须输出红警并要求回调，用于验证强制分布校验真实生效（见 §9 V5/V6）。

## 2. 技能规格

本域技能取自 scene `skills`，共 3 个，无第 4 个。

| 技能 | 用途 | 输入 | 输出 | 权限 | 落点工作流 |
|---|---|---|---|---|---|
| `kpi-track` | KPI 实际 vs 目标追踪、达成率与预警分级、未达标项清单 | `data/prf/kpi.csv`（L2） | `reports/prf/kpi-tracking-<ts>.json`；预警清单 md | L2 读、L4 写回（写回走审批节点） | `prf.kpi-tracking`、`prf.review-cycle` |
| `calibration-analysis` | 校准分析：等级分布、强制分布比对、离散度（标准差/极差）、校准前后位移 | `data/prf/calibration.csv`（L4） | `reports/prf/calibration-approve-<ts>.json`、`grade-distribution-<ts>.json` | L4 + 双审批 | `prf.calibration-approve`、`prf.grade-distribution` |
| `goal-cascade` | 目标分解：公司→部门→岗位/人，权重分配校验（合计=100） | `data/prf/kpi.csv`（L2，指标/权重列） | `reports/prf/cascade-report-<ts>.json`、`one-on-one-<ts>.json` | L2 读、L4 写回 | `prf.cascade-report`、`prf.one-on-one` |

> 3 技能 × 2 工作流 = 6，与本域注册的 6 条工作流一一对应（`kpi-track`2 + `calibration-analysis`2 + `goal-cascade`2），无孤立技能、无孤立工作流。

## 3. 工作流

本域全部 **6 条**（注册表 `manifests/workflows/index.json` 中 `domain=prf`；scene `workflows` 仅主声明前 2 条，其余 4 条为同域注册工作流）。审批落点取自 nodes 中的 `approval` 节点；无 approval 节点者以 `audit` 节点为落点。

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| `prf.calibration-approve@1.0.0` | **n3 approval（level=L4，dual=true）**，hitl_nodes=[n3]；通过后 n4 写盘、n5 审计 | `calibration-approve-<ts>.json`；字段 `employee_masked, manager_grade, calibrated_grade, approvals`；acceptance：校准纪要禁入记忆层 | 绩效校准（双审批）。本域唯一 HITL 工作流；审批人 + 依据数据版本 + 产物哈希入审计；回滚 savepoint `pre-calibration-approve` |
| `prf.cascade-report@1.0.0` | 无 HITL（hitl_nodes 为空）；落点 n3 audit | `cascade-report-<ts>.json`；字段 `level, owner_masked, goal, weight`；acceptance：**权重合计必须 = 100%** | 目标分解报告（公司→部门→人）。回滚 savepoint `pre-cascade-report` |
| `prf.kpi-tracking@1.0.0` | 无 HITL；落点 n3 audit | `kpi-tracking-<ts>.json`；字段 `kpi, target, actual, rate`；acceptance：数据可追溯 kpi.csv | KPI 追踪（实际 vs 目标）。触发命令 `kpi-tracking`；回滚 savepoint `pre-kpi-tracking` |
| `prf.review-cycle@1.0.0` | 无 HITL；落点 n3 audit | `review-cycle-<ts>.json`；字段 `cycle, template, targets, deadline`；acceptance：**全员覆盖校验（无遗漏人）** | 考核周期发起（模板下发）。回滚 savepoint `pre-review-cycle` |
| `prf.one-on-one@1.0.0` | 无 HITL；落点 n3 audit | `one-on-one-<ts>.json`；字段 `employee_masked, topics, actions, next_date`；acceptance：**纪要默认不入记忆层** | 一对一沟通纪要（结构化）。回滚 savepoint `pre-one-on-one` |
| `prf.grade-distribution@1.0.0` | 无 HITL；落点 n3 audit | `grade-distribution-<ts>.json`；字段 `grade, count, pct, target_pct`；acceptance：**偏离强制分布线 >5pct 标红** | 等级分布与强制分布比对。回滚 savepoint `pre-grade-distribution` |

**共性约定**：6 条均为 `trigger.type=command`；n1 为 skill 节点、n2（或 n2/n3）为 `cap.excel.panel.write`、末节点为 audit（记录「数据版本 + 产物哈希」，仅校准流额外记录「审批人」）；全部提供 savepoint 回滚。n2 为 `condition` 的判定语义：命中「对外/生效动作」时才进入审批节点。

## 4. 状态机

### 4.1 绩效考评状态机（PERF_STATUS，5 态）

| 状态 | 含义 | 迁入条件 | 迁出 | 可操作角色 |
|---|---|---|---|---|
| `pending_self` | 待自评 | 周期进入 `self_eval`，系统为该员工生成考评记录 | → `pending_mgr`（员工提交自评，`self_score` 必填 0-100） | employee（本人） |
| `pending_mgr` | 待主管评分 | 自评已提交 | → `pending_confirm`（主管提交 `mgr_score`，系统算出 `manager_grade` 与 `final_score`） | 直属主管 / hr |
| `pending_confirm` | 待 HR 终评确认 | 主管评分已提交 | → `done`（HR 终评确认；校准结果生效并通知） | hr / admin |
| `done` | 已完成 | HR 确认终评；定级、分布校验完成 | → `appeal`（员工在窗口期内申诉） | hr / admin（重开需审计） |
| `appeal` | 已申诉 | 员工对终评/等级提出申诉（`done` 后且在申诉窗口内） | → `done`（HR 复核，结论为「已维持」或「已改判」；已改判须回写 `calibrated_grade` 与 `delta_note`） | hr / admin + 员工发起 |

```
pending_self --员工提交自评--> pending_mgr --主管评分--> pending_confirm --HR终评确认--> done
done --员工申诉--> appeal --HR复核(维持/改判)--> done
```

**本批 seed 覆盖**：`done` 11 行、`appeal` 2 行（`EMP-****29`、`EMP-****73`，均为被下调等级者）、`pending_confirm` 1 行（`EMP-****84`）、`pending_mgr` 1 行（`EMP-****26`）、`pending_self` 1 行（`EMP-****44`）——5 态全部有真实行样例。

### 4.2 考核周期状态机（CYCLE_STAGE，6 阶段）

| 阶段 | 含义 | 迁入条件 | 该阶段允许的动作 |
|---|---|---|---|
| `goal_setting` | 目标设定 | 周期创建（`prf.review-cycle` 下发模板） | 目标分解（`prf.cascade-report`）、权重分配校验（合计=100） |
| `executing` | 执行 | 目标设定完成并确认 | KPI 追踪与预警（`prf.kpi-tracking`） |
| `self_eval` | 自评 | 到达周期截止；系统为全员生成考评记录（`pending_self`） | 员工提交自评（0-100） |
| `supervisor_eval` | 上级评 | 自评截止 | 主管评分（0-100）→ 生成 `final_score` 与 `manager_grade` |
| `calibration` | 校准 | 主管评分截止 | 校准会议（`prf.calibration-approve` 双审批）、等级分布比对（`prf.grade-distribution`）、强制分布校验 |
| `completed` | 完成 | 校准结果双审批通过并确认终评 | 结果通知、面谈（`prf.one-on-one`）、申诉窗口受理 |

### 4.3 绩效等级阈值（GRADE）

| 等级 | 终评 `final_score` 区间 | 强制分布线 | 说明 |
|---|---|---|---|
| S | ≥ 90 | 计入 A 档（S+A ≤ 20%） | 卓越 |
| A | 80 ≤ score < 90 | 计入 A 档 | 优秀 |
| B | 70 ≤ score < 80 | ≤ 40% | 达标 |
| C | 60 ≤ score < 70 | 展示项 | 待改进，进入 PIP 观察 |
| D | < 60 | 展示项 | 不合格，强制 PIP + 影响调薪 |

> `manager_grade` 与 `final_score` 的映射必须自动计算、不得人工直填（见 §9 V3/V10）；`calibrated_grade` 允许在校准会议中跨档调整，但每一次调整必须落 `delta_note`。

## 5. 审批链

scene `policies.permission` 只声明 `min_level: L4` 与 `dual_approval: true`，**未指定审批角色**；下表角色为 preset 默认约定（可定制替换，但「双审批」不可降级为单审批）。

| 节点 | 角色（默认约定） | 级别 | 是否双审批 | 动作 | 审计留痕 |
|---|---|---|---|---|---|
| `prf.calibration-approve` · n3（第 1 签） | HRD（人力资源负责人） | L4 | **是**（串行两签，两签齐备方可生效） | 通过 → 第 2 签；驳回 → 终止并回滚 savepoint `pre-calibration-approve` | 审批人 + 时间 + 依据数据版本 |
| `prf.calibration-approve` · n3（第 2 签） | 业务分管高管（默认；与薪酬联动场景可配 CFO） | L4 | **是** | 通过 → n4 写入 `calibration-approve-<ts>.json`，校准结果生效并通知 | 审批人 + 时间 + 产物哈希 |
| `prf.calibration-approve` · n5 | 系统（audit） | — | — | 落审计：审批人 + 依据数据版本 + 产物哈希 | 审计事件（不可篡改） |

- **无需审批的 5 条**（`cascade-report` / `kpi-tracking` / `review-cycle` / `one-on-one` / `grade-distribution`）`hitl_nodes` 为空，落点为各自 audit 节点，属「读/算/报」类，不产生对外生效动作。
- **终评确认（`pending_confirm → done`）与校准结果生效共用同一条双审批链**：校准结果一旦生效即进入 `completed`，其后仅申诉复核可改判。
- **强制分布超限时的审批约束**：校准结果若触发 A 档 >20% 红警，不得直接生效，须回调等级后重新提交双审批。

## 6. 跨域联动

| 触发（prf 侧） | 联动副作用 | 证据字段 / 落地 |
|---|---|---|
| `calibrated_grade ∈ {C, D}` | 触发 PIP 改进计划：行动项 / 检查点 / 进度 / 导师；actions 状态（未开始/进行中/已完成） | **域内**（PRD D8）；本域暂无 PIP 独立资产表，PIP 明细由报告与 `calibration.csv.status`+`delta_note` 溯源 |
| `calibrated_grade ∈ {S, A}` | 进入调薪/晋升候选池 → comp 域调薪队列（`current_band → proposed_band`） | `comp/adjust_queue.csv`：`employee_masked, current_band, proposed_band, reason, status, approvals`；种子中 `EMP-****12`、`EMP-****35` 与本域花名册同 ID、同掩码口径（`EMP-****NN`），可直接 join。**待对齐**：comp 侧 `reason` 含等级字样的行（如 `绩效调薪（A 等）`）与本域 `calibrated_grade` 尚未逐人对齐——本批 `EMP-****07`、`EMP-****29` 在 comp 记为 A 等/B 等，而本域校准结果为 C，应以本域校准结果为准回写或调整 comp 侧口径 |
| `status = appeal`（申诉） | er 域生成员工关系案件（`case_type=绩效申诉`），进入调解/沟通闭环 | `er-eap/er_cases.csv`：`case_type, employee_masked, stage, owner, case_date`；种子 `ER-1201` 即 `case_type=绩效申诉`。**待对齐**：该表 `employee_masked` 用 `E1***` 格式，与本域 `EMP-****NN` 不同源，跨域 join 需先统一掩码口径 |
| 等级 D 或连续两周期 C | 劳动合同/离职风险管理（er 域），并冻结晋升资格 | `er-eap/er_cases.csv`（`case_type=离职交接` / `stage`），触发规则在 er 域侧执行 |
| 能力短板 / 未达标项（KPI `behind`/`at_risk`） | 生成培训需求 → trn 域课程与学时计划 | **接口约定**（尚无员工级落地字段）：trn 现有资产为课程级（`trn/courses.csv`：`course, hours, enrolled, next_session, category`），员工级需求需 trn 侧补 join key 后生效 |
| 校准纪要 / 面谈纪要产物 | **阻断入记忆层**（graph-memory / pi-hermes-memory 均不写入） | workflow acceptance：`校准纪要禁入记忆层`、`纪要默认不入记忆层`；记忆层策略见 §7 |
| A 档占比超限（>20%） | 阻断校准结果生效，回调等级后重新双审批 | `grade-distribution-<ts>.json` 的 `pct` vs `target_pct`；本批 seed 实测 A 档 35.7%（超限） |

## 7. 权限矩阵

**策略来源**：scene `policies`（`permission.min_level=L4`、`permission.dual_approval=true`、`redact.fields=[review_score, review_note]`、`redact.gate=redact_gate`、`memory.pii_allowed=false`、`memory.exclude=[]`）。

| 维度 | 取值 | 落地要求 |
|---|---|---|
| 最低数据级别 | **L4** | 读 `calibration.csv`（考核结果）必须 L4；`kpi.csv` 为 L2，可按 L2 读、写回走 L4 |
| 双审批 | **true** | 仅 `prf.calibration-approve` 触发；两签角色不得为同一人，不得降级 |
| 脱敏字段 | `review_score` → `self_score`/`mgr_score`/`final_score`；`review_note` → `delta_note` | 过 `redact_gate` 前置；报告、界面列表、日志一律只见脱敏值 |
| 记忆层 | `pii_allowed=false`；`exclude=[]` | 无额外实体排除项；**叠加域内约定**：校准纪要、一对一纪要默认不入记忆层（两条 workflow acceptance）。个体级 PII 字段不入实体属性（`templates/knowledge/seeds/prf.md` 建图规则） |
| 角色可见性 | admin/hr：全量行（含完整 L4 明细）；employee：仅本人考评结果可见、可提交自评、可发起申诉；candidate：不可见 | 行级过滤 `empId === currentEmp()`；无 approve 能力位不渲染审批按钮 |
| 技能权限 | `kpi-track` L2 读 / L4 写回；`calibration-analysis` L4 + 双审批；`goal-cascade` L2 读 / L4 写回 | 见 §2 |
| 审计 | 全部 6 条工作流必产审计事件（读/算/写）；校准流额外记录审批人 | 审计字段：数据版本 + 产物哈希（+审批人） |

## 8. Golden Tasks

与 scene `golden_tasks` 完全一致（3 条，八元组摘录）：

| ID | input | expected_tools | expected_permission | expected_files | expected_output | expected_audit | expected_quality |
|---|---|---|---|---|---|---|---|
| GT-PRF-01 | 生成本季度 KPI 追踪与预警清单 | cap.excel.panel, cap.approval.multi | L4+双审批 | data/prf/kpi-master.xlsx, data/prf/review-results.xlsx | reports/prf/gt-01.md | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |
| GT-PRF-02 | 输出校准会议材料（分布+离散度） | cap.excel.panel, cap.approval.multi | L4+双审批 | data/prf/kpi-master.xlsx, data/prf/review-results.xlsx | reports/prf/gt-02.md | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |
| GT-PRF-03 | 把部门目标分解到岗位并生成追踪表 | cap.excel.panel, cap.approval.multi | L4+双审批 | data/prf/kpi-master.xlsx, data/prf/review-results.xlsx | reports/prf/gt-03.md | 读/算/写审计事件 + 双审批记录 | 结论可溯源到 sheet/row 级证据 |

**任务分解（expected_plan 指向本节）**：

- **GT-PRF-01**：① 读 `kpi.csv`（L2）→ ② 逐行校验 `rate = actual/target×100`（V8）→ ③ 按 §9 V9 分级 `on_track/at_risk/behind`，`behind` 行置顶红标 → ④ 汇总预警清单（本批 `behind` 1 行 `EMP-****84`，`at_risk` 5 行）→ ⑤ 写 `reports/prf/gt-01.md`，每行证据给到 `kpi + employee_masked`（row 级）。
- **GT-PRF-02**：① 读 `calibration.csv`（L4，过 redact_gate）→ ② 校验 `final_score = self×20% + mgr×80%`（V3）与 `manager_grade` 映射（§4.3）→ ③ 计算等级分布与离散度（标准差/极差）→ ④ 执行强制分布校验（V5/V6），本批输出 **A 档 35.7% 超限红警**、B 档偏离 −11.4pct 标红 → ⑤ 写 `reports/prf/gt-02.md`（仅脱敏行，不含个体分数明文）。
- **GT-PRF-03**：① 读 `kpi.csv` 指标与权重 → ② 按 公司→部门→岗位/人 三层分解（`level/owner_masked/goal/weight`）→ ③ 校验同一 owner 权重合计 = 100%（V4）→ ④ 生成追踪表 `reports/prf/gt-03.md`；若走 `prf.cascade-report`，交付物为 `cascade-report-<ts>.json`。

## 9. 校验规则

| 编号 | 规则 | 口径 / 阈值 | 违规处置 | 命中本批 seed |
|---|---|---|---|---|
| V1 | 自评取值范围 | `self_score ∈ [0, 100]` 整数 | 拒绝提交（`pending_self` 不可推进） | 15 行已填，全部合规 |
| V2 | 主管评分取值范围 | `mgr_score ∈ [0, 100]` 整数 | 拒绝提交（`pending_mgr` 不可推进） | 14 行已填，全部合规 |
| V3 | 终评加权 | `final_score = round(self_score×20% + mgr_score×80%, 1)`；可配 30/70（`self_score×30% + mgr_score×70%`） | 不一致即阻断写入并要求重算 | 14 行全部一致（如 `EMP-****12`：78×0.2+76×0.8=76.4） |
| V4 | 权重合计 | 同一 `employee_masked` 下 `kpi.csv.weight` 合计 = 100%；`cascade-report` 交付物同规则 | 阻断交付（acceptance 硬门槛） | 7 名员工全部 = 100 |
| V5 | 强制分布上限 | 统计口径 = `calibrated_grade` 非空行；**A 档（S+A）占比 ≤ 20%，B 占比 ≤ 40%** | 超限 → 红色预警「超限」，校准结果不得生效，须回调等级并重新双审批 | **A 档 35.7% > 20% → 超限红警**；B 28.6% ≤ 40% 合规 |
| V6 | 偏离标红 | `|pct − target_pct| > 5pct` → 标红（`target_pct`：A 档 20%、B 40%） | 标红提示，需在校准会议上给出说明 | A 档 +15.7pct 标红；B −11.4pct 标红 |
| V7 | 校准后不可直接改分 | `calibrated_grade` 一经双审批生效，禁止直接编辑 `self_score`/`mgr_score`/`final_score`/`calibrated_grade` | 仅可通过申诉复核（`done → appeal → done`）「维持/改判」路径变更，且改判须留 `delta_note` 与审计 | 本批 2 行 `appeal` 走此路径 |
| V8 | 达成率一致性 | `rate = round(actual / target × 100, 1)` | 不一致行标为脏数据，不参与预警分级 | 16 行全部一致 |
| V9 | 预警分级阈值 | `rate ≥ 95 → on_track`；`80 ≤ rate < 95 → at_risk`；`rate < 80 → behind` | `behind` 红色预警并进入 GT-PRF-01 置顶清单 | `behind` 1 行；`at_risk` 5 行；`on_track` 10 行 |
| V10 | 等级自动映射 | `manager_grade` 必须等于 `final_score` 按 §4.3 阈值映射结果，禁止人工直填 | 不一致即阻断 | 14 行全部一致 |
| V11 | 全员覆盖 | `prf.review-cycle` 须为全部在职员工生成考评记录，无遗漏人（acceptance 硬门槛） | 缺员不允许进入 `self_eval` | 本批 16 人 / 16 行，覆盖完整 |
| V12 | 纪要禁入记忆层 | 校准纪要、一对一纪要不得写入记忆层；敏感字段过 `redact_gate` | 写入即视为违规，审计告警 | 两条 workflow acceptance 覆盖 |

## 10. 特殊约束

1. **级别约束**：考核结果（`calibration.csv`）为 **L4**，个体绩效分数不得降级读取或导出；`kpi.csv` 为 L2，可用作部门级追踪素材。GT-PRF-01/02/03 的 `expected_permission` 均为「L4+双审批」。
2. **记忆层隔离**：校准纪要与一对一纪要**禁入记忆层**（scene 特批约束 + 两条 workflow acceptance）；`memory.pii_allowed=false`；个体级 PII 字段不得成为实体属性，`redact_gate` 前置。
3. **双审批不可降级**：`prf.calibration-approve` 的 `dual=true` 是 scene 级策略，preset 定制只能细化角色与顺序，不得改为单审批或免审批。
4. **校准后不可直接改分**：见 §9 V7；任何等级变更必须留下 `delta_note` + 审批记录 + 审计事件，可回溯到「数据版本 + 产物哈希」。
5. **强制分布是硬门**：A 档超限时校准结果不得生效（V5），这是 `prf.grade-distribution` 与 `prf.calibration-approve` 的联合约束。
6. **合成数据**：`kpi.csv` / `calibration.csv` 全部为合成数据；员工标识一律掩码为 `EMP-****NN`，不含真实姓名、身份证、手机号、薪酬绝对值。`EMP-****12`、`EMP-****35` 等 ID 与 comp/ben 域种子同源，用于演示跨域 join。
7. **周期口径**：`kpi.csv.period`（Q4）与 `calibration.csv.cycle`（Q4-2026）为同一周期的两种粒度写法，跨表统计时以 `cycle` 为准。
8. **可扩展位（不改 manifest 的前提下）**：`kpi.csv` 可继续追加列（如 `unit`/`direction`），但 `calibration.csv` 既有列名与顺序不得改动；任何追加列必须同步登记到 §1.1。
