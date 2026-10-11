# ADR-0015 · DSH 引擎升级 0.1.7-rc.2 → 0.2.0-rc.2（兼容整合三家证据）

- **状态**：已采纳（2026-10-11；产品集在 4.0 目录完成全门禁验收，本仓库回填源码面）｜**模块**：M1/M5/M14
- **证据**：4.0 目录 `docs/adr/ADR-0017-dsh-0.2.0-rc.2-engine-upgrade.md` 与 `reports/upgrade-0.2.0-rc.2/`；本目录 `docs/RELEASE-PREVIEW-0.2.0.md`

## 背景

1. 引擎此前锁 `0.1.7-rc.2`（ADR-0003）。2026-10-11 npm `latest`/`next` 均为 `0.2.0-rc.2`；dataelement/dsh-desktop 与 anywhere-labs/dsh-desktop（stable）都已在该版本；社区升级走廊（`oh-my-dsh/dsh-plugin-upgrade-skill`）对 `0.1.7-rc.2 → 0.2.0-rc.1` 有 6 张草稿卡并附 rc.2 一手现场记录；`0.1.7-rc.1 → -rc.2` 一段是公认未成卡缺口。
2. 0.1.7-rc.1 起宿主在安装与启动时强制校验插件 `@deepseek-ai/dsh*` peer 范围；产品集 62 个插件中 23 个的 `^0.1.x` 下界会拒绝 0.2 宿主，不处置会被逐行禁用。

## 决策

1. 引擎锁 `0.2.0-rc.2`（npm 官方 tarball sha256 `bd27847c…f38859`；与 anywhere vendor 副本内容等价，仅 2 条依赖行序不同）。离线 tarball 双落点、禁 registry 降级（沿用 ADR-0003 规则）。
2. 工作台插件双世代：peer/engines `>=0.1.7-rc.2 <0.3.0-0`；7 个 client inject 包已核在 0.2 包集存在。
3. 产品集 23 个插件用**精确版本豁免**（`templates/runtime/compatibility.json`，由 4.0 的 peer-audit 报告生成），不写运行时 shim、不补丁插件内部。
4. `dsh-artifacts@0.1.1` 转 shipped-not-loaded（插件内硬断言 `@deepseek-ai/dsh-tools ^0.1.0-rc.6`；上游无新版）。
5. `@anionex/dsh-vision-toolkit@0.1.45` 重评结论：**维持停用**（调用 0.1.7 起已移除的 `ctx.settings.register`；元数据 `<0.2.0`）；重评条件=上游发 0.2 兼容版。
6. 出厂补丁 `welcomeNoticeVersion` upsert 至 `2026-09-28.1`；刷新合并语义 = 该字段行级 upsert + 豁免表数组并集 + UTF-8 无 BOM 读写（PS 5.1 编码陷阱）。
7. 模型适配器默认 `maxOutputTokens: 8192`（2048 会截断工作流 JSON 造成 `blocked_model`）。

## 被否决的方案

| 方案 | 否决理由 |
|---|---|
| 停在 0.1.7-rc.2 | 两家桌面产品与社区走廊都已前移到 0.2；0.1.7-rc.1→rc.2 缺口也无人补卡，停留只会积累断代 |
| 等 0.2.0 正式版 | 发布日期不可控；且三家证据（vendor 哈希、补丁清单、现场记录）都指向 rc.2 |
| 跟 0.2.1-alpha.2 | 仅 anywhere beta 在用，无稳定证据；alpha 线不符合产品集验收口径 |
| 移除 23 个"peer 不合"插件 | 拆除记忆/侧栏/审批等核心能力，破坏 13 域交付面 |
| 补丁插件内部断言（vision-toolkit 等） | 属升级技能基准 H5 明确警示的"绕过宿主契约"陷阱 |

## 后果

- 4.0 产品集全门禁通过：UI v4 10/10（含两条真实模型旅程）、壳 strict 102/102、capabilities `FAIL=0`、cold-boot 零禁用/零 pending、H6/H7 通过、回滚演练（0.1.7 profile 自带引擎启动 401+工作台 200）通过。
- 23 条豁免属"已验收运行、未证明契约"状态；外部凭据类集成维持 BLOCKED_EXTERNAL，逐条在报告中列明。
- `/workbench/api/*` 在回环上未继承宿主鉴权（与 0.1.7 基线相同）；后续项=迁移到 `connection` 注册或显式守卫（写入 ADR-0017 风险清单）。
