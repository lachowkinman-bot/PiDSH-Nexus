# CR 记录 · 3.0 第二轮（2026-09-29）— cr-3.0-round2.md

> 按 docs/CR-checklist.md 五类逐项审查本轮产出物。范围：manifest/引擎修正、workbench 双平台修复、catalog-install.mjs、dod-run.mjs、peer 冲突处置、U14 安装器、U2/U5/U6 报告。

## 1. 下载/脚本类

| 检查项 | 结果 |
|---|---|
| 退出码判定（无 try/catch 判 native） | ✅ workbench.sh install 只认 `$?`；workbench.ps1 只认 `$LASTEXITCODE`；catalog-install.mjs 只认 spawnSync status |
| 哈希非空（空=失败） | ✅ 引擎 tgz SHA256 逐字核验（5f2da7…bff8 = 016 原文）；u1-bundle-audit 复跑 PASS |
| host 校验 | ✅ 本轮零联网下载（全部离线 tarball）；catalog-install.mjs 无下载路径 |
| 重试与 gap 登记 | ✅ catalog-install.mjs 失败重试 1 次 + catalog-install-failures.md 终态台账；不静默 |
| 幂等 | ✅ catalog-install.mjs 按 CSV 已成功行跳过（实测断点续跑） |

## 2. 安装/配置类

| 检查项 | 结果 |
|---|---|
| 版本断言（DSH≥0.1.2） | ✅ install 分支装后断言（sort -V / [version] 比对）；0.1.7-rc.2 |
| 仅 127.0.0.1 | ✅ boot netstat 实测 127.0.0.1:3810/3811（l4-independence.csv bound 列） |
| 三路分流正确 | ✅ 引擎=npm-i-g 离线 tgz；P0/P1+catalog batch1/2=dsh plugin add；batch3=npm i -g；SKIP 行（引擎锁）单独留痕 |
| 独立性验证记录 | ✅ l4-independence.csv（23 插件 remove/boot/add/boot；两轮仪器误差 CSV 归档 *.bak 未删除） |
| **发现并修复** | workbench.sh install：相对路径 ENOENT（pnpm 解析到 profiles/web/）、陈旧写者锁（60-120s 超时 exit1）、引擎按 registry resolved_version 降级 —— 三缺陷同修（绝对路径/清锁/离线 tgz+版本断言）；repair 取列 $13→$14 |
| **发现并修复（双平台）** | workbench.ps1 install/repair 同构修复；runner-probe.ps1 行尾反引号续行 PS5.1 ParserError → 逐行赋值，实跑通过 |

## 3. 权限/安全类

| 检查项 | 结果 |
|---|---|
| 安全单调性/EAP 排除 | 场景 schema 层在位；会话级验证凭据阻塞（如实登记） |
| redact_gate 命中日志 | BLOCKED(credential)，未冒充（security-check.md §5） |
| 无明文密钥 | ✅ .env 不存在；key 仅环境变量；报告一律 `****0b65` 掩码 |
| 供应链 | ✅ OSV 179/0/0（窗口内重跑）+ 生命周期脚本 55/179 受控盘点 + dsh 官方风险门豁免 2 包留痕 |

## 4. 工作流/场景类

| 检查项 | 结果 |
|---|---|
| Schema lint / GT | U10 凭据阻塞，未动 ✅（不虚报） |
| **peer 冲突处置（本轮最大缺陷）** | catalog 包 peer 声明 dsh@0.2.0-rc.1 → pnpm 装入整套 0.2.0-rc.1 → 91 行禁用 + dsh-llm-pi-ai ESM 崩溃整壳。处置：pnpm-workspace.yaml overrides 钉 0.1.7-rc.2（引擎同版）+ 移出 11 个与引擎内建重复/破损 catalog 包（disabled-packages.md §B2，全部留痕可复现）→ 复测 0 阻断失败、74 装载行、壳健康 |
| 风险门豁免 | dsh-memory-plugin / @shaoshi/dshscan 经官方 `allow-version --accept-risk`（OSV 0 漏洞前提），命令与理由入台账 |

## 5. 文档类

| 检查项 | 结果 |
|---|---|
| 单一引用源 | ✅ 新报告互以路径引用，不复制表 |
| 与实物一致 | ✅ 措辞逐字对齐证据（U19 检查单 A 项逐条核对：☑3/△2/☒5） |
| 语义禁令 | ✅ 14 条自查零违例（U19 检查单 B 项） |
| 诚实边界 | ✅ macOS 侧、第二机旅程、catalog L4 全量、Type-Dict 25<40 均如实登记，无凑数 |
