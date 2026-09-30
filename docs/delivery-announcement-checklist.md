# 交付宣告一致性检查单（015 v2.2 U19，交付阻断门禁）

> 宣告交付前逐项填写；每句宣告必须对应一条证据路径；U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → **只能输出阶段报告**。语义升级（§14.6 14 条禁令）=V1。

**本次填报：2026-09-29 09:50 ｜ 结论：禁止交付宣告，只出阶段报告（第二轮填报，覆盖 2026-09-28 18:50 版）**

## A. 逐项宣告核对（宣告句 → 证据 → 一致性）

| # | 计划宣告的句子 | 证据路径 | 证据是否支持该措辞（逐字） |
|---|---|---|---|
| 1 | "179 包已安装" | reports/install-probe.json（三源）+ catalog-install-log.csv | △ **部分**：P0/P1 **24/24 INSTALLED**（三源交叉）；catalog 153 exit0 + 2 豁免装成 + 1 SKIP(引擎锁) + 1 上游破损 → 只可宣告"24/24 + catalog 153/155 可装、141 装入 profile"，不得宣告"179 全装" |
| 2 | "逐包完整可用" | reports/pkg-func-smoke.md | ☒ **否**：L1 全过、L2 壳健康装载，L3 会话交互项凭据阻塞（401）、L4 仅 P0/P1 全量（catalog 未全量）→ 只可宣告"四级 DoD 分级达成，交互级证据受凭据阻塞" |
| 3 | "12 域工作界面可用" | domain-ui-checklist.csv + reports/ui-walkthrough/ | ☑ **是（13 域）**：前轮 25 张壳内截图 + 本轮 u16-l3-workbench-panel-clean.png（全目录安装下复确认 13 域卡与 preset 条） |
| 4 | "preset 可选/用/存/切" | 审计 preset.apply/save/switch + saved-*.json | ☑ **是**：preset.apply=4、save=3、switch=2 + saved-fin.expense-approve@1.0.0-*.json（前轮证据仍有效，工作台面板本轮截图复确认） |
| 5 | "工作流经 pi/dsh 引擎执行" | engine.run 审计 + `reports/u18-engine-integration.md` | ☑ **是（但前轮表述已更正）**：pi 与 dsh 双侧均按**模型级判据**（stopReason=stop 且 totalTokens>0）实跑成功；dsh 侧经 headless `exec` profile 并装载了场景技能文件。**前轮"engine=pi fallback=false 即真实执行"的结论已撤回**（pi 内部 401 时同样 exit 0，判据是伪的） |
| 6 | "安全已检查" | reports/security-check.md + security-scan/scan-summary.json | ☑ **是**：OSV 179 包 0 漏洞（scanned_at=2026-09-28T23:47:54Z，交付窗口内重跑）+ CVE 断言 + 生命周期盘点 + 127.0.0.1 绑定实测；redact 命中已于本轮补证（`reports/l3-session-interactions.md`：原值被替换为 `[REDACTED:…]`，模型侧可见） |
| 7 | "GT 与 scene 声明技能一致" | `reports/u10-golden-tasks.md` + `reports/gt-lint.csv` + `reports/gt-skill-consistency.csv` | ☑ **是**：八元组 lint 0 违例；技能一致性 0 违例（EAP 强制 eap-referral 断言通过）；GT PASS **38/39**，覆盖 12 域、11 域达「每域≥3」 |
| 8 | "达到基准 agent 交付质量" | `reports/u17-benchmark.md` | ☒ **否**：基准仅实跑 1/3（pi），工作台臂覆盖 5/10 任务，判分器 3 项缺陷未修；可比值上工作台均分 3.65 < pi 4.45 → **未达标** |
| 9 | "桌面安装包可交付" | installer-output/ 实构建产物 + `reports/desktop-acceptance.md` | △ **仍非全绿**：R6 已重建 Setup.exe（336,101,645 B / SHA256 `cc624824…`）并**本机实装实测**：装后 25/25 包 exit 0、桌面快捷方式字面启动 → 桌面窗口 → `/app-page` 200、非提权写入落盘、`verify-app 41/41`；**仍差**：第二台干净机全旅程（无第二机）、macOS 侧（无环境）、严格离线（引擎 81 个 registry 依赖，冷缓存断网未测，见 `reports/desktop-acceptance.md` §6.1） |
| 10 | "数据为真实脱敏数据" | data-consistency.csv 零 issue | ☒ **否**：仍为合成冷启动数据；且本轮发现 FIN 域种子数据缺收入/净额口径，直接导致 GT-FIN-02 必填字段不可满足（`reports/u10-golden-tasks.md` §5） |

