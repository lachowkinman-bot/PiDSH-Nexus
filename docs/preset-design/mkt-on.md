# Preset 设计文档 · 营销管理（线上）（mkt-on）

> 定位：`mkt-on.content-publish@1.0.0` 场景的完整设计——数据字典（字段级）/ 技能规格 / 6 条工作流 / 状态机 / 审批链 / 跨域联动 / 权限矩阵 / Golden Tasks / 校验规则 / 特殊约束。
> 015 §9.2 自制层基线：Agent 定制化时**只许细化、不许删域**（§8.3）；§15.4 数据规则：落地数据须与本页数据字典逐表核对（文件名/行数/字段）。
>
> 事实来源（单一引用源，本页只细化不复制清单）：
> - Scene：`manifests/scenes/mkt-on.content-publish.yaml`（scene_id `mkt-on.content-publish@1.0.0`、domain `MKT`；required_capabilities 3；skills 3；policies：min_level=L4 / dual_approval=false / redact_gate / 记忆层禁 PII；GT 3）
> - Workflows：`manifests/workflows/index.json`（`domain==="mkt-on"` 共 6 条）+ `manifests/workflows/mkt-on.*.yaml`
> - Skills：`templates/skills-domain/mkt-on/SKILL-*.md`（含意图路由 `SKILL-cockpit-intent.md`）；知识种子 `templates/knowledge/seeds/mkt.md`；类型字典 `templates/Type-Dict/type-dict.csv`
> - 数据：`templates/workspace/data/mkt-on/content_calendar.csv`、`leads.csv`、`ad_spend.csv`
> - 深度参照（只读）：HR 智能体工作台设计文档 §3.2（字段级字典写法）、§3.3（状态枚举）、§4（工作流规格＋校验联动）、§5（RBAC 与数据边界）、§7.1（种子规模）、§8.2/§8.3（字段校验与状态迁移规范）；`docs/preset-design/rec.md`、`fin.md`（同批样板结构）
>
> **数据基线日 = 2026-10-05**（ISO 2026-W41 首日，周一；上周 = 2026-W40，环比周 = 2026-W39）；全部为合成数据，非真实投放与客户数据。

---

## §1 数据字典（总表）

**（a）落地资产**（数据根 `templates/workspace/data/mkt-on/`）

| 文件 | 级别 | PII 字段 | 行数 | 说明 |
|---|---|---|---|---|
| content_calendar.csv | L2 | —（scene 声明 `content_calendar.xlsx, L2, pii_fields: []`） | 15 | 内容日历（两周滚动，2026-10-05~10-18 及 W40 周转存行）：原 5 列（日期/渠道/标题/状态/负责人）+ 追加 4 列（内容 ID/内容形态/发布时间/脱敏标记）；同渠道同日冲突埋点 2 组 |
| leads.csv | L3 | contact_masked（手机号或邮箱的**掩码列**，不可还原；掩码前值不入库） | 20 | 线索主表（获客管道）：原 5 列（线索 ID/来源/阶段/评分/掩码联系方式）+ 追加 5 列（线上渠道/创建日/预估商机金额/跟进人掩码/备注）；承载 scene 声明的 `lead_phone`（掩码落地） |
| ad_spend.csv | L3 | — | 12 | 投放花费周表（渠道 × ISO 周，2026-W39/W40）：花费/批准预算/曝光/点击/负责人。**非 scene 数据资产**（本域扩展表，供 GT-MKTON-02 渠道 ROI 的分母取证），级别保守定 L3（渠道花费与预算属经营敏感） |

**清单—落地名归一化说明**（scene / Type-Dict 声明名 → 落地 CSV；`scripts/data-consistency-check.mjs` 按"去扩展名 + 前缀"匹配）：

| 声明侧 | 落地侧 | 级别 |
|---|---|---|
| scene `data_assets` 的 content-calendar.xlsx / type-dict 的 `mkt-on, content-calendar, table, L2, none` | content_calendar.csv（同名归一化：连字符 ↔ 下划线） | L2 |
| scene `data_assets` 的 leads-pipeline.xlsx / type-dict 的 `mkt-on, leads-pipeline, table, L3, lead_phone` | leads.csv | L3 |
| （无 scene 声明；GT-MKTON-02 投放 ROI 分母取证需要） | ad_spend.csv | L3（保守继承） |

- 表头英文小写下划线、UTF-8、逗号分隔、字段内不使用英文逗号；空值统一写 `-`；渠道取值统一取 `CHANNEL` 词表（见 §9 V-MKT-09），三表同词表。
- `content_calendar.csv` 原 5 列、`leads.csv` 原 5 列的**列名与列序均未删改**，仅追加列（追加列已逐字段写入 §1.1）；原有 5 行 content_calendar、5 行 leads 的既有 5 列取值逐字保留。
- 每表数据行 ≥12（本页行数以上表为准，不含表头）；行数为实测值：content_calendar 15 / leads 20 / ad_spend 12。
- **口径恒等式**（由数据保证，§9 V-MKT-03/V-MKT-08 逐项校验）：`leads.created_at` 的 ISO 周与 `ad_spend.week` 对齐；渠道 ROI 的分子 `Σleads.est_value_wan(渠道,周)` 与分母 `ad_spend.spend_wan(渠道,周)` 同渠道同周；`ad_spend.spend_wan ≤ approved_budget_wan`。

