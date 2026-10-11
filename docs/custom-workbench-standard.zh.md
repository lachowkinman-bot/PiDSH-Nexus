# PiDSH Nexus 自定义工作台规范（Custom Workbench Standard）

> 版本：v1（2026-10-11）｜适用：`4.0.0-dev8` 起的 PiDSH Nexus 桌面应用
> 定位：本地化改写自 dataelement/dsh-desktop 的工作台标准与「制作我的工作台」指令（MIT），
> 术语替换为 PiDSH 的工作域资产契约，并接入本仓既有的生成/门禁脚本链。
> 本文可离线阅读：应用内 `GET /workbench/api/custom/development-guide` 返回同一份内容。

## 1. 它能做什么

「自定义工作台」与「13 域工作台」分开显示，负责把业务需求变成可生效的工作域资产：

- **修订现有 13 域**：调整场景声明、台账表、技能、§9 校验规则等；
- **新增自定义域**（第 14+ 个）：与内置域并列展示，带「自定义」徽标。

纪律：草稿先预览、后固化。**正式生效必须过门禁并重打包**，应用内不直接改写产品资产。

## 2. 三步流程

| 步骤 | 做什么 | 证据 |
|---|---|---|
| 1. 建草稿 | 在「自定义工作台」里选类型（修订/新增域）、目标域、写清需求原文 | `draft.json`（含资产清单与哈希） |
| 2. 交给 Agent | 「开始定制会话」或「复制指令」；Agent 按需求确认闸门先问合并问题，再产出 overlay 资产 | 定制指令（含草稿绝对路径） |
| 3. 校验与预览 | 「运行校验」→「构建预览」；通过后「导出合入包」，交开发源树走门禁与重打包 | `verify.json`、`preview/app.html`、`consolidation/` |

## 3. 需求确认闸门（Agent 必须遵守）

1. 通用指令不含业务需求，**不得**据此直接决定做什么工作域；
2. 必须先确认三件事：服务谁、解决什么业务场景、核心流程是什么；
3. 任一项不明确时，只问**一个合并问题**并等待回答；
4. 空 overlay 且没有业务目标时，停在提问，不创建任何资产；
5. 可以只读检查目录、文档与未提交更改，但目录名/示例/现有代码不等于用户意图。

## 4. 资产契约（白名单）

草稿的 `overlay/` 按产品根路径镜像，只允许以下前缀：

| 路径 | 作用 | 约束 |
|---|---|---|
| `manifests/scenes/<域前缀>.<主场景>.yaml` | 域/技能/策略/GT 声明 | 新增域需带 `label`/`color`/`origin: custom` |
| `manifests/workflows/<域>.workflows.json` | 工作流条目（`index.json` 同形数组） | **逐条 yaml 由生成器管理，禁止直接改写** |
| `templates/workspace/data/<域>/*.csv` | 台账表 | 表头必须与场景声明逐字一致；PII 列不得出现未脱敏原值 |
| `templates/Type-Dict/field-type-dict.csv` | 新字段的字典行 | 新增/修改台账列必须同步补行（`design:verify` 核对行数） |
| `templates/skills-domain/<域>/SKILL-*.md` | 技能文件 | 每个技能至少被一条工作流引用 |
| `docs/preset-design/<域>.md` | §4 状态机 / §5 审批链 / §9 校验规则 | `gen-domain-model.mjs` 的输入（只搬运，不推断） |

生成物（**禁止直接改写**）：`manifests/domain-model/*.json`、`manifests/domain-work-design/*.json`、
`docs/domain-work-design/*.md`、`manifests/workflows/*.yaml`、`app.html`。

## 5. 校验分级（如实分级）

校验在 staging 副本（`<数据根>/custom/.staging/<草稿>/`）上运行，既有脚本链不动：

1. **域级校验（必须全绿）**：`gen-workflows` → `gen-domain-model`（表头逐字、技能全覆盖、
   GT 绑定、PII 脱敏）→ `build-app`（预览页必须构建成功）；
2. **快检基线（秒级）**：`build-domain-work-design` → `design:verify`；
3. **完整门禁（分钟级，后台）**：`verify:workflow-contracts`、`verify:workflow-delivery`。

`design:verify` 当前是 **13 域 / 39 模块 / 78 工作流闭集断言**：

- **修订草稿**：快检 + 完整门禁都必须通过，才可导出合入包；允许的操作包括
  新增台账表（需同步 Type-Dict 行）、调整技能/§9 规则、增补 GT 等**不改动 78 条工作流闭集**的修订；
- **新增域草稿**：闭集门禁必然不覆盖新增域，失败摘要会登记为「基线扩展缺口清单」；
  合入包必须携带该清单，**扩展基线门禁之后**才能正式固化。

夹具验证（`node scripts/custom/verify-fixtures.mjs`）覆盖：修订新增台账表（全绿）、
全新自定义域（域级全绿 + 基线缺口登记）、未脱敏 PII、技能无覆盖、改写生成物三类反例。

不允许把「预览可看」当成「已生效」，也不允许跳过校验声称完成。

## 6. 固化（正式生效）

1. 应用内「导出合入包」→ `<草稿>/consolidation/`（overlay + verify.json + 变更清单 + README）；
2. 开发源树执行 `node scripts/custom/apply-draft.mjs --draft <合入包> --root <源树>`（默认 dry-run，`--yes` 写入，
   被覆盖文件备份到 `reports/custom/rollback/<draft>/`）；
3. 依次跑 `design:verify → verify:workflow-contracts → verify:workflow-delivery → build:app`；
4. 按发布流程重打包安装器并做安装态验收；
5. 新 build 安装后，应用内按资产哈希自动标记「已固化」。

## 7. 本地自测清单（Agent 交付前逐项确认）

- [ ] 需求三项（服务谁/场景/核心流程）已由用户确认；
- [ ] overlay 只包含白名单内的文件，无生成物；
- [ ] 台账 CSV 表头与场景/模型声明逐字一致；
- [ ] 每个技能都有工作流覆盖，且工作流的 skill 在场景声明内；
- [ ] PII 列没有未脱敏原值；
- [ ] 已运行 `node scripts/custom/verify-draft.mjs --draft "<草稿目录>"` 且 `ok=true`；
- [ ] 需要预览时已构建预览，并说明「预览 ≠ 已生效」；
- [ ] 报告包含：改动文件清单、校验结果、预览状态、未完成项。

## 8. 失败交付规则（与 dataelement 标准同口径）

- 无法安装/无法运行/无法校验时，保留经过校验的产物，准确说明缺少的步骤；
- **不得虚构成功**，不得用「文件存在」「HTTP 可达」冒充「已生效」；
- 连续 3 轮修复仍不过基础校验时，停止并移交人工处理，附上 `verify.json` 的 gaps。

## 9. 已知限制（v1）

- 13 域闭集门禁（`design:verify` 等）尚未推广到「13+N」，新增域在合入前需要基线扩展工作；
- 修订草稿不得改变内置域的工作流条数/编号（生成器为闭集模板）；需要新增工作流时走「新增域」或先扩展基线；
- 完整门禁耗时数分钟，只提供后台运行与证据归档；
- 应用内不执行安装/升级/市场类动作，全部走既有发布与外部终端纪律。
