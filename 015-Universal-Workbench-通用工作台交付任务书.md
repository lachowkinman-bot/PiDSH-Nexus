# 015 · Universal Workbench 全能 Agent 工作台（桌面版）交付任务书（v2.0）

> **文件性质**：本文件是一个**资源包任务书**——包内已预置"现成的、所有的"可用资源（packages/skills/plugins/extensions/依赖项/依赖库/依赖包/脚本/12 业务域应用场景 preset 设计文档/PRD 文档/Code Review 文档/README 文档）。发送给任意支持 Goal/自治模式的 Agent（pi / codex / claude code / zcode / dsh / minimax / 豆包工作 / Trae Work / Kimi code / opencode），Agent 在预置资源基础上**组装、定制并交付"全能 Agent 工作台桌面应用"**。
> **演进地位**：取代 015 v1.0（其全部内容被本版吸收为子集）。v1→v2 增量：①三层资源包边界（预置层零下载/自制层零生成/缺口层 gap 化）；②10 运行器兼容矩阵 + runner-probe 启动自检；③桌面应用"安装器保底 + 壳升级"双形态；④PRD/CR/README/preset 设计文档基线版预置 + CR 记录升级为门禁证据；⑤门禁扩展至 U1-U14；⑥缺陷清零表扩至 22 类。
> **必附配套（资源包，见 §3.2 目录树）**：`manifests/`（包清单+能力注册表+12 域场景与工作流）、`offline/`（P0/P1 全部 tarball + Node 运行时 + dsh-web 源码快照）、`scripts/`（workbench 双平台总控 + runner-probe + 安装器基线）、`templates/`（技能模板/Type-Dict/工作区骨架）、`docs/`（PRD 基线版、preset 设计文档、CR checklist、双 README）、`reports/capability-gap.md`（强制占位）。
> **版本**：v2.2 ｜ 日期：2026-09-28 ｜ 评分口径：§11.2（目标 ≥98/100）
> **v2.2 增补**：依据 2.0 复盘（docs/why-not-met-2.0.md）修复八项新缺口——①新增 **U18 整合深度门禁**（skill 节点执行主体必须为 pi/dsh，engine.run 审计 ≥1，禁止本地 JS 冒充引擎执行）；②新增 **U19 交付宣告一致性门禁 + 交付阻断规则**（U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL → 禁止宣告交付；宣告前逐项对照证据，语义升级=V1）；③**U16 升级为交付阻断门禁（BLOCKING）**；④**U15 落机械判据**（逐域差异化界面清单 + F7/F8/F11 页面 + 交互级四操作审计事件 + 同构截图判定规则）；⑤U10 增 **GT 技能与 scene 声明一致性断言**（EAP 必跑 eap-referral）；⑥U3 增**安装探测规范**（禁止单一 npm root -g 判定）；⑦U6 增**扫描新鲜度规则**（交付窗口内重跑）；⑧S0 强制凭据探针。详见 §15。

---

## §0 最小可执行指令（发给任何 Runner 的第一段话）

```
你是 Universal Workbench 交付 Agent。本任务是资源包组装与定制交付，不是从零开发。

第一步（强制）：运行 scripts/runner-probe（§4.1）产出 runner-profile.json —— 后续所有
指令按 profile 的能力分支执行；profile 缺失任何能力时按 §4.3 降级取证，不得跳过验收。

资源使用规则：
- offline/ 内已预置 P0+P1 全部安装包与 Node 运行时（SHA256 锁定）：禁止联网重新下载预置层资源；
  只有缺口层（扩展位）允许按 §3.6 防幻觉纪律现场核验/降级
- docs/ 内已预置 PRD 基线版、12 域 preset 设计文档、CR checklist、双 README：
  你的职责是"定制化"（按 runner-profile 与壳达标结果修改基线），不是重写
- manifests/packages.manifest.csv 是唯一包清单真源；文档中的表格仅为注释（C8）
- reports/capability-gap.md 必须存在（允许为空表头）

已确认的硬约束，无需询问：
- DSH 版本 ≥0.1.2（CVE-2026-82533 修复线）；Web UI 仅绑 127.0.0.1，禁止暴露 0.0.0.0
- PowerShell native 命令成败只认 $LASTEXITCODE（禁 try/catch 判定）；bash 只认退出码 if
- 哈希三级回退 shasum→sha256sum→openssl；空哈希=失败
- 新增任何包名前必须 npm view 核实；找不到→登记 capability-gap 走降级（V5/V6）
- 桌面形态由 U14 机械门禁决定：dsh-web 壳 25 项 UI 测试 ≥12 绿→交付内嵌壳；
  否则自动降级"安装器+浏览器模式"，不得虚报形态

推进顺序：严格 U1→U14（§12），每道门禁产出证据 + 对应 cr-<artifact>.md 代码审查记录后再进下一步。
禁止：伪造结果；Chassis 写业务逻辑；引用无出处数据（V8）；承诺未实测的 runner/形态能力（D22）。
停止条件：同一问题连续 3 次修复失败即停（§12.3）。
```

---

## §1 不可变约束与一票否决

### 1.1 不可变约束 C1-C8

| # | 约束 | 判定方式 |
|---|---|---|
| C1 | 技术底座为 Pi + DSH（包内 offline/ 预置版本），禁止推翻、禁止降底座版本 | `dsh --version` / `pi --version` 与 tools-versions.txt 一致 |
| C2 | 业务域逻辑只写在 Preset 层；Chassis 层出现业务域词汇即违规 | §2 词汇表 grep Chassis 目录 = 0 命中 |
| C3 | 所有工具调用必须经过 Permission Gateway（ALLOW / DENY / APPROVAL_REQUIRED） | 权限矩阵 × 工具清单交叉测试日志 |
| C4 | 安全单调性：Preset 只能收紧 Chassis 默认值（`permission.min_level` 只能增大、`redact.fields` 只能增广、`memory.pii_allowed` 只能为 false） | preset lint 规则方向校验 |
| C5 | 卸载可逆：任何 Preset 卸载后 Chassis 可独立运行 | uninstall→chassis 冒烟通过 |
| C6 | append-only：审计与 Trajectory 只增不删 | 日志行数与 mtime 单调性检查 |
| C7 | 单一引用源：提示词库/命令速查/故障码表/Runner 矩阵在全文档集只出现一次 | 全文检索重复定义 = 0 |
| C8 | 清单唯一真源：包名/版本只存在于 manifest CSV 与 bundle 清单，文档禁止复制包表格 | 文档内第二份包清单 = 违规 |

### 1.2 一票否决 V1-V8（出现任一，总分强制归零）

| # | 否决项 |
|---|---|
| V1 | 伪造安装/测试/截图/日志结果；未跑标 PASS；未装标成功 |
| V2 | 用 Mock 冒充核心能力；用 Prompt 描述冒充权限/审批系统；用静态页面冒充 Agent |
| V3 | 用 Chat 记录冒充 Task State；用文件夹冒充协作/审计系统 |
| V4 | 删除清单行/失败记录来"消掉"证据（删除等于抹掉证据） |
| V5 | 在安装脚本中写入未经 `npm view` 核实的包名 |
| V6 | 凭空编写行业/业务域包名并标记为已交付 |
| V7 | 将敏感数据（L3/L4）发送到公网搜索或未授权工具；明文密钥入 Git |
| V8 | 引用无出处数据（star/评分/通过率/下载量必须附来源或"内部实测+复现命令"） |

---

## §2 术语与分类学（执行前必须通读）

### 2.1 术语表（唯一权威定义）

| 术语 | 定义 |
|---|---|
| **Universal Workbench** | 最终交付物：全能 Agent 工作台桌面应用 = Chassis + 12 业务域 Preset + 桌面安装形态 |
| **资源包（Bundle）** | 本任务书随附的完整资源目录树（§3.2），含预置层/自制层/缺口层三类资源 |
| **预置层** | P0+P1 全部 tarball、Node 运行时、dsh-web 源码快照——SHA256 锁定，禁止联网重下 |
| **自制层** | 本仓库直接携带的文档与模板：12 域 preset 设计文档、PRD 基线版、CR checklist、双 README、脚本、skills/Type-Dict/工作区模板——Agent 只做定制化 |
| **缺口层** | 已知不存在现成包的能力：以扩展位（capability id）+ 降级预案形式预置，明确标注"无现成包" |
| **Chassis（通用机架）** | L0 底座（Pi+DSH）+ L1 通用机架（十要素机制、Runtime Contract、Permission/Approval Engine、Capability Registry），业务域无关 |
| **全能（Omni）** | 13 项产品功能（§9.1 PRD F1-F13）+ 12 业务域 + Chief of Staff 主控编排（跨域任务拆解/分发/汇总） |
| **业务域（Domain）** | 12 个标准业务线层分类（§2.2） |
| **Preset** | "行业 × 业务域 × 岗位"的最小可工作配置（scene.yaml + workflows + skills + policies） |
| **行业 Overlay** | 叠加在业务域上的行业合规/术语/数据分级差异，正交可选（首批 0 个） |
| **扩展位（Extension Slot）** | 只声明 capability id、不绑定包名的装配位；找不到成熟包→capability-gap 降级 |
| **capability-gap** | 能力缺口正式登记与降级流程（自建 MCP / 人工导出 / 暂缓） |
| **redact_gate** | 物理脱敏前置闸门：个体级敏感数据流向公网/外部工具前必须被改写 |
| **Golden Task（GT）** | 带八元组的端到端真实任务（输入/期望计划/期望工具/期望权限/期望产物/期望文件/期望审计/期望质量） |
| **runner-profile.json** | 启动自检产物：当前 Runner 的身份与能力清单（§4.1），所有门禁据此分支 |
| **桌面形态 D1/D2** | D1=安装器+浏览器模式（保底）；D2=dsh-web 内嵌壳（达标升级），由 U14 机械门禁裁定 |
| **学员件** | Agent 按 §6/§7 标准编写并在双平台干净环境逐条实测后交付的学员手册 |
| **CR 记录（cr-*.md）** | 按 docs/CR-checklist.md 逐项勾选完成的代码/交付物审查记录，每个 U 门禁产出物必附 |

### 2.2 12 业务域分类学（业务线层规范）

| # | 业务域 | 代号 | 子域/备注 |
|---|---|---|---|
| 1 | 战略管理 | STRAT | 经营分析、OKR、竞品监测 |
| 2 | 营销管理（线上） | MKT-ON | 内容、投放、线索漏斗 |
| 3 | 营销管理（线下） | MKT-OFF | 活动、物料、经销商（与 2 为同域双 Scene） |
| 4 | 销售管理 | SALES | CRM、报价、合同、业绩 |
| 5 | 财务管理 | FIN | 报销、预算、发票、财报 |
| 6 | 招聘管理 | REC | 原六职能"招聘"整体迁移 |
| 7 | 培训管理 | TRN | 课程、学时、证书资质 |
| 8 | 绩效管理 | PRF | KPI、考核、校准 |
| 9 | 薪酬管理 | COMP | 全域 L4，redact_gate 强制 |
| 10 | 福利设计 | BEN | 商保、体检、弹性福利（健康数据 L4） |
| 11 | 行政管理 | ADMIN | 采购、资产、用印、会议 |
| 12 | 合规管理 | CMP | 制度、审计留痕、PIPIA |
| 13 | 员工关系管理（含 EAP） | ER / EAP | ER=处分/离职/争议；EAP=心理援助 L4+ 特例（§8.4） |

