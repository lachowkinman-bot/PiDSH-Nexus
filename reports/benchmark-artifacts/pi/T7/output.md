# 崩溃恢复方案：杀进程 → 续跑同一任务

**交付类型**：工程设计方案 + 可执行验收方案
**适用对象**：长时任务执行器（ETL、Agent 编排、批量通知/对账/发布、渲染与转码流水线）
**核心命题**：进程被 `kill -9` 之后，重启的执行器必须**接着同一个任务往下跑**，不从头再来、不重复产生副作用、不丢失已完成步骤。

---

## 1. 目标与非目标

| 项目 | 内容 |
|---|---|
| 目标 1 | 进程任意时刻被强杀（SIGKILL / OOM / 断电 / Pod 驱逐）后，任务可续跑 |
| 目标 2 | 续跑后对外部世界呈现 **恰好一次（effectively-once）** 效果 |
| 目标 3 | 续跑位置可解释：能从检查点回答"跑到哪一步、哪一步重试了几次、为什么" |
| 目标 4 | 无人工干预可自动续跑；高风险步骤需人工审批后才续跑（见第 11 节） |
| 非目标 | 不做跨机房双活；不保证亚秒级 RPO；不解决业务语义错误（只解决中断） |

---

## 2. 术语与不变量

- **task_id**：业务任务的永久标识。**续跑必须复用同一个 task_id**，这是"续跑同一任务"的定义。
- **run_id / attempt**：每次进程启动产生一个新 attempt（1, 2, 3…），便于审计，但**不改变 task_id**。
- **step**：任务的可检查点最小单元，有稳定 `step_key`（如 `fetch→transform→write→notify`）。
- **cursor**：步骤内部进度游标（分页 offset、已处理 ID 水位、批次号）。

**三条不变量（任何实现都必须成立）**

1. **I1 幂等**：任一 step 重放任意次，外部可见效果与执行一次相同。
2. **I2 先记录后动作**：副作用前先落 intent（意图）记录，action 已完成必须落 result；否则续跑会重做。
3. **I3 单调前进**：`completed_steps` 只能追加，不可回退；游标只能向前（除非显式补偿）。

---

## 3. 状态机

```
PENDING ──claim──▶ RUNNING ──完成──▶ SUCCEEDED
                      │  │
                      │  └─可重试失败─▶ RETRY_WAIT ──(退避到期)──▶ RUNNING(attempt+1)
                      │
                      ├─不可重试失败──▶ FAILED ──人工──▶ RUNNING
                      ├─需要审批────▶ SUSPENDED_APPROVAL ──审批通过──▶ RUNNING(attempt+1)
                      └─租约过期/进程消失─▶ ORPHANED ──自动续跑──▶ RUNNING(attempt+1)

任意状态 ──人工/策略──▶ ABORTED（终态，不再续跑）
```

关键点：**`ORPHANED` 是崩溃恢复的入口状态**。执行器启动时先做一次"孤儿回收"扫描，而不是等用户手动点续跑。

---

## 4. 检查点（Checkpoint）设计

### 4.1 写入时机

| 时机 | 必要性 | 说明 |
|---|---|---|
| 每个 step 开始前 | 必须 | 写 intent，标记 `RUNNING` |
| 每个 step 成功后 | 必须 | 与业务结果**同事务**写入，或写入 result 后立即提交 |
| 长步骤内部（每 N 条 / 每 T 秒） | 强烈建议 | 更新 cursor，避免重跑整批 |
| 外部副作用调用前后 | 必须 | 前写 intent+幂等键，后写 receipt（外部单号） |
| 收到 SIGTERM | 建议 | 优雅停机：停止领取新 step、把 cursor flush、置 `RETRY_WAIT` |

### 4.2 内容（最小充分集）

```json
{
  "task_id": "task_8f3c...",
  "schema_version": 3,
  "attempt": 4,
  "state": "RUNNING",
  "step_key": "write_orders",
  "cursor": {"offset": 12000, "watermark_id": "ord_99f2"},
  "input_fingerprint": "sha256:...",
  "code_version": "git:1a2b3c4",
  "env_fingerprint": "cfg:sha256:...",
  "retry_counts": {"write_orders": 2},
  "side_effects": [
    {"idem_key": "sha256:...", "target": "crm.create_ticket", "receipt": "TCK-771"}
  ],
  "updated_at": "2026-02-11T10:22:31Z"
}
```

### 4.3 不写什么（脱敏硬约束）

- ❌ 明文密码 / Token / 私钥 / API Key
- ❌ 明文手机号、身份证、银行卡、邮箱、地址、健康信息
- ✅ 只存**引用**（`secret://vault/xxx`、`obj://bucket/blob-key`）
- ✅ 确需存业务标识时按 §11 的脱敏规则处理（哈希 + 后四位）

