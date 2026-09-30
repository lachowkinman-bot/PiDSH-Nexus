# R12 全能力验收与 13 域工作闭环 V2

## 结论

- 13 域设计真源：`21/21 PASS`。
- 平台回归：`19/19 PASS`，78/78 正常路径。
- 工作流 V2 矩阵：`549/549 PASS`，覆盖 78 条工作流 × 7 类业务/失败路径，加 3 项审批完整性测试。
- 工作流文件矩阵：`546/546 PASS`，78 条工作流各生成 Markdown、CSV、HTML、XLSX、DOCX、PPTX、PDF。
- 工作台 UI：`10/10 PASS`，含阶段契约、业务规则、7 个域页签、双审批和 `1100×700`。
- 真实安装态主壳：`102/102 PASS`，11 模块、1765 个可见控件、未知控件 0。
- 真实安装态应用矩阵：`45/45 PASS`。
- 运行时能力矩阵：无 `FAIL`；本地加载与 Skill 旅程通过，外部依赖按配置状态阻塞。

## 13 域 V2

- 13 域、39 工作模块、78 工作事项、78 个稳定顶层工作流 ID。
- 1444 条业务规则，区分硬不变量和待业务确认的可配置阈值。
- 737 个术语/字段 TypeDict 映射、1487 条血缘边、7 个跨域事件。
- 546 个工作流测试场景清单。
- 每条工作流包含阶段级输入/输出契约、负责人、进入条件、证据、门禁、失败处理、超时、重试和幂等键。
- 22 个外部标准/优秀实践均记录到工作流、规则或运行时范围，不允许悬空 URL。

## 运行时能力

- 出厂插件：64 个，其中 59 个加载、5 个按策略不加载；未知或重复插件条目为 0。
- 项目 Skill：56 个，其中 43 个业务 Skill、13 个意图路由；业务 Skill 均通过模型桩工作流旅程。
- 记忆控制面：Runtime、Documents、Memory Spaces 已加载。
- 记忆 provider：9 个均有明确终态。Holographic 本地 hook 通过；Native、OpenViking、Honcho、Mem0、Hindsight、RetainDB、ByteRover、Supermemory 因缺少 CLI、服务或凭据记为 `BLOCKED_EXTERNAL`，未伪造成功。

## 审批与安全

- 审批改为本地操作者注册表 + 角色授权 + HMAC-SHA256。
- 签名绑定 workflow、instance、revision、数据版本、草稿哈希、操作者、角色、决定、意见和时间。
- 篡改审批记录、跨实例重放、同人多角色、未授权角色均被阻断。
- R11 无签名旧审批首次启动时先备份 `instances`，再迁移为 `legacy_approvals` 并要求重新签名。
- 审批密钥排除在普通交付物、日志和 workspace 备份之外。

## 升级验收

- 最终 runtime：`546,182,470 B`，SHA256 `3EB979DDB7EECDB1E60C8A28EA4DE4F3B7BBFEE52FD9B5F105C78E1DD303E452`。
- 最终安装器：`589,954,910 B`，SHA256 `4DBDCA8509B2D2D5FB7CF840320266093CB6C7E6887BDE0209F270BB15BF8E4A`。
- 最终 build-id：`aed9980c6f70777d4613a6e753118bcc1fdf423e95b3f9cad1f644b02c687b4e`。
- 原地升级保留：sessions、storages、credential 文件哈希、session 哨兵、workspace 哨兵、审批密钥、操作者注册表和既有实例均保留。

## 条件项与未完成

- 未提供真实 DeepSeek/LLM 凭据，因此模型桩只能证明流程、契约、审批、交付和恢复，不能证明真实模型质量。
- 三方记忆 provider、GitHub、Sentry、SonarQube、Lark、MCP 等未配置服务只验证了显式阻塞和安全降级，未完成真实云端联调。
- T1 左上角 `deepseek HARNESS` 字标继续暂停，未修改。
- `app.html` 仍是辅助入口，壳内 `⟡ 工作台` 是唯一完整业务工作面。
