# catalog 安装失败登记（U16 → disabled-packages.md 上游）

| 批 | 包 | 版本 | 原因 |
|---|---|---|---|
| 3 | @deepseek-ai/dsh | 0.1.5-rc.3 | 016 §2 重锁 0.1.7-rc.2：引擎已装 0.1.7-rc.2，禁按 catalog 行降装 0.1.5-rc.3 |
| 1 | @shaoshi/dshscan | 0.5.0 | exit=1 node@1.21.0, protobufjs@7.6.6, sharp@0.34.5. │ │ Run "pnpm approve-builds" to pick which dependencies should be allowed │ │ to run scripts. │ │ │ ╰──────────────────────────────────────────────────────────────────────────────╯ Done in 3.6s using pnpm v10.32.1  |
| 2 | @paperjsx/mcp-server | 0.3.6 | exit=1 workspace:*" is in the dependencies but no package named "@paperjsx/document-diff" is present in the workspace This error happened while installing the dependencies of @paperjsx/mcp-server@0.3.6 at @paperjsx/json-to-xlsx@0.3.6 Packages found in the workspace:  |
| 1 | dsh-memory-plugin | 0.7.2 | exit=1 rotobufjs@7.6.6, sharp@0.33.5, sharp@0.34.5. │ │ Run "pnpm approve-builds" to pick which dependencies should be allowed │ │ to run scripts. │ │ │ ╰──────────────────────────────────────────────────────────────────────────────╯ Done in 2.9s using pnpm v10.32.1  |
| 1 | @shaoshi/dshscan | 0.5.0 | exit=1  fs.R_OK is deprecated, use fs.constants.R_OK instead .../node_modules/better-sqlite3 install: (Use `node --trace-deprecation ...` to show where the warning was created) .../node_modules/better-sqlite3 install: Done ELIFECYCLE Command failed with exit code 1.  |
| 2 | @paperjsx/mcp-server | 0.3.6 | exit=1 workspace:*" is in the dependencies but no package named "@paperjsx/document-diff" is present in the workspace This error happened while installing the dependencies of @paperjsx/mcp-server@0.3.6 at @paperjsx/json-to-xlsx@0.3.6 Packages found in the workspace:  |
| 1 | dsh-memory-plugin | 0.7.2 | exit=1 � .../transformers/node_modules/sharp install: ���������ļ��� .../onnx-proto/node_modules/protobufjs postinstall: Done .../node_modules/better-sqlite3 install: Done .../transformers/node_modules/sharp install: Failed ELIFECYCLE Command failed with exit code 1.  |

## 终态处置（2026-09-29 复跑后更新）

| 包 | 初次失败原因 | 终态 | 证据 |
|---|---|---|---|
| dsh-memory-plugin@0.7.2 | sharp 嵌套构建脚本 node 解析失败（pnpm onlyBuiltDependencies 白名单解决构建本身；dsh 版本风险门需豁免） | **已装+已豁免**（allow-version dsh-memory-plugin@0.7.2 --dsh-version 0.1.7-rc.2） | catalog-install-log.csv 纠正行；profile dependencies |
| @shaoshi/dshscan@0.5.0 | 同上（node/protobufjs/sharp 构建拦截 + dsh 风险门） | **已装+已豁免**（allow-version @shaoshi/dshscan@0.5.0 --dsh-version 0.1.7-rc.2） | 同上 |
| @paperjsx/mcp-server@0.3.6 | 上游包缺陷：依赖 workspace:* 的 @paperjsx/document-diff 不存在 | **破损包，登记 disabled-packages.md，不装** | npm tarball 内 package.json 可复现 |
| @deepseek-ai/dsh@0.1.5-rc.3（batch3 行） | 引擎版本锁（016 §2 重锁 0.1.7-rc.2，禁降装） | **SKIP**（引擎已装 0.1.7-rc.2） | install-log.csv SKIP 行 |