### §1.1 字段级数据字典

字段名与落地 CSV 表头逐字一致；类型取 string/number/date/enum/ref；空值统一写 `-`。

#### 1.1.1 leads.csv（10 列 = 原生 5 列 + 追加 5 列，20 行）

表头逐字：`lead_id,source,stage,score,contact_masked,channel,created_at,est_value_wan,owner_masked,note`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| lead_id | string | 是 | 线索 ID，唯一主键，格式 `LEAD-####`（LEAD-2101~LEAD-2120 连续编号）；原始列 |
| source | enum | 是 | 来源方式：官网表单 / 投放落地页 / 内容页留资 / 行业展 / 转介绍（前 3 类为线上来源，后 2 类为线下来源）；原始列 |
| stage | enum | 是 | 线索阶段，枚举见 §4.2，落地存中文展示值：新线索 / 接触中 / 报价中 / 已赢单 / 无效；原始列 |
| score | number | 是 | 线索评分 0-100（整数），决定 `est_value_wan` 分档；原始列 |
| contact_masked | string | 是 | 手机号或邮箱的**掩码列**（二选一）：手机 `138****2341`（前 3 后 4）、邮箱 `chen****@corp.com`（本地名前缀 + 星号）；掩码前值不得入库/出域/入记忆层；原始列，对应 redact 口径 `lead_phone` |
| channel | enum | 是 | 线上获客渠道，取 `CHANNEL` 词表（公众号/视频号/抖音/小红书/知乎/官网/百度SEM/信息流）；线下来源（行业展/转介绍）为 `-`；追加列，是 campaign-report 渠道口径与跨表连接的键 |
| created_at | date | 是 | 线索创建日 `YYYY-MM-DD`；ISO 周用于 lead-funnel 与 ROI 归因（W39：2101~2110；W40：2111~2117；W41：2118~2120）；追加列 |
| est_value_wan | number | 是 | 预估商机金额（**万元**，1 位小数），由 `score` 分档生成（§9 V-MKT-03）；`stage=无效` 时为 0.0；追加列，是渠道 ROI 的分子 |
| owner_masked | string | 是 | 跟进人掩码（姓 + `**`，如 `张**`）；本表 PII 字段声明为 `lead_phone`，故不得落跟进人全名；追加列 |
| note | string | 否 | 运营注记（无效原因、来源说明、跨域联动标记等）；无则 `-`；追加列 |

#### 1.1.2 content_calendar.csv（9 列 = 原生 5 列 + 追加 4 列，15 行）

表头逐字：`date,channel,title,status,owner,content_id,content_type,publish_time,pii_check`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| date | string | 是 | 排期日 `MM-DD`（基线年 2026，简写口径；导入时按基线年补全为 `YYYY-MM-DD`）；原始列。覆盖 2026-W40~W42，窗口为两周滚动（10-05~10-18）+ W40 周转存行（10-02） |
| channel | enum | 是 | 发布渠道，取 `CHANNEL` 词表（本表实际取值：公众号/视频号/抖音/小红书/知乎/官网）；原始列，与 leads.channel、ad_spend.channel 同词表 |
| title | string | 是 | 内容标题（禁虚假承诺话术，见 §9 V-MKT-06）；原始列 |
| status | enum | 是 | 内容状态，枚举见 §4.1：草稿 / 待审核 / 已排期 / 已驳回 / 已发布；原始列 |
| owner | enum | 是 | 责任组：内容组 / 视频组 / 活动组 / 市场运营；原始列 |
| content_id | string | 是 | 内容 ID，唯一主键，格式 `CT-####`（CT-2051~CT-2065）；追加列，是发布审批与跨域复用的证据键 |
| content_type | enum | 是 | 内容形态：图文 / 长图 / 短视频 / 专题页 / 直播；追加列 |
| publish_time | string | 是 | 计划发布时间 `HH:mm`（同日同渠道冲突判定不看时刻，只看 日期+渠道，见 §9 V-MKT-02）；追加列 |
| pii_check | enum | 是 | 素材脱敏标记：无PII / 待脱敏 / 已脱敏。`待脱敏` 的素材**不得**置 `已排期/已发布`，须过 `redact_gate` 后改 `已脱敏` 才可发布（§5/§9 V-MKT-07）；追加列 |

#### 1.1.3 ad_spend.csv（7 列，12 行）

表头逐字：`channel,week,spend_wan,approved_budget_wan,impressions,clicks,owner`

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| channel | enum | 是 | 投放渠道，取 `CHANNEL` 词表（本表实际取值：抖音/视频号/小红书/知乎/百度SEM/信息流）；与 leads.channel 同词表 |
| week | string | 是 | ISO 周 `YYYY-Www`（2026-W39 / 2026-W40）；W40 为基线日所在周的**上周**（GT-MKTON-02 报告期），W39 为环比周 |
| spend_wan | number | 是 | 当周实际花费（**万元**，2 位小数）；W40 合计 34.00、W39 合计 30.50 |
| approved_budget_wan | number | 是 | 当周批准预算（**万元**，2 位小数）；`spend_wan > approved_budget_wan` 即超包，须转 `mkt-on.ad-spend-review` |
| impressions | number | 是 | 曝光量（平台只读口径，整数） |
| clicks | number | 是 | 点击量（平台只读口径，整数）；CPC 由 `spend_wan × 10000 / clicks` 派生，不落列 |
| owner | string | 是 | 渠道投放负责人（掩码名，如 `张**`），与 leads.owner_masked 同一责任人词表 |

