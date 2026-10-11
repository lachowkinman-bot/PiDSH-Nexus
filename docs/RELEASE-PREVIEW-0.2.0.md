# PiDSH Nexus 0.2.0 · Release Preview

本文件是 GitHub Pre-release「PiDSH Nexus 0.2.0」的随包复现说明：引擎升级到 `0.2.0-rc.2` 后的基线与此前 0.1.7 一致可复现（源码包 + 脚本重建）。

## 1. 版本标识

| 项 | 锁定值 | 证据 |
|---|---|---|
| 产品版本 | PiDSH Nexus 0.2.0（Release Preview） | tag `v0.2.0-preview` |
| 本次预览增量 | 工程包 `4.0.0-dev10`：集成层 + 运行时装上即用 + 工作台市场 v2 | tag `v0.2.0-dev10`（本文件第 7 节） |
| 工程包 | universal-workbench-3.0（桌面壳 3.0.0，工作台插件 4.0.0） | `src-tauri/tauri.conf.json`、`workbench-ui-plugin/package.json` |
| DSH 引擎 | `@deepseek-ai/dsh@0.2.0-rc.2` | `manifests/packages.manifest.csv`、`tools-versions.txt` |
| 引擎 SHA256 | `bd27847c445cd68a565ac1f91c06bbbcc7639ef93071f678bb59c5ebaff38859`（npm 官方 tarball；与 anywhere-labs vendor 副本内容等价） | `tools-versions.txt`、4.0 `offline/engines/SHA256SUMS.txt` |
| 运行束 build-id | `507f1c223c9adbb54f0127f4eec0783f955af2356cd1b14ed3560c6ab4e9ba62` | 4.0 `offline-3.0/runtime-web.build-id` |
| Node | 24.21.0（硬要求 >=24.19 LTS） | `tools-versions.txt` |
| pnpm | 10.32.1 | `tools-versions.txt` |

## 2. 升级边界与兼容证据

- 目标版本选择依据：npm `latest`/`next` 均为 0.2.0-rc.2；dataelement/dsh-desktop 与 anywhere-labs/dsh-desktop（stable）同版；社区升级走廊覆盖 `0.1.7-rc.2 → 0.2.0-rc.1` 六张卡并附 rc.2 现场记录。
- 工作台插件双世代：peer/engines `>=0.1.7-rc.2 <0.3.0-0`；7 个 client inject 包已核在 0.2 包集存在。
- 产品集 23 个插件的 `^0.1.x` peer 由 `templates/runtime/compatibility.json` 精确版本豁免（0.2.0-rc.2），来源为 peer-audit 报告；不引入运行时 shim。
- `dsh-artifacts@0.1.1` 随包分发、默认不加载（插件内硬断言拒绝 0.2；上游无新版）。
- `@anionex/dsh-vision-toolkit@0.1.45` 维持停用（调用已移除的 `ctx.settings.register`）。

## 3. 验收结果（2026-10-11，4.0 目录）

| 门禁 | 结果 | 证据 |
|---|---|---|
| `4.0-verify`（31 项） | **ok=true** | `reports/4.0/verify.json` |
| 工作台 UI v4（含两条真实模型旅程） | **10/10 PASS** | `reports/upgrade-0.2.0-rc.2/workbench-ui-v4.json` |
| 壳模块动作 strict | **102/102 PASS**（1919 控件，0 未登记） | `reports/upgrade-0.2.0-rc.2/shell-strict.json` |
| capabilities 矩阵 | **FAIL=0**（145 local/ready；20 BLOCKED_EXTERNAL；8 N/A） | `reports/r12-runtime-capabilities.json` |
| 冷启动插件加载 | 禁用 0 / failed-to-import 0 / pending 0 / 激活错误 0 | `reports/upgrade-0.2.0-rc.2/pluginload-report.json` |
| 版本 cohort 扫描 | 0 未豁免残留（1 条带因白名单 + 6 条插件私有嵌套登记） | `reports/upgrade-0.2.0-rc.2/cohort-scan-final.json` |
| H6 模型探测 / H7 真实工作流 | PASS（L0/L1；504 tokens + 审计行） | `reports/4.0/model-capability.json`、`workflow-live.json` |
| 回滚演练（0.1.7 profile） | 自带引擎启动 OK（401 + 工作台页 200） | `reports/upgrade-0.2.0-rc.2/rollback-0.1.7-boot.*.log` |

