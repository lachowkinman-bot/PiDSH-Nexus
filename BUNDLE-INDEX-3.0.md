# BUNDLE-INDEX · universal-workbench-3.0（执行包 v3.0 · 插件化交付版）

> **本文件夹 = 第三次执行的完整交付包**（自包含）。执行入口：`016-插件化交付增补-v3.0.md`（优先）→ `015-Universal-Workbench-通用工作台交付任务书.md`（v2.2 主干）。
> 制备日：2026-09-28。基础：v2.2 bundle 全量 + 平台原生插件化资源。

## 与 v2.2 bundle 的差异（3.0 增量）

| 资产 | 说明 | 位置 |
|---|---|---|
| **workbench-ui-plugin** | 双面 dsh client-ui 插件（结构逐字镜像范本）：Node 半面（Scene 装载/apply/switch/save/engine-run/audit 路由）+ 浏览器半面（13 域工作台 + F2/F4/F5/F6/F10/F12/F13 面板 + preset 生命周期按钮） | workbench-ui-plugin/ |
| **016 增补任务书** | 插件化交付锁定 + dsh 重锁 0.1.7-rc.2 + U15 v3.0 机械判据（壳内 panel 截图制） | 016-插件化交付增补-v3.0.md |
| **dsh 0.1.7-rc.2 锁定 tarball** | 范本 engines 逐字要求；SHA256 5f2da727…6bff8 | offline-3.0/engines/ |
| **范本源码参考** | task-board 完整 package.json + cordis.patch.yml（完整 src 在 offline/catalog/*.tgz 内，解包即得） | exemplar-reference/ |

## 继承资产（与 v2.2 bundle 相同，见 BUNDLE-INDEX.md）

manifests（55 行清单 + 51 能力 + 14 Scene + 26 工作流 + benchmark 任务集 + domain-ui-checklist + pkg-smoke 定义 + 三批安装）、offline（179 tarball + 引擎 2 + Node 24）、scripts（13 个：workbench 双平台 / scene-loader / install-probe / engine-skill-runner / security-scan / data-consistency / pkg-func-smoke / benchmark-score / credential-probe / download-all 双平台 / 生成器×4）、docs（PRD v2.1 映射 / UI-DELIVERY-SPEC v2.2 / 两份复盘 + 两份 gapfix 台账 / 交付宣告检查单 / benchmark 协议 / 双 README / 三件套 / preset-design 13 份）、reports（security-scan 179 包 0 高危 / 假包档案 29 / 就绪度核验）。

## 执行快速开始

```bash
# 1. 引擎（离线）
npm i -g offline-3.0/engines/deepseek-ai-dsh-0.1.7-rc.2.tgz
# 2. 工作台插件
dsh plugin --profile web add <universal-workbench-3.0 绝对路径>/workbench-ui-plugin
# 3. 启动 + 壳内出现"⟡ 工作台"
npx -y --package @deepseek-ai/dsh@0.1.7-rc.2 dsh web     # 127.0.0.1:3080
# 4. U15 证据：壳内截图 ≥13+12 张 + preset 四操作审计事件 + saved 产物
```

## 门禁与纪律

015 v2.2 §12 **U1-U19**（U16/U19 = 交付阻断 BLOCKING；U15 = 壳内截图机械判据；U18 = engine.run ≥ GT 数）+ 016 §4 U15 v3.0 判据。语义禁令 14 条（§14.6）+ 停止条件 8 条（§10.3，含熔断与交付阻断）。