---

## §2 技能规格（scene skills：content-gen / ad-analysis / seo-audit）

| 技能 | 用途 | 输入 | 输出 | 最低级别 | 质量门与失败处理 |
|---|---|---|---|---|---|
| content-gen | 按品牌语气生成内容草稿（禁虚假承诺话术） | data/mkt-on/content_calendar.csv、leads.csv（素材证据） | reports/mkt-on/*（内容草稿、日历 JSON、发布审批件） | L4 | 草稿必须落 `content_id` 并可回指日历行；含 PII 素材先过 redact_gate（pii_check→已脱敏）；禁绝对化用语与虚假承诺；连续 3 次失败→登记 capability-gap 并停止当前任务 |
| ad-analysis | 投放平台只读数据分析与归因 | data/mkt-on/ad_spend.csv、leads.csv | reports/mkt-on/*（渠道 ROI 周报、加预算审批件） | L4 | 只读，禁写回投放平台；ROI 数字必须给出 (文件, 行, 列) 级证据链（分子 leads.csv 行、分母 ad_spend.csv 行）；不得倒轧；连续 3 次失败→登记 capability-gap |
| seo-audit | 落地页 SEO 诊断与关键词建议 | data/mkt-on/content_calendar.csv（官网落地页行） | reports/mkt-on/*（SEO 诊断与整改清单、线索漏斗周报） | L4 | 外部抓取**仅摘要**，禁整站镜像（§9 V-MKT-04）；改进项须给出页面 + 关键词 + 证据行；连续 3 次失败→登记 capability-gap |

- 三个技能文件均声明 `min_level: L4`、`redact_gate: true`，依赖能力 `cap.excel.panel`、`cap.redact.all`（与 scene `required_capabilities` 一致，另含 `cap.approval.single`）。
- 意图路由技能 `mkt-on-intent`（`templates/skills-domain/mkt-on/SKILL-cockpit-intent.md`）把自然语言意图路由到 `publish-approve` / `campaign-report` 工作流；跨域意图（如"内容复用为线下物料"）交 Chief of Staff（`cap.orchestration.chief`）。scene `skills` 仅声明上表 3 个业务技能。
- **技能—工作流绑定差异登记**：`mkt-on.lead-funnel`（线索漏斗）与 `mkt-on.seo-audit` 在 workflow manifest 中均绑 `seo-audit` 技能；语义上漏斗统计更贴近 ad-analysis，但 manifest 为唯一事实源，本页按 manifest 落地（不擅自改 manifest），仅登记该绑定差异。

---

## §3 工作流（本域全部 6 条，`manifests/workflows/index.json` domain==="mkt-on"）

| 工作流 | 审批落点 | 交付规范 | 说明 |
|---|---|---|---|
| mkt-on.publish-approve@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `publish-approve-<ts>.json`：title / channel / publish_at / pii_check / approver；acceptance：**含 PII 的素材必须 redact 后才可发布** | 内容发布审批（L4 强审批 + 脱敏）；skill=content-gen；节点链 skill(n1)→condition(n2)→approval(n3)→tool `cap.excel.panel.write`(n4)→audit(n5)"审批人 + 依据数据版本 + 产物哈希"；rollback=savepoint `pre-publish-approve` |
| mkt-on.campaign-report@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `campaign-report-<ts>.json`：channel / spend_wan / leads / roi / week；acceptance：**ROI 数字可追溯到 leads.csv** | 投放周报（渠道×ROI）；skill=ad-analysis；节点链 skill(n1)→tool(n2)→audit(n3)"数据版本 + 产物哈希"；rollback=savepoint `pre-campaign-report` |
| mkt-on.content-calendar@1.0.0 | **无审批节点**（kind=calc；hitl_nodes 为空） | `content-calendar-<ts>.json`：date / channel / title / status；acceptance：**排期冲突（同日同渠道）须标红** | 内容日历排期（两周滚动）；skill=content-gen；节点链 skill(n1)→tool(n2)→audit(n3)"输入参数 + 结果快照"；rollback=savepoint `pre-content-calendar` |
| mkt-on.lead-funnel@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `lead-funnel-<ts>.json`：stage / count / conversion_pct / week；acceptance：**线索手机号/邮箱仅掩码口径** | 线索漏斗周报（阶段转化）；skill=seo-audit（manifest 绑定，见 §2 差异登记）；rollback=savepoint `pre-lead-funnel` |
| mkt-on.seo-audit@1.0.0 | **无审批节点**（kind=report；hitl_nodes 为空） | `seo-audit-<ts>.json`：page / keywords / rank / issue；acceptance：**外部抓取仅摘要，禁整站镜像** | SEO 诊断（收录/关键词）；skill=seo-audit；rollback=savepoint `pre-seo-audit` |
| mkt-on.ad-spend-review@1.0.0 | n3 approval（**L4，`dual: true`**）；前置 n2 condition"触发对外/生效动作"；hitl_nodes=[n3] | `ad-spend-review-<ts>.json`：channel / current_spend_wan / increment_wan / expected_roi；acceptance：**单周加预算 >10 万触发双审批** | 投放加预算审批（阈值触发）；skill=ad-analysis；audit(n5)"审批人 + 依据数据版本 + 产物哈希"；rollback=savepoint `pre-ad-spend-review` |

> 命名对照：scene.workflows 只钉 2 条基线（mkt-on.publish-approve、mkt-on.campaign-report），其余 4 条取自 `manifests/workflows/index.json`（本域共 6 条）。上表"审批落点"列对无审批工作流明示为"无审批节点"，**不存在空值字段**。

- **GT-MKTON-02 必填字段 → 表列映射**（不依赖外部数据，全部可从本域 3 张表取值）：

| 交付字段 | 取数来源 | 取数示例（报告期 2026-W40） |
|---|---|---|
| week | ad_spend.`week` | `2026-W40`（基线日 10-05 所在周的上一周） |
| channel | ad_spend.`channel`（6 个付费渠道，取 CHANNEL 词表） | 抖音 / 视频号 / 小红书 / 知乎 / 百度SEM / 信息流 |
| spend_wan | ad_spend.`spend_wan` 按渠道求和（该周） | 抖音 8.00；6 渠道合计 **34.00** 万元 |
| leads | leads.csv 中 `channel` 命中且 `created_at` 落入该周的行数 | 抖音 1 / 视频号 1 / 小红书 1 / 知乎 1 / 百度SEM 1 / 信息流 1（W40） |
| roi | `Σleads.est_value_wan(渠道,周) ÷ ad_spend.spend_wan(渠道,周)` | 抖音 15.0÷8.00=**1.88**；视频号 8.0÷6.00=**1.33**；小红书 15.0÷5.00=**3.00**；知乎 8.0÷3.50=**2.29**；百度SEM 8.0÷4.50=**1.78**；信息流 15.0÷7.00=**2.14**；合计 69.0÷34.00=**2.03** |

- 环比周 2026-W39 同法可取：合计 46.0÷30.50=**1.51**（视频号、百度SEM 因无效线索计 0），供周报环比与异动归因。

---

## §4 状态机

### 4.1 内容（content_calendar.status，CONTENT_STATUS）

```
草稿 →（提交审批）→ 待审核 →（发布审批通过）→ 已排期 →（到达 publish_at 发布）→ 已发布（终态）
                        ↘（审批驳回）→ 已驳回 →（修改后重提）→ 草稿
```

| 状态（CSV 落值） | 标识符 | 等价口径 | 允许后继 | 证据字段 |
|---|---|---|---|---|
| 草稿 | draft | 草稿 | 待审核 | 内容未提交；`content_id` 已分配 |
| 待审核 | pending | **待审批** | 已排期 / 已驳回 | `pii_check ≠ 待脱敏` 才可提交（V-MKT-07）；命中审批链 n3 |
| 已排期 | scheduled | 审批通过、待发布 | 已发布 | 审批件 `publish-approve-<ts>.json` 落 approver + 依据数据版本 + 产物哈希 |
| 已驳回 | rejected | 已驳回 | 草稿（修改重提） | 驳回原因必填并写入 audit n5 |
| 已发布 | published | 已发布 | —（终态） | `publish_at` 已到并触发发布；跨域复用（mkt-off 物料）以此为触发（§6） |

- 迁移只经唯一函数 `setStatus(entity, to, by)` 并写操作日志（参照参照文档 §8.3）；流程实例状态（running/done/rejected/cancelled）与内容状态**解耦**，流程 done 后由 after_complete 钩子回写。
- 本快照分布（15 行）：已发布 1 / 已排期 2 / 待审核 5 / 草稿 6 / 已驳回 1。
- **禁止**：`待脱敏` 素材越过 redact_gate 前进；`已驳回` 原地改写为 `已排期`（须回 `草稿` 重提并留痕）。

### 4.2 线索（leads.stage，LEAD_STAGE）

```
新线索 →（首次触达）→ 接触中 →（需求/预算确认）→ 报价中 →（成交回写）→ 已赢单（终态）
   ↘            ↘               ↘
            无效（终态，必须写 note 原因）
```

| 枚举值 | 标识符 | 进入条件 | 允许后继 |
|---|---|---|---|
| 新线索 | new | 表单/落地页/内容页留资入库（初始态） | 接触中 / 无效 |
| 接触中 | contacted | 首次触达完成（对齐任务口径"已联系"） | 报价中 / 无效 |
| 报价中 | quoting | 需求与预算确认，进入报价/商机阶段 | 已赢单 / 无效 |
| 已赢单 | converted | 成交并回写，触发 sales 商机联动（§6） | —（终态） |
| 无效 | invalid | 画像不符/失联/预算不匹配等，`note` 必填原因 | —（终态） |

| 迁移 | 触发条件 | 证据/门槛 |
|---|---|---|
| 新线索 → 接触中 | 首次触达记录 | `owner_masked` 已分配；（可选）`score ≥ 60` 建议阈值 |
| 接触中 → 报价中 | 需求/预算确认 | 进入商机评估；`est_value_wan` 分档已生成 |
| 报价中 → 已赢单 | 成交回写 | 证据字段：lead_id / channel / est_value_wan / owner_masked（转 sales） |
| 任意非终态 → 无效 | 画像不符/失联决策 | `note` 必填无效原因；`est_value_wan` 置 0.0（不进入 ROI 分子） |

- 本快照分布（20 行）：新线索 10 / 接触中 5 / 报价中 2 / 已赢单 1 / 无效 2；无效埋点 LEAD-2107（非目标行业）、LEAD-2110（预算不匹配），用于 ROI 分子归零与漏斗口径验证。
- **禁止**：跳级推进（如 新线索→报价中）、越级建立商机、已赢单/无效 改写回主链（须重开线索记录并留痕）。

---

## §5 审批链（节点-角色-双审批-阈值）

| 流程 | 节点链 | 审批角色（建议映射） | 双审批 | 金额/条件阈值 | manifest 落点 |
|---|---|---|---|---|---|
| 内容发布（mkt-on.publish-approve） | 提交 → content-gen 生成/整理素材 → 条件判定（是否对外） → L4 审批 → 写产物 → 审计 | 内容负责人 → 市场负责人（含 PII 素材时加签合规/cmp） | **是**（`dual:true`） | 域基线：一切对外发布均 L4 双人；**含 PII 素材（pii_check=待脱敏）未过 redact_gate = 一票否决**；`publish_at` 落在法定节假日/敏感日须加签 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |
| 投放加预算（mkt-on.ad-spend-review） | 投放数据只读分析 → 条件判定（阈值） → L4 审批 → 写产物 → 审计 | 增长投放负责人 → 市场负责人；累计加预算超季度渠道包 10% 时加签 CFO | **是**（`dual:true`） | acceptance 原文"单周加预算 >10 万触发双审批"：`increment_wan > 10` 必须双人；`spend_wan > approved_budget_wan` 先走本流程才可继续投放 | n3 approval（L4 + `dual:true`，hitl_nodes=[n3]） |

- 场景基线 `policies.permission.min_level=L4`、`dual_approval=false` 为**域默认**；两条 approve 工作流在流程级升格为 L4 双审批（与 workflow YAML 一致），规则**单调加严、不放松**。
- **PII 素材发布闸门（硬规则）**：`content_calendar.pii_check` 为 `待脱敏` 的内容（样例 CT-2054 客户案例短视频、CT-2065 客户成功故事）必须先经 `redact_gate`（gate=redact_gate，字段口径 `lead_phone`；落地掩码见 §9 V-MKT-01）改成 `已脱敏`，才允许 n3 审批通过；审批件 `pii_check` 字段必须回写最终结论。未脱敏先发 = 一票否决并留痕。
- 驳回路径：驳回→流程 rejected，内容落回 `草稿`，驳回原因必填并写入 audit n5；rollback savepoint 分别为 `pre-publish-approve`、`pre-ad-spend-review`。
- 角色映射为落地建议（scene/工作流未钉角色，按 ROLES/caps 配置）；10 万元为 manifest acceptance 原文阈值，不得放松。

---

## §6 跨域联动（触发 → 联动副作用 → 证据字段）

> 本表为**设计约定**（scene 未声明钩子）；实现时须以 `cap.orchestration.chief` 编排并落审计，不得绕过 §5 审批链。

| 触发 | 联动副作用 | 证据字段 |
|---|---|---|
| 线索转化（leads.stage=已赢单，或 报价中 转商机） | sales 商机建档：写入 sales 域 pipeline（对齐 `sales/pipeline.csv`：opportunity / stage / amount_k / owner / close_date），商机金额由 `est_value_wan` 换算（万元→金额） | leads：lead_id / channel / stage / est_value_wan / owner_masked / created_at；sales：pipeline.opportunity / pipeline.amount_k / pipeline.owner |
| 内容发布（content_calendar.status=已发布） | mkt-off 物料复用：白皮书/短视频/专题页作为线下物料入库复用，走 mkt-off 物料合规审查（`mkt-off.material-review`），复用须重新做品牌/法务检查 | content_calendar：content_id / title / channel / date / pii_check=无PII或已脱敏；mkt-off：materials.material / review_status / legal_check / brand_check |
| 投放花费（ad_spend 按周结算；加预算审批通过） | fin 预算联动：渠道花费按科目 `广告投放费`（市场部 MK）落 fin 费用凭证与预算执行数，超包转 `fin.budget-review`；本域只登记，不自动改 fin 台账 | ad_spend：channel / week / spend_wan / approved_budget_wan；fin：expenses.gl_account=广告投放费 / amount_yuan / dept_code=MK / period；budget.used_wan / remain_wan |
| 加预算超阈值或花费超包（ad-spend-review 触发） | cmp 留痕（大额对外支出/合规审计证据包，append-only）；未审批前不得继续投放 | ad-spend-review-<ts>.json：channel / current_spend_wan / increment_wan / expected_roi / approver |
| SEO 诊断输出（mkt-on.seo-audit done） | 官网落地页整改项回流 content_calendar（官网行）并生成整改清单；外部抓取仅摘要 | seo-audit-<ts>.json：page / keywords / rank / issue；content_calendar：content_id / channel=官网 / title |

> 联动统一在 after_complete 钩子实现，不在页面散落业务逻辑；副作用写失败回滚至对应 savepoint。

---

## §7 权限矩阵

**scene policies（钉死）**

| 项 | 值 |
|---|---|
| 最低数据级别 | **L4**（min_level=L4，越级读取即 DENY） |
| 双审批 | false（域基线免双审批；对外/生效动作在节点级升格为真，见 §5） |
| 脱敏字段（redact_gate） | lead_phone, lead_idcard；命中写 redact 日志。落地映射：`lead_phone` → `leads.contact_masked`（手机/邮箱合一掩码列，不可还原）；`lead_idcard` 本域**未落任何列**（线上营销线索不采集身份证，登记为声明侧字段） |
| 记忆层 | pii_allowed=false；exclude=[] —— 线索 PII 一律禁入记忆层与图谱实体属性（禁入公网搜索与外部工具） |

**对象 × 权限**

| 对象 | 级别 | 查看 | 创建/编辑 | 审批 | 脱敏/记忆层 |
|---|---|---|---|---|---|
| content_calendar.csv | L2 | 市场/内容/活动组全量 | C/E/D（内容组、视频组、活动组各自行） | 发布审批：是（L4 双审批） | 无 PII；允许非 PII 分档汇总入记忆层 |
| leads.csv | L3 | 按角色行级（跟进人仅本人 `owner_masked` 行；负责人全量） | C/E/D（跟进人） | 转化/无效推进：否（免审批，留痕） | `contact_masked` 一律掩码；完整值仅源系统；PII 禁入记忆层 |
| ad_spend.csv | L3 | 市场负责人/增长投放全量；其他人只出汇总 | C/E（增长投放） | 加预算：是（L4 双审批，§5） | 无 PII；花费明细仅 L3+ 命名空间内引用 |
| 报告产物（reports/mkt-on/*） | 随源表级别 | 分级出数 | — | — | 报告只引掩码与 `lead_id`/`content_id`；PII 禁入 |

**角色 × 操作（建议映射，落地以 workbench-ui-plugin 为准）**

| 角色 | 内容日历 | 线索 | 投放 | 审批 | 数据边界 |
|---|---|---|---|---|---|
| admin | V/C/E/D | V/C/E/D | V/C/E/D | 可（含流程推进/驳回） | 全部实体全部行 |
| 市场负责人 | V/C/E/D | 全量（列表脱敏） | V/C/E/D | 可（发布/加预算终审） | 全业务行 |
| 内容/视频/活动组 | V/C/E/D（本组行） | 无菜单 | 无菜单 | 无 | 本组内容行 |
| 增长投放 | 无菜单 | V（本人跟进行，脱敏） | V/C/E/D | 无（发起加预算） | 本渠道行 |
| 其他部门 | 只读汇总 | 无 | 无 | 无 | 仅汇总口径 |

- 列表/报告始终掩码；完整值不出域（本域数据为合成数据，掩码前值本就不存在）。无 approve 权限不渲染审批按钮；越级读取（<L4）直接 DENY。

---

## §8 Golden Tasks（与 scene 一致，3 条）

| GT | 输入 | 技能/工具 | 权限 | 期望产物 | 输入文件（scene 声明 → 落地） | 审计 | 质量判据 |
|---|---|---|---|---|---|---|---|
| GT-MKTON-01 | 生成本周内容日历草稿并提交发布审批 | content-gen + cap.excel.panel / cap.approval.single | L4 | reports/mkt-on/gt-01.md（附 content-calendar / publish-approve JSON） | data/mkt-on/content-calendar.xlsx → content_calendar.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 `content_id`） |
| GT-MKTON-02 | 分析上周投放数据并输出渠道 ROI 报告 | ad-analysis + cap.excel.panel / cap.approval.single | L4 | reports/mkt-on/gt-02.md（附 campaign-report JSON） | data/mkt-on/leads-pipeline.xlsx → leads.csv（+ ad_spend.csv 取证） | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（ROI 可追溯到 leads.csv 行） |
| GT-MKTON-03 | 对落地页做 SEO 诊断并生成整改清单 | seo-audit + cap.excel.panel / cap.approval.single | L4 | reports/mkt-on/gt-03.md（附 seo-audit JSON） | data/mkt-on/content-calendar.xlsx → content_calendar.csv | 读/算/写审计事件 | 结论可溯源到 sheet/row 级证据（逐 page/keyword） |

### 任务分解（scene `expected_plan` 指向本页）

**GT-MKTON-01 内容日历草稿与发布审批**
1. 读 content_calendar.csv 全量 15 行，按 `date + channel` 分组做冲突检测：命中同组 ≥2 行即**标红**（样例 CT-2060/CT-2061 均为 10-16 小红书；CT-2063/CT-2064 均为 10-18 视频号）；冲突行须重排或改渠道后才可提交。
2. 两周滚动窗口（基线日 2026-10-05：10-05~10-18）内生成草稿：既有 `草稿/待审核` 行补齐 `content_type / publish_time / pii_check`，新增行按 CHANNEL 词表排期。
3. `pii_check=待脱敏` 行（CT-2054、CT-2065）先经 `redact_gate` 处理改 `已脱敏`；未处理不得进入 `待审核`。
4. 提交 `mkt-on.publish-approve`（L4 双审批）：产物 `publish-approve-<ts>.json`（title / channel / publish_at / pii_check / approver）；写审计（审批人 + 依据数据版本 + 产物哈希）；落 `reports/mkt-on/gt-01.md`，逐条给出行号证据。

**GT-MKTON-02 渠道 ROI 周报（上周 = 2026-W40）**
1. 取报告期：`week=2026-W40`（基线日 2026-10-05 的上一 ISO 周，**不得用时序戳臆造**）；分母取 ad_spend.csv 该周 6 渠道 `spend_wan`（合计 34.00 万元）。
2. 分子取 leads.csv 中 `channel` 命中、`created_at ∈ 2026-09-28~2026-10-04` 的行，按 §9 V-MKT-03 的 `est_value_wan` 分档求和（合计 69.0 万元；无效线索计 0）。
3. 逐渠道计算 `roi = 分子 ÷ 分母`：抖音 1.88 / 视频号 1.33 / 小红书 3.00 / 知乎 2.29 / 百度SEM 1.78 / 信息流 2.14；合计 2.03。
4. 输出环比：W39 合计 1.51（视频号、百度SEM 为 0）；对 0 值渠道给出归因（无效线索 LEAD-2107/LEAD-2110），并给出加预算/减投建议（触发 `mkt-on.ad-spend-review`）。
5. 每个数字标注 (文件, 行, 列) 证据；落 `reports/mkt-on/gt-02.md`；写审计。

**GT-MKTON-03 落地页 SEO 诊断与整改清单**
1. 取官网落地页对应的内容行（`channel=官网`：CT-2055 双11 专题页、CT-2063 等），逐页检查收录状态、关键词排名与页面要素。
2. 外部抓取**仅摘要**（标题/描述/排名片段），**禁整站镜像、禁全量页面存档**（V-MKT-04）；抓取内容不含任何线索 PII。
3. 输出整改清单：page / keywords / rank / issue（逐项可执行，如 TDK 缺失、内链不足、加载慢）；落 `reports/mkt-on/gt-03.md`；写审计（数据版本 + 产物哈希）。

---

## §9 校验规则

| 规则 | 判定 | 失败处理 |
|---|---|---|
| V-MKT-01 线索 PII 掩码口径 | `contact_masked` 只允许两种形态：手机 `^1[3-9]\d\*{4}\d{4}$`（如 `138****2341`）；邮箱 本地名保留 ≤4 字符 + 连续星号（≥3）+ `@域名`（如 `chen****@corp.com`、`a***@corp.com`）。**完整手机号/邮箱、可还原到个人的明文一律禁止**；报告只引 `lead_id` | FAIL：出现完整值或非掩码形态即拒写，并记 redact 违规（一票否决） |
| V-MKT-02 排期冲突标红 | 同 `date` + 同 `channel` 出现 ≥2 条排期即冲突，必须标红并重排（workflow acceptance 原文） | FAIL：冲突未标红视为报告不合格；样例埋点 CT-2060/CT-2061（10-16 小红书）、CT-2063/CT-2064（10-18 视频号） |
| V-MKT-03 ROI 可追溯与分档一致 | `roi = Σleads.est_value_wan(渠道,周) ÷ ad_spend.spend_wan(渠道,周)`；分子必须能逐行回指 leads.csv 行（channel + created_at + est_value_wan）；`est_value_wan` 必须与 `score` 分档一致：≥85→30.0；70~84→15.0；55~69→8.0；<55→3.0；`stage=无效`→0.0 | FAIL：分子无行级证据或分档不符即拒出数；禁用外部补数、禁用倒轧 |
| V-MKT-04 外部抓取仅摘要 | SEO 诊断的外部抓取只允许标题/描述/排名摘要级内容，**禁整站镜像、禁全量归档、禁携带线索 PII 出境** | FAIL：超范围抓取即中止任务并登记 capability-gap |
| V-MKT-05 必填与唯一 | leads：lead_id / source / stage / score / contact_masked / channel / created_at / est_value_wan / owner_masked；content_calendar：date / channel / title / status / owner / content_id / content_type / publish_time / pii_check；ad_spend：全部 7 列。`lead_id`、`content_id` 唯一 | 缺失即拒写并提示"请填写必填项"；重复即拒写并提示"已存在" |
| V-MKT-06 枚举与话术 | `stage` ∈ {新线索,接触中,报价中,已赢单,无效}；`status` ∈ {草稿,待审核,已排期,已驳回,已发布}；`channel` ∈ CHANNEL 词表；内容标题禁虚假承诺/绝对化用语（广告法口径） | FAIL：非法枚举值拒写；违规话术退回 content-gen 重写 |
| V-MKT-07 发布前脱敏闸门 | `pii_check=待脱敏` 的内容不得置 `已排期/已发布`；发布审批件 `pii_check` 必须为 `无PII` 或 `已脱敏`；`approver` 非空且双人 | FAIL：未脱敏先发 = 一票否决（acceptance 原文：含 PII 的素材必须 redact 后才可发布） |
| V-MKT-08 投放预算与阈值 | `spend_wan ≤ approved_budget_wan`；单周加预算 `increment_wan > 10` 万元必须双审批（acceptance 原文）；`spend_wan / approved_budget_wan > 1` 须先走 `mkt-on.ad-spend-review` | FAIL：超包未审批不得继续投放；审批人数不足不得置 approved |
| V-MKT-09 渠道口径一致 | 三表 `channel` 取值同属 CHANNEL 词表（公众号/视频号/抖音/小红书/知乎/官网/百度SEM/信息流）；线下来源（行业展/转介绍）`channel` 记 `-`；跨表连接禁出现同渠道异名 | FAIL：异名即视为口径不一致，先改数据再出报告 |
| V-MKT-10 数值范围 | `score` 0-100 整数；`est_value_wan ∈ {0.0, 3.0, 8.0, 15.0, 30.0}`；`spend_wan`/`approved_budget_wan` ≥0 且 2 位小数；`impressions`/`clicks` 为正整数且 `clicks ≤ impressions` | FAIL：越界拒写并退回修正 |
| V-MKT-11 交付验收 | campaign-report 的 ROI 必须给出 (文件, 行, 列) 证据；lead-funnel 只出掩码与计数；ad-spend-review 阈值命中必须双审批；产物落 `reports/mkt-on/` 并写"数据版本 + 产物哈希" | FAIL：无证据链或绕过审批 → 判定不合格 |

---

## §10 特殊约束

1. **线索 PII（L3）禁入公网搜索与外部工具**——scene 尾注原文。`leads.contact_masked` 只以掩码形态出域（`138****2341` / `chen****@corp.com`），完整值不存在于工作区（合成数据）；seo-audit 等涉及外部抓取的任务不得携带任何线索字段；记忆层 `pii_allowed=false`。
2. **发布动作一律 L4 审批**——scene 尾注原文。内容对外发布（`mkt-on.publish-approve`）恒为 L4 双审批；**含 PII 素材必须 redact 后才可发布**（acceptance 原文），`pii_check=待脱敏` 未过闸门即一票否决（样例 CT-2054、CT-2065）。
3. **加预算阈值不得放松**：单周加预算 >10 万元触发双审批（`mkt-on.ad-spend-review` acceptance 原文，manifest n3 `L4 + dual:true`）；`spend_wan > approved_budget_wan` 必须先审批后继续投放。
4. **外部抓取边界**：SEO 诊断只允许摘要级外部信息，禁整站镜像/全量归档；抓取产物不得含 L3+ 数据或线索 PII。
5. **数据规模（本版升级）**：demo 数据由「5 行模板继承 002」升级为本设计规格——content_calendar 15 行 / leads 20 行 / ad_spend 12 行（每表 ≥12 行），与 §1/§1.1 逐表核对（文件名/行数/字段）。
6. **声明与落地对照**：scene/Type-Dict 声明 xlsx（content-calendar.xlsx / leads-pipeline.xlsx），工作区落地 UTF-8 CSV（`content_calendar.csv` / `leads.csv`，同名归一化由 `scripts/data-consistency-check.mjs` 校验）；`leads.csv` 追加 5 列、`content_calendar.csv` 追加 4 列，原有列名与列序均未改动。scene redact 字段 `lead_idcard` 在本域无落地列（不采集身份证），登记为声明侧差异。
7. **`ad_spend.csv` 为本域扩展表**（scene 未声明）：GT-MKTON-02 需要渠道花费分母，原有种子数据仅有内容与线索口径、无花费口径；本表按周落 6 渠道花费，使 ROI 分子（leads）与分母（ad_spend）均可取证，级别保守定 L3。
8. **生成器覆盖风险（运维须知）**：`scripts/seed-domain-data.mjs` 为幂等覆盖式种子生成器，其 `mkt-on` 段仍只含 5 行 content_calendar / 5 行 leads 的旧快照；**重跑该脚本会覆盖本页已补齐的 2 张表且不会生成 ad_spend.csv**。本域数据的权威版本以本页 §1/§1.1 为准，重跑生成器后必须按本页校对恢复（本 preset 不修改 scripts/，仅登记风险）。
9. **规则命中样例（刻意埋点，非数据缺陷）**：CT-2060/CT-2061（10-16 小红书）与 CT-2063/CT-2064（10-18 视频号）为同日同渠道冲突样例，用于回归测试 `mkt-on.content-calendar` 的标红规则；LEAD-2107/LEAD-2110 为无效线索样例（ROI 分子归零），用于 `mkt-on.campaign-report` 的归因口径验证；CT-2054/CT-2065 为 `待脱敏` 素材样例，用于发布闸门验证。
10. **未采纳的参照点（及原因）**：
    - 参照 HR 文档 §3.2 的员工/考勤/薪酬类实体：属 ER/comp 域，本域不重复建模，仅在 §6 登记跨域联动。
    - 参照 §7.1 的产品级种子规模（如线索 20-80 / 内容排期全月）：本 preset 为冷启动样例（15/20/12 行，均 ≥12 行下限），规模扩展归生成器（脚本侧）。
    - 参照 §4.2 的拖拽看板/按钮推进双模式与多级审批步骤条：本域 UI 规格以 `manifests/domain-ui-checklist.csv`（内容日历看板/投放 ROI 卡/线索漏斗图）与 workbench-ui-plugin 为准，本页只定数据与流程口径。
    - 参照 §5.2 的候选人类外部角色：本域无外部角色入口，故不设 candidate 行；报告产物一律在内部角色间按级别分发。
11. **扩展位**：行业 Overlay 首批 0 个（scene `industry_overlay: null`）；如需行业化（如电商大促、SaaS 增长），按 015 P1-4 只扩 1 个试点，并通过 scene 覆盖而非改本域基线。
