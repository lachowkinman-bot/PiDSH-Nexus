# U3/U16 安装三源探测（禁单源 `npm root -g` 判定）— 2026-09-29 终态

- 环境：项目内便携 Node v24.21.0 ｜ 独立 DSH_HOME=`universal-workbench-3.0/.dsh-home`（探测必须在此 env 下执行，否则源②会读到其他项目的 dsh home——本轮实测教训）
- 规范：015 §15.5 / U3 / U16 —— `npm prefix -g` + `npm ls -g --depth=0 --json` + dsh profile package.json 三源交叉
- 产物：reports/install-probe.json（机器可读）

## 三源结果（2026-09-29）

| 源 | 命令 | 结果 |
|---|---|---|
| 1 | `npm prefix -g` | `F:\Pi_DSH_workplace\universal-workbench-3.0\offline\node\node-v24.21.0-win-x64`（npm 11.x 拒绝项目 .npmrc prefix 但回退仍落项目内 → 隔离性成立） |
| 2 | `npm ls -g --depth=0 --json` | `@deepseek-ai/dsh@0.1.7-rc.2`（016 §2 重锁版本 ✅）+ corepack/npm |
| 3 | `.dsh-home/profiles/web/package.json` dependencies | 23 个 P0/P1 插件全部在列（pi2dsh、dsh-better-sidebar、pi-hermes-memory、pi-approval-guardian、pi-redact-all、pi-mcp-adapter、dsh-excel-panel、dsh-docs-panel、@rmrdeveloper/sideroom-pi、pi-stats-footer、dsh-undo-savepoint、@tintinweb/pi-subagents、pi-dag-core、graph-memory、@mutmutco/pi-plugin、pi-deepseek-search、pi-queue-steer-factory、pi-loop-mode、@anionex/dsh-vision-toolkit、@ychris12138/dsh-usage-stats、@changfenhuang/dsh-annotation、dsh-network-settings、dsh-plugin）+ ~130 catalog 包 + `@workbench/client-ui` link |

## 判定

- **P0/P1：24/24 INSTALLED**（引擎 1/1 + 插件 23/23）。
- 与 2026-09-28 的 2/23 相比：写者锁清理 + tarball 绝对路径两项根因修复后，`bash scripts/workbench.sh install` 一次通过 24 包（reports/install-log.csv 全部 exit=0）。
- 四级 DoD 分级结论见 reports/pkg-func-smoke.md（L3 交互项受凭据 401 影响如实标注）。

## 装载行证据（dsh web boot v4 实测日志，非断言）

```
[pi2dsh] loaded pi2dsh-builtins: …
[pi2dsh engine] preparing 79 Pi package(s): …（79 个 pi 包进入装载）
[pi2dsh] loaded ×74 …（逐包装载行）
dsh web: http://127.0.0.1:3810/?token=…
```
> 语义纪律：装载行 ≠ 可用（§14.6）。可用性以 reports/pkg-func-smoke.md 的 L3/L4 分级为准。

## 历史记录（2026-09-28，供对账）

- 当日三源：引擎 ✅ + pi2dsh ✅ + pi-redact-all ✅，21 包因"陈旧写者锁 + 相对路径 ENOENT"未装入（两根因诊断与修复记录见 workbench.sh install 分支注释与本表上方终态）。
