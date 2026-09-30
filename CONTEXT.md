# PiDSH Nexus Context

This glossary defines the canonical language used by the workbench. It contains no implementation plans.

## Domain

A stable business responsibility area. The product has 13 domains. A domain owns a north-star outcome and one or more work modules.

## Work module

A coherent group of related work inside one domain, such as demand planning, transaction control, or hiring closure. A module has a business outcome and contains work items.

## Work item

One accountable business result that a user can start, complete, approve, and review. Every work item maps to exactly one top-level workflow. Multi-step execution belongs inside that workflow's stages.

## Workflow

The executable process for one work item. It defines triggers, ordered stages, inputs, outputs, business rules, LLM tasks, quality gates, approvals, writeback, deliverables, outcome metrics, and failure recovery.

## Stage

One verifiable step in a workflow. The canonical stage sequence is intake, rule validation, LLM analysis, quality gate, human approval or explicit no-approval policy, writeback/delivery, and outcome evaluation.

## Standard

The observable condition that makes a stage acceptable. A standard must state required fields, rules, evidence, thresholds, or a review action; it is not a description of a button or screen.

## TypeDict

The field-level dictionary that connects a business term, physical representation, logical type, source, level, privacy marker, and workflow usage. TypeDict entries must resolve to a CSV column or workflow output field.

## Contract

A JSON Schema pair for one workflow: the validated input payload and the structured output payload. The contract does not replace business rules, approvals, or audit evidence.

## Evidence

A resolvable reference to source data, uploaded files, an upstream workflow instance, a model output, a human decision, or a generated artifact. A conclusion without evidence is not a valid terminal result.

## Outcome

The measured business effect after delivery. Outcomes include the domain north-star metric, contributing strategic key results, quality evaluation, and data freshness.

## Benchmark

An external standard, framework, or established open-source practice recorded in `manifests/benchmark-sources.json` and cited by a module, work item, or stage.

## Business rule

A versioned, identifiable condition that a workflow stage must evaluate. A business rule has a kind, severity, expression, evidence requirement, source, and either active or draft status. Thresholds that require organization-specific confirmation remain draft and cannot gate a formal approval until confirmed.

## Term dictionary

The business-language projection of TypeDict that maps a canonical term to its field, definition, semantic type, unit, level, PII marker, allowed values, and foreign-key target.

## Lineage

A directed relationship between source datasets, workflow stages, contracts, artifacts, metrics, and strategic objectives. Every formal metric value must be traceable through lineage to an instance and source evidence.

## Approval identity

A locally registered operator with authorized roles. An approval signature is an HMAC over workflow, instance, revision, data version, draft hash, operator, role, decision, comment, and time. A signature is not a free-text name.

## Cross-domain effect

A versioned event emitted by one workflow for another domain. It uses an approved anonymous key and an idempotency key; failed delivery is retained for retry and never silently dropped.
