# README · Universal Workbench（学员版）

> 5 分钟装好，双击可用。遇到报错先查 §4 错误码索引；查不到的按 §5 反馈给维护者登记 capability-gap。

## 1. 安装（F1，离线可装）

- **Windows**：双击 `installer-output/UniversalWorkbench-Setup.exe` → 下一步 → 完成时勾选"首启自检"
- **macOS**：打开 `installer-output/UniversalWorkbench.dmg` → 拖入 Applications → 双击 `Universal Workbench.app`
- 没有安装包？先跑一次下载脚本（网络可用时）：
  - Windows：`pwsh -File scripts/download-all.ps1`
  - macOS：`bash scripts/download-all.sh`
- 安装完成后桌面出现 **Universal Workbench** 图标，双击即启动（F11 自检报告自动生成于 `reports/install-selfcheck.md`）

## 2. 首次启动

1. 双击图标 → 浏览器/壳窗口打开 `http://127.0.0.1:3080`（仅本机可达）
2. 查看 `runner-profile.json`（Runner 适配状态页 F9）
3. 在任务中心（F2）挑一个业务域（F3）发送第一个任务

## 3. 跑通第一个 Golden Task

以招聘为例：任务输入"生成本周招聘漏斗周报（含瓶颈环节）"→ Agent 自主规划执行 → 报告出现在 `reports/rec/`。其他域的示例任务见 `docs/preset-design/` 各域 §5。

## 4. 错误码索引（唯一源在任务书 §7，此处仅索引）

| 症状 | 查 |
|---|---|
| 提示 Node 版本不够 | ERR-ENV-001 |
| 下载失败/超时 | ERR-NPM-001/004 |
| 3080 打不开 | ERR-DSH-002 |
| 侧边栏白屏 | ERR-PLG-001 |
| 审批弹了却还是执行了 | ERR-PLG-004（假审批=FAIL） |
| Python/venv 报错 | ERR-PY-001/002 |
| Windows 脚本报一堆"语法错误" | ERR-ENV-003 |

## 5. 反馈与缺口

任何"应该有但没有"的能力：不要自己找包硬装——登记 `reports/capability-gap.md`（包名 | 档 | 原因 | 影响要素 | 替代方案），由维护者核验后回填。

## 6. 课后作业（对应 015 §11.4）

作业 1-4 见三件套模板（`docs/` 下工作建模/交接文档/30 天落地计划）；**作业 5**：用安装包在第二台机器完成离线安装并提交 F11 自检报告。
