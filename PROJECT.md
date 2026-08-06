# Project: Reposol E2E Test Suite Expansion

## Architecture
- Framework: Playwright E2E (`npx playwright test`)
- App stack: Vite/React frontend + FastAPI/Python backend
- Test location: `reposol/e2e/tests/`
- Data setup: Deterministic RFC 4122 v4 UUIDs via `apiSetup` (`reposol/e2e/utils/api-setup.ts` or helper)

## Feature Inventory
Every feature from the Survey phase is enumerated below with its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Status Badges | Document lifecycle status badges (draft, active, archived, deprecated, superseded) | M1 | step0_analysis.md |
| 2 | Archival Filter | Stage list filtering by status, including archived view & read-only state | M1 | step0_analysis.md |
| 3 | Revision History Drawer | Version drawer, revision history list, release publishing form | M1 | step0_analysis.md |
| 4 | Traceability Panel | Traceability page drill-down, timeline, and cross-stage relationship resolution | M1 | step0_analysis.md |
| 5 | Reference Integrity Banners | Warnings for unresolved profile references, missing catalog links, superseded parent docs | M1 | step0_analysis.md |
| 6 | 409 Force-Delete Modal | Force delete modal triggered by 409 Conflict, force=true API override | M1 | step0_analysis.md |
| 7 | Inline Statement Sub-Parts | Inline sub-part editing, nesting badges (a., 1., (a)), prose params, advanced setting modal | M2 | step1_analysis.md |
| 8 | Assessment Objectives & Methods | Objective parsing, examine/interview/test method card, left-border styling, ID badges | M2 | step1_analysis.md |
| 9 | Framework Mapping Links | Links editor for rel=mapping/reference/related/required, fragment input, link rendering | M2 | step1_analysis.md |
| 10| Monaco Dual-Mode Toggle | Visual/JSON mode toggle in toolbar, vs-dark Monaco, NIST schema validation, invalid JSON alert | M2 | step1_analysis.md |
| 11| Withdrawal/Deprecation Workflow | Control withdrawal banner, status=withdrawn prop, incorporated-into forwarding link, parameter freeze | M2 | step1_analysis.md |
| 12| Inline Alters Adds/Removes | ProseWithParams text edit generating alters.adds/removes, reset/remove/restore statement actions | M3 | step2_analysis.md |
| 13| Custom Local Control Creation | Add Top-level Group prompt, adding custom control groups in profile merge | M3 | step2_analysis.md |
| 14| Parameter Choice Dropdowns | Single/multi parameter choice select, inherit catalog default, custom freitext __custom__, reset | M3 | step2_analysis.md |
| 15| Drag-to-Trash Target (🗑️) | Drop target [data-dnd-id="trash"] with red hover glow, group/control unassign/delete | M3 | step2_analysis.md |
| 16| Baseline Diff Viewer (🔍) | Baseline statistics box, visual diff badges (Added, Modified, Removed, Overridden) | M3 | step2_analysis.md |
| 17| Sub-Item Addition (➕ Sub-item) | Adding sub-parts under statement (position: ending) and top-level statements | M3 | step2_analysis.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Step 0 E2E Coverage | Playwright spec `reposol/e2e/tests/step0-global-requirements.spec.ts` covering Features 1-6 | none | DONE |
| M2 | Step 1 E2E Coverage | Playwright spec `reposol/e2e/tests/step1-catalog-builder.spec.ts` covering Features 7-11 | none | IN_PROGRESS |
| M3 | Step 2 E2E Coverage | Playwright spec `reposol/e2e/tests/step2-profile-tailoring.spec.ts` covering Features 12-17 | none | PLANNED |
| M4 | E2E Integration & Verification | Run full Playwright test suite (`npx playwright test`), verify 0 regressions across all 33+ existing + new tests, deterministic UUID data setup, adversarial hardening, forensic audit | M1, M2, M3 | PLANNED |

## Interface Contracts
- All E2E test files live in `reposol/e2e/tests/`.
- E2E setup uses API setup helper (`apiSetup`) with RFC 4122 v4 UUIDs for document creation & tear-down.
- Playwright runner command: `npx playwright test` (run sequentially as configured).

## Code Layout
- `reposol/e2e/tests/step0-global-requirements.spec.ts`
- `reposol/e2e/tests/step1-catalog-builder.spec.ts`
- `reposol/e2e/tests/step2-profile-tailoring.spec.ts`
