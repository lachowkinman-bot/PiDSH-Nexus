# Code Review Checklist（015 §9.3，唯一源）

> 用法：每个 U 门禁的每个产出物附 `reports/cr-<artifact>.md`，按下表逐项勾选（[x]/[ ]），记录发现的问题与修复。缺 CR 记录的门禁不视为通过；U8 汇总校验 CR 覆盖率 = 100%。

## A. 下载/脚本类

- [ ] PowerShell native 命令成败仅用 `$LASTEXITCODE` 判定（无 try/catch 判定，013 P0-2）
- [ ] bash native 命令用退出码 `if cmd; then`（不用输出猜测替代退出码）
- [ ] 哈希三级回退 shasum→sha256sum→openssl；单包哈希为空=失败（014 P0-4）
- [ ] 下载 URL 仅 http/https；host 在白名单内；拒绝 localhost/回环/私有/保留地址
- [ ] 重试 ≥3 次；失败登记 `reports/capability-gap.md`（五列表），不中断流水线、不标成功
- [ ] 脚本幂等（重复运行结果一致）；resolved CSV 每次回写（D09 闭合）

## B. 安装/配置类

- [ ] DSH 版本断言 ≥0.1.2（CVE-2026-82533）；Web UI 仅绑 127.0.0.1
- [ ] 三路分流安装正确（npm tarball / github-source 构建 / workspace-template 复制）
- [ ] 每包独立性验证：禁用→确认不影响→启用→恢复
- [ ] 未启用包写入 reports/disabled-packages.md（不得静默丢弃）

## C. 权限/安全类

- [ ] 所有工具调用经 Permission Gateway（ALLOW/DENY/APPROVAL_REQUIRED）
- [ ] 安全单调性：Preset 只收紧（min_level 只增大 / redact.fields 只增广 / pii_allowed 只为 false）
- [ ] redact_gate 命中日志存在且作用于审计层（非仅聊天层）
- [ ] EAP 域：禁联网 + memory.exclude=[graph-memory, pi-hermes-memory] + 双审批 + 独立命名空间
- [ ] 无明文密钥入任何文件/Git（密钥只写获取方式）

## D. 工作流/场景类

- [ ] Scene/Workflow YAML 过 Schema lint（0 违例）
- [ ] hitl_nodes 与 rollback 必填；audit 节点必备
- [ ] condition 的 then 分支不绕过审批直连外部写能力
- [ ] GT 八元组齐全；分批验收（≥25 PASS / ≥6 域 / 每域 ≥3）

## E. 文档类

- [ ] 单一引用源：速查卡/故障码表/提示词/Runner 矩阵全文档集只出现一次（C7）
- [ ] 未复制包清单表格（C8）；引用数据附出处或"内部实测+复现命令"（V8）
- [ ] 章节号目录与正文一致（D16）；无计数矛盾（D01）；无幽灵依赖（D02）
- [ ] 与实物一致：文档声称的每个命令都实跑过（U11）

---

**CR 记录模板**（复制到 reports/cr-<artifact>.md）：

```
# CR · <artifact>
- 审查人：Agent（自助）｜ 日期：<ISO>
- Checklist 结果：A__x/6 B__x/4 C__x/5 D__x/4 E__x/4
- 发现问题：
  1. <问题描述 → 修复 → 复验结果>
- 结论：PASS / FAIL（FAIL 项必须在修复后复验为 PASS 才能闭合所属门禁）
```
