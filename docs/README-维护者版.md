# README · Universal Workbench（维护者版）

> 面向维护者：目录结构、总控脚本、升级/回退、CR 流程、缺口治理。学员请看 `README-学员版.md`。

## 1. 目录结构

```
universal-workbench-bundle/
├── 015-*.md（上层任务书，位于上级目录）      唯一执行入口
├── manifests/    packages.manifest.csv（55 行）+ capability-registry.csv（46）
│                 + tag-manifest.csv（哈希链取证）+ scenes/（14）+ workflows/（26）
├── offline/      npm/（24 tarball + SHA256SUMS）+ node/（22 LTS 安装器，经 download-all 获取）
│                 + github/（dsh-web 浅克隆，人工可选）
├── scripts/      workbench.ps1/.sh（总控）+ runner-probe.ps1/.sh + download-all.ps1/.sh（手动兜底）
│                 + launch.ps1 + installer/{win/setup.iss, mac/build_dmg.sh}
│                 + gen-manifest.mjs / gen-domain-assets.mjs（清单与域资产再生成器）
├── templates/    Type-Dict/type-dict.csv + skills-domain/<13 域>/（每域 4 个 SKILL.md）
│                 + workspace/（16 子目录骨架）
├── docs/         PRD-桌面应用-基线.md + CR-checklist.md + README 双版 + preset-design/（13 份）+ 三件套
└── reports/      capability-gap.md（强制占位）+ 各门禁证据产出
```

## 2. 总控脚本（015 §5）

```bash
bash scripts/workbench.sh fetch                    # 预置层校验（断网可跑）+ 缺口层补拉
pwsh -File scripts/workbench.ps1 -Cmd install      # P0/P1 逐包安装 + git tag / 哈希链
bash scripts/workbench.sh verify                   # 十要素矩阵骨架（S6 冒烟回填 TODO）
bash scripts/workbench.sh repair pi2dsh            # 幂等重装
bash scripts/workbench.sh report                   # 自评汇总 → reports/workbench-report.md
```

## 3. 升级与回退（F8）

1. 记录 `tools-versions.txt`（node/npm/pnpm/dsh/pi 五项）
2. 升级单个 P1 包 → 回归该域最小 GT
3. 回退：`git checkout` 或 savepoint；DSH 侧用 `dsh-undo-savepoint` 快照
4. 验证：GT 恢复 PASS；版本断言通过（ERR-INST-003）

## 4. CR 流程

1. 每个 U 门禁产出物 → 复制 `docs/CR-checklist.md` 的模板为 `reports/cr-<artifact>.md`
2. 按五类清单逐项勾选；FAIL 项修复后复验
3. U8 校验 CR 覆盖率 100%（缺一份即门禁不过）

## 5. 缺口治理

- 新能力需求 → 先开扩展位（capability id）→ `npm view` 核验候选包 → 找到则回填 manifest 并下载 → 找不到登记 capability-gap 走降级（自建 MCP / 人工导出 / 暂缓）
- **禁编造包名**（V5/V6）；**引用数据必须带出处**（V8）
- 已知缺口现状见 `reports/capability-gap.md`（dsh-web 构建兜底 + 7 个行业扩展位）

## 6. 已知边界（015 §13）

- 10 Runner 矩阵中 minimax/豆包/Trae/Kimi code 未公开核验（UNVERIFIED_RUNNER）
- dsh-web 源码浅克隆为人工可选步骤；dev 分支 zip 实测 452MB，不打包进 bundle
- EAP 自动化仅到"匿名化转介建议"；多人协同/移动端为非目标