> 计 12 域：营销线上线下为同域两个 Scene 变体；员工关系含 EAP 子域。
> **六职能映射**（附录 A）：招聘→REC；培训→TRN；绩效→PRF；薪酬→COMP；HRBP→拆入 STRAT/PRF/ER；员工关系→ER/EAP。旧文档"六职能"字样一律按本表翻译。

---

## §3 三层资源包与清单（组件②）

### 3.1 三层资源边界（Q1 决策）

| 层 | 内容 | Agent 职责 | 纪律 |
|---|---|---|---|
| **预置层** | offline/npm/*.tgz（P0 17 包 + P1 7 包 tarball）、offline/node/（Node 24 LTS 双平台安装文件，latest-v24.x=v24.21.0）、offline/github/dsh-web/（源码快照）、SHA256SUMS | 校验哈希→本地安装；**禁止联网重新下载** | U1 断网演练验证零依赖 |
| **自制层** | 12 域 Scene/工作流 YAML、PRD 基线版、CR checklist、双 README、preset 设计文档、scripts 全套、templates/（12 域技能模板+Type-Dict+工作区骨架） | **定制化**（按 runner-profile/壳达标结果改基线）+ 组装；禁止推倒重写 | 定制后 diff 记录进 cr-定制.md |
| **缺口层** | 7 个行业扩展位（capability id：`cap.ind.mes-readonly` / `cap.ind.his-readonly` / `cap.ind.regulatory-filing` / `cap.ind.pos-readonly` / `cap.ind.gov-formatter` / `cap.ind.lms-readonly` / `cap.ind.appsec-scan`）、企业连接器（HRIS/邮件日历 profile） | 按 §3.6 防幻觉纪律现场核验→回填包名或降级登记 | "无现成包"必须明示，禁虚构（V5/V6） |

> **"所有的"的诚实兑现**：P0/P1 零下载 + P2 模板零生成 + 已知缺口 gap 化。不承诺"字面所有"——行业 MCP/ERP/HRIS 连接器在企业侧不存在统一现成包（013 实测 21/22 行业包虚构的前车之鉴）。

### 3.2 资源包目录树（bundle 规格）

```
universal-workbench-bundle/
├── 015-Universal-Workbench-通用工作台交付任务书.md   ← 本文件（唯一执行入口）
├── manifests/
│   ├── packages.manifest.csv          ← 55 行（P0=17/P1=7/P2=31，17 列）
│   ├── capability-registry.csv        ← capability→实现 映射（U1 核验后固化）
│   ├── tag-manifest.csv               ← runner 无持久 git 时的哈希链取证（§4.3）
│   ├── scenes/                        ← 12 域 scene.yaml（自制层，预置）
│   └── workflows/                     ← 12 域工作流 YAML（自制层，预置）
├── offline/                           ← 预置层
│   ├── npm/*.tgz + SHA256SUMS.txt     ← P0+P1 全部 tarball
│   ├── node/                          ← Node 24 LTS：node-v24.x-win-x64.msi / node-v24.x-mac.pkg（以 SHASUMS 解析为准）
│   └── github/dsh-web/                ← 源码快照（8k★ 项目，仅源码分发）
├── scripts/
│   ├── workbench.ps1 / workbench.sh   ← 总控：fetch|install|verify|repair|report|package
│   ├── runner-probe.ps1 / runner-probe.sh
│   └── installer/win/setup.iss + installer/mac/build_dmg.sh   ← 安装器基线（§10）
├── templates/
│   ├── skills-domain-{strat...er-eap}/ ← 12 域技能模板（每域 3-6 个 SKILL.md）
│   ├── Type-Dict/type-dict.csv        ← 12 域数据字段字典（L1-L4 标注）
│   └── workspace/                     ← 16 子目录工作区骨架 + 13 模块目录
├── docs/
│   ├── PRD-桌面应用-基线.md            ← §9.1（功能清单 F1-F13）
│   ├── preset-design/                 ← 12 域 preset 设计文档（§8 矩阵的完整化）
│   ├── CR-checklist.md                ← 五类审查清单（§9.3）
│   ├── README-学员版.md / README-维护者版.md
│   └── 30天落地计划-模板.md / 交接文档规范.md / 工作建模模板.md（三件套遗产）
├── reports/capability-gap.md          ← 强制占位
└── installer-output/                  ← U14 产出 setup.exe / Workbench.dmg
```

### 3.3 清单真源与列结构

`manifests/packages.manifest.csv` 17 列不变：`tier,rank,name,npm_name,source_type,repo_hint,version_range,role,purpose,industries,install_cmd,test_cmd,resolved_version,resolved_tarball,sha256,status,note`。`status` 枚举：`PRESET_OK / OK / NPM_MISSING_BUILD_REQUIRED / GAP_REGISTERED / FAILED`。文档禁止复制包表格（C8）。

### 3.4 source_type 四枚举与 Capability Registry

| source_type | 含义 | 获取方式 |
|---|---|---|
| `npm` | npm 包 | 包内 offline/npm/ 预置 tarball（预置层）；缺口层才允许 `npm pack` |
| `github-source` | 仅 GitHub（dsh-web） | offline/github/ 源码快照 → 本地构建 |
| `workspace-template` | 技能/场景模板 | templates/ 复制注入 |
| `external-connector` | 企业自建 MCP | connector profile 配置 |

Registry 映射（capability-registry.csv，Agent 按 U1 核验固化）：`cap.excel.panel→dsh-excel-panel`、`cap.memory.session→pi-hermes-memory`、`cap.approval.single→pi-approval-guardian`、`cap.approval.multi→@mutmutco/pi-plugin`、`cap.redact.all→pi-redact-all`、`cap.orchestration.dag→pi-dag-core`、`cap.knowledge.graph→graph-memory`、`cap.subagent.parallel→@tintinweb/pi-subagents`、`cap.connector.mcp→pi-mcp-adapter`、`cap.orchestration.chief→skills-cockpit` 等。**禁止第三方插件市场站作来源**（无背书 SEO 群，"indexed ≠ verified"）。

### 3.5 防断供四机制

1. **预置层优先**：断网环境全程可装（U1 断网演练）；扩展位优先于找包。
2. **镜像兜底**：仅缺口层下载需要网络时 `--Mirror official|npmmirror|tencent`（`--userconfig` 隔离，结束还原）。
3. **单包失败降级五情形**：失败→登记 gap→判定是否 Chassis 必需→非必需剔除并标 `NOT_IMPLEMENTED`（附替代方案）→不中断、不假成功。
4. **U12 断供演练**：随机抽 2 个 P0 包模拟损坏 → gap 降级 → 核心功能不受影响。

### 3.6 防幻觉纪律（操作化）

> 缺口层新增任何包名前必须 `npm view <包名> version` 核实；找不到→登记 `reports/capability-gap.md` 走"自建 MCP Server / 人工数据导出 / 暂缓"。**不得凭空编写包名**（V5/V6）。引用外部数据必须附来源或"内部实测+复现命令"（V8）。

---

## §4 Runner 兼容层（10 运行器）

### 4.1 启动探测自检（第一步，强制）

`scripts/runner-probe.sh|.ps1` 参考实现要点：

```bash
#!/usr/bin/env bash
# runner-probe: 探测当前 Runner 身份与能力 → runner-profile.json（所有门禁据此分支）
set -uo pipefail
P="runner-profile.json"
detect(){ command -v "$1" >/dev/null 2>&1 && echo "$1" || echo "-"; }
RUNNER="unknown"
for c in pi dsh codex claude zcode opencode; do
  [ "$(detect "$c")" != "-" ] && RUNNER="$c" && break
done
# minimax / 豆包工作 / Trae Work / Kimi code：多数为 IDE/平台型，无统一 CLI——
# 以其宿主环境变量/配置文件特征识别，识别失败保持 unknown（走通用模式，能力缺失项据实登记）
GIT_PERSIST="no"; git rev-parse --is-inside-work-tree >/dev/null 2>&1 && GIT_PERSIST="yes"
NET="no";   curl -sS --fail --max-time 5 https://registry.npmjs.org/pi2dsh >/dev/null 2>&1 && NET="yes"
HASH="none"; command -v shasum >/dev/null 2>&1 && HASH=shasum || { command -v sha256sum >/dev/null 2>&1 && HASH=sha256sum || { command -v openssl >/dev/null 2>&1 && HASH=openssl; }; }
cat > "$P" <<EOF
{"runner":"$RUNNER","git_persistent":"$GIT_PERSIST","network":"$NET","hash_tool":"$HASH",
 "os":"$(uname -s)","detected_at":"$(date -Iseconds)","unverified_capabilities":[]}
EOF
echo "runner-profile.json written: $RUNNER"
```

> 规则：探测**只登记事实，不硬编码 runner 专属命令**（缺陷 D21 闭合）；`unknown` 不是错误——通用模式 + 能力缺失项写入 `unverified_capabilities` 并如实上报。

### 4.2 Runner 兼容矩阵（10 行，唯一源 = 本表）

| Runner | 探测特征 | 自治/Goal 等价物 | 已知差异与风险 | 门禁取证 |
|---|---|---|---|---|
| pi | CLI `pi`（earendil-works） | print/JSON/RPC/SDK 四形态 + loop-mode | 无内置沙箱/权限——必须装 approval-guardian | git tag 或哈希链 |
| dsh | CLI `dsh` / npx 包 | Goal 模式 + plugin 体系 | 0.1.x preview，破坏性变更；禁 issue 渠道 | git tag 或哈希链 |
| codex | CLI `codex`（@openai/codex） | 自治执行模式（以官方文档为准） | 沙箱策略与 dsh 不同 | git tag 或哈希链 |
| claude code | CLI `claude` | 自治执行模式（以官方文档为准） | Skill/Hook 机制与 pi 扩展不同 | git tag 或哈希链 |
| zcode | CLI `zcode` | 自治执行模式（以官方文档为准） | — | git tag 或哈希链 |
| opencode | CLI `opencode` | 自治执行模式（011 语料先例） | — | git tag 或哈希链 |
| minimax | 平台/IDE 特征（未公开核验） | 未核验 | **能力未核验：矩阵行不承诺，实测后回填** | 哈希链（若 git 不可用） |
| 豆包工作 | 平台/IDE 特征（未公开核验） | 未核验 | 同上 | 哈希链 |
| Trae Work | 平台/IDE 特征（未公开核验） | 未核验 | 同上 | 哈希链 |
| Kimi code | CLI/平台特征（未公开核验） | 未核验 | 同上 | 哈希链 |

> **D22 纪律**：4 个未核验 Runner 的行不写任何能力承诺；U13 只对"实测过的 runner"出具通过结论，其余标注 `UNVERIFIED_RUNNER`（不阻断交付，但不得宣称"10/10 支持"）。

### 4.3 门禁取证降级规则

- Runner 有持久 git → 沿用 git tag 链（`v1.x-<pkg>-ok` … `v5.0-universal-workbench-release`）。
- Runner 无持久 git → 写 `manifests/tag-manifest.csv` 哈希链：`artifact,sha256,timestamp,prev_hash`（首行 prev_hash=seed），每道门禁追加一行——append-only（C6），等价可审计。
- 两条路径的通过标志完全一致，门禁文档只写"取证=tag 或哈希链"。

---

## §5 总控脚本规格（组件①）

### 5.1 接口（在 v1 五子命令上新增 package）

```
workbench fetch|install|verify|repair|report|package
  fetch   [-Tier P0|P1|P2|ALL] [-Mirror ...]   # 预置层：仅校验 offline/ 哈希；缺口层：才联网
  install [-Tier ...]   # 三路分流安装（npm tarball / github 构建 / 模板复制），逐包 tag 或哈希链
  verify  [-Element 1..10]  # 十要素机械检查
  repair  [-Package <name>] # 幂等重装
  report  # 汇总自评 → reports/workbench-report.md
  package # 调 installer 基线构建桌面安装包（U14）
runner-probe  # §4.1
```

### 5.2 平台兼容硬规则（违者 U2 不过）

| 规则 | 依据 |
|---|---|
| PowerShell 禁 try/catch 判 native 成败，一律 `if ($LASTEXITCODE -eq 0)` | native 命令非 0 不抛异常（013 P0-2） |
| Windows 必须写 `curl.exe` | PS 中 curl 是 IWR 别名 |
| 读文件显式 UTF-8 | PS5.1 按 ANSI 误读（progress.md 实录） |
| 哈希三级回退 shasum→sha256sum→openssl；空哈希=失败 | Git Bash 无 shasum（014 P0-4） |
| bash `set -uo pipefail`（不用 -e）；CSV 先 `tr -d '\r'` | 局部失败不阻断；CRLF |
| PS 兼容子集：禁 `??`、三元、`-AsHashtable` | PS5.1 差异 |
| 下载仅 http/https + host 白名单 + 拒绝回环/私有/保留地址 | 安全红线 |

### 5.3 预置层校验参考实现（fetch 在预置层只做哈希审计，不联网）

```bash
# 预置层校验（bash）：逐包 SHA256 复核，任何不符即 U1 FAIL
# （hash_file 三级回退定义见 §5.4 workbench.sh，此处 source 后调用）
source scripts/workbench.sh --lib-only 2>/dev/null || true
cd offline/npm || exit 1
while read -r sum file; do
  actual="$(hash_file "$file")"
  [ "$actual" = "$sum" ] || { echo "HASH_MISMATCH: $file" >&2; exit 1; }
done < SHA256SUMS.txt
echo "PRESET_VERIFY_DONE"
```

```powershell
# 预置层校验（PS 同构）
Get-ChildItem offline\npm\*.tgz | ForEach-Object {
  $name = $_.Name
  $expect = ((Select-String -Path offline\npm\SHA256SUMS.txt -Pattern ([regex]::Escape($name))).Line -split '\s+')[0]
  $actual = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expect.ToLower()) { throw "HASH_MISMATCH: $name" }
}
"PRESET_VERIFY_DONE"
```

### 5.4 缺口层 fetch 参考实现（仅扩展位/失败补拉时联网；预置于 scripts/，U2 双平台实跑后固化）

```powershell
# scripts/workbench.ps1 —— fetch 子命令核心（缺口层）
[CmdletBinding()]
param(
  [ValidateSet('fetch','install','verify','repair','report','package')][string]$Cmd = 'fetch',
  [ValidateSet('P0','P1','P2','ALL')][string]$Tier = 'ALL',
  [ValidateSet('official','npmmirror','tencent')][string]$Mirror = 'official',
  [string]$Manifest = 'manifests/packages.manifest.csv',
  [string]$OutDir = 'offline', [string]$Reports = 'reports', [int]$Retry = 3
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false   # PS7 隔离 native 与 EAP；PS5 忽略无害
$REG = @{ official='https://registry.npmjs.org'; npmmirror='https://registry.npmmirror.com'; tencent='https://mirrors.tencent.com/npm' }
$ALLOWED = @('registry.npmjs.org','registry.npmmirror.com','mirrors.tencent.com','github.com','objects.githubusercontent.com','nodejs.org')
function Test-AllowedHost([string]$Url){
  if ($Url -notmatch '^https?://') { return $false }              # 仅 http/https
  $h = ([uri]$Url).Host
  if ($ALLOWED -notcontains $h) { return $false }                 # 白名单
  if ($h -match '^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?)') { return $false }  # 拒绝回环/私有/保留
  return $true
}
function Get-Hash([string]$Path){
  $h = Get-FileHash -Algorithm SHA256 -LiteralPath $Path
  if (-not $h -or -not $h.Hash) { throw "EMPTY_HASH" }            # 空哈希=失败（014 P0-4）
  return $h.Hash.ToLower()
}
$rows = [IO.File]::ReadAllLines((Resolve-Path $Manifest), (New-Object Text.UTF8Encoding($false))) |
        Where-Object { $_ -and $_ -notmatch '^tier,' }
$work = foreach($r in $rows){ $c = $r -split ',(?=(?:[^"]*"[^"]*")*[^"]*$)', 17; [pscustomobject]@{
  tier=$c[0]; rank=$c[1]; name=$c[2]; npm=$c[3]; src=$c[4]; repo=$c[5]; ver=$c[6];
  install=$c[10]; test=$c[11]; status=$c[15]; note=$c[16] } }
if ($Tier -ne 'ALL') { $work = $work | Where-Object tier -eq $Tier }
New-Item -ItemType Directory -Force -Path $OutDir, $Reports | Out-Null
$gap = @(); $resolved = @()
foreach($p in ($work | Sort-Object rank)){
  if ($p.src -eq 'github-source'){
    $gap += "|$($p.name)|P2|npm E404 设计如此，走 GitHub 本地构建（人工可选）|要素1|git clone $($p.repo) 后本地构建|"
    $resolved += "$($p.name),SKIP_GITHUB_SOURCE,,"; continue }
  if ($p.src -ne 'npm') { $resolved += "$($p.name),SKIP_$($p.src.ToUpper()),,"; continue }
  if ($p.status -eq 'PRESET_OK'){                                  # 预置层：只校验不下载
    $t = Join-Path $OutDir "npm/$(($p.npm -replace '[/@]','-'))-*.tgz"
    if (Get-ChildItem $t -ErrorAction SilentlyContinue) { $resolved += "$($p.npm),PRESET_OK,$(Get-Hash (Get-ChildItem $t).FullName)"; continue } }
  $spec = "$($p.npm)@latest"; $ver = $null                         # 以下仅缺口层执行
  for($i=0; $i -lt $Retry; $i++){
    $out = npm view $spec version --registry $REG[$Mirror] 2>$null
    if ($LASTEXITCODE -eq 0 -and $out) { $ver = ("$out").Trim(); break } }   # 退出码判定，禁 try/catch
  if (-not $ver){ $gap += "|$($p.npm)|$($p.tier)|npm view 失败|十要素映射待评|登记降级|"; $resolved += "$($p.npm),FAILED,,"; continue }
  $dest = Join-Path $OutDir "npm/$(($p.npm -replace '[/@]','-'))-$ver.tgz"
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  $url = "$($REG[$Mirror])/$($p.npm)/-/$(($p.npm -split '/')[-1])-$ver.tgz"
  if (-not (Test-AllowedHost $url)) { $gap += "|$($p.npm)|$($p.tier)|host 校验拒绝|—|换镜像|"; $resolved += "$($p.npm),REJECTED_HOST,,"; continue }
  $ok = $false
  for($i=0; $i -lt $Retry -and -not $ok; $i++){
    & curl.exe -L --fail --retry 2 -o $dest $url 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $dest) -and (Get-Item $dest).Length -gt 0) { $ok = $true } }
  if (-not $ok){ $gap += "|$($p.npm)|$($p.tier)|下载失败|十要素映射待评|重试/换镜像|"; $resolved += "$($p.npm),FAILED,,"; continue }
  $resolved += "$($p.npm),$ver,$(Get-Hash $dest)"
}
$resolved  | Set-Content -Encoding UTF8 'manifests/packages.manifest.resolved.csv'
$head = '| 包名 | 档 | 失败原因 | 影响要素 | 替代方案 |'
$head + ($gap -join "`n") | Set-Content -Encoding UTF8 "$Reports/capability-gap.md"   # gap 必须存在（允许为空表头）
Get-ChildItem $OutDir/npm -Filter *.tgz | ForEach-Object { "$($_.Name)  $((Get-Hash $_.FullName))" } |
  Set-Content -Encoding UTF8 "$OutDir/npm/SHA256SUMS.txt"
"FETCH_DONE tier=$Tier"
```

```bash
# scripts/workbench.sh —— fetch 子命令核心（缺口层；修复 OUT_CSV 回写与 CRLF 两项历史缺陷）
#!/usr/bin/env bash
set -uo pipefail   # 刻意不用 -e：局部失败不阻断
CMD="${1:-fetch}"; TIER="${2:-ALL}"; MIRROR="${3:-official}"
MANIFEST="manifests/packages.manifest.csv"; OUT="offline"; REPORTS="reports"; RETRY=3
case "$MIRROR" in
  official)  REG="https://registry.npmjs.org";;  npmmirror) REG="https://registry.npmmirror.com";;
  tencent)   REG="https://mirrors.tencent.com/npm";;
esac
ALLOWED="registry.npmjs.org registry.npmmirror.com mirrors.tencent.com github.com objects.githubusercontent.com nodejs.org"
allowed_host() { case " $ALLOWED " in *" $1 "*) return 0;; *) return 1;; esac; }
private_host() { case "$1" in localhost|127.*|10.*|192.168.*|169.254.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|0.0.0.0|::1) return 0;; *) return 1;; esac; }
hash_file() {  # 三级回退；空哈希=失败（014 P0-4）
  if   command -v shasum    >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v openssl   >/dev/null 2>&1; then openssl dgst -sha256 "$1" | awk '{print $NF}'
  else echo "FATAL: no hash tool" >&2; exit 1; fi
}
mkdir -p "$OUT/npm" "$REPORTS"
RESOLVED="manifests/packages.manifest.resolved.csv"; : > "$RESOLVED"      # 修复：resolved 必须回写
GAP="$REPORTS/capability-gap.md"; [ -f "$GAP" ] || printf '| 包名 | 档 | 失败原因 | 影响要素 | 替代方案 |\n' > "$GAP"
tail -n +2 "$MANIFEST" | tr -d '\r' | while IFS=, read -r tier rank name npm src repo ver role purpose ind install_cmd test_cmd r1 r2 r3 status note; do
  [ -n "$tier" ] || continue
  [ "$TIER" = "ALL" ] || [ "$tier" = "$TIER" ] || continue
  if [ "$src" != "npm" ]; then
    echo "$name,SKIP_${src^^}," >> "$RESOLVED"
    [ "$src" = "github-source" ] && echo "|$name|P2|npm E404 设计如此，走 GitHub 本地构建|要素1|git clone $repo|" >> "$GAP"
    continue
  fi
  if [ "$status" = "PRESET_OK" ]; then                                   # 预置层：只校验不下载
    P=""; for f in "$OUT"/npm/$(echo "$npm" | tr '/@' '--')-*.tgz; do [ -e "$f" ] && P="$f"; done
    if [ -n "$P" ]; then echo "$name,PRESET_OK,$(hash_file "$P")" >> "$RESOLVED"; continue; fi
  fi
  V=""; i=0                                                              # 以下仅缺口层执行
  while [ $i -lt $RETRY ]; do
    V="$(npm view "$npm@latest" version --registry "$REG" 2>/dev/null | tr -d '\r\n')"; [ -n "$V" ] && break; i=$((i+1))
  done
  if [ -z "$V" ]; then echo "|$npm|$tier|npm view 失败|十要素映射待评|登记降级|" >> "$GAP"; echo "$name,FAILED," >> "$RESOLVED"; continue; fi
  URL="$REG/$npm/-/$(basename "$npm")-$V.tgz"; HOST="$(printf '%s' "$URL" | sed -E 's#https?://([^/]+)/.*#\1#')"
  if ! allowed_host "$HOST" || private_host "$HOST"; then echo "|$npm|$tier|host 校验拒绝|—|换镜像|" >> "$GAP"; echo "$name,REJECTED_HOST," >> "$RESOLVED"; continue; fi
  DEST="$OUT/npm/$(echo "$npm" | tr '/@' '--')-$V.tgz"; ok=""; i=0
  while [ $i -lt $RETRY ]; do
    if curl -L --fail --retry 2 -sS -o "$DEST" "$URL" && [ -s "$DEST" ]; then ok=1; break; fi; i=$((i+1))
  done
  if [ -z "$ok" ]; then echo "|$npm|$tier|下载失败|十要素映射待评|重试/换镜像|" >> "$GAP"; echo "$name,FAILED," >> "$RESOLVED"; continue; fi
  H="$(hash_file "$DEST")"; case "$H" in ''|*[!0-9a-f]*) echo "|$npm|$tier|空哈希=失败|—|一票否决线|" >> "$GAP"; echo "$name,EMPTY_HASH," >> "$RESOLVED";; *) echo "$name,$V,$H" >> "$RESOLVED";; esac
done
for f in "$OUT"/npm/*.tgz; do [ -e "$f" ] || continue; echo "$(basename "$f")  $(hash_file "$f")"; done > "$OUT/npm/SHA256SUMS.txt"
echo "FETCH_DONE tier=$TIER"
```

（install/verify/repair/report 契约见 §5.1 表；package 子命令见 §10。）

---

## §6 双平台分步指令集（组件③，学员可照做标准）

> 每步 = 目标/耗时/三栏命令（PS7｜PS5｜bash）/✅验证/🛠失败跳 §7 错误码。
> **学员件规则**：Agent 在干净 Windows 虚机 + 干净 macOS 各实跑一遍 S0-S10，逐条打勾留痕（U11）。

### 6.0 总耗时预算（前置）

| 阶段 | 步 | 预算 |
|---|---|---|
| 自检与环境 | R + S0-S1 | 50 min |
| 底座 | S2-S3 | 60 min |
| 工作区 | S4 | 30 min |
| 选装 | S5 | 30 min |
| 冒烟 | S6 | 40 min |
| 场景 | S7 | 60 min |
| 演练 | S8 | 40 min |
| 桌面安装包 | S9 | 60 min |
| 打包交付 | S10 | 20 min |
| **合计** | | **390 min（拆两个半天）** |

### 步骤索引（完整命令块预置于 scripts/ 与学员手册模板，此处列骨架）

| 步 | 目标 | ✅验证 | 🛠失败 |
|---|---|---|---|
| R | runner-probe → runner-profile.json；**credential-probe（模型端点凭据健康探针：用当前 key 发 1 次最小真实请求，401/超时即停线）** | profile + probe 日志双 PASS | ERR-RUN-001 / ERR-ENV-005 |
| S0 | 前置自检（node≥24.19 LTS/npm≥9/pnpm≥10/git≥2.40）**+ 凭据健康探针（credential-probe 强制项：S0 不做凭据探针=2.0 GT 中盘 401 停线根因）** | 五项全绿 + probe exit 0 | ERR-ENV-001 / ERR-ENV-005 |
| S1 | 工具链补装（优先 offline/node/ 离线安装包；无网不阻塞） | tools-versions.txt 五项锁定 | ERR-ENV-002/003 |
| S2 | 安装 DSH 底座（预置 tarball，断网可装） | 版本 ≥0.1.2；127.0.0.1:3080 可达 | ERR-DSH-001/002/004 |
| S3 | 桥接 + P0 插件（offline/ 逐包 + 独立性验证） | 每包禁用→不影响→启用→恢复 | ERR-PLG-001/003 |
| S4 | 工作区 16 子目录 + 13 模块 + Type-Dict | 目录树 diff 一致 | ERR-ENV-004 |
| S5 | P1/P2 选装（含 dsh-web 源码构建尝试） | 启用包有验证记录；未启用入 disabled-packages.md | ERR-PLG-005 |
| S6 | 十要素冒烟（假审批=FAIL 口径） | 十要素矩阵 10/10 PASS | ERR-AGT-002 |
| S7 | 12 域 Scene 装载 + 每域 1 个最小 GT | 每域 reports/domains/<code>-smoke.md | ERR-SCN-001 |
| S8 | 升级与回退演练（锁版本→升级→回归→回退） | 回退后 GT 恢复 PASS | ERR-INST-003 |
| S9 | 桌面安装包构建（§10：.exe/.dmg；壳达标则内嵌） | 双平台安装包产出且安装通过 | ERR-INST-001/002 |
| S10 | 交付打包（三清单+SHA256+gap+矩阵+学员件+CR 记录集） | tag v5.0-universal-workbench-release 或哈希链终行 | — |

### 6.1 分步命令块（唯一权威源；PS7｜PS5｜bash 三栏，预置于学员手册模板）

**R 探测自检（10 min）**
```
bash:     bash scripts/runner-probe.sh && cat runner-profile.json
PS7/PS5:  powershell -File scripts/runner-probe.ps1; Get-Content runner-profile.json
✅ profile 存在且 JSON 可解析（未知 runner 走通用模式，不阻断）
🛠 ERR-RUN-001
```

**S0 前置自检（10 min）**
```
PS7/PS5:  node -v; npm -v; pnpm -v; git --version; curl.exe --version | Select-Object -First 1
bash:     node -v && npm -v && pnpm -v && git --version && curl --version | head -1
✅ node ≥ 22.19 / npm ≥ 9 / pnpm ≥ 10 / git ≥ 2.40
🛠 ERR-ENV-001
```

**S1 工具链补装（30 min，优先离线包）**
```
PS7/PS5:  若缺 Node：msiexec /i offline\node\node-v24.21.0-x64.msi /qn（以 offline\node\SHASUMS256.txt 解析到的实际文件名为准）；npm i -g pnpm@10
bash:     若缺 Node：sudo installer -pkg offline/node/node-v22-mac.pkg -target /；npm i -g pnpm@10
✅ S0 复检全绿 → tools-versions.txt 五项锁定
🛠 ERR-ENV-002 / ERR-NPM-003
```

**S2 安装 DSH 底座（25 min，断网可装）**
```
PS7/PS5:  npx -y --package @deepseek-ai/dsh@<resolved_version> dsh --version
          npx -y --package @deepseek-ai/dsh@<resolved_version> dsh web    # 仅 127.0.0.1:3080
bash:     同上
✅ 版本 ≥0.1.2（低于立即停→ERR-DSH-004）；127.0.0.1:3080 出现控制台
🛠 ERR-DSH-001 / ERR-DSH-002 / ERR-DSH-004
```

**S3 桥接 + P0 插件（35 min）**
```
PS7/PS5:  dsh plugin --profile web add <offline/npm/pi2dsh-*.tgz>   # 装后必须重启
          其余 P0 按 manifest rank 逐包 add
bash:     同上
✅ 每包独立性验证：禁用→不影响→启用→恢复
🛠 ERR-PLG-001 / ERR-PLG-003
```

**S4 工作区初始化（30 min）**
```
PS7/PS5:  Copy-Item -Recurse templates\workspace\* ~/workbench/
bash:     cp -R templates/workspace/. ~/workbench/
✅ 16 子目录 + 13 模块目录与规格 diff 一致；Type-Dict 覆盖 12 域字段
🛠 ERR-ENV-004
```

**S5 P1/P2 选装（30 min）**
```
PS7/PS5:  按 tier=P1 装观测/用量包；dsh-web：cd offline\github\dsh-web; npm install; npm run build
bash:     同构
✅ 启用包有独立验证记录；dsh-web 构建失败→登记 gap，禁止阻断（D1 保底不受影响）
🛠 ERR-PLG-005 / ERR-INST-004
```

**S6 十要素冒烟（40 min）**
```
PS7/PS5:  powershell -File scripts\workbench.ps1 -Cmd verify
bash:     bash scripts/workbench.sh verify
✅ 十要素矩阵 10/10 PASS；审批测试走真实路径：未确认必须停在 APPROVAL_REQUIRED（假审批=FAIL）
🛠 ERR-AGT-002
```

**S7 12 域场景装载（60 min）**
```
PS7/PS5:  foreach($s in Get-ChildItem manifests\scenes\*.yaml){ 装载 $s; 跑该域最小 GT }
bash:     for s in manifests/scenes/*.yaml; do 装载 "$s" && 跑该域最小 GT; done
✅ 每域 reports/domains/<code>-smoke.md；首批评 6 域
🛠 ERR-SCN-001
```

**S8 升级与回退演练（40 min）**
```
bash:     记录 tools-versions.txt → 模拟升级 1 个 P1 包 → 回归该域 GT → bash rollback.sh → 复测
PS7/PS5:  同构（rollback.ps1）
✅ 回退后 GT 恢复 PASS；演练记录入 audit
🛠 ERR-INST-003
```

**S9 桌面安装包构建（60 min）**
```
PS7/PS5:  iscc scripts\installer\win\setup.iss        # 产出 installer-output\setup.exe
bash:     bash scripts/installer/mac/build_dmg.sh     # 产出 installer-output/Workbench.dmg
✅ 双平台安装包存在非空；干净环境安装→双击→工作台可达→F11 自检报告
🛠 ERR-INST-001 / ERR-INST-002
```

**S10 交付打包（20 min）**
```
bash:     bash scripts/workbench.sh report && git tag v5.0-universal-workbench-release
          （无持久 git 的 runner：向 manifests/tag-manifest.csv 追加终行哈希）
✅ 三清单+SHA256+gap+十要素矩阵+学员件+CR 记录集齐全
🛠 ERR-RUN-002
```

---

## §7 故障排查体系（组件④，错误码唯一源 = 本节 + 预置 README 索引）

九域 30 条；**唯一源 = 本节**（README 只放索引链接，禁复制表格——C7）。

> **纪律**：只收录实跑验证过的条目；新错误先在干净环境复现、修复、验证后才允许入表（未验证的写进 capability-gap，不入 FAQ/码表）。

### 7.1 环境域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-ENV-001 | Node < 24.19（pi-vault-mind engines 底线；pi2dsh 最低 22.19） | 离线包 offline/node/ 升级（latest-v24.x=v24.21.0） | `node -v` ≥24.19 |
| ERR-ENV-002 | 哈希命令不存在→Git Bash 无 shasum | workbench.sh 内建三级回退；裸机 `openssl dgst -sha256 <f>` | 哈希输出 64 位 hex |
| ERR-ENV-003 | PS 脚本报上百"语法错误"→PS5.1 ANSI 误读 UTF-8 | `[IO.File]::ReadAllText($p,(New-Object Text.UTF8Encoding($false)))` 后 ParseInput | ParseInput 无报错 |
| ERR-ENV-004 | 工作区目录树与规格不符 | 重放 S4 复制；diff 校验 | 目录树 diff 为空 |

### 7.2 npm 域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-NPM-001 | `npm view <pkg>` E404→包不存在/仅 GitHub 源 | 核对 source_type；dsh-web 走 github-source 构建；其余登记 gap | gap 已登记且流水线继续 |
| ERR-NPM-002 | 公司代理自签证书→TLS 失败 | `npm config --userconfig .npmrc set cafile <pem>` 或 `NODE_EXTRA_CA_CERTS` | `npm ping` 成功 |
| ERR-NPM-003 | 全局安装 EACCES→权限 | Windows：管理员 PS 或改 prefix；mac：改 prefix 不用 sudo | `npm i -g pnpm@10` 成功 |
| ERR-NPM-004 | 拉包超时→镜像 | `workbench fetch -Mirror npmmirror`（--userconfig 隔离） | fetch 日志 200 |

### 7.3 DSH 域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-DSH-001 | 安装器启动失败→旧版 Windows 缺陷 | 升级 ≥0.1.7-rc.2（官方该版修复 Windows installer） | `dsh --version` |
| ERR-DSH-002 | 3080 端口占用 | PS：`Get-NetTCPConnection -LocalPort 3080`；bash：`lsof -i :3080` | `curl.exe http://127.0.0.1:3080` 200 |
| ERR-DSH-003 | 插件装了没出现→未重启 | 重启 dsh 后硬刷新（Ctrl+Shift+R） | 插件面板出现 |
| ERR-DSH-004 | 版本 <0.1.2→CVE-2026-82533（CVSS 9.4 沙箱逃逸，影响 ≤0.1.1-rc.2） | **立即停**，升级 ≥0.1.2；永远禁止 3080 暴露 0.0.0.0/局域网隧道 | 版本断言脚本 PASS |

### 7.4 pi 域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-PI-001 | Windows 找不到 bash/路径错乱→pi 需 Git Bash | 装 Git for Windows；确认 bash 在 PATH；勿用 WSL UNC 启动 | `pi --version` |
| ERR-PI-002 | 模型连不上→models.json 无 provider | 配 `~/.pi/agent/models.json`（OpenAI 兼容端点） | 一次最小对话成功 |
| ERR-PI-003 | npm scope 报错→旧包名 | 统一 `@earendil-works/pi-coding-agent`（legacy 已迁移） | `npm ls -g` 显示新 scope |

### 7.5 插件域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-PLG-001 | sidebar 白屏→构建脚本被拦 | `pnpm approve-builds` 后重装；硬刷新 | 文件树可展开 |
| ERR-PLG-002 | excel-panel 打不开→用 CSV 冒充 xlsx | 换真实结构脱敏 xlsx | 单元格可见公式结果 |
| ERR-PLG-003 | 插件互相干扰→独立性破坏 | workbench repair -Package；逐包禁用二分定位 | 禁用矩阵记录完整 |
| ERR-PLG-004 | 审批"提示了但照样执行"→假审批 | 修 approval-guardian 配置；未确认必须停在 APPROVAL_REQUIRED | 日志状态机断言 |
| ERR-PLG-005 | 选装包互相冲突 | 降级为 disabled-packages.md 并登记 gap | 核心冒烟不受影响 |

### 7.6 Python/venv 域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-PY-001 | 依赖装不上/行为异常→Python 3.13 | 锁 3.11/3.12：`py -3.12 -m venv .venv` / `python3.12 -m venv .venv` | `.venv/bin/python -V` |
| ERR-PY-002 | UnicodeDecodeError→cp936 默认编码 | `PYTHONUTF8=1`；文件读写显式 encoding="utf-8" | 脚本复跑通过 |

### 7.7 Agent 行为域

| 码 | 症状→根因 | 命令与修复 | 验证 |
|---|---|---|---|
| ERR-AGT-001 | Agent 编造包名→幻觉 | 强制跑 `python scripts/verify-npm-packages.py`；命中即 V6 停线整改 | 核验脚本退出码 0 |
| ERR-AGT-002 | 跳过门禁/谎报 PASS→纪律失效 | 比对 git tag 链（或哈希链）与证据文件；缺失即 V1 | 取证链完整 |
| ERR-AGT-003 | 敏感数据外发→越权 | 检查 redact_gate 命中日志；违规即 V7 停线 | 脱敏日志含 REDACTED |

### 7.8 Runner 域

| 码 | 症状→根因 | 处置 | 验证 |
|---|---|---|---|
| ERR-RUN-001 | runner-profile.json 缺失/不可解析 | 重跑 runner-probe；仍失败→unknown 模式 + 能力缺失如实登记 | profile JSON parse PASS |
| ERR-RUN-002 | Runner 无持久 git | 切哈希链取证（§4.3 tag-manifest.csv） | 哈希链首行+追加行完整 |
| ERR-RUN-003 | Runner 自治循环中断（长任务被宿主打断） | 断点续跑：读 reports/workbench-report.md 的 U 进度行，从最后通过门禁+1 继续 | 进度行与证据一致 |

### 7.9 安装器域

| 码 | 症状→根因 | 处置 | 验证 |
|---|---|---|---|
| ERR-INST-001 | .exe/.dmg 构建失败（Inno Setup / hdiutil 缺失） | PS：确认 Inno Setup ISCC.exe 路径；mac：`xcode-select --install` | 安装包文件存在且非空 |
| ERR-INST-002 | 安装后双击启动失败→Node/依赖路径错 | 安装器日志定位；workbench repair；必要时降级浏览器模式 | 桌面图标→工作台可达 |
| ERR-INST-003 | 回退后版本漂移→tools-versions.txt 未还原 | 重放 S8 回退；校验五项版本 | 版本断言 PASS |
| ERR-INST-004 | dsh-web 壳构建失败 | **允许降级 D1**（登记 gap，不阻断 U14——D1 保底已达标） | 形态判定记录 |

---

## §8 12 业务域场景与工作流（组件⑤，自制层预置）

### 8.1 Scene Schema（manifests/scenes/<domain>.yaml，预置基线，唯一权威源）

```yaml
apiVersion: workbench.pi-dsh/v1
scene_id: comp.salary-review@1.0.0        # {domain}.{scene}@{semver}
domain: COMP                              # §2.2 代号
industry_overlay: null                    # 可选：manufacturing/healthcare/finance/retail/gov/education/internet
required_capabilities:                    # 只声明能力，不写包名（§3.4 Registry 负责映射）
  - cap.excel.panel
  - cap.approval.multi
  - cap.redact.all
data_assets:                              # 合成脱敏数据，每表 ≥10 行
  - name: salary_master.xlsx
    level: L4
    pii_fields: [employee_id, name_masked, band]
skills: [salary-band-analysis, payroll-reconciliation, compa-ratio-report]
workflows: [workflows/comp.salary-adjust.yaml]
policies:
  permission:
    min_level: L4                         # 单调性：只能 ≥ Chassis 默认（C4）
    dual_approval: true
  redact:
    fields: [salary, bank_account, id_number]
    gate: redact_gate                     # 物理闸门：个体薪酬数据不得越过闸门流向公网/外部工具
  memory:
    pii_allowed: false                    # C4 方向锁
    exclude: []                           # EAP 域此处填 [graph-memory, pi-hermes-memory]
knowledge_seeds: [seeds/comp/comp-policy-sanitized.md]
golden_tasks:                             # 八元组，分批投放见 §8.5
  - id: GT-COMP-01
    input: "分析本季度调薪提案与薪酬带宽的偏离度，生成报告"
    expected_plan: "读带宽表→读提案→计算偏离→生成报告"
    expected_tools: [cap.excel.panel, cap.approval.multi]
    expected_permission: "L4+双审批（触发生效动作时）"
    expected_output: reports/comp/band-deviation.xlsx
    expected_files: [data/comp/salary_master.xlsx]
    expected_audit: "读/算/写三段审计事件 + 双审批记录"
    expected_quality: "结论可追溯到 sheet/row 级证据"
```

### 8.2 Workflow Schema（manifests/workflows/*.yaml，预置基线，唯一权威源）

```yaml
apiVersion: workbench.pi-dsh/v1
workflow_id: comp.salary-adjust@1.0.0
trigger: { type: command | schedule | event, expr: "调薪 <employee> to <band>" }
nodes:
  - id: n1; type: skill; ref: compa-ratio-report
  - id: n2; type: condition; expr: "delta_band != none"
  - id: n3; type: approval; level: L4; dual: true      # condition 的 then 分支禁止绕过审批直连外部写能力
  - id: n4; type: tool; ref: cap.excel.panel.write
  - id: n5; type: audit; record: "调薪生效 + 审批人 + 依据版本"
check: { expected: "生效名单与审批单一致", actual_ref: audit/n5, on_fail: rollback }
hitl_nodes: [n3]                                        # 必填
rollback: { method: savepoint, tag: pre-salary-adjust } # 必填
```

### 8.3 12 业务域规格矩阵（自制层预置，Agent 不得删域）

| 域 | 数据资产（敏感级） | 技能 | 工作流（审批落点加粗） | 特殊约束 |
|---|---|---|---|---|
| STRAT | OKR/经营周报 L2；合并薪酬盘点 L4 | 战略解码、经营分析、竞品监测 | 季度战略复盘（**合并薪酬双审批**）、经营周报 | 竞品检索走脱敏摘要 |
| MKT-ON | 线索 PII L3；投放报表 L2 | 内容生成、投放分析、SEO 诊断 | 内容发布（**L4 强审批+脱敏**）、投放周报 | 线索禁入公网搜索 |
| MKT-OFF | 经销商条款 L3；活动台账 L2 | 活动策划、物料合规、ROI 复盘 | ROI 复盘、物料合规审查 | 外发走审批 |
| SALES | 客户合同 L3；业绩 L2 | 报价测算、赢单复盘、业绩看板 | 报价审批（**DAG+折扣阈值**）、赢单复盘 | CRM 走扩展位 |
| FIN | 银行账户 L4；凭证 L3 | 报销预审、预算分析、发票校验 | 报销审批（**强审批**）、月度财报（分级） | 财报数字 A 级可溯 |
| REC | 候选人 PII L3 | 漏斗分析、JD 生成、面试纪要 | 漏斗周报、**简历外发强制脱敏** | 虚构数据模板继承 |
| TRN | 证书资质 L3 | 课程排期、学时统计、到期提醒 | 培训计划审批、**资质到期拦截** | 行业化：特种作业证等 |
| PRF | 考核结果 L4 | KPI 追踪、校准分析、目标分解 | 绩效校准（**双审批**）、目标分解 | 校准纪要禁入记忆层 |
| COMP | 全域 L4 | 带宽分析、payroll 对账、CR 报告 | **调薪审批（双审批+redact_gate）** | 个体薪酬只出区间 |
| BEN | 健康数据 L4 | 方案比选、体检脱敏、弹性测算 | 方案比选（**DAG**）、体检报告（脱敏） | 健康数据禁入记忆层 |
| ADMIN | 用印/采购 L3 | 采购比价、资产台账、会议纪要 | 采购审批（**DAG+预算校验**）、**用印强制人工** | 用印禁自动放行 |
| CMP | 审计底稿 L4 | 制度审查、PIPIA、证据打包 | 制度 checklist、**证据打包（append-only 对齐）** | Requirement→Release 链 |
| ER/EAP | 处分/离职 L4；**EAP L4+** | ER：面谈纪要、争议流程；EAP：匿名转介 | ER：离职流程（**多级审批**）；EAP：转介（**双审批+匿名化**） | §8.4 |

### 8.4 EAP 特例（最高敏 L4+）

禁联网（网络策略 deny）｜禁入记忆层（graph-memory/pi-hermes-memory 排除名单写入 policies.memory.exclude）｜双审批+匿名化（输出仅匿名编号）｜独立命名空间（workspace/eap/，卸载可逆 C5）｜访问全量留痕（append-only）。

### 8.5 Golden Task 规则

八元组必填；首批 6 域 ×5、二批 6 域 ×5；单批验收线（U10）：**≥25 GT PASS 覆盖 ≥6 域且每域 ≥3**；域 0 分标 `NOT_IMPLEMENTED` 不得瞒报；禁止"30×100%"不可达线与凑数（V1）。

---

## §9 预置文档规格（自制层，Q4 决策：基线版预置 + Agent 定制化 + CR 门禁）

### 9.1 PRD-桌面应用-基线.md（预置，Agent 按 runner-profile 与 D1/D2 形态定制）

**产品定位**：给业务人员（HR/财务/销售/行政等非工程角色）的单机全能 Agent 工作台桌面应用；离线可装、双击可用、审批与脱敏内建。

**用户**：学员/业务人员（主）；讲师（辅助）；维护者（工程 README）。

**功能清单 F1-F13（基线）**：

| # | 功能 | 验收映射 |
|---|---|---|
| F1 | 双击启动（安装器/快捷方式，离线安装） | U14 |
| F2 | 任务中心首页（进行中/待审批/待输入/最近完成/失败） | **U15（UI 走查）** + U5 |
| F3 | 12 业务域入口与场景装载（UI 可选/可应用/可保存/可切换） | **U15 + U16** + U10 |
| F4 | 审批中心（未确认必须停在 APPROVAL_REQUIRED；假审批=0） | **U15** + U5/U6 |
| F5 | 脱敏与审计查看器（redact 日志 + trajectory 回放，append-only） | **U15** + U6 |
| F6 | 记忆与知识面板（排除名单可视化，EAP 灰显） | **U15** + U7 |
| F7 | 离线模式（断网可用 + 公网禁用指示） | U1/U12 |
| F8 | 升级与回退（tools-versions 锁定、一键回退） | U11(S8) |
| F9 | Runner 适配状态页（runner-profile 展示） | U13 |
| F10 | GT 冒烟入口（一键跑域冒烟，UI 内触发） | **U15** + U10 |
| F11 | 安装自检报告（安装后自动产出） | U14 |
| F12 | EAP 隔离命名空间入口（L4+ 提示横幅） | **U15** + U7 |
| F13 | 主控编排（Chief of Staff 跨域任务拆解/分发/汇总，cockpit-orchestrator 遗产升级） | **U15** + U10 |
| F14 | preset 运行时装载器（v2.1 新增：Scene 选择→应用→运行→保存→切换→持久化，运行时消费方 ≥1 且 UI 绑定；**禁止以 lint/文件存在性冒充装载**） | **U15 + U16** |

**非目标（基线明示）**：不做多人协同写冲突（Collaboration Layer 列入 backlog）；不做移动端；首批不做行业 Overlay（P1-4 节奏）。

### 9.2 preset 设计文档（docs/preset-design/，12 份预置）

每域一份 = §8.3 矩阵行完整化：数据字典（Type-Dict 摘要）、技能规格（每个 SKILL.md 的输入/输出/权限/质量检查）、工作流时序说明、权限矩阵、GT 清单。Agent 定制时**只许加细化、不许删域**（§8.3）。

### 9.3 CR-checklist.md（五类，预置）

| 类 | 检查项要点 |
|---|---|
| 下载/脚本 | 退出码判定（无 try/catch 判 native）；哈希非空；host 校验；重试与 gap 登记；幂等 |
| 安装/配置 | 版本断言（DSH≥0.1.2）；仅 127.0.0.1；三路分流正确；独立性验证记录 |
| 权限/安全 | Permission Gateway 全覆盖；安全单调性方向；redact_gate 命中日志；EAP 排除名单；无明文密钥 |
| 工作流/场景 | Schema lint 0 违例；hitl/audit 节点必备；condition 不绕审批；GT 八元组齐全 |
| 文档 | 单一引用源（C7）；清单不复制（C8）；无出处数据（V8）；章节号一致（D16）；与实物一致 |

**CR 门禁规则**：每个 U 门禁的每个产出物附 `reports/cr-<artifact>.md`（按上表逐项勾选 + 发现的问题 + 修复记录）；缺 CR 记录的门禁不视为通过（U8 汇总校验 CR 覆盖率 100%）。

### 9.4 双 README（预置骨架，Agent 定制环境差异）

- **README-学员版.md**：五分钟安装（双击安装包）→ 首次启动自检 → 跑第一个 GT → 三件套作业指引 → ERR 码速查索引（链接 §7，不复制）。
- **README-维护者版.md**：bundle 目录树 → 升级/回退流程（S8）→ CR 流程 → gap 登记 → 已知边界（§13）。

---

## §10 桌面应用交付（Q3 决策：安装器保底 D1 + 壳升级 D2）

### 10.1 D1 安装器保底（必交付）

- **Windows**：`scripts/installer/win/setup.iss`（Inno Setup 基线，预置）——安装行为：①校验 offline/ SHA256；②缺 Node 则装 offline/node/*.msi；③解压工作区与 templates；④本地安装 DSH/pi/P0 插件（无网可完成）；⑤创建桌面快捷方式（launcher：调起 DSH web 仅 127.0.0.1 + 打开工作台窗口）；⑥首启自检（runner-probe + 十要素冒烟引导）→ 产出 F11 自检报告。
- **macOS**：`scripts/installer/mac/build_dmg.sh`（基线，预置）——同构行为，产出 Workbench.dmg。
- 基线骨架（Agent 按 U14 实构建后固化）：

```ini
; setup.iss 关键段（基线）
[Setup]
AppName=Universal Workbench
DefaultDirName={autopf}\UniversalWorkbench
[Files]
Source: "offline\*"; DestDir: "{app}\offline"; CheckSums; Flags: recursesubdirs
Source: "scripts\*"; DestDir: "{app}\scripts"
[Icons]
Name: "{commondesktop}\Universal Workbench"; Filename: "{app}\scripts\launch.ps1"
[Run]
Filename: "powershell"; Parameters: "-File ""{app}\scripts\workbench.ps1"" -Cmd verify"; Description: "首启自检"
```

### 10.2 D2 壳升级（条件交付）

- 尝试 `offline/github/dsh-web/` 本地构建（P2/github-source 口径）+ 25 项 UI 预测试（007 SOP-06 口径）。
- **机械裁定（U14）**：构建成功且测试 ≥12 绿且 3 项前后端连通 → 交付 D2 内嵌壳（webview/托盘/通知列为 P1 增强，不达标项如实登记）；任一不满足 → **自动交付 D1**，gap 登记"壳未达标"，**禁止虚报形态**。

### 10.3 降级与升级链

```
D1 保底（安装器+浏览器/launcher） ──U14 达标──▶ D2 内嵌壳
        ▲ 不达标自动回 D1，gap 登记，不影响其他 U 门禁
```

---

## §11 FAQ / 评分口径 / 作业要求（组件⑥）

### 11.1 FAQ（唯一源；只收录实跑验证条目）

### 11.1 FAQ（唯一源；只收录实跑验证条目，新条目须附复现命令）

| # | 问题 | 处置 |
|---|---|---|
| 1 | `Ignored build scripts` 警告 | `pnpm approve-builds` 后重装（002 §9 实录） |
| 2 | npm 拒装"发布不足最短期限"版本 | `--prefer-offline` 或等待/降级次新版本（minimum release age） |
| 3 | node-pty 相关安装失败 | 确认 Node 版本与构建工具链（ERR-ENV-001） |
| 4 | PS 里 curl 行为不对 | 写 `curl.exe`（IWR 别名陷阱） |
| 5 | 双侧边栏同时出现 | 只保留 better-sidebar 一处注册，卸载重复 UI 插件 |
| 6 | Pi 在 Windows 打不开/路径乱 | Git Bash 路线（ERR-PI-001），不用 WSL UNC |
| 7 | dsh 插件 npm 包名与仓库名不一致 | 以 manifest npm_name 为准，repo_hint 仅溯源 |
| 8 | 下载量/星数等数据要引用 | 只允许附来源链接或"内部实测+复现命令"，否则 V8 |
| 9 | 找不到某能力的包 | 开扩展位 + 登记 capability-gap，走自建 MCP/人工导出 |
| 10 | 定时任务怎么落地 | 首批用 DSH scheduling/loop-mode 显式配置并实测；未实测的验收项一律不许写"无人值守"（D08 闭合） |
| 11 | EAP 数据能进记忆插件吗 | 不能（§8.4 排除名单强制） |
| 12 | 行业 Overlay 什么时候做 | 首批 0 个；12 域跑通后只扩 1 个行业试点 |
| 13 | 我的 Runner 不在矩阵已验证行里怎么办 | runner-probe 如实登记 → 通用模式 + 能力缺失项上报；不得谎称支持（D22） |
| 14 | 安装包在客户内网怎么装 | 全程离线（预置层），ERR-INST-002 排查路径 |
| 15 | 壳（D2）要不要死磕 | 不要——U14 机械裁定，D1 已是合格桌面交付 |

### 11.2 评分口径（98 分操作化）

**五维百分制**：可行性 20 + 实操性 20 + 材料充分性 15 + 材料必要性 15 + 交付质量预判 30 = 100。
**缺陷清零表（22 类，§11.3）**：98 分 = 五维自评 ≥98 且 22 类全部闭合且无一票否决且 **CR 覆盖率 100%**。自评每行引用证据文件路径，无证据按 0 分。

### 11.3 缺陷清零表（22 类 = 37 份语料审查全部 P0/P1 发现 + v2 新增 2 类）

| # | 缺陷类（出处） | 闭合机制 | 归属门禁 |
|---|---|---|---|
| D01 | 计数矛盾"9 个原语实列 8 个"（008/007） | 脚本生成后自动清点并输出数量；文档计数由脚本产出 | U3 |
| D02 | 幽灵依赖（employees.csv 未创建即引用，005/006/007） | 每个测试步的输入文件由前置步显式产出 + U11 双平台实跑 | U11 |
| D03 | try/catch 判 native 命令恒成功（trae/minimax/grok 等 5 份） | §5.2 硬规则 + §5.4 参考实现示范 | U2 |
| D04 | shasum 无回退/空哈希假成功（008-010-01、workbuddy sh） | 三级回退 + 空哈希=失败 | U1 |
| D05 | dsh-web 错置 P0（010-01/02、trae、minimax、doubao 等） | P2/github-source/构建兜底/三条禁止 | U1/U12 |
| D06 | 评分线漂移（80/85/90 四口径） | 全文档集唯一 ≥85 交付线；98 为文档质量目标 | U8 |
| D07 | GT"30×100%"不可达门槛（trae final） | §8.5 分批 + ≥25/≥6 域线 | U10 |
| D08 | 幽灵验收："定时无人值守"无落地命令（30 天计划 W4） | S8 演练实测记录为唯一依据；未实测不许写 | U11 |
| D09 | sh 脚本 resolved CSV 未回写（fetch-packages.sh） | §5.4 bash 参考实现已修 + U1 断言文件非空 | U1 |
| D10 | CRLF 未清洗致 bash 判定失效 | `tr -d '\r'` 入脚本 | U2 |
| D11 | 死代码（`do :; done`，007 SOP-07） | U11 逐行实跑覆盖 | U11 |
| D12 | 虚构包名进清单/脚本（minimax 21/22） | §3.6 纪律 + verify 脚本 + V5/V6 | U1 |
| D13 | 引用无出处数据（96/97 分、7639★、5250 仓） | V8 一票否决 + FAQ#8 | 全程 |
| D14 | 双活源/60% 重复（提示词×4、速查×4、故障表×4） | C7 单一引用源 + 链接引用 | U8 |
| D15 | 新增必修 240min 未入课表（007 v2.0） | §6.0 总耗时预算前置 | U11 |
| D16 | 章节号断裂（007 目录/正文不一致；qwenwork-merged 空节） | 交付前自动校验目录-正文编号一致 | U8 |
| D17 | 文档表格与 CSV 分裂（workbuddy P0=18 vs CSV P0=17） | C8 清单唯一真源，文档禁复制表格 | U1 |
| D18 | 下载无 host/协议校验 | §5.4 白名单+私网拒绝 | U2 |
| D19 | md/html 双格式维护负担（011-architecture） | 仅 Markdown | — |
| D20 | 必装/可选口径漂移（pi-mcp-adapter 在 002 必装、006 可选） | 唯一口径表=manifest tier 列；文档引用不改写 | U1 |
| D21 | Runner 专属指令硬编码进主文档 | §4.1 探测自检 + 意图级写法 + 矩阵唯一源 | U13 |
| D22 | 承诺未实测的 Runner/形态能力 | 矩阵未核验行标 UNVERIFIED；D1/D2 由 U14 机械裁定 | U13/U14 |

| # | 缺陷类 | 闭合机制 | 归属 |
|---|---|---|---|
| D21 | Runner 专属指令硬编码进主文档 | §4.1 探测自检 + 意图级写法 + 矩阵唯一源 | U13 |
| D22 | 承诺未实测的 Runner/形态能力 | 矩阵未核验行标 UNVERIFIED；D1/D2 由 U14 机械裁定 | U13/U14 |

### 11.4 作业要求

**Agent 侧**：U1-U14 门禁即作业，每道"通过标志 + 证据 + cr-<artifact>.md"。
**学员件侧**：四作业继承 v1（建模装 Scene 跑 GT / 交接文档 / 脱敏审批遮罩三验证 / 30 天计划——无人值守类验收必须引用 S8 实测记录）+ **作业 5（新增）**：用安装包在第二台机器完成离线安装并提交 F11 自检报告。

---

## §12 门禁 U1-U19 与停止条件

| 门禁 | 通过标志（机械可判定） | 证据文件 |
|---|---|---|
| U1 资源包预置完整性 | offline/ 全部 SHA256 校验通过（**断网环境**复验零依赖）；manifest 55 行与包内文件一一对应 | offline/*/SHA256SUMS.txt、reports/u1-bundle-audit.md |
| U2 脚本合规 | workbench + runner-probe 双平台实跑；§5.2 硬规则 grep 自检 0 违例 | reports/u2-script-compliance.md |
| U3 安装与独立性（v2.2 增探测规范） | **P0+P1+catalog 全量逐包四级 DoD**：安装退出码 0 → 运行时装载行 → 1 次功能调用（UI 类包=界面入口打开并截图）→ 独立性禁用/启用；不兼容包登记 disabled-packages.md + 缺陷台账（1.0 已知四缺陷必修或登记）。**安装探测三源规范：`npm prefix -g` + `npm ls -g --depth=0 --json` 解析 + dsh profile package.json 依赖检查；禁止单一 `npm root -g` 判定（managed-node 环境路径错位，2.0 实测 1/24 结论不可信）** | reports/install-log.csv、reports/pkg-func-smoke.md、三源探测日志 |
| U4 指令集实跑 | §6 R+S0-S10 三栏命令双平台逐条打勾 | reports/student-handbook-evidence.md |
| U5 十要素 | 矩阵 10/10 PASS；假审批=0 | reports/ten-elements-matrix.md |
| U6 安全 | CVE 断言 PASS；redact_gate 命中日志；3080 仅 127.0.0.1；**第三方包安全三件套：全量 npm audit/OSV 扫描（0 高危或豁免留痕）、provenance/维护者核验、top20 下载量包代码级抽查**；**新鲜度规则（v2.2）：扫描必须在交付窗口内于项目环境重跑（scanned_at ≤ 交付日），bundle 制备期的扫描结论只可引用不可转贴** | reports/security-check.md、reports/security-scan/（scanned_at=交付窗口内） |
| U7 记忆与知识 | 跨会话偏好 + 召回测试 + EAP 排除名单生效 | reports/memory-knowledge.md |
| U8 文档质量 | 缺陷清零 22 类闭合；自评 ≥98 附证据路径；章节号校验通过；**CR 覆盖率 100%** | reports/workbench-report.md |
| U9 交付打包 | 离线包三清单 + tag v5.0-…-release 或哈希链终行 | offline/ + 取证记录 || U10 场景与工作流（v2.2 增技能一致性断言） | 首批 ≥25 GT PASS 覆盖 ≥6 域（每域 ≥3）；Schema lint 0 违例；**每个 GT 的实际执行技能必须与 scene 声明技能逐一比对（防 2.0 EAP 技能错配：er/eap 同名 dispute-ops 漏网）；EAP 域 GT 必须跑 eap-referral（禁用 ER 技能顶替）**；产物非空且结构有效时 FAIL 须人工复核后落账 | reports/domains/*.md、gt 技能一致性比对表 |
| U11 学员件实测 | 组件③④每条指令双平台逐条打勾 + 作业 5 第二机安装 | reports/student-handbook-evidence.md |
| U12 防断供演练 | 2 个 P0 包模拟损坏 → gap 降级 → 核心不受影响 | reports/supply-outage-drill.md |
| U13 Runner 兼容 | runner-profile.json 产出；**至少 2 个 runner（dsh + 1 非 dsh）全链实跑**；其余 8 行按实测状态标 VERIFIED/UNVERIFIED，不虚报 | reports/runner-matrix-results.md |
| U14 桌面安装器 | 双平台安装包产出且干净环境安装→双击→**UI 内真实用户旅程**（选 preset→发任务→收产物→截图）→F11 自检报告；D1/D2 按 §10.2 机械裁定；**workspace 原生门控必须配置化预置绕过（DSH_HOME/profile 预置工作区），阻塞超 2h 触发停线上报——禁止转 headless 冒充 UI 验证** | installer-output/、reports/desktop-acceptance.md、**reports/ui-walkthrough/*.png（≥13 张）** |
| U15 UI 交付与用户旅程（v2.2 落机械判据） | **机械 DoD（全部满足才 PASS）**：①PRD F2-F14 每项真实界面内操作+png 截图；②**13 域工作台两两差异化**——每域 ≥3 个独有业务元素（如 sales=CRM 管道看板、fin=报销单表单、rec=面试安排表、strat/prf=OKR 目标填写、trn=课程目录、admin=采购比价表、cmp=合规 checklist、comp=带宽偏离图、ben=方案比选矩阵、mkt=内容日历/活动 ROI、er-eap=离职流程+EAP 转介表单），逐域对照 `manifests/domain-ui-checklist.csv` 打勾，**同构模板页（≥10 域共享同一 DOM 结构且无独有元素）=FAIL**；③**F7/F8/F11 三页存在且可操作**（离线指示/回退演练入口/自检报告页）；④**交互级四操作**：选/用/存/切每项产生 ≥1 条对应审计事件（preset.save、preset.switch ≠ 0）+ 状态变更前后截图 + 持久化产物（saved-*.json）；⑤preset **可新建/编辑**（基于 Scene 模板派生用户 preset 并持久化） | reports/ui-walkthrough/*.png + ui-walkthrough.md、审计事件统计、domain-ui-checklist.csv、workspace/presets/ 产物 |
| U16 catalog 安装与逐包可用（**v2.2 升级为交付阻断门禁 BLOCKING**） | 155 catalog 包三批安装（web 插件→pi 扩展→工具类），逐包四级 DoD 同 U3；不兼容登记 disabled-packages.md；**"装载行≠可用"，功能调用为必选证据**。**BLOCKING：U16 状态非 PASS 时禁止任何交付宣告（复盘 2.0：NOT_RUN 与交付宣告并存=根因）**。安装探测规范：以 `npm prefix -g` + `npm ls -g --depth=0 --json` + dsh profile package.json 三源交叉判定，**禁止单一 `npm root -g` 判定**（2.0 探测路径错位教训） | reports/catalog-install-log.csv、reports/pkg-func-smoke.md、probe 三源日志 |
| U17 质量对标（v2.1 新增） | 固定基准任务集 10 条（每域抽 1 + 文档交付 2 + 编排 1），同一数据由工作台与 ≥3 个可核验基准 agent（@openai/codex、pi 0.87.1、dsh 0.1.5-rc.3）分别执行；五维 rubric（正确性/可用性/产物质量/审批脱敏行为/成本）各 0-5；工作台均分 ≥ 基准均分或差 ≤0.5 且无单项 0 分=PASS；semantica/muzz 不可核验不进对比集（V8） | reports/benchmark-comparison.md + 双方原始产物 |
| U18 整合深度（v2.2 新增，修复"引擎 0 次进业务流"） | **工作流 skill 节点的执行主体必须为 pi/dsh**：GT 执行期内审计 `engine.run` 事件 ≥ GT 数（本地 JS 确定性实现只可作断网降级路径且须在审计中标注 `fallback=offline`）；skill 节点绑定关系（scene 声明 → engine 调用）映射表留档；**`engine.run`=0 即 FAIL（2.0 实测：121 次 workflow.skill 全本地、0 次 engine.run）** | 审计事件统计（engine.run/agent-bridge 调用）、skill→engine 绑定映射表、scripts/engine-skill-runner.mjs 参考实现 |
| U19 交付宣告一致性（v2.2 新增，**交付阻断门禁**） | **阻断规则：U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → 禁止交付宣告，只能输出阶段报告**（2.0 实测 U16 NOT_RUN 与交付宣告并存）；宣告前必须逐项对照证据清单（install-log/审计事件/截图/对标产物），宣告用语与证据逐字一致；**语义升级禁令**：哈希通过=已安装 ｜ frontmatter 读取=技能装载 ｜ 路由存在=操作接通 ｜ 页面渲染=界面交付 ｜ npm audit 空依赖=安全检查 ｜ NOT_RUN 登记=合规交付 ｜ 探测代码存在=探测结果可信 ——以上替换一律 V1 | reports/delivery-announcement-checklist.md（逐项勾选+证据链接） |

### 12.3 停止条件（任一触发即停并输出阶段报告）

1. 同一问题连续 3 次修复失败；2. 行业/业务问卷无法获得真实业务方确认（不得编造，`profile_status: draft` 降级上报）；3. 需真实敏感数据/明文密钥；4. 触发任一票否决；5. 缺口层包名核验失败且无降级方案；6. Agent 缺少必需工具；7. **熔断（v2.1）：连续 3 个任务同形态失败（同一 401/同一崩溃栈/同一超时）→ 立即停止 GT 活动，执行环境诊断（credential-probe + 引擎状态），修复或上报后方可续跑——禁止带病连跑**；
8. **交付阻断（v2.2）：U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → 禁止交付宣告（只能输出阶段报告）；宣告用语与证据逐字一致（U19），语义升级=V1**。

---

## §13 诚实边界

- **Runner**：矩阵中 4 行（minimax/豆包工作/Trae Work/Kimi code）为未公开核验项；U13 只对实测过的 runner 出具结论，交付物**不得宣称"10/10 支持"**，未验证者标 `UNVERIFIED_RUNNER`。
- **桌面形态**：D2 内嵌壳依赖 dsh-web（社区项目，315 个未处理 issue），不达标即 D1；两种形态都是合格交付，禁止虚报。
- **"所有的"**：仅指三层资源边界（§3.1）内的预置完整性；行业连接器等企业侧本无统一现成包，走缺口层。
- **EAP**：自动化仅到"匿名化转介建议"，不替代专业流程。
- **评分**：98 是文档质量目标口径；交付验收线仍为 ≥85；不得混用表述。
- **范围**：首批 6 域 ×5 GT；二批前不得宣称"12 域全部可用"；多人协同/移动端为非目标（PRD 基线）。

---

## §14 v2.1 复盘增补（why-not-met-1.0 八项缺口修复）

> 1.0 执行暴露的方案缺口逐项修复如下；缺口↔修复对账见 `docs/1.0-gapfix-ledger.md`。**旧口径作废**："装载=lint"、"tarball 就位=可用"、"HTTP 可达=工作台交付"三种语义替换一律视为 V1 违规。

### 14.1 U15 UI 交付与用户旅程（修复缺口 1/2/7）

- **交付物**：preset 运行时装载器（F14）+ PRD F2/F3/F4/F5/F6/F10/F12/F13 全部功能的真实界面 + 12 域域工作台界面。界面规格见 `docs/UI-DELIVERY-SPEC.md`（页面/组件/数据态/空态/错误态/权限态清单）。
- **验收**：U15 通过标志=截图证据（≥13 张 png）+ preset 四操作（选/用/存/切）界面留证 + **每功能在 UI 内完成 1 次真实任务**。lint 通过、文件存在、HTTP 可达均不算数。
- **攻关义务**：workspace 原生对话框门控（1.0 阻塞点）必须以配置化预置工作区（DSH_HOME/profile）绕过；阻塞超 2h → §10.3 停线上报，禁止降级 headless 冒充。

### 14.2 U16 catalog 安装与逐包可用（修复缺口 3/4）

- 155 catalog 包三批安装（web 插件类→pi 扩展类→工具类），逐包四级 DoD（安装→装载→功能调用→独立性）；"已安装"的唯一定义=四级全过。
- 1.0 已知四缺陷列入必修台账：edit 工具 headless flatMap 崩溃、sideroom 非交互不可用、dsh-network-settings boot 崩溃（剔除）、dsh-undo-savepoint 无头不可装——修复、降级或登记，三选一不得静默。

### 14.3 U6 安全三件套（修复缺口 5）

全量 `npm audit`/OSV 扫描（高危=0 或豁免留痕）+ provenance/维护者核验 + top20 下载量包代码级抽查，产物 `reports/security-scan/`。

### 14.4 U17 质量对标（修复缺口 6）

同任务集 A/B 协议见 `docs/benchmark-comparison-protocol.md`：基准任务集 10 条、五维 rubric、≥3 个可核验基准 agent（@openai/codex / pi 0.87.1 / dsh 0.1.5-rc.3）；semantica/muzz 不可核验不进对比集；"维度覆盖表"不再作为对标证据。

### 14.5 S0 凭据探针 + 熔断（修复缺口 8）

- R 步新增 `scripts/credential-probe.mjs`：用当前 key 发 1 次最小真实模型请求，非 2xx → 停线（1.0 曾带病连跑 15 个 GT 才发现 401）。
- §10.3 第 7 条熔断：连续 3 个任务同形态失败即停，禁止带病连跑。

### 14.6 语义禁令（通修）

以下替换关系视为 V1：lint 通过=场景装载 ｜ 装载行=插件可用 ｜ tarball 哈希正确=已安装 ｜ HTTP 状态=工作台可达 ｜ md 报告存在=UI 呈现 ｜ 维度覆盖表=质量对标 ｜ 文件计数=能力可用 ｜ frontmatter 读取=技能装载 ｜ 路由存在=操作接通 ｜ 页面渲染=界面交付 ｜ npm audit 空依赖=安全检查 ｜ NOT_RUN 登记=合规交付 ｜ 探测代码存在=探测结果可信 ｜ 本地 JS 执行=引擎整合。每项验收必须以其字面语义的直接证据闭合。

---

## §15 v2.2 复盘增补（why-not-met-2.0 八项缺口修复）

> 2.0 执行（v2.1）暴露的新缺口逐项修复；对账见 `docs/2.0-gapfix-ledger.md`。核心教训：**v2.1 新门禁无机械判据 → 判据被执行者自定自判**——本版所有新门禁均给机械 DoD。

### 15.1 U18 整合深度（修复"引擎 0 次进业务流"）

- 参考实现：`scripts/engine-skill-runner.mjs`——工作流 skill 节点经 pi（`pi --mode json`）/ dsh（`npx @deepseek-ai/dsh exec`）CLI 执行，审计事件记 `engine.run`；断网/引擎不可用时降级本地 JS 且审计标注 `fallback=offline`（降级率 >50% = U18 FAIL）。
- 验收：skill 节点绑定映射表（scene 声明技能 → engine 调用记录）+ `engine.run` 审计计数 ≥ GT 数。

### 15.2 U19 交付宣告一致性（修复"报告诚实≠宣告合格"）

- 宣告前逐项填写 `docs/delivery-announcement-checklist.md`：每句宣告对应证据路径；U3/U10/U15/U16/U17 任一未 PASS → 只能输出阶段报告（阻断规则 §10.3 第 8 条）。
- §14.6 语义禁令扩展至 14 条（新增：文件计数=能力可用、frontmatter 读取=技能装载、路由存在=操作接通、页面渲染=界面交付、npm audit 空依赖=安全检查、NOT_RUN 登记=合规交付、探测代码存在=探测结果可信、本地 JS 执行=引擎整合）。

### 15.3 U15 机械判据（修复"13 张同构截图凑数"）

逐域差异化界面清单见 `manifests/domain-ui-checklist.csv`（13 域 × 独有业务元素 × 交互点 × 证据要求）；F7/F8/F11 三页规格并入 UI-DELIVERY-SPEC；**同构判定规则：任意两域工作台共享同一 DOM 骨架且无独有业务元素即 FAIL**；交互级 DoD：选/用/存/切各产生对应审计事件（preset.save/preset.switch ≥1）+ 状态变更截图 + saved-*.json 产物；preset 可新建/编辑（派生自 Scene 模板）。

### 15.4 U10 技能一致性 + 数据一致性（修复"EAP 技能错配/合成数据"）

- 每个 GT 落账时比对"实际执行技能 vs scene 声明技能"，不一致即 FAIL（2.0 EAP 跑了 dispute-ops）；EAP 域 GT 必跑 eap-referral。
- 数据规则：优先真实脱敏数据；合成数据仅作冷启动，且必须与 `docs/preset-design/` 数据字典逐表核对（文件名/行数/字段），校验器 `scripts/data-consistency-check.mjs`。

### 15.5 U3 探测规范 + U6 新鲜度 + S0 凭据探针

- 安装探测三源交叉（npm prefix -g / npm ls -g --json / dsh profile 依赖表），禁止单一 npm root -g（2.0 路径错位实测）。
- U6 扫描新鲜度：交付窗口内于项目环境重跑（`node scripts/security-scan.mjs`），bundle 期结论只可引用。
- S0 强制 credential-probe（探针脚本 bundle 已内置），S0 未含凭据探针即 U0 不通过。

---

## 附录 A：六职能 → 12 业务域映射

招聘→REC；培训→TRN；绩效→PRF；薪酬→COMP；HRBP→拆入 STRAT（组织盘点）/PRF（校准）/ER（争议）；员工关系→ER/EAP。

## 附录 B：预置文档清单（自制层核对表）

| 文档 | 预置形态 | Agent 职责 |
|---|---|---|
| PRD-桌面应用-基线.md | 功能清单 F1-F13 + 用户 + 非目标 | 按 runner-profile/D1D2 定制 |
| preset-design/（12 份） | §8.3 矩阵完整化 | 只许细化不许删域 |
| CR-checklist.md | 五类清单 | 逐产出物勾选出 cr-*.md |
| README-学员版 / README-维护者版 | 骨架 + ERR 索引链接 | 定制环境差异 |
| 三件套（建模/交接/30 天计划） | 遗产模板 | 作业 1-4 使用 |

## 附录 C：最小发送模板

```
你是 Universal Workbench 交付 Agent。这是一个资源包任务书：
第一步先跑 runner-probe 产出 runner-profile.json，然后按 §3 三层资源边界组装
（预置层禁联网重下 / 自制层只定制不重写 / 缺口层核验或降级），
在预置 PRD/CR/README/preset 设计文档基础上交付全能 Agent 工作台桌面应用（D1 保底、D2 达标升级）。
推进 U1→U14，每道门禁出证据 + cr-<artifact>.md。
禁止：伪造结果；Chassis 写业务；无出处数据（V8）；编造包名（V5/V6）；虚报 Runner/形态能力（D22）。
停止条件 §12.3。
```

**本任务书结束。Agent 必须与资源包（manifests/offline/scripts/templates/docs/reports）一并执行，最终以 `v5.0-universal-workbench-release`（或哈希链终行）+ 双平台安装包为交付标志。**
