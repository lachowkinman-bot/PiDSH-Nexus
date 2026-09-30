# Pi_DSH_support 择优选用报告（3.0 / 2026-09-30）

> 用户要求：「逐一检查该仓库所有功能、组件是否能够顺畅运行，择优选用文件夹 `Pi_DSH_support` 中的 packages 或 plugins 以提升 Windows 单机交付型应用/集成仓库的交付质量。」
> 本报告记录**机械筛 → 兼容性实测 → 选型决定**三段的真实证据与限制，不宣告未取证结论。

## 1. 机械筛（可复现）

- 执行器：`scripts/scan-support-catalog.mjs`（只读，不改动任何包）。
- 产出：`reports/support-catalog-scan.md` / `.csv` / `.json`。
- 覆盖：`Pi_DSH_support/dsh-plugins` + `pi-packages` 共 **687** 个含 `package.json` 的包。

| 分类 | 含义 | 数量 |
|---|---|---|
| READY_DIST | 自带 dist/lib，无风险脚本与原生依赖，可离线装载 | 93 |
| READY_SOURCE | 源码直载（无依赖、无构建产物） | 33 |
| BUILD_REQUIRED | 有依赖但无构建产物，需先构建 | 130 |
| NEEDS_SCRIPT_AUDIT | 含 pre/install/postinstall/prepare 脚本 | 183 |
| NEEDS_NATIVE_AUDIT | 依赖 node-pty / onnxruntime / sharp 等原生件 | 23 |
| SOURCE_ONLY | 私有源码包且无构建产物 | 16 |
| PI_PACKAGE | pi 侧包（非 dsh 插件形态） | 209 |

许可字段缺失 **25** 个：进 runtime 前必须补齐许可结论（本报告未放行）。

## 2. 已进入 runtime 的 4 个（前序工作，非本轮新增）

来源：`manifests/runtime-web.package.json`（`file:` 直指 `Pi_DSH_support/dsh-plugins/*`）。

| 包 | 定位 | 已观测证据 |
|---|---|---|
| `@a9i5k4/dsh-auto-memory` | 会话自动记忆 | 隔离启动 stdout：`[dsh-auto-memory] ready: engine + 19 tools + injection + 68 routes (external memory: 13 sources)` |
| `@weibaohui/skills-management` | 技能中心管理 | 随 runtime 打包（`profiles/web/node_modules/@weibaohui/skills-management/package.json` 在 zip 内实测存在） |
| `@omdsh-dev/dsh-plugin-check` | 插件体检 | 同上（zip 内实测存在） |
| `@weibaohui/dsh-kb` | 知识库 | 同上（zip 内实测存在） |

## 3. 本轮候选（零依赖 + 许可清晰，未放行）

| 包 | 版本 | 许可 | 价值 | 本轮证据 | 未放行原因 |
|---|---|---|---|---|---|
| `dsh-context-doctor` | 0.7.2 | BSD-3-Clause | 审计 AGENTS.md 指令链 / 技能目录 / 工具 schema 的 token 成本，检测重复与冲突 —— 直接服务「上下文 90% 强制 handoff」规则 | 已放入隔离 profile 的 `node_modules` 并登记 `dsh.profile.bundles`；冷启动 **HTTP 200 主壳起来、无 crash、无 failed-to-import**；插件无 ready 日志 | 未取得**功能级**证据（面板/`context_audit` 工具实调） |
| `dsh-secure-audit` | 0.2.10 | MIT | 提示注入检测 + 中文 PII/结构化脱敏 + 配置安全审计（只读，产自校验风险报告） | 同上（同一轮冷启动） | 同上 |

### 3.1 关键约束（本轮实测新增）

- **离线环境下 `dsh plugin add` 不可用**：`dsh plugin` 转发给 pnpm，缺 registry 元数据即 `ERR_PNPM_NO_OFFLINE_META`（实测：`@deepseek-ai/cordis-plugin-group@1.0.4` 解析失败）。
- 且该命令会**先移动** npm 安装的既有包到 `node_modules/.ignored`，在离线机器上把 profile 改成半损状态 —— 这是「离线安装必须走预构建 runtime，而不是安装期装插件」的又一个实证。
- 因此新增插件只能走**构建期**：改 `manifests/runtime-web.package.json` → `npm install --omit=dev --install-links` → 重打 `offline-3.0/runtime-web.zip` → 重装验证。本轮未执行该链路（需要联网 npm 解析）。

## 4. 选型决定（本轮）

1. **不新增** runtime 依赖：本轮只做机械筛 + 隔离冷启动预检，未取得功能级证据，按 `AGENTS.md`（启动验证 + 功能验证双门禁）**不予放行**，避免重演第六轮「peer 冲突崩壳」。
2. 现有 4 个 support 插件维持在用状态（其证据等级保持前序结论，不在本轮升级声明）。
3. 下一轮若放行候选，最小验证清单：
   - `context_audit` 工具实调一次并留 JSON 回执；
   - `secure_audit` / 脱敏工具对一段含 PII 的样本文本实调，核对脱敏结果；
   - 主壳 UI 出现对应面板（Playwright 截图）；
   - runtime 重打后 `verify-app` 全量门禁不回归。

## 5. 复现方式

```powershell
node scripts/scan-support-catalog.mjs          # 机械筛（~23s，只读）
Get-Content reports/support-catalog-scan.md    # 报告
```

> 可复现性提示：`Pi_DSH_support/`（7.1 GB，182k 文件）按 `.gitignore` 不入库，且 runtime 构建的 4 个 `file:` 依赖指向该目录。从 Git 恢复仓库后若要重建 runtime，必须先把 `Pi_DSH_support` 恢复到位，否则 `npm install` 会因缺 4 个本地包失败。
