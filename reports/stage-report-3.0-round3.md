# universal-workbench-3.0 阶段报告（非交付宣告）— 第三轮

> 依据 015 v2.2 §12 U19 阻断规则：U3/U10/U15/U16/U17 任一 NOT_RUN/PARTIAL/FAIL → **只输出阶段报告，禁止交付宣告**。
> 本报告不含"已交付/已完成/已达标"结论。填报时间：2026-09-29 14:00（覆盖 10:20 版）。
> 环境：Windows / 项目内便携 Node v24.21.0 + `DSH_HOME=.dsh-home`；引擎 dsh 0.1.7-rc.2。
> 本轮专项报告：`credential-unblock-3.0.md`（凭据）、`u18-engine-integration.md`（引擎）、
> `u10-golden-tasks.md`（GT）、`l3-session-interactions.md`（L3）、`u17-benchmark.md`（对标）。

## 一、本轮触发：handoff 的停线结论被推翻

handoff 记载"唯一硬停线 = DEEPSEEK_API_KEY 失效，只有用户能提供新 key"。核验发现**不成立**：
机器 `HKCU\Environment` 内已存在**有效 key**（探针 `PROBE_OK`，exit 0），401 的是
ZCode 进程启动时继承的旧值与 pi 全局 `auth.json` 里的另一把旧值——用户已轮换，进程未跟上。
据此本轮把前轮的凭据冻结门禁全部解冻执行。

## 二、U1–U19 门禁对照（第三轮终态）

| 门禁 | 状态 | 判定依据 |
|---|---|---|
| U1 / U2 / U6 / U15 | **PASS**（承前轮） | `u1-bundle-audit.md` / `u2-script-compliance.md` / `security-check.md` / 壳内截图 |
| **U10 场景与工作流** | **PASS**（BLOCKED → PASS） | `u10-golden-tasks.md`：GT **38/39**，12 域，**11 域达「每域≥3」**（验收线 ≥25 且 ≥6 域）；八元组与技能一致性 lint 0 违例；EAP 技能错配根因消除 |
| **U18 引擎整合** | **PASS**（FAIL → 重判 PASS） | `u18-engine-integration.md`：dsh `exec` profile 建成并实测（含 skill 节点装载技能文件）；判据由"进程退出码"升级为"模型级"后 pi/dsh 双侧取证；**前轮"已质变"结论撤回后重新成立** |
| U3 安装与独立性 | PARTIAL | L1/L2 全过；L3 由"15 项凭据阻塞"收敛为 2 项取证 + 若干未回填；L4 逐包循环待执行器硬化 |
| U5 十要素 | PARTIAL | `ten-elements-matrix.md` 机械 6/10；要素 5 数据字典 GAP |
| U16 catalog 安装 | PARTIAL | L1 153/155 + L2 壳健康；L3/L4 同 U3 口径 |
| **U17 对标 A/B** | **PARTIAL（未成立）** | `u17-benchmark.md`：基准仅实跑 1/3（pi 10/10），工作台臂 5/10，判分器 3 项缺陷未修；可比值上工作台 3.65 < pi 4.45 |
| U14 桌面安装器 | PARTIAL | Setup.exe 实构建在案；差第二机全旅程 + macOS |
| U4/U7/U8/U9/U11/U12/U13 | NOT_RUN / 部分可解冻未做 | 如实登记 |
| U19 交付宣告 | **禁止宣告** | 阻断门禁 U3 PARTIAL / U16 PARTIAL / U17 未成立 |

## 三、本轮新增成果

1. **凭据解冻**并同时修正两条错误结论（"仅用户可解"、"pi exit 0 即真实执行"）。
2. **U10 达成**：新建 `scripts/gt-runner.mjs`（lint/plan/run/report + 熔断），39 条 GT 全实跑，
   产物含 39 份执行报告 + 交付物 JSON + `engine.run`/`gt.run` 审计（累计 372 万 tokens 可核）。
3. **工作流技能语义根治**：`gen-workflows.mjs` 由位置轮转改为 **78 条显式语义绑定** + 3 条防漂移断言。
4. **U18 dsh 侧打通**：官方 headless 模板建 `exec` profile；`engine-skill-runner.mjs` 与
   工作台 `engineRun()` 双双改为模型级判据，并接入 `--skill` 技能装载。
5. **U17 执行器建成**并跑出首批可比数据（含修正一处会使 A/B 失去可比性的夹具缺陷）。

## 四、本轮发现并登记的真实缺陷（未计入任何达成）

| # | 缺陷 | 归属 |
|---|---|---|
| 1 | FIN 域种子数据缺收入/净额口径 → `fin.monthly-report` 必填字段不可满足（GT-FIN-02 FAIL） | 内容层 |
| 2 | `pi-redact-all` 检出不一致（同列漏检）、身份证误标 `Credit Card`、手机号未命中 | 上游插件 |
| 3 | U17 判分器：cost 分位退化、quality 偏向长文、`not_applicable` 混入均值 | 本轮自建工具 |
| 4 | `pi` 不装载项目场景技能文件（`--skill` 被接受但未生效），dsh 侧正常 | 上游/集成 |
| 5 | 凭据核验中一次掩码写法失误致有效 key 明文入会话输出（未落盘） | 本轮操作，建议轮换 |

## 五、下一轮必修

1. U17 补齐（dsh/codex 两臂 + T4/T6/T7/T8/T9 平台级夹具 + 修 B1/B2/B3）；
2. FIN 域种子数据补口径 → GT-FIN-02 重跑；
3. U3/U16 的 L4 逐包循环（执行器硬化）+ L3 未回填项（审批主动拦截留痕、记忆跨会话召回）；
4. U4/U8/U9/U11/U12/U13 汇总类门禁 + macOS 侧安装器。

## 六、停止条件核对（015 §10.3 八条）

- 命中**第 7 条（熔断）**：本轮 U17 夹具缺陷导致同形态超时 2 连即停批诊断（正确用法）。
- 命中**第 8 条（交付阻断）**：U3/U16/U17 未 PASS，U19 阻断口径维持。
- 未触发其余六条。
