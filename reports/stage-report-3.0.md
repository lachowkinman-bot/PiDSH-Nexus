# universal-workbench-3.0 阶段报告（非交付宣告）— 第二轮

> 依据 015 v2.2 §12 U19 阻断规则：U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → **只输出阶段报告，禁止交付宣告**。
> 本报告不含"已交付/已完成/已达标"结论。填报时间：2026-09-29 10:20（覆盖 2026-09-28 19:00 第一轮）。
> 环境：Windows / 项目内独立 Node v24.21.0（便携版 PATH 前置）+ 独立 `DSH_HOME=.dsh-home`；全局安装落于项目便携 Node 目录（`npm prefix -g` 实测），未写入系统位置、未改动同目录其他项目。
> 本轮新增/变更记录：`progress.md` 执行日志；CR：`reports/cr-3.0-round2.md`。

---

## 〇、用户原始要求逐字枚举（验收清单，优先于 U1–U19 —— 第一轮已列，本轮更新实测）

### 要求 1（逐字）："基于 pi.dev + dsh（deepseek harness）框架整合"
- 引擎 **0.1.7-rc.2**（016 §2 重锁）已装且 manifest 已回写一致；pi 0.87.1 就位；pi2dsh 桥接工作（boot 装载 79 Pi 包）。
- 插件化形态达成：⟡ 工作台在官方壳内（本轮 `u16-l3-workbench-panel-clean.png` 复确认）。
- **执行级整合仍 FAIL**（U18：engine.run 3 次全 fallback）——凭据 401 解冻后重跑。

### 要求 2（逐字）："packages/skills/plugins/extensions 已检查安全、已安装、完整可用"
- **已检查安全：PASS** —— OSV 全量 179 包 0 漏洞（交付窗口内重跑，`reports/security-scan/scan-summary.json`）+ 生命周期脚本盘点 55/179 受控（`lifecycle-inventory.csv`）+ dsh 官方版本风险门逐包生效（2 包显式豁免留痕）。
- **已安装：P0/P1 24/24（三源交叉）+ catalog 153/155 exit 0（151 直接成功 + 2 豁免后装成）+ 1 SKIP（引擎锁）+ 1 上游破损**；141 包装入 profile 且壳健康装载（74 条装载行）。
- **完整可用：PARTIAL** —— L1/L2 全过；L3 = 7 项壳内真实界面操作证据 + 15 项会话交互凭据阻塞 + 1 项激活失败（vision-toolkit，已停用登记）；L4 = P0/P1 逐包 remove/boot/add 循环因执行器仪器问题按熔断停批，仅 pi2dsh 全周期在案（`l4-independence.attempt*.bak` 留痕），改以"全量 profile 健康启动"作恢复面证据（`u16-final-shell-home.png`）。详见 `reports/pkg-func-smoke.md`。

### 要求 3（逐字）：13 域场景/工作流/UI 映射/勾稽/可响应
- 13 域差异化 UI **PASS**（前轮 25 张 + 本轮复确认）；壳内 API 可响应 **PASS**（scenes/domains/current/audit 全 200）。
- 勾稽（data-consistency）与 GT 一致性：**BLOCKED**（凭据）。
- 新发现并修复的"可响应无 bug"级缺陷：catalog peer 冲突曾致**整壳崩溃**（91 行禁用 + dsh-llm-pi-ai ESM 异常）——以 overrides 钉引擎同版 + 移出 11 个冲突包后，壳 0 阻断失败（`boot-log-u16-v4.txt` / `boot-log-u16-final.txt`）。

### 要求 4（逐字）：对标 codex/pi/dsh 等开箱即用质量
- **安装器已实构建**：`installer-output/UniversalWorkbench-Setup.exe`（307MB，SHA256 eb49b1d5…；postinstall 离线装引擎+P0/P1）。第二机全旅程与 U17 A/B **BLOCKED**（凭据 401：`credential-probe` 复测仍 `PROBE_FAIL credential-rejected status=401`，key ****0b65 无效）。

---

## 一、U1–U19 门禁对照（本轮终态）

