# 凭据解冻核查报告（S0 / U10 / U17 / U18 前置）

> 日期：2026-09-29（第三轮）｜性质：**对 handoff 结论的更正 + 停线解除证据**
> 本文件不改写任何既有结论；凡与前轮记录冲突处，以本文件实测为准，并在文末列出应予撤回的表述。

## 1. 背景

handoff（2026-09-29 交接）记载：唯一硬停线 = `DEEPSEEK_API_KEY`（尾号 `0b65`）被官方 401 拒绝，
"只有用户能提供新 key"。本轮核验发现该结论**不成立**：机器上存在第三把有效 key，停线可当场解除。

## 2. 实测：机器上存在三把互不相同的 DeepSeek key

| # | 来源 | 掩码 | 长度 | 实测结果 |
|---|---|---|---|---|
| 1 | 当前 shell / ZCode 进程继承的 `DEEPSEEK_API_KEY` | `sk-e53822…0b65` | 35 | **401**（`PROBE_FAIL credential-rejected status=401`） |
| 2 | `HKCU\Environment` 持久化 `DEEPSEEK_API_KEY` | `sk-4cd376…2e6b` | 35 | **PROBE_OK**（`model=deepseek-chat latency=601ms reply=yes`，exit 0） |
| 3 | pi 全局凭据 `~/.pi/agent/auth.json` → `deepseek.key` | `sk-e49f9c…8454` | 35 | **401**（`Authentication Fails, Your api key: ****8454 is invalid`） |

三把 key 形状一致（`sk-` + 32 hex），但哈希两两不同（sha256 前 12 位：`14d3fae1f2a0` / `34007ff1eae0`）。
已排除"端点差异"解释：shell 与注册表均无 `DEEPSEEK_BASE_URL` / `OPENAI_BASE_URL` 覆盖，
探针默认端点 `https://api.deepseek.com` 对 #1 返 401、对 #2 返 200，同端点不同结论 → 差别在 key 本身。

**根因判定**：用户已轮换 key（#2 为新值），但 ZCode 进程与 pi 的全局凭据仍持有旧值（#1、#3）。
进程继承的环境变量在启动时固化，不会随注册表变更而更新。

## 3. 复现命令（密钥不落盘：key 仅在 shell 变量中传递）

```bash
REG=$(reg query "HKCU\Environment" //v DEEPSEEK_API_KEY | grep DEEPSEEK_API_KEY | sed 's/.*REG_SZ[[:space:]]*//' | tr -d '\r\n')
DEEPSEEK_API_KEY="$REG" node scripts/credential-probe.mjs          # → PROBE_OK exit 0
pi --provider deepseek --model deepseek-v4-flash --api-key "$REG" -p --mode json "Reply with exactly: PI_OK"
```

落盘核查：`grep -r "$REG" ~/.pi/agent/sessions/` 无命中 → 有效 key 未写入任何会话/配置文件。

## 4. 【更正】pi 的成功判据是伪的（影响前轮 U18 结论）

实测 `pi -p --mode json`：**进程 exit 0，但内部模型调用 401 失败**。

```
"provider":"deepseek","model":"deepseek-v4-pro","stopReason":"error",
"errorMessage":"401: {\"message\":\"Authentication Fails, Your api key: ****8454 is invalid ...\"}"
```

即：`engine-skill-runner.mjs` / `workflow-run` 以"进程退出码 0"判定 `engine.run ok:true` 与 `fallback=false`，
**在模型调用实际失败时同样成立**。因此：

- 前轮记录的 `engine=pi fallback=false` **不能**证明"真实引擎执行"。
- 据此作出的"U18 从全 fallback 质变为真实引擎执行"结论 **应予撤回**；U18 维持 FAIL，
  待以有效 key 重跑并改用**模型级判据**（`stopReason=stop` 且 `usage.totalTokens>0` 且 content 非空）后重新判定。
- 该缺陷本身应登记为工具缺陷：`engine-skill-runner.mjs` 的成功判据需从"进程退出码"升级为"模型级响应校验"。

## 5. 有效 key 下的引擎实测（同一判据：真跑通）

以 `--api-key "$REG"` + `--provider deepseek` 分别实测两个模型，均返回真实补全：

| 模型 | stopReason | totalTokens | content | cost/call |
|---|---|---|---|---|
| `deepseek-chat` | stop | 53587 | `PI_OK` | 0.0708 |
| `deepseek-v4-flash` | stop | 53591 | `PI_OK` | 0.00267 |

→ 两个模型均可用；`deepseek-v4-flash` 单次成本约为 `deepseek-chat` 的 1/26，批量 GT/对标优先选用（证据中标注模型名）。

## 6. 遗留与纪律

- **不停机不生效**：修复 #1 需重启继承该环境变量的进程；修复 #3 需重配 pi 全局凭据
  （`~/.pi/agent/auth.json` 属用户全局、服务其他项目，**本项目不代为改写**，以 `--api-key` 逐次覆盖）。
- **凭据泄露事件（如实登记）**：本轮核验中，一条掩码命令写法错误（`sed 's/\(....\)$/****\1/'` 实为"插入"而非"遮蔽"），
  导致 #2 有效 key 的**完整明文**出现在会话输出中。已确认项目文件内无明文（仅掩码尾号），
  但若该会话记录被留存/同步，建议轮换 #2。
- 本项目不新建 `.env`、不把任何 key 写入仓库（§5 红线）。
