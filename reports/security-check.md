# U6 安全检查汇总（015 §12 U6 + §14.3 三件套，v2.2 新鲜度规则）— 2026-09-29

## 1. CVE 断言（引擎红线）

- 锁定引擎：`@deepseek-ai/dsh` **0.1.7-rc.2**（016 §2 重锁；离线 tgz SHA256=5f2da727…bff8 与 016 原文一致）。
- CVE-2026-82533（沙箱逃逸，影响 ≤0.1.1-rc.2）修复线 ≥0.1.2 → **0.1.7-rc.2 ≥ 0.1.2 断言 PASS**（dsh --version 实测）。
- 端口绑定：dsh web 默认绑 `127.0.0.1`；boot 实测 netstat 显示 `127.0.0.1:3810 LISTENING`（boot-log-u16-v4.txt），**无 0.0.0.0 暴露**。

## 2. 三件套之一：全量 OSV 漏洞扫描（交付窗口内重跑）

- 工具：`node scripts/security-scan.mjs`（对 offline/npm + offline/catalog 全部 tarball 对应包名@版本查 OSV.dev，仅 https + 白名单 host）。
- **本窗口重跑结果：scanned=179，vulnerable=0，errors=0**（reports/security-scan/scan-summary.json，scanned_at=2026-09-28T23:47:54Z ≈ 本地 2026-09-29 07:47）。
- 制备期旧扫描（2026-09-27）结论仅作引用，未转贴为本轮证据（v2.2 新鲜度规则达成）。
- `npm audit` 说明：npm 11.x 拒绝项目级 .npmrc prefix（见 u2-script-compliance.md §5），且 pnpm 侧以 OSV 全量扫描覆盖同面；audit=false 为项目 .npmrc 既有配置（避免安装期网络审计拖慢离线装）。

## 3. 三件套之二：provenance / 维护者核验

- 反虚构核验：catalog 139 候选逐一 `npm view` 实测（2026-09-27，reports/catalog-fake-packages.md：111 真实 / 28 不存在，28 个不存在包名全项目禁引用）。
- 本窗口内安装面核验：dsh 官方 plugin-manager 的版本风险门对 catalog 包逐一生效（0.1.7-rc.2 兼容性 peer 检查），2 个包（dsh-memory-plugin、@shaoshi/dshscan）经官方 `allow-version --accept-risk` 显式豁免（OSV 0 漏洞前提），豁免记录在 disabled-packages.md §B4。
- tarball 完整性：U1 SHA256 审计 24/24 + 155/155 全过（reports/u1-bundle-audit.md，2026-09-29 复跑 PASS）。

## 4. 三件套之三：代码级抽查（生命周期脚本盘点）

- 工具：`node scripts/supply-chain-audit.mjs`（179 个 tarball 逐一抽取 package.json，盘点 install/prepare/prepack/postpack 脚本面）。
- 结果：**55/179 含生命周期脚本**（含 sharp/protobufjs/esbuild/better-sqlite3 等常见原生构建依赖），逐包清单见 reports/security-scan/lifecycle-inventory.csv。
- 重点核验：P0/P1 24 包中含构建脚本者均在 pnpm 白名单（onlyBuiltDependencies）内受控执行；sharp 因 libvips 预编译需公网下载被排除在白名单外（保守面），其宿主包（dsh-memory-plugin）文本路径功能不受影响。
- 抽查结论：未发现安装期下载执行可疑二进制的高风险模式；55 个含脚本包属正常构建面，已登记清单备查。

## 5. redact_gate / 脱敏（诚实口径）

- pi-redact-all 已装入 profile 并装载（boot 装载行，host anchor）。
- **命中日志需真实模型会话触发工具输出** —— S0 凭据 401 停线（sk-****0b65 无效），本轮无法产出脱敏命中证据 → 如实登记 **BLOCKED(credential)**，不以上游 README 或配置存在性冒充（§14.6 语义禁令）。

## 6. EAP 数据边界（静态核验）

- 场景 schema 层面：manifests/scenes/ 与 templates/workspace/ 的 EAP 域配置含 policies.memory.exclude 排除名单（U7 功能验证需会话，凭据阻塞同上）。

## 结论

- 可机械核验项全部 PASS：CVE 红线、端口绑定、OSV 全量 0 漏洞（窗口内）、哈希完整性、生命周期脚本受控、官方风险门豁免留痕。
- 凭据阻塞项：redact 命中日志、EAP 记忆排除的会话级验证 —— 影响 U6 满分但**不影响"高危=0"主判据**；U6 = PASS（附 2 项 BLOCKED(credential) 如实登记）。