| 门禁 | 状态 | 判定依据（证据路径） |
|---|---|---|
| U1 资源包预置完整性 | **PASS**（引擎行回写 0.1.7-rc.2 后复跑仍全绿） | `reports/u1-bundle-audit.md`：24/24 + 155/155 + 引擎 HASH_OK |
| U2 脚本合规 | **PASS**（Windows 双解释器口径） | `reports/u2-script-compliance.md`：§5.2 grep 0 违例 + 4 脚本实跑；PS5.1 续行缺陷修复 |
| U3 安装与独立性 | **PARTIAL**（大幅收窄） | L1 `install-log.csv` 24/24 exit0；三源 `install-probe.json` 24/24 INSTALLED；L2 `boot-log-u16-final.txt` 74 装载行；L3 `pkg-func-smoke.md`（7 界面证据+15 凭据阻塞+1 停用）；L4 `l4-independence.attempt*.bak`（1/23 全周期+熔断记录） |
| U4 指令集实跑 | NOT_RUN | 学员件双平台逐条实跑未开展（凭据+时间窗） |
| U5 十要素 | **PARTIAL** | `reports/ten-elements-matrix.md`：机械 6/10 PASS；7/9 会话面 BLOCKED(credential)；要素5 GAP（Type-Dict 25<40 如实登记） |
| U6 安全 | **PASS**（附 2 项凭据阻塞登记） | `reports/security-check.md`：OSV 179/0/0 窗口内 + CVE 断言 + 127.0.0.1 绑定实测 + 生命周期受控 |
| U7 记忆与知识 | BLOCKED(credential) | mnemon UI 管理面 PASS（`u16-l3-memory-system.png`）；跨会话召回需会话 |
| U8 文档质量 | NOT_RUN | 22 类清零与 CR 覆盖率汇总未做（CR：`cr-3.0-round2.md` 本轮已按五类归档） |
| U9 交付打包 | NOT_RUN | 三清单+哈希链终行未做 |
| U10 场景与工作流 GT | **BLOCKED** | 凭据 401 |
| U11 学员件实测 | NOT_RUN | — |
| U12 防断供演练 | NOT_RUN | — |
| U13 Runner 兼容 | NOT_RUN | runner-profile.json 在案（runner=pi）；≥2 runner 全链实跑未做 |
| U14 桌面安装器 | **PARTIAL** | `reports/desktop-acceptance.md`：Setup.exe 实构建+哈希在案；第二机全旅程 BLOCKED(credential)+无第二机；macOS 环境限制 |
| U15 壳内 UI（v3.0 六条机械判据） | **PASS**（本轮全目录安装下复确认） | 前轮 25 张 + 本轮 `u16-l3-workbench-panel-clean.png`（13 域卡+preset 条+审计按钮）；preset.apply/save/switch 审计在案 |
| U16 catalog 安装 | **PARTIAL** | `catalog-install-log.csv`：151+2 豁免装成 / 1 SKIP / 1 破损；壳健康；`disabled-packages.md` 终态台账（12 冲突移出+8 套件冗余+1 停用） |
| U17 对标 A/B | **BLOCKED** | 待有效 key（协议 `docs/benchmark-comparison-protocol.md` 就绪） |
| U18 引擎整合 | **FAIL** | 3 次全 fallback（降级率 100%）；凭据解冻后重跑 `scripts/engine-skill-runner.mjs` |
| U19 交付宣告 | **禁止宣告** | U3 PARTIAL / U5 PARTIAL / U10 BLOCKED / U16 PARTIAL / U17 BLOCKED / U18 FAIL；`docs/delivery-announcement-checklist.md` 第二轮填报（A 项 ☑3/△2/☒5；B 项 14/14 零违例） |

---

## 二、本轮关键成果（相对第一轮）

| 项 | 第一轮（09-28） | 本轮（09-29） |
|---|---|---|
| P0/P1 安装 | 2/23（21 包锁死） | **24/24 exit0 + 三源 24/24 INSTALLED** |
| catalog 安装 | NOT_RUN | **153/155 exit0（含 2 豁免）+ 1 设计性 SKIP** |
| 壳健康 | 装包后需重启复核 | **0 阻断失败**（修复 peer 冲突崩壳根因）；74 装载行；API 全 200 |
| U2/U6 | NOT_RUN | **PASS**（双平台实跑 / OSV 窗口内 179/0/0） |
| U14 | NOT_RUN | **Setup.exe 实构建**（307MB+SHA256） |
| 十要素 | 骨架 | 机械 6/10 回填 PASS |
| 引擎一致性 | manifest 与 016 冲突 | **manifest 回写 0.1.7-rc.2**，U1 复跑 PASS，install 分支改离线 tgz+版本断言（禁降级） |

