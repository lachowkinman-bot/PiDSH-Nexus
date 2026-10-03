# 第三方组件许可与合规说明

> 适用范围：本仓库（PiDSH Nexus / Universal Workbench 3.0）自带源码、随附资产，以及由本仓库脚本生成的运行时包与安装器。
> 盘点日期：2026-10-02。盘点方法：`package.json`/`node_modules` 依赖树、`src-tauri/Cargo.lock`（455 个 crate）、`offline/npm` 与 `offline/catalog` 下 180 个离线 tarball 的 `package.json`，以及仓库内随附资产目录。

## 1. 本项目自身许可

本仓库自有代码（`src/`、`src-tauri/`、`workbench-ui-plugin/`、`scripts/`、`manifests/`、`templates/`、`docs/`、`reports/`、`lifecycle/`）采用 **Apache License 2.0**，全文见 `LICENSE`；`workbench-ui-plugin/package.json`、根 `package.json`、`src-tauri/Cargo.toml` 均以 SPDX 标识 `Apache-2.0` 声明。

## 2. 仓库内随附的第三方代码与素材

| 组件 | 位置 | 许可 | 义务 |
|---|---|---|---|
| dsh-ppt deck-core（第三方插件代码） | `assets/dsh-ppt/deck-core.mjs` | MIT（Copyright © 2026 stardustlc） | 已随附 `assets/dsh-ppt/LICENSE`，再分发须保留版权与许可声明 |
| Noto Sans CJK SC Regular 字体 | `assets/fonts/NotoSansCJKsc-Regular.otf` | SIL Open Font License 1.1 | 已随附 `assets/fonts/OFL.txt`；不得单独售卖字体；保留保留字体名称（RFN）约定 |
| PiDSH Nexus 品牌字标 | `assets/brand/pids-nexus.svg` | 本项目原创，Apache-2.0 | 无 |

## 3. 构建期 npm 依赖（根 `package.json`，实测依赖树 112 个包）

MIT 83 · ISC 13 · Apache-2.0 5 · MIT/X11 2 · BSD-3-Clause 2 · Unlicense 1 · BlueOak-1.0.0 1 · 0BSD 1 · MIT AND Zlib 1 · MIT OR GPL-3.0-or-later 1 · 未声明 2

需注意项：

- `jszip` 为 `MIT OR GPL-3.0-or-later` 双许可，本项目按 **MIT** 选项使用。
- `pako` 为 `MIT AND Zlib`，两者均为宽松许可。
- `png-js`（`package.json` 未声明许可）在其包内附有 MIT `LICENSE`（Copyright © 2017 Devon Govett），按 MIT 认定。
- `buffers@0.1.1`（substack/node-buffers）未声明许可字段且包内无 LICENSE 文件；它只出现在构建期依赖树中，不随本仓库分发，再分发派生构建物前建议以 npm 元数据（MIT）或上游确认为准。

## 4. 打包进产物 `workbench-ui-plugin/lib/delivery-service.cjs` 的依赖

该文件是 `workbench-ui-plugin/src/delivery-service.mjs` 的 esbuild 打包产物（已入库），内联了：`docx`、`exceljs`、`pdfkit`、`fontkit`、`jszip`、`marked`、`pako`、`png-js`、`sax`。

上述均为 MIT / ISC / BlueOak-1.0.0 等宽松许可。**再分发该文件（或含该文件的安装包）时，须同时提供这些组件的版权与许可声明**；建议在分发物中保留本文件。

## 5. Rust 依赖（`src-tauri/Cargo.lock`，455 个 crate）

本机可解析 248 个（其余为 Android/GTK/WebKit 等异平台依赖，未下载到本地缓存）。已解析部分的许可分布：

`MIT OR Apache-2.0` 125 · MIT 44 · `Apache-2.0 OR MIT` 25 · Unicode-3.0 18 · `Unlicense OR MIT` 8 · `MIT/Apache-2.0` 5 · **MPL-2.0 5** · BSD-3-Clause 2 · Zlib 2 · 其余为等价宽松组合各 1–2 个。