## B. 语义升级自查（§14.6 十四条禁令逐条过）

自查结果（逐条，本轮新增证据全部按字面语义闭合）：
1. lint=装载 —— 未使用 ✅
2. 装载行=可用 —— **已规避**：74 条装载行仅记"装入+壳健康"；可用性分级见 pkg-func-smoke.md（L3 交互单独标注）✅
3. 哈希=已安装 —— **已规避**：U1 复跑 PASS 后仍以三源探测判定（install-probe.json 24/24）✅
4. HTTP=可达即交付 —— 未使用 ✅
5. md 报告=UI 呈现 —— **已规避**：本轮新增 8 张壳内实操作截图（u16-l3-*.png）✅
6. 覆盖表=对标 —— 未使用 ✅
7. 文件计数=能力 —— 未使用 ✅
8. frontmatter=技能装载 —— 未使用 ✅
9. 路由=接通 —— **已规避**：工作台 API 以 curl 200 + 界面操作双证 ✅
10. 渲染=界面 —— **已规避**：截图含 dsh 壳元素 ✅
11. 空依赖 audit=安全 —— **已规避**：OSV 全量 0 漏洞为主判据，audit 缺口如实说明 ✅
12. NOT_RUN=合规 —— **已规避**：U10/U17 BLOCKED、U16 L3/L4 分级如实、未计"完成" ✅
13. 探测代码=探测可信 —— **已规避**：install-probe/l4-independence 均为实跑产物（两次仪器误差轮次归档为 attempt1-2 *.bak，未混入终态）✅
14. 本地 JS=引擎整合 —— **已规避**：U18 维持 FAIL，未计为引擎执行 ✅

**B 项：零违例（14/14 未使用或已规避）**

## C. 判定

- A 项：☑×4（第 3/5/6/7）、△×1（第 9）、☒×4（第 2/8/10，及第 1 的"179 全装"×）、第 1 项维持 △ → **仍不达标**
- 阻断门禁：U3=PARTIAL、**U10=PASS（第三轮）**、U16=PARTIAL、U17=PARTIAL（未成立）、**U18=PASS（第三轮重判）** → **仍触发 §10.3 第 8 条交付阻断**
- **判定：禁止交付宣告；只输出阶段报告**。宣告文案不得包含"交付/完成/达标"字样。
- 停线根因变更说明：
  1. 原"唯一停线根因 = DEEPSEEK_API_KEY 失效"**已解除且该结论本身不成立**（机器上存在有效 key，前轮 401 系进程继承了旧值）——见 `reports/credential-unblock-3.0.md`；
  2. 解除后 U10 与 U18 均已达成（见上表第 5/7 项及对应报告）；
  3. **剩余阻断来源**：U3/U16 的 L4 逐包循环与 L3 未回填项、**U17 未成立（基准仅 1/3、工作台臂 5/10、判分器 3 缺陷）**。
- 本轮新增须登记项（不得计入达成）：`pi-redact-all` 脱敏漏检 3 项（R1/R2/R3）、FIN 域种子数据缺收入口径、U17 判分器缺陷 B1/B2/B3。
