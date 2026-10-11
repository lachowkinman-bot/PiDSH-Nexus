# ADR-0018: Integration layer (visible entries) and the Custom Workbench draft pipeline

- Status: Accepted
- Date: 2026-10-11
- Context: recon reports for `oh-my-dsh/dsh-plugin-upgrade-skill`, `dataelement/dsh-desktop`, `anywhere-labs/dsh-desktop` (see `recon/*.md`), and the 4.0.0-dev8 goal pack.

## Context

The three reference projects were read at source level in the `recon/` reports, but the product surface showed no
trace of them: no visible upgrade/compatibility entry, no visible custom-workbench entry, and no place where the
adoption status of the three projects could be inspected. The plan (approved 2026-10-11) asked for three new
first-level entries on both surfaces (in-shell `⟡ 工作台` panel and the standalone `app.html`), with the Custom
Workbench as the centerpiece: users hand a localized instruction to an agent, the agent authors a draft, the draft
is validated and previewed, and product-level effect requires the existing gates plus a repack.

## Decision

1. **Three new first-level entries** on both surfaces: `自定义工作台` (custom workbench), `升级与兼容`
   (upgrade & compatibility, read-only), `集成中心` (integration hub). The standalone app link is restored
   (`打开独立驾驶舱 ↗`) — the v4 panel had dropped it.
2. **Custom Workbench = draft → verify → preview → consolidation**, agent-executed via a dual channel
   (one-click session via the host `uiWorkspace.startSession` service, plus copy-instruction; automatic
   degradation to clipboard when the host API is unavailable).
3. **Drafts live in the user data root** (`<workspace>/custom/drafts/<id>/`), never in product assets.
   Verification runs on a staging copy (`<workspace>/custom/.staging/<id>/`, sources = manifests/templates/docs/
   src/scripts/workbench-ui-plugin, plus a junction to `node_modules` when present) so the existing generators and
   gates run unmodified.
4. **Two-tier verification, honestly graded**:
   - domain tier (must pass): `gen-workflows` → `<domain>.workflows.json` injection → `gen-domain-model` →
     `build-app` (preview build);
   - fast baseline (seconds, must pass for revise): `build-domain-work-design` → `design:verify`;
   - heavy baseline (minutes, background): `verify:workflow-contracts` + `verify:workflow-delivery`.
   `design:verify` is a closed-set gate (13 domains / 39 modules / 78 workflows); a **new-domain draft** therefore
   records its failure as a machine-readable *baseline-extension gap list* (`baseline_pending`) instead of a
   silent pass. Revise drafts require both baselines to pass before a consolidation package can be exported.
5. **Generator-owned artifacts are guarded**: overlaying `manifests/workflows/*.yaml`,
   `manifests/domain-model/*.json` or `docs/domain-work-design/*.md` fails preflight. Workflow additions go through
   `<domain>.workflows.json` fragments; asset contract = scenes yaml, workflow fragments, workspace CSVs,
   `templates/Type-Dict/field-type-dict.csv` rows, skill files, `docs/preset-design/<domain>.md`.
6. **Consolidation is the only path to product effect**: `consolidation/` (overlay + verify.json + change list +
   README) → `scripts/custom/apply-draft.mjs` (dry-run by default, `--yes` writes, overwritten files backed up to
   `reports/custom/rollback/<draft>/`) → full gates → `build:app` → repack → installed-state acceptance.
   The app marks `已固化` by comparing overlay hashes against the bundle.
7. **Upgrade & compatibility stays read-only** (engine lock, 23 exact exemptions, upgrade evidence, corridor
   coverage from the vendored skill, rollback dry-run reuse). No in-app upgrade execution.
8. **Integration hub is data-driven** from `manifests/integration-status.json`
   (`pids-nexus/integration-status/v1`): per-project `adopted | in-progress | planned | not-adopted` with evidence
   paths and reasons; license/attribution entries are mirrored into `THIRD-PARTY-NOTICES.md`.
9. **Domain index is dynamic**: `GET /workbench/api/domains-index` merges built-in domains (domain-model) with
   custom domains (scene `origin: custom`, optional `label`/`color`); the panel grid and the standalone app render
   from it, and the domain count in labels adapts (`13 域工作台` when no custom domains exist).
10. **anywhere-labs discipline adopted as method, not code**: upstream pinning (tgz + sha256 + exemptions +
    ADR), generation-lifecycle note as design input, network-boundary rules registered for future market work.

## Interfaces (v1)

- Routes: `GET /workbench/api/domains-index`, `GET /upgrade-status`, `GET /integration-status`,
  `GET /custom/development-guide`, `GET /custom/drafts`, `POST /custom/draft-create`, `POST /custom/verify`,
  `POST /custom/verify-heavy`, `POST /custom/preview-build`, `POST /custom/consolidate`,
  `GET /custom/draft-instruction`, `GET /app-page?draft=<id>` (draft preview).
- Schemas: `pids-nexus/custom-draft/v1` (`draft.json`), `pids-nexus/custom-draft-verify/v1` (`verify.json`),
  `pids-nexus/custom-draft-consolidation/v1` (consolidation `manifest.json`),
  `pids-nexus/integration-status/v1`, `pids-nexus/domains-index/v1`.
- Scene yaml optional fields: `label`, `color`, `origin` (`builtin` default; `custom` for user domains) —
  surfaced into `domain-model/v1` as `label`/`color`/`origin`.

## Evidence (this change)

- `reports/custom/fixtures.json`: positive fixtures (rec table addition → domain + fast baseline green;
  `cust-learning` new domain → domain green + baseline gap list) and negative fixtures (raw PII, uncovered skill,
  generated-artifact rewrite) all classified as expected.
- `reports/custom/<draft>/verify.json` (+ draft-local copy): machine-readable step ledger and gaps.
- `manifests/integration-status.json`: 3 projects / 14 adoption items with evidence paths.

## Accepted risks / follow-ups

1. **Baseline generalization is not done.** `design:verify` (and the typedict/workflow-test-matrix couplings)
   remain closed over 13 domains; custom domains are visible and previewable, but their consolidation package
   carries a mandatory baseline-extension gap list. Generalizing the baseline to `13+N` is the next product-level
   step and is intentionally out of scope for dev8.
2. Revise drafts cannot change the built-in 78-workflow set (generator templates are closed); such changes require
   the same baseline work.
3. The heavy gates take ~5+ minutes and run as a detached background job; the draft page polls state instead of
   blocking the DSH host event loop.
4. The in-shell panel and standalone app both fetch live APIs over loopback; the standalone app keeps working from
   `file://` with baked snapshots and an explicit degrade notice for live actions.
5. The one-click custom session copies the instruction and opens a new session view; true prompt prefill depends on
   host API evolution and degrades to clipboard + manual paste.
