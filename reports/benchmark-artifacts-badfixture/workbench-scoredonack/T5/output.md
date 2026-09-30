{
 "domain": "er-eap",
 "kind": "er-eap-eap-referral",
 "created_at": "2026-09-29T05:42:38.690Z",
 "workflow": "er-eap.eap-referral@1.0.0",
 "description": "EAP 转介（双审批 + 匿名化）",
 "fields": {},
 "deliverable_spec": {
  "file": "eap-referral-<ts>.json",
  "format": "json",
  "fields": [
   "anon_id",
   "direction",
   "approvals",
   "sessions"
  ],
  "acceptance": "输出仅匿名编号；禁网；禁入记忆层"
 },
 "engine": {
  "name": "pi",
  "fallback": false,
  "output": "## 无法执行：技能 `eap-referral` 不存在\n\n我尽力定位了 `er-eap.eap-referral@1.0.0`，但没有找到。结论要明确说：**我不能凭猜测去\"执行\"一个不存在的技能**，尤其这是涉及双审批 + 匿名化的合规敏感流程。\n\n### 已确认的事实\n\n**1. 技能未安装**\n当前会话可用的 skill 列表里没有 `eap-referral`，也没有 `er-eap` 包下的任何 skill。\n\n**2. Pi 配置里没有该包**\n`C:\\Users\\Kinman\\.pi\\agent\\settings.json`：\n```json\n{ \"lastChangelogVersion\": \"0.82.1\", \"theme\": \"dark\",\n  \"defaultProvider\": \"deepseek\", \"defaultModel\": \"deepseek-v4-flash\",\n  \"defaultThinkingLevel\": \"high\" }\n```\n没有 `packages` 声明，也没有项目级 `.pi/settings.json`。\n\n**3. 工作区里查不到**\n`F:\\Pi_DSH_workplace\\universal-workbench-3.0` 实际只包含：\n\n| 存在 | 不存在 |\n|---|---|\n| `package.json`、`package-lock.json` | `workflows/`、`skills/`、`packages/`、`src/`、`tests/` |\n| `docs/`、`scripts/`（目录存在） | `.agents/`、`.pi/`、`.git/`、`.claude/`、`er-eap/` |\n| `node_modules/`（仅 `playwright-core@1.63.0`） | `README.md`、`AGENTS.md`、`CLAUDE.md`、任何 eap/referral 文件 |\n\n`docs/` 与 `scripts/` 目录存在，但我逐一探测的候选路径（`docs/eap-referral.md`、`docs/er-eap.md`、`docs/workflow*.md`、`scripts/eap-referral.js` 等）全部不存在。\n\n### 为什么无法\"再搜一下\"\n\n本会话只挂载了 `read` 和 `write` 两个工具——**没有 shell / glob / 目录列举能力**。我只能靠逐一猜测路径探测（`EISDIR` = 目录存在，`ENOENT` = 不存在），这无法对 `docs/`、`scripts/` 内部做穷尽枚举。所以存在一种可能：技能就在这两个目录里，只是名字我没猜中。\n\n### 需要你提供其中一项\n\n1. **技能文件路径**（例如 `docs/<你的文件名>` 或 `scripts/<你的文件名>`），我立刻读取并按里面的 flow / 审批门 / 匿名化规则执行；或\n2. 确认该 workflow 应作为 **Pi package** 安装（给出 `npm:` / `git:` / 本地路径），我给出安装命令；或\n3. 直接粘贴 `er-eap.eap-referral@1.0.0` 的定义（步骤、角色、双审批的审批人与顺序、匿名化字段清单、留痕要求），我按其执行。\n\n另外提醒：EAP 转介 + 双审批 + 匿名化属于高风险的合规流程，在拿到正式定义前我不会自行编造审批链或匿名字段——那比不执行更"
 },
 "data_snapshot": [
  {
   "table": "eap_referrals",
   "rows": 4
  },
  {
   "table": "er_cases",
   "rows": 4
  }
 ]
}