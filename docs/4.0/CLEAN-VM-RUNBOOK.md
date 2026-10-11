# Clean VM Runbook

## 1. 环境

- Windows 11 x64 current supported VM。
- Windows 10 22H2 x64 VM。
- 普通非管理员用户。
- 不安装 Node、pnpm、Git、Rust、Inno Setup 或项目缓存。
- 安装和启动阶段断开网络。

## 2. 运行复现

1. 从发布目录复制包到 VM 的只读挂载目录。
2. 校验 BOM 和 SHA256。
3. 解压或安装 runtime。
4. 运行 `scripts\4.0-init.ps1`。
5. 启动应用，确认主驾驶舱和 13 域导航。
6. 完成至少一条本地交互并确认审计、交付物落盘。
7. 记录 `reports\4.0\runtime-offline.json` 和 `runtime-ui.json`。

## 3. 在线模型门禁

1. 用户填写 `config\model-provider.json`。
2. 通过环境变量注入模型密钥。
3. 执行 adapter probe。
4. 执行一条真实工作流。
5. 确认 usage、模型标识、`engine.run` 审计和交付物。
6. 记录 `model-capability.json` 和 `workflow-live.json`。

## 4. 开发复现

1. 恢复 source-pack 和 agent-pack。
2. 按锁定 URL、版本和哈希恢复开发工具。
3. 修改最小功能。
4. 运行相关测试。
5. 重新打包并生成新 `buildId`。
6. 记录 `dev-rebuild.json`。

## 5. 升级回滚

1. 安装版本 A。
2. 生成用户数据和审计。
3. 安装版本 B 到独立目录。
4. 自检后切换 current。
5. 验证数据保留。
6. 回滚到版本 A。
7. 记录 `upgrade-rollback.json`。

## 6. preview/stable 判定

- 硬门禁失败：停止，不发布。
- Windows 11 全门禁 + Windows 10 冒烟：用户可以决定 preview。
- Windows 10/11 全门禁 + 用户质量确认：用户可以决定 stable。
