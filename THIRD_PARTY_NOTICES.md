# Third-Party Notices

Generated from package-lock.json, offline SHA256SUMS.txt, and the optional plugin catalog on 2026-10-02T11:43:17.198Z.

- Components: 856
- Components without an extracted license field: 27

This file is an inventory gate, not a substitute for the license text shipped by each upstream package.
Before publishing stable, review every non-empty license field and add required upstream notices to the immutable release directory.

## Integration references（4.0.0-dev8 集成层，2026-10-11）

以下三个参考项目未整体引入运行时实现；本仓仅采纳其协议、指令与工程纪律，或按 MIT 许可 vendor 其技能文本。
采纳状态与证据路径见 `manifests/integration-status.json` 与 `docs/adr/ADR-0018-integration-layer-and-custom-workbench.md`。

| 项目 | 许可 | 采纳方式 | 需要保留的声明 |
|---|---|---|---|
| [oh-my-dsh/dsh-plugin-upgrade-skill](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill) | MIT（另附 arXiv 2609.30120 引用） | 全量 vendor 到 `tools/dsh-upgrade-skill/`（含 LICENSE 与 PROVENANCE），在本仓升级流程中作为 SOP 使用 | 保留 `tools/dsh-upgrade-skill/LICENSE` 与 `PROVENANCE.md`；引用论文成果时注明 arXiv 编号 |
| [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | MIT | 本地化改写「制作我的工作台」三步流程、需求确认闸门与失败交付规则（`docs/custom-workbench-standard.zh.md`、`workbench-ui-plugin/lib/custom-drafts.mjs`）；未复制其源码实现 | 派生文本按 MIT 注明来源仓库 |
| [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) | MIT | 仅参考其公开文档（上游锁定、世代隔离、网络边界、决策笔记法）并登记为方法层采纳；未复制代码 | 方法引用已在 `manifests/integration-status.json` 与 ADR-0018 中署名 |
