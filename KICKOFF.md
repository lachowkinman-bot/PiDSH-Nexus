# KICKOFF · 发给 Agent 的第一条消息（逐字复制全文发送）

---

你是 Universal Workbench 交付 Agent。工作区已加载 universal-workbench-3.0/（自包含执行包）。

## 第 0 步（强制，先于一切）
1. 完整阅读 `016-插件化交付增补-v3.0.md`（执行入口，优先级最高）与 `015-Universal-Workbench-通用工作台交付任务书.md`（v2.2 主干）；
2. 把用户原始 4 点要求**逐字枚举为验收清单**附在最终报告开头，再对照 U1-U19 门禁——发现门禁未覆盖用户要求的，立即上报（不得以门禁清单替代用户要求——1.0/2.0 两次失败的共同根因）；
3. 运行 `node scripts/runner-probe.mjs 2>/dev/null || bash scripts/runner-probe.sh` 与 `node scripts/credential-probe.mjs`——双探针不过即停线上报。

## 验收基线（用户原始 4 点要求，逐条对照 U 门禁）
1. **pi 0.87.1 + dsh 0.1.7-rc.2 框架整合**：工作流 skill 节点经引擎执行（审计 `engine.run` ≥ GT 数，本地 JS 只可断网降级并标注 fallback）；**桌面双击启动**；用户设置 API Key 与各模块数据源后即可完整使用；具备 **agent 界面 + 工作模块界面**，可按业务场景切换（preset 四操作）。
2. **offline/ 内 179 包已预配置、已检查安全（交付窗口内 OSV 重跑）、已安装（三源探测判定）、逐包完整可用（四级 DoD）**——U16 为交付阻断门禁。
3. **14 Scene / 26 工作流 / 13 域工作界面**：UI/后端映射、schema（Type-Dict）、标签、数据勾稽正确（data-consistency 零 issue）、可响应；**U15 = 壳内截图 ≥13 功能 + 12 域，逐域差异化（同构=FAIL）**。
4. **对标 codex/pi/dsh 三基准 A/B（U17 协议）**；semantica/muzz 不可核验不引用（V8）。

## 执行顺序（§12 U1→U19，每道门禁出证据 + cr-<artifact>.md）
R/S0（双探针+环境五项）→ U1（哈希）→ **U3/U16（安装：`bash scripts/workbench.sh install` + catalog 三批 `manifests/catalog-install-batches.csv`；三源探测 `node scripts/install-probe.mjs`）** → 引擎整合：**`dsh plugin --profile web add <workbench-ui-plugin 目录>` → 壳内出现"⟡ 工作台"入口** → **U15（壳内截图 ≥13 功能 + 12 域面板，preset 四操作审计事件 preset.save/switch ≥1）** → U18（engine.run 经 `scripts/engine-skill-runner.mjs`；dsh exec 需先建 profile——见 016 §6）→ U17（A/B 对标）→ U14（桌面构建）→ U19（宣告检查单全勾才允许交付宣告）。

## 环境前置（缺则先补，补不上按 §10.3 停线上报）
- Node ≥24.19 LTS（offline/node/ 或 nodejs.org latest-v24.x）；
- API Key：复制 `.env.example` 为 `.env` 并注入真实值（credential-probe 验活；**勿提交真实 key**）；
- Windows 桌面构建需 Inno Setup（ISCC）；macOS 需 Xcode CLT——缺则 U14 登记 gap，先交付其余门禁并出阶段报告。

## 纪律（违者一票否决）
- §14.6 十四条语义禁令（哈希≠已安装、装载行≠可用、路由存在≠接通、渲染≠界面交付、NOT_RUN≠合规……）；
- **U19 阻断：U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL → 只输出阶段报告，禁止交付宣告**；
- 熔断：连续 3 个任务同形态失败 → 停止并诊断（credential-probe + 引擎状态）；
- 禁止 headless 冒充 UI 验证；U15 截图必须含 dsh 壳内 workbench panel；
- 交付标志：`v5.0-universal-workbench-release`（或哈希链终行）+ 双平台安装包 + 全部证据与 CR 记录。

---

## 逐 Runner 启动命令（先 `cd` 到 universal-workbench-3.0，再执行）

| Runner | 交互式（推荐首发） | 无人值守 |
|---|---|---|
| pi | `pi` → 把本文件"发给 Agent 的第一条消息"整段粘贴 | `pi -p "$(cat KICKOFF-PROMPT.txt)"` |
| codex | `codex` → 粘贴 | `codex exec "$(cat KICKOFF-PROMPT.txt)"` |
| claude code | `claude` → 粘贴 | `claude --permission-mode acceptEdits -p "$(cat KICKOFF-PROMPT.txt)"` |
| zcode | `zcode` → 粘贴 | 会话内开启自治/Goal 模式 |
| dsh | `npx -y --package @deepseek-ai/dsh@0.1.7-rc.2 dsh plugin --profile workbench add workbench-ui-plugin` 建插件 profile → `npx -y --package @deepseek-ai/dsh@0.1.7-rc.2 dsh web` → 网页 Goal 模式粘贴 | Goal 模式即自治形态 |
| opencode | `opencode` → 粘贴 | 自治模式（以其官方文档为准） |
| minimax / 豆包工作 / Trae Work / Kimi code | IDE/CLI 打开本目录 → 粘贴 §P | **UNVERIFIED_RUNNER：首跑即 U13 验证**，结果回填 reports/runner-matrix-results.md |

> 把"发给 Agent 的第一条消息"整段另存为 `KICKOFF-PROMPT.txt`（本文件 §首段至"交付标志"行）即可被上述 `$(cat …)` / `-p` 命令引用。

## 启动前 3 项检查（缺一先补）

```bash
node -v                                  # ≥24.19（2.0 教训：22.x 会使 pi-vault-mind 不可装）
node scripts/credential-probe.mjs        # exit 0 才开工（先 cp .env.example .env 填真实 Key）
curl -sI https://registry.npmjs.org >/dev/null && echo net-ok
```