### 4.4 原子性

- **单库**：`BEGIN; UPDATE business_result; UPDATE task_checkpoint; COMMIT;` — 业务结果与游标同一事务，杜绝"做了但没记"。
- **跨系统**：先写 `intent`（PENDING）→ 调外部 → 写 `receipt`（DONE）。续跑时见 PENDING 就**先查外部状态**（read-before-write），再决定重发或跳过。
- **不变量**：检查点写入必须幂等（`INSERT ... ON CONFLICT(task_id, step_key, attempt) DO NOTHING`），且**崩溃在一次半写中不得污染状态**（推荐 SQLite WAL / PG 事务 / 原子 rename 文件）。

---

## 5. 续跑（Resume）算法

```
resume(task_id):
  1. cp = load_checkpoint(task_id)              # 无则按新任务处理
  2. 校验 cp.schema_version 兼容、code_version 可续跑
     ├─ 不兼容 → 标记 NEEDS_MIGRATION，走 §11 审批，不自动续
  3. 校验 input_fingerprint 未变
     └─ 变了 → 视为新任务（新 task_id），不污染旧任务
  4. 校验租约：若存在存活孤儿（fencing token 更大）→ 让位，退出
  5. 对 cp.side_effects 中 state=PENDING 的项执行 reconcile
     └─ 查外部是否已生效：已生效补写 receipt；未生效则本次重做（带同一 idem_key）
  6. 定位续跑点：
     - 未完成 step → 从 step 起始重放
     - 已完成 step 内有 cursor → 从 cursor+1 继续
  7. 以 attempt+1 写 RUNNING，开始执行；每步边界回写检查点
```

**三种续跑粒度（按代价从低到高）**

| 粒度 | 条件 | 代价 |
|---|---|---|
| A. 步骤内游标续跑 | 步骤可随机访问/可排序（分页、按 ID 扫描） | 几乎为零 |
| B. 步骤起始重放 | 步骤幂等但不可部分重放 | 重跑该步全部 |
| C. 整任务重放 | 无检查点/检查点损坏 | 全量重跑（兜底，必须仍幂等） |

---

## 6. 幂等与去重

- **幂等键**：`idem_key = sha256(task_id ‖ step_key ‖ logical_unit_id)`。注意**不要混入 attempt**，否则重试等于新动作。
- **落地手段（任选叠加）**：
  1. 目标系统唯一约束 / Upsert
  2. 本地副作用账本 `side_effect_ledger(idem_key UNIQUE, state, receipt)`
  3. Read-before-write：先查再写（适合有查询接口的外部系统）
  4. 补偿事务（Saga）：失败时反向撤销，而非回滚数据库
- **禁止模式**：`for row in batch: send_mail(row)` 且无幂等键——续跑必然重复发信。

---

## 7. 租约 / 心跳 / 防脑裂

| 机制 | 参数建议 | 作用 |
|---|---|---|
| 心跳 | 每 5s 更新 `heartbeat_at` | 证明进程存活 |
| 租约 TTL | 30s（≈6 次心跳） | 超时即判定 ORPHANED |
| **fencing token** | 每次 claim 递增 `epoch` | 旧进程即使"诈尸"存活，其写入因 epoch 过小而**被存储层拒绝** |
| 单写者 | `task_id` 上唯一活跃 epoch | 防同一任务被两个执行器同时跑 |

> 没有 fencing token 的续跑方案，在网络分区下会出现"两个进程同时跑同一任务"，是重复副作用的最常见根因。

---

## 8. 可观测性

- **指标**：`task_resumed_total{reason}`、`orphan_recovered_total`、`step_retry_total{step_key}`、`duplicate_side_effect_blocked_total`（这个必须是 0，非 0 说明幂等生效但设计有漏）、`resume_to_cursor_lag_seconds`、`checkpoint_write_failures_total`。
- **日志**：每条以 `task_id` + `attempt` + `step_key` + `epoch` 为结构化字段；续跑时输出一行 `RESUME from step=X cursor=Y attempts=N`。
- **轨迹**：保留每次 attempt 的起止与终态，形成审计链（谁触发、何时、在哪个节点）。

---

## 9. 参考实现（SQLite + Python 最小可用）

### 9.1 表结构

