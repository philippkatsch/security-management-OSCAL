# Project: Reposol E2E Test Suite Expansion

## Architecture
- Framework: Playwright E2E (`npx playwright test`)
- App stack: Vite/React frontend (Port 1001/5173) + FastAPI/Python backend (Port 1000)
- Test location: `reposol/e2e/tests/`
- Data setup: Deterministic RFC 4122 v4 UUIDs via `apiSetup` (`reposol/e2e/helpers/api-setup.ts`)

## Feature Inventory
Every feature from the Survey phase is enumerated below with its assigned milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Status Badges | Document lifecycle status badges (draft, active, archived, deprecated, superseded) | M1 | step0_global_requirements.md |
| 2 | Archival Filter | Stage list filtering by status, including archived view & read-only state | M1 | step0_global_requirements.md |
| 3 | Revision History Drawer | Version drawer, revision history list, release publishing form | M1 | step0_global_requirements.md |
| 4 | Traceability Panel | Traceability page drill-down, timeline, and cross-stage relationship resolution | M1 | step0_global_requirements.md |
| 5 | Reference Integrity Banners | Warnings for unresolved profile references, missing catalog links, superseded parent docs | M1 | step0_global_requirements.md |
| 6 | 409 Force-Delete Modal | Force delete modal triggered by 409 Conflict, force=true API override | M1 | step0_global_requirements.md |
| 7 | Inline Statement Sub-Parts | Inline sub-part editing, nesting badges (a., 1., (a)), prose params, setting modal | M1 | step1_catalog_builder.md |
| 8 | Assessment Objectives & Methods | Objective parsing, examine/interview/test method card, left-border styling, ID badges | M1 | step1_catalog_builder.md |
| 9 | Framework Mapping Links | Links editor for rel=mapping/reference/related/required, fragment input, link rendering | M1 | step1_catalog_builder.md |
| 10| Monaco Dual-Mode Toggle | Visual/JSON mode toggle in toolbar, vs-dark Monaco, NIST schema validation, syntax alert | M1 | step1_catalog_builder.md |
| 11| Withdrawal Workflow | Control withdrawal banner, status=withdrawn prop, incorporated-into forwarding link | M1 | step1_catalog_builder.md |
| 12| Inline Alters Adds/Removes | ProseWithParams text edit generating alters.adds/removes, reset/remove/restore actions | M2 | step2_profile_tailoring.md |
| 13| Custom Local Control Creation | Add Top-level Group prompt, adding custom control groups in profile merge | M2 | step2_profile_tailoring.md |
| 14| Parameter Choice Dropdowns | Single/multi parameter choice select, inherit catalog default, custom freitext, reset | M2 | step2_profile_tailoring.md |
| 15| Drag-to-Trash Target (🗑️) | Drop target [data-dnd-id="trash"] with red hover glow, group/control delete | M2 | step2_profile_tailoring.md |
| 16| Baseline Statistics & Badges | Baseline statistics box, visual alter badges (Added, Modified, Removed, Overridden) | M2 | step2_profile_tailoring.md |
| 17| Sub-Item Addition (➕ Sub-item) | Adding sub-parts under statement (position: ending) and top-level statements | M2 | step2_profile_tailoring.md |
| 18| Wildcard Pattern Matching | Profile match pattern wildcards for control selection (e.g., ac-*, sc-?) | M2 | step2_profile_tailoring.md |
| 19| Merge Combine Directives | Multi-catalog conflict resolution (merge.combine) and resolution engine execution | M2 | step2_profile_tailoring.md |
| 20| Component Types & Metadata | 11 OSCAL component types, identity fields, standard/custom props, typed links | M3 | step3_component_inventory.md |
| 21| Service Protocols & Ports | Service protocols, ports, roles, control implementation sets, implemented requirements | M3 | step3_component_inventory.md |
| 22| Baseline Import & Identity | Baseline profile resolution, system identity, NIST 800-60 information types, FIPS 199 | M3 | step4_ssp_builder.md |
| 23| Boundary Diagrams & Inventory | Boundary/architecture diagrams Base64, component inventory items, security inheritance | M3 | step4_ssp_builder.md |
| 24| Parameter Cascade & Check | 3-level parameter cascade (Catalog -> Profile -> SSP) and SSP completeness check | M3 | step4_ssp_builder.md |
| 25| AP Objectives & Scope | SSP import, local definitions, objectives/methods, reviewed controls, subjects scope | M4 | step5_assessment_plan.md |
| 26| AP Scheduling & Pre-Flight | Activity task scheduling/dependencies, terms & conditions, timeline, pre-flight check | M4 | step5_assessment_plan.md |
| 27| AR Observations & CVSS | AP import, assessment log, observations & evidence, risk CVSS scoring | M4 | step6_assessment_results.md |
| 28| AR Findings & Attestation | Remediation planning, risk log, findings & target status, attestation, trend comparison | M4 | step6_assessment_results.md |
| 29| POA&M Auto-Generation | SSP/AR import, auto-POA&M item generation from AR findings, risk/finding cross-refs | M4 | step7_poam.md |
| 30| POA&M Progress Dashboard | Risk lifecycle/deviations, remediation planning, risk log, progress dashboard | M4 | step7_poam.md |
| 31| Control Mapping Relationships | Provenance/methodology, source/target resource declaration, 6 relationship types | M5 | step8_control_mapping.md |
| 32| Mapping Scoring & Sankey | Qualifiers, confidence scoring, coverage tracking, gap report, matrix & Sankey visuals | M5 | step8_control_mapping.md |
| 33| Full Compliance Lifecycle Chain | Cross-stage E2E chain: Catalog -> Profile -> SSP -> AP -> AR -> POA&M | M5 | cross-document |
| 34| ApiSetup Infrastructure | Extend ApiSetup class for all 8 OSCAL stages with RFC 4122 v4 UUID data setup | M0 | e2e_infra |
| 35| Pytest & Vitest Verification | Ensure 0 regressions across Pytest backend (263) and Vitest frontend (172) suites | M6 | verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | E2E Infra Extension | Extend `ApiSetup` in `reposol/e2e/helpers/api-setup.ts` for all 8 stages | none | DONE |
| M1 | Steps 0 & 1 E2E Coverage | Playwright specs `step0-global-requirements.spec.ts` & `step1-catalog-builder.spec.ts` | M0 | PLANNED |
| M2 | Step 2 E2E Coverage | Playwright spec `step2-profile-tailoring.spec.ts` (deterministic, wildcards, merge.combine) | M0 | PLANNED |
| M3 | Steps 3 & 4 E2E Coverage | Playwright specs `step3-component-inventory.spec.ts` & `step4-ssp-builder.spec.ts` | M0 | PLANNED |
| M4 | Steps 5, 6 & 7 E2E Coverage | Playwright specs `step5-assessment-plan.spec.ts`, `step6-assessment-results.spec.ts`, `step7-poam.spec.ts` | M0 | PLANNED |
| M5 | Step 8 & Lifecycle Chain E2E | Playwright specs `step8-control-mapping.spec.ts` & `full-compliance-lifecycle.spec.ts` | M0-M4 | PLANNED |
| M6 | Complete Suite & Audit | 100% green pass on all Playwright specs, Pytest, Vitest, + Forensic Audit CLEAN | M0-M5 | PLANNED |

## Interface Contracts
- All E2E test files live in `reposol/e2e/tests/`.
- E2E setup uses API setup helper (`apiSetup`) with RFC 4122 v4 UUIDs for document creation & tear-down.
- Playwright runner command: `npx playwright test`.

## Code Layout
- `reposol/e2e/helpers/api-setup.ts` — ApiSetup class with methods for all 8 stages
- `reposol/e2e/fixtures/base.ts` — Custom test fixtures
- `reposol/e2e/tests/step0-global-requirements.spec.ts`
- `reposol/e2e/tests/step1-catalog-builder.spec.ts`
- `reposol/e2e/tests/step2-profile-tailoring.spec.ts`
- `reposol/e2e/tests/step3-component-inventory.spec.ts`
- `reposol/e2e/tests/step4-ssp-builder.spec.ts`
- `reposol/e2e/tests/step5-assessment-plan.spec.ts`
- `reposol/e2e/tests/step6-assessment-results.spec.ts`
- `reposol/e2e/tests/step7-poam.spec.ts`
- `reposol/e2e/tests/step8-control-mapping.spec.ts`
- `reposol/e2e/tests/full-compliance-lifecycle.spec.ts`
