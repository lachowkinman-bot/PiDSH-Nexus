# Stage 1 Architecture Report

> 结论：3.0 的核心架构可复用，但跨机复用必须新增四层包、隔离数据根、模型适配层、插件选择锁和 clean VM 门禁。

## A. 基础模块对比

| 模块 | 3.0 实现 | 4.0 决策 | 原因 | 证据 |
|---|---|---|---|---|
| 运行底座 | pi + dsh + Node | 保留版本锁定，增加 adapter | 用户自选模型 | ADR-0001、ADR-0003 |
| 运行时 | 安装器 + runtime-web | 保留并纳入 runtime-pack | 离线运行 | ADR-0012、desktop-acceptance |
| UI 形态 | app.html + DSH 插件入口 | 保留 | 已验证可用且符合用户形态要求 | ADR-0006 |
| 域模型 | manifest 唯一真相源 | 保留并继续校验 | 防止多源漂移 | ADR-0007 |
| 技能体系 | 域技能文件 | 保留并作为模型提示输入 | 保证技能语义 | engine runner |
| 审计 | append-only JSONL | 保留并扩展门禁证据 | 可追溯动作 | ADR-0008 |
| 凭据 | 环境变量 | 保留并改为通用 apiKeyEnv | 禁止密钥落盘 | ADR-0011 |
| 插件 | 单 profile 安装 | 新增 base + overlay + selection lock | 自由选择必须可复现 | ADR-0013 |
| 数据目录 | 安装目录内运行数据 | 改为独立数据根 | 升级、回滚和权限 | ADR-0012 |
| 资源边界 | 三层 | 改为四层 | support 是大体积可选源材料 | 4.0-D02 |
| 发布判定 | U19 文档阻断 | 改为 JSON 硬门禁 + 用户 preview/stable | 防止假通过 | ADR-0009、ADR-0010 |

## B. 4.0 必须新增

1. `runtime-pack`、`source-pack`、`agent-pack`、`support-source-pack` 的独立清单和哈希。
2. `SESSION_INDEX.md`，替代对原始会话库的运行时依赖。
3. 用户自选模型适配器和 `L0/L1/L2` 能力探测。
4. `selection.lock` 和插件依赖、peer、冲突检查。
5. 程序/数据分离和版本化回滚目录。
6. clean VM 运行、模型、开发和回滚门禁。
7. 所有验收证据的 JSON schema 和缺失字段阻断。

## C. 保留但收紧

- 保留 `/workbench/api/app-page`、`engine.run` 和技能文件接口。
- 保留 127.0.0.1、脱敏和安全单调性边界。
- 保留 3.0 域模型和 app.html，不在 4.0 首轮重构 UI。
- 收紧插件安装：不再允许“全量安装后停用”。
- 收紧路径：不再默认写入项目或安装目录。

## D. 明确不纳入 4.0 首轮

- 不把全部 support 插件默认装入 runtime。
- 不把 macOS/Linux 作为 stable 首轮强制平台。
- 不允许用户在硬门禁失败时手工标记 stable。
- 不依赖开发机绝对路径、全局 Node、全局 pnpm、全局 profile 或浏览器缓存。
