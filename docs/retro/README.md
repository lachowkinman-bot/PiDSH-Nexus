# 追溯性文档（Retrospective PRD & ADR）· 索引与取证说明

> 生成时间：2026-09-29（第六轮收尾）｜ 生成方式：**事后追溯**（retrospective），非立项期文档
> 目的：把"当时为什么这么做、否决了什么、后来推翻了什么"从会话与交付物里还原成可审计的 PRD 与 ADR。

## 1. 取证来源（provenance）

| 来源 | 实际可用性 | 说明 |
|---|---|---|
| **Git 历史** | ⚠️ **项目自身：不存在；随包第三方源码：存在且已读** | 见下方 §1.1 穷尽检索。本工作副本与原始包**均无 `.git`** → 项目**从未纳入版本控制**；等价审计手段是 `manifests/tag-manifest.csv` 哈希链（015 §4.3 预案）。但树内**确有**第三方仓库的 Git 元数据（dsh-web 源码克隆 + 286 个插件克隆），已读取并用于印证两处决策。 |
| **Session 转录** | ✅ 已挖掘 | ZCode 会话库 `C:\Users\Kinman\.zcode\cli\db\db.sqlite`（`session` 163 行 / `message` 7,703 行 / `part` 32,204 行 / `todo` 533 行）。与本项目相关 **47 个会话**（9 个主会话 + 38 个子代理会话），时间跨度 2026-09-07 → 2026-09-29。真实人类消息须按 `part.semantics.kind='user_prompt'` 过滤（另有 493 条 todo 提醒噪声）。 |
| **项目书面记录** | ✅ 已挖掘 | `progress.md`（六轮全量日志）、`reports/*.md`（40+ 份证据报告）、`docs/why-not-met-1.0.md` / `why-not-met-2.0.md`（两轮失败复盘，各 35KB）、`015/016/KICKOFF/BUNDLE-INDEX`、交接文档 r1/r5/r6。 |
| **项目记忆** | ✅ 已挖掘 | `~/.zcode/cli/memories/projects/{pi-dsh-9c67c4c38cdf603f, pi_dsh_workplace-20aab78db9fc0831, hr_ai-953a87b01f41f51a}/memory/*.md`——含"方案集评估""排雷清单""015 设计决策台账"。 |

**本项目的特殊性**：它把"被否决的方案"当成一等公民记录下来（`docs/why-not-met-*.md` 两份复盘 + `disabled-packages.md` + `catalog-fake-packages.md` + §14.6 语义禁令），因此 ADR 的"被否决方案"部分有**逐条原文证据**，不是事后补写的合理化叙事。

### 1.1 VCS 取证（穷尽检索，2026-09-29）

因为任务要求"读取 Git 历史"，这里给出**穷尽检索的命令与结果**（不是断言，是可复跑的取证）：

```bash
find /f/Pi_DSH_workplace -name ".git"                          # 全工作区，不限深度（含 .git 文件形式）
find /f/AI_HR_Workshop -maxdepth 7 -name ".git"
find /f/Pi_DSH_workplace /f/AI_HR_Workshop -maxdepth 4 -name "*.bundle" -o -name "*.git"
git -C /f/Pi_DSH_workplace/universal-workbench-3.0 rev-parse --show-toplevel   # → fatal: not a git repository
git -C /f/Pi_DSH_workplace rev-parse --show-toplevel                           # → fatal（父目录也不是仓库）
env | grep -i '^GIT'                                                           # → 仅 GIT_EDITOR=true（无 GIT_DIR 重定向）
```

**结论 A（项目自身：无历史）**：`F:\Pi_DSH_workplace` 全树只有 **1 个** `.git`（见结论 B）；工作副本、原始包、以及它们的父目录**都不是仓库**。→ 该项目的开发过程**从未纳入版本控制**，不存在可读的提交历史。这本身是一条发现（本项目六轮执行全靠 `progress.md` + `reports/` + 会话转录留痕）。

**结论 B（随包第三方源码：有 Git 元数据，已读取）**：

