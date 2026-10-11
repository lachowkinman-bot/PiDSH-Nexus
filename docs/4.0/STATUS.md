# Universal Workbench 4.0 Status

## 2026-10-11 · DSH 引擎升级 0.1.7-rc.2 → 0.2.0-rc.2（本机全绿）

- 引擎 0.2.0-rc.2（npm 官方 tarball）；runtime build-id `507f1c223c9adbb54f0127f4eec0783f955af2356cd1b14ed3560c6ab4e9ba62`；安装器 `UniversalWorkbench-Setup.exe`（594,280,122 B，sha256 `09AFF1CD…F5659`；旧版保留为 `…-0.1.7-prev.exe`）。
- 门禁：4.0-verify ok=true；UI v4 10/10（QA 与安装态各一轮，两条真实模型旅程）；壳 strict 102/102；capabilities FAIL=0；H6/H7 通过；cohort 扫描仅 1 条带因白名单；回滚演练（0.1.7 profile 自带引擎）通过。
- 装机态四处修复已入包：tools/、config 示例、profile 内引擎优先、唯一文件名运行新安装器（详见 `reports/upgrade-0.2.0-rc.2/` 与 `docs/adr/ADR-0017…`）。
- 已推送 GitHub（PiDSH-Nexus）：master / release-preview / tag `v0.2.0-preview`（3.0 仓库提交 `1339110`，源文件 backlog 见该仓库 `docs/RELEASE-PREVIEW-0.2.0.md`）。

## 已实测通过

- 4.0 独立目录已创建，未修改同级目录。
- 原始方案顶层文档已复制到 `inputs/original-scheme/`。
- `Pi_DSH_support` 已归档为 `support-source-pack.7z`，7-Zip 完整测试通过。
- 归档统计：182,635 个文件，解压后 7,488,718,916 bytes，压缩后 5,251,642,717 bytes。
- `input-bom.json` 已记录原始方案、追溯资料、runtime 和 support 归档 SHA256。
- 安全扫描：secret 0、PII 0。
- 4.0 runtime profile 已在临时数据根中离线初始化成功。
- `dsh 0.1.7-rc.2` 已成功启动，`/workbench/api/app-page` 返回 200，大小 405,785 bytes。
- `4.0.0-dev6` 是当前冻结候选，包含 BOM、SBOM、四层归档和恢复脚本。
- dev4 已恢复测试到独立目录；恢复后的目录通过静态验证，并再次完成离线初始化和 app-page 200。
- dev6 与 dev4 的 runtime/support 内容一致，只包含文档和证据清单的最终更新。
- 插件默认选择为空，`selection.lock` 与依赖验证通过。

早期 `4.0.0-dev` 至 `4.0.0-dev5` 只作为构建审计历史；当前候选是 `4.0.0-dev6`。

## 尚未实测

- 目标机用户自选模型的在线能力探测。
- 至少一条需要真实模型的工作流。
- Windows 10 22H2 clean VM。
- Windows 11 clean VM。
- 完整升级与回滚。
- 目标机开发修改、测试、重建和重新打包。
- SBOM 中 27 个缺少许可证字段的第三方组件需要人工核验。

## 当前建议

当前只能输出阶段报告，不能标记 preview 或 stable。硬门禁 H1-H5、H8 已通过；H6、H7、H9、H10 尚未运行。