> 4.0 目录承载本轮全部证据与 ADR-0017；本仓库为源码面回填（脚本/清单/模板/文档），运行数据（`.dsh-home/`、`offline*/`、`installer-output/`）依 `.gitignore` 不入库。

### 安装态复验（本机就地升级，2026-10-11）

- 安装器重建（新 exe `06B17DF8…`）→ 静默就地安装 → `{app}\.dsh-home` 刷新到 build `507f1c22` → 以 profile 内引擎按应用真实契约启动 → **安装态 UI 旅程 10/10**（两条真实模型旅程、产物链接各 9、1100×700、控制台无页面错误）；插件加载禁用/失败/挂起全为 0。
- 安装态修复（本轮验收发现，均已入包与入本仓库）：
  1. `tools/` 必须随包（缺 `tools/model-adapter/cli.mjs` 时引擎运行器缺失 → `MODEL_UNAVAILABLE`）；
  2. `config/model-provider.example.json` 随包（用户级 `config/model-provider.json` 由用户自建，密钥仅引用环境变量）；
  3. Tauri `node_and_dsh` 与 `scripts/launch.ps1` 一律优先使用 profile 内引擎，避免机器上残留的旧全局引擎（0.1.7）引导新 profile（实测 61 个插件 pending、启动失败）；
  4. 运行新编译安装器须使用**唯一文件名**：同路径首跑可能执行上一枚旧二进制（实测 tools/ 未落盘，改名后 187 条落地记录）。

## 4. 源码复现（Windows，发布时实测）

```powershell
# 0) 构建期依赖（联网一次；之后可断网）
npm ci

# 1) 源码门禁
npm run design:verify              # 21/21
npm run verify:deliveries          # 117/117（Office 转换需本机 LibreOffice）
npm run verify:workflow-contracts  # 549/549
npm run verify:workflow-delivery   # 546/546

# 2) 单文件工作台
npm run build:app
```

## 5. 完整 runtime / 桌面壳重建

```powershell
# 1) 离线依赖层（引擎已锁 0.2.0-rc.2）
pwsh -File scripts/download-all.ps1
node scripts/download-catalog.mjs

# 2) 安装引擎与插件到项目内隔离 profile（.dsh-home）
pwsh -File scripts/workbench.ps1 -Cmd install

# 3) 启动
pwsh -File scripts/launch.ps1
```

## 6. 已知边界

- 23 条精确豁免为"已运行验收、未证明契约"；外部凭据类集成（飞书/IM/Sentry 等）维持 `BLOCKED_EXTERNAL`。
- `/workbench/api/*` 在回环上未继承宿主鉴权（与 0.1.7 基线相同）；后续项=迁移到 `connection` 注册或显式守卫。
- 社区走廊 `0.1.7-rc.1 → 0.1.7-rc.2` 一段未成卡；本项目有一手材料可回填社区仓库。

## 7. 增量：集成层与工作台市场 v2（dev8 → dev10，2026-10-11 续）

工程包版本推进到 `4.0.0-dev10`（tag `v0.2.0-dev10`，分支 `release-preview` / `master`）。引擎仍为 `0.2.0-rc.2`，运行束 build-id 不变。

### 7.1 新增能力