```sql
CREATE TABLE task (
  task_id      TEXT PRIMARY KEY,
  state        TEXT NOT NULL,          -- PENDING/RUNNING/...
  attempt      INTEGER NOT NULL DEFAULT 0,
  epoch        INTEGER NOT NULL DEFAULT 0,
  heartbeat_at TEXT,
  lease_owner  TEXT,
  input_fp     TEXT
);

CREATE TABLE task_step (
  task_id   TEXT NOT NULL,
  step_key  TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  state     TEXT NOT NULL,             -- PENDING/RUNNING/DONE
  cursor    TEXT,                      -- JSON：分页/水位
  retries   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, step_key)
);

CREATE TABLE side_effect_ledger (
  idem_key  TEXT PRIMARY KEY,          -- sha256(task_id‖step_key‖unit)
  task_id   TEXT NOT NULL,
  state     TEXT NOT NULL,             -- PENDING/DONE
  receipt   TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE checkpoint (
  task_id  TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  code_version   TEXT,
  payload  BLOB,                        -- 已脱敏的 JSON
  updated_at TEXT
);
```

### 9.2 续跑骨架

```python
def run_task(task_id, owner):
    t = db.get_task(task_id)

    if t.state == "SUCCEEDED" or t.state == "ABORTED":
        return  # 终态不续跑

    # 1) 抢占：原子递增 epoch，旧的写入会被 fencing 拒绝
    epoch = db.claim(task_id, owner, expected_state=("PENDING","RUNNING","ORPHANED","RETRY_WAIT"))
    if epoch is None:
        return  # 有别的执行器活着（心跳未超时），让位

    # 2) 副作用对账：崩溃前 PENDING 的外部调用，先查真伪
    for se in db.pending_side_effects(task_id):
        if external.exists(se.idem_key):
            db.mark_done(se.idem_key, receipt=external.receipt_of(se.idem_key))
        else:
            db.mark_pending(se.idem_key)  # 允许本次重做（同一 idem_key）

    # 3) 从检查点继续
    cp = db.load_checkpoint(task_id)
    for step in steps_after(cp):
        with db.tx():                      # 业务结果 + 步骤状态同事务
            execute_step(step, cursor=cp.cursor_for(step))
            db.mark_step_done(task_id, step, cursor=None)
        db.save_checkpoint(task_id, step, cursor=None, epoch=epoch)

    db.set_state(task_id, "SUCCEEDED")


def reap_orphans():
    for t in db.running_but(heartbeat_older_than="30s"):
        db.set_state(t.task_id, "ORPHANED")
        run_task(t.task_id, owner=this_worker)  # 自动续跑同一 task_id
```

### 9.3 启动即恢复

```bash
# 容器/进程入口：先回收孤儿，再领新任务
python -m worker --reap-orphans --resume-on-boot
# 等价手动触发
python -m worker resume --task-id task_8f3c...
```

---

## 10. 验收集：杀进程测试矩阵

**方法**：在步骤边界与检查点写入窗口注入 `SIGKILL`，重启后核对"是否续跑同一任务、无重复、无丢失"。

```bash
# 在固定偏移杀进程（可复现）
python -m task_runner --task-id task_8f3c... &
PID=$!
sleep 7 && kill -9 $PID            # 覆盖：步骤中 / 检查点写入中 / 副作用后
python -m task_runner --resume-on-boot
```

| # | 注入点 | 期望结果 |
|---|---|---|
| T1 | step 开始时，intent 已写未执行 | 重启后从该 step 起点重跑，无副作用 |
| T2 | 检查点事务提交**前一瞬** | 事务回滚，回到上一检查点，重跑该边界 |
| T3 | 检查点提交后、下一 step 前 | 精确续跑下一 step |
| T4 | 长步骤中段（cursor 已推进） | 从 cursor+1 继续，不重跑已处理数据 |
| T5 | 外部副作用**发出后、receipt 落库前** | 对账发现已生效 → 补写 receipt，**不重复发送** |
| T6 | 外部副作用**发出前** | 重做一次，同一 idem_key，外部仅一次 |
| T7 | 杀死后立刻启动第二个实例（脑裂） | 旧 epoch 写入被拒，单写者成立 |
| T8 | 连续杀死 N 次（1,2,3,5,10） | 最终收敛 SUCCEEDED，副作用总数 == 期望值 |
| T9 | 检查点文件半写/损坏 | 回退上一可用检查点或整任务重放，仍幂等 |
| T10 | 杀进程前输入被篡改 | `input_fingerprint` 不符 → 不续跑旧任务，走审批 |

**通过判据（全部满足才算达标）**

- [ ] `task_id` 全程不变，attempt 单调递增
- [ ] 外部副作用计数 == 期望值（**零重复、零丢失**）
- [ ] `SUCCEEDED` 且业务终态一致（对账脚本比对源/目标行数与金额）
- [ ] 日志存在 `RESUME from step=... cursor=...` 轨迹
- [ ] `duplicate_side_effect_blocked_total` 未因真实重复而暴涨

