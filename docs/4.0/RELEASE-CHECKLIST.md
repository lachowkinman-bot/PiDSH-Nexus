# Release Checklist

- [ ] 四层资源清单已生成。
- [ ] 原始方案、3.0 追溯资料和 support 归档已生成 SHA256。
- [ ] `reports/4.0/input-bom.json` 完整。
- [ ] `reports/4.0/security-scan.json` 无 secret findings。
- [ ] `reports/4.0/init.json` 通过。
- [ ] Windows 11 clean VM 运行门禁通过。
- [ ] 至少一条真实模型工作流通过。
- [ ] 用户选择模型后 `L0/L1/L2` 结果已记录。
- [ ] 插件选择、依赖和 peer 检查通过。
- [ ] 升级和回滚通过。
- [ ] 目标机开发修改、测试、重建和重新打包通过。
- [ ] Windows 10 冒烟或完整矩阵达到 preview/stable 要求。
- [ ] `releases/4.0.x/BOM.json`、`SBOM.json` 和第三方声明生成。
- [ ] 没有真实密钥、会话库、浏览器 profile 或未登记 PII。
- [ ] 用户已基于实际运行质量决定 preview 或 stable。
