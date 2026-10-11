# Stage 2 Feature Report

## 1. 纳入 4.0 的功能模块

| 模块 | 4.0 实现 | 依赖 | 验收 |
|---|---|---|---|
| 离线初始化 | `4.0-init.ps1` + 隔离数据根 | runtime-pack | `reports/4.0/init.json` |
| 运行验证 | `4.0-verify.ps1` + 现有 verify 脚本 | runtime/source | `reports/4.0/verify.json` |
| 模型适配 | `tools/model-adapter/` | 用户配置 | `model-capability.json` |
| 模型探测 | CLI probe | adapter | L0/L1/L2 结果 |
| 插件选择 | selection profile + lock | support-source | `selection.lock` |
| 发布打包 | `4.0-pack.ps1` | 四层资源 | `releases/4.0.x/BOM.json` |
| 跨机恢复 | `4.0-restore.ps1` | BOM | `restore.json` |
| 安全扫描 | `4.0-scan-secrets.mjs` | source/config/agent | `security-scan.json` |
| 输入清点 | manifest generator | 原始包/3.0/support | `input-bom.json` |
| Agent 工作流 | `agent-pack/` + `agent-task-pack.md` | source | 任务 JSON 证据 |

## 2. 改进点

| 改进 | 过程证据 | 影响层 |
|---|---|---|
| 模型适配层替代硬编码 provider | ADR-0001、engine runner | 架构/功能 |
| 数据根与程序目录分离 | ADR-0012、desktop-acceptance | 架构/资源 |
| support 源材料独立且按需选择 | 3.0 profile 故障记录 | 资源/功能 |
| JSON 门禁替代文档绿灯 | ADR-0009、假通过记录 | 架构/流程 |
| 原始会话库只保留派生索引 | 凭据风险和体积 | 资源/安全 |

## 3. 资源状态

| 组件 | 状态 | 说明 |
|---|---|---|
| app.html | 保留 | 已验证 UI |
| manifests/domain-model | 保留 | 域模型真相源 |
| templates/skills-domain | 保留 | 模型技能输入 |
| templates/workspace | 改为 seed | 与用户数据分离 |
| offline/offline-3.0 | 保留到 runtime-pack | 离线运行 |
| offline catalog | 保留 | 可选包安装源 |
| Pi_DSH_support | 新增独立压缩层 | 全量离线源材料，按选择提取，不默认安装 |
| ZCode SQLite | 不纳入 | 只保留派生索引 |
| 开发机全局 profile | 不纳入 | 目标机重建 |

## 4. 必须阻断

- 模型需要 L2 但只有文本输出。
- 插件有未解决 peer 冲突。
- 数据根位于源码目录。
- 包内出现真实密钥或 PII。
- stable 缺少 Windows 10 或 Windows 11 完整证据。
