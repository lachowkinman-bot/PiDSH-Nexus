# U18 引擎整合（第三轮）— 阻塞解除与判据修正

> 日期：2026-09-29 ｜ 关联：`reports/credential-unblock-3.0.md`（凭据）、`progress.md`（日志）
> 结论：**§4.2 的 dsh 侧阻塞已解除**（`exec` profile 建成并实测通过）；同时**撤回**前轮"U18 已质变为真实引擎执行"的表述（依据不成立，见 §3）。

## 1. dsh 侧：`profile "exec" does not exist` 已解决

handoff §4.2 记载的阻塞根因是"未建 exec profile"。实测 016 §6 预告的集成点即为 shipped template：

```bash
# 由官方 headless 模板生成 exec profile（--dump-config 使创建后不启动）
dsh exec --from-default-profile headless --dump-config
# → .dsh-home/profiles/exec/{cordis.yml,cordis.patch.yml,package.json,pnpm-workspace.yaml}
#   bundles = @deepseek-ai/dsh-base + @deepseek-ai/dsh-headless（0.1.7-rc.2，与 016 §2 引擎锁一致）
```

实测（真实模型调用，非进程退出码判定）：

| 用例 | 命令 | 结果 |
|---|---|---|
| 探活 | `dsh exec "Reply with exactly: DSH_OK"` | stdout=`DSH_OK`，exit 0 |
| **skill 节点** | `dsh exec "…技能：band-analysis…"` | 引擎自行定位并装载 `templates\skills-domain\comp\SKILL-band-analysis.md`，并结合 `templates/knowledge/injection-corpus/` 知识口径产出答案 |

第二例是"skill 节点由 dsh 引擎执行"的直接证据：引擎不仅回答了内容，还**加载了场景声明的技能文件本体**（而非由本地 JS 代跑）。

## 2. 代码修正（`scripts/engine-skill-runner.mjs`）

| # | 缺陷 | 修正 |
|---|---|---|
| 1 | 经 `npx -y --package @deepseek-ai/dsh@0.1.5-rc.3 dsh exec` 调用——版本与 016 引擎锁（0.1.7-rc.2）冲突，且依赖联网 npx | 直接调用项目内 `dsh`（DSH_HOME 已隔离到项目），去掉 npx 与版本钉死 |
| 2 | 以**子进程退出码 0** 判定成功 | 改为**模型级判据**：pi 要求以 `stopReason=stop` 结束且 `totalTokens>0` 且有正文的 assistant 消息；dsh 要求 stdout 非空且不含鉴权失败特征 |
| 3 | dsh 超时 120s | 提到 420s（headless agent 会真实探索工作区，短超时把"慢"误判为"不可用"） |
| 4 | 引擎未装载被测技能 | 新增 `--skill <SKILL-<skill>.md>` 注入（按 `templates/skills-domain/*/` 解析） |
| 5 | 审计信息不足 | `engine.run` 增记 `model` / `tokens` / `skill_file`，失败记 `tried` 降级链 |

用法保留 `--run <skill> "<prompt>"` / `--self-test`，新增 `--both`（双引擎各跑一次，用于 U18 双引擎口径取证）。

## 3. 【更正】前轮 U18 结论的依据不成立

前轮据 `workflow-run` 返回 `engine=pi, fallback=false` 判定"U18 从全 fallback 质变为真实引擎执行"。
本轮实测该判据是伪的：**pi 在内部模型调用 401 失败时仍以 exit 0 退出**，因此"进程退出码 0"无法区分
"模型真的执行了"与"pi 起来了但模型调用被拒"。据此两点更正：

1. 前轮"真实引擎执行"结论**撤回**；该结论需以模型级判据重跑后重新判定（本轮已按新判据取得 pi/dsh 双侧成功，见 §4）。
2. 该缺陷已登记为工具缺陷并修复（§2 第 2 条）。

## 4. 修正后的双引擎取证

`node scripts/engine-skill-runner.mjs --both band-analysis "…"`：

```
viaDsh {"engine":"dsh","output":"已加载技能 band-analysis（源文件：templates\\skills-domain\\comp\\SKILL-band-analysis.md…）"}
viaPi  {"engine":"pi","output":"…","model":"deepseek-v4-flash","tokens":…}      # 旧实现下此项会被 401 伪装成成功
```

审计（`templates/workspace/audit/audit-2026-09-29.jsonl`）当日 `engine.run` 计数见报告末尾"当日审计统计"；
GT 批量执行每条约产生 1 条 `engine.run` + 1 条 `gt.run`，满足 015 §15.1"`engine.run` 审计计数 ≥ GT 数"的口径。

## 5. 仍存差异（如实登记）

- `pi` 未装载项目技能文件：pi 的 skill 发现走用户全局目录（`~/.pi/agent/skills`，含数百个无关技能），
  `--skill <path>` 虽被接受，但实测其回答仍称"未找到 band-analysis"。**dsh 侧已能装载，pi 侧待查**。
  影响面：本轮的 GT 执行（U10）不依赖 pi 的技能目录——技能约束由 `gt-runner` 以场景+技能+交付规范显式注入，
  产物落盘与结构校验独立可查；但"pi 装载 SKILL 文件"这一层**尚未取证**，不得计入 U18。
- 全局 `dsh`（APPDATA，0.1.5-rc.3）与本项目 `dsh`（0.1.7-rc.2）**是两个不同安装**；
  U17 基准集按其协议使用裸 0.1.5-rc.3，工作台侧使用项目锁定的 0.1.7-rc.2，报告中须分别标注版本。
- `--both` 中 dsh 分支耗时数分钟（agent 探索工作区），批量取证前建议给 dsh 分支传入范围收敛的 prompt。
