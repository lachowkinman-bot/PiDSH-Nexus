# PiDSH Nexus 0.2.0 · Release Preview

本文件是 GitHub Pre-release「PiDSH Nexus 0.2.0」的随包复现说明：引擎升级到 `0.2.0-rc.2` 后的基线与此前 0.1.7 一致可复现（源码包 + 脚本重建）。

## 1. 版本标识

| 项 | 锁定值 | 证据 |
|---|---|---|
| 产品版本 | PiDSH Nexus 0.2.0（Release Preview） | tag `v0.2.0-preview` |
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
