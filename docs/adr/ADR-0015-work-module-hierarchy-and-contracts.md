# ADR-0015: Work module hierarchy, contracts, and external benchmarks

- Status: Accepted
- Date: 2026-09-30
- Supersedes: none

## Context

The existing workbench had 13 domains and 78 workflows, but no canonical hierarchy between domain, module, work item, and workflow. Workflows had executable nodes and deliverables, yet stage-level standards, input/output schemas, field dictionaries, benchmark provenance, and outcome lineage were not represented as one machine-readable design.

## Decision

Adopt a four-level model:

`Domain -> Work Module -> Work Item -> Workflow`

Each domain has a north-star metric and contributes to one or more strategic key results. Each work item maps to exactly one top-level workflow. Each workflow expands into seven or more stages: intake, rule validation, LLM analysis, quality gate, approval or explicit no-approval policy, writeback/delivery, and outcome evaluation.

The design is generated from existing workflow and domain models into:

- `manifests/domain-work-design/<domain>.json`
- `manifests/workflow-contracts/<domain>.json`
- `manifests/typedict/<domain>.json`
- `templates/Type-Dict/field-type-dict.csv`
- `docs/domain-work-design/<domain>.md`

JSON Schema defines payload shape, Frictionless Table Schema informs field dictionaries, BPMN informs process stages, OpenLineage informs lineage, Great Expectations informs data assertions, and NIST/COSO/industry standards inform domain controls.

## Alternatives considered

### Keep 78 workflows as the only model

Rejected because users cannot see business responsibilities, owners, or complete work items, and the UI would expose an undifferentiated process list.

### Put every workflow stage in a separate workflow

Rejected because it explodes the top-level count, fragments approvals and deliverable ownership, and makes cross-stage evidence harder to trace.

### Let each domain define its own schema format

Rejected because it prevents cross-domain TypeDict, metric lineage, approval, and audit reuse.

### Write documentation manually per workflow

Rejected because 78 descriptions drift from workflow definitions immediately. Generated projections plus verifier gates keep the model coherent.

## Consequences

- The UI must expose modules, work items, stages, standards, and evidence, not only a workflow card.
- Any workflow not mapped exactly once is a build failure.
- Any deliverable field without TypeDict and input/output contract coverage is a validation failure.
- LLM use is a formal stage with a schema, evidence, confidence, redaction, and failure policy.
- Business outcome linkage is mandatory for every workflow.