**MPL-2.0 组件**（文件级弱 copyleft，可与 Apache-2.0 组合分发）：`cssparser`、`cssparser-macros`、`dtoa-short`、`option-ext`、`selectors`。义务：对这五个组件的**文件本身**所做的修改需继续以 MPL-2.0 提供；本项目未修改它们。

未发现任何 GPL / AGPL / SSPL 类 crate。

## 6. Python 依赖

`lifecycle/requirements.txt`：`jsonschema==4.23.0`（MIT）。

## 7. 离线插件层（**不随本仓库分发**，由 `scripts/download-all.*` / `download-catalog.mjs` 联网拉取）

180 个 tarball 的许可分布：MIT 150（含 `dsh-memory-plugin@0.7.2`） · Apache-2.0 14 · BSD-3-Clause 3 · ISC 1 · `MIT OR Apache-2.0` 1 · **未声明许可 7** · AGPL-3.0 1 · AGPL-3.0-only 1 · GPL-2.0 1 · Elastic-2.0 1。

### 7.1 出厂 runtime（`manifests/runtime-bundles.json` 记录的 64 个插件）中的红线项

| 包 | 声明许可 | 影响 |
|---|---|---|
| `dsh-lark-bot@0.19.16` | **AGPL-3.0**（包内附 AGPL v3 全文） | 随出厂运行时打包分发；再分发或以网络服务提供时须履行 AGPL 源码公开义务 |
| `dsh-pocket@2.10.6` | **GPL-2.0**（包内附 GPL v2 全文） | 随出厂运行时打包分发；与 AGPL-3.0 组件在同一组合分发物中存在许可兼容性冲突 |
| `@vectorize-io/hindsight-coding-agents@0.7.0` | **未声明**（无 license 字段、无 LICENSE 文件） | 无许可＝默认保留所有权利，**不应再分发**；需先向权利人取得授权或从分发物中移除 |

其余 61 个出厂插件均为 MIT / Apache-2.0 / BSD / ISC 等宽松许可。

### 7.2 仅存在于目录层（未进出厂集）的需关注项

| 包 | 声明许可 | 备注 |
|---|---|---|
| `pi-loop-mode@2.5.4` | AGPL-3.0-only | 仅目录层 |
| `context-mode@1.0.169` | Elastic-2.0（非 OSI 认证） | 仅目录层；不得当作开源许可使用 |
| `graph-memory@1.5.8`、`@mutmutco/pi-plugin@4.5.41`、`markitdown@0.0.4`、`pi-chat@1.0.0`、`pi-maestro-flow@0.31.2`、`pi-tools@1.1.0` | 未在 `package.json` 声明 | 其中 `graph-memory`、`markitdown`、`pi-maestro-flow` 包内自带 LICENSE/声明文件，须逐包确认后再分发 |

## 8. 结论与再分发建议

1. **本仓库自有源码**：可在 Apache-2.0 条款下自由使用、修改、再分发（保留 `LICENSE`、`NOTICE` 与第三方声明）。
2. **克隆/下载本仓库**：仓库不含 `offline/`、`installer-output/`、`Pi_DSH_support/` 内容，因此不触发第 7 节的 copyleft 义务。
3. **由本仓库脚本生成的运行时包与安装器**属于聚合分发物，需先处理第 7.1 节三项，任选其一：
   - 从出厂集移除 `dsh-lark-bot`、`dsh-pocket`、`@vectorize-io/hindsight-coding-agents`（改动 `manifests/runtime-web.package.json` 后重建）；
   - 或将其改为主程序之外的可选安装项，单独分发并随附各自许可证与源码获取方式；
   - 或将整体分发物按 AGPL-3.0 发布（注意其与 GPL-2.0-only 组件的兼容性限制，二者不能简单合并）。
4. 分发的安装包内建议保留本文件与 `LICENSE`、`NOTICE`，并为第 4 节的打包依赖附上对应许可声明。