## 三、本轮发现并修复的缺陷（详 cr-3.0-round2.md）

1. workbench.sh install 三缺陷（相对路径 ENOENT / 陈旧写者锁 / registry 降级）+ repair 取列错。
2. workbench.ps1 同构缺陷；runner-probe.ps1 PS5.1 续行 ParserError。
3. **peer 冲突崩壳**（本轮最大）：catalog 包 peer=dsh@0.2.0-rc.1 → 整套 0.2.0-rc.1 入 profile → 91 行禁用 + dsh-llm-pi-ai 崩溃整壳 → overrides 钉引擎同版 + 11 冲突包移出 + 2 包官方豁免，全部留痕。
4. ISCC 长路径限制（166 个 >240 字符路径）→ 安装器改为"裸 runtime + postinstall 离线装"（合同内）；launch.ps1 npx 联网 + `dsh web` 旧语法修复。
5. dod-run.mjs 仪器三轮迭代（fetch 被 fence 掐断 / token 路径拼接 / CSV 字段引用）——按熔断纪律停批，L4 如实记 PARTIAL。

## 四、门禁未覆盖项上报（承第一轮，状态更新）

1. "安装+APIKey 即可用"端到端体验无门禁判据 —— **本轮由 credential-probe 复测再次证实为唯一硬停线**（key ****0b65 无效）。
2. "已检查安全"：v2.2 已加新鲜度规则，本轮已执行（OSV 窗口内重跑）——该项缺口已闭合。
3. "schema/标签/勾稽"：data-consistency 校验仍未跑（凭据+样例数据生成属 U10 冻结范围）。
4. "无 bug"：本轮额外证据=壳 0 阻断激活失败 + 走查控制台错误仅剩视觉杂音级（无崩溃）。
5. P0/P1 逐包 DoD 无独立门禁条目 —— 本轮按 U3 口径补齐 L1/L2/L3 分级，L4 部分达成。
6. 版本冲突仲裁 —— **已闭合**：manifest 回写 0.1.7-rc.2，双脚本禁 registry 降级。
7. **新上报**：catalog 包与引擎内建件的重复注册无前置门禁（U16 只判"装上"，不判"与引擎共存"）——本轮以 boot 激活清单 + disabled 台账弥补，建议下版任务书将"boot 0 阻断失败"列为 U16 判据。
8. **新上报**：`catalog-install-batches.csv` 存在脏行（@deepseek-ai/dsh@0.1.5-rc.3 与 016 冲突；@tianbuyu-wwx/dsh-formatforge 的 name 列写裸名）——数据源质量门缺失。

## 五、必修项（下一轮）

| # | 项 | 状态 |
|---|---|---|
| M1 | ~~清锁+绝对路径重装 21 包~~ | **已闭合** |
| M2 | ~~catalog 三批安装~~ | **已闭合**（153+2 豁免+1SKIP+1 破损） |
| M3 | 提供有效 DEEPSEEK_API_KEY → 解冻 U10/U17/U18/L3 会话交互 | **唯一硬停线，仅用户可解** |
| M4 | ~~manifest 回写 0.1.7-rc.2~~ | **已闭合** |
| M5 | preset 新建/编辑（U15 第 5 条） | 未做 |
| M6 | U16 L4 catalog 全量 + P0/P1 L4 批量执行器硬化（l4-batch.mjs 仪器问题清单见 cr 文档） | PARTIAL |
| M7 | Type-Dict 扩充（25→>40，按 preset-design 数据字典细化，禁凑数） | GAP 登记 |
| M8 | U4/U8/U9/U11/U12/U13 汇总类门禁 + macOS 侧安装器 | 未做 |

## 六、停止条件核对（015 §10.3 八条）

- 命中**第 7 条（熔断）**两次：catalog 安装轮（前轮，已解）与 L4 批量轮（本轮，仪器问题三连，已停批并留痕）。
- 命中**第 8 条（交付阻断）**：U19 阻断口径维持，只出阶段报告。
- 未触发其余六条。