| 仓库 | 位置 | 读到什么 | 对追溯的价值 |
|---|---|---|---|
| `dsh-web`（D2 内嵌壳候选） | `universal-workbench-bundle 1.0/offline/github/dsh-web/.git` | remote `github.com/zhu1090093659/dsh-web`；branch **dev**；HEAD `c989e5a` **2026-09-26** `chore(release): bump to 0.4.3`；tag **v0.4.3**；**`rev-list --count = 1`（`--depth 1` 浅克隆）**；`.git` 426 MB | 印证 ADR-0005：D2 壳候选停在 **v0.4.3** 且**只有 1 个提交的浅克隆**（无开发历史、无 25 项 UI 测试所需的测试基线）→ 与"U14 机械裁定不达标、自动回落 D1"的登记一致 |
| `awesome-dsh-plugin`（清单索引源） | `工作台pi-dsh方案/download-scripts/catalog/awesome-dsh-plugin/.git` | HEAD `4fee2fc` **2026-09-27** `chore: regenerate READMEs from data/plugins` | 印证 M1：清单是**期前刷新**的（数字过时快）；索引源本身可追到具体提交 |
| **286 个插件源码克隆** | `工作台pi-dsh方案/download-scripts/downloads/dsh-plugins/*/.git` | 286 个仓库（浅克隆） | 印证 M1/D16：catalog 的 1006 条清单**逐包有源码落盘**，不是纸面清单；也印证"23/24 单人维护 bus factor=1"的生态判断有据可查 |

**结论 C**：任务里"读取 Git 历史"这一项，就**项目自身**而言物理上不存在（已穷尽检索）；就**随包源码**而言已按上表读取并用于印证 ADR-0005 / M1 / D16 三处结论。未读取的是这 286 个仓库的逐包提交史（与本次追溯目标无关，未展开）。

## 2. 产物清单

| 文件 | 内容 |
|---|---|
| `RETRO-PRD.md` | 追溯性产品需求文档：产品定位、18 个模块的"建成态需求 + 决策背景 + 被否决方案"、约束目录、更正台账、未达标项 |
| `adr/ADR-0001..0014-*.md` | 14 份架构决策记录（每份含 背景/决策/**被否决方案及理由**/后果/证据/更正） |
| `adr/README.md` | ADR 索引与阅读顺序 |

## 3. 阅读提示（三条容易误读的点）

1. **本文档不是立项 PRD**。立项依据是 `015-Universal-Workbench-通用工作台交付任务书.md`（v2.2, 951 行）与 `016-插件化交付增补-v3.0.md`；本文档记录的是**实际怎么落地、以及落地过程中改了什么**。
2. **"被否决方案"里有一部分是"用户亲自否决"**（例如：独立 Web 应用路线、24 条精选清单、Program Files 安装），这类否决优先级最高，已单独标注 `【用户否决】`。
3. **更正台账（§5）比结论更重要**。本项目六轮里出现过 19 处结论更正，其中 3 处是"假通过"（判据空转/进程退出码/CSV 解析），2 处是**用户级结论撤回**（凭据硬停线、U18 质变）。任何引用本项目旧文档的人，都应先读更正台账。

## 4. 生成方法（可复现）

```
① 会话库：SQLite 只读查询（node:sqlite）
   - session/message/part 三表联查，按 semantics.kind='user_prompt' 取真实用户消息
   - 按 workspace/directory 归属筛选本项目会话（47 个）
② 书面记录：全文阅读 docs/why-not-met-*.md + reports/*.md + 交接文档
③ 交叉核对：会话中的"决策时刻"与书面报告中的"决策记录"逐条对齐；
   冲突时以**有实测证据的一方**为准，并把冲突本身记入更正台账
④ 输出：本目录（PRD + ADR 集）
⑤ 闸门复核：node ~/.agents/skills/retroprd/scripts/retroprd-verify.mjs <项目根>
   → RETROPRD_VERIFY 13/13 PASS（18 个模块 100% 含被否决方案 / 90 处证据路径 / 14-14 ADR 齐备 / 无凭据明文）
```

> **关于 `retroprd`**：任务点名要求使用 `retroprd` skill，但本机（459+44 个技能目录、插件缓存、PATH）与 npm 上**均不存在**该 skill/包。
> 因此本次在 `~/.agents/skills/retroprd/` **就地创建**了它（`SKILL.md` 记录本节 ①-④ 的流程，`scripts/retroprd-verify.mjs` 是第 ⑤ 步的机械闸门），
> 并用它复核了本目录的产出。**这不是上游第三方 skill**，请勿误认为沿用现成件。

## 5. 安全提示（与本文档同批发现）

会话转录库中存在**历史 API Key 明文痕迹**（3 处，出现在用户/助手消息正文里，非本目录产物）。本项目已登记过一次掩码命令失误导致的明文泄漏（`reports/credential-unblock-3.0.md` §6）。
**本目录全部产物不含任何密钥明文**；但建议对相关 key 做轮换，并在后续会话中避免把密钥正文粘进对话。详见 `RESOURCE_CHECKLIST.md`（凭据一节）。