---

## 11. 审批与脱敏说明（明确）

### 11.1 必须审批才能续跑的步骤

自动续跑**仅允许**幂等的读取类/可回滚类/可补偿类步骤。以下步骤续跑前**生成审批单**，人工确认后放行：

| 步骤类型 | 续跑策略 |
|---|---|
| 对外付款、退款、发薪 | **禁止自动续跑**，必须财务审批；先对账确认是否已出账 |
| 对外发通知（邮件/短信/群公告/客户触达） | 需审批，避免重复触达；审批单附"已发送清单" |
| 生产发布 / 删除 / 权限变更 / 数据订正 | 需 Owner + 变更审批（对应变更单号回填检查点） |
| 数据跨域外发、上报监管 | 需合规审批 |
| 只是读、可 Upsert 的普通写 | 自动续跑，无需审批 |

**审批单必含**：`task_id`、`attempt`、续跑起点 step、已发生副作用清单（含外部单号）、重放风险评估、回退方案。审批通过后写入 `checkpoint.approval_id` 才允许继续。

### 11.2 脱敏规则（检查点、日志、轨迹一致适用）

| 数据 | 处理 |
|---|---|
| 手机号 / 邮箱 / 身份证 / 银行卡 | 掩码：保留前 1–3 位与后 2–4 位，中间 `*`；或不可逆哈希 + salt |
| 姓名 | 姓氏保留 + `*`（如 张**） |
| Token / 密码 / 密钥 | 完全不落检查点，仅存 `secret://` 引用 |
| 自由文本备注、地址、健康信息 | 不落库；需要时存对象存储引用 + 权限控制 |
| 审计需要 | 保留 `idem_key` 哈希与外部单号（非敏感），保证可追溯 |

**原则**：检查点是"控制面数据"，不是"数据面副本"。**数据库里已经有的业务明细，不复制进检查点**，只存游标与引用。检查点文件落盘需加密（at-rest），并设保留期（建议 30 天）与访问审计。

---

## 12. 运行手册（Runbook）

```bash
# 1) 发现被杀死未收尾的任务
python -m worker list --state ORPHANED,RUNNING --stale 30s

# 2) 查看它跑到哪
python -m worker inspect --task-id task_8f3c...
#   state=RUNNING attempt=3 step=write_orders cursor={offset:12000}
#   side_effects: [ {crm.create_ticket, PENDING, idem=ab12…} ]

# 3) 普通步骤：直接续跑
python -m worker resume --task-id task_8f3c...

# 4) 高风险步骤：先提审批，拿到 approval_id 后
python -m worker resume --task-id task_8f3c... --approval-id APPR-2026-0211-77

# 5) 确实不能续跑时，显式终止（避免无限重试）
python -m worker abort --task-id task_8f3c... --reason "上游数据口径变更"
```

**升级路径**：自动续跑失败 3 次 → 告警到值班；涉资金/对外 → 直接冻结任务并通知业务 Owner。

---

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| 外部系统不支持幂等键 | read-before-write + 本地账本 + 人工对账窗口 |
| 检查点与业务数据跨库不一致 | 同事务（首选）；不可行时用 intent/result 两段式 + 对账任务 |
| 旧进度、新代码语义不兼容 | 检查点带 `schema_version`/`code_version`，不兼容走审批迁移，不盲目续跑 |
| 无限重试风暴 | 指数退避 + 上限 + 熔断 + 死信队列 |
| 脑裂重复执行 | lease + fencing token 强制单写者 |
| 检查点泄露敏感数据 | §11.2 脱敏规则 + 落盘加密 + 保留期 |

---

## 14. 验收结论模板（可勾选）

- [ ] 任意时刻 `kill -9` 后重启，**同一 `task_id`** 自动续跑（T1–T4 通过）
- [ ] 副作用恰好一次，对账差异为 0（T5–T6、T8 通过）
- [ ] 脑裂场景单写者成立（T7 通过）
- [ ] 检查点损坏可回退且仍幂等（T9 通过）
- [ ] 输入变更不污染旧任务，走审批（T10 通过）
- [ ] 检查点与日志无明文敏感信息（脱敏抽检通过）
- [ ] 高风险步骤续跑有审批单与审批 ID 留痕

> 达标线：T1–T10 全绿，且 `duplicate_side_effect_blocked_total` 未出现真实重复。任一红灯即视为"能重启但不算可靠续跑"。

---

**一句话总结**：崩溃恢复的本质不是"重启进程"，而是 **同一 `task_id` + 检查点 + 幂等副作用账本 + 租约防脑裂** 四件套；缺任何一件，都会退化为"要么从头再来，要么重复执行"。