- **集成层三入口**：升级与兼容（只读：版本基线 / 23 条豁免 / 升级证据 / 走廊覆盖 / 回退演练）、制作我的工作台（三步向导）、工作台市场；三项目来源追溯折叠在「关于」。
- **自定义工作台运行时装上即用**：草稿 → 域级校验（`gen-domain-model` 硬校验 + 通用设计生成器）→ 预览 → **安装即生效**（侧边栏一级入口 `⧉ 名称`）；工作流向导 / 实例 / 审批 / 交付 / 审计全链路同权，标注"本地工作台（未固化）"；固化进产品基线保留合入包路径。
- **工作台市场 v2**：目录协议 v2（`owner/repo` 或 `pids:<域>` 身份、分类、中英描述、SemVer、分发型、截图 sha256/尺寸）；本地目录默认 + 可选 HTTPS 远程源（`workspace/config/market-sources.json`，默认关闭）；三页签（市场 / 我的收藏 / 已安装）+ 搜索 / 分类 / 排序 + 检查更新 + 功能主开关；卡片含截图轮播与放大、收藏、安装 / 更新 / 卸载与**确认弹窗**；**禁止降级**。
- **状态账本**：`workspace/custom/workbench-state.json` v1（enabled / added / pinned / favorites / active / sessionBindings / recentSessions / notes / hiddenWorkspaces），revision 乐观并发（409）+ 不变量校验；安装记录独立 `market-installs.json`。
- **工作台模式**：顶部切换器（会话（未绑定）↔ 各工作台）；进入工作台后新建会话自动绑定归属；每工作台笔记（本地，≤200KB）。
- **包 v2 + 双包**：`pids-nexus/workbench-package/v2` + `scripts/custom/check-workbench-package.mjs`；运行时包即装即用；DSH 插件包（本地 `.tgz` → 探测 CLI → `dsh plugin add` → 重启生效；卸载与记录清理）；远程分发默认关闭。
- **数据面**：真实数据导入（严格表头 / 列映射 + 预览，含备份与 `data.import` 审计）；独立驾驶舱实时读服务端数据；外部只读数据源骨架（file/http 探测与刷新，sql 预留）。
- **修复**：桌面应用"独立驾驶舱"点不动（wry 在无 `on_new_window` 时丢弃 `window.open`，已接管并带同窗口兜底）；静默安装 `exit=5`（强制结束遗留 dsh 子进程占用文件，`/LOG` 复现并固化）；工具注册缺 `output.render` 静默失败；陈旧重检标记永久禁用按钮；插件加载旧快照（profile junction 指向 `{app}`）。

### 7.2 验收结果（2026-10-11）

| 门禁 | 结果 | 证据 |
|---|---|---|
| 工作台 UI v4（34 条旅程） | **34/34 PASS**（开发壳）；安装态 **33/34**（唯一失败=第三方 `conversation.input.left` React #130，已证与工作台无关） | `reports/workbench-market-dev10/workbench-v4-ui-{dev,installed}.json` |
| 壳模块动作 strict | **107/107 PASS，0 未登记** | `reports/workbench-market-dev10/shell-strict-dev10.json` |
| 应用自检 APP_VERIFY | **45/45**（安装态） | `reports/workbench-market-dev10/verify-app-installed.json` |
| `4.0-verify` | **ok=true** | `reports/workbench-market-dev10/4.0-verify.json` |
| 密钥/PII 扫描（回填后） | **ok=true** | `reports/4.0/security-scan-backfill.json` |
| 安装器 | `UniversalWorkbench-Setup-4.0.0-dev10.exe`，594,487,903 B，sha256 `8A91CEE035706F91F95EE610C990A9018D678B4C5A7C46E09E3BB784CFAB08EE`；静默安装 exit=0 | `reports/workbench-market-dev10/inno-dev10.log` |

### 7.3 增量已知边界

- 目录 / 状态 / 包的新夹具未补（以包校验脚本冒烟 + UI 旅程覆盖）；插件包"重启后加载"未做整链 UI 验证。
- 独立应用（SPA）市场为轻量对齐（无轮播/放大）；远程目录源与联网安装默认关闭、未联调。
- 沿用第 6 节全部边界；第三方槽位崩溃（`conversation.input.left`）与 `dsh-sonarqube`/`dsh-sentry` 无凭据报错维持登记不修。
