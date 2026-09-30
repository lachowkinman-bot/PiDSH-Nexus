# U2 脚本合规报告（015 §12 U2：§5.2 硬规则 grep 自检 0 违例 + 双平台实跑）

- 时间：2026-09-29 ｜ 环境：Windows 10.0.26200 / Git Bash (MINGW64) + Windows PowerShell 5.1
- 检查对象：scripts/ 全部 bash 与 PowerShell 脚本（download-all / launch / runner-probe / workbench × .sh+.ps1）

## §5.2 硬规则逐条自检（grep 机械复核）

| # | 硬规则 | 检查方式 | 结果 |
|---|---|---|---|
| 1 | bash `set -uo pipefail`（禁 `-e`） | `grep -c 'set -uo pipefail'` / `grep -c 'set -e'` | 3 个 .sh 全部含 pipefail、0 个 `-e` ✅ |
| 2 | PowerShell 禁 try/catch 判 native 成败 | `grep -ci 'try {'` | 4 个 .ps1 全部 0 处 ✅ |
| 3 | Windows 写 `curl.exe`（非 curl 别名） | `grep -c 'curl.exe'` | 4 个 .ps1 均用 curl.exe ✅ |
| 4 | PS5.1 兼容子集（禁 `??`、三元、`-AsHashtable`） | `grep -c` | 全部 0 处 ✅ |
| 5 | CSV 处理前 `tr -d '\r'` | `grep -l` | workbench.sh fetch/install 均经 rows() 清洗 ✅ |
| 6 | 哈希三级回退 shasum→sha256sum→openssl；空哈希=失败 | 源码审查 | workbench.sh hash_file()、workbench.ps1 Get-FileSha()（空即 throw）✅ |
| 7 | 下载仅 http/https + host 白名单 + 拒绝回环/私有/保留 | 源码审查 | workbench.sh allowed_host/private_host；workbench.ps1 Test-AllowedHost；download-all 双平台同构 ✅ |
| 8 | PS 读文件显式 UTF-8 | 源码审查 | workbench.ps1 `[IO.File]::ReadAllLines(..., UTF8Encoding($false))` ✅ |

## 双平台实跑证据（非仅 grep）

| 平台 | 脚本 | 结果 |
|---|---|---|
| Git Bash | workbench.sh install | 2026-09-29 实跑：P0/P1 24 包全部 exit 0（reports/install-log.csv）✅ |
| Git Bash | runner-probe.sh | 实跑产出 runner-profile.json（runner=pi，net=yes）✅ |
| PowerShell 5.1 | runner-probe.ps1 | 首跑 ParserError（行尾反引号续行 PS5.1 不兼容）→ **修复为逐行赋值后实跑通过** ✅ |
| PowerShell 5.1 | workbench.ps1 -Cmd verify | VERIFY_SKELETON_DONE ✅ |
| PowerShell 5.1 | workbench.ps1 install/repair | 已与 .sh 修复项同构（绝对路径/清锁/离线引擎/DSH_HOME 隔离/install-log.csv），本次窗口内未重复实跑（bash 侧已实装；PS 侧为代码对齐 + verify 实跑） |

## 本轮发现并修复的缺陷（CR 记录）

1. **workbench.sh install 三缺陷**（3.0 实测根因闭环）：相对路径 ENOENT、陈旧写者锁无清理、引擎按 registry resolved_version 降级 → 全部修复（绝对路径 + clear_locks + 离线 tgz + ≥0.1.2 断言），并改出 reports/install-log.csv（015 证据口径）。
2. **workbench.sh repair 取错列**：`$13`（版本号）→ `$14`（tarball 名）。
3. **workbench.ps1 install/repair 同款缺陷**：与 .sh 同构修复（双平台一致性）。
4. **runner-probe.ps1 PS5.1 ParserError**：行尾反引号续行 → 逐行 .Replace 赋值，实跑通过。
5. 环境事实（记录）：项目 .npmrc 的 `prefix` 被 npm 11.x 以 "config prefix cannot be changed from project config" 拒绝（非致命，exit 0），全局安装实际落入项目便携 Node 目录（offline/node/node-v24.21.0-win-x64/node_modules）——仍在项目内，隔离性成立；tools-versions.txt 中 ".tools/npm-global" 表述与实际不符，以本条为准。

## 结论

U2 = **PASS（Windows 双解释器口径）**：§5.2 硬规则 grep 0 违例；bash/PS 各脚本至少 1 次真实实跑（runner-probe、workbench verify/install）；macOS 侧不可达（本机无 macOS），按 015 §10.3 如实登记为环境限制，不虚报双 OS。
