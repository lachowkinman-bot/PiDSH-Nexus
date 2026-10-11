# ADR-0017: DSH engine upgrade to 0.2.0-rc.2

- Status: Accepted
- Date: 2026-10-11
- Supersedes: ADR-0003 (engine re-lock to 0.1.7-rc.2) for the engine version; ADR-0003's offline-tarball and no-registry-downgrade rules remain in force.

## Context

The product runtime was locked to `@deepseek-ai/dsh@0.1.7-rc.2`. On 2026-10-11 npm `latest`/`next` both resolve to `0.2.0-rc.2`; dataelement/dsh-desktop and anywhere-labs/dsh-desktop (stable) both ship `0.2.0-rc.2`; the community upgrade corridor (`oh-my-dsh/dsh-plugin-upgrade-skill`) cards the `0.1.7-rc.2 → 0.2.0-rc.1` edge (6 cards, draft) and carries first-hand `0.2.0-rc.2` field notes; the `0.1.7-rc.1 → 0.1.7-rc.2` edge is an acknowledged card gap. The peer-enforcement mechanism shipped in 0.1.7-rc.1 means every plugin whose DSH peer range floors at `^0.1.x` is refused on a 0.2 host unless exempted or re-released.

## Decision

1. Lock the engine to `0.2.0-rc.2` (npm tarball, sha256 `bd27847c…`, cross-checked against the anywhere-labs vendor manifest; their copy is a repack differing only in two dependency-line orderings).
2. Keep the workbench plugin dual-generation: peer/engines `>=0.1.7-rc.2 <0.3.0-0`; all seven client-inject packages verified present in the 0.2.0-rc.2 package set.
3. Product-set compatibility via **exact-version exemptions** in the factory `compatibility.json` (23 plugins whose manifest peers refuse 0.2.0-rc.2; generated from `reports/upgrade-0.2.0-rc.2/peer-audit.json`). No runtime shims and no plugin-internal patching.
4. `dsh-artifacts@0.1.1` becomes shipped-not-loaded: its internal `assertPeerCompatible` hard-asserts `@deepseek-ai/dsh-tools ^0.1.0-rc.6` and no upstream 0.2-compatible release exists. Re-evaluate when upstream ships one.
5. Factory profile patch `welcomeNoticeVersion` is upserted to the 0.2 notice version `2026-09-28.1`; `Invoke-RuntimeRefresh` / Tauri `ensure_runtime` merge semantics become: exact-value upsert for that field, array **union** for compatibility.json, and explicit UTF-8-no-BOM read/write (PS 5.1 default reads mangle UTF-8 and `Set-Content -Encoding UTF8` writes a BOM, which the loader rejects).
6. The default model provider config uses `maxOutputTokens: 8192` (the 2048 default truncated workflow JSON and produced `blocked_model`).
7. QA runs on a parallel data root (`uw4-qa02`); the 0.1.7 data root (`uw4-qa`) and the previous runtime archive remain the rollback artifacts.

## Evidence (reports/upgrade-0.2.0-rc.2/)

- `peer-audit.json`: 62 product plugins audited, 23 need exemption (all `^0.1.x` floors).
- `cohort-scan-*.json`: zero un-allowlisted stale top-level `@deepseek-ai/dsh*`; one allowlisted hoist (`@deepseek-ai/dsh-sdk-client@0.1.0-rc.8`, lark-bot-private) and six plugin-private nested copies recorded.
- `pluginload-report.json`: disabling=0, failedImports=0, pending=0, activationErrors=0 (cold boot on 0.2.0-rc.2).
- `workbench-ui-v4.json`: 10/10 (both journeys end-to-end with live model, artifacts=9 each, 1100×700 viewport, no page errors).
- `shell-strict.json`: 101/102 → 102/102 after registering the new 0.2 control `显示/隐藏代码工作视图`.
- `capabilities` matrix: FAIL=0 (145 local/ready; 20 BLOCKED_EXTERNAL credentials/services; 8 NOT_APPLICABLE incl. dsh-artifacts).
- H6 `model-capability.json` (L0/L1, 79 tokens) and H7 `workflow-live.json` (504 tokens + audit row).
- `touchpoint-scan.json`: 7-class fleet inventory (3287 files, 11832 heuristic hits) for future corridors.
- Installed-state acceptance (2026-10-11): rebuilt installer (exe `06B17DF8…`) installed in place; `{app}\.dsh-home` refreshed to build `507f1c22`; booted via the app's real contract (profile-local engine + `UNIVERSAL_WORKBENCH_ROOT`) → installed-state UI journeys **10/10** and pluginload all-zero. Four installer defects found and fixed by this drill: missing `tools/` (engine runner → MODEL_UNAVAILABLE), missing model-config example, stale global engine shadowing the profile engine (61 pending plugins), and re-running a freshly built Setup.exe at the same path executing the stale binary (run new installers under a unique filename).

## Accepted risks / follow-ups

1. The 23 exempted plugins run 0.1-era code on the 0.2 host. Boot and journey paths are verified; integrations gated by external credentials (lark, im, sentry, …) remain BLOCKED_EXTERNAL and unproven. Re-verify each when upstream publishes 0.2 peer ranges.
2. `/workbench/api/*` is reachable without the host cookie (bare `ctx.webServer.register`); the host shell page itself is 401. This equals the 0.1.7 baseline and is loopback-only; follow-up: move route registration to the `connection` service or add an explicit guard.
3. `@deepseek-ai/dsh-sdk-client@0.1.0-rc.8` stays hoisted for `dsh-lark-bot@0.19.16` (allowlisted; the 0.2 engine closure does not consume that name).
4. The `0.1.7-rc.1 → 0.1.7-rc.2` corridor edge is uncarded in the community repository; PiDSH has first-hand material to contribute back.
