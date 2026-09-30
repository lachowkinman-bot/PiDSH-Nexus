# ADR-0016: Local approval identity, HMAC signatures, and versioned policies

- Status: Accepted
- Date: 2026-09-30
- Supersedes: none

## Context

The first workflow implementation accepted a free-text role and operator name. That proves only that a form was filled; it cannot prove identity, prevent the same operator from impersonating two roles, detect later edits to approval evidence, or reject a record replayed against another instance. Workflow rules also mixed invariant checks with example business thresholds.

## Decision

Approvals use a workspace-local operator registry and HMAC-SHA256 signatures. The signature covers the workflow ID, instance ID, revision, data version, draft hash, operator ID, display name, role, decision, comment, timestamp, and key ID. Dual approval requires distinct registered operator IDs and distinct authorized roles. Approval records are verified whenever an instance is loaded or listed.

Business rules separate hard invariants from configurable policy thresholds. Invariants such as required fields, evidence resolution, PII blocking, approval integrity, artifact hashes, and metric lineage are blocking. Industry and organization thresholds are generated with `status=draft_requires_owner_confirmation`; they cannot become formal gates until the owner confirms a versioned policy.

## Consequences

- The operator signing key is excluded from ordinary workspace backups and never written into deliverables, logs, memory, or model prompts.
- Editing an approval record or replaying it onto another instance invalidates the signature.
- The UI must select registered operators and authorized roles instead of accepting free-text identities.
- Existing legacy approval records without signatures are rejected by the R12 runtime.
- Threshold-bearing rules retain their source and draft status so future policy packs can replace them without changing workflow IDs.
